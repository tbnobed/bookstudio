import MobileNavbar from "@/components/layout/MobileNavbar";
import { useDevice } from "@/hooks/use-mobile";
import { useLocation } from "wouter";

interface MobileLayoutProps {
  children: React.ReactNode;
}

export default function MobileLayout({ children }: MobileLayoutProps) {
  const { isSmallScreen } = useDevice();
  const [location] = useLocation();

  const isPublicPage = location === "/auth" || 
                     location === "/login" || 
                     location === "/public-calendar" || 
                     location === "/public-calendar/mobile" ||
                     location.startsWith("/reset-password/") ||
                     location.startsWith("/invite/");

  const isMobilePage = location === "/mobile" || 
                    location === "/calendar/mobile" || 
                    (isSmallScreen && (location === "/" || location === "/calendar"));
                    
  const showMobileNav = isSmallScreen && !isPublicPage;

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className={`flex-1 ${showMobileNav ? 'pb-20' : ''}`}>
        {children}
      </div>
      
      {showMobileNav && <MobileNavbar />}
    </div>
  );
}
