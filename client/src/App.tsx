import { Switch, Route, useLocation } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { Sidebar } from "@/components/layout/Sidebar";
import CalendarPage from "@/pages/CalendarPage";
import MobileCalendarPage from "@/pages/MobileCalendarPage";
import MyBookingsPage from "@/pages/MyBookingsPage";
import TemplatesPage from "@/pages/TemplatesPage";
import ReportsPage from "@/pages/ReportsPage";
import UserManagement from "@/pages/UserManagement";
import SiteManagerUserPage from "@/pages/SiteManagerUserPage";
import Settings from "@/pages/Settings";
import { useEffect, useState } from "react";
import ToastNotification from "@/components/ui/toast-notification";
import AuthPage from "@/pages/auth-page";
import ResetPasswordPage from "@/pages/ResetPasswordPage";
import PublicCalendarPage from "@/pages/PublicCalendarPage";
import SignagePage from "@/pages/signage-page";
import MobilePublicCalendarPage from "@/pages/MobilePublicCalendarPage";
import InvitePage from "@/pages/InvitePage";
import EngineeringPage from "@/pages/engineering-page";
import { ProtectedRoute } from "@/lib/protected-route";
import { TimezoneProvider } from "@/contexts/TimezoneContext";
import { CalendarProvider } from "@/contexts/CalendarContext";
import { useDevice } from "@/hooks/use-mobile";
import MobileLayout from "@/components/layout/MobileLayout";
import { DocumentTitle } from "@/components/global/DocumentTitle";
import { NotificationProvider } from "@/hooks/use-notification";

function Router() {
  const [location, setLocation] = useLocation();
  const { isSmallScreen } = useDevice();
  
  // Choose the appropriate calendar component based on screen size
  const CalendarComponent = isSmallScreen ? MobileCalendarPage : CalendarPage;
  
  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      <Route path="/login" component={AuthPage} />
      <Route path="/invite/:token" component={InvitePage} />
      <Route path="/reset-password/:token" component={ResetPasswordPage} />
      <Route path="/public-calendar" component={PublicCalendarPage} />
      <Route path="/public-calendar/mobile" component={MobilePublicCalendarPage} />
      <Route path="/signage" component={SignagePage} />
      <ProtectedRoute path="/" component={CalendarComponent} />
      <ProtectedRoute path="/calendar" component={CalendarComponent} />
      <ProtectedRoute path="/mobile" component={MobileCalendarPage} />
      <ProtectedRoute path="/calendar/mobile" component={MobileCalendarPage} />
      <ProtectedRoute path="/my-bookings" component={MyBookingsPage} />
      <ProtectedRoute path="/templates" component={TemplatesPage} />
      <ProtectedRoute path="/reports" component={ReportsPage} />
      <ProtectedRoute path="/users" component={UserManagement} />
      <ProtectedRoute path="/producer-management" component={SiteManagerUserPage} />
      <ProtectedRoute path="/engineering" component={EngineeringPage} />
      <ProtectedRoute path="/settings" component={Settings} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [location] = useLocation();
  const { isSmallScreen } = useDevice();
  
  // Check if we're on an auth page or public page (no sidebar needed)
  const isPublicPage = location === "/auth" || 
                     location === "/login" || 
                     location === "/public-calendar" || 
                     location === "/public-calendar/mobile" ||
                     location === "/signage" ||
                     location.startsWith("/reset-password/") ||
                     location.startsWith("/invite/");
  
  // Check if we're on the mobile-specific page (no sidebar needed)
  const isMobilePage = location === "/mobile" || 
                    location === "/calendar/mobile" ||
                    (isSmallScreen && (location === "/" || location === "/calendar"));
  
  // Only show the sidebar when not on public pages or mobile pages
  const showSidebar = !isPublicPage && !isMobilePage;
  
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Only show sidebar and menu button when appropriate */}
      {showSidebar && (
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
      <div className={`flex-1 ${showSidebar ? 'lg:ml-64' : ''} p-0`}>
        {/* For mobile screens, wrap in MobileLayout to add the navbar at the bottom */}
        {isSmallScreen ? (
          <MobileLayout>
            {children}
          </MobileLayout>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

function App() {
  return (
    <TimezoneProvider>
      <CalendarProvider>
        <NotificationProvider>
          <TooltipProvider>
            {/* Add DocumentTitle to update the title when siteName changes */}
            <DocumentTitle />
            <AppLayout>
              <Router />
            </AppLayout>
            <Toaster />
            <ToastNotification />
          </TooltipProvider>
        </NotificationProvider>
      </CalendarProvider>
    </TimezoneProvider>
  );
}

export default App;
