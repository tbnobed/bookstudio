import React, { useMemo } from 'react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { formatTime, isSameDay } from '@/lib/dateUtils';
import { Badge } from '@/components/ui/badge';
import { Tv, Clock, Users, CalendarDays, Bookmark, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useQuery } from "@tanstack/react-query";
import { 
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";

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
  // Get bookings for the selected day
  const dayBookings = useMemo(() => {
    return bookings.filter(booking => {
      // Use facility's isSameDay function which handles timezone correctly
      return isSameDay(new Date(booking.start), date);
    });
  }, [bookings, date]);

  // Function to determine if a booking should be treated as an alert
  const isAlertBooking = (booking: any) => {
    // Consider a booking an alert if:
    // 1. It has "alert" type, OR
    // 2. It has "Alert" in the title, OR
    // 3. It's an "all-day" booking with "critical" severity, OR
    // 4. It has critical severity, OR
    // 5. It was created using the Add Alert button with maintenance type
    
    // Debug logging to help diagnose alert detection
    console.log(`[ALERT CHECK] Booking ${booking.id} - ${booking.title}`, {
      type: booking.type, 
      severity: booking.severity,
      hasAlertInTitle: booking.title && booking.title.toLowerCase().includes('alert'),
      isAllDay: booking.type && booking.type.includes('all-day'),
      isCritical: booking.severity === 'critical'
    });
    
    return booking.type === 'alert' || 
           (booking.title && booking.title.toLowerCase().includes('alert')) ||
           (booking.type && booking.type.includes('all-day') && booking.severity === 'critical') ||
           (booking.severity === 'critical') || 
           (booking.type === 'all-day:maintenance');
  };

  // Separate alerts from regular bookings 
  const alerts = useMemo(() => {
    // Debug log to see what types are available
    console.log("[DEBUG] All bookings for day:", dayBookings);
    
    const alertBookings = dayBookings.filter(booking => isAlertBooking(booking));
    console.log("[DEBUG] Filtered alert bookings:", alertBookings);
    return alertBookings;
  }, [dayBookings]);
  
  // Sort regular bookings by start time
  const regularBookings = useMemo(() => {
    const nonAlerts = dayBookings.filter(booking => !isAlertBooking(booking));
    return [...nonAlerts].sort((a, b) => {
      return new Date(a.start).getTime() - new Date(b.start).getTime();
    });
  }, [dayBookings]);

  // Fetch all booking-studio links for multiple studio support
  const { data: bookingStudioLinks = [] } = useQuery<any[]>({
    queryKey: ['/api/booking-studios'],
  });

  // Get studio names for a booking (including all linked studios)
  const getStudiosForBooking = (booking: any) => {
    const studioList: typeof studios = [];
    
    // Check direct studio assignment
    if (booking.studioId) {
      const studio = studios.find(s => s.id === booking.studioId);
      if (studio) {
        studioList.push(studio);
      }
    }
    
    // Look through bookingStudioLinks for this booking's ID
    const links = bookingStudioLinks.filter((link: any) => link.bookingId === booking.id);
    if (links && links.length > 0) {
      links.forEach((link: any) => {
        const studio = studios.find(s => s.id === link.studioId);
        if (studio && !studioList.some(s => s.id === studio.id)) {
          studioList.push(studio);
        }
      });
    }
    
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
          return 'bg-red-100';
        case 'high':
          return 'bg-orange-100';
        case 'medium':
          return 'bg-yellow-100';
        case 'low':
          return 'bg-blue-100';
        default:
          return 'bg-yellow-100';
      }
    }
    
    // Otherwise, use regular booking type
    // If type contains a colon, extract the main part
    const mainType = type && type.includes(':') ? type.split(':')[1] : type;
    
    switch (mainType) {
      case 'production':
        return 'bg-blue-50';
      case 'maintenance':
        return 'bg-amber-50';
      case 'it_support':
        return 'bg-red-50';
      case 'rehearsal':
        return 'bg-purple-50';
      default:
        return 'bg-gray-50';
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
    
    console.log("[DEBUG] Processing booking:", booking.id, booking.title, "isAlert:", isAlert);
    
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
              "border rounded-md px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors",
              typeClass
            )}
            style={{
              borderLeftColor: severityColor,
              borderLeftWidth: '4px'
            }}
            onClick={() => onBookingClick(booking)}
          >
            <div className="flex justify-between items-start">
              <h3 className="text-base font-bold">{booking.title}</h3>
              <Badge className="ml-2" variant={isAlert && booking.severity === 'critical' ? 'destructive' : 'outline'}>
                {isAlert && booking.severity 
                  ? booking.severity.charAt(0).toUpperCase() + booking.severity.slice(1) 
                  : formatBookingType(booking.type)}
              </Badge>
            </div>
            
            <div className="mt-2 text-sm">
              {/* Time */}
              <div className="flex items-center gap-1 text-gray-700">
                <Clock size={14} className="flex-shrink-0" />
                <span>
                  {formatTime(new Date(booking.start))} - {formatTime(new Date(booking.end))}
                </span>
              </div>
              
              {/* Studios - only show for non-alerts */}
              {!isAlert && studiosList.length > 0 && (
                <div className="flex items-center gap-1 text-gray-700 mt-1">
                  <Users size={14} className="flex-shrink-0" />
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
                <div className="flex items-center gap-1 text-gray-700 mt-1">
                  <Tv size={14} className="flex-shrink-0" />
                  <span>{pcrRoom.name}</span>
                </div>
              )}
              
              {/* Description preview for alerts */}
              {isAlert && booking.description && (
                <div className="mt-1 text-gray-600 line-clamp-2">
                  {booking.description}
                </div>
              )}
            </div>
          </div>
        </HoverCardTrigger>
        
        <HoverCardContent className="w-80">
          <div className="flex justify-between">
            <div>
              <h4 className="text-sm font-semibold">{booking.title}</h4>
              <p className="text-sm text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5 inline-block mr-1" />
                {format(new Date(booking.start), 'MMMM d, yyyy')}
              </p>
            </div>
            <div 
              className="h-12 w-12 rounded-full" 
              style={{ 
                backgroundColor: severityColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white'
              }}
            >
              {isAlert ? <AlertTriangle className="h-6 w-6" /> : <Bookmark className="h-6 w-6" />}
            </div>
          </div>
          
          <div className="mt-2">
            <h5 className="text-xs font-medium mb-1">Description</h5>
            <p className="text-xs">
              {booking.description || "No description provided."}
            </p>
          </div>
          
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div>
              <h5 className="text-xs font-medium mb-1">Time</h5>
              <p className="text-xs">
                {formatTime(new Date(booking.start))} - {formatTime(new Date(booking.end))}
              </p>
            </div>
            {isAlert ? (
              <div>
                <h5 className="text-xs font-medium mb-1">Severity</h5>
                <p className="text-xs capitalize">{booking.severity || 'Normal'}</p>
              </div>
            ) : (
              <div>
                <h5 className="text-xs font-medium mb-1">Type</h5>
                <p className="text-xs capitalize">{formatBookingType(booking.type)}</p>
              </div>
            )}
            
            {!isAlert && (
              <>
                <div>
                  <h5 className="text-xs font-medium mb-1">Studios</h5>
                  <div className="flex flex-wrap gap-1">
                    {studiosList.map(studio => (
                      <Badge key={studio.id} variant="outline" className="text-[10px]">
                        {studio.name}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <h5 className="text-xs font-medium mb-1">PCR Room</h5>
                  <p className="text-xs">
                    {pcrRoom ? pcrRoom.name : "None"}
                  </p>
                </div>
              </>
            )}
          </div>
        </HoverCardContent>
      </HoverCard>
    );
  };

  return (
    <div className="w-full p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">
          {format(date, 'EEEE, MMMM d, yyyy')}
        </h2>
        
        {!readOnly && (
          <Button 
            variant="default" 
            size="sm" 
            className="ml-auto"
            onClick={(e) => {
              e.stopPropagation();
              if (studios.length > 0) {
                // Create proper Date objects for start and end times
                const startDate = new Date(date);
                startDate.setHours(9, 0, 0, 0);
                
                const endDate = new Date(date);
                endDate.setHours(10, 0, 0, 0);
                
                onBookingClick({
                  isNew: true,
                  start: startDate,
                  end: endDate,
                  studioId: studios[0]?.id // Default to first studio
                });
              }
            }}
          >
            + New Booking
          </Button>
        )}
      </div>
      
      {dayBookings.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-md">
          <p className="text-gray-500">No bookings for this day</p>
        </div>
      ) : (
        <div>
          {/* ALERTS SECTION */}
          <div className={`mb-6 p-4 border-2 border-red-400 bg-red-50 rounded-md shadow-md ${alerts.length === 0 ? 'border-dashed' : ''}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle size={20} className="text-red-600" />
                <h3 className="text-lg font-bold text-red-700">ALERTS & CRITICAL NOTICES</h3>
              </div>
              {!readOnly && (
                <Button 
                  variant="destructive" 
                  size="sm" 
                  className="gap-1"
                  onClick={() => {
                    // Handle creating a new alert for the current date
                    const alertData = {
                      type: "all-day:maintenance",
                      severity: "critical",
                      start: date,
                      studioId: null
                    };
                    onBookingClick(alertData);
                  }}
                >
                  <AlertTriangle className="h-4 w-4" />
                  <span>Add Alert</span>
                </Button>
              )}
            </div>
            
            {alerts.length === 0 ? (
              <div className="text-center py-3 bg-white rounded-md text-gray-500">
                <p>No alerts for this day</p>
              </div>
            ) : (
              <div className="space-y-3">
                {alerts.map(alert => (
                  <div 
                    key={alert.id} 
                    className="p-3 rounded-md border-l-4 border-red-500 bg-white shadow-sm cursor-pointer hover:bg-gray-50"
                    onClick={() => onBookingClick(alert)}
                  >
                    <div className="font-medium text-red-700">{alert.title}</div>
                    <div className="text-sm text-gray-600 mt-1">
                      {alert.description && alert.description.substring(0, 100)}
                      {alert.description && alert.description.length > 100 ? '...' : ''}
                    </div>
                    <div className="mt-2 flex items-center text-xs">
                      <div className="flex items-center gap-1 text-gray-700">
                        <Clock size={14} className="flex-shrink-0" />
                        <span>
                          {formatTime(new Date(alert.start))} - {formatTime(new Date(alert.end))}
                        </span>
                      </div>
                      <span className="inline-block px-2 py-1 ml-2 rounded-full bg-red-100 text-red-700 text-xs font-semibold">
                        {alert.severity}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* REGULAR BOOKINGS SECTION */}
          <div className="mt-4">
            {regularBookings.length > 0 && (
              <>
                <h3 className="text-lg font-semibold mb-3">Bookings</h3>
                <div className="space-y-3">
                  {regularBookings.map(booking => (
                    <BookingCard key={booking.id} booking={booking} />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}