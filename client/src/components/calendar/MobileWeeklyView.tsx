import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { startOfWeek, addDays, format, isToday, isSameDay } from "date-fns";
import { formatTime, formatTimeRange, getFacilityTimezone, getDayRangeInFacilityTimezone } from "@/utils/dateUtils";
import type { Booking } from "@shared/schema";
import MobileBanner from "@/components/layout/MobileBanner";
import WeatherForecastCell from "@/components/WeatherForecastCell";
import { useWeatherForecast } from "@/hooks/use-weather-forecast";
import SimpleMobileForm from "@/components/forms/SimpleMobileForm-new";
import AlertModal from "@/components/modals/AlertModal";
import { useCalendarContext } from "@/contexts/CalendarContext";

interface MobileWeeklyViewProps {
  currentDate: Date;
  onDateChange: (date: Date) => void;
  onViewChange: (view: "day" | "week" | "month") => void;
}

export default function MobileWeeklyView({ 
  currentDate,
  onDateChange,
  onViewChange,
}: MobileWeeklyViewProps) {
  const [isNewBookingModalOpen, setIsNewBookingModalOpen] = useState(false);
  const [isNewAlertModalOpen, setIsNewAlertModalOpen] = useState(false);
  const [editBooking, setEditBooking] = useState<Booking | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(currentDate);

  // Get calendar context
  const { setSelectedDate: setContextDate } = useCalendarContext();

  // Calculate week start (Monday)
  const weekStart = useMemo(() => {
    const facilityTz = getFacilityTimezone();
    const start = startOfWeek(currentDate, { weekStartsOn: 1 }); // Start on Monday
    return new Date(start.toLocaleString("en-US", { timeZone: facilityTz }));
  }, [currentDate]);

  // Generate 6 days (Monday to Saturday)
  const weekDays = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => addDays(weekStart, i));
  }, [weekStart]);

  // Fetch all bookings for the week
  const weekStartRange = getDayRangeInFacilityTimezone(weekStart);
  const weekEndRange = getDayRangeInFacilityTimezone(addDays(weekStart, 5));
  
  const { data: allBookings = [] } = useQuery<Booking[]>({
    queryKey: ['/api/bookings', weekStartRange.start, weekEndRange.end],
    queryFn: () => {
      const params = new URLSearchParams({
        start: weekStartRange.start.toISOString(),
        end: weekEndRange.end.toISOString()
      });
      return fetch(`/api/bookings?${params}`).then(res => res.json());
    },
  });

  // Fetch studios
  const { data: studios = [] } = useQuery({
    queryKey: ['/api/studios'],
  });

  // Fetch weather forecast
  const { data: forecast } = useWeatherForecast();

  // Group bookings by day
  const bookingsByDay = useMemo(() => {
    const grouped: Record<string, Booking[]> = {};
    
    weekDays.forEach(day => {
      const dayKey = format(day, 'yyyy-MM-dd');
      const { start: dayStart, end: dayEnd } = getDayRangeInFacilityTimezone(day);
      
      grouped[dayKey] = allBookings.filter(booking => {
        const bookingStart = new Date(booking.start);
        const bookingEnd = new Date(booking.end);
        
        // Check if booking overlaps with this day
        return bookingStart < dayEnd && bookingEnd > dayStart;
      });
    });
    
    return grouped;
  }, [allBookings, weekDays]);

  // Navigation functions
  const goToPreviousWeek = () => {
    const prevWeek = addDays(currentDate, -7);
    onDateChange(prevWeek);
  };

  const goToNextWeek = () => {
    const nextWeek = addDays(currentDate, 7);
    onDateChange(nextWeek);
  };

  const goToToday = () => {
    const facilityTz = getFacilityTimezone();
    const now = new Date();
    const facilityToday = new Date(now.toLocaleString("en-US", { timeZone: facilityTz }));
    onDateChange(facilityToday);
  };

  // Handle day selection
  const handleDaySelect = (day: Date) => {
    setSelectedDate(day);
    setContextDate(day);
    onDateChange(day);
  };

  // Handle booking click
  const handleBookingClick = (booking: Booking) => {
    // Check if this is a maintenance/alert booking
    const isMaintenanceOrAlert = booking.type === 'maintenance' || 
                                 booking.type === 'alert' || 
                                 booking.type === 'it_support' ||
                                 booking.studioId === null;
    
    if (isMaintenanceOrAlert) {
      // Handle alert editing
      const alertData = {
        id: booking.id,
        title: booking.title || '',
        description: booking.description || '',
        studioId: booking.studioId || null,
        pcrRoomId: booking.pcrRoomId || null,
        userId: booking.userId || 1,
        start: booking.start,
        end: booking.end,
        type: booking.type || 'maintenance',
        status: booking.status || 'confirmed',
        severity: booking.severity || 'low',
        templateId: booking.templateId || null,
        notifyList: booking.notifyList || [],
        color: booking.color || '#ff6b35',
        createdAt: booking.createdAt || new Date()
      };
      
      setEditBooking(alertData);
      setIsNewAlertModalOpen(true);
      return;
    }
    
    // Handle regular booking editing
    const cleanBooking: any = {
      id: booking.id,
      title: booking.title || '',
      description: booking.description || '',
      studioId: booking.studioId || null,
      pcrRoomId: booking.pcrRoomId || null,
      start: booking.start,
      end: booking.end,
      type: booking.type || 'production',
      status: booking.status || 'confirmed',
      severity: booking.severity || null,
      templateId: booking.templateId || 0,
      notifyList: booking.notifyList || [],
      color: booking.color || '#3b82f6',
      studioIds: booking.studioId ? [booking.studioId] : []
    };
    
    cleanBooking.userId = booking.userId || 1;
    
    setEditBooking(cleanBooking);
    setIsEditModalOpen(true);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden mobile-gradient-bg">
      {/* Modern Site Banner */}
      <MobileBanner />
      
      {/* Header with week navigation */}
      <div className="border-b p-4 bg-white/90 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex justify-between items-center mb-3">
          <Button variant="ghost" size="icon" onClick={goToPreviousWeek}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          
          <div className="flex flex-col items-center">
            <h1 className="text-lg font-bold">
              {format(weekStart, 'MMM d')} - {format(addDays(weekStart, 5), 'MMM d, yyyy')}
            </h1>
          </div>
          
          <Button variant="ghost" size="icon" onClick={goToNextWeek}>
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
        
        {/* Today button */}
        <div className="flex justify-center">
          <Button 
            variant="outline" 
            size="sm"
            className="text-blue-600 border-blue-300 hover:bg-blue-50"
            onClick={goToToday}
          >
            <Calendar className="h-4 w-4 mr-1" /> Today
          </Button>
        </div>
      </div>

      {/* Week view - 6 days */}
      <div className="flex-1 overflow-auto pb-20">
        <div className="grid grid-cols-6 gap-1 p-2">
          {weekDays.map((day, index) => {
            const dayKey = format(day, 'yyyy-MM-dd');
            const dayBookings = bookingsByDay[dayKey] || [];
            const isSelected = isSameDay(day, selectedDate);
            const isDayToday = isToday(day);
            
            return (
              <div 
                key={dayKey}
                className={cn(
                  "flex flex-col min-h-[150px] bg-white/90 backdrop-blur-sm rounded-lg border cursor-pointer transition-all",
                  isSelected ? "ring-2 ring-blue-500" : "",
                  isDayToday ? "bg-blue-50/90" : ""
                )}
                onClick={() => handleDaySelect(day)}
              >
                {/* Day header */}
                <div className="p-2 border-b text-center">
                  <div className="text-xs text-gray-600 font-medium">
                    {format(day, 'EEE')}
                  </div>
                  <div className={cn(
                    "text-sm font-semibold",
                    isDayToday ? "text-blue-600" : "text-neutral-900"
                  )}>
                    {format(day, 'd')}
                  </div>
                  
                  {/* Weather for this day */}
                  <div className="mt-1">
                    <WeatherForecastCell 
                      date={day} 
                      forecast={forecast?.forecast.find(f => 
                        new Date(f.date).toDateString() === day.toDateString()
                      ) || null}
                      size="compact"
                    />
                  </div>
                </div>
                
                {/* Bookings for this day */}
                <div className="flex-1 p-1 space-y-1 overflow-hidden">
                  {dayBookings.slice(0, 3).map(booking => {
                    const isAlert = booking.studioId === null || booking.severity !== null;
                    
                    return (
                      <div
                        key={booking.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleBookingClick(booking);
                        }}
                        className={cn(
                          "text-xs p-1.5 rounded cursor-pointer transition-colors",
                          booking.status === "tentative" ? "border border-dashed" : "",
                          isAlert ? "bg-red-100 text-red-800" : "bg-blue-100 text-blue-800"
                        )}
                        style={booking.color && !isAlert ? { 
                          backgroundColor: `${booking.color}20`,
                          color: booking.color
                        } : {}}
                      >
                        <div className="font-medium truncate">{booking.title}</div>
                        <div className="text-[10px] opacity-75">
                          {formatTime(new Date(booking.start))}
                        </div>
                      </div>
                    );
                  })}
                  
                  {/* Show more indicator */}
                  {dayBookings.length > 3 && (
                    <div className="text-[10px] text-gray-500 text-center py-1">
                      +{dayBookings.length - 3} more
                    </div>
                  )}
                  
                  {/* Empty state */}
                  {dayBookings.length === 0 && (
                    <div className="text-[10px] text-gray-400 text-center py-2">
                      No bookings
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modals */}
      {isNewBookingModalOpen && (
        <SimpleMobileForm
          isOpen={isNewBookingModalOpen}
          onOpenChange={setIsNewBookingModalOpen}
          defaultDate={selectedDate}
        />
      )}

      {isEditModalOpen && editBooking && (
        <SimpleMobileForm
          isOpen={isEditModalOpen}
          onOpenChange={setIsEditModalOpen}
          editBooking={editBooking}
          defaultDate={selectedDate}
        />
      )}

      {isNewAlertModalOpen && (
        <AlertModal
          isOpen={isNewAlertModalOpen}
          onOpenChange={setIsNewAlertModalOpen}
          defaultDate={selectedDate}
          editBooking={editBooking}
        />
      )}
    </div>
  );
}