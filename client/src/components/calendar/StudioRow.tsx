import { useMemo, useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Booking, Studio, PcrRoom, BookingStudio } from "@shared/schema";
import { formatTime, formatDate, isWeekend, isSameDay, formatDateTimeRange, isBookingActive } from "@/lib/dateUtils";
import { HoverCard, HoverCardTrigger } from "@/components/ui/hover-card";
import { BookingHoverCard } from "@/components/booking/BookingHoverCard";
import { CalendarClock, Clock, FileText, User, Tag } from "lucide-react";
import { useBookingStudioLinks } from "@/hooks/useBookingStudioLinks";
import { useNotificationGroups } from "@/hooks/useNotificationGroups";
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
    // Skip cancelled bookings - they don't make studios "in-use"
    if (booking.status === 'cancelled') return false;
    
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
  // Live clock for real-time status updates - updates every 30 seconds
  const [now, setNow] = useState(() => new Date());
  
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
    }, 30000); // Update every 30 seconds
    
    return () => clearInterval(interval);
  }, []);
  
  // Fetch all booking-studio links to determine which bookings are associated with this studio via junction table
  // Use public endpoint if in readOnly mode (public calendar view)
  const { data: bookingStudioLinks = [] } = useBookingStudioLinks(undefined, readOnly);
  
  // Fetch notification groups to display names instead of IDs
  const { notificationGroups } = useNotificationGroups();
  
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
    
    // Pass the click event up to the parent component via onBookingClick
    const startDate = date;
    const endDate = new Date(date.getTime() + 60 * 60 * 1000); // Default 1 hour
    
    // Log the studio ID we're trying to use for the new booking
    console.log(`StudioRow - Creating new booking for studio ID: ${studio.id} (${studio.name})`);
    
    onBookingClick({
      id: 0, // Temporary ID for new booking
      title: "New Booking",
      start: startDate,
      end: endDate,
      studioId: studio.id, // This studio ID should be used for the selectedStudio prop
      type: "production",
      description: "",
      userId: 0,
      // Add required properties to satisfy the Booking type
      pcrRoomId: null,
      severity: null,
      templateId: null,
      notifyList: [],
      color: null,
      createdAt: null,
      status: "confirmed", // Add status field
      linkedGroupId: null // Add linkedGroupId field
    });
  };

  return (
    <>
      {/* Calculate row height dynamically based on the maximum number of bookings for this studio on any day */}
      {(() => {
        // Count max bookings for this studio in any day using the combined bookings list
        const maxBookingsPerDay = weekDates.map(date => {
          const count = studioBookings.filter(
            booking => {
              const bookingStartsOnDate = isSameDay(booking.start, date);
              return bookingStartsOnDate;
            }
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
            className="border-b dark:border-gray-700 border-r dark:border-gray-700 flex items-center px-3 sticky left-0 z-20 bg-white dark:bg-gray-900 w-[160px] min-w-[160px] max-w-[160px] overflow-hidden" 
            style={{ height: `${rowHeight}px` }}
          >
            {/* Studio status indicator */}
            {(() => {
              // Determine if studio is currently in use by checking both direct assignments and junction table
              // Uses the live 'now' state from the component for real-time updates
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
              
              return <div className={`w-2 h-2 rounded-full mr-2 flex-shrink-0 ${statusClass}`}></div>;
            })()}
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate flex-1 min-w-0">{studio.name}</span>
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
            return isSameDay(booking.start, date);
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
              "flex flex-col border-b dark:border-gray-700 border-r dark:border-gray-700 p-1", // Use flex column layout
              isWeekend(date) ? "bg-gray-50 dark:bg-gray-800" : "bg-white dark:bg-gray-900",
              isSameDay(date, new Date()) ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700" : "",
              "cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 overflow-y-auto" // Added overflow-y-auto for scrolling
            )}
            style={{ minHeight: `${cellHeight}px` }}
            onClick={() => handleCellClick(date)}
          >
            {/* Display booking count if there are many */}
            {dayBookings.length > 5 && (
              <div className="self-end px-1 text-xs font-semibold bg-gray-700 dark:bg-gray-600 text-white rounded-md mb-1">
                {dayBookings.length} bookings
              </div>
            )}
            
            {/* Map through studio bookings and position them dynamically */}
            {dayBookings.map((booking) => {
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
                // Instead of using CSS classes, we'll use inline styles for custom colors
                colorClass = "border"; // Keep only the border class, we'll style it with inline styles
              }
              
              // Check if booking is currently active
              const isActive = isBookingActive(booking);
              
              // No positioning calculations - just render in a grid
              // This eliminates layout shifts completely
              console.log(`Rendering booking ${booking.title} in ${studio.name} on ${date.toDateString()}`);
              
              return (
                <HoverCard key={booking.id}>
                  <HoverCardTrigger asChild>
                    <div 
                      className={cn(
                        "border dark:border-gray-600 rounded-md px-2 py-1 mb-1 overflow-hidden text-overflow-ellipsis text-xs z-10 transition-all hover:shadow-md",
                        colorClass,
                        booking.status === "tentative" && "border-dashed opacity-80 bg-gray-100 dark:bg-gray-800",
                        booking.status === "cancelled" && "opacity-60 bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700 line-through text-red-600 dark:text-red-400",
                        isActive && "animate-pulse ring-2 ring-green-400 ring-opacity-75 shadow-lg"
                      )}
                      style={{
                        minHeight: "38px",
                        ...(booking.status === "cancelled" ? {
                          backgroundColor: "#fef2f2",
                          borderColor: "#fca5a5",
                          color: "#dc2626",
                          textDecoration: "line-through"
                        } : booking.color && booking.status !== "tentative" ? {
                          backgroundColor: `${booking.color}20`, // 20 is hex for 12% opacity
                          borderColor: booking.color,
                          color: booking.color
                        } : booking.status === "tentative" ? {
                          borderColor: booking.color || "#666",
                          color: booking.color || "#666"
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
                        {(booking.type === "maintenance" || booking.type === "it_support") && (
                          <span className={`w-2 h-2 rounded-full mr-1 flex-shrink-0 ${
                            booking.severity === "critical" ? "bg-red-500" : 
                            booking.severity === "high" ? "bg-orange-500" :
                            booking.severity === "medium" ? "bg-amber-500" : "bg-blue-500"
                          }`}></span>
                        )}
                        <span className="font-medium inline-block w-full overflow-hidden text-ellipsis whitespace-nowrap">
                          {booking.title}
                          {booking.pcrRoomId ? ` (${getPcrRoomName(booking.pcrRoomId)})` : ''}
                          {booking.status === "tentative" && (
                            <span className="ml-1 text-[10px] px-1 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded">Tentative</span>
                          )}
                        </span>
                      </div>
                      <div className="text-xs pl-3 whitespace-nowrap">
                        {formatTime(new Date(booking.start))} - {formatTime(new Date(booking.end))}
                      </div>
                    </div>
                  </HoverCardTrigger>
                  <BookingHoverCard 
                    booking={booking} 
                    notificationGroups={notificationGroups}
                    bookingStudioLinks={bookingStudioLinks}
                    readOnly={readOnly}
                    onEdit={() => onBookingClick(booking)}
                  />
                </HoverCard>
              );
            })}
          </div>
        );
      })}
    </>
  );
}
