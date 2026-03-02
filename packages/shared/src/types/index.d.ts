/**
 * Shared Types
 *
 * Common types used across the platform.
 */
export * from './run-envelope';
export * from './openapi';
/**
 * Context Types (Agent 6 - MEMORY)
 */
export interface ContextMetadata {
    id: string;
    project_id: string;
    name: string;
    url?: string;
    data: Record<string, any>;
    created_at: string;
    updated_at: string;
    fetched_at?: string;
}
export interface ContextValidationError {
    key: string;
    reason: string;
}
export declare const TYPES_VERSION = "1.0.0";
//# sourceMappingURL=index.d.ts.map