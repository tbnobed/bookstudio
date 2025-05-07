import React from "react";
import MobileNavbar from "@/components/layout/MobileNavbar";
import { useDevice } from "@/hooks/use-mobile";
import { useLocation } from "wouter";

interface MobileLayoutProps {
  children: React.ReactNode;
}

/**
 * MobileLayout wraps content with the mobile navigation bar
 * and ensures proper padding at the bottom to prevent content
 * from being hidden behind the nav bar
 */
export default function MobileLayout({ children }: MobileLayoutProps) {
  const { isSmallScreen } = useDevice();
  const [location] = useLocation();

  // Public pages that don't need the mobile navbar
  const isPublicPage = location === "/auth" || 
                     location === "/login" || 
                     location === "/public-calendar" || 
                     location.startsWith("/reset-password/") ||
                     location.startsWith("/invite/");

  // Only show the mobile navbar when on mobile screen and not on a public page
  const showMobileNav = isSmallScreen && !isPublicPage;

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      <div className={`flex-1 ${showMobileNav ? 'pb-16' : ''}`}>
        {children}
      </div>
      
      {/* Mobile navigation bar */}
      {showMobileNav && <MobileNavbar />}
    </div>
  );
}