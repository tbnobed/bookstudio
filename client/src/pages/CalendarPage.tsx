import { useState, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import WeeklyCalendar from "@/components/calendar/WeeklyCalendar";
import DailyCalendar from "@/components/calendar/DailyCalendar";
import MonthlyCalendar from "@/components/calendar/MonthlyCalendar";
import TimelineCalendar from "@/components/calendar/TimelineCalendar";
import WeatherWidget from "@/components/weather/WeatherWidget";
import { useQuery } from "@tanstack/react-query";
import { Studio } from "@shared/schema";
import { useStudioBookings } from "@/hooks/useStudioBookings";
import { useLocation } from "wouter";

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
  const [location] = useLocation();
  
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
      // First check for URL parameter
      const urlParams = new URLSearchParams(window.location.search);
      const urlView = urlParams.get('view') as "day" | "week" | "month" | "timeline" | null;
      
      if (urlView && ['day', 'week', 'month', 'timeline'].includes(urlView)) {
        console.log(`CalendarPage - Using view from URL: ${urlView}`);
        return urlView;
      }
      
      // Fall back to localStorage
      const savedView = localStorage.getItem('calendarView') as "day" | "week" | "month" | "timeline";
      const finalView = savedView && ['day', 'week', 'month', 'timeline'].includes(savedView) ? savedView : "week";
      console.log(`CalendarPage - Using view from localStorage: ${finalView}`);
      return finalView;
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

  // Handle URL parameter changes for view
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const urlView = urlParams.get('view') as "day" | "week" | "month" | "timeline" | null;
    
    if (urlView && ['day', 'week', 'month', 'timeline'].includes(urlView) && urlView !== view) {
      console.log(`CalendarPage - URL view parameter changed to: ${urlView}`);
      setView(urlView);
      
      // Also save to localStorage for consistency
      try {
        localStorage.setItem('calendarView', urlView);
      } catch (error) {
        console.error('Error saving view to localStorage', error);
      }
    }
  }, [location, view]); // React to location changes

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
      <Header
        key={`header-${currentDate.toISOString()}-${view}`} // Add key to force re-render when date or view changes
        currentDate={currentDate}
        onDateChange={handleDateChange}
        view={view}
        onViewChange={handleViewChange}
        selectedStudioIds={selectedStudioIds}
        onStudioFilterChange={handleStudioFilterChange}
        title="Calendar"
        showViewToggle={true}
        useMondayWeeks={view === "timeline"} // Use Monday weeks for timeline view
      />
      
      {view === "day" && (
        <DailyCalendar
          key={currentDate.toISOString()} // Add key to force complete re-render on date change
          date={currentDate}
          selectedStudioIds={selectedStudioIds}
        />
      )}
      
      {view === "week" && (
        <WeeklyCalendar
          key={currentDate.toISOString()} // Add key to force complete re-render on date change
          startDate={currentDate}
          selectedStudioIds={selectedStudioIds}
        />
      )}
      
      {/* For monthly view, use the wrapper component */}
      {view === "month" && (
        <MonthlyCalendarWrapper
          currentDate={currentDate}
          studios={studios}
          selectedStudioIds={selectedStudioIds}
        />
      )}
      
      {view === "timeline" && (
        <TimelineCalendar
          key={currentDate.toISOString()} // Add key to force complete re-render on date change
          currentDate={currentDate}
          selectedStudioIds={selectedStudioIds}
        />
      )}
    </div>
  );
}
