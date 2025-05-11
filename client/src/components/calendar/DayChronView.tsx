import React, { useMemo } from 'react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { formatTime, isSameDay } from '@/lib/dateUtils';
import { Badge } from '@/components/ui/badge';
import { Tv, Clock, Users, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useQuery } from "@tanstack/react-query";

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

  // Separate alerts from regular bookings
  const alerts = useMemo(() => {
    return dayBookings.filter(booking => booking.type === 'alert');
  }, [dayBookings]);
  
  // Sort regular bookings by start time
  const regularBookings = useMemo(() => {
    const nonAlerts = dayBookings.filter(booking => booking.type !== 'alert');
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

  // Get the severity color for alerts
  const getSeverityColor = (severity: string = 'medium') => {
    switch (severity) {
      case 'critical':
        return '#f44336'; // Red
      case 'high':
        return '#ff9800'; // Orange
      case 'medium':
        return '#ffc107'; // Amber
      case 'low':
        return '#2196f3'; // Blue
      default:
        return '#ffc107'; // Default to amber for unknown severity
    }
  };

  // Render an alert item
  const renderAlert = (alert: any) => {
    const severityColor = getSeverityColor(alert.severity);
    
    return (
      <div 
        key={alert.id}
        className="border rounded-md p-3 mb-2 bg-opacity-10 cursor-pointer hover:bg-gray-50"
        style={{
          backgroundColor: `${severityColor}10`,
          borderLeftColor: severityColor,
          borderLeftWidth: '4px'
        }}
        onClick={() => onBookingClick(alert)}
      >
        <div className="flex justify-between">
          <h4 className="font-semibold">{alert.title}</h4>
          <Badge variant={alert.severity === 'critical' ? 'destructive' : 'outline'}>
            {alert.severity ? alert.severity.charAt(0).toUpperCase() + alert.severity.slice(1) : 'Alert'}
          </Badge>
        </div>
        <div className="mt-1 text-sm flex items-center gap-1 text-gray-600">
          <Clock size={14} className="flex-shrink-0" />
          <span>{formatTime(new Date(alert.start))} - {formatTime(new Date(alert.end))}</span>
        </div>
        {alert.description && (
          <div className="mt-1 text-sm text-gray-600 line-clamp-2">
            {alert.description}
          </div>
        )}
      </div>
    );
  };

  // Render a regular booking item
  const renderBooking = (booking: any) => {
    const studiosList = getStudiosForBooking(booking);
    const pcrRoom = getPcrRoom(booking);
    const bookingColor = booking.color || '#3b82f6';
    
    return (
      <div 
        key={booking.id}
        className="border rounded-md p-3 mb-2 cursor-pointer hover:bg-gray-50"
        style={{
          borderLeftColor: bookingColor,
          borderLeftWidth: '4px'
        }}
        onClick={() => onBookingClick(booking)}
      >
        <div className="flex justify-between">
          <h4 className="font-semibold">{booking.title}</h4>
          <Badge variant="outline">
            {booking.type === 'production' ? 'Production' :
             booking.type === 'maintenance' ? 'Maintenance' :
             booking.type === 'it_support' ? 'IT Support' :
             booking.type === 'rehearsal' ? 'Rehearsal' : 
             booking.type || 'Booking'}
          </Badge>
        </div>
        
        <div className="mt-1 text-sm flex items-center gap-1 text-gray-600">
          <Clock size={14} />
          <span>{formatTime(new Date(booking.start))} - {formatTime(new Date(booking.end))}</span>
        </div>
        
        {studiosList.length > 0 && (
          <div className="mt-1 text-sm flex items-center gap-1 text-gray-600">
            <Users size={14} />
            <span>{studiosList.map(studio => studio.name).join(', ')}</span>
          </div>
        )}
        
        {pcrRoom && (
          <div className="mt-1 text-sm flex items-center gap-1 text-gray-600">
            <Tv size={14} />
            <span>{pcrRoom.name}</span>
          </div>
        )}
        
        {booking.description && (
          <div className="mt-1 text-sm text-gray-600 line-clamp-2">
            {booking.description}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-4 w-full">
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
          {/* ALERTS SECTION - Always displayed at the top */}
          {alerts.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle size={18} className="text-amber-500" />
                <h3 className="text-lg font-semibold">Alerts</h3>
              </div>
              <div className="space-y-3 rounded-md border border-amber-200 bg-amber-50 p-3">
                {alerts.map(alert => renderAlert(alert))}
              </div>
            </div>
          )}
          
          {/* BOOKINGS SECTION */}
          {regularBookings.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-3">Bookings</h3>
              <div className="space-y-4">
                {regularBookings.map(booking => renderBooking(booking))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}