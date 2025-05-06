// Production stubs for Vite plugins - used only in the production build
// These implementations mimic the basic interface of the actual plugins
// but don't include any development-only functionality

/**
 * Mock implementation of the React plugin
 * @returns A plugin object with the expected interface
 */
export function react(options = {}) {
  return {
    name: 'vite:react-production-stub',
    enforce: 'pre',
    config: () => ({}),
    transform: () => null,
    resolveId: () => null,
    load: () => null
  };
}

/**
 * Mock implementation of Replit's cartographer plugin
 */
export function cartographer() {
  return {
    name: 'vite:cartographer-production-stub',
    configResolved: () => {},
    configureServer: () => {},
    transform: () => null
  };
}

/**
 * Mock implementation of Replit's runtime error modal plugin
 */
export function runtimeErrorModal() {
  return {
    name: 'vite:runtime-error-modal-production-stub',
    configResolved: () => {},
    configureServer: () => {},
    transform: () => null
  };
}

// Default export as used in imports like: import react from '@vitejs/plugin-react'
export default react;

// Additional Vite utilities that might be imported
export const defineConfig = (config) => config;
export function createHotContext() {
  return {
    accept: () => {},
    dispose: () => {},
    invalidate: () => {},
    on: () => {},
    prune: () => {}
  };
}