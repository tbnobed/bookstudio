import { useState, useEffect } from "react";
import { useDevice } from "@/hooks/use-mobile";
import MobileDailyView from "@/components/calendar/MobileDailyView";
import { useLocation } from "wouter";

export default function MobileCalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<"day" | "week" | "month">("day");
  const { isMobile, isTablet, isDesktop } = useDevice();
  const [, navigate] = useLocation();

  // Redirect to desktop calendar if not on mobile or tablet
  useEffect(() => {
    if (isDesktop) {
      navigate("/calendar");
    }
  }, [isDesktop, navigate]);

  // Handle date change with enhanced debugging
  const handleDateChange = (date: Date) => {
    // Create a clean date object to avoid reference issues
    const cleanDate = new Date(date.getTime());
    setCurrentDate(cleanDate);
  };

  // Handle view change (will navigate to weekly view)
  const handleViewChange = (newView: "day" | "week" | "month") => {
    if (newView === "week") {
      navigate("/calendar");
    } else {
      setView(newView);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <MobileDailyView
        currentDate={currentDate}
        onDateChange={handleDateChange}
        onViewChange={handleViewChange}
      />
    </div>
  );
}