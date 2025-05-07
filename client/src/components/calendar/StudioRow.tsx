import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Booking, Studio, PcrRoom } from "@shared/schema";
import { formatTime, formatDate, isWeekend, isSameDay } from "@/lib/dateUtils";
import BookingModal from "../booking/BookingModal";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { CalendarClock, Clock, FileText, User, Tag } from "lucide-react";
import { useBookingStudioLinks } from "@/hooks/useBookingStudioLinks";
import { useQuery } from "@tanstack/react-query";

interface StudioRowProps {
  studio: Studio;
  weekDates: Date[];
  bookings: Booking[];
  onBookingClick: (booking: Booking) => void;
  readOnly?: boolean;
}

// A simplified StudioRow component with more stability
export default function StudioRow({ studio, weekDates, bookings, onBookingClick, readOnly = false }: StudioRowProps) {
  // State for new booking modal
  const [isNewBookingModalOpen, setIsNewBookingModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  
  // Get booking-studio links
  const { data: bookingStudioLinks = [] } = useBookingStudioLinks(undefined, readOnly);
  
  // Get PCR rooms
  const { data: pcrRooms = [] } = useQuery<PcrRoom[]>({
    queryKey: ["/api/pcr-rooms"],
  });
  
  // Helper to get PCR room name
  const getPcrRoomName = (pcrRoomId: number): string => {
    const pcrRoom = pcrRooms.find(room => room.id === pcrRoomId);
    return pcrRoom ? pcrRoom.name : `PCR #${pcrRoomId}`;
  };
  
  // Filter bookings for this studio (memoized)
  const studioBookings = useMemo(() => {
    // Get bookings with direct assignment to this studio
    const directBookings = bookings.filter(booking => booking.studioId === studio.id);
    
    // Get bookings linked through junction table
    const linkedBookingIds = bookingStudioLinks
      .filter(link => link.studioId === studio.id)
      .map(link => link.bookingId);
    
    // Find linked bookings not already in direct bookings
    const linkedBookings = bookings.filter(
      booking => linkedBookingIds.includes(booking.id) && !directBookings.includes(booking)
    );
    
    // Return combined list
    return [...directBookings, ...linkedBookings];
  }, [studio.id, bookings, bookingStudioLinks]);
  
  // Calculate row height
  const rowHeight = useMemo(() => {
    // Find maximum bookings per day
    const maxBookings = weekDates.reduce((max, date) => {
      const count = studioBookings.filter(booking => 
        isSameDay(new Date(booking.start), date)
      ).length;
      return Math.max(max, count);
    }, 0);
    
    // Base height + space for bookings
    const baseHeight = 42;
    const heightPerBooking = 32;
    const maxHeight = 320;
    return baseHeight + Math.min(maxBookings * heightPerBooking, maxHeight);
  }, [weekDates, studioBookings]);
  
  // Create studio status indicator
  const studioStatusIndicator = useMemo(() => {
    // Default status color
    let statusClass = "bg-green-500"; // available
    
    if (studio.status === "maintenance") {
      statusClass = "bg-orange-500";
    } else {
      // Check if any booking is currently active
      const now = new Date();
      const hasActiveBooking = studioBookings.some(booking => {
        const start = new Date(booking.start);
        const end = new Date(booking.end);
        return now >= start && now <= end;
      });
      
      if (hasActiveBooking) {
        statusClass = "bg-red-500"; // in-use
      }
    }
    
    return <div className={`w-2 h-2 rounded-full mr-2 ${statusClass}`}></div>;
  }, [studio.status, studioBookings]);
  
  // Handle cell click for new booking
  const handleCellClick = (date: Date) => {
    if (readOnly) return;
    
    setSelectedDate(date);
    setIsNewBookingModalOpen(true);
  };
  
  // Return the studio row component
  return (
    <>
      {/* Studio name header (left column) */}
      <div 
        className="border-b flex items-center px-2 sticky left-0 z-10 bg-white" 
        style={{ height: `${rowHeight}px` }}
      >
        <div className="flex items-center w-full">
          {studioStatusIndicator}
          <span className="text-xs font-medium text-gray-700 truncate">{studio.name}</span>
        </div>
      </div>
      
      {/* Day cells */}
      {weekDates.map((date, index) => {
        // Get bookings for this day and studio
        const dayBookings = studioBookings.filter(booking => 
          isSameDay(new Date(booking.start), date)
        );
        
        return (
          <div 
            key={index} 
            className={cn(
              "relative border-b border-r",
              isWeekend(date) ? "bg-gray-50" : "bg-white",
              isSameDay(date, new Date()) ? "bg-blue-50 border-blue-200" : "",
              "cursor-pointer hover:bg-gray-100 overflow-y-auto"
            )}
            style={{ 
              height: `${rowHeight}px`,
              minHeight: `${rowHeight}px`,
              maxHeight: `${rowHeight}px`
            }}
            onClick={() => handleCellClick(date)}
          >
            {/* Booking count badge for many bookings */}
            {dayBookings.length > 5 && (
              <div className="absolute top-0 right-0 z-20 px-1 text-xs font-semibold bg-gray-700 text-white rounded-bl-md">
                {dayBookings.length}
              </div>
            )}
            
            {/* Booking cards */}
            {dayBookings.map((booking, bookingIndex) => {
              // Determine color based on booking type and severity
              let colorClass = "bg-blue-100 border-blue-300 text-blue-800";
              
              if (booking.type === "maintenance" || booking.type === "it_support") {
                if (booking.severity === "critical") {
                  colorClass = "bg-red-100 border-red-500 border text-red-800 shadow-sm";
                } else if (booking.severity === "high") {
                  colorClass = "bg-orange-100 border-orange-400 border text-orange-800 shadow-sm";
                } else if (booking.severity === "medium") {
                  colorClass = "bg-amber-100 border-amber-400 border text-amber-800 shadow-sm";
                } else {
                  colorClass = "bg-blue-100 border-blue-400 border text-blue-800 shadow-sm";
                }
              } else if (booking.type === "rehearsal") {
                colorClass = "bg-purple-100 border-purple-300 text-purple-800";
              } else if (booking.type === "production") {
                colorClass = "bg-red-100 border-red-300 text-red-800";
              }
              
              // Use custom color if specified
              if (booking.color) {
                colorClass = "border"; // Keep only border class
              }
              
              // Calculate position based on number of bookings
              let topPosition = 4 + (bookingIndex * 40);
              
              // Adjust spacing for dense days
              if (dayBookings.length > 10) {
                topPosition = 4 + (bookingIndex * 30);
              } else if (dayBookings.length > 5) {
                topPosition = 4 + (bookingIndex * 35);
              }
              
              // Height for booking card
              const height = dayBookings.length > 10 ? 28 : dayBookings.length > 5 ? 32 : 38;
              
              return (
                <HoverCard key={booking.id}>
                  <HoverCardTrigger asChild>
                    <div 
                      className={cn(
                        "absolute w-[calc(100%-4px)] left-[2px] border rounded-md px-2 py-1 overflow-hidden text-overflow-ellipsis text-xs z-10 transition-all hover:shadow-md",
                        colorClass
                      )}
                      style={{
                        top: `${topPosition}px`,
                        minHeight: `${height}px`,
                        ...(booking.color ? {
                          backgroundColor: `${booking.color}20`, // 20 is hex for 12% opacity
                          borderColor: booking.color,
                          color: booking.color
                        } : {})
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!readOnly) {
                          onBookingClick(booking);
                        }
                      }}
                    >
                      <div className="flex items-center w-full">
                        {/* Alert indicator dot */}
                        {(booking.type === "maintenance" || booking.type === "it_support") && (
                          <span className={`w-2 h-2 rounded-full mr-1 flex-shrink-0 ${
                            booking.severity === "critical" ? "bg-red-500" : 
                            booking.severity === "high" ? "bg-orange-500" :
                            booking.severity === "medium" ? "bg-amber-500" : "bg-blue-500"
                          }`}></span>
                        )}
                        {/* Booking title */}
                        <span className="font-medium inline-block w-full overflow-hidden text-ellipsis">
                          {booking.title}
                          {booking.pcrRoomId ? ` (${getPcrRoomName(booking.pcrRoomId)})` : ''}
                        </span>
                      </div>
                      {/* Time display */}
                      <div className="text-xs pl-3">
                        {formatTime(new Date(booking.start))} - {formatTime(new Date(booking.end))}
                      </div>
                    </div>
                  </HoverCardTrigger>
                  <HoverCardContent className="w-80 p-4">
                    <div className="space-y-3">
                      {/* Hover card header */}
                      <div className="flex justify-between items-start">
                        <h4 className="text-sm font-semibold">{booking.title}</h4>
                        {!readOnly && (
                          <div className="flex space-x-1">
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                onBookingClick(booking);
                              }}
                              className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                              title="Edit booking"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500 hover:text-blue-500">
                                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path>
                                <path d="m15 5 4 4"></path>
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>
                      {/* Booking details */}
                      <div className="space-y-1">
                        {/* Date */}
                        <div className="flex items-center text-xs text-muted-foreground">
                          <CalendarClock className="mr-1 h-3 w-3" />
                          <span>{formatDate(booking.start)}</span>
                        </div>
                        {/* Time */}
                        <div className="flex items-center text-xs text-muted-foreground">
                          <Clock className="mr-1 h-3 w-3" />
                          <span>{formatTime(booking.start)} - {formatTime(booking.end)}</span>
                        </div>
                        {/* Booking type */}
                        <div className="flex items-center text-xs text-muted-foreground">
                          <Tag className="mr-1 h-3 w-3" />
                          <span className="capitalize">{booking.type.replace('_', ' ')}</span>
                        </div>
                        {/* PCR room if assigned */}
                        {booking.pcrRoomId && (
                          <div className="flex items-center text-xs text-muted-foreground">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1 h-3 w-3">
                              <path d="M20 16V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9m16 0H4m16 0 1.28 2.55a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45L4 16"></path>
                            </svg>
                            <span>{getPcrRoomName(booking.pcrRoomId)}</span>
                          </div>
                        )}
                        {/* Description if available */}
                        {booking.description && (
                          <div className="flex items-start mt-2 text-xs text-muted-foreground">
                            <FileText className="mr-1 h-3 w-3 mt-0.5 flex-shrink-0" />
                            <span>{booking.description}</span>
                          </div>
                        )}
                        {/* Notification list if available */}
                        {Array.isArray(booking.notifyList) && booking.notifyList.length > 0 && (
                          <div className="mt-2">
                            <div className="text-xs font-medium mb-1">Notifying:</div>
                            <div className="flex flex-wrap gap-1">
                              {booking.notifyList.map((crew: string, i: number) => (
                                <span key={i} className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-800">
                                  <User className="mr-1 h-3 w-3" />
                                  {crew}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </HoverCardContent>
                </HoverCard>
              );
            })}
          </div>
        );
      })}
      
      {/* New Booking Modal */}
      {selectedDate && (
        <BookingModal 
          isOpen={isNewBookingModalOpen}
          onClose={() => setIsNewBookingModalOpen(false)}
          selectedDate={selectedDate}
          selectedStudio={studio.id}
        />
      )}
    </>
  );
}