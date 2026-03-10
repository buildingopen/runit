// ABOUTME: Entry point for @runit/shared, the monorepo's single source of truth.
// ABOUTME: Re-exports all contracts, types, and Zod schemas to prevent shape drift across services.
/**
 * @runit/shared
 *
 * Shared types, contracts, and schemas for RunIt.
 * Single source of truth to prevent shape drift.
 */
export * from './contracts';
export * from './types';
export * from './schemas';
export const VERSION = '0.1.0';
