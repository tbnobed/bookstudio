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

  // Filter bookings if selectedStudioIds is provided
  const filteredBookings = selectedStudioIds.length > 0
    ? bookings.filter(booking => {
        // Include bookings with a direct studio ID match
        if (booking.studioId && selectedStudioIds.includes(booking.studioId)) {
          return true;
        }
        
        // Check for bookings with studio links
        const links = bookingStudioLinks.filter(link => link.bookingId === booking.id);
        return links.some(link => selectedStudioIds.includes(link.studioId));
      })
    : bookings;

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

  // Get the appropriate booking class based on booking type
  const getBookingClass = (booking: Booking) => {
    const baseClasses = "mb-4 p-4 rounded-md shadow-sm cursor-pointer";
    
    switch (booking.type) {
      case "maintenance":
        return `${baseClasses} bg-amber-100 hover:bg-amber-200 border-l-4 border-amber-500`;
      case "it_support":
        return `${baseClasses} bg-red-100 hover:bg-red-200 border-l-4 border-red-500`;
      case "rehearsal":
        return `${baseClasses} bg-purple-100 hover:bg-purple-200 border-l-4 border-purple-500`;
      case "production":
        return `${baseClasses} bg-blue-100 hover:bg-blue-200 border-l-4 border-blue-500`;
      default:
        return `${baseClasses} bg-gray-100 hover:bg-gray-200 border-l-4 border-gray-500`;
    }
  };

  // Get studio names for a booking
  const getStudiosForBooking = (booking: Booking) => {
    // First check for direct studioId assignment
    if (booking.studioId && studioIdMap[booking.studioId]) {
      return [studioIdMap[booking.studioId].name];
    }
    
    // Then check booking-studio links
    const links = bookingStudioLinks.filter(link => link.bookingId === booking.id);
    const studioNames = links
      .map(link => studioIdMap[link.studioId]?.name)
      .filter(Boolean); // Remove any undefined names
    
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
      <div className="overflow-auto h-[calc(100vh-8rem)]">
        <div className="p-4">
          {/* Date header */}
          <div className="sticky top-0 z-10 bg-white pb-2 mb-4 border-b">
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
            <div className="text-center py-8 text-gray-500">
              No bookings scheduled for this day.
            </div>
          ) : (
            <div className="space-y-1">
              {sortedBookings.map((booking) => (
                <div 
                  key={booking.id} 
                  className={getBookingClass(booking)}
                  onClick={() => handleBookingClick(booking)}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-lg">{booking.title}</h3>
                      <p className="text-sm text-gray-700">{formatBookingTime(booking)}</p>
                      <div className="text-sm mt-2">
                        <span className="font-medium">Studios: </span>
                        {getStudiosForBooking(booking).join(', ')}
                      </div>
                      {booking.pcrRoomId && (
                        <div className="text-sm mt-1">
                          <span className="font-medium">PCR Room: </span>
                          {booking.pcrRoomId}
                        </div>
                      )}
                    </div>
                    <div className="px-2 py-1 rounded text-xs capitalize">
                      {booking.type}
                    </div>
                  </div>
                  {booking.description && (
                    <p className="mt-2 text-sm text-gray-600">{booking.description}</p>
                  )}
                </div>
              ))}
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
