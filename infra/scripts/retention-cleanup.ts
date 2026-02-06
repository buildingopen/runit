/**
 * Retention cleanup script
 *
 * Deletes old data according to retention policies:
 * - Runs > 30 days
 * - Artifacts > 7 days
 * - Logs > 24 hours
 *
 * Designed to run as a cron job (daily)
 */

import { Pool } from 'pg';
import { S3Client, DeleteObjectsCommand } from '@aws-sdk/client-s3';

interface CleanupConfig {
  runs: {
    retentionDays: number;
  };
  artifacts: {
    retentionDays: number;
  };
  logs: {
    retentionHours: number;
  };
}

const config: CleanupConfig = {
  runs: {
    retentionDays: 30,
  },
  artifacts: {
    retentionDays: 7,
  },
  logs: {
    retentionHours: 24,
  },
};

interface CleanupStats {
  runsDeleted: number;
  artifactsDeleted: number;
  logsCleared: number;
  duration: number;
  timestamp: string;
}

/**
 * Initialize database connection
 */
function getDbPool(): Pool {
  return new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
  });
}

/**
 * Delete runs older than retention period
 */
async function cleanupOldRuns(pool: Pool): Promise<number> {
  const retentionDate = new Date();
  retentionDate.setDate(retentionDate.getDate() - config.runs.retentionDays);

  const result = await pool.query(
    `
    DELETE FROM runs
    WHERE created_at < $1
    RETURNING id
    `,
    [retentionDate]
  );

  return result.rowCount || 0;
}

/**
 * Delete artifacts older than retention period
 */
async function cleanupOldArtifacts(pool: Pool): Promise<number> {
  const retentionDate = new Date();
  retentionDate.setDate(retentionDate.getDate() - config.artifacts.retentionDays);

  const result = await pool.query(
    `
    DELETE FROM artifacts
    WHERE created_at < $1
    RETURNING id, storage_ref
    `,
    [retentionDate]
  );

  // Delete from S3 if configured
  const s3Bucket = process.env.S3_BUCKET;
  if (s3Bucket && result.rows.length > 0) {
    const s3Client = new S3Client({});
    const storageRefs = result.rows
      .map((row) => row.storage_ref)
      .filter((ref): ref is string => ref && ref !== 'inline');

    if (storageRefs.length > 0) {
      // S3 DeleteObjects supports up to 1000 keys per request
      const batchSize = 1000;
      for (let i = 0; i < storageRefs.length; i += batchSize) {
        const batch = storageRefs.slice(i, i + batchSize);
        try {
          await s3Client.send(
            new DeleteObjectsCommand({
              Bucket: s3Bucket,
              Delete: {
                Objects: batch.map((key) => ({ Key: key })),
                Quiet: true,
              },
            })
          );
          console.log(`  Deleted ${batch.length} objects from S3`);
        } catch (error) {
          console.error(`  Failed to delete S3 objects:`, error);
          // Continue with other batches even if one fails
        }
      }
    }
  }

  return result.rowCount || 0;
}

/**
 * Clear logs from runs older than retention period
 */
async function clearOldLogs(pool: Pool): Promise<number> {
  const retentionDate = new Date();
  retentionDate.setHours(retentionDate.getHours() - config.logs.retentionHours);

  const result = await pool.query(
    `
    UPDATE runs
    SET logs = NULL
    WHERE created_at < $1
      AND logs IS NOT NULL
    RETURNING id
    `,
    [retentionDate]
  );

  return result.rowCount || 0;
}

/**
 * Run cleanup process
 */
async function runCleanup(): Promise<CleanupStats> {
  const startTime = Date.now();
  const pool = getDbPool();

  try {
    console.log('Starting retention cleanup...');

    // Run cleanups in parallel
    const [runsDeleted, artifactsDeleted, logsCleared] = await Promise.all([
      cleanupOldRuns(pool),
      cleanupOldArtifacts(pool),
      clearOldLogs(pool),
    ]);

    const stats: CleanupStats = {
      runsDeleted,
      artifactsDeleted,
      logsCleared,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    };

    console.log('Cleanup completed:');
    console.log(`  - Runs deleted: ${runsDeleted}`);
    console.log(`  - Artifacts deleted: ${artifactsDeleted}`);
    console.log(`  - Logs cleared: ${logsCleared}`);
    console.log(`  - Duration: ${stats.duration}ms`);

    return stats;
  } catch (error) {
    console.error('Cleanup failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

/**
 * Dry run - show what would be deleted without deleting
 */
async function dryRun(): Promise<void> {
  const pool = getDbPool();

  try {
    console.log('Running dry run (no deletions)...\n');

    // Check runs
    const runsRetentionDate = new Date();
    runsRetentionDate.setDate(runsRetentionDate.getDate() - config.runs.retentionDays);

    const runsResult = await pool.query(
      `
      SELECT COUNT(*) as count
      FROM runs
      WHERE created_at < $1
      `,
      [runsRetentionDate]
    );

    console.log(`Runs older than ${config.runs.retentionDays} days: ${runsResult.rows[0].count}`);

    // Check artifacts
    const artifactsRetentionDate = new Date();
    artifactsRetentionDate.setDate(artifactsRetentionDate.getDate() - config.artifacts.retentionDays);

    const artifactsResult = await pool.query(
      `
      SELECT COUNT(*) as count
      FROM artifacts
      WHERE created_at < $1
      `,
      [artifactsRetentionDate]
    );

    console.log(`Artifacts older than ${config.artifacts.retentionDays} days: ${artifactsResult.rows[0].count}`);

    // Check logs
    const logsRetentionDate = new Date();
    logsRetentionDate.setHours(logsRetentionDate.getHours() - config.logs.retentionHours);

    const logsResult = await pool.query(
      `
      SELECT COUNT(*) as count
      FROM runs
      WHERE created_at < $1
        AND logs IS NOT NULL
      `,
      [logsRetentionDate]
    );

    console.log(`Runs with logs older than ${config.logs.retentionHours} hours: ${logsResult.rows[0].count}`);

    console.log('\nNo deletions performed (dry run).');
  } catch (error) {
    console.error('Dry run failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

/**
 * Main entry point
 */
async function main() {
  const isDryRun = process.argv.includes('--dry-run');

  try {
    if (isDryRun) {
      await dryRun();
    } else {
      const stats = await runCleanup();

      // Write stats to file for monitoring
      if (process.env.STATS_FILE) {
        const fs = await import('fs/promises');
        await fs.writeFile(
          process.env.STATS_FILE,
          JSON.stringify(stats, null, 2)
        );
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { runCleanup, dryRun, CleanupStats };
