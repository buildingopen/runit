// ABOUTME: Entry point for @runtime-ai/shared, the monorepo's single source of truth.
// ABOUTME: Re-exports all contracts, types, and Zod schemas to prevent shape drift across services.
/**
 * @runtime-ai/shared
 *
 * Shared types, contracts, and schemas for Runtime.
 * Single source of truth to prevent shape drift.
 */
export * from './contracts';
export * from './types';
export * from './schemas';
export const VERSION = '0.1.0';
