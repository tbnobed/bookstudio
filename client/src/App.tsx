import { Switch, Route, useLocation } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { Sidebar } from "@/components/layout/Sidebar";
import CalendarPage from "@/pages/CalendarPage";
import MyBookingsPage from "@/pages/MyBookingsPage";
import TemplatesPage from "@/pages/TemplatesPage";
import ReportsPage from "@/pages/ReportsPage";
import UserManagement from "@/pages/UserManagement";
import Settings from "@/pages/Settings";
import { useEffect, useState } from "react";
import ToastNotification from "@/components/ui/toast-notification";
import AuthPage from "@/pages/auth-page";
import PublicCalendarPage from "@/pages/PublicCalendarPage";
import { ProtectedRoute } from "@/lib/protected-route";
import { TimezoneProvider } from "@/contexts/TimezoneContext";

function Router() {
  const [location, setLocation] = useLocation();
  
  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      <Route path="/login" component={AuthPage} />
      <Route path="/public-calendar" component={PublicCalendarPage} />
      <ProtectedRoute path="/" component={CalendarPage} />
      <ProtectedRoute path="/calendar" component={CalendarPage} />
      <ProtectedRoute path="/my-bookings" component={MyBookingsPage} />
      <ProtectedRoute path="/templates" component={TemplatesPage} />
      <ProtectedRoute path="/reports" component={ReportsPage} />
      <ProtectedRoute path="/users" component={UserManagement} />
      <ProtectedRoute path="/settings" component={Settings} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [location] = useLocation();
  
  // Check if we're on an auth page or public page (no sidebar needed)
  const isPublicPage = location === "/auth" || location === "/login" || location === "/public-calendar";
  
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Only show sidebar and menu button when not on public pages */}
      {!isPublicPage && (
        <>
          {/* Mobile menu button */}
          <div className="lg:hidden absolute top-4 left-4 z-50">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
          
          {/* Sidebar Navigation */}
          <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
        </>
      )}
      
      {/* Main Content - adjust margin based on whether sidebar is showing */}
      <div className={`flex-1 ${!isPublicPage ? 'lg:ml-64' : ''} p-0`}>
        {children}
      </div>
    </div>
  );
}

function App() {
  return (
    <TimezoneProvider>
      <TooltipProvider>
        <AppLayout>
          <Router />
        </AppLayout>
        <Toaster />
        <ToastNotification />
      </TooltipProvider>
    </TimezoneProvider>
  );
}

export default App;
