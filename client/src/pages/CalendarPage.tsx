import { useState, useEffect } from "react";
import CalendarHeader from "@/components/calendar/CalendarHeader";
import WeeklyCalendar from "@/components/calendar/WeeklyCalendar";
import DailyCalendar from "@/components/calendar/DailyCalendar";
import MonthlyCalendar from "@/components/calendar/MonthlyCalendar";
import TimelineCalendar from "@/components/calendar/TimelineCalendar";
import WeatherWidget from "@/components/weather/WeatherWidget";
import { useQuery } from "@tanstack/react-query";
import { Studio } from "@shared/schema";
import { useStudioBookings } from "@/hooks/useStudioBookings";

// Separate component to properly handle hooks for the monthly calendar
function MonthlyCalendarWrapper({ currentDate, studios, selectedStudioIds }: { currentDate: Date, studios: Studio[], selectedStudioIds: number[] }) {
  // Calculate month start and end dates for data fetching
  const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59, 999);
  
  // Fetch bookings for the entire month
  const { bookings, isLoading } = useStudioBookings(monthStart, monthEnd);
  
  return (
    <MonthlyCalendar
      key={currentDate.toISOString()} // Add key to force complete re-render on date change
      date={currentDate}
      studios={studios}
      bookings={bookings}
      readOnly={false}
      selectedStudioIds={selectedStudioIds}
    />
  );
}

export default function CalendarPage() {
  // Persist current date and view in localStorage
  const [currentDate, setCurrentDate] = useState(() => {
    try {
      // Use facility timezone for current date as instructed
      const facilityTz = import.meta.env.VITE_FACILITY_TIMEZONE || 'America/Chicago';
      const now = new Date();
      
      // Get current date in facility timezone
      const facilityDate = new Date(now.toLocaleString("en-US", { timeZone: facilityTz }));
      console.log(`CalendarPage - Facility date (${facilityTz}): ${facilityDate.toLocaleDateString()}`);
      console.log(`CalendarPage - Facility ISO: ${facilityDate.toISOString()}`);
      
      return facilityDate;
    } catch (error) {
      console.error('Error setting initial date', error);
      return new Date(); // Fallback to today
    }
  });
  
  const [view, setView] = useState<"day" | "week" | "month" | "timeline">(() => {
    try {
      const savedView = localStorage.getItem('calendarView') as "day" | "week" | "month" | "timeline";
      return savedView && ['day', 'week', 'month', 'timeline'].includes(savedView) ? savedView : "week";
    } catch (error) {
      console.error('Error loading view from localStorage', error);
      return "week";
    }
  });
  // Fetch all studios to initialize filter
  const { data: studios = [] } = useQuery<Studio[]>({
    queryKey: ["/api/studios"],
  });
  
  // Use localStorage to persist selected studios across page refreshes
  const [selectedStudioIds, setSelectedStudioIds] = useState<number[]>(() => {
    try {
      // Try to get saved studios from localStorage
      const savedStudios = localStorage.getItem('selectedStudioIds');
      if (savedStudios) {
        return JSON.parse(savedStudios);
      }
      return [];
    } catch (error) {
      console.error('Error loading studio selection from localStorage', error);
      return [];
    }
  });

  // Initialize selected studios on first load
  useEffect(() => {
    if (studios.length > 0 && selectedStudioIds.length === 0) {
      // Select all studios by default (up to 20)
      const initialSelection = studios.map(studio => studio.id);
      setSelectedStudioIds(initialSelection);
      
      // Save to localStorage
      localStorage.setItem('selectedStudioIds', JSON.stringify(initialSelection));
    }
  }, [studios, selectedStudioIds]);

  // Handle date change with enhanced debugging and force clean date object
  const handleDateChange = (date: Date) => {
    // Create a clean date object to avoid reference issues
    const cleanDate = new Date(date.getTime());
    
    // Add timestamp for debugging
    const timestamp = Date.now();
    console.log(`CalendarPage - [Timestamp: ${timestamp}] Date changed from: ${currentDate.toISOString()} to: ${cleanDate.toISOString()}`);
    
    // Force update the state with the clean date
    setCurrentDate(cleanDate);
    
    // Save to localStorage
    try {
      localStorage.setItem('currentDate', cleanDate.toISOString());
    } catch (error) {
      console.error('Error saving date to localStorage', error);
    }
    
    console.log(`CalendarPage - [Timestamp: ${timestamp}] Date state updated`);
  };

  // Handle view change with localStorage persistence
  const handleViewChange = (newView: "day" | "week" | "month" | "timeline") => {
    setView(newView);
    
    // Save to localStorage
    try {
      localStorage.setItem('calendarView', newView);
    } catch (error) {
      console.error('Error saving view to localStorage', error);
    }
  };

  // Handle studio filter change with localStorage persistence
  const handleStudioFilterChange = (studioIds: number[]) => {
    setSelectedStudioIds(studioIds);
    
    // Save changes to localStorage for persistence across refreshes
    try {
      localStorage.setItem('selectedStudioIds', JSON.stringify(studioIds));
    } catch (error) {
      console.error('Error saving studio selection to localStorage', error);
    }
  };

  return (
    <div className="flex flex-col h-screen">
      <CalendarHeader
        key={`header-${currentDate.toISOString()}-${view}`} // Add key to force re-render when date or view changes
        currentDate={currentDate}
        onDateChange={handleDateChange}
        view={view}
        onViewChange={handleViewChange}
        selectedStudioIds={selectedStudioIds}
        onStudioFilterChange={handleStudioFilterChange}
        useMondayWeeks={view === "timeline"} // Use Monday weeks for timeline view
      />
      
      {view === "day" && (
        <div className="flex-1 min-h-0">
          <DailyCalendar
            key={currentDate.toISOString()} // Add key to force complete re-render on date change
            date={currentDate}
            selectedStudioIds={selectedStudioIds}
          />
        </div>
      )}
      
      {view === "week" && (
        <div className="flex-1 min-h-0">
          <WeeklyCalendar
            key={currentDate.toISOString()} // Add key to force complete re-render on date change
            startDate={currentDate}
            selectedStudioIds={selectedStudioIds}
          />
        </div>
      )}
      
      {/* For monthly view, use the wrapper component */}
      {view === "month" && (
        <div className="flex-1 min-h-0">
          <MonthlyCalendarWrapper
            currentDate={currentDate}
            studios={studios}
            selectedStudioIds={selectedStudioIds}
          />
        </div>
      )}
      
      {view === "timeline" && (
        <div className="flex-1 min-h-0">
          <TimelineCalendar
            key={currentDate.toISOString()} // Add key to force complete re-render on date change
            currentDate={currentDate}
            selectedStudioIds={selectedStudioIds}
          />
        </div>
      )}
    </div>
  );
}
