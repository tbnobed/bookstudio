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

function Router() {
  const [location, setLocation] = useLocation();

  return (
    <Switch>
      <Route path="/login" component={AuthPage} />
      <Route path="/auth" component={AuthPage} />
      <Route path="/" component={AuthPage} />
      <Route component={AuthPage} />
    </Switch>
  );
}

function AppLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [location] = useLocation();
  
  // Check if we're on an auth page
  const isAuthPage = location === "/auth" || location === "/login" || location === "/";
  
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Only show sidebar and menu button when not on auth pages */}
      {!isAuthPage && (
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
      <div className={`flex-1 ${!isAuthPage ? 'lg:ml-64' : ''} p-0`}>
        {children}
      </div>
    </div>
  );
}

function App() {
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
