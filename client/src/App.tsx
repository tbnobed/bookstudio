import { Switch, Route, useLocation } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { Sidebar } from "@/components/layout/Sidebar";
import CalendarPage from "@/pages/CalendarPage";
import MobileCalendarPage from "@/pages/MobileCalendarPage";
import MyBookingsPage from "@/pages/MyBookingsPage";
import MobileMyBookingsPage from "@/pages/MobileMyBookingsPage";
import TemplatesPage from "@/pages/TemplatesPage";
import ReportsPage from "@/pages/ReportsPage";
import UserManagement from "@/pages/UserManagement";
import SiteManagerUserPage from "@/pages/SiteManagerUserPage";
import Settings from "@/pages/Settings";
import StudiosPage from "@/pages/StudiosPage";
import { useEffect, useState } from "react";
import ToastNotification from "@/components/ui/toast-notification";
import AuthPage from "@/pages/auth-page";
import ResetPasswordPage from "@/pages/ResetPasswordPage";
import PublicCalendarPage from "@/pages/PublicCalendarPage";
import SignagePage from "@/pages/signage-page";
import CustomSignagePage from "@/pages/CustomSignagePage";
import MobilePublicCalendarPage from "@/pages/MobilePublicCalendarPage";
import InvitePage from "@/pages/InvitePage";
import EngineeringPage from "@/pages/engineering-page";
import { ProtectedRoute } from "@/lib/protected-route";
import { TimezoneProvider } from "@/contexts/TimezoneContext";
import { CalendarProvider } from "@/contexts/CalendarContext";
import { SidebarProvider, useSidebar } from "@/contexts/SidebarContext";
import { useDevice } from "@/hooks/use-mobile";
import MobileLayout from "@/components/layout/MobileLayout";
import { DocumentTitle } from "@/components/global/DocumentTitle";
import { NotificationProvider } from "@/hooks/use-notification";
import { initializeFacilityTimezone } from "@/lib/timezoneConfig";

function Router() {
  const [location, setLocation] = useLocation();
  const { isSmallScreen } = useDevice();
  
  // Choose the appropriate calendar component based on screen size
  const CalendarComponent = isSmallScreen ? MobileCalendarPage : CalendarPage;
  
  // Mobile-first home component - Studios page for mobile, Calendar for desktop
  const HomeComponent = isSmallScreen ? StudiosPage : CalendarPage;
  
  // Choose the appropriate My Bookings component based on screen size
  const MyBookingsComponent = isSmallScreen ? MobileMyBookingsPage : MyBookingsPage;
  
  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      <Route path="/login" component={AuthPage} />
      <Route path="/invite/:token" component={InvitePage} />
      <Route path="/reset-password/:token" component={ResetPasswordPage} />
      <Route path="/public-calendar" component={PublicCalendarPage} />
      <Route path="/public-calendar/mobile" component={MobilePublicCalendarPage} />
      <Route path="/signage" component={SignagePage} />
      <Route path="/signage/custom" component={CustomSignagePage} />
      <ProtectedRoute path="/" component={HomeComponent} />
      <ProtectedRoute path="/calendar" component={CalendarComponent} />
      <ProtectedRoute path="/mobile" component={MobileCalendarPage} />
      <ProtectedRoute path="/calendar/mobile" component={MobileCalendarPage} />
      <ProtectedRoute path="/my-bookings" component={MyBookingsComponent} />
      <ProtectedRoute path="/templates" component={TemplatesPage} />
      <ProtectedRoute path="/reports" component={ReportsPage} />
      <ProtectedRoute path="/users" component={UserManagement} />
      <ProtectedRoute path="/producer-management" component={SiteManagerUserPage} />
      <ProtectedRoute path="/engineering" component={EngineeringPage} />
      <ProtectedRoute path="/studios" component={StudiosPage} />
      <ProtectedRoute path="/settings" component={Settings} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [location] = useLocation();
  const { isSmallScreen } = useDevice();
  const { sidebarVisible } = useSidebar();
  
  // Check if we're on an auth page or public page (no sidebar needed)
  const isPublicPage = location === "/auth" || 
                     location === "/login" || 
                     location === "/public-calendar" || 
                     location === "/public-calendar/mobile" ||
                     location === "/signage" ||
                     location === "/signage/custom" ||
                     location.startsWith("/reset-password/") ||
                     location.startsWith("/invite/");
  
  // Check if we're on the mobile-specific page (no sidebar needed)
  const isMobilePage = location === "/mobile" || 
                    location === "/calendar/mobile" ||
                    (isSmallScreen && (location === "/" || location === "/calendar"));
  
  // Only show the sidebar when not on public pages or mobile pages AND when globally visible
  const showSidebar = !isPublicPage && !isMobilePage && sidebarVisible;
  
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Only show sidebar when appropriate */}
      {showSidebar && (
        <>
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
  // Initialize timezone system on app startup
  useEffect(() => {
    initializeFacilityTimezone();
  }, []);

  return (
    <TimezoneProvider>
      <CalendarProvider>
        <NotificationProvider>
          <SidebarProvider>
            <TooltipProvider>
              {/* Add DocumentTitle to update the title when siteName changes */}
              <DocumentTitle />
              <AppLayout>
                <Router />
              </AppLayout>
              <Toaster />
              <ToastNotification />
            </TooltipProvider>
          </SidebarProvider>
        </NotificationProvider>
      </CalendarProvider>
    </TimezoneProvider>
  );
}

export default App;
