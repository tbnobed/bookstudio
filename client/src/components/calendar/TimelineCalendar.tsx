import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Studio, Booking, PcrRoom, Alert, BookingStudio } from "@shared/schema";
import { useStudioBookings } from "@/hooks/useStudioBookings";
import { format, parseISO, isSameDay, isWithinInterval, startOfWeek, endOfWeek, addDays } from "date-fns";
import { getFacilityTimezone_Dynamic } from "@/lib/dateUtils";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import WeatherForecastCell from "@/components/calendar/WeatherForecastCell";
import { useWeatherForecast } from "@/hooks/useWeatherForecast";

interface TimelineCalendarProps {
  currentDate: Date;
  selectedStudioIds?: number[];
}

export default function TimelineCalendar({ currentDate, selectedStudioIds = [] }: TimelineCalendarProps) {
  // Fetch studios for display
  const { data: studios = [] } = useQuery<Studio[]>({
    queryKey: ["/api/studios"],
  });

  // Fetch PCR rooms for display
  const { data: pcrRooms = [] } = useQuery<PcrRoom[]>({
    queryKey: ["/api/pcr-rooms"],
  });

  // Fetch alerts
  const { data: alerts = [] } = useQuery<Alert[]>({
    queryKey: ["/api/alerts"],
    refetchInterval: 30000, // Refetch every 30 seconds for fresh alerts
  });

  // Fetch booking-studio links
  const { data: bookingStudioLinks = [] } = useQuery<BookingStudio[]>({
    queryKey: ["/api/booking-studios"],
    refetchInterval: 60000,
  });

  // Calculate Monday-based week range
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 }); // Monday = 1
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });

  // Get bookings for the week
  const { bookings: weekBookings, isLoading } = useStudioBookings(weekStart, weekEnd);

  // Get weather forecast
  const { data: forecast } = useWeatherForecast();

  // Generate week days (Monday to Sunday)
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const day = addDays(weekStart, i);
    return {
      date: day,
      dayName: format(day, 'EEE'),
      dayNumber: format(day, 'd'),
      fullDate: format(day, 'yyyy-MM-dd')
    };
  });

  // Time slots for the timeline (6 AM to 11 PM)
  const timeSlots = Array.from({ length: 18 }, (_, i) => {
    const hour = i + 6; // Start from 6 AM
    const hour24 = hour;
    const hour12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    const ampm = hour >= 12 ? 'PM' : 'AM';
    return {
      hour24,
      label: `${hour12}${ampm}`,
      time: `${hour.toString().padStart(2, '0')}:00`
    };
  });

  // Get PCR room name
  const getPcrRoomName = (pcrRoomId: number | null) => {
    if (!pcrRoomId) return null;
    const room = pcrRooms.find(r => r.id === pcrRoomId);
    return room ? room.name : `PCR ${pcrRoomId}`;
  };

  // Get booking studios
  const getBookingStudios = (bookingId: number) => {
    const links = bookingStudioLinks.filter(link => link.bookingId === bookingId);
    return links.map(link => {
      const studio = studios.find(s => s.id === link.studioId);
      return studio ? studio.name : `Studio ${link.studioId}`;
    });
  };

  // Calculate booking position and style
  const getBookingStyle = (booking: Booking, column: number, totalColumns: number) => {
    const startTime = new Date(parseISO(booking.start).toLocaleString("en-US", { timeZone: getFacilityTimezone_Dynamic() }));
    const endTime = new Date(parseISO(booking.end).toLocaleString("en-US", { timeZone: getFacilityTimezone_Dynamic() }));
    
    const startHour = startTime.getHours();
    const startMinutes = startTime.getMinutes();
    const endHour = endTime.getHours();
    const endMinutes = endTime.getMinutes();
    
    const startOffset = Math.max(0, (startHour - 6) * 60 + startMinutes);
    const endOffset = Math.min(18 * 60, (endHour - 6) * 60 + endMinutes);
    const duration = endOffset - startOffset;
    
    const top = (startOffset / 60) * 60; // 60px per hour
    const height = Math.max(20, (duration / 60) * 60);
    
    const width = `calc(${100 / totalColumns}% - 4px)`;
    const left = `calc(${(column * 100) / totalColumns}% + 2px)`;
    
    return {
      position: 'absolute' as const,
      top: `${top}px`,
      height: `${height}px`,
      width,
      left,
      backgroundColor: booking.color || '#3B82F6',
      border: '1px solid rgba(0,0,0,0.1)',
      borderRadius: '6px'
    };
  };

  // Arrange overlapping bookings in columns
  const arrangeBookingsInColumns = (bookings: Booking[]) => {
    const sortedBookings = [...bookings].sort((a, b) => 
      new Date(a.start).getTime() - new Date(b.start).getTime()
    );
    
    const columns: Booking[][] = [];
    
    for (const booking of sortedBookings) {
      const bookingStart = new Date(booking.start);
      const bookingEnd = new Date(booking.end);
      
      let placed = false;
      for (let i = 0; i < columns.length; i++) {
        const column = columns[i];
        const lastBookingInColumn = column[column.length - 1];
        
        if (new Date(lastBookingInColumn.end) <= bookingStart) {
          column.push(booking);
          placed = true;
          break;
        }
      }
      
      if (!placed) {
        columns.push([booking]);
      }
    }
    
    return sortedBookings.map(booking => {
      const columnIndex = columns.findIndex(column => column.includes(booking));
      return {
        booking,
        column: columnIndex,
        totalColumns: columns.length
      };
    });
  };

  // Get severity styling for alerts/maintenance
  const getSeverityStyle = (booking: Booking) => {
    if (!booking.severity || !['maintenance', 'all_day_maintenance'].some(type => booking.type.includes(type))) {
      return null;
    }
    
    switch (booking.severity) {
      case 'low':
        return {
          backgroundColor: '#10b981',
          borderColor: '#059669',
          color: '#ffffff',
          pattern: null
        };
      case 'medium':
        return {
          backgroundColor: '#f59e0b',
          borderColor: '#d97706',
          color: '#ffffff',
          pattern: null
        };
      case 'high':
        return {
          backgroundColor: '#ef4444',
          borderColor: '#dc2626',
          color: '#ffffff',
          pattern: 'diagonal-stripes'
        };
      case 'critical':
        return {
          backgroundColor: '#991b1b',
          borderColor: '#7f1d1d',
          color: '#ffffff',
          pattern: 'diagonal-stripes'
        };
      default:
        return null;
    }
  };

  // Current time indicator
  const getCurrentTimePosition = () => {
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: getFacilityTimezone_Dynamic() }));
    const currentHour = now.getHours();
    const currentMinutes = now.getMinutes();
    
    if (currentHour < 6 || currentHour >= 24) return -1;
    
    const minutesFromStart = (currentHour - 6) * 60 + currentMinutes;
    return minutesFromStart; // 1 pixel per minute
  };

  // Check if we should show current time indicator
  const shouldShowCurrentTimeIndicator = () => {
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: getFacilityTimezone_Dynamic() }));
    const currentHour = now.getHours();
    return currentHour >= 6 && currentHour < 24;
  };

  const currentTime = new Date(new Date().toLocaleString("en-US", { timeZone: getFacilityTimezone_Dynamic() }));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="flex flex-col h-full bg-white">
        {/* Calendar Grid */}
        <div className="flex-1 overflow-hidden">
          <div className="h-full overflow-auto">
            <div className="min-w-[1000px]">
              {/* Day Headers */}
              <div className="sticky top-0 bg-white border-b border-gray-200 z-40 shadow-sm">
                <div className="flex">
                  {/* Time column header */}
                  <div className="w-16 border-r border-gray-200 bg-gray-50"></div>
                  
                  {/* Day headers */}
                  {weekDays.map((day) => {
                    const today = new Date(new Date().toLocaleString("en-US", { timeZone: getFacilityTimezone_Dynamic() }));
                    const isToday = isSameDay(day.date, today);
                    
                    return (
                      <div
                        key={day.fullDate}
                        className={`flex-1 min-w-[140px] border-r border-gray-200 relative ${
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
                    const dayBookings = weekBookings.filter(booking => {
                      const bookingStartDate = new Date(parseISO(booking.start).toLocaleString("en-US", { timeZone: getFacilityTimezone_Dynamic() }));
                      const bookingEndDate = new Date(parseISO(booking.end).toLocaleString("en-US", { timeZone: getFacilityTimezone_Dynamic() }));
                      
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
                        className="flex-1 min-w-[140px] border-r border-gray-200 relative"
                      >
                        {/* Hour grid lines */}
                        {timeSlots.map((slot) => (
                          <div
                            key={slot.hour24}
                            className="h-[60px] border-b border-gray-100"
                          />
                        ))}

                        {/* Current time indicator line */}
                        {shouldShowCurrentTimeIndicator() && isSameDay(day.date, new Date(new Date().toLocaleString("en-US", { timeZone: getFacilityTimezone_Dynamic() }))) && (
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
                          // Remove backgroundColor from main container - we'll apply it to header/body separately
                          const { backgroundColor, ...styleWithoutBg } = style;
                          const finalStyle = {
                            ...styleWithoutBg,
                            marginLeft: '2px',
                            marginRight: '2px'
                          };

                          return (
                            <Tooltip key={booking.id}>
                              <TooltipTrigger asChild>
                                <div
                                  className="absolute rounded text-sm cursor-pointer hover:shadow-[0_20px_40px_rgba(0,0,0,0.4)] transition-all duration-200 z-20 overflow-hidden flex flex-col shadow-lg"
                                  style={{
                                    ...styleWithoutBg,
                                    marginLeft: '2px',
                                    marginRight: '2px',
                                    boxShadow: '0 8px 25px rgba(0, 0, 0, 0.3), 0 4px 12px rgba(0, 0, 0, 0.2)'
                                  }}
                                >
                                  {/* Solid Header with All Booking Details */}
                                  <div 
                                    className={`p-2 ${severityStyle ? 'font-semibold' : 'text-white'} ${
                                      severityStyle && severityStyle.pattern === 'diagonal-stripes' ? 'bg-stripe-pattern' : ''
                                    }`}
                                    style={{
                                      backgroundColor: severityStyle ? severityStyle.backgroundColor : (booking.color || '#3B82F6'),
                                      border: severityStyle ? `2px solid ${severityStyle.borderColor}` : style.border,
                                      color: severityStyle ? severityStyle.color : '#ffffff',
                                      textShadow: severityStyle ? '1px 1px 2px rgba(0,0,0,0.8)' : '1px 1px 2px rgba(0,0,0,0.7)',
                                      borderRadius: '6px 6px 0 0'
                                    }}
                                  >
                                    <div className="space-y-1">
                                      {/* Title with severity badge */}
                                      <div className="font-bold text-base leading-tight">
                                        {severityStyle && (
                                          <span className="text-xs px-1 py-0.5 rounded bg-black bg-opacity-20 font-bold mr-1">
                                            ⚠ {booking.severity?.toUpperCase()}
                                          </span>
                                        )}
                                        <span className="break-words">{booking.title}</span>
                                      </div>
                                      
                                      {/* Time */}
                                      <div className="font-bold text-sm">
                                        {format(new Date(parseISO(booking.start).toLocaleString("en-US", { timeZone: getFacilityTimezone_Dynamic() })), 'h:mm a')} - {format(new Date(parseISO(booking.end).toLocaleString("en-US", { timeZone: getFacilityTimezone_Dynamic() })), 'h:mm a')}
                                      </div>
                                      
                                      {/* Studios */}
                                      {studios.length > 0 && (
                                        <div className="text-sm font-medium">
                                          {studios.join(', ')}
                                        </div>
                                      )}
                                      
                                      {/* PCR Room */}
                                      {pcrRoom && (
                                        <div className="text-sm font-medium">
                                          {pcrRoom}
                                        </div>
                                      )}
                                      
                                      {/* Description (truncated) */}
                                      {booking.description && (
                                        <div className="text-xs leading-tight opacity-90">
                                          {booking.description.length > 80 
                                            ? `${booking.description.substring(0, 80)}...` 
                                            : booking.description}
                                        </div>
                                      )}
                                      
                                      {/* Status if not confirmed */}
                                      {booking.status && booking.status !== 'confirmed' && (
                                        <div className="text-xs font-bold uppercase">
                                          {booking.status}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  
                                  {/* Transparent Body - Minimal space for visual balance */}
                                  <div 
                                    className="relative flex-1"
                                    style={{
                                      border: severityStyle ? `2px solid ${severityStyle.borderColor}` : style.border,
                                      borderTop: 'none',
                                      borderRadius: '0 0 6px 6px',
                                      minHeight: '20px' // Just enough for visual balance
                                    }}
                                  >
                                    {/* Transparent background layer */}
                                    <div 
                                      className="absolute inset-0 opacity-30"
                                      style={{
                                        backgroundColor: severityStyle 
                                          ? severityStyle.backgroundColor 
                                          : (booking.color || '#3B82F6'),
                                        borderRadius: '0 0 6px 6px'
                                      }}
                                    ></div>
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
                                    <strong>Time:</strong> {format(new Date(parseISO(booking.start).toLocaleString("en-US", { timeZone: getFacilityTimezone_Dynamic() })), 'MMM d, yyyy h:mm a')} - {format(new Date(parseISO(booking.end).toLocaleString("en-US", { timeZone: getFacilityTimezone_Dynamic() })), 'h:mm a')}
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