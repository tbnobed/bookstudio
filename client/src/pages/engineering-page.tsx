import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfWeek, addDays, addWeeks, subWeeks, isSameDay, parseISO } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { ChevronLeft, ChevronRight, Settings, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const FACILITY_TIMEZONE = "America/Chicago";

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

  // Generate time slots (6 AM to 11 PM)
  const timeSlots = Array.from({ length: 17 }, (_, i) => {
    const hour = i + 6;
    const time12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    const ampm = hour >= 12 ? 'PM' : 'AM';
    return {
      hour24: hour,
      label: `${time12} ${ampm}`,
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

  // Helper function to calculate booking position and height
  const getBookingStyle = (booking: BookingData) => {
    const startTime = toZonedTime(parseISO(booking.start), FACILITY_TIMEZONE);
    const endTime = toZonedTime(parseISO(booking.end), FACILITY_TIMEZONE);
    
    const startHour = startTime.getHours() + startTime.getMinutes() / 60;
    const endHour = endTime.getHours() + endTime.getMinutes() / 60;
    
    // Calculate position relative to 6 AM start
    const topPosition = Math.max(0, (startHour - 6) * 60); // 60px per hour
    const height = Math.max(30, (endHour - startHour) * 60); // Minimum 30px height
    
    return {
      top: `${topPosition}px`,
      height: `${height}px`,
      backgroundColor: booking.color || '#3B82F6',
      opacity: booking.status === 'cancelled' ? 0.5 : 1,
      border: booking.status === 'tentative' ? '2px dashed #666' : 'none'
    };
  };

  // Filter bookings for current week
  const weekBookings = bookings.filter(booking => {
    const bookingDate = toZonedTime(parseISO(booking.start), FACILITY_TIMEZONE);
    const weekStart = currentWeek;
    const weekEnd = addDays(currentWeek, 6);
    return bookingDate >= weekStart && bookingDate <= weekEnd;
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

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold text-gray-900">Engineering Schedule</h1>
            <Badge variant="outline" className="bg-blue-50 text-blue-700">
              Google Calendar Style View
            </Badge>
          </div>
          
          <div className="flex items-center space-x-3">
            <Button
              variant="outline"
              size="sm"
              onClick={goToCurrentWeek}
              className="flex items-center space-x-1"
            >
              <Calendar className="w-4 h-4" />
              <span>Today</span>
            </Button>
            
            <div className="flex items-center border rounded-lg">
              <Button
                variant="ghost"
                size="sm"
                onClick={goToPreviousWeek}
                className="border-none rounded-r-none"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              
              <div className="px-4 py-2 border-l border-r text-sm font-medium min-w-[200px] text-center">
                {format(currentWeek, 'MMM d')} - {format(addDays(currentWeek, 6), 'MMM d, yyyy')}
              </div>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={goToNextWeek}
                className="border-none rounded-l-none"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
            
            <Button variant="outline" size="sm">
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

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
                  const isToday = isSameDay(day.date, utcToZonedTime(new Date(), FACILITY_TIMEZONE));
                  
                  return (
                    <div
                      key={day.fullDate}
                      className={`flex-1 min-w-[140px] p-3 text-center border-r border-gray-200 ${
                        isToday ? 'bg-blue-50' : 'bg-white'
                      }`}
                    >
                      <div className="text-xs font-medium text-gray-500 mb-1">
                        {day.dayName}
                      </div>
                      <div className={`text-lg font-semibold ${
                        isToday ? 'text-blue-600' : 'text-gray-900'
                      }`}>
                        {day.dayNumber}
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
                    const bookingDate = utcToZonedTime(parseISO(booking.start), FACILITY_TIMEZONE);
                    return isSameDay(bookingDate, day.date);
                  });

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

                      {/* Bookings */}
                      {dayBookings.map((booking) => {
                        const style = getBookingStyle(booking);
                        const studios = getBookingStudios(booking.id);
                        const pcrRoom = getPcrRoomName(booking.pcrRoomId);

                        return (
                          <div
                            key={booking.id}
                            className="absolute left-1 right-1 rounded text-white text-xs p-1 cursor-pointer hover:shadow-lg transition-shadow z-20 overflow-hidden"
                            style={style}
                          >
                            <div className="font-semibold truncate">
                              {booking.title}
                            </div>
                            
                            {studios.length > 0 && (
                              <div className="truncate text-xs opacity-90">
                                {studios.join(', ')}
                              </div>
                            )}
                            
                            {pcrRoom && (
                              <div className="truncate text-xs opacity-90">
                                {pcrRoom}
                              </div>
                            )}
                            
                            <div className="text-xs opacity-75">
                              {format(utcToZonedTime(parseISO(booking.start), FACILITY_TIMEZONE), 'h:mm a')} - 
                              {format(utcToZonedTime(parseISO(booking.end), FACILITY_TIMEZONE), 'h:mm a')}
                            </div>

                            {booking.status && booking.status !== 'confirmed' && (
                              <div className="text-xs opacity-90 font-medium">
                                {booking.status.toUpperCase()}
                              </div>
                            )}
                          </div>
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
  );
}