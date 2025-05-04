import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { subtractDays, addDays, formatWeekRangeText, subtractWeeks, addWeeks, subtractMonths, addMonths } from "@/lib/dateUtils";
import BookingModal from "@/components/booking/BookingModal";
import { useQuery } from "@tanstack/react-query";
import { Studio, Booking } from "@shared/schema";
import { cn } from "@/lib/utils";
import { calculateStudioStatus, getStudioStatusColor } from "@/lib/studioUtils";

type HeaderProps = {
  currentDate: Date;
  onDateChange: (date: Date) => void;
  view: "day" | "week" | "month";
  onViewChange: (view: "day" | "week" | "month") => void;
  onStudioFilterChange?: (studioIds: number[]) => void;
  selectedStudioIds?: number[];
  title?: string;
};

export function Header({
  currentDate,
  onDateChange,
  view,
  onViewChange,
  onStudioFilterChange,
  selectedStudioIds = [],
  title = "Calendar"
}: HeaderProps) {
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [showAllStudios, setShowAllStudios] = useState(false);

  // Fetch all studios
  const { data: studios = [] } = useQuery<Studio[]>({
    queryKey: ["/api/studios"],
  });

  const studiosToShow = showAllStudios ? studios : studios.slice(0, 5);

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
        weekday: "short", 
        month: "short", 
        day: "numeric",
        year: "numeric"
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

  return (
    <header className="bg-white shadow-sm">
      <div className="flex justify-between items-center px-4 py-3 lg:px-6">
        <div className="flex items-center space-x-2">
          <div className="hidden lg:block">
            <h1 className="text-lg font-semibold text-gray-800">{title}</h1>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          {/* Calendar View Options */}
          <div className="hidden md:flex items-center shadow-sm rounded-md overflow-hidden">
            <button 
              className={cn(
                "px-3 py-1.5 text-sm font-medium border",
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
                "px-3 py-1.5 text-sm font-medium border",
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
                "px-3 py-1.5 text-sm font-medium border",
                view === "month" 
                  ? "bg-primary text-white border-primary" 
                  : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
              )}
              onClick={() => onViewChange("month")}
            >
              Month
            </button>
          </div>
          
          {/* Date Selector */}
          <div className="flex items-center space-x-2">
            <button 
              className="p-1 rounded-full hover:bg-gray-100"
              onClick={navigatePrevious}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
            </button>
            <span className="text-sm font-medium">{getDateDisplayText()}</span>
            <button 
              className="p-1 rounded-full hover:bg-gray-100"
              onClick={navigateNext}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>
            <button 
              className="ml-2 px-3 py-1 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              onClick={goToToday}
            >
              Today
            </button>
          </div>
          
          {/* New Booking Button */}
          <div>
            <Button 
              onClick={() => setIsBookingModalOpen(true)}
              className="inline-flex items-center px-4 py-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              New Booking
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
                    "px-2 py-1 text-xs font-medium bg-white border rounded-md shadow-sm",
                    selectedStudioIds.includes(studio.id)
                      ? "border-primary"
                      : "border-gray-300 hover:bg-gray-50"
                  )}
                  onClick={() => toggleStudioFilter(studio.id)}
                >
                  <span className={cn("h-2 w-2 inline-block rounded-full mr-1", getStudioStatusColor(calculateStudioStatus(studio, bookings, currentDate)))}></span>
                  {studio.name}
                </button>
              ))}
              
              {studios.length > 5 && (
                <button 
                  className="px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 rounded-md"
                  onClick={() => setShowAllStudios(!showAllStudios)}
                >
                  {showAllStudios ? "Show Less" : `+${studios.length - 5} more`}
                </button>
              )}
            </div>
            
            <div className="ml-auto flex items-center space-x-2 text-sm">
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
                <span className="text-xs">Booked</span>
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
    </header>
  );
}
