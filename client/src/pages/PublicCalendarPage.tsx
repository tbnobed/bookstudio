import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { addDays, startOfWeek, endOfWeek, format, addWeeks, subWeeks, isWithinInterval } from 'date-fns';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import WeeklyCalendar from '@/components/calendar/WeeklyCalendar';
import DailyCalendar from '@/components/calendar/DailyCalendar';
import MonthlyCalendar from '@/components/calendar/MonthlyCalendar';
import { Studio, Booking } from '@shared/schema';
import { apiRequest } from '@/lib/queryClient';
import { cn } from '@/lib/utils';
import logoPath from '@assets/bookstuio.png';
import { calculateStudioStatus, getStudioStatusColor } from '@/lib/studioUtils';

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

  // Navigation functions
  const goToToday = () => {
    setCurrentDate(new Date());
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
      return format(dateRange.start, 'MMMM d, yyyy');
    } else if (viewType === 'weekly') {
      return `${format(dateRange.start, 'MMM d')} - ${format(dateRange.end, 'MMM d, yyyy')}`;
    } else if (viewType === 'monthly') {
      return format(currentDate, 'MMMM yyyy');
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
      
      // Check if the booking overlaps with our date range
      return isWithinInterval(bookingStart, { start: dateRange.start, end: dateRange.end }) ||
             isWithinInterval(bookingEnd, { start: dateRange.start, end: dateRange.end }) ||
             (bookingStart <= dateRange.start && bookingEnd >= dateRange.end);
    })
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

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
          
          {/* Studio Selector Pills */}
          <div className="bg-gray-50 p-3 mb-4 rounded-md border">
            <div className="flex items-center mb-2 justify-between">
              <h3 className="text-sm font-medium">Studios:</h3>
              <div className="flex items-center space-x-2 text-sm">
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
            <div className="flex flex-wrap gap-2">
              {studios.map((studio) => {
                // Calculate real-time status using ALL bookings instead of just current view
                const studioStatus = calculateStudioStatus(studio, allBookings as Booking[], new Date());
                const statusColor = getStudioStatusColor(studioStatus);
                
                return (
                  <Button
                    key={studio.id}
                    variant="outline"
                    size="sm"
                    className={cn(
                      "rounded-full border-gray-300",
                      isStudioSelected(studio.id) ? "border-primary/50 bg-primary/5" : "bg-white"
                    )}
                    onClick={() => toggleStudio(studio.id)}
                  >
                    <div className={cn("w-2 h-2 rounded-full mr-2", statusColor)} />
                    {studio.name}
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Calendar Views */}
          <div className="mt-2">
            {viewType === 'daily' && (
              <DailyCalendar
                date={currentDate}
                studios={filteredStudios}
                bookings={filteredBookings}
                readOnly={true}
              />
            )}
            {viewType === 'weekly' && (
              <WeeklyCalendar
                startDate={dateRange.start || new Date()}
                studios={filteredStudios}
                bookings={filteredBookings}
                readOnly={true}
              />
            )}
            {viewType === 'monthly' && (
              <MonthlyCalendar
                date={currentDate}
                studios={filteredStudios}
                bookings={filteredBookings}
                readOnly={true}
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