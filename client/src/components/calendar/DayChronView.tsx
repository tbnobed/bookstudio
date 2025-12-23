import React, { useMemo } from 'react';
import { format, parseISO, startOfDay, endOfDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { formatTime, isSameDay, formatInFacilityTimezone, isBookingActive } from '@/lib/dateUtils';
import { getFacilityTimezone } from '@/lib/timezoneConfig';
import { toZonedTime } from 'date-fns-tz';
import { Badge } from '@/components/ui/badge';
import WeatherForecastCell from './WeatherForecastCell';
import { useWeatherForecast } from '../../hooks/useWeatherForecast';
import { 
  Tv, 
  Clock, 
  Users, 
  CalendarDays, 
  Bookmark, 
  AlertTriangle,
  User,
  Tag,
  CheckCircle,
  XCircle,
  AlertCircle,
  Camera,
  Video,
  Building,
  Activity,
  MonitorSpeaker,
  BarChart3,
  TrendingUp,
  Settings,
  Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useQuery } from "@tanstack/react-query";
import { useNotificationGroups } from "@/hooks/useNotificationGroups";
import { useBookingStudioLinks } from "@/hooks/useBookingStudioLinks";
import { 
  HoverCard,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { BookingHoverCard } from "@/components/booking/BookingHoverCard";

interface DayChronViewProps {
  date: Date;
  bookings: any[];
  studios: any[];
  pcrRooms: any[];
  onBookingClick: (booking: any) => void;
  readOnly?: boolean;
}

export default function DayChronView({
  date,
  bookings,
  studios,
  pcrRooms,
  onBookingClick,
  readOnly = false,
}: DayChronViewProps) {
  const { notificationGroups } = useNotificationGroups();
  const { data: bookingStudios = [] } = useBookingStudioLinks();
  const { forecast } = useWeatherForecast();
  
  // Debug weather data
  console.log('DayChronView - Weather forecast data:', forecast);
  console.log('DayChronView - Date for weather:', date.toISOString().split('T')[0]);
  console.log('DayChronView - Found forecast for date:', forecast?.forecast.find(f => f.date === date.toISOString().split('T')[0]));

  // Helper function to format time ago
  const formatTimeAgo = (date: Date): string => {
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInHours / 24);
    
    if (diffInHours < 1) {
      const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
      return diffInMinutes < 1 ? 'Just now' : `${diffInMinutes}m ago`;
    } else if (diffInHours < 24) {
      return `${diffInHours}h ago`;
    } else if (diffInDays < 7) {
      return `${diffInDays}d ago`;
    } else {
      return date.toLocaleDateString();
    }
  };
  // Get bookings for the selected day
  const dayBookings = useMemo(() => {
    // First log the incoming date for debugging
    console.log(`DayChronView - Current date: ${date.toISOString()}, Checking ${bookings.length} bookings`);
    
    // Filter bookings for this day
    const filtered = bookings.filter(booking => {
      // Use facility's isSameDay function which handles timezone correctly
      const result = isSameDay(booking.start, date);
      // Log each booking for debugging
      if (result) {
        console.log(`DayChronView - Found matching booking: ${booking.id} - ${booking.title}`);
      }
      return result;
    });
    
    console.log(`DayChronView - Found ${filtered.length} bookings for ${date.toISOString()}`);
    return filtered;
  }, [bookings, date]);

  // Function to determine if a booking should be treated as an alert (legacy bookings only)
  const isAlertBooking = (booking: any) => {
    // Only for legacy bookings that are still in bookings table with alert types
    const isAlertType = booking.type === 'maintenance' || 
                        booking.type === 'all_day_maintenance' ||
                        booking.type === 'site_alert' ||
                        booking.type === 'alert';
    
    // Check if it has severity field (legacy alert bookings)
    const hasSeverity = booking.severity != null && booking.severity !== "";
    
    return isAlertType || hasSeverity;
  };

  // Fetch alerts from the dedicated alerts API
  const { data: allAlerts = [] } = useQuery<any[]>({
    queryKey: ['/api/alerts'],
  });

  // Filter alerts for the current day
  const dayAlerts = useMemo(() => {
    if (!allAlerts || allAlerts.length === 0) return [];
    
    return allAlerts.filter(alert => {
      const alertStart = parseISO(alert.start);
      const alertEnd = parseISO(alert.end);
      
      // Check if alert overlaps with this specific day using facility timezone
      const facilityTimezone = getFacilityTimezone();
      
      // Convert alert times to facility timezone 
      const alertStartInFacility = toZonedTime(alertStart, facilityTimezone);
      const alertEndInFacility = toZonedTime(alertEnd, facilityTimezone);
      
      // Get the date part only for comparison (strip time)
      const alertStartDate = new Date(alertStartInFacility);
      alertStartDate.setHours(0, 0, 0, 0);
      
      const alertEndDate = new Date(alertEndInFacility);
      alertEndDate.setHours(0, 0, 0, 0);
      
      // Get current day date part only
      const currentDay = new Date(date);
      currentDay.setHours(0, 0, 0, 0);
      
      // Alert appears on this day if the day falls between start and end dates (inclusive)
      return currentDay.getTime() >= alertStartDate.getTime() && 
             currentDay.getTime() <= alertEndDate.getTime();
    });
  }, [allAlerts, date]);

  // Combine alerts from both sources (legacy bookings + new alerts API)
  const alerts = useMemo(() => {
    console.log("[DEBUG] All bookings for day:", dayBookings);
    console.log("[DEBUG] All alerts for day:", dayAlerts);
    
    // Legacy alert bookings (still in bookings table)
    const legacyAlertBookings = dayBookings.filter(booking => isAlertBooking(booking));
    console.log("[DEBUG] Legacy alert bookings:", legacyAlertBookings);
    
    // New alerts from dedicated table - convert to display format
    const newAlerts = dayAlerts.map(alert => ({
      ...alert,
      type: alert.alertType, // Convert alertType to type for consistency
      id: `alert-${alert.id}`, // Prefix to avoid ID conflicts
      studioId: null, // Alerts don't have studios
      pcrRoomId: null, // Alerts don't have PCR rooms
    }));
    console.log("[DEBUG] New alerts converted:", newAlerts);
    
    // Combine both sources
    const allAlerts = [...legacyAlertBookings, ...newAlerts];
    console.log("[DEBUG] Combined alerts:", allAlerts);
    
    return allAlerts;
  }, [dayBookings, dayAlerts]);
  
  // Sort regular bookings by start time
  const regularBookings = useMemo(() => {
    const nonAlerts = dayBookings.filter(booking => !isAlertBooking(booking));
    return [...nonAlerts].sort((a, b) => {
      return new Date(a.start).getTime() - new Date(b.start).getTime();
    });
  }, [dayBookings]);

  // Fetch all booking-studio links for multiple studio support
  const { data: bookingStudioLinks = [] } = useQuery<any[]>({
    queryKey: ['/api/public/booking-studios'],
  });



  // Get studio names for a booking (including all linked studios)
  const getStudiosForBooking = (booking: any) => {
    const studioList: typeof studios = [];
    
    // Debug logging
    console.log(`[STUDIO-DEBUG] Getting studios for booking ${booking.id} (${booking.title})`);
    console.log(`[STUDIO-DEBUG] Booking has studioId: ${booking.studioId}`);
    console.log(`[STUDIO-DEBUG] Available booking-studio links: ${bookingStudioLinks.length}`);
    
    // Check direct studio assignment
    if (booking.studioId) {
      const studio = studios.find(s => s.id === booking.studioId);
      if (studio) {
        studioList.push(studio);
        console.log(`[DEBUG] Added direct studio: ${studio.name} (ID: ${studio.id})`);
      }
    }
    
    // Look through bookingStudioLinks for this booking's ID
    const links = bookingStudioLinks.filter((link: any) => link.bookingId === booking.id);
    console.log(`[DEBUG] Found ${links.length} booking-studio links for booking ${booking.id}`);
    if (links && links.length > 0) {
      links.forEach((link: any) => {
        const studio = studios.find(s => s.id === link.studioId);
        if (studio && !studioList.some(s => s.id === studio.id)) {
          studioList.push(studio);
          console.log(`[DEBUG] Added linked studio: ${studio.name} (ID: ${studio.id})`);
        }
      });
    }
    
    console.log(`[DEBUG] Final studio list for booking ${booking.id}: ${studioList.map(s => s.name).join(', ')}`);
    return studioList;
  };

  // Get PCR room for a booking
  const getPcrRoom = (booking: any) => {
    if (!booking.pcrRoomId) return null;
    return pcrRooms.find(pcr => pcr.id === booking.pcrRoomId);
  };

  // Get the background color class based on booking type
  const getTypeClass = (type: string, severity: string = 'normal') => {
    // If it's an alert type (either by type field or determined by title)
    const isAlert = type === 'alert' || (type && type.includes('all-day') && severity === 'critical');
    
    // First check if it's an alert (severity-based color)
    if (isAlert) {
      console.log("[DEBUG] Alert booking with severity:", severity);
      switch (severity) {
        case 'critical':
          return 'bg-red-100 dark:bg-red-900/30';
        case 'high':
          return 'bg-orange-100 dark:bg-orange-900/30';
        case 'medium':
          return 'bg-yellow-100 dark:bg-yellow-900/30';
        case 'low':
          return 'bg-blue-100 dark:bg-blue-900/30';
        default:
          return 'bg-yellow-100 dark:bg-yellow-900/30';
      }
    }
    
    // Otherwise, use regular booking type
    // If type contains a colon, extract the main part
    const mainType = type && type.includes(':') ? type.split(':')[1] : type;
    
    switch (mainType) {
      case 'production':
        return 'bg-blue-50 dark:bg-blue-900/20';
      case 'maintenance':
        return 'bg-amber-50 dark:bg-amber-900/20';
      case 'it_support':
        return 'bg-red-50 dark:bg-red-900/20';
      case 'rehearsal':
        return 'bg-purple-50 dark:bg-purple-900/20';
      default:
        return 'bg-gray-50 dark:bg-gray-800';
    }
  };

  // Format a booking type for display
  const formatBookingType = (type: string = '') => {
    switch (type) {
      case 'production':
        return 'Production';
      case 'maintenance':
        return 'Maintenance';
      case 'it_support':
        return 'IT Support';
      case 'rehearsal':
        return 'Rehearsal';
      case 'alert':
        return 'Alert';
      default:
        return type || 'Unknown';
    }
  };

  // Booking card component - shared between alerts and regular bookings
  const BookingCard = ({ booking }: { booking: any }) => {
    const studiosList = getStudiosForBooking(booking);
    const pcrRoom = getPcrRoom(booking);
    
    // Use our shared function to determine if this is an alert booking
    const isAlert = isAlertBooking(booking);
    
    // Check if booking is cancelled or tentative
    const isCancelled = booking.status === 'cancelled';
    const isTentative = booking.status === 'tentative';
    
    // Check if booking is currently active
    const isActive = isBookingActive(booking);
    
    console.log("[DEBUG] Processing booking:", booking.id, booking.title, "isAlert:", isAlert, "status:", booking.status);
    
    const typeClass = getTypeClass(booking.type, booking.severity);
    
    // Determine left border color
    const bookingColor = booking.color || '#3b82f6';
    const severityColor = isAlert 
      ? (booking.severity === 'critical' ? '#f44336' : 
         booking.severity === 'high' ? '#ff9800' : 
         booking.severity === 'medium' ? '#ffc107' : 
         booking.severity === 'low' ? '#2196f3' : '#ffc107')
      : bookingColor;
    
    return (
      <HoverCard key={booking.id} openDelay={300} closeDelay={100}>
        <HoverCardTrigger asChild>
          <div 
            className={cn(
              "border dark:border-gray-700 rounded-md px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors",
              typeClass,
              isTentative && "border-dashed opacity-80 bg-gray-100 dark:bg-gray-800",
              isCancelled && "opacity-60 bg-gray-100 dark:bg-gray-800",
              isActive && "animate-pulse ring-2 ring-green-400 ring-opacity-75 shadow-lg"
            )}
            style={{
              borderLeftColor: severityColor,
              borderLeftWidth: '4px',
              ...(isTentative ? {
                borderColor: booking.color || "#666"
              } : {})
            }}
            onClick={() => onBookingClick(booking)}
          >
            {/* Header with title and status */}
            <div className="flex justify-between items-start mb-3">
              <div className="flex-1">
                <h3 className={cn("text-base font-bold dark:text-gray-100", isCancelled && "line-through text-gray-500 dark:text-gray-400")}>
                  {booking.title}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  {/* Status indicator with icon */}
                  <div className="flex items-center gap-1">
                    {booking.status === 'confirmed' && <CheckCircle className="h-3 w-3 text-green-600 dark:text-green-400" />}
                    {booking.status === 'tentative' && <AlertCircle className="h-3 w-3 text-yellow-600 dark:text-yellow-400" />}
                    {booking.status === 'cancelled' && <XCircle className="h-3 w-3 text-red-600 dark:text-red-400" />}
                    <span className="text-xs font-medium capitalize text-gray-600 dark:text-gray-400">{booking.status}</span>
                  </div>
                </div>
              </div>
              <div className="ml-2 flex gap-1">
                {isCancelled && (
                  <Badge variant="destructive" className="text-xs">
                    CANCELLED
                  </Badge>
                )}
                <Badge variant={isAlert && booking.severity === 'critical' ? 'destructive' : 'outline'}>
                  {isAlert && booking.severity 
                    ? booking.severity.charAt(0).toUpperCase() + booking.severity.slice(1) 
                    : formatBookingType(booking.type)}
                </Badge>
              </div>
            </div>
            
            {/* Description */}
            {booking.description && (
              <div className="mb-3 text-sm text-gray-600 dark:text-gray-400">
                {booking.description.length > 120 
                  ? `${booking.description.substring(0, 120)}...` 
                  : booking.description}
              </div>
            )}
            
            {/* Main information grid */}
            <div className="grid grid-cols-1 gap-2 text-sm">
              {/* Time */}
              <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                <Clock size={14} className="flex-shrink-0" />
                <span className="font-medium">
                  {formatTime(new Date(booking.start))} - {formatTime(new Date(booking.end))}
                </span>
              </div>
              
              {/* Studios - only show for non-alerts */}
              {!isAlert && studiosList.length > 0 && (
                <div className="flex items-start gap-2 text-gray-700 dark:text-gray-300">
                  <Camera size={14} className="flex-shrink-0 mt-0.5" />
                  <div className="flex flex-wrap gap-1">
                    {studiosList.map(studio => (
                      <Badge 
                        key={studio.id} 
                        variant="secondary" 
                        className="text-xs"
                      >
                        {studio.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              
              {/* PCR room - only show for non-alerts */}
              {!isAlert && pcrRoom && (
                <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                  <Tv size={14} className="flex-shrink-0" />
                  <span className="font-medium">{pcrRoom.name}</span>
                </div>
              )}
              
              {/* Notification Groups */}
              {Array.isArray(booking.notifyList) && booking.notifyList.length > 0 && (
                <div className="flex items-start gap-2 text-gray-700 dark:text-gray-300">
                  <User size={14} className="flex-shrink-0 mt-0.5" />
                  <div className="flex flex-wrap gap-1">
                    {booking.notifyList.slice(0, 3).map((groupId: string | number, i: number) => {
                      const group = notificationGroups.find(g => g.id.toString() === groupId.toString());
                      return (
                        <Badge key={i} variant="outline" className="text-xs">
                          {group ? group.name : `Group ${groupId}`}
                        </Badge>
                      );
                    })}
                    {booking.notifyList.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{booking.notifyList.length - 3} more
                      </Badge>
                    )}
                  </div>
                </div>
              )}
            </div>
            
            {/* Footer with creation date */}
            {booking.createdAt && (
              <div className="mt-3 pt-2 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
                Created {format(new Date(booking.createdAt), 'MMM d, yyyy HH:mm')}
              </div>
            )}
          </div>
        </HoverCardTrigger>
        
        <BookingHoverCard 
          booking={booking} 
          studios={studios}
          pcrRooms={pcrRooms}
          notificationGroups={notificationGroups}
          bookingStudioLinks={bookingStudios}
          onEdit={() => onBookingClick(booking)}
        />
      </HoverCard>
    );
  };

  // Calculate studio utilization for the day
  const studioUtilization = useMemo(() => {
    return studios.map(studio => {
      const studioBookings = regularBookings.filter(booking => {
        // Check both direct studio assignment and multi-studio links
        const hasDirectLink = booking.studioId === studio.id;
        
        // Check multi-studio links via booking-studio junction table
        const hasLinkedAccess = bookingStudios.some(link => 
          link.bookingId === booking.id && link.studioId === studio.id
        );
        
        return hasDirectLink || hasLinkedAccess;
      });
      
      const totalHours = studioBookings.reduce((acc, booking) => {
        const start = new Date(booking.start);
        const end = new Date(booking.end);
        return acc + ((end.getTime() - start.getTime()) / (1000 * 60 * 60));
      }, 0);
      
      const utilizationPercent = Math.min((totalHours / 24) * 100, 100);
      
      return {
        studio,
        bookings: studioBookings.length,
        hours: totalHours,
        utilization: utilizationPercent
      };
    }).sort((a, b) => b.utilization - a.utilization);
  }, [studios, regularBookings, bookingStudios]);

  // Calculate day statistics
  const dayStats = useMemo(() => {
    const totalBookings = regularBookings.length;
    const totalAlerts = alerts.length;
    const confirmedBookings = regularBookings.filter(b => b.status === 'confirmed').length;
    const tentativeBookings = regularBookings.filter(b => b.status === 'tentative').length;
    const cancelledBookings = regularBookings.filter(b => b.status === 'cancelled').length;
    
    return {
      totalBookings,
      totalAlerts,
      confirmedBookings,
      tentativeBookings,
      cancelledBookings,
      activeStudios: studioUtilization.filter(s => s.bookings > 0).length,
      totalStudios: studios.length
    };
  }, [regularBookings, alerts, studioUtilization, studios.length]);

  // Generate time slots for the horizontal timeline (24 hours)
  const timeSlots = Array.from({ length: 24 }, (_, i) => i);
  
  // Helper to calculate booking position and width as percentage of day
  const getBookingStyle = (booking: any) => {
    const startDate = new Date(booking.start);
    const endDate = new Date(booking.end);
    const startHour = startDate.getHours() + startDate.getMinutes() / 60;
    const endHour = endDate.getHours() + endDate.getMinutes() / 60;
    const left = (startHour / 24) * 100;
    const width = ((endHour - startHour) / 24) * 100;
    return { left: `${left}%`, width: `${Math.max(width, 2)}%` };
  };

  // Get bookings for a specific studio
  const getBookingsForStudio = (studioId: number) => {
    return regularBookings.filter(booking => {
      const linkedStudios = bookingStudios.filter(bs => bs.bookingId === booking.id);
      return linkedStudios.some(bs => bs.studioId === studioId);
    });
  };

  // Get booking color based on type
  const getBookingColor = (booking: any) => {
    if (booking.color) return booking.color;
    switch (booking.type) {
      case "maintenance": return "bg-amber-500";
      case "it_support": return "bg-red-500";
      case "rehearsal": return "bg-purple-500";
      case "production": return "bg-blue-500";
      default: return "bg-gray-500";
    }
  };

  return (
    <div className="w-full h-full flex flex-col">
      {/* Header with Date and Weather */}
      <div className="flex-shrink-0 flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold dark:text-white">
            {formatInFacilityTimezone(date, 'EEEE, MMMM d, yyyy')}
          </h2>
          <WeatherForecastCell 
            date={date} 
            forecast={forecast?.forecast.find(f => f.date === date.toISOString().split('T')[0]) || null} 
            size="normal" 
          />
        </div>
        
        {!readOnly && (
          <Button 
            variant="default" 
            size="sm" 
            onClick={(e) => {
              e.stopPropagation();
              if (studios.length > 0) {
                const startDate = new Date(date);
                startDate.setHours(9, 0, 0, 0);
                const endDate = new Date(date);
                endDate.setHours(10, 0, 0, 0);
                onBookingClick({
                  isNew: true,
                  start: startDate,
                  end: endDate,
                  studioId: studios[0]?.id
                });
              }
            }}
          >
            + New Booking
          </Button>
        )}
      </div>

      {/* Alerts Section - Compact */}
      {(alerts.length > 0 || !readOnly) && (
        <div className="flex-shrink-0 p-3 border-b border-gray-200 dark:border-gray-700 bg-red-50 dark:bg-red-900/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-red-600 dark:text-red-400" />
              <span className="font-semibold text-red-700 dark:text-red-400 text-sm">
                ALERTS ({alerts.length})
              </span>
              {alerts.length > 0 && (
                <div className="flex gap-2 ml-2">
                  {alerts.slice(0, 3).map(alert => (
                    <button
                      key={alert.id}
                      onClick={() => onBookingClick(alert)}
                      className="text-xs px-2 py-1 bg-white dark:bg-gray-800 rounded border border-red-300 dark:border-red-600 hover:bg-red-100 dark:hover:bg-red-900/50 truncate max-w-32"
                    >
                      {alert.title}
                    </button>
                  ))}
                  {alerts.length > 3 && (
                    <span className="text-xs text-red-600 dark:text-red-400">+{alerts.length - 3} more</span>
                  )}
                </div>
              )}
            </div>
            {!readOnly && (
              <Button 
                variant="destructive" 
                size="sm" 
                className="gap-1 h-7 text-xs"
                onClick={() => onBookingClick({ type: "alert", start: date, studioId: null })}
              >
                <AlertTriangle className="h-3 w-3" />
                Add Alert
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Horizontal Timeline Grid */}
      <div className="flex-1 min-h-0 overflow-auto">
        <div className="min-w-[1200px]">
          {/* Time Header Row */}
          <div className="sticky top-0 z-20 bg-white dark:bg-gray-900 border-b border-gray-300 dark:border-gray-600">
            <div className="flex">
              <div className="w-40 flex-shrink-0 p-2 bg-gray-100 dark:bg-gray-800 border-r border-gray-300 dark:border-gray-600">
                <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">STUDIOS</span>
              </div>
              <div className="flex-1 flex">
                {timeSlots.map(hour => (
                  <div 
                    key={hour} 
                    className="flex-1 min-w-[50px] border-r border-gray-200 dark:border-gray-700 p-1 text-center"
                  >
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                      {hour === 0 ? '12AM' : hour < 12 ? `${hour}AM` : hour === 12 ? '12PM' : `${hour - 12}PM`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Studio Rows with Bookings */}
          {studios.map((studio, studioIndex) => {
            const studioBookings = getBookingsForStudio(studio.id);
            
            return (
              <div 
                key={studio.id} 
                className={cn(
                  "flex border-b border-gray-200 dark:border-gray-700",
                  studioIndex % 2 === 0 ? "bg-white dark:bg-gray-900" : "bg-gray-50 dark:bg-gray-800/50"
                )}
              >
                {/* Studio Name */}
                <div className="w-40 flex-shrink-0 p-2 border-r border-gray-200 dark:border-gray-700 flex items-center">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={cn(
                      "w-2 h-2 rounded-full flex-shrink-0",
                      studioBookings.length > 0 ? "bg-blue-500" : "bg-emerald-500"
                    )} />
                    <span className="text-sm font-medium truncate dark:text-gray-200">{studio.name}</span>
                  </div>
                </div>

                {/* Timeline Area */}
                <div className="flex-1 relative h-12">
                  {/* Hour Grid Lines */}
                  <div className="absolute inset-0 flex">
                    {timeSlots.map(hour => (
                      <div 
                        key={hour} 
                        className="flex-1 min-w-[50px] border-r border-gray-100 dark:border-gray-800"
                      />
                    ))}
                  </div>

                  {/* Booking Blocks */}
                  {studioBookings.map(booking => {
                    const style = getBookingStyle(booking);
                    return (
                      <HoverCard key={booking.id}>
                        <HoverCardTrigger asChild>
                          <button
                            className={cn(
                              "absolute top-1 bottom-1 rounded cursor-pointer hover:opacity-80 transition-opacity",
                              "flex items-center px-1 overflow-hidden",
                              getBookingColor(booking)
                            )}
                            style={style}
                            onClick={() => onBookingClick(booking)}
                          >
                            <span className="text-xs font-medium text-white truncate">
                              {booking.title}
                            </span>
                          </button>
                        </HoverCardTrigger>
                        <BookingHoverCard 
                          booking={booking} 
                          notificationGroups={notificationGroups}
                          bookingStudioLinks={bookingStudios}
                        />
                      </HoverCard>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {studios.length === 0 && (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No studios available
            </div>
          )}
        </div>
      </div>
    </div>
  );
}