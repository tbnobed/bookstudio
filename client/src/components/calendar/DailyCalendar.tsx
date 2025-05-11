import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Booking, Studio, BookingStudio } from "@shared/schema";
import { cn } from "@/lib/utils";
import { createTimeSlots, formatTime } from "@/lib/dateUtils";
import BookingModal from "@/components/booking/BookingModal";
import AlertModal from "@/components/alerts/AlertModal";
import { format } from "date-fns";

interface DailyCalendarProps {
  date: Date;
  selectedStudioIds?: number[];
  studios?: Studio[];
  bookings?: Booking[];
  readOnly?: boolean;
}

export default function DailyCalendar({ 
  date: currentDate, 
  selectedStudioIds = [], 
  studios: propStudios = [], 
  bookings: propBookings = [], 
  readOnly = false 
}: DailyCalendarProps) {
  const [editBooking, setEditBooking] = useState<Booking | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isEditAlertModalOpen, setIsEditAlertModalOpen] = useState(false);
  const [isNewBookingModalOpen, setIsNewBookingModalOpen] = useState(false);
  const [selectedStudio, setSelectedStudio] = useState<Studio | null>(null);
  const [studioIdMap, setStudioIdMap] = useState<Record<number, Studio>>({});

  // Fetch studios only if not provided via props
  const { data: fetchedStudios = [] } = useQuery<Studio[]>({
    queryKey: ["/api/studios"],
    enabled: propStudios.length === 0,
  });

  const studios = propStudios.length > 0 ? propStudios : fetchedStudios;

  // Prepare date range for the day (midnight to midnight)
  const dayStart = new Date(currentDate);
  dayStart.setHours(0, 0, 0, 0);
  
  const dayEnd = new Date(currentDate);
  dayEnd.setHours(23, 59, 59, 999);

  // Fetch bookings only if not provided via props
  const { data: fetchedBookings = [] } = useQuery<Booking[]>({
    queryKey: ['/api/bookings', { start: dayStart.toISOString(), end: dayEnd.toISOString() }],
    enabled: propBookings.length === 0,
  });

  const bookings = propBookings.length > 0 ? propBookings : fetchedBookings;

  // Fetch booking-studio links for multi-studio bookings
  const { data: bookingStudioLinks = [] } = useQuery<BookingStudio[]>({
    queryKey: ['/api/booking-studios'],
  });

  // Create a map of studio IDs to studio objects for quick lookups
  useEffect(() => {
    if (studios.length > 0) {
      const studioMap: Record<number, Studio> = {};
      studios.forEach(studio => {
        studioMap[studio.id] = studio;
      });
      setStudioIdMap(studioMap);
    }
  }, [studios]);

  // Helper function to check if a booking overlaps with the current day
  const isBookingForCurrentDay = (booking: Booking) => {
    // Start and end dates of the booking
    const bookingStart = new Date(booking.start);
    const bookingEnd = new Date(booking.end);
    
    // Start and end of the current day
    const dayStart = new Date(currentDate);
    dayStart.setHours(0, 0, 0, 0);
    
    const dayEnd = new Date(currentDate);
    dayEnd.setHours(23, 59, 59, 999);
    
    // Check if booking overlaps with the current day
    return (
      (bookingStart <= dayEnd && bookingEnd >= dayStart)
    );
  };
  
  // Helper function to check if a booking is associated with a studio
  const isBookingForStudio = (booking: Booking, studioId: number) => {
    // Check direct studio assignment
    if (booking.studioId === studioId) {
      return true;
    }
    
    // Check studio links
    const links = bookingStudioLinks.filter(link => link.bookingId === booking.id);
    return links.some(link => link.studioId === studioId);
  };
  
  // Process bookings to include studio details
  const processedBookings = bookings
    .filter(isBookingForCurrentDay)
    .map(booking => {
      // Get all studios linked to this booking
      const linkedStudioIds: number[] = [];
      
      // Add the primary studio if set
      if (booking.studioId) {
        linkedStudioIds.push(booking.studioId);
      }
      
      // Add all linked studios
      const links = bookingStudioLinks.filter(link => link.bookingId === booking.id);
      links.forEach(link => {
        if (!linkedStudioIds.includes(link.studioId)) {
          linkedStudioIds.push(link.studioId);
        }
      });
      
      return {
        ...booking,
        linkedStudioIds
      };
    });
  
  // Define types for processed bookings
  type ProcessedBooking = Booking & { linkedStudioIds: number[] };

  // Separate bookings into regular bookings and facility-wide alerts
  const { alerts, regularBookings } = processedBookings.reduce<{
    alerts: ProcessedBooking[],
    regularBookings: ProcessedBooking[]
  }>((acc, booking) => {
    // Check if it's a facility-wide alert (maintenance or IT support without a specific studio)
    const isFacilityAlert = 
      ((booking.type.includes('maintenance') || booking.type === 'it_support') && 
       booking.studioId === null && 
       booking.linkedStudioIds.length === 0);
    
    if (isFacilityAlert) {
      acc.alerts.push(booking as ProcessedBooking);
    } else {
      acc.regularBookings.push(booking as ProcessedBooking);
    }
    return acc;
  }, { alerts: [], regularBookings: [] });
  
  // Filter regular bookings by selected studios if provided
  const filteredRegularBookings = regularBookings.filter(booking => {
    // If no studio IDs are selected, include all bookings for the day
    if (selectedStudioIds.length === 0) {
      return true;
    }
    
    // Check if any of the booking's linked studios match the selected studios
    return booking.linkedStudioIds.some((studioId: number) => selectedStudioIds.includes(studioId));
  });
  
  // Always include facility-wide alerts regardless of studio selection
  const filteredBookings = [...filteredRegularBookings, ...alerts];

  // Sort bookings chronologically by start time
  const sortedBookings = [...filteredBookings].sort((a, b) => {
    const dateA = new Date(a.start);
    const dateB = new Date(b.start);
    return dateA.getTime() - dateB.getTime();
  });

  // Handle booking click for editing
  const handleBookingClick = (booking: Booking) => {
    // Only allow editing if not in readOnly mode
    if (!readOnly) {
      // Check if it's a facility-wide alert
      if ((booking.type === "maintenance" || booking.type === "it_support") && booking.studioId === null) {
        // Use the dedicated AlertModal for facility-wide alerts
        setEditBooking(booking);
        setIsEditAlertModalOpen(true);
      } else {
        // Use regular BookingModal for studio bookings
        setEditBooking(booking);
        setIsEditModalOpen(true);
      }
    }
  };

  // Handle "New Booking" button click
  const handleNewBooking = (studio: Studio | null) => {
    if (!readOnly) {
      setSelectedStudio(studio);
      setIsNewBookingModalOpen(true);
    }
  };

  // Get PCR room data for lookups
  const { data: pcrRooms = [] } = useQuery<any[]>({
    queryKey: ['/api/pcr-rooms'],
  });
  
  // Get PCR room name for a booking
  const getPcrRoomName = (pcrRoomId: number | null) => {
    if (!pcrRoomId) return null;
    
    // Find PCR room in fetched data
    const pcrRoom = pcrRooms.find((room: any) => room.id === pcrRoomId);
    return pcrRoom?.name || `PCR Room ${pcrRoomId}`;
  };

  type BookingStyle = {
    className: string;
    style: React.CSSProperties;
  }

  // Check if a booking is a facility-wide alert
  const isFacilityAlert = (booking: Booking) => {
    return (booking.type.includes('maintenance') || booking.type === 'it_support') && 
           booking.studioId === null;
  };

  // Get the appropriate booking class based on booking type and color
  const getBookingClass = (booking: Booking): BookingStyle => {
    const baseClasses = "mb-4 p-4 rounded-md shadow cursor-pointer border transition-all duration-200 hover:shadow-md";
    
    // Special styling for facility-wide alerts
    if (isFacilityAlert(booking)) {
      const isHighSeverity = booking.severity === 'critical';
      const alertClasses = isHighSeverity
        ? `${baseClasses} bg-red-100 hover:bg-red-200 border-red-500 border-2`
        : `${baseClasses} bg-amber-100 hover:bg-amber-200 border-amber-500`;
      
      return {
        className: `${alertClasses} flex flex-col`,
        style: { borderWidth: isHighSeverity ? '2px' : '1px' }
      };
    }
    
    // If booking has a custom color, use it
    if (booking.color) {
      const colorStyle: React.CSSProperties = { 
        borderLeftColor: booking.color,
        borderLeftWidth: '4px',
        backgroundColor: `${booking.color}10` // 10 is hex for 6% opacity
      };
      
      return {
        className: `${baseClasses} hover:bg-opacity-30`,
        style: colorStyle
      };
    }
    
    // Otherwise use the default type-based colors
    let className = "";
    let style: React.CSSProperties = {};
    
    switch (booking.type) {
      case "maintenance":
      case "all-day:maintenance":
        className = `${baseClasses} bg-amber-50 hover:bg-amber-100 border-amber-400`;
        style = { borderLeftWidth: '4px' };
        break;
      case "it_support":
        className = `${baseClasses} bg-red-50 hover:bg-red-100 border-red-400`;
        style = { borderLeftWidth: '4px' };
        break;
      case "rehearsal":
        className = `${baseClasses} bg-purple-50 hover:bg-purple-100 border-purple-400`;
        style = { borderLeftWidth: '4px' };
        break;
      case "production":
        className = `${baseClasses} bg-blue-50 hover:bg-blue-100 border-blue-400`;
        style = { borderLeftWidth: '4px' };
        break;
      default:
        className = `${baseClasses} bg-gray-50 hover:bg-gray-100 border-gray-400`;
        style = { borderLeftWidth: '4px' };
    }
    
    return { className, style };
  };

  // Get studio names for a booking using linkedStudioIds
  const getStudiosForBooking = (booking: any) => {
    const studioNames: string[] = [];
    
    // Use the linkedStudioIds if it's a processed booking
    if (booking.linkedStudioIds && booking.linkedStudioIds.length > 0) {
      booking.linkedStudioIds.forEach((studioId: number) => {
        if (studioIdMap[studioId]?.name) {
          studioNames.push(studioIdMap[studioId].name);
        }
      });
    } 
    // Fallback to direct studio ID if linkedStudioIds is not available
    else if (booking.studioId && studioIdMap[booking.studioId]) {
      studioNames.push(studioIdMap[booking.studioId].name);
    }
    // Fallback to checking booking-studio links directly
    else {
      const links = bookingStudioLinks.filter(link => link.bookingId === booking.id);
      links.forEach(link => {
        if (studioIdMap[link.studioId]?.name && !studioNames.includes(studioIdMap[link.studioId].name)) {
          studioNames.push(studioIdMap[link.studioId].name);
        }
      });
    }
    
    return studioNames.length > 0 ? studioNames : ['No studio assigned'];
  };

  // Format booking time
  const formatBookingTime = (booking: Booking) => {
    const start = new Date(booking.start);
    const end = new Date(booking.end);
    return `${formatTime(start)} - ${formatTime(end)}`;
  };

  return (
    <>
      <div className="overflow-auto h-[calc(100vh-5rem)] w-full">
        <div className="p-3">
          {/* Date header */}
          <div className="sticky top-0 z-10 bg-white pb-2 mb-3 border-b">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">
                {format(currentDate, "EEEE, MMMM d, yyyy")}
              </h2>
              {!readOnly && (
                <button 
                  onClick={() => handleNewBooking(null)} 
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  + New Booking
                </button>
              )}
            </div>
          </div>

          {/* Chronological booking list */}
          {sortedBookings.length === 0 ? (
            <div className="text-center py-12 px-4">
              <div className="p-6 border border-dashed border-gray-300 rounded-lg bg-gray-50">
                <h3 className="text-lg font-medium text-gray-600 mb-1">No Bookings</h3>
                <p className="text-gray-500">There are no bookings scheduled for this day.</p>
                {!readOnly && (
                  <button 
                    onClick={() => handleNewBooking(null)} 
                    className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
                  >
                    Create a Booking
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              {sortedBookings.map((booking) => {
                const bookingStyle = getBookingClass(booking);
                const pcrRoomName = booking.pcrRoomId ? getPcrRoomName(booking.pcrRoomId) : null;
                
                return (
                  <div 
                    key={booking.id} 
                    className={bookingStyle.className}
                    style={bookingStyle.style}
                    onClick={() => handleBookingClick(booking)}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-bold text-lg">{booking.title}</h3>
                        <p className="text-sm text-gray-700">{formatBookingTime(booking)}</p>
                        
                        {/* Studios with improved styling */}
                        {isFacilityAlert(booking) ? (
                          <div className="mt-2 flex items-center">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              <svg 
                                xmlns="http://www.w3.org/2000/svg" 
                                viewBox="0 0 24 24" 
                                fill="currentColor" 
                                className="w-4 h-4 mr-1"
                              >
                                <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
                              </svg>
                              Facility-wide Alert
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-wrap mt-3 gap-1">
                            {getStudiosForBooking(booking).map((studioName, index) => (
                              <span 
                                key={index} 
                                className="px-2 py-1 bg-blue-100 text-blue-800 rounded-md text-xs font-medium"
                              >
                                {studioName}
                              </span>
                            ))}
                          </div>
                        )}
                        
                        {/* PCR Room with improved styling */}
                        {booking.pcrRoomId && (
                          <div className="mt-2">
                            <span 
                              className="px-2 py-1 bg-purple-100 text-purple-800 rounded-md text-xs font-medium inline-flex items-center"
                            >
                              <span className="mr-1">🎛️</span> {pcrRoomName}
                            </span>
                          </div>
                        )}
                      </div>
                      {/* Improved booking type badge */}
                      <div className={`px-2 py-1 rounded-full shadow-sm text-xs font-semibold capitalize ${
                        booking.type.includes('maintenance') ? 'bg-amber-200 text-amber-800' :
                        booking.type === 'it_support' ? 'bg-red-200 text-red-800' :
                        booking.type === 'rehearsal' ? 'bg-purple-200 text-purple-800' :
                        booking.type === 'production' ? 'bg-blue-200 text-blue-800' :
                        'bg-gray-200 text-gray-800'
                      }`}>
                        {booking.type.replace('all-day:', '')}
                      </div>
                    </div>
                    {booking.description && (
                      <div className="mt-3 pt-2 border-t border-gray-200">
                        <p className="text-sm text-gray-700">{booking.description}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Edit Booking Modal - for studio bookings */}
      {editBooking && (
        <BookingModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          booking={editBooking}
        />
      )}
      
      {/* Edit Alert Modal - for facility-wide alerts */}
      {editBooking && (
        <AlertModal
          isOpen={isEditAlertModalOpen}
          onClose={() => setIsEditAlertModalOpen(false)}
          alert={editBooking}
        />
      )}

      {/* New Booking Modal */}
      <BookingModal
        isOpen={isNewBookingModalOpen}
        onClose={() => setIsNewBookingModalOpen(false)}
        selectedDate={currentDate}
        selectedStudio={selectedStudio?.id}
      />
    </>
  );
}
