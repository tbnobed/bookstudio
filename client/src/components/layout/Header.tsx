import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { subtractDays, addDays, formatWeekRangeText, subtractWeeks, addWeeks, subtractMonths, addMonths, testTimezoneHandling } from "@/lib/dateUtils";
import BookingModal from "@/components/booking/BookingModal";
import TimezoneTestModal from "@/components/TimezoneTestModal";

import WeatherWidget from "@/components/weather/WeatherWidget";
import { useQuery } from "@tanstack/react-query";
import { Studio, Booking, BookingStudio } from "@shared/schema";
import { cn } from "@/lib/utils";
import { calculateStudioStatus, getStudioStatusColor } from "@/lib/studioUtils";
import { useAuth } from "@/hooks/use-auth";
import { useSidebar } from "@/contexts/SidebarContext";
import { FACILITY_TIMEZONE } from "@/lib/dateUtils";

type HeaderProps = {
  currentDate: Date;
  onDateChange: (date: Date) => void;
  view: "day" | "week" | "month";
  onViewChange: (view: "day" | "week" | "month") => void;
  onStudioFilterChange?: (studioIds: number[]) => void;
  selectedStudioIds?: number[];
  title?: string;
  showViewToggle?: boolean;
};

export function Header({
  currentDate,
  onDateChange,
  view,
  onViewChange,
  onStudioFilterChange,
  selectedStudioIds = [],
  title = "Calendar",
  showViewToggle = true
}: HeaderProps) {
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [showAllStudios, setShowAllStudios] = useState(false);
  const [isTimezoneModalOpen, setIsTimezoneModalOpen] = useState(false);
  const { sidebarVisible, toggleSidebar } = useSidebar();
  
  // Display a message about the timezone testing feature when the component mounts
  useEffect(() => {
    console.log(
      "%c📆 BookStud.io Timezone Testing %c\n" +
      "To verify that times and dates are displayed correctly in the facility timezone, " +
      "you can run a test by executing this command in the browser console:\n\n" +
      "%ctestTimezoneHandling()%c\n\n" +
      "This will show how times are consistently displayed in the America/Chicago (Dallas) timezone " +
      "regardless of your local timezone.",
      "background: #4338ca; color: white; font-weight: bold; padding: 4px 8px; border-radius: 4px;",
      "color: #333; font-size: 14px;",
      "background: #f3f4f6; color: #4338ca; padding: 2px 4px; border-radius: 2px; font-family: monospace;",
      "color: #333; font-size: 14px;"
    );
  }, []);

  // Fetch all studios
  const { data: studios = [] } = useQuery<Studio[]>({
    queryKey: ["/api/studios"],
  });

  // Show all studios by default if we have 20 or fewer
  // Only use pagination when we have more than 20 studios
  const studiosToShow = showAllStudios || studios.length <= 20 ? studios : studios.slice(0, 20);

  // Navigate to today
  const goToToday = () => {
    onDateChange(new Date());
  };

  // Navigate based on view - using clean date objects
  const navigatePrevious = () => {
    // Create a clean copy of the date to ensure we're working with a fresh object
    const dateToUse = new Date(currentDate.getTime());
    let newDate: Date;
    
    if (view === "day") {
      newDate = subtractDays(dateToUse, 1);
    } else if (view === "week") {
      newDate = subtractWeeks(dateToUse, 1);
    } else if (view === "month") {
      newDate = subtractMonths(dateToUse, 1);
    } else {
      return; // Shouldn't happen
    }
    
    // Generate timestamp for unique logging
    const timestamp = Date.now();
    console.log(`Header - [Timestamp: ${timestamp}] Navigate Previous - From: ${dateToUse.toISOString()}, To: ${newDate.toISOString()}, View: ${view}`);
    
    // Make sure we're passing a clean date object
    onDateChange(new Date(newDate.getTime()));
  };

  const navigateNext = () => {
    // Create a clean copy of the date to ensure we're working with a fresh object
    const dateToUse = new Date(currentDate.getTime());
    let newDate: Date;
    
    if (view === "day") {
      newDate = addDays(dateToUse, 1);
    } else if (view === "week") {
      newDate = addWeeks(dateToUse, 1);
    } else if (view === "month") {
      newDate = addMonths(dateToUse, 1);
    } else {
      return; // Shouldn't happen
    }
    
    // Generate timestamp for unique logging
    const timestamp = Date.now();
    console.log(`Header - [Timestamp: ${timestamp}] Navigate Next - From: ${dateToUse.toISOString()}, To: ${newDate.toISOString()}, View: ${view}`);
    
    // Make sure we're passing a clean date object
    onDateChange(new Date(newDate.getTime()));
  };

  // Calculate date display text directly instead of using state
  // This ensures the text is always in sync with the currentDate prop
  const getDateDisplayText = () => {
    console.log(`Header - Calculating display text for date: ${currentDate.toISOString()}, view: ${view}`);
    
    if (view === "day") {
      return currentDate.toLocaleDateString("en-US", { 
        weekday: "long", 
        month: "long", 
        day: "numeric",
        year: "numeric",
        timeZone: "America/Chicago"
      });
    } else if (view === "week") {
      // Generate fresh week text directly from current date
      const weekText = formatWeekRangeText(currentDate);
      console.log(`Header - Generated week text: ${weekText} for date ${currentDate.toISOString()}`);
      return weekText;
    } else {
      return currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    }
  };

  // Handle studio filter change
  const toggleStudioFilter = (studioId: number) => {
    if (!onStudioFilterChange) return;
    
    const isSelected = selectedStudioIds.includes(studioId);
    const newSelectedIds = isSelected
      ? selectedStudioIds.filter(id => id !== studioId)
      : [...selectedStudioIds, studioId];
    
    onStudioFilterChange(newSelectedIds);
  };

  // Fetch ALL bookings for status calculation (no date filters)
  const { data: bookings = [] } = useQuery<Booking[]>({
    queryKey: ["/api/bookings"],
    // Only used for status calculation, so no need to refetch often
    refetchInterval: 60000, 
    // Don't add any query params so we get all bookings across all date ranges
  });
  
  // Fetch booking-studio links for multi-studio booking support
  const { data: bookingStudioLinks = [] } = useQuery<BookingStudio[]>({
    queryKey: ["/api/booking-studios"],
    refetchInterval: 60000,
  });

  return (
    <header className="bg-white shadow-sm">
      <div className="flex justify-between items-center px-4 py-3 lg:px-6">
        <div className="flex items-center space-x-4">
          {/* Sidebar Toggle Button */}
          <button
            onClick={toggleSidebar}
            className="p-2 hover:bg-gray-100 rounded-md transition-colors"
            title={sidebarVisible ? "Hide sidebar" : "Show sidebar"}
          >
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className="h-5 w-5 text-gray-600" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor" 
              strokeWidth="2"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Date Selector */}
          <div className="flex items-center bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
            <button 
              className="p-2 hover:bg-gray-50 transition-colors border-r border-gray-200"
              onClick={navigatePrevious}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
            </button>
            <div className="px-3 py-2 min-w-[140px] lg:min-w-[180px] text-center">
              <span className="text-xs lg:text-sm font-medium text-gray-800">{getDateDisplayText()}</span>
            </div>
            <button 
              className="p-2 hover:bg-gray-50 transition-colors border-l border-gray-200"
              onClick={navigateNext}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>
            <button 
              className="ml-0 px-2 lg:px-3 py-2 text-xs lg:text-sm bg-gray-50 text-gray-700 border-l border-gray-200 hover:bg-gray-100 transition-colors font-medium"
              onClick={goToToday}
            >
              Today
            </button>
          </div>

          <div className="hidden lg:flex items-center">
            <h1 className="text-lg font-semibold text-gray-800">{title}</h1>
          </div>
        </div>
        
        <div className="flex items-center space-x-2 lg:space-x-4">
          {/* Weather Widget */}
          <div className="hidden xl:block">
            <WeatherWidget size="compact" />
          </div>
          
          {/* Calendar View Options - Only show on calendar pages */}
          {showViewToggle && (
            <div className="hidden lg:flex items-center shadow-sm rounded-md overflow-hidden">
              <button 
                className={cn(
                  "px-2 py-1.5 text-xs font-medium border",
                  view === "day" 
                    ? "bg-primary text-white border-primary" 
                    : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                )}
                onClick={() => onViewChange("day")}
              >
                Day
              </button>
              <button 
                className={cn(
                  "px-2 py-1.5 text-xs font-medium border",
                  view === "week" 
                    ? "bg-primary text-white border-primary" 
                    : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                )}
                onClick={() => onViewChange("week")}
              >
                Week
              </button>
              <button 
                className={cn(
                  "px-2 py-1.5 text-xs font-medium border",
                  view === "month" 
                    ? "bg-primary text-white border-primary" 
                    : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
                )}
                onClick={() => onViewChange("month")}
              >
                Month
              </button>
            </div>
          )}
          
          {/* New Booking Button */}
          <div className="flex-shrink-0">
            <Button 
              onClick={() => setIsBookingModalOpen(true)}
              className="inline-flex items-center px-3 lg:px-4 py-2"
              size="sm"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 lg:mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              <span className="hidden lg:inline">New Booking</span>
            </Button>
          </div>
        </div>
      </div>
      

      
      {/* Studios Filter */}
      {onStudioFilterChange && (
        <div className="px-4 py-2 bg-gray-50 border-y lg:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Studios:</span>
            <div className="flex flex-wrap gap-1">
              {studiosToShow.map((studio) => (
                <button
                  key={studio.id}
                  className={cn(
                    "px-3 py-1.5 text-sm font-medium bg-white border rounded-md shadow-sm whitespace-nowrap",
                    selectedStudioIds.includes(studio.id)
                      ? "border-primary"
                      : "border-gray-300 hover:bg-gray-50"
                  )}
                  onClick={() => toggleStudioFilter(studio.id)}
                >
                  <span className={cn("w-2 h-2 inline-block rounded-full mr-2 flex-shrink-0", getStudioStatusColor(calculateStudioStatus(studio, bookings, currentDate, bookingStudioLinks)))}></span>
                  {studio.name}
                </button>
              ))}
              
              {studios.length > 20 && (
                <button 
                  className="px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 rounded-md"
                  onClick={() => setShowAllStudios(!showAllStudios)}
                >
                  {showAllStudios ? "Show Less" : `+${studios.length - 20} more`}
                </button>
              )}
            </div>
            
            <div className="ml-auto flex items-center space-x-2 text-sm">
              {/* Timezone Test Button - Only for Admin */}
              {useAuth().user?.role === "admin" && (
                <div className="hidden md:flex items-center">
                  <button 
                    onClick={() => setIsTimezoneModalOpen(true)}
                    className="px-2 py-1 text-xs font-medium text-blue-700 border border-blue-200 bg-blue-50 rounded-md hover:bg-blue-100"
                    title="Run a test to verify timezone handling is working correctly"
                  >
                    <span className="flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <polyline points="12 6 12 12 16 14"></polyline>
                      </svg>
                      Test Timezone
                    </span>
                  </button>
                </div>
              )}
              <div className="flex items-center">
                <span className="h-3 w-3 rounded-full bg-green-500 mr-1"></span>
                <span className="text-xs">Available</span>
              </div>
              <div className="flex items-center">
                <span className="h-3 w-3 rounded-full bg-orange-500 mr-1"></span>
                <span className="text-xs">Maintenance</span>
              </div>
              <div className="flex items-center">
                <span className="h-3 w-3 rounded-full bg-red-500 mr-1"></span>
                <span className="text-xs">In-Use</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Booking Modal */}
      <BookingModal 
        isOpen={isBookingModalOpen} 
        onClose={() => setIsBookingModalOpen(false)}
        selectedDate={currentDate}
      />

      {/* Timezone Test Modal */}
      <TimezoneTestModal
        isOpen={isTimezoneModalOpen}
        onClose={() => setIsTimezoneModalOpen(false)}
      />
    </header>
  );
}
