import { useState, useEffect } from 'react';
import MobilePublicDailyView from '@/components/calendar/MobilePublicDailyView';
import { useQuery } from '@tanstack/react-query';
import { useDevice } from '@/hooks/use-mobile';
import { useLocation } from 'wouter';
import { MobileBanner } from '@/components/layout/MobileBanner';

export default function MobilePublicCalendarPage() {
  // Detect if we're on a larger screen and redirect to desktop version if needed
  const { isSmallScreen } = useDevice();
  const [, navigate] = useLocation();
  
  // Apply mobile page gradient background
  useEffect(() => {
    document.body.classList.add('mobile-page');
    return () => {
      document.body.classList.remove('mobile-page');
    };
  }, []);

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

  return (
    <div className="flex flex-col h-screen mobile-gradient-bg">
      {/* Consistent Mobile Banner */}
      <MobileBanner />
      
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