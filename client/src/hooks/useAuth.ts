import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { User } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [_, setLocation] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    async function fetchUser() {
      try {
        setIsLoading(true);
        const res = await fetch("/api/user", {
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

  const login = async (username: string, password: string) => {
    try {
      setIsLoading(true);
      const res = await apiRequest("POST", "/api/login", { username, password });
      const data = await res.json();
      setUser(data.user || data);
      
      toast({
        title: "Login successful",
        description: `Welcome back, ${data.name || data.username}!`,
      });
      
      return data;
    } catch (err) {
      console.error("Error during login:", err);
      toast({
        title: "Login failed",
        description: err instanceof Error ? err.message : "Authentication failed",
        variant: "destructive",
      });
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (userData: any) => {
    try {
      setIsLoading(true);
      const res = await apiRequest("POST", "/api/register", userData);
      const data = await res.json();
      setUser(data.user || data);
      
      toast({
        title: "Registration successful",
        description: `Welcome, ${data.name || data.username}!`,
      });
      
      return data;
    } catch (err) {
      console.error("Error during registration:", err);
      toast({
        title: "Registration failed",
        description: err instanceof Error ? err.message : "Registration failed",
        variant: "destructive",
      });
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await apiRequest("POST", "/api/logout");
      setUser(null);
      toast({
        title: "Logged out",
        description: "You have been successfully logged out.",
      });
      window.location.href = "/auth";
    } catch (err) {
      console.error("Error during logout:", err);
      toast({
        title: "Logout failed",
        description: "Failed to log out properly.",
        variant: "destructive",
      });
    }
  };

  return {
    user,
    isLoading,
    error,
    login,
    logout,
    register,
    loginMutation: { mutate: login },
    logoutMutation: { mutate: logout },
    registerMutation: { mutate: register }
  };
}
