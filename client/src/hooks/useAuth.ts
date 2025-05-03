// Temporary simplified auth hook for development
// This will be replaced with proper auth implementation later
import { useLocation } from "wouter";

export function useAuth() {
  const [_, setLocation] = useLocation();

  // Return a simplified version with null user for now
  return {
    user: null,
    logout: async () => {
      console.log("Logout called (temporary implementation)");
      // Redirect to login page on logout
      setLocation("/auth");
      return Promise.resolve();
    }
  };
}
