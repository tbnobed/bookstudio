import { useState, useEffect } from 'react';
import MobilePublicDailyView from '@/components/calendar/MobilePublicDailyView';
import { useQuery } from '@tanstack/react-query';
import { useDevice } from '@/hooks/use-mobile';
import { useLocation } from 'wouter';

export default function MobilePublicCalendarPage() {
  // Detect if we're on a larger screen and redirect to desktop version if needed
  const { isSmallScreen } = useDevice();
  const [, navigate] = useLocation();
  
  // If we're on the mobile public calendar page but using a larger screen,
  // redirect to the standard public calendar page
  useEffect(() => {
    // Log device detection for debugging
    console.log("MobilePublicCalendarPage: Device detection", { 
      isSmallScreen, 
      windowWidth: window.innerWidth,
      userAgent: navigator.userAgent
    });
    
    // Use immediate redirection with a timeout to ensure it happens after rendering
    if (!isSmallScreen) {
      console.log("MobilePublicCalendarPage: Redirecting to desktop view");
      // Use setTimeout to ensure redirection happens after component mounts
      const redirectTimer = setTimeout(() => {
        window.location.href = '/public-calendar';
      }, 100);
      
      return () => clearTimeout(redirectTimer);
    }
  }, [isSmallScreen]);
  
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  
  // Get the site name
  const { data: siteSettings } = useQuery({
    queryKey: ['/api/system/site-name'],
    queryFn: async () => {
      const res = await fetch('/api/system/site-name');
      return res.json();
    },
    staleTime: 60 * 60 * 1000, // 1 hour
  });

  const siteName = siteSettings?.siteName || 'BookStud.io';

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Custom header bar with gradient */}
      <header className="bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 text-white p-3 flex justify-center items-center h-14 shadow-lg">
        <h1 className="text-xl font-bold">{siteName}</h1>
      </header>
      
      {/* Main content */}
      <div className="flex-1 overflow-hidden">
        <MobilePublicDailyView 
          initialDate={currentDate}
          onDateChange={setCurrentDate}
        />
      </div>
    </div>
  );
}