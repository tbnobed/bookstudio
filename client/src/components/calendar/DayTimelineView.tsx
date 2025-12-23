import { useMemo, useRef, useEffect, useState } from 'react';
import { parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { formatTime, isSameDay } from '@/lib/dateUtils';
import { getFacilityTimezone } from '@/lib/timezoneConfig';
import { toZonedTime } from 'date-fns-tz';
import { useQuery } from "@tanstack/react-query";
import { useBookingStudioLinks } from "@/hooks/useBookingStudioLinks";
import { useNotificationGroups } from "@/hooks/useNotificationGroups";
import { 
  HoverCard,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { BookingHoverCard } from "@/components/booking/BookingHoverCard";

interface DayTimelineViewProps {
  date: Date;
  bookings: any[];
  studios: any[];
  pcrRooms: any[];
  onBookingClick: (booking: any) => void;
  readOnly?: boolean;
}

const HOUR_WIDTH = 120;
const ROW_HEIGHT = 56;
const HEADER_HEIGHT = 50;
const LEFT_PADDING = 0;

export default function DayTimelineView({
  date,
  bookings,
  studios,
  pcrRooms,
  onBookingClick,
  readOnly = false,
}: DayTimelineViewProps) {
  const { data: bookingStudios = [] } = useBookingStudioLinks();
  const { notificationGroups } = useNotificationGroups();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  
  const hours = Array.from({ length: 24 }, (_, i) => i);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (scrollContainerRef.current) {
      const now = new Date();
      const facilityTimezone = getFacilityTimezone();
      const facilityNow = toZonedTime(now, facilityTimezone);
      const currentHour = facilityNow.getHours();
      const scrollPosition = Math.max(0, (currentHour - 2) * HOUR_WIDTH);
      scrollContainerRef.current.scrollLeft = scrollPosition;
    }
  }, []);

  const dayBookings = useMemo(() => {
    return bookings.filter(booking => {
      const isAlert = booking.type === 'maintenance' || 
                      booking.type === 'all_day_maintenance' ||
                      booking.type === 'site_alert' ||
                      booking.type === 'alert' ||
                      booking.severity != null;
      if (isAlert) return false;
      return isSameDay(booking.start, date);
    });
  }, [bookings, date]);

  const { data: allAlerts = [] } = useQuery<any[]>({
    queryKey: ['/api/alerts'],
  });

  const dayAlerts = useMemo(() => {
    if (!allAlerts || allAlerts.length === 0) return [];
    return allAlerts.filter(alert => {
      const alertStart = parseISO(alert.start);
      const alertEnd = parseISO(alert.end);
      const facilityTimezone = getFacilityTimezone();
      const alertStartInFacility = toZonedTime(alertStart, facilityTimezone);
      const alertEndInFacility = toZonedTime(alertEnd, facilityTimezone);
      const alertStartDate = new Date(alertStartInFacility);
      alertStartDate.setHours(0, 0, 0, 0);
      const alertEndDate = new Date(alertEndInFacility);
      alertEndDate.setHours(0, 0, 0, 0);
      const currentDay = new Date(date);
      currentDay.setHours(0, 0, 0, 0);
      return currentDay.getTime() >= alertStartDate.getTime() && 
             currentDay.getTime() <= alertEndDate.getTime();
    });
  }, [allAlerts, date]);

  const getBookingColor = (booking: any) => {
    if (booking.color) return booking.color;
    switch (booking.type) {
      case 'production': return '#3b82f6';
      case 'rehearsal': return '#8b5cf6';
      case 'maintenance': return '#f59e0b';
      case 'it_support': return '#ef4444';
      case 'live': return '#ef4444';
      default: return '#22c55e';
    }
  };

  const getBookingPosition = (booking: any) => {
    const facilityTimezone = getFacilityTimezone();
    const start = typeof booking.start === 'string' ? parseISO(booking.start) : booking.start;
    const end = typeof booking.end === 'string' ? parseISO(booking.end) : booking.end;
    const startInFacility = toZonedTime(start, facilityTimezone);
    const endInFacility = toZonedTime(end, facilityTimezone);
    
    const startHours = startInFacility.getHours() + startInFacility.getMinutes() / 60;
    const endHours = endInFacility.getHours() + endInFacility.getMinutes() / 60;
    
    const left = startHours * HOUR_WIDTH;
    const width = Math.max((endHours - startHours) * HOUR_WIDTH, 60);
    
    return { left, width };
  };

  const getNowPosition = () => {
    const facilityTimezone = getFacilityTimezone();
    const facilityNow = toZonedTime(currentTime, facilityTimezone);
    const isToday = isSameDay(facilityNow, date);
    if (!isToday) return null;
    const hours = facilityNow.getHours() + facilityNow.getMinutes() / 60;
    return hours * HOUR_WIDTH;
  };

  const getStudioName = (studioId: number | null) => {
    if (!studioId) return null;
    const studio = studios.find(s => s.id === studioId);
    return studio?.name || null;
  };

  const getBookingStudios = (bookingId: number) => {
    const links = bookingStudios.filter((bs: any) => bs.bookingId === bookingId);
    return links.map((link: any) => {
      const studio = studios.find(s => s.id === link.studioId);
      return studio?.name || `Studio ${link.studioId}`;
    });
  };

  const nowPosition = getNowPosition();
  const totalWidth = 24 * HOUR_WIDTH;

  return (
    <div className="h-full flex flex-col bg-gray-900">
      <div className="p-4 border-b border-gray-700">
        <h2 className="text-xl font-semibold text-white">TODAY</h2>
      </div>
      
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-x-auto overflow-y-auto"
      >
        <div style={{ width: totalWidth, minHeight: '100%' }} className="relative">
          <div 
            className="sticky top-0 z-20 bg-gray-800 border-b border-gray-700 flex"
            style={{ height: HEADER_HEIGHT }}
          >
            {hours.map((hour) => (
              <div 
                key={hour} 
                className="flex-shrink-0 border-r border-gray-700 flex items-end justify-start pb-2 pl-2"
                style={{ width: HOUR_WIDTH }}
              >
                <span className="text-sm text-gray-400 font-medium">
                  {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
                </span>
              </div>
            ))}
          </div>

          <div className="relative" style={{ minHeight: `calc(100% - ${HEADER_HEIGHT}px)` }}>
            <div className="absolute inset-0 flex">
              {hours.map((hour) => (
                <div 
                  key={hour} 
                  className="flex-shrink-0 border-r border-gray-800"
                  style={{ width: HOUR_WIDTH }}
                />
              ))}
            </div>

            {nowPosition !== null && (
              <div 
                className="absolute z-30 flex flex-col items-center"
                style={{ 
                  left: nowPosition,
                  top: 0,
                  bottom: 0,
                  transform: 'translateX(-50%)'
                }}
              >
                <div className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-md shadow-lg">
                  NOW
                </div>
                <div className="w-0.5 bg-red-500 flex-1 mt-1" />
                <div className="w-3 h-3 rounded-full bg-red-500 -mt-1" />
              </div>
            )}

            <div className="relative pt-4 pb-8">
              {dayAlerts.length > 0 && (
                <div className="mb-4 px-2">
                  {dayAlerts.map((alert, index) => {
                    const { left, width } = getBookingPosition(alert);
                    return (
                      <div
                        key={`alert-${alert.id}`}
                        className="absolute cursor-pointer rounded-md px-3 py-2 text-white font-medium shadow-lg hover:brightness-110 transition-all"
                        style={{
                          left,
                          width,
                          top: index * (ROW_HEIGHT + 8) + 16,
                          height: ROW_HEIGHT,
                          backgroundColor: '#f59e0b',
                        }}
                        onClick={() => !readOnly && onBookingClick(alert)}
                      >
                        <div className="text-sm font-semibold truncate uppercase">
                          {alert.alertType || 'ALERT'}: {alert.title}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {dayBookings.map((booking, index) => {
                const { left, width } = getBookingPosition(booking);
                const color = getBookingColor(booking);
                const studioNames = getBookingStudios(booking.id);
                const primaryStudio = getStudioName(booking.studioId);
                const displayStudios = studioNames.length > 0 ? studioNames : (primaryStudio ? [primaryStudio] : []);
                const topOffset = (dayAlerts.length * (ROW_HEIGHT + 8)) + (index * (ROW_HEIGHT + 8)) + 16;
                
                return (
                  <HoverCard key={booking.id} openDelay={200} closeDelay={100}>
                    <HoverCardTrigger asChild>
                      <div
                        className="absolute cursor-pointer rounded-md px-3 py-2 text-white shadow-lg hover:brightness-110 transition-all"
                        style={{
                          left,
                          width,
                          top: topOffset,
                          height: ROW_HEIGHT,
                          backgroundColor: color,
                        }}
                        onClick={() => !readOnly && onBookingClick(booking)}
                        data-testid={`booking-bar-${booking.id}`}
                      >
                        <div className="text-sm font-semibold truncate">
                          {booking.type === 'live' && 'LIVE: '}{booking.title}
                        </div>
                        <div className="text-xs opacity-90 truncate">
                          {displayStudios.length > 0 && displayStudios.join(', ')}
                          {displayStudios.length > 0 && ' • '}
                          {formatTime(booking.start)} - {formatTime(booking.end)}
                        </div>
                      </div>
                    </HoverCardTrigger>
                    <BookingHoverCard 
                      booking={booking} 
                      notificationGroups={notificationGroups}
                      bookingStudioLinks={bookingStudios}
                    />
                  </HoverCard>
                );
              })}

              {dayBookings.length === 0 && dayAlerts.length === 0 && (
                <div className="flex items-center justify-center h-48 text-gray-500">
                  <p>No bookings for this day. Click and drag to create a booking.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
