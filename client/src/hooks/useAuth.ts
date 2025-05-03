// Temporary simplified auth hook for development
// This will be replaced with proper auth implementation later
export function useAuth() {
  // Return a simplified version with null user for now
  return {
    user: null,
    logout: async () => {
      console.log("Logout called (temporary implementation)");
      return Promise.resolve();
    }
  };
}
