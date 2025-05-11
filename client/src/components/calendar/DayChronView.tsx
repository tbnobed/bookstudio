import React, { useMemo } from 'react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { formatTime } from '@/lib/dateUtils';
import { Badge } from '@/components/ui/badge';
import { Tv, Clock, Users, Info, CalendarDays, Bookmark } from 'lucide-react';
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

  // Fetch all booking-studio links for multiple studio support
  const { data: bookingStudioLinks = [] } = useQuery<any[]>({
    queryKey: ['/api/booking-studios'],
  });

  // Get studio names for a booking (including all linked studios)
  const getStudiosForBooking = (booking: any) => {
    // Debug log the booking data
    console.log(`[DEBUG] Getting studios for booking: ${booking.id} (${booking.title})`);
    
    const studioList: typeof studios = [];
    
    // Check direct studio assignment
    if (booking.studioId) {
      const studio = studios.find(s => s.id === booking.studioId);
      if (studio) {
        console.log(`[DEBUG] Adding primary studio: ${studio.name} (${studio.id})`);
        studioList.push(studio);
      }
    }
    
    // Check booking_studios junction table
    if (booking.bookingStudios && booking.bookingStudios.length > 0) {
      booking.bookingStudios.forEach((bs: any) => {
        const studio = studios.find(s => s.id === bs.studioId);
        if (studio && !studioList.some(s => s.id === studio.id)) {
          console.log(`[DEBUG] Adding linked studio from booking.bookingStudios: ${studio.name} (${studio.id})`);
          studioList.push(studio);
        }
      });
    }
    
    // Look through bookingStudioLinks for this booking's ID
    const links = bookingStudioLinks.filter((link: any) => link.bookingId === booking.id);
    if (links && links.length > 0) {
      console.log(`[DEBUG] Found ${links.length} booking-studio links for booking ${booking.id}`);
      links.forEach((link: any) => {
        const studio = studios.find(s => s.id === link.studioId);
        if (studio && !studioList.some(s => s.id === studio.id)) {
          console.log(`[DEBUG] Adding linked studio from bookingStudioLinks: ${studio.name} (${studio.id})`);
          studioList.push(studio);
        }
      });
    }
    
    // Check studioIds array if present
    if (booking.studioIds && Array.isArray(booking.studioIds)) {
      booking.studioIds.forEach((studioId: number) => {
        const studio = studios.find(s => s.id === studioId);
        if (studio && !studioList.some(s => s.id === studio.id)) {
          console.log(`[DEBUG] Adding studio from studioIds array: ${studio.name} (${studio.id})`);
          studioList.push(studio);
        }
      });
    }
    
    // Log the result
    console.log(`[DEBUG] Final studio list for booking ${booking.id}: `, studioList.map(s => s.name));
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
              <HoverCard key={booking.id} openDelay={300} closeDelay={100}>
                <HoverCardTrigger asChild>
                  <div 
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
                        backgroundColor: bookingColor || '#4B83E2',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white'
                      }}
                    >
                      <Bookmark className="h-6 w-6" />
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
                    <div>
                      <h5 className="text-xs font-medium mb-1">Type</h5>
                      <p className="text-xs capitalize">{formatBookingType(booking.type)}</p>
                    </div>
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
                  </div>
                  
                  <div className="mt-3 text-xs text-muted-foreground">
                    <p>Click to edit booking details</p>
                  </div>
                </HoverCardContent>
              </HoverCard>
            );
          })}
        </div>
      )}
    </div>
  );
}