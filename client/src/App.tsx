import { Switch, Route, useLocation, Link } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import NotFound from "@/pages/not-found";
import { Sidebar } from "@/components/layout/Sidebar";
import CalendarPage from "@/pages/CalendarPage";
import Login from "@/pages/Login";
import MyBookingsPage from "@/pages/MyBookingsPage";
import TemplatesPage from "@/pages/TemplatesPage";
import ReportsPage from "@/pages/ReportsPage";
import UserManagement from "@/pages/UserManagement";
import Settings from "@/pages/Settings";
import { useEffect, useState } from "react";
import ToastNotification from "@/components/ui/toast-notification";

function Router() {
  const { user, isLoading } = useAuth();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !user && location !== "/login") {
      setLocation("/login");
    }
  }, [user, isLoading, location, setLocation]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center w-full h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <Switch>
      <Route path="/login" component={Login} />
      
      {/* Protected Routes */}
      {user && (
        <Switch>
          <Route path="/" component={CalendarPage} />
          <Route path="/calendar" component={CalendarPage} />
          <Route path="/my-bookings" component={MyBookingsPage} />
          <Route path="/templates" component={TemplatesPage} />
          <Route path="/reports" component={ReportsPage} />
          
          {/* Admin Routes */}
          {user.role === "admin" && (
            <Switch>
              <Route path="/user-management" component={UserManagement} />
              <Route path="/settings" component={Settings} />
            </Switch>
          )}
          
          {/* Fallback */}
          <Route component={NotFound} />
        </Switch>
      )}
      
      {/* Fallback when not logged in */}
      {!user && !isLoading && location !== "/login" && (
        <Route component={() => {
          setLocation("/login");
          return null;
        }} />
      )}
    </Switch>
  );
}

function AppLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  if (!user) return <>{children}</>;
  
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile menu button */}
      <div className="lg:hidden absolute top-4 left-4 z-50">
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>
      
      {/* Sidebar Navigation */}
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      
      {/* Main Content */}
      <div className="flex-1 lg:ml-64 p-0">
        {children}
      </div>
    </div>
  );
}

function App() {
  const { user } = useAuth();
  const [location] = useLocation();
  
  return (
    <TooltipProvider>
      <AppLayout>
        <Router />
      </AppLayout>
      <Toaster />
      <ToastNotification />
    </TooltipProvider>
  );
}

export default App;
