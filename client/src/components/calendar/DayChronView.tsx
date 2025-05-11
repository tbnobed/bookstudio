import React, { useMemo } from 'react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { formatTime } from '@/lib/dateUtils';
import { Badge } from '@/components/ui/badge';
import { Tv, Clock, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
      const bookingDate = new Date(booking.start);
      return (
        bookingDate.getFullYear() === date.getFullYear() &&
        bookingDate.getMonth() === date.getMonth() &&
        bookingDate.getDate() === date.getDate()
      );
    });
  }, [bookings, date]);

  // Sort bookings by start time
  const sortedBookings = useMemo(() => {
    return [...dayBookings].sort((a, b) => {
      return new Date(a.start).getTime() - new Date(b.start).getTime();
    });
  }, [dayBookings]);

  // Get studio names for a booking
  const getStudiosForBooking = (booking: any) => {
    const studioList: typeof studios = [];
    
    // Check direct studio assignment
    if (booking.studioId) {
      const studio = studios.find(s => s.id === booking.studioId);
      if (studio) studioList.push(studio);
    }
    
    // Check booking_studios junction table
    if (booking.bookingStudios && booking.bookingStudios.length > 0) {
      booking.bookingStudios.forEach((bs: any) => {
        const studio = studios.find(s => s.id === bs.studioId);
        if (studio && !studioList.some(s => s.id === studio.id)) {
          studioList.push(studio);
        }
      });
    }
    
    // Check studioIds array if present
    if (booking.studioIds && Array.isArray(booking.studioIds)) {
      booking.studioIds.forEach((studioId: number) => {
        const studio = studios.find(s => s.id === studioId);
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
  const getTypeClass = (type: string) => {
    switch (type) {
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
      default:
        return type || 'Unknown';
    }
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
      
      {sortedBookings.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-md">
          <p className="text-gray-500">No bookings for this day</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedBookings.map((booking) => {
            const studiosList = getStudiosForBooking(booking);
            const pcrRoom = getPcrRoom(booking);
            const typeClass = getTypeClass(booking.type);
            const bookingColor = booking.color || '#3b82f6';
            
            return (
              <div 
                key={booking.id}
                className={cn(
                  "border rounded-md px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors",
                  typeClass
                )}
                style={{
                  borderLeftColor: bookingColor,
                  borderLeftWidth: '4px'
                }}
                onClick={() => onBookingClick(booking)}
              >
                <div className="flex justify-between items-start">
                  <h3 className="text-base font-bold">{booking.title}</h3>
                  <Badge className="ml-2">{formatBookingType(booking.type)}</Badge>
                </div>
                
                <div className="mt-2 text-sm">
                  {/* Time */}
                  <div className="flex items-center gap-1 text-gray-700">
                    <Clock size={14} className="flex-shrink-0" />
                    <span>
                      {formatTime(new Date(booking.start))} - {formatTime(new Date(booking.end))}
                    </span>
                  </div>
                  
                  {/* Studios */}
                  <div className="flex items-center gap-1 text-gray-700 mt-1">
                    <Users size={14} className="flex-shrink-0" />
                    <div className="flex flex-wrap gap-1">
                      {studiosList.length === 0 ? (
                        <span className="text-gray-500">No studios assigned</span>
                      ) : (
                        studiosList.map(studio => (
                          <Badge 
                            key={studio.id} 
                            variant="secondary" 
                            className="text-xs"
                          >
                            {studio.name}
                          </Badge>
                        ))
                      )}
                    </div>
                  </div>
                  
                  {/* PCR room */}
                  {pcrRoom && (
                    <div className="flex items-center gap-1 text-gray-700 mt-1">
                      <Tv size={14} className="flex-shrink-0" />
                      <span>{pcrRoom.name}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}