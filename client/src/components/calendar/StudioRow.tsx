import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Booking, Studio, PcrRoom, BookingStudio } from "@shared/schema";
import { formatTime, formatDate, isWeekend, isSameDay, formatDateTimeRange } from "@/lib/dateUtils";
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

// Helper function to calculate studio status
function getStudioStatus(studio: Studio, bookings: Booking[], bookingStudioLinks: BookingStudio[] = []): string {
  // Default colors based on studio status
  const colorClasses = {
    available: "bg-green-500",
    maintenance: "bg-orange-500",
    "in-use": "bg-red-500",
    booked: "bg-red-500", // backward compatibility
    default: "bg-gray-500"
  };

  // If studio is explicitly set to maintenance, respect that setting
  if (studio.status === "maintenance") {
    return colorClasses.maintenance;
  }
  
  // Get the current time 
  const now = new Date();
  
  // Check if there are any active bookings for this studio right now
  const hasActiveBooking = bookings.some(booking => {
    // First, check traditional studioId (kept for backwards compatibility)
    const directMatch = booking.studioId === studio.id;
    
    // Then, check junction table links for multi-studio bookings
    const linkedMatch = bookingStudioLinks.some(link => 
      link.bookingId === booking.id && link.studioId === studio.id
    );
    
    // Skip if not for this studio through either direct or linked relationship
    if (!directMatch && !linkedMatch) return false;
    
    // Get booking dates
    const bookingStart = new Date(booking.start);
    const bookingEnd = new Date(booking.end);
    
    // Only show as in-use if we're currently within the booking time window
    return now >= bookingStart && now <= bookingEnd;
  });
  
  // Return "in-use" status if there are active bookings now, otherwise use the studio's configured status
  const status = hasActiveBooking ? "in-use" : studio.status;
  
  // Return the color class based on the status
  return colorClasses[status as keyof typeof colorClasses] || colorClasses.default;
}

export default function StudioRow({ studio, weekDates, bookings, onBookingClick, readOnly = false }: StudioRowProps) {
  const [isNewBookingModalOpen, setIsNewBookingModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  
  // Fetch all booking-studio links to determine which bookings are associated with this studio via junction table
  // Use public endpoint if in readOnly mode (public calendar view)
  const { data: bookingStudioLinks = [] } = useBookingStudioLinks(undefined, readOnly);
  
  // Fetch PCR rooms to display names instead of IDs
  const { data: pcrRooms = [] } = useQuery<PcrRoom[]>({
    queryKey: ["/api/pcr-rooms"],
  });
  // Function to get PCR room name from ID
  const getPcrRoomName = (pcrRoomId: number): string => {
    const pcrRoom = pcrRooms.find(room => room.id === pcrRoomId);
    return pcrRoom ? pcrRoom.name : `PCR #${pcrRoomId}`;
  };
  
  // Create a filtered list of bookings that contains:
  // 1. Bookings linked to this studio through the booking-studio junction table
  // 2. Bookings with studioId directly set to this studio's ID
  const studioBookings = useMemo(() => {
    console.log(`[DEBUG] Processing studio: ${studio.name} (ID: ${studio.id})`);
    console.log(`[DEBUG] Total bookings available: ${bookings.length}`);
    console.log(`[DEBUG] Total booking-studio links available: ${bookingStudioLinks.length}`);
    
    // IMPORTANT CHANGE: We need to find ALL bookings that are relevant to this studio
    // either through direct studio ID or through the junction table.
    // We shouldn't exclude any booking that has a record in the junction table.
    const relevantBookings = bookings.filter(booking => {
      // Check if linked through junction table
      const hasJunctionLink = bookingStudioLinks.some(
        link => link.bookingId === booking.id && link.studioId === studio.id
      );
      
      // Check if directly assigned 
      const hasDirectLink = booking.studioId === studio.id;
      
      // Include the booking if it has either link type
      return hasJunctionLink || hasDirectLink;
    });
    
    console.log(`[DEBUG] Bookings relevant to Studio ${studio.name}:`, 
      relevantBookings.map(b => ({id: b.id, title: b.title, studioId: b.studioId}))
    );
    
    // Get booking IDs from the junction table that link to this studio
    const linkedBookingIds = bookingStudioLinks
      .filter(link => link.studioId === studio.id)
      .map(link => link.bookingId);
    
    console.log(`[DEBUG] Linked booking IDs for Studio ${studio.name}: ${linkedBookingIds.join(', ') || 'none'}`);
    
    // Log relationship between each booking's direct studio ID and junction table entries
    relevantBookings.forEach(booking => {
      const hasDirectLink = booking.studioId === studio.id;
      const hasJunctionLink = linkedBookingIds.includes(booking.id);
      
      console.log(`[DEBUG] Booking ${booking.id} (${booking.title}): ` +
        `direct studioId=${booking.studioId}, ` +
        `in junction table=${hasJunctionLink}`);
    });
    
    // Return all relevant bookings without any filtering 
    // This ensures we show all bookings linked to this studio in any way
    
    // Log details for debugging
    if (relevantBookings.length > 0) {
      console.log(`Studio ${studio.name} has ${relevantBookings.length} total bookings`);
      console.log(`[DEBUG] All bookings:`, relevantBookings.map(b => ({id: b.id, title: b.title})));
    }
    
    return relevantBookings;
  }, [studio.id, bookings, bookingStudioLinks]);

  // Handle cell click to create a new booking - only if not in read-only mode
  const handleCellClick = (date: Date) => {
    // If in read-only mode, do nothing
    if (readOnly) {
      return;
    }
    
    setSelectedDate(date);
    setIsNewBookingModalOpen(true);
  };

  return (
    <>
      {/* Calculate row height dynamically based on the maximum number of bookings for this studio on any day */}
      {(() => {
        // Count max bookings for this studio in any day using the combined bookings list
        const maxBookingsPerDay = weekDates.map(date => {
          const count = studioBookings.filter(
            booking => isSameDay(new Date(booking.start), date)
          ).length;
          
          return { date: date.toDateString(), count };
        });
        
        // Log max bookings info for this studio
        console.log(`Studio ${studio.name} - max bookings per day:`, maxBookingsPerDay);
        
        // Get the actual max number
        const maxBookingsForStudio = Math.max(...maxBookingsPerDay.map(day => day.count), 0);
        console.log(`Studio ${studio.name} - max booking count: ${maxBookingsForStudio}`);
        
        // Calculate dynamic height - base height plus additional space for each booking
        // Min height is 42px, and each booking adds 32px up to a reasonable maximum
        const baseHeight = 42; // Minimum height for a row with no bookings
        const heightPerBooking = 32; // Additional height per booking (increased from 24px)
        const maxAdditionalHeight = 320; // Maximum additional height (increased from 160px)
        const additionalHeight = Math.min(maxBookingsForStudio * heightPerBooking, maxAdditionalHeight);
        const rowHeight = baseHeight + additionalHeight;
        
        console.log(`Studio ${studio.name} - calculated row height: ${rowHeight}px`);
        
        return (
          <div 
            className="border-b flex items-center px-2 sticky left-0 z-10 bg-white" 
            style={{ height: `${rowHeight}px` }}
          >
            {/* Studio status indicator */}
            {(() => {
              // Determine if studio is currently in use by checking both direct assignments and junction table
              const now = new Date();
              const hasActiveBooking = bookings.some(booking => {
                // Check if linked directly or through junction table
                const directMatch = booking.studioId === studio.id;
                const linkedMatch = bookingStudioLinks.some(link => 
                  link.bookingId === booking.id && link.studioId === studio.id
                );
                
                // Skip if not for this studio
                if (!directMatch && !linkedMatch) return false;
                
                // Check if currently active (time-wise)
                const start = new Date(booking.start);
                const end = new Date(booking.end);
                return now >= start && now <= end;
              });
              
              // Return the right color based on status
              let statusClass = "bg-green-500"; // available
              if (studio.status === "maintenance") {
                statusClass = "bg-orange-500";
              } else if (hasActiveBooking) {
                statusClass = "bg-red-500"; // in-use
              }
              
              return <div className={`w-2 h-2 rounded-full mr-2 ${statusClass}`}></div>;
            })()}
            <span className="text-xs font-medium text-gray-700 truncate">{studio.name}</span>
          </div>
        );
      })()}
      
      {weekDates.map((date, index) => {
        // Filter bookings for this date and this specific studio using the combined studioBookings
        // Create a defensive copy of the booking.start date and ensure timezones are respected
        const dayBookings = studioBookings.filter(booking => {
          // Log both dates for debugging to trace the timezone comparison issue
          console.log(`Cell for ${studio.name} - ${date.toDateString()} comparing booking: ${booking.title} (${new Date(booking.start).toISOString()})`);
          return isSameDay(new Date(booking.start), date);
        });
        
        // Log how many bookings were found for this cell
        console.log(`Cell for ${studio.name} - ${date.toDateString()} has ${dayBookings.length} bookings`);
        if (dayBookings.length > 0) {
          console.log(`FOUND BOOKINGS for ${studio.name} on ${date.toDateString()}:`, dayBookings.map(b => ({id: b.id, title: b.title, start: new Date(b.start).toISOString()})));
        }
        
        // Calculate dynamic height for cells - same logic as row header
        const baseHeight = 42; // Minimum height for a row with no bookings
        const heightPerBooking = 32; // Additional height per booking (same as header)
        const maxAdditionalHeight = 320; // Maximum additional height (same as header)
        
        // Find max bookings across the entire row to keep consistent height
        // Use the same calculation as in the header to ensure cells match the row height
        const maxBookingsPerDay = weekDates.map(date => {
          const count = studioBookings.filter(booking => {
            const bookingStartDate = new Date(booking.start);
            return isSameDay(bookingStartDate, date);
          }).length;
          return { date: date.toDateString(), count };
        });
        
        // Get the actual max number
        const maxBookingsForStudio = Math.max(...maxBookingsPerDay.map(day => day.count), 0);
        
        console.log(`Cell for ${studio.name} - ${date.toDateString()} has ${dayBookings.length} bookings`);
        
        const additionalHeight = Math.min(maxBookingsForStudio * heightPerBooking, maxAdditionalHeight);
        const cellHeight = baseHeight + additionalHeight;
        
        return (
          <div 
            key={index} 
            className={cn(
              "relative border-b border-r", // Height set by style below
              isWeekend(date) ? "bg-gray-50" : "bg-white",
              isSameDay(date, new Date()) ? "bg-blue-50 border-blue-200" : "",
              "cursor-pointer hover:bg-gray-100 overflow-y-auto" // Added overflow-y-auto for scrolling
            )}
            style={{ height: `${cellHeight}px` }}
            onClick={() => handleCellClick(date)}
          >
            {/* Display booking count if there are many */}
            {dayBookings.length > 5 && (
              <div className="absolute top-0 right-0 z-20 px-1 text-xs font-semibold bg-gray-700 text-white rounded-bl-md">
                {dayBookings.length}
              </div>
            )}
            
            {/* Map through studio bookings and position them dynamically */}
            {dayBookings.map((booking, bookingIndex) => {
              // Determine color based on booking type and severity for alerts
              let colorClass = "bg-blue-100 border-blue-300 text-blue-800";
              
              // For alerts (maintenance and IT support), use severity
              if (booking.type === "maintenance" || booking.type === "it_support") {
                if (booking.severity === "critical") {
                  colorClass = "bg-red-100 border-red-500 border text-red-800 shadow-sm";
                } else if (booking.severity === "high") {
                  colorClass = "bg-orange-100 border-orange-400 border text-orange-800 shadow-sm";
                } else if (booking.severity === "medium") {
                  colorClass = "bg-amber-100 border-amber-400 border text-amber-800 shadow-sm";
                } else {
                  // Low severity or undefined
                  colorClass = "bg-blue-100 border-blue-400 border text-blue-800 shadow-sm";
                }
              } else if (booking.type === "rehearsal") {
                colorClass = "bg-purple-100 border-purple-300 text-purple-800";
              } else if (booking.type === "production") {
                colorClass = "bg-red-100 border-red-300 text-red-800";
              }
              
              // Use custom color if specified
              if (booking.color) {
                // Extract the color but make it lighter for the background
                const color = booking.color;
                const textColor = booking.color;
                
                // Instead of using CSS classes, we'll use inline styles for custom colors
                colorClass = ""; // Clear the predefined class
              }
              
              // Calculate position based on booking index with larger spacing
              // Use a base spacing of 40px between bookings (increased from 28px)
              let topPosition = 4 + (bookingIndex * 40); 
              
              // If we have more than 10 bookings, adjust the spacing to be more compact
              if (dayBookings.length > 10) {
                topPosition = 4 + (bookingIndex * 30); // 30px spacing for dense days (increased from 20px)
              } else if (dayBookings.length > 5) {
                topPosition = 4 + (bookingIndex * 35); // 35px spacing for medium density days (increased from 24px)
              }
              
              console.log(`Booking ${booking.title} in ${studio.name} on ${date.toDateString()} - position: ${topPosition}px`);
              
              // Calculate height for bookings - bigger than before
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
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!readOnly) {
                          onBookingClick(booking);
                        }
                      }}
                    >
                      <div className="flex items-center w-full">
                        {(booking.type === "maintenance" || booking.type === "it_support") && (
                          <span className={`w-2 h-2 rounded-full mr-1 flex-shrink-0 ${
                            booking.severity === "critical" ? "bg-red-500" : 
                            booking.severity === "high" ? "bg-orange-500" :
                            booking.severity === "medium" ? "bg-amber-500" : "bg-blue-500"
                          }`}></span>
                        )}
                        <span className="font-medium inline-block w-full overflow-hidden text-ellipsis">
                          {booking.title}
                          {booking.pcrRoomId ? ` (${getPcrRoomName(booking.pcrRoomId)})` : ''}
                        </span>
                      </div>
                      <div className="text-xs pl-3">
                        {formatTime(new Date(booking.start))} - {formatTime(new Date(booking.end))}
                      </div>
                    </div>
                  </HoverCardTrigger>
                  <HoverCardContent className="w-80 p-4">
                    <div className="space-y-3">
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
                      <div className="space-y-1">
                        <div className="flex items-center text-xs text-muted-foreground">
                          <CalendarClock className="mr-1 h-3 w-3" />
                          <span>{formatDate(booking.start)}</span>
                        </div>
                        <div className="flex items-center text-xs text-muted-foreground">
                          <Clock className="mr-1 h-3 w-3" />
                          <span>{formatTime(booking.start)} - {formatTime(booking.end)}</span>
                        </div>
                        <div className="flex items-center text-xs text-muted-foreground">
                          <Tag className="mr-1 h-3 w-3" />
                          <span className="capitalize">{booking.type.replace('_', ' ')}</span>
                        </div>
                        {booking.pcrRoomId && (
                          <div className="flex items-center text-xs text-muted-foreground">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1 h-3 w-3">
                              <path d="M20 16V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9m16 0H4m16 0 1.28 2.55a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45L4 16"></path>
                            </svg>
                            <span>{getPcrRoomName(booking.pcrRoomId)}</span>
                          </div>
                        )}
                        {booking.description && (
                          <div className="flex items-start mt-2 text-xs text-muted-foreground">
                            <FileText className="mr-1 h-3 w-3 mt-0.5 flex-shrink-0" />
                            <span>{booking.description}</span>
                          </div>
                        )}
                        {booking.notifyList && booking.notifyList.length > 0 && (
                          <div className="mt-2">
                            <div className="text-xs font-medium mb-1">Notifying:</div>
                            <div className="flex flex-wrap gap-1">
                              {Array.isArray(booking.notifyList) && booking.notifyList.map((crew: string, i: number) => (
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
