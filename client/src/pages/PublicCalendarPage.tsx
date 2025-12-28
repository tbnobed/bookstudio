import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { addDays, startOfWeek, endOfWeek, format, addWeeks, subWeeks, isWithinInterval } from 'date-fns';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import WeeklyCalendar from '@/components/calendar/WeeklyCalendar';
import DailyCalendar from '@/components/calendar/DailyCalendar';
import MonthlyCalendar from '@/components/calendar/MonthlyCalendar';
import { Studio, Booking } from '@shared/schema';
import { apiRequest } from '@/lib/queryClient';
import { cn } from '@/lib/utils';
// Import logo directly from public directory which is included in Docker build
const logoPath = '/bookstuio.png';
import { calculateStudioStatus, getStudioStatusColor } from '@/lib/studioUtils';
import { usePublicBookingStudioLinks } from '@/hooks/useBookingStudioLinks';
import StudioStatusSummary from '@/components/layout/StudioStatusSummary';
import { useDevice } from '@/hooks/use-mobile';
import { useLocation } from 'wouter';
// Import isSameDay directly from our dateUtils to use for timezone-aware comparison
import { isSameDay, formatInFacilityTimezone, getFacilityTimezone_Dynamic } from '@/lib/dateUtils';

// Define our own DateRange type since it's not exported from date-fns
interface DateRange {
  start: Date;
  end: Date;
}

export interface ApiBooking {
  id: number;
  title: string;
  description: string | null;
  studioId: number | null;
  start: Date;
  end: Date;
  type: string;
  severity: string | null;
}

function PublicCalendarPage() {
  // Check if the user is on a mobile device and redirect if needed
  const { isSmallScreen } = useDevice();
  const [, navigate] = useLocation();
  
  // If we're on the default public calendar page and using a mobile device,
  // redirect to the mobile-specific public calendar page
  useEffect(() => {
    // Log device detection for debugging
    console.log("PublicCalendarPage: Device detection", { 
      isSmallScreen, 
      windowWidth: window.innerWidth,
      userAgent: navigator.userAgent
    });
    
    // Use immediate (non-conditional) redirection with a timeout to ensure it happens after rendering
    if (isSmallScreen) {
      console.log("PublicCalendarPage: Redirecting to mobile view");
      // Use setTimeout to ensure redirection happens after component mounts
      const redirectTimer = setTimeout(() => {
        window.location.href = '/public-calendar/mobile';
      }, 100);
      
      return () => clearTimeout(redirectTimer);
    }
  }, [isSmallScreen]);
  
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [viewType, setViewType] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [dateRange, setDateRange] = useState<DateRange>(getDatesForWeek(currentDate));
  const [selectedStudioIds, setSelectedStudioIds] = useState<number[]>([]);

  function getDatesForWeek(date: Date): DateRange {
    const startDate = startOfWeek(date, { weekStartsOn: 0 });
    return {
      start: startDate,
      end: endOfWeek(date, { weekStartsOn: 0 })
    };
  }

  // Update date range when current date or view type changes
  useEffect(() => {
    switch (viewType) {
      case 'daily':
        setDateRange({
          start: currentDate,
          end: addDays(currentDate, 1)
        });
        break;
      case 'weekly':
        setDateRange(getDatesForWeek(currentDate));
        break;
      case 'monthly':
        // For monthly view, we'll get the entire month
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        
        // Extend a bit to always include full weeks
        const startDate = startOfWeek(firstDay, { weekStartsOn: 0 });
        const endDate = endOfWeek(lastDay, { weekStartsOn: 0 });
        
        setDateRange({
          start: startDate,
          end: endDate
        });
        break;
    }
  }, [currentDate, viewType]);

  // Fetch studios
  const { data: studios = [] } = useQuery<Studio[]>({
    queryKey: ['/api/studios'],
    staleTime: 5 * 60 * 1000,
  });
  
  // Fetch ALL bookings for status calculation (no date filter)
  const { data: allBookings = [] } = useQuery<ApiBooking[]>({
    queryKey: ['/api/public/bookings', 'all'],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/public/bookings`);
      const data = await res.json();
      
      // Convert string dates to Date objects
      return data.map((booking: any) => ({
        ...booking,
        start: new Date(booking.start),
        end: new Date(booking.end)
      }));
    },
    staleTime: 60 * 1000, // 1 minute
  });

  // Fetch bookings from the public endpoint for the current view
  const { data: bookings = [], isLoading: isLoadingBookings } = useQuery<ApiBooking[]>({
    queryKey: ['/api/public/bookings', dateRange],
    queryFn: async () => {
      const startDate = dateRange.start?.toISOString();
      const endDate = dateRange.end?.toISOString();
      
      if (startDate && endDate) {
        const res = await apiRequest('GET', `/api/public/bookings?start=${startDate}&end=${endDate}`);
        const data = await res.json();
        
        // Convert string dates to Date objects
        return data.map((booking: any) => ({
          ...booking,
          start: new Date(booking.start),
          end: new Date(booking.end)
        }));
      }
      return [];
    },
    enabled: !!(dateRange.start && dateRange.end),
    staleTime: 1 * 60 * 1000,
  });
  
  // Fetch booking-studio links from public endpoint
  const { data: bookingStudioLinks = [] } = usePublicBookingStudioLinks();

  // Navigation functions
  const goToToday = () => {
    // Use facility timezone for today as instructed
    const facilityTz = getFacilityTimezone_Dynamic();
    const now = new Date();
    const facilityToday = new Date(now.toLocaleString("en-US", { timeZone: facilityTz }));
    setCurrentDate(facilityToday);
  };

  const goToPrevious = () => {
    if (viewType === 'daily') {
      setCurrentDate(prevDate => addDays(prevDate, -1));
    } else if (viewType === 'weekly') {
      setCurrentDate(prevDate => subWeeks(prevDate, 1));
    } else if (viewType === 'monthly') {
      setCurrentDate(prevDate => new Date(prevDate.getFullYear(), prevDate.getMonth() - 1, 1));
    }
  };

  const goToNext = () => {
    if (viewType === 'daily') {
      setCurrentDate(prevDate => addDays(prevDate, 1));
    } else if (viewType === 'weekly') {
      setCurrentDate(prevDate => addWeeks(prevDate, 1));
    } else if (viewType === 'monthly') {
      setCurrentDate(prevDate => new Date(prevDate.getFullYear(), prevDate.getMonth() + 1, 1));
    }
  };

  // Helper function to format date range label
  const getDateRangeLabel = () => {
    if (!dateRange.start || !dateRange.end) return '';
    
    if (viewType === 'daily') {
      return formatInFacilityTimezone(currentDate, 'MMMM d, yyyy');
    } else if (viewType === 'weekly') {
      return `${formatInFacilityTimezone(dateRange.start, 'MMM d')} - ${formatInFacilityTimezone(dateRange.end, 'MMM d, yyyy')}`;
    } else if (viewType === 'monthly') {
      return formatInFacilityTimezone(currentDate, 'MMMM yyyy');
    }
    
    return '';
  };
  
  // Studio selection helpers
  const toggleStudio = (studioId: number) => {
    setSelectedStudioIds(prev => {
      if (prev.includes(studioId)) {
        return prev.filter(id => id !== studioId);
      } else {
        return [...prev, studioId];
      }
    });
  };
  
  const isStudioSelected = (studioId: number) => {
    return selectedStudioIds.length === 0 || selectedStudioIds.includes(studioId);
  };
  
  // Get the studio objects that correspond to the selected IDs
  const selectedStudios = studios.filter(studio => 
    selectedStudioIds.includes(studio.id)
  );
  
  // Filtered studios for display
  const filteredStudios = selectedStudioIds.length > 0
    ? studios.filter(studio => selectedStudioIds.includes(studio.id))
    : studios;

  // Get filtered and sorted bookings
  const filteredBookings = bookings
    .filter(booking => {
      if (!dateRange.start || !dateRange.end) return true;
      
      const bookingStart = new Date(booking.start);
      const bookingEnd = new Date(booking.end);
      
      // For daily view, use isSameDay to ensure correct timezone handling
      if (viewType === 'daily') {
        // Use the imported isSameDay function from the top of the file
        // No need to require it here
        const result = isSameDay(bookingStart, currentDate);
        
        // Log for debugging
        console.log(`Booking ${booking.id} - ${booking.title} (${bookingStart.toISOString()}) on same day as ${currentDate.toISOString()}? ${result}`);
        
        return result;
      }
      
      // For weekly and monthly views, check if booking overlaps with date range
      return isWithinInterval(bookingStart, { start: dateRange.start, end: dateRange.end }) ||
             isWithinInterval(bookingEnd, { start: dateRange.start, end: dateRange.end }) ||
             (bookingStart <= dateRange.start && bookingEnd >= dateRange.end);
    })
    .filter(booking => {
      // Apply studio filtering if studios are selected
      if (selectedStudioIds.length === 0) return true; // Show all if no studios selected
      
      // Check if booking is directly assigned to a selected studio
      const directMatch = selectedStudioIds.includes(booking.studioId);
      
      // Check if booking is linked to a selected studio via junction table
      const linkedMatch = bookingStudioLinks.some(link => 
        link.bookingId === booking.id && selectedStudioIds.includes(link.studioId)
      );
      
      return directMatch || linkedMatch;
    })
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    
  // Log filtered bookings for debugging
  console.log(`[PublicCalendarPage] View: ${viewType}, Date: ${currentDate.toISOString()}, Found ${filteredBookings.length} bookings`);
  if (filteredBookings.length > 0) {
    console.log(`[PublicCalendarPage] First booking: ${filteredBookings[0].id} - ${filteredBookings[0].title} (${new Date(filteredBookings[0].start).toISOString()})`);
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b bg-[#003366] shadow-sm h-20 flex items-center justify-center">
        <img src={logoPath} alt="BookStud.io logo" className="h-60 w-auto" />
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-full px-2 py-4 sm:px-4 lg:px-8">
          {/* Date Controls */}
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={goToPrevious}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={goToToday}
                className="h-8"
              >
                Today
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={goToNext}
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <div className="hidden text-base font-semibold md:block">
                {getDateRangeLabel()}
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Button
                variant={viewType === 'daily' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewType('daily')}
                className="h-8"
              >
                Day
              </Button>
              <Button
                variant={viewType === 'weekly' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewType('weekly')}
                className="h-8"
              >
                Week
              </Button>
              <Button
                variant={viewType === 'monthly' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewType('monthly')}
                className="h-8"
              >
                Month
              </Button>
            </div>
          </div>

          <div className="md:hidden text-base font-semibold mb-2">
            {getDateRangeLabel()}
          </div>
          
          {/* Studio Status Summary Badges */}
          <div className="mb-4">
            <StudioStatusSummary
              studios={studios}
              bookings={allBookings as Booking[]}
              bookingStudioLinks={bookingStudioLinks}
              currentDate={new Date()}
            />
          </div>
          
          {/* Studio Filter Dropdown - matches authenticated view */}
          <div className="mb-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "gap-1.5",
                    selectedStudioIds.length > 0 && "border-blue-500 bg-blue-50 dark:bg-blue-950/30"
                  )}
                  data-testid="button-studio-filter"
                >
                  <Filter className="h-4 w-4" />
                  <span>Studios</span>
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
                        .filter(s => calculateStudioStatus(s, allBookings as Booking[], now, bookingStudioLinks) === "available")
                        .map(s => s.id);
                      setSelectedStudioIds(availableIds);
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
                        .filter(s => calculateStudioStatus(s, allBookings as Booking[], now, bookingStudioLinks) === "in-use")
                        .map(s => s.id);
                      setSelectedStudioIds(inUseIds);
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
                        .filter(s => calculateStudioStatus(s, allBookings as Booking[], now, bookingStudioLinks) === "maintenance")
                        .map(s => s.id);
                      setSelectedStudioIds(maintIds);
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
                      onClick={() => setSelectedStudioIds([])}
                      data-testid="button-clear-studio-filter"
                    >
                      Show all studios
                    </button>
                    <DropdownMenuSeparator />
                  </>
                )}
                {studios.map((studio) => {
                  const studioStatus = calculateStudioStatus(
                    studio,
                    allBookings as Booking[],
                    new Date(),
                    bookingStudioLinks
                  );
                  const statusColor = getStudioStatusColor(studioStatus);
                  
                  return (
                    <DropdownMenuCheckboxItem
                      key={studio.id}
                      checked={selectedStudioIds.includes(studio.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedStudioIds([...selectedStudioIds, studio.id]);
                        } else {
                          setSelectedStudioIds(selectedStudioIds.filter(id => id !== studio.id));
                        }
                      }}
                      onSelect={(e) => e.preventDefault()}
                      data-testid={`checkbox-studio-${studio.id}`}
                    >
                      <div className={cn("w-2 h-2 rounded-full mr-2", statusColor)} />
                      {studio.name}
                    </DropdownMenuCheckboxItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Calendar Views */}
          <div className="mt-2">
            {viewType === 'daily' && (
              <>
                {/* Add debugging info */}
                <div className="text-xs text-muted-foreground mb-2">
                  Debug: {currentDate.toISOString()} - Found {filteredBookings.length} bookings for this view
                </div>
                <DailyCalendar
                  date={currentDate}
                  studios={filteredStudios}
                  bookings={filteredBookings}
                  readOnly={true}
                  selectedStudioIds={selectedStudioIds}
                />
              </>
            )}
            {viewType === 'weekly' && (
              <WeeklyCalendar
                startDate={dateRange.start || new Date()}
                studios={filteredStudios}
                bookings={filteredBookings}
                readOnly={true}
                selectedStudioIds={selectedStudioIds}
              />
            )}
            {viewType === 'monthly' && (
              <MonthlyCalendar
                date={currentDate}
                studios={filteredStudios}
                bookings={filteredBookings}
                readOnly={true}
                selectedStudioIds={selectedStudioIds}
              />
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t bg-background px-4 py-2 text-center text-xs text-muted-foreground">
        <p>BookStud.io &copy; {new Date().getFullYear()} - Public Calendar View</p>
      </footer>
    </div>
  );
}

export default PublicCalendarPage;