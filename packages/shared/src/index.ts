// ABOUTME: Entry point for @runtime-ai/shared, the monorepo's single source of truth.
// ABOUTME: Re-exports all contracts, types, and Zod schemas to prevent shape drift across services.
/**
 * @runtime-ai/shared
 *
 * Shared types, contracts, and schemas for Execution Layer.
 * Single source of truth to prevent shape drift.
 */

// Contracts (Agent 1 - ARCHITECT)
export * from './contracts';

// Types (Agent 1 - ARCHITECT)
export * from './types';

// Schemas (Agent 1 - ARCHITECT)
export * from './schemas';

export const VERSION = '0.1.0';

// Merged: Combined Agent A and Agent B modifications
// Agent A's modification
// Agent B's different modification
