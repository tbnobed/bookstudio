import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { Redirect, useRoute, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";

const ROUTE_PERMISSIONS: Record<string, string[]> = {
  "/users": ["admin"],
  "/producer-management": ["site_manager"],
  "/reports": ["admin", "engineer", "production", "production_coordinator", "it", "site_manager"]
};

export function ProtectedRoute({
  path,
  component: Component,
}: {
  path: string;
  component: () => React.JSX.Element;
}) {
  const { user, isLoading } = useAuth();
  const [matches] = useRoute(path);
  const [currentPath] = useLocation();

  if (!matches) return null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to={`/auth?from=${encodeURIComponent(currentPath)}`} />;
  }

  if (ROUTE_PERMISSIONS[path] && !ROUTE_PERMISSIONS[path].includes(user.role)) {
    return (
      <div className="flex flex-col h-screen">
        <div className="container mx-auto p-4 flex items-center justify-center h-full">
          <Card className="w-full max-w-md">
            <CardContent className="pt-6">
              <div className="flex mb-4 gap-2 justify-center text-amber-500">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                  <line x1="12" y1="9" x2="12" y2="13"></line>
                  <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
                <h1 className="text-2xl font-bold">Access Denied</h1>
              </div>
              <p className="text-center text-gray-600">
                You don't have permission to access this page.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return <Component />;
}
