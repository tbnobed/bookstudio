// Mock implementations for Vite plugins
export function react() {
  return {
    name: 'mock-react-plugin',
    transform: () => null
  };
}

export default {};
export const defineConfig = () => ({});
export function createHotContext() { return { accept: () => {} }; }