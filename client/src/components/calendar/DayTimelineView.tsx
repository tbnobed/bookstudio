import { useMemo, useRef, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { formatTime, isSameDay } from '@/lib/dateUtils';
import { getFacilityTimezone } from '@/lib/timezoneConfig';
import { toZonedTime } from 'date-fns-tz';
import { useQuery } from "@tanstack/react-query";
import { useBookingStudioLinks } from "@/hooks/useBookingStudioLinks";
import { useNotificationGroups } from "@/hooks/useNotificationGroups";
import { calculateStudioStatus } from "@/lib/studioUtils";
import { 
  HoverCard,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { BookingHoverCard } from "@/components/booking/BookingHoverCard";
import { AlertTriangle, Thermometer, MapPin, Zap } from 'lucide-react';

interface DayTimelineViewProps {
  date: Date;
  bookings: any[];
  studios: any[];
  pcrRooms: any[];
  onBookingClick: (booking: any) => void;
  readOnly?: boolean;
}

const HOUR_WIDTH = 120;
const STUDIO_PANEL_WIDTH = 220;
const ROW_HEIGHT = 72;
const HOURS_TO_SHOW = 24;

export default function DayTimelineView({
  date,
  bookings,
  studios,
  pcrRooms,
  onBookingClick,
  readOnly = false,
}: DayTimelineViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const { data: bookingStudioLinks = [] } = useBookingStudioLinks();
  const { notificationGroups } = useNotificationGroups();

  const { data: allAlerts = [] } = useQuery<any[]>({
    queryKey: ['/api/alerts'],
  });

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (containerRef.current) {
      const now = toZonedTime(new Date(), getFacilityTimezone());
      const currentHour = now.getHours();
      const scrollPosition = Math.max(0, (currentHour - 2) * HOUR_WIDTH);
      containerRef.current.scrollLeft = scrollPosition;
    }
  }, [date]);

  const dayBookings = useMemo(() => {
    return bookings.filter(booking => isSameDay(booking.start, date));
  }, [bookings, date]);

  const dayAlerts = useMemo(() => {
    return allAlerts.filter((alert: any) => isSameDay(alert.start, date));
  }, [allAlerts, date]);

  const hours = useMemo(() => {
    return Array.from({ length: HOURS_TO_SHOW }, (_, i) => i);
  }, []);

  const nowPosition = useMemo(() => {
    const now = toZonedTime(currentTime, getFacilityTimezone());
    if (!isSameDay(now, date)) return null;
    const hours = now.getHours();
    const minutes = now.getMinutes();
    return (hours + minutes / 60) * HOUR_WIDTH;
  }, [currentTime, date]);

  const getBookingPosition = (booking: any) => {
    const start = toZonedTime(new Date(booking.start), getFacilityTimezone());
    const end = toZonedTime(new Date(booking.end), getFacilityTimezone());
    const startHour = start.getHours() + start.getMinutes() / 60;
    const endHour = end.getHours() + end.getMinutes() / 60;
    const left = startHour * HOUR_WIDTH;
    const width = (endHour - startHour) * HOUR_WIDTH;
    return { left, width: Math.max(width, 40) };
  };

  const getBookingColor = (booking: any) => {
    if (booking.color) return booking.color;
    switch (booking.type) {
      case 'maintenance':
      case 'all_day_maintenance':
        return '#FBBF24';
      case 'production':
      case 'live':
        return '#F87171';
      case 'rehearsal':
        return '#A78BFA';
      case 'recording':
      case 'podcast':
        return '#34D399';
      default:
        return '#60A5FA';
    }
  };

  const getStudioBookings = (studioId: number) => {
    return dayBookings.filter(booking => {
      const links = bookingStudioLinks.filter((link: any) => link.bookingId === booking.id);
      if (links.length > 0) {
        return links.some((link: any) => link.studioId === studioId);
      }
      return booking.studioId === studioId || booking.studio_id === studioId;
    });
  };

  const getActiveBooking = (studioId: number) => {
    const now = toZonedTime(currentTime, getFacilityTimezone());
    const studioBookings = getStudioBookings(studioId);
    return studioBookings.find(booking => {
      const start = new Date(booking.start);
      const end = new Date(booking.end);
      return now >= start && now <= end;
    });
  };

  const getTimeRemaining = (booking: any) => {
    const now = new Date();
    const end = new Date(booking.end);
    const diff = end.getTime() - now.getTime();
    if (diff <= 0) return null;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes} mins remaining`;
    const hours = Math.floor(minutes / 60);
    const remainingMins = minutes % 60;
    return `${hours}h ${remainingMins}m remaining`;
  };

  const getProgressPercentage = (booking: any) => {
    const now = new Date();
    const start = new Date(booking.start);
    const end = new Date(booking.end);
    const total = end.getTime() - start.getTime();
    const elapsed = now.getTime() - start.getTime();
    return Math.min(100, Math.max(0, (elapsed / total) * 100));
  };

  const getStudioStatus = (studio: any) => {
    return calculateStudioStatus(studio, bookings, date, bookingStudioLinks);
  };

  const getStudioAlerts = (studioId: number) => {
    return dayAlerts.filter((alert: any) => 
      alert.studioId === studioId || alert.studio_id === studioId
    );
  };

  const formatHour = (hour: number) => {
    if (hour === 0) return '12 AM';
    if (hour === 12) return '12 PM';
    if (hour < 12) return `${hour} AM`;
    return `${hour - 12} PM`;
  };

  return (
    <div className="h-full flex flex-col bg-gray-900 text-white">
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div 
          className="flex-shrink-0 bg-gray-900 border-r border-gray-700 z-20"
          style={{ width: STUDIO_PANEL_WIDTH }}
        >
          <div 
            className="sticky top-0 bg-gray-800 border-b border-gray-700 px-3 flex items-center justify-between z-30"
            style={{ height: ROW_HEIGHT }}
          >
            <div className="text-sm text-gray-400">
              <div className="font-medium text-white">Studios</div>
              <div className="text-xs">{studios.length} total</div>
            </div>
          </div>
          
          <div className="overflow-y-auto" style={{ height: `calc(100% - ${ROW_HEIGHT}px)` }}>
            {studios.map((studio) => {
              const status = getStudioStatus(studio);
              const activeBooking = getActiveBooking(studio.id);
              const alerts = getStudioAlerts(studio.id);
              
              return (
                <div
                  key={studio.id}
                  className={cn(
                    "border-b border-gray-700 px-3 py-2",
                    status === 'in-use' && "bg-gray-800/50"
                  )}
                  style={{ height: ROW_HEIGHT }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "w-2 h-2 rounded-full flex-shrink-0",
                          status === 'available' && "bg-emerald-500",
                          status === 'in-use' && "bg-rose-500",
                          status === 'maintenance' && "bg-amber-500"
                        )} />
                        <span className="font-medium text-sm truncate">{studio.name}</span>
                      </div>
                      
                      {activeBooking ? (
                        <div className="mt-1">
                          <div className="text-xs text-rose-400 truncate">
                            {activeBooking.title}
                          </div>
                          <div className="mt-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-rose-500 transition-all duration-1000"
                              style={{ width: `${getProgressPercentage(activeBooking)}%` }}
                            />
                          </div>
                          <div className="text-[10px] text-gray-500 mt-0.5">
                            {getTimeRemaining(activeBooking)}
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-gray-500 mt-1">
                          {status === 'available' ? 'Available' : status === 'maintenance' ? 'Maintenance' : ''}
                        </div>
                      )}
                    </div>
                    
                    {alerts.length > 0 && (
                      <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div 
          ref={containerRef}
          className="flex-1 overflow-auto"
        >
          <div style={{ width: HOURS_TO_SHOW * HOUR_WIDTH, minHeight: '100%' }}>
            <div 
              className="sticky top-0 bg-gray-800 border-b border-gray-700 z-10 flex"
              style={{ height: ROW_HEIGHT }}
            >
              {hours.map((hour) => (
                <div
                  key={hour}
                  className="flex-shrink-0 border-r border-gray-700 flex items-end justify-start px-2 pb-2"
                  style={{ width: HOUR_WIDTH }}
                >
                  <span className="text-sm text-gray-400">{formatHour(hour)}</span>
                </div>
              ))}
            </div>

            <div className="relative">
              {nowPosition !== null && (
                <div 
                  className="absolute top-0 bottom-0 w-0.5 bg-rose-500 z-30"
                  style={{ left: nowPosition }}
                >
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-rose-500 text-white text-xs px-2 py-1 rounded font-medium whitespace-nowrap">
                    NOW
                  </div>
                </div>
              )}

              {studios.map((studio) => {
                const studioBookings = getStudioBookings(studio.id);
                
                return (
                  <div
                    key={studio.id}
                    className="relative border-b border-gray-700"
                    style={{ height: ROW_HEIGHT }}
                  >
                    {hours.map((hour) => (
                      <div
                        key={hour}
                        className={cn(
                          "absolute top-0 bottom-0 border-r border-gray-800",
                          hour % 2 === 0 ? "bg-gray-900" : "bg-gray-900/50"
                        )}
                        style={{ left: hour * HOUR_WIDTH, width: HOUR_WIDTH }}
                      />
                    ))}

                    {studioBookings.map((booking) => {
                      const { left, width } = getBookingPosition(booking);
                      const color = getBookingColor(booking);
                      
                      return (
                        <HoverCard key={booking.id} openDelay={200} closeDelay={100}>
                          <HoverCardTrigger asChild>
                            <div
                              className={cn(
                                "absolute top-2 bottom-2 rounded-md px-3 py-1 cursor-pointer transition-all hover:brightness-110 hover:shadow-lg overflow-hidden z-10",
                                !readOnly && "hover:ring-2 hover:ring-white/30"
                              )}
                              style={{
                                left,
                                width,
                                backgroundColor: color,
                              }}
                              onClick={() => !readOnly && onBookingClick(booking)}
                              data-testid={`booking-bar-${booking.id}`}
                            >
                              <div className="text-sm font-medium text-white truncate">
                                {booking.type?.toUpperCase()}: "{booking.title}"
                              </div>
                              <div className="text-xs text-white/80 truncate">
                                {formatTime(booking.start)} - {formatTime(booking.end)}
                              </div>
                            </div>
                          </HoverCardTrigger>
                          <BookingHoverCard 
                            booking={booking} 
                            notificationGroups={notificationGroups}
                            bookingStudioLinks={bookingStudioLinks}
                          />
                        </HoverCard>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {!readOnly && (
        <div className="flex-shrink-0 bg-gray-800 border-t border-gray-700 px-4 py-2 text-center">
          <span className="text-xs text-gray-400">Click on a booking to edit • Click on empty space to create new</span>
        </div>
      )}
    </div>
  );
}
