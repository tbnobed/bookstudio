import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfWeek, addDays, addWeeks, subWeeks, isSameDay, parseISO, endOfDay } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { ChevronLeft, ChevronRight, Settings, Calendar, AlertTriangle, Camera, Monitor, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useWeatherForecast } from "@/hooks/useWeatherForecast";
import WeatherForecastCell from "@/components/calendar/WeatherForecastCell";
import { Header } from "@/components/layout/Header";

const FACILITY_TIMEZONE = "America/Chicago";

// Get severity-based styling for alerts and maintenance bookings
function getSeverityStyle(booking: BookingData) {
  if (!booking.severity || (!booking.type.includes('maintenance') && booking.type !== 'all_day_maintenance')) {
    return null;
  }

  const severityStyles = {
    low: {
      backgroundColor: '#FEF3C7', // yellow-100
      borderColor: '#F59E0B', // yellow-500
      color: '#92400E', // yellow-800
      pattern: 'none'
    },
    medium: {
      backgroundColor: '#FED7AA', // orange-200
      borderColor: '#EA580C', // orange-600
      color: '#9A3412', // orange-800
      pattern: 'diagonal-stripes'
    },
    high: {
      backgroundColor: '#FECACA', // red-200
      borderColor: '#DC2626', // red-600
      color: '#991B1B', // red-800
      pattern: 'diagonal-stripes'
    },
    critical: {
      backgroundColor: '#FCA5A5', // red-300
      borderColor: '#B91C1C', // red-700
      color: '#7F1D1D', // red-900
      pattern: 'crosshatch'
    }
  };

  return severityStyles[booking.severity as keyof typeof severityStyles] || severityStyles.medium;
}

interface BookingData {
  id: number;
  title: string;
  description: string | null;
  start: string;
  end: string;
  type: string;
  status: string | null;
  severity: string | null;
  color: string | null;
  studioId: number | null;
  pcrRoomId: number | null;
}

interface Studio {
  id: number;
  name: string;
  description: string | null;
  status: string;
}

interface BookingStudioLink {
  id: number;
  bookingId: number;
  studioId: number;
}

interface PcrRoom {
  id: number;
  name: string;
  description: string | null;
  status: string;
}

export default function EngineeringPage() {
  const [currentWeek, setCurrentWeek] = useState(() => {
    const now = new Date();
    const chicagoTime = toZonedTime(now, FACILITY_TIMEZONE);
    return startOfWeek(chicagoTime, { weekStartsOn: 1 }); // Start on Monday
  });

  const [currentTime, setCurrentTime] = useState(() => {
    const now = new Date();
    return toZonedTime(now, FACILITY_TIMEZONE);
  });



  // Fetch weather forecast data
  const { forecast } = useWeatherForecast();

  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setCurrentTime(toZonedTime(now, FACILITY_TIMEZONE));
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  // Fetch bookings
  const { data: bookings = [] } = useQuery<BookingData[]>({
    queryKey: ["/api/bookings"],
  });

  // Fetch studios
  const { data: studios = [] } = useQuery<Studio[]>({
    queryKey: ["/api/studios"],
  });

  // Fetch booking-studio links
  const { data: bookingStudios = [] } = useQuery<BookingStudioLink[]>({
    queryKey: ["/api/booking-studios"],
  });

  // Fetch PCR rooms
  const { data: pcrRooms = [] } = useQuery<PcrRoom[]>({
    queryKey: ["/api/pcr-rooms"],
  });

  // Generate time slots for full 24-hour display (midnight to midnight)
  const timeSlots = Array.from({ length: 24 }, (_, i) => {
    const hour = i; // Start from midnight (0) to 11 PM (23)
    const ampm = hour < 12 ? 'AM' : 'PM';
    const displayHour = hour === 0 ? 12 : (hour > 12 ? hour - 12 : hour);
    return {
      hour24: hour,
      label: `${displayHour} ${ampm}`,
      value: hour
    };
  });

  // Generate week days
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(currentWeek, i);
    return {
      date,
      dayName: format(date, 'EEE').toUpperCase(),
      dayNumber: format(date, 'd'),
      fullDate: format(date, 'yyyy-MM-dd')
    };
  });



  // Helper function to get studios for a booking
  const getBookingStudios = (bookingId: number) => {
    const studioLinks = bookingStudios.filter(link => link.bookingId === bookingId);
    return studioLinks.map(link => {
      const studio = studios.find(s => s.id === link.studioId);
      return studio?.name || `Studio ${link.studioId}`;
    });
  };

  // Helper function to get PCR room name
  const getPcrRoomName = (pcrRoomId: number | null) => {
    if (!pcrRoomId) return null;
    const pcrRoom = pcrRooms.find(pcr => pcr.id === pcrRoomId);
    return pcrRoom?.name || `PCR ${pcrRoomId}`;
  };

  // Helper function to check if two bookings overlap
  const bookingsOverlap = (booking1: BookingData, booking2: BookingData) => {
    const start1 = new Date(booking1.start).getTime();
    const end1 = new Date(booking1.end).getTime();
    const start2 = new Date(booking2.start).getTime();
    const end2 = new Date(booking2.end).getTime();
    
    return start1 < end2 && start2 < end1;
  };

  // Helper function to arrange overlapping bookings in columns
  const arrangeBookingsInColumns = (dayBookings: BookingData[]) => {
    // If no bookings or only one booking, no need for complex arrangement
    if (dayBookings.length <= 1) {
      return dayBookings.map(booking => ({ booking, column: 0, totalColumns: 1 }));
    }

    const arranged: Array<{ booking: BookingData; column: number; totalColumns: number }> = [];
    
    // Sort bookings by start time
    const sortedBookings = [...dayBookings].sort((a, b) => 
      new Date(a.start).getTime() - new Date(b.start).getTime()
    );
    
    sortedBookings.forEach(booking => {
      // Find overlapping bookings that are already arranged
      const overlapping = arranged.filter(item => 
        bookingsOverlap(item.booking, booking)
      );
      
      if (overlapping.length === 0) {
        // No overlap - this booking gets its own full width
        arranged.push({ booking, column: 0, totalColumns: 1 });
      } else {
        // Find the first available column among overlapping bookings
        const usedColumns = overlapping.map(item => item.column);
        let column = 0;
        while (usedColumns.includes(column)) {
          column++;
        }
        
        // Add this booking to the arrangement
        arranged.push({ booking, column, totalColumns: 1 });
        
        // Update total columns for all overlapping bookings including this one
        const allOverlapping = arranged.filter(item => 
          bookingsOverlap(item.booking, booking) || item.booking.id === booking.id
        );
        
        const maxColumn = Math.max(...allOverlapping.map(item => item.column));
        allOverlapping.forEach(item => {
          item.totalColumns = maxColumn + 1;
        });
      }
    });
    
    return arranged;
  };

  // Helper function to calculate booking position and height with column support
  const getBookingStyle = (booking: BookingData, column: number, totalColumns: number) => {
    const startTime = toZonedTime(parseISO(booking.start), FACILITY_TIMEZONE);
    const endTime = toZonedTime(parseISO(booking.end), FACILITY_TIMEZONE);
    
    const startHour = startTime.getHours() + startTime.getMinutes() / 60;
    const endHour = endTime.getHours() + endTime.getMinutes() / 60;
    
    // Calculate position relative to view start (midnight)
    const viewStartHour = 0;
    const adjustedStartHour = startHour;
    const adjustedEndHour = endHour;
    

    
    // Check if this is an all-day event or spans across midnight
    const isAllDay = booking.type === 'all_day_maintenance' || 
                     (endHour < startHour && Math.abs(endHour - startHour) > 12);
    
    let topPosition, height;
    
    if (isAllDay) {
      // For all-day events, span the entire visible time range
      topPosition = 0;
      height = 21 * 60; // 21 hour view
    } else if (adjustedEndHour < adjustedStartHour) {
      // Event spans across the view boundary
      topPosition = adjustedStartHour * 60;
      height = (21 - adjustedStartHour) * 60;
    } else {
      // Normal event within view range
      topPosition = Math.max(0, adjustedStartHour * 60);
      height = Math.max(30, (adjustedEndHour - adjustedStartHour) * 60);
    }
    
    // Calculate width and left position
    let width, leftPosition;
    
    if (totalColumns === 1) {
      // Single booking - use full width
      width = 100;
      leftPosition = 0;
    } else {
      // Multiple overlapping bookings - use overlapping layout with minimum readable width
      const minWidth = Math.max(60, 100 / totalColumns); // Minimum 60% width for readability
      width = minWidth;
      leftPosition = column * 20; // 20% offset for each column
    }
    
    return {
      top: `${topPosition}px`,
      height: `${height}px`,
      left: `${leftPosition}%`,
      width: `${width}%`,
      backgroundColor: booking.color || '#3B82F6',
      opacity: booking.status === 'cancelled' ? 0.5 : 1,
      border: booking.status === 'tentative' ? '2px dashed #666' : 'none',
      zIndex: 10 + column, // Higher z-index for later columns to ensure visibility
      boxShadow: totalColumns > 1 ? '0 1px 3px rgba(0,0,0,0.2)' : 'none' // Add shadow for better separation when overlapping
    };
  };

  // Filter bookings for current week and exclude cancelled bookings
  const weekBookings = bookings.filter(booking => {
    const bookingDate = toZonedTime(parseISO(booking.start), FACILITY_TIMEZONE);
    const weekStart = currentWeek;
    const weekEnd = endOfDay(addDays(currentWeek, 6)); // End of Sunday, not start of Sunday
    
    const inWeek = bookingDate >= weekStart && bookingDate <= weekEnd;
    const isNotCancelled = booking.status !== 'cancelled';
    
    return inWeek && isNotCancelled;
  });

  const goToPreviousWeek = () => {
    setCurrentWeek(prev => subWeeks(prev, 1));
  };

  const goToNextWeek = () => {
    setCurrentWeek(prev => addWeeks(prev, 1));
  };

  const goToCurrentWeek = () => {
    const now = new Date();
    const chicagoTime = toZonedTime(now, FACILITY_TIMEZONE);
    setCurrentWeek(startOfWeek(chicagoTime, { weekStartsOn: 1 }));
  };

  // Helper function to calculate current time indicator position
  const getCurrentTimePosition = () => {
    const currentHour = currentTime.getHours() + currentTime.getMinutes() / 60;
    const viewStartHour = 0; // Starting from midnight
    const adjustedHour = currentHour;
    return adjustedHour * 60; // 60px per hour
  };

  // Check if current time should be shown (current day is in view)
  const shouldShowCurrentTimeIndicator = () => {
    const today = toZonedTime(new Date(), FACILITY_TIMEZONE);
    return weekDays.some(day => isSameDay(day.date, today));
  };

  // Function to determine if a booking is an alert/maintenance
  const isAlertBooking = (booking: BookingData) => {
    // Consider a booking an alert if:
    // 1. It has "maintenance" type, OR
    // 2. It has "alert" type, OR  
    // 3. It has "Alert" in the title, OR
    // 4. It's an "all_day_maintenance" type booking, OR
    // 5. It has "site_alert" type, OR
    // 6. It has "outage" in the title, OR
    // 7. It has maintenance keywords in title
    
    const isMaintenanceType = booking.type === 'maintenance' || 
                             booking.type === 'all_day_maintenance' ||
                             booking.type === 'site_alert' ||
                             booking.type === 'alert';
                             
    const hasAlertKeywords = booking.title && (
      booking.title.toLowerCase().includes('alert') ||
      booking.title.toLowerCase().includes('outage') ||
      booking.title.toLowerCase().includes('emergency') ||
      booking.title.toLowerCase().includes('maintenance') ||
      booking.title.toLowerCase().includes('notice') ||
      booking.title.toLowerCase().includes('warning')
    );
    
    return isMaintenanceType || hasAlertKeywords;
  };

  // Separate alerts from regular bookings
  const alertBookings = weekBookings.filter(booking => isAlertBooking(booking));
  const regularBookings = weekBookings.filter(booking => !isAlertBooking(booking));
  
  // console.log(`[ENGINEERING] Current week: ${format(currentWeek, 'MMM d')} - ${format(addDays(currentWeek, 6), 'MMM d')}`);
  // console.log(`[ENGINEERING] Total bookings: ${weekBookings.length}, Alerts: ${alertBookings.length}, Regular: ${regularBookings.length}`);

  return (
    <TooltipProvider>
      <div className="h-screen flex flex-col bg-gray-50">
        {/* Header with sidebar toggle */}
        <Header
          currentDate={currentWeek}
          onDateChange={setCurrentWeek}
          view="week"
          onViewChange={() => {}} // Engineering view is always weekly
          title="Engineering Schedule"
          showViewToggle={false} // Don't show view toggle for engineering
          useMondayWeeks={true} // Engineering page uses Monday-based weeks
        />

      {/* Alerts Row - Day by Day */}
      {alertBookings.length > 0 && (
        <div className="bg-orange-50 border-b border-orange-200">
          <div className="px-6 py-3 border-b border-orange-200">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-orange-900 flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4" />
                <span>Active Alerts & Maintenance</span>
              </h2>
              <span className="text-xs text-orange-700 bg-orange-200 px-2 py-1 rounded-full">
                {alertBookings.length} Alert{alertBookings.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
          
          {/* Day-by-day alerts grid */}
          <div className="flex">
            {/* Time column spacer - exact match with calendar grid */}
            <div className="w-16 border-r border-gray-200 bg-gray-50 flex items-center justify-center py-4">
              <AlertTriangle className="w-4 h-4 text-orange-600" />
            </div>
            
            {/* Day columns for alerts - exact match with calendar structure */}
            {weekDays.map((day) => {
              const dayAlerts = alertBookings.filter(alert => {
                const alertDate = toZonedTime(parseISO(alert.start), FACILITY_TIMEZONE);
                return isSameDay(alertDate, day.date);
              });

              return (
                <div
                  key={day.fullDate}
                  className="flex-1 min-w-[140px] border-r border-gray-200 min-h-[80px] relative"
                >
                  {dayAlerts.length > 0 ? (
                    <div className="p-2 space-y-1">
                      {dayAlerts.map((alert) => {
                        const severityStyle = getSeverityStyle(alert);
                        const startTime = toZonedTime(parseISO(alert.start), FACILITY_TIMEZONE);
                        const endTime = toZonedTime(parseISO(alert.end), FACILITY_TIMEZONE);
                        
                        return (
                          <Tooltip key={alert.id}>
                            <TooltipTrigger asChild>
                              <div
                                className="p-2 rounded text-xs cursor-pointer transition-all duration-200 hover:shadow-sm border"
                                style={{
                                  backgroundColor: severityStyle?.backgroundColor || '#fed7aa',
                                  borderColor: severityStyle?.borderColor || '#fdba74',
                                  color: severityStyle?.color || '#9a3412'
                                }}
                              >
                                <div className="flex items-center gap-1 mb-1">
                                  <AlertTriangle className="w-2.5 h-2.5" />
                                  <span className="font-medium truncate text-xs">{alert.title}</span>
                                </div>
                                <div className="text-xs opacity-75">
                                  {format(startTime, 'h:mm a')} - {format(endTime, 'h:mm a')}
                                </div>
                                {alert.severity && (
                                  <div className="text-xs font-bold mt-1 px-1 py-0.5 rounded bg-black bg-opacity-20">
                                    {alert.severity.toUpperCase()}
                                  </div>
                                )}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <div className="text-sm space-y-1">
                                <div className="font-semibold">{alert.title}</div>
                                {alert.description && <div>{alert.description}</div>}
                                <div className="text-xs opacity-75">
                                  {format(startTime, 'MMM d, h:mm a')} - {format(endTime, 'MMM d, h:mm a')}
                                </div>
                                <div className="text-xs opacity-75">Type: {alert.type}</div>
                                <div className="text-xs opacity-75">Status: {alert.status}</div>
                                {alert.severity && <div className="text-xs opacity-75">Severity: {alert.severity}</div>}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-2 text-xs text-orange-400 italic text-center">No alerts</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Calendar Grid */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-auto">
          <div className="min-w-[1000px]">
            {/* Day Headers */}
            <div className="sticky top-0 bg-white border-b border-gray-200 z-10">
              <div className="flex">
                {/* Time column header */}
                <div className="w-16 border-r border-gray-200 bg-gray-50"></div>
                
                {/* Day headers */}
                {weekDays.map((day) => {
                  const isToday = isSameDay(day.date, toZonedTime(new Date(), FACILITY_TIMEZONE));
                  
                  return (
                    <div
                      key={day.fullDate}
                      className={`flex-1 min-w-[140px] border-r border-gray-200 ${
                        isToday ? 'bg-blue-50' : 'bg-white'
                      }`}
                    >
                      <div className="p-3 text-center">
                        <div className="text-xs font-medium text-gray-500 mb-1">
                          {day.dayName}
                        </div>
                        <div className={`text-lg font-semibold ${
                          isToday ? 'text-blue-600' : 'text-gray-900'
                        }`}>
                          {day.dayNumber}
                        </div>
                        
                        {/* Weather forecast cell */}
                        <div className="mt-2">
                          <WeatherForecastCell 
                            date={day.date} 
                            forecast={forecast?.forecast.find(f => f.date === day.fullDate) || null} 
                            size="small"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Time Grid */}
            <div className="relative">
              <div className="flex">
                {/* Time column */}
                <div className="w-16 border-r border-gray-200 bg-gray-50">
                  {timeSlots.map((slot) => (
                    <div
                      key={slot.hour24}
                      className="h-[60px] border-b border-gray-100 flex items-center justify-center text-xs text-gray-500 font-medium"
                    >
                      {slot.label}
                    </div>
                  ))}
                </div>

                {/* Day columns */}
                {weekDays.map((day) => {
                  const dayBookings = regularBookings.filter(booking => {
                    const bookingStartDate = toZonedTime(parseISO(booking.start), FACILITY_TIMEZONE);
                    const bookingEndDate = toZonedTime(parseISO(booking.end), FACILITY_TIMEZONE);
                    
                    // Only show booking on the day it starts, unless it truly spans multiple days
                    const startsOnDay = isSameDay(bookingStartDate, day.date);
                    
                    // For genuine multi-day bookings, check if this day falls within the booking period
                    const dayStart = new Date(day.date);
                    dayStart.setHours(0, 0, 0, 0);
                    const dayEnd = new Date(day.date);
                    dayEnd.setHours(23, 59, 59, 999);
                    
                    const bookingSpansMultipleDays = !isSameDay(bookingStartDate, bookingEndDate);
                    const bookingOverlapsThisDay = bookingStartDate <= dayEnd && bookingEndDate >= dayStart;
                    
                    // Show booking if it starts on this day OR if it's a genuine multi-day booking that overlaps this day
                    const showOnThisDay = startsOnDay || (bookingSpansMultipleDays && bookingOverlapsThisDay);
                    
                    return showOnThisDay;
                  });

                  // Arrange bookings in columns for side-by-side display
                  const arrangedBookings = arrangeBookingsInColumns(dayBookings);

                  return (
                    <div
                      key={day.fullDate}
                      className="flex-1 min-w-[140px] border-r border-gray-200 relative overflow-hidden"
                    >
                      {/* Hour grid lines */}
                      {timeSlots.map((slot) => (
                        <div
                          key={slot.hour24}
                          className="h-[60px] border-b border-gray-100"
                        />
                      ))}

                      {/* Current time indicator line */}
                      {shouldShowCurrentTimeIndicator() && isSameDay(day.date, toZonedTime(new Date(), FACILITY_TIMEZONE)) && (
                        <div
                          className="absolute left-0 right-0 z-30 pointer-events-none"
                          style={{
                            top: `${getCurrentTimePosition()}px`,
                            height: '2px',
                            backgroundColor: '#ef4444', // red-500
                            boxShadow: '0 0 4px rgba(239, 68, 68, 0.6)',
                          }}
                        >
                          {/* Time label */}
                          <div
                            className="absolute left-4 -top-5 px-2 py-1 bg-red-500 text-white text-xs font-bold rounded shadow-lg whitespace-nowrap z-50"
                          >
                            {format(currentTime, 'h:mm a')}
                          </div>
                          {/* Arrow pointing to the line */}
                          <div
                            className="absolute -left-1 -top-1 w-2 h-2 bg-red-500 rounded-full shadow-lg"
                            style={{ transform: 'translateX(-50%) translateY(-50%)' }}
                          />
                        </div>
                      )}

                      {/* Bookings arranged in columns */}
                      {arrangedBookings.map(({ booking, column, totalColumns }) => {
                        const style = getBookingStyle(booking, column, totalColumns);
                        const studios = getBookingStudios(booking.id);
                        const pcrRoom = getPcrRoomName(booking.pcrRoomId);
                        const severityStyle = getSeverityStyle(booking);
                        
                        // Apply severity styling for alerts/maintenance, otherwise use default booking style
                        const finalStyle = severityStyle 
                          ? {
                              ...style,
                              backgroundColor: severityStyle.backgroundColor,
                              border: `2px solid ${severityStyle.borderColor}`,
                              color: severityStyle.color,
                              marginLeft: '2px',
                              marginRight: '2px'
                            }
                          : {
                              ...style,
                              marginLeft: '2px',
                              marginRight: '2px'
                            };

                        return (
                          <Tooltip key={booking.id}>
                            <TooltipTrigger asChild>
                              <div
                                className={`absolute rounded text-sm p-2 cursor-pointer hover:shadow-2xl transition-all duration-200 z-20 overflow-hidden ${
                                  severityStyle ? 'font-semibold' : 'text-white'
                                } ${
                                  severityStyle && severityStyle.pattern === 'diagonal-stripes' ? 'bg-stripe-pattern' : ''
                                }`}
                                style={{
                                  ...finalStyle,
                                  textShadow: severityStyle ? '1px 1px 2px rgba(0,0,0,0.8)' : '1px 1px 2px rgba(0,0,0,0.7)',
                                  boxShadow: '0 8px 16px rgba(0, 0, 0, 0.25), 0 4px 8px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.1)',
                                  filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2))'
                                }}
                              >
                                <div className="font-bold text-base mb-1 leading-tight">
                                  {severityStyle && (
                                    <span className="text-xs px-1 py-0.5 rounded bg-black bg-opacity-20 font-bold mr-1">
                                      ⚠ {booking.severity?.toUpperCase()}
                                    </span>
                                  )}
                                  <span className="break-words">{booking.title}</span>
                                </div>
                                
                                <div className="space-y-1 text-xs leading-relaxed">
                                  <div className={`font-medium ${severityStyle ? 'opacity-90' : 'opacity-95'}`}>
                                    {format(toZonedTime(parseISO(booking.start), FACILITY_TIMEZONE), 'h:mm a')} - {format(toZonedTime(parseISO(booking.end), FACILITY_TIMEZONE), 'h:mm a')}
                                  </div>
                                  
                                  {studios.length > 0 && (
                                    <div className={`font-medium ${severityStyle ? 'opacity-85' : 'opacity-90'}`}>
                                      {studios.join(', ')}
                                    </div>
                                  )}
                                  
                                  {pcrRoom && (
                                    <div className={`font-medium ${severityStyle ? 'opacity-85' : 'opacity-90'}`}>
                                      {pcrRoom}
                                    </div>
                                  )}

                                  {booking.status && booking.status !== 'confirmed' && (
                                    <div className={`font-bold text-xs uppercase ${severityStyle ? 'opacity-90' : 'opacity-95'}`}>
                                      {booking.status}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-sm p-4 bg-white border border-gray-200 shadow-lg">
                              <div className="space-y-2">
                                <div className="font-semibold text-base text-gray-900">
                                  {booking.title}
                                </div>
                                
                                {booking.description && (
                                  <div className="text-sm text-gray-700">
                                    <strong>Description:</strong> {booking.description}
                                  </div>
                                )}
                                
                                <div className="text-sm text-gray-700">
                                  <strong>Time:</strong> {format(toZonedTime(parseISO(booking.start), FACILITY_TIMEZONE), 'MMM d, yyyy h:mm a')} - {format(toZonedTime(parseISO(booking.end), FACILITY_TIMEZONE), 'h:mm a')}
                                </div>
                                
                                {studios.length > 0 && (
                                  <div className="text-sm text-gray-700">
                                    <strong>Studios:</strong> {studios.join(', ')}
                                  </div>
                                )}
                                
                                {pcrRoom && (
                                  <div className="text-sm text-gray-700">
                                    <strong>PCR Room:</strong> {pcrRoom}
                                  </div>
                                )}
                                
                                <div className="text-sm text-gray-700">
                                  <strong>Type:</strong> {booking.type.charAt(0).toUpperCase() + booking.type.slice(1)}
                                </div>
                                
                                {booking.status && (
                                  <div className="text-sm text-gray-700">
                                    <strong>Status:</strong> {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                                  </div>
                                )}
                                
                                {booking.severity && (booking.type === 'maintenance' || booking.type === 'all_day_maintenance' || booking.type.includes('maintenance')) && (
                                  <div className="text-sm text-gray-700">
                                    <strong>Severity:</strong> {booking.severity.charAt(0).toUpperCase() + booking.severity.slice(1)}
                                  </div>
                                )}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </TooltipProvider>
  );
}