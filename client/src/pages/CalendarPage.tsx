import { useState, useEffect } from "react";
import CalendarHeader from "@/components/calendar/CalendarHeader";
import WeeklyCalendar from "@/components/calendar/WeeklyCalendar";
import DailyCalendar from "@/components/calendar/DailyCalendar";
import MonthlyCalendar from "@/components/calendar/MonthlyCalendar";
import { useQuery } from "@tanstack/react-query";
import { Studio } from "@shared/schema";

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<"day" | "week" | "month">("week");
  const [selectedStudioIds, setSelectedStudioIds] = useState<number[]>([]);

  // Fetch all studios to initialize filter
  const { data: studios = [] } = useQuery<Studio[]>({
    queryKey: ["/api/studios"],
  });

  // Initialize selected studios on first load
  useEffect(() => {
    if (studios.length > 0 && selectedStudioIds.length === 0) {
      // Select first 5 studios by default
      const initialSelection = studios.slice(0, 5).map(studio => studio.id);
      setSelectedStudioIds(initialSelection);
    }
  }, [studios, selectedStudioIds]);

  // Handle date change with enhanced debugging and force clean date object
  const handleDateChange = (date: Date) => {
    // Create a clean date object to avoid reference issues
    const cleanDate = new Date(date.getTime());
    
    // Add timestamp to force re-renders
    const timestamp = Date.now();
    console.log(`CalendarPage - [Timestamp: ${timestamp}] Date changed from: ${currentDate.toISOString()} to: ${cleanDate.toISOString()}`);
    
    // Force update the state with the clean date
    setCurrentDate(cleanDate);
    
    // Log again after state update attempt
    console.log(`CalendarPage - [Timestamp: ${timestamp}] Date state updated`);
  };

  // Handle view change
  const handleViewChange = (newView: "day" | "week" | "month") => {
    setView(newView);
  };

  // Handle studio filter change
  const handleStudioFilterChange = (studioIds: number[]) => {
    setSelectedStudioIds(studioIds);
  };

  return (
    <div className="flex flex-col h-screen">
      <CalendarHeader
        currentDate={currentDate}
        onDateChange={handleDateChange}
        view={view}
        onViewChange={handleViewChange}
        selectedStudioIds={selectedStudioIds}
        onStudioFilterChange={handleStudioFilterChange}
      />
      
      {view === "day" && (
        <DailyCalendar
          currentDate={currentDate}
          selectedStudioIds={selectedStudioIds}
        />
      )}
      
      {view === "week" && (
        <WeeklyCalendar
          currentDate={currentDate}
          selectedStudioIds={selectedStudioIds}
        />
      )}
      
      {view === "month" && (
        <MonthlyCalendar
          currentDate={currentDate}
        />
      )}
    </div>
  );
}
