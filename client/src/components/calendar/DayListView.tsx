import React from 'react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { formatTime } from '@/lib/dateUtils';
import { Badge } from '@/components/ui/badge';
import { Tv } from 'lucide-react';

interface DayListViewProps {
  date: Date;
  bookings: any[];
  studios: any[];
  pcrRooms: any[];
  onBookingClick: (booking: any) => void;
  readOnly?: boolean;
}

export default function DayListView({
  date,
  bookings,
  studios,
  pcrRooms,
  onBookingClick,
  readOnly = false,
}: DayListViewProps) {
  // Get bookings for the selected day
  const dayBookings = bookings.filter(booking => {
    const bookingDate = new Date(booking.start);
    return (
      bookingDate.getFullYear() === date.getFullYear() &&
      bookingDate.getMonth() === date.getMonth() &&
      bookingDate.getDate() === date.getDate()
    );
  });

  // Sort bookings by start time
  const sortedBookings = [...dayBookings].sort((a, b) => {
    return new Date(a.start).getTime() - new Date(b.start).getTime();
  });

  // Get studio names for a booking
  const getStudiosForBooking = (booking: any) => {
    // If booking has a direct studioId reference
    if (booking.studioId) {
      const studio = studios.find(s => s.id === booking.studioId);
      return studio ? [studio] : [];
    }
    
    // If booking has multiple studios through bookingStudios
    return studios.filter(studio => {
      return booking.bookingStudios?.some((bs: any) => bs.studioId === studio.id);
    });
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
  const formatBookingType = (type: string) => {
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
        return type;
    }
  };

  return (
    <div className="w-full py-4">
      <h2 className="text-xl font-bold mb-4">
        {format(date, 'EEEE, MMMM d, yyyy')}
      </h2>
      
      {sortedBookings.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-md">
          <p className="text-gray-500">No bookings for this day</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sortedBookings.map(booking => {
            const bookingStudios = getStudiosForBooking(booking);
            const pcrRoom = getPcrRoom(booking);
            const typeClass = getTypeClass(booking.type);
            const bookingColor = booking.color || '#3b82f6';

            return (
              <div 
                key={booking.id}
                className={cn(
                  "border rounded-md overflow-hidden cursor-pointer transition-all",
                  typeClass
                )}
                style={{
                  borderLeftColor: bookingColor,
                  borderLeftWidth: '4px'
                }}
                onClick={() => onBookingClick(booking)}
              >
                <div className="p-4">
                  <div className="flex justify-between items-start">
                    <h3 className="text-lg font-bold">{booking.title}</h3>
                    <Badge variant="outline" className="ml-2">{formatBookingType(booking.type)}</Badge>
                  </div>
                  
                  <div className="mt-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {formatTime(new Date(booking.start))} - {formatTime(new Date(booking.end))}
                      </span>
                    </div>
                    
                    {bookingStudios.length > 0 && (
                      <div className="mt-1">
                        <span className="font-medium">Studios: </span>
                        {bookingStudios.map(studio => studio.name).join(', ')}
                      </div>
                    )}
                    
                    {pcrRoom && (
                      <div className="mt-1 flex items-center gap-1">
                        <Tv size={16} className="text-gray-500" />
                        <span className="font-medium">{pcrRoom.name}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}