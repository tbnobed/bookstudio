import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { subtractDays, addDays, formatWeekRangeText, formatMondayWeekRangeText, subtractWeeks, addWeeks, subtractMonths, addMonths, testTimezoneHandling } from "@/lib/dateUtils";
import { ThemeToggle } from "@/components/theme-toggle";
import WeatherWidget from "@/components/weather/WeatherWidget";
import { useQuery } from "@tanstack/react-query";
import { Studio, Booking, BookingStudio } from "@shared/schema";
import { cn } from "@/lib/utils";
import { calculateStudioStatus } from "@/lib/studioUtils";
import { useAuth } from "@/hooks/use-auth";
import { useSidebar } from "@/contexts/SidebarContext";
import { getFacilityTimezone_Dynamic } from "@/lib/dateUtils";
import { ChevronLeft, ChevronRight, Menu, CalendarDays, LayoutGrid, Calendar as CalendarIcon, Clock, Filter, Check } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import StudioStatusSummary from "./StudioStatusSummary";

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
      {/* Main Header Row — 3-column grid so center never overlaps left/right */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center px-4 py-3 lg:px-6 min-h-[72px] gap-2">

        {/* Left Section */}
        <div className="flex items-center gap-2 min-w-0">
          {/* Sidebar Toggle */}
          <button
            onClick={toggleSidebar}
            className="hidden lg:flex shrink-0 items-center justify-center h-9 w-9 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title={sidebarVisible ? "Hide sidebar" : "Show sidebar"}
            data-testid="button-toggle-sidebar"
          >
            <Menu className="h-5 w-5 text-gray-600 dark:text-gray-400" />
          </button>

          {/* Date Navigation */}
          {!hideNavigation && (
            <div className="flex items-center gap-2 min-w-0">
              <div className="flex items-center bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shrink-0">
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
                      className="px-3 py-1.5 min-w-[120px] lg:min-w-[180px] text-center border-x border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
                      data-testid="button-date-picker"
                    >
                      <CalendarIcon className="h-4 w-4 text-gray-500 dark:text-gray-400 hidden sm:block shrink-0" />
                      <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
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
                className="hidden md:flex shrink-0"
                data-testid="button-today"
              >
                Today
              </Button>
              
              {/* Studio Filter Dropdown */}
              {onStudioFilterChange && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn(
                        "gap-1.5 shrink-0",
                        selectedStudioIds.length > 0 && "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                      )}
                      data-testid="button-studio-filter"
                    >
                      <Filter className="h-4 w-4" />
                      <span className="hidden lg:inline">Studios</span>
                      {selectedStudioIds.length > 0 && (
                        <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-[10px] font-medium text-white">
                          {selectedStudioIds.length}
                        </span>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56 max-h-80 overflow-y-auto">
                    <DropdownMenuLabel>Quick Filters</DropdownMenuLabel>
                    <div className="flex gap-1 px-2 py-1.5">
                      <button
                        className="flex-1 px-2 py-1 text-xs font-medium rounded bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors"
                        onClick={() => {
                          const now = new Date();
                          const availableIds = studios
                            .filter(s => calculateStudioStatus(s, bookings, now, bookingStudioLinks) === "available")
                            .map(s => s.id);
                          onStudioFilterChange(availableIds);
                        }}
                        data-testid="button-filter-available"
                      >
                        Available
                      </button>
                      <button
                        className="flex-1 px-2 py-1 text-xs font-medium rounded bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 hover:bg-rose-200 dark:hover:bg-rose-900/50 transition-colors"
                        onClick={() => {
                          const now = new Date();
                          const inUseIds = studios
                            .filter(s => calculateStudioStatus(s, bookings, now, bookingStudioLinks) === "in-use")
                            .map(s => s.id);
                          onStudioFilterChange(inUseIds);
                        }}
                        data-testid="button-filter-in-use"
                      >
                        In Use
                      </button>
                      <button
                        className="flex-1 px-2 py-1 text-xs font-medium rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors"
                        onClick={() => {
                          const now = new Date();
                          const maintIds = studios
                            .filter(s => calculateStudioStatus(s, bookings, now, bookingStudioLinks) === "maintenance")
                            .map(s => s.id);
                          onStudioFilterChange(maintIds);
                        }}
                        data-testid="button-filter-maintenance"
                      >
                        Maint.
                      </button>
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel>Studios</DropdownMenuLabel>
                    {selectedStudioIds.length > 0 && (
                      <>
                        <button
                          className="w-full px-2 py-1.5 text-sm text-left text-blue-600 hover:bg-gray-100 dark:hover:bg-gray-800"
                          onClick={() => onStudioFilterChange([])}
                          data-testid="button-clear-studio-filter"
                        >
                          Show all studios
                        </button>
                        <DropdownMenuSeparator />
                      </>
                    )}
                    {studios.map((studio) => (
                      <DropdownMenuCheckboxItem
                        key={studio.id}
                        checked={selectedStudioIds.includes(studio.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            onStudioFilterChange([...selectedStudioIds, studio.id]);
                          } else {
                            onStudioFilterChange(selectedStudioIds.filter(id => id !== studio.id));
                          }
                        }}
                        onSelect={(e) => e.preventDefault()}
                        data-testid={`checkbox-studio-${studio.id}`}
                      >
                        {studio.name}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          )}
        </div>

        {/* Center Section — naturally centered by grid, never overlaps left/right */}
        <div className="hidden lg:flex flex-col items-center justify-center gap-3">
          <StudioStatusSummary
            studios={studios}
            bookings={bookings}
            bookingStudioLinks={bookingStudioLinks}
            currentDate={currentDate}
            onFilterByStatus={onStudioFilterChange}
          />
          <div className="hidden xl:block">
            <WeatherWidget size="compact" />
          </div>
        </div>

        {/* Right Section */}
        <div className="flex items-center justify-end gap-2 lg:gap-3">
          
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
    </header>
  );
}
