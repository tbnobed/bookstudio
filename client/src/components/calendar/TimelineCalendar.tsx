import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Studio, Booking, PcrRoom, Alert, BookingStudio } from "@shared/schema";
import { useStudioBookings } from "@/hooks/useStudioBookings";
import { format, parseISO, isSameDay, isWithinInterval, startOfWeek, endOfWeek, addDays } from "date-fns";
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
  const { forecast } = useWeatherForecast();

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

  // Calculate booking position and size
  const getBookingStyle = (booking: any) => {
    const startTime = parseISO(booking.start);
    const endTime = parseISO(booking.end);
    
    const startHour = startTime.getHours();
    const startMinutes = startTime.getMinutes();
    const endHour = endTime.getHours();
    const endMinutes = endTime.getMinutes();
    
    const startOffset = Math.max(0, (startHour - 6) * 60 + startMinutes);
    const endOffset = Math.min(18 * 60, (endHour - 6) * 60 + endMinutes);
    const duration = endOffset - startOffset;
    
    const top = (startOffset / 60) * 60; // 60px per hour
    const height = Math.max(20, (duration / 60) * 60);
    
    return {
      top: `${top}px`,
      height: `${height}px`
    };
  };

  // Get booking studios
  const getBookingStudios = (bookingId: number) => {
    return bookingStudioLinks
      .filter(link => link.bookingId === bookingId)
      .map(link => studios.find(studio => studio.id === link.studioId))
      .filter(Boolean);
  };

  // Generate booking color based on type or status
  const getBookingColor = (booking: any) => {
    if (booking.color) {
      return booking.color;
    }
    
    // Default colors based on type
    const typeColors: Record<string, string> = {
      'meeting': '#3b82f6',
      'production': '#10b981',
      'maintenance': '#f59e0b',
      'rehearsal': '#8b5cf6',
      'live': '#ef4444',
      'recording': '#06b6d4'
    };
    
    return typeColors[booking.type?.toLowerCase()] || '#6b7280';
  };

  // Get severity styling for maintenance bookings
  const getSeverityStyle = (booking: any) => {
    if (!booking.severity || (!booking.type?.includes('maintenance') && booking.type !== 'all-day:maintenance')) {
      return null;
    }

    const severityStyles = {
      low: {
        backgroundColor: '#FEF3C7',
        borderColor: '#F59E0B',
        color: '#92400E',
        pattern: null
      },
      medium: {
        backgroundColor: '#FED7AA',
        borderColor: '#EA580C',
        color: '#9A3412',
        pattern: 'diagonal-stripes'
      },
      high: {
        backgroundColor: '#FECACA',
        borderColor: '#DC2626',
        color: '#991B1B',
        pattern: 'diagonal-stripes'
      },
      critical: {
        backgroundColor: '#FCA5A5',
        borderColor: '#B91C1C',
        color: '#7F1D1D',
        pattern: 'crosshatch'
      }
    };

    return severityStyles[booking.severity as keyof typeof severityStyles] || severityStyles.medium;
  };

  // Get maintenance severity styling
  const getMaintenanceSeverityStyle = (booking: any) => {
    if (!booking.severity) return null;
    
    switch (booking.severity) {
      case 'low':
        return {
          backgroundColor: '#fef3c7',
          borderColor: '#f59e0b',
          color: '#92400e',
          pattern: null
        };
      case 'medium':
        return {
          backgroundColor: '#fed7aa',
          borderColor: '#ea580c',
          color: '#9a3412',
          pattern: 'diagonal-stripes'
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
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinutes = now.getMinutes();
    
    if (currentHour < 6 || currentHour >= 24) return -1;
    
    const minutesFromStart = (currentHour - 6) * 60 + currentMinutes;
    return minutesFromStart; // 1 pixel per minute
  };

  // Check if we should show current time indicator
  const shouldShowCurrentTimeIndicator = () => {
    const now = new Date();
    const currentHour = now.getHours();
    return currentHour >= 6 && currentHour < 24;
  };

  const currentTime = new Date();

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
                    const today = new Date();
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
                              forecast={forecast?.forecast.find((f: any) => f.date === day.fullDate) || null} 
                              size="small"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Timeline Body */}
              <div className="relative">
                <div className="flex">
                  {/* Time labels column */}
                  <div className="w-16 border-r border-gray-200 bg-gray-50">
                    {timeSlots.map((slot) => (
                      <div
                        key={slot.hour24}
                        className="h-[60px] border-b border-gray-100 flex items-start justify-center pt-1"
                      >
                        <span className="text-xs font-medium text-gray-600">
                          {slot.label}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Day columns */}
                  {weekDays.map((day) => {
                    const dayBookings = weekBookings.filter(booking => {
                      const bookingStartDate = parseISO(booking.start);
                      const bookingEndDate = parseISO(booking.end);
                      
                      // Only show booking on the day it starts, unless it truly spans multiple days
                      return isSameDay(bookingStartDate, day.date) || 
                             (isWithinInterval(day.date, { start: bookingStartDate, end: bookingEndDate }) && 
                              !isSameDay(bookingStartDate, bookingEndDate));
                    });

                    return (
                      <div
                        key={day.fullDate}
                        className="flex-1 min-w-[140px] border-r border-gray-200 relative"
                        style={{ height: `${18 * 60}px` }} // 18 hours * 60px per hour
                      >
                        {/* Hour lines */}
                        {timeSlots.map((slot) => (
                          <div
                            key={slot.hour24}
                            className="h-[60px] border-b border-gray-100"
                          />
                        ))}

                        {/* Current time indicator line */}
                        {shouldShowCurrentTimeIndicator() && isSameDay(day.date, new Date()) && (
                          <div
                            className="absolute left-0 right-0 z-30 pointer-events-none"
                            style={{
                              top: `${getCurrentTimePosition()}px`,
                              height: '2px',
                              backgroundColor: '#ef4444',
                              boxShadow: '0 0 4px rgba(239, 68, 68, 0.6)',
                            }}
                          >
                            {/* Time label */}
                            <div
                              className="absolute left-4 -top-5 px-2 py-1 bg-red-500 text-white text-xs font-bold rounded shadow-lg whitespace-nowrap z-50"
                            >
                              {format(currentTime, 'h:mm a')}
                            </div>
                          </div>
                        )}

                        {/* Bookings */}
                        {dayBookings.map((booking, index) => {
                          const style = getBookingStyle(booking);
                          const bookingStudios = getBookingStudios(booking.id);
                          const severityStyle = getSeverityStyle(booking);
                          const maintenanceStyle = getMaintenanceSeverityStyle(booking);
                          const finalStyle = severityStyle || maintenanceStyle;
                          
                          return (
                            <Tooltip key={booking.id}>
                              <TooltipTrigger asChild>
                                <div
                                  className="absolute left-1 right-1 rounded px-2 py-1 text-xs cursor-pointer hover:shadow-lg transition-shadow z-20"
                                  style={{
                                    ...style,
                                    backgroundColor: finalStyle?.backgroundColor || getBookingColor(booking),
                                    borderLeft: `3px solid ${finalStyle?.borderColor || getBookingColor(booking)}`,
                                    color: finalStyle?.color || 'white',
                                  }}
                                >
                                  <div className="font-semibold truncate">
                                    {booking.title}
                                  </div>
                                  <div className="text-xs opacity-90 truncate">
                                    {format(parseISO(booking.start), 'h:mm a')} - {format(parseISO(booking.end), 'h:mm a')}
                                  </div>
                                  {bookingStudios.length > 0 && (
                                    <div className="text-xs opacity-80 truncate">
                                      {bookingStudios.map(studio => studio?.name).join(', ')}
                                    </div>
                                  )}
                                  {getPcrRoomName(booking.pcrRoomId) && (
                                    <div className="text-xs opacity-80 truncate">
                                      {getPcrRoomName(booking.pcrRoomId)}
                                    </div>
                                  )}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <div className="max-w-xs">
                                  <div className="font-semibold">{booking.title}</div>
                                  {booking.description && (
                                    <div className="text-sm mt-1">{booking.description}</div>
                                  )}
                                  <div className="text-sm mt-1">
                                    {format(parseISO(booking.start), 'MMM d, h:mm a')} - {format(parseISO(booking.end), 'MMM d, h:mm a')}
                                  </div>
                                  {bookingStudios.length > 0 && (
                                    <div className="text-sm mt-1">
                                      Studios: {bookingStudios.map(studio => studio?.name).join(', ')}
                                    </div>
                                  )}
                                  {getPcrRoomName(booking.pcrRoomId) && (
                                    <div className="text-sm mt-1">
                                      PCR: {getPcrRoomName(booking.pcrRoomId)}
                                    </div>
                                  )}
                                  {booking.status && (
                                    <div className="text-sm mt-1">
                                      Status: {booking.status}
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