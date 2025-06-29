import { useState, useEffect } from "react";
import { useDevice } from "@/hooks/use-mobile";
import MobileDailyView from "@/components/calendar/MobileDailyView";
import MobileNavbar from "@/components/layout/MobileNavbar";
import { useLocation } from "wouter";
import { useCalendarContext } from "@/contexts/CalendarContext";
import { MobileBanner } from "@/components/layout/MobileBanner";

export default function MobileCalendarPage() {
  const { isSmallScreen, isTablet, isDesktop } = useDevice();
  const [, navigate] = useLocation();
  const { selectedDate, setSelectedDate, view, setView } = useCalendarContext();
  
  // Local state as a fallback and to maintain component-level control
  const [currentDate, setCurrentDate] = useState(selectedDate || new Date());

  // Redirect to desktop calendar if not on mobile or tablet
  useEffect(() => {
    if (isDesktop) {
      navigate("/calendar");
    }
  }, [isDesktop, navigate]);

  // Add touch overflow scrolling
  useEffect(() => {
    // Set body overflow to auto for better mobile scrolling
    document.body.style.overflow = 'auto';
    document.documentElement.style.overflow = 'auto';
    
    // Prevent elastic overscroll on Safari
    document.body.style.overscrollBehavior = 'none';
    document.documentElement.style.overscrollBehavior = 'none';
    
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      document.body.style.overscrollBehavior = '';
      document.documentElement.style.overscrollBehavior = '';
    };
  }, []);

  // Handle date change with enhanced debugging
  const handleDateChange = (date: Date) => {
    // Create a clean date object to avoid reference issues
    const cleanDate = new Date(date.getTime());
    
    // Update both component state and global context
    setCurrentDate(cleanDate);
    setSelectedDate(cleanDate);
  };

  // Handle view change (will navigate to weekly view)
  const handleViewChange = (newView: "day" | "week" | "month") => {
    if (newView === "week") {
      // Update the global context before navigating
      setView(newView);
      navigate("/calendar");
    } else {
      // Update both local and global state
      setView(newView);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden">
      {/* White content area with banner inside - matches My Bookings structure */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* Modern Site Banner at top of white content */}
        <MobileBanner />
        
        <MobileDailyView
          currentDate={currentDate}
          onDateChange={handleDateChange}
          onViewChange={handleViewChange}
        />
      </div>
    </div>
  );
}