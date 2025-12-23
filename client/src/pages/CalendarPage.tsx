import { useState, useEffect } from "react";
import CalendarHeader from "@/components/calendar/CalendarHeader";
import WeeklyCalendar from "@/components/calendar/WeeklyCalendar";
import DailyCalendar from "@/components/calendar/DailyCalendar";
import MonthlyCalendar from "@/components/calendar/MonthlyCalendar";
import TimelineCalendar from "@/components/calendar/TimelineCalendar";
import NewBookingFab from "@/components/booking/NewBookingFab";
import { useQuery } from "@tanstack/react-query";
import { Studio } from "@shared/schema";
import { useStudioBookings } from "@/hooks/useStudioBookings";
import { useDevice } from "@/hooks/use-mobile";

function MonthlyCalendarWrapper({ currentDate, studios, selectedStudioIds }: { currentDate: Date, studios: Studio[], selectedStudioIds: number[] }) {
  const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59, 999);
  
  const { bookings, isLoading } = useStudioBookings(monthStart, monthEnd);
  
  return (
    <MonthlyCalendar
      key={currentDate.toISOString()}
      date={currentDate}
      studios={studios}
      bookings={bookings}
      readOnly={false}
      selectedStudioIds={selectedStudioIds}
    />
  );
}

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(() => {
    try {
      const facilityTz = import.meta.env.VITE_FACILITY_TIMEZONE || 'America/Chicago';
      const now = new Date();
      const facilityDate = new Date(now.toLocaleString("en-US", { timeZone: facilityTz }));
      console.log(`CalendarPage - Facility date (${facilityTz}): ${facilityDate.toLocaleDateString()}`);
      console.log(`CalendarPage - Facility ISO: ${facilityDate.toISOString()}`);
      return facilityDate;
    } catch (error) {
      console.error('Error setting initial date', error);
      return new Date();
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
  
  const { data: studios = [] } = useQuery<Studio[]>({
    queryKey: ["/api/studios"],
  });
  
  const [selectedStudioIds, setSelectedStudioIds] = useState<number[]>(() => {
    try {
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

  useEffect(() => {
    if (studios.length > 0 && selectedStudioIds.length === 0) {
      const initialSelection = studios.map(studio => studio.id);
      setSelectedStudioIds(initialSelection);
      localStorage.setItem('selectedStudioIds', JSON.stringify(initialSelection));
    }
  }, [studios, selectedStudioIds]);

  const handleDateChange = (date: Date) => {
    const cleanDate = new Date(date.getTime());
    const timestamp = Date.now();
    console.log(`CalendarPage - [Timestamp: ${timestamp}] Date changed from: ${currentDate.toISOString()} to: ${cleanDate.toISOString()}`);
    setCurrentDate(cleanDate);
    try {
      localStorage.setItem('currentDate', cleanDate.toISOString());
    } catch (error) {
      console.error('Error saving date to localStorage', error);
    }
    console.log(`CalendarPage - [Timestamp: ${timestamp}] Date state updated`);
  };

  const handleViewChange = (newView: "day" | "week" | "month" | "timeline") => {
    setView(newView);
    try {
      localStorage.setItem('calendarView', newView);
    } catch (error) {
      console.error('Error saving view to localStorage', error);
    }
  };

  const handleStudioFilterChange = (studioIds: number[]) => {
    setSelectedStudioIds(studioIds);
    try {
      localStorage.setItem('selectedStudioIds', JSON.stringify(studioIds));
    } catch (error) {
      console.error('Error saving studio selection to localStorage', error);
    }
  };

  const { isSmallScreen } = useDevice();

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-950">
      <CalendarHeader
        key={`header-${currentDate.toISOString()}-${view}`}
        currentDate={currentDate}
        onDateChange={handleDateChange}
        view={view}
        onViewChange={handleViewChange}
        selectedStudioIds={selectedStudioIds}
        onStudioFilterChange={handleStudioFilterChange}
        useMondayWeeks={view === "timeline"}
      />
      
      <div className="flex-1 min-h-0 overflow-hidden">
        {view === "day" && (
          <DailyCalendar
            key={currentDate.toISOString()}
            date={currentDate}
            selectedStudioIds={selectedStudioIds}
          />
        )}
        
        {view === "week" && (
          <WeeklyCalendar
            key={currentDate.toISOString()}
            startDate={currentDate}
            selectedStudioIds={selectedStudioIds}
          />
        )}
        
        {view === "month" && (
          <MonthlyCalendarWrapper
            currentDate={currentDate}
            studios={studios}
            selectedStudioIds={selectedStudioIds}
          />
        )}
        
        {view === "timeline" && (
          <TimelineCalendar
            key={currentDate.toISOString()}
            currentDate={currentDate}
            selectedStudioIds={selectedStudioIds}
          />
        )}
      </div>

      {!isSmallScreen && <NewBookingFab />}
    </div>
  );
}
