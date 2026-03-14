// ABOUTME: Library entry point for @buildingopen/control-plane package.
// ABOUTME: Exports createApp() factory and key types so cloud-plane can import and extend.

export { createApp, type AppConfig, type MiddlewareHandler } from './app.js';
export { type FeatureFlags, type RunitMode } from './config/features.js';
export { type AuthUser, type AuthContext } from './middleware/auth.js';
