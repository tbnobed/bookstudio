import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { subtractDays, addDays, formatWeekRangeText, formatMondayWeekRangeText, subtractWeeks, addWeeks, subtractMonths, addMonths, testTimezoneHandling } from "@/lib/dateUtils";
import { ThemeToggle } from "@/components/theme-toggle";
import WeatherWidget from "@/components/weather/WeatherWidget";
import { useQuery } from "@tanstack/react-query";
import { Studio, Booking, BookingStudio } from "@shared/schema";
import { cn } from "@/lib/utils";
import { calculateStudioStatus, getStudioStatusColor } from "@/lib/studioUtils";
import { useAuth } from "@/hooks/use-auth";
import { useSidebar } from "@/contexts/SidebarContext";
import { getFacilityTimezone_Dynamic } from "@/lib/dateUtils";
import { ChevronLeft, ChevronRight, Menu, CalendarDays, LayoutGrid, Calendar as CalendarIcon, Clock } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type HeaderProps = {
  currentDate: Date;
  onDateChange: (date: Date) => void;
  view: "day" | "week" | "month" | "timeline";
  onViewChange: (view: "day" | "week" | "month" | "timeline") => void;
  onStudioFilterChange?: (studioIds: number[]) => void;
  selectedStudioIds?: number[];
  title?: string;
  showViewToggle?: boolean;
  useMondayWeeks?: boolean;
  hideNavigation?: boolean;
};

export function Header({
  currentDate,
  onDateChange,
  view,
  onViewChange,
  onStudioFilterChange,
  selectedStudioIds = [],
  title = "Calendar",
  showViewToggle = true,
  useMondayWeeks = false,
  hideNavigation = false
}: HeaderProps) {
  const [showAllStudios, setShowAllStudios] = useState(false);

  const { sidebarVisible, toggleSidebar } = useSidebar();
  
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

  const { data: studios = [] } = useQuery<Studio[]>({
    queryKey: ["/api/studios"],
  });

  const studiosToShow = showAllStudios || studios.length <= 20 ? studios : studios.slice(0, 20);

  const goToToday = () => {
    const facilityTz = getFacilityTimezone_Dynamic();
    const now = new Date();
    const facilityToday = new Date(now.toLocaleString("en-US", { timeZone: facilityTz }));
    onDateChange(facilityToday);
  };

  const navigatePrevious = () => {
    const dateToUse = new Date(currentDate.getTime());
    let newDate: Date;
    
    if (view === "day") {
      newDate = subtractDays(dateToUse, 1);
    } else if (view === "week") {
      newDate = subtractWeeks(dateToUse, 1);
    } else if (view === "timeline") {
      newDate = subtractWeeks(dateToUse, 1);
    } else if (view === "month") {
      newDate = subtractMonths(dateToUse, 1);
    } else {
      return;
    }
    
    const timestamp = Date.now();
    console.log(`Header - [Timestamp: ${timestamp}] Navigate Previous - From: ${dateToUse.toISOString()}, To: ${newDate.toISOString()}, View: ${view}`);
    onDateChange(new Date(newDate.getTime()));
  };

  const navigateNext = () => {
    const dateToUse = new Date(currentDate.getTime());
    let newDate: Date;
    
    if (view === "day") {
      newDate = addDays(dateToUse, 1);
    } else if (view === "week") {
      newDate = addWeeks(dateToUse, 1);
    } else if (view === "timeline") {
      newDate = addWeeks(dateToUse, 1);
    } else if (view === "month") {
      newDate = addMonths(dateToUse, 1);
    } else {
      return;
    }
    
    const timestamp = Date.now();
    console.log(`Header - [Timestamp: ${timestamp}] Navigate Next - From: ${dateToUse.toISOString()}, To: ${newDate.toISOString()}, View: ${view}`);
    onDateChange(new Date(newDate.getTime()));
  };

  const getDateDisplayText = () => {
    console.log(`Header - Calculating display text for date: ${currentDate.toISOString()}, view: ${view}`);
    
    if (view === "day") {
      return currentDate.toLocaleDateString("en-US", { 
        weekday: "long", 
        month: "long", 
        day: "numeric",
        year: "numeric",
        timeZone: getFacilityTimezone_Dynamic()
      });
    } else if (view === "week") {
      const weekText = useMondayWeeks ? formatMondayWeekRangeText(currentDate) : formatWeekRangeText(currentDate);
      console.log(`Header - Generated ${useMondayWeeks ? 'Monday-based' : 'Sunday-based'} week text: ${weekText} for date ${currentDate.toISOString()}`);
      return weekText;
    } else if (view === "timeline") {
      const weekText = formatMondayWeekRangeText(currentDate);
      console.log(`Header - Generated Monday-based week text for timeline: ${weekText} for date ${currentDate.toISOString()}`);
      return weekText;
    } else {
      return currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: getFacilityTimezone_Dynamic() });
    }
  };

  const toggleStudioFilter = (studioId: number) => {
    if (!onStudioFilterChange) return;
    
    const isSelected = selectedStudioIds.includes(studioId);
    const newSelectedIds = isSelected
      ? selectedStudioIds.filter(id => id !== studioId)
      : [...selectedStudioIds, studioId];
    
    onStudioFilterChange(newSelectedIds);
  };

  const { data: bookings = [] } = useQuery<Booking[]>({
    queryKey: ["/api/bookings"],
    refetchInterval: 60000, 
  });
  
  const { data: bookingStudioLinks = [] } = useQuery<BookingStudio[]>({
    queryKey: ["/api/booking-studios"],
    refetchInterval: 60000,
  });

  const [calendarOpen, setCalendarOpen] = useState(false);

  const viewOptions = [
    { key: "day", label: "Day", icon: CalendarDays },
    { key: "week", label: "Week", icon: CalendarIcon },
    { key: "timeline", label: "Timeline", icon: Clock },
    { key: "month", label: "Month", icon: LayoutGrid },
  ] as const;

  return (
    <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
      {/* Main Header Row */}
      <div className="flex items-center justify-between px-4 py-3 lg:px-6">
        {/* Left Section */}
        <div className="flex items-center gap-3">
          {/* Sidebar Toggle */}
          <button
            onClick={toggleSidebar}
            className="hidden lg:flex items-center justify-center h-9 w-9 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title={sidebarVisible ? "Hide sidebar" : "Show sidebar"}
            data-testid="button-toggle-sidebar"
          >
            <Menu className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          </button>

          {/* Date Navigation */}
          {!hideNavigation && (
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                <button 
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-l-lg transition-colors"
                  onClick={navigatePrevious}
                  data-testid="button-previous-date"
                >
                  <ChevronLeft className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                </button>
                
                {/* Mini Calendar Popover */}
                <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                  <PopoverTrigger asChild>
                    <button 
                      className="px-3 py-1.5 min-w-[150px] lg:min-w-[200px] text-center border-x border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
                      data-testid="button-date-picker"
                    >
                      <CalendarIcon className="h-4 w-4 text-gray-500 dark:text-gray-400 hidden sm:block" />
                      <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                        {getDateDisplayText()}
                      </span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={currentDate}
                      onSelect={(date) => {
                        if (date) {
                          onDateChange(date);
                          setCalendarOpen(false);
                        }
                      }}
                      defaultMonth={currentDate}
                      weekStartsOn={useMondayWeeks ? 1 : 0}
                      className="rounded-lg"
                    />
                    <div className="p-2 border-t border-gray-200 dark:border-gray-700">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full"
                        onClick={() => {
                          goToToday();
                          setCalendarOpen(false);
                        }}
                        data-testid="button-calendar-today"
                      >
                        Go to Today
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
                
                <button 
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-r-lg transition-colors"
                  onClick={navigateNext}
                  data-testid="button-next-date"
                >
                  <ChevronRight className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                </button>
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={goToToday}
                className="hidden sm:flex"
                data-testid="button-today"
              >
                Today
              </Button>
            </div>
          )}
        </div>
        
        {/* Right Section */}
        <div className="flex items-center gap-2 lg:gap-3">
          {/* Weather Widget */}
          <div className="hidden xl:block">
            <WeatherWidget size="compact" />
          </div>
          
          {/* View Toggle */}
          {showViewToggle && (
            <div className="hidden lg:flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
              {viewOptions.map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.key}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-all",
                      view === option.key
                        ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                        : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                    )}
                    onClick={() => onViewChange(option.key)}
                    data-testid={`button-view-${option.key}`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="hidden xl:inline">{option.label}</span>
                  </button>
                );
              })}
            </div>
          )}
          
          {/* Theme Toggle */}
          <ThemeToggle />
        </div>
      </div>
      
      {/* Studios Filter Bar */}
      {onStudioFilterChange && (
        <div className="px-4 py-2.5 bg-gray-50/80 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-800 lg:px-6">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Studios:
            </span>
            
            <div className="flex flex-wrap gap-1.5">
              {studiosToShow.map((studio) => {
                const status = calculateStudioStatus(studio, bookings, currentDate, bookingStudioLinks);
                const isSelected = selectedStudioIds.includes(studio.id);
                
                return (
                  <button
                    key={studio.id}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-all",
                      isSelected
                        ? "bg-white dark:bg-gray-700 border-2 border-primary shadow-sm text-gray-900 dark:text-white"
                        : "bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-500"
                    )}
                    onClick={() => toggleStudioFilter(studio.id)}
                    data-testid={`button-studio-filter-${studio.id}`}
                  >
                    <span className={cn(
                      "w-2 h-2 rounded-full flex-shrink-0",
                      getStudioStatusColor(status)
                    )} />
                    {studio.name}
                  </button>
                );
              })}
              
              {studios.length > 20 && (
                <button 
                  className="px-2 py-1.5 text-sm font-medium text-primary hover:bg-primary/10 rounded-lg transition-colors"
                  onClick={() => setShowAllStudios(!showAllStudios)}
                  data-testid="button-show-more-studios"
                >
                  {showAllStudios ? "Show Less" : `+${studios.length - 20} more`}
                </button>
              )}
            </div>
            
            {/* Status Legend */}
            <div className="ml-auto hidden md:flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                <span className="text-gray-600 dark:text-gray-400">Available</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                <span className="text-gray-600 dark:text-gray-400">Maintenance</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                <span className="text-gray-600 dark:text-gray-400">In-Use</span>
              </div>
            </div>
          </div>
        </div>
      )}

    </header>
  );
}
