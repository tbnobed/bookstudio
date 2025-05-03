import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Booking, Studio } from "@shared/schema";
import { cn } from "@/lib/utils";
import { createTimeSlots, formatTime } from "@/lib/dateUtils";
import BookingModal from "@/components/booking/BookingModal";
import AlertModal from "@/components/alerts/AlertModal";

interface DailyCalendarProps {
  currentDate: Date;
  selectedStudioIds?: number[];
}

export default function DailyCalendar({ currentDate, selectedStudioIds = [] }: DailyCalendarProps) {
  const [timeSlots, setTimeSlots] = useState<string[]>([]);
  const [editBooking, setEditBooking] = useState<Booking | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isEditAlertModalOpen, setIsEditAlertModalOpen] = useState(false);
  const [isNewBookingModalOpen, setIsNewBookingModalOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ studio: Studio; time: string } | null>(null);

  // Create time slots from 6am to 10pm in 30-minute intervals
  useEffect(() => {
    setTimeSlots(createTimeSlots(6, 22, 30));
  }, []);

  // Fetch studios
  const { data: studios = [] } = useQuery<Studio[]>({
    queryKey: ["/api/studios"],
  });

  // Prepare date range for the day (midnight to midnight)
  const dayStart = new Date(currentDate);
  dayStart.setHours(0, 0, 0, 0);
  
  const dayEnd = new Date(currentDate);
  dayEnd.setHours(23, 59, 59, 999);

  // Fetch bookings for the day
  const { data: bookings = [] } = useQuery<Booking[]>({
    queryKey: [`/api/bookings?start=${dayStart.toISOString()}&end=${dayEnd.toISOString()}`],
  });

  // Filter studios if selectedStudioIds is provided
  const filteredStudios = selectedStudioIds.length > 0
    ? studios.filter((studio) => selectedStudioIds.includes(studio.id))
    : studios;

  // Handle cell click to create a new booking
  const handleSlotClick = (studio: Studio, time: string) => {
    setSelectedSlot({ studio, time });
    setIsNewBookingModalOpen(true);
  };

  // Handle booking click for editing
  const handleBookingClick = (booking: Booking) => {
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
  };

  // Check if a booking overlaps with a time slot
  const getBookingForTimeSlot = (studioId: number, timeSlot: string) => {
    const slotTime = parseTimeString(timeSlot);
    
    // Convert slot time to a Date object
    const slotDateTime = new Date(currentDate);
    slotDateTime.setHours(slotTime.hour, slotTime.minute, 0, 0);
    
    // Add 30 minutes to get the end time
    const slotEndDateTime = new Date(slotDateTime);
    slotEndDateTime.setMinutes(slotEndDateTime.getMinutes() + 30);
    
    // Find a booking that overlaps with this slot
    return bookings.find(booking => {
      const bookingStart = new Date(booking.start);
      const bookingEnd = new Date(booking.end);
      
      // Check if this booking is for this studio
      if (booking.studioId !== studioId) return false;
      
      // Check if the booking overlaps with the slot time
      return (
        (bookingStart <= slotDateTime && bookingEnd > slotDateTime) ||
        (bookingStart < slotEndDateTime && bookingEnd >= slotEndDateTime) ||
        (bookingStart >= slotDateTime && bookingEnd <= slotEndDateTime)
      );
    });
  };

  // Helper to parse time strings like "08:30" into hours and minutes
  const parseTimeString = (timeString: string) => {
    const [hour, minute] = timeString.split(":").map(Number);
    return { hour, minute };
  };

  // Get the appropriate slot class based on booking type
  const getSlotClass = (booking: Booking | undefined) => {
    if (!booking) return "bg-white hover:bg-gray-100";
    
    switch (booking.type) {
      case "maintenance":
        return "bg-amber-100 hover:bg-amber-200";
      case "it_support":
        return "bg-red-100 hover:bg-red-200";
      case "rehearsal":
        return "bg-purple-100 hover:bg-purple-200";
      case "production":
        return "bg-blue-100 hover:bg-blue-200";
      default:
        return "bg-gray-100 hover:bg-gray-200";
    }
  };

  return (
    <>
      <div className="overflow-auto h-[calc(100vh-8rem)]">
        <div className="min-w-[800px]">
          {/* Time Column Header */}
          <div className="grid grid-cols-[100px_repeat(auto-fill,1fr)] sticky top-0 z-10">
            <div className="h-14 border-b bg-white font-medium flex items-center justify-center">Time</div>
            {filteredStudios.map((studio) => (
              <div key={studio.id} className="h-14 border-b bg-white font-medium flex items-center justify-center px-2">
                {studio.name}
              </div>
            ))}
          </div>

          {/* Time Grid */}
          {timeSlots.map((timeSlot, index) => (
            <div key={index} className="grid grid-cols-[100px_repeat(auto-fill,1fr)]">
              <div className="h-12 border-b bg-gray-50 flex items-center justify-center text-sm font-medium">
                {formatTime(new Date(`2000-01-01T${timeSlot}:00`))}
              </div>
              
              {filteredStudios.map((studio) => {
                const booking = getBookingForTimeSlot(studio.id, timeSlot);
                return (
                  <div 
                    key={studio.id} 
                    className={cn(
                      "h-12 border-b border-r cursor-pointer",
                      getSlotClass(booking)
                    )}
                    onClick={() => booking 
                      ? handleBookingClick(booking) 
                      : handleSlotClick(studio, timeSlot)
                    }
                  >
                    {booking && (
                      <div className="px-2 py-1 text-xs truncate">
                        <div className="font-medium">{booking.title}</div>
                        <div>{formatTime(new Date(booking.start))} - {formatTime(new Date(booking.end))}</div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
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
      {selectedSlot && (
        <BookingModal
          isOpen={isNewBookingModalOpen}
          onClose={() => setIsNewBookingModalOpen(false)}
          selectedDate={currentDate}
          selectedStudio={selectedSlot.studio.id}
        />
      )}
    </>
  );
}
