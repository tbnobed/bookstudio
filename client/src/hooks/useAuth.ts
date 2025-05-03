import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { User } from "@shared/schema";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [_, setLocation] = useLocation();

  useEffect(() => {
    async function fetchUser() {
      try {
        setIsLoading(true);
        const res = await fetch("/api/auth/user", {
          credentials: "include",
        });

        if (res.status === 401) {
          setUser(null);
          return;
        }

        if (!res.ok) {
          throw new Error("Failed to fetch user");
        }

        const data = await res.json();
        setUser(data.user || data);
      } catch (err) {
        console.error("Error loading user:", err);
        setError(err instanceof Error ? err : new Error("Failed to load user"));
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    }

    fetchUser();
  }, []);

  const logout = async () => {
    try {
      await apiRequest("POST", "/api/auth/logout");
      setUser(null);
      window.location.href = "/auth";
    } catch (err) {
      console.error("Error during logout:", err);
    }
  };

  return {
    user,
    isLoading,
    error,
    logout,
    loginMutation: { mutate: () => {} },
    logoutMutation: { mutate: logout },
    registerMutation: { mutate: () => {} }
  };
}
