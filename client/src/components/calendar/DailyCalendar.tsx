import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Booking, Studio, BookingStudio, PcrRoom } from "@shared/schema";
import { cn } from "@/lib/utils";
import { createTimeSlots, formatTime } from "@/lib/dateUtils";
import BookingModal from "@/components/booking/BookingModal";
import AlertModal from "@/components/alerts/AlertModal";
import { Clock, Users, Tv } from "lucide-react";
import DayListView from "@/components/calendar/DayListView";
import DayChronView from "@/components/calendar/DayChronView";
import DayTimelineView from "@/components/calendar/DayTimelineView";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";

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
  const [timeSlots, setTimeSlots] = useState<string[]>([]);
  const [editBooking, setEditBooking] = useState<Booking | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isEditAlertModalOpen, setIsEditAlertModalOpen] = useState(false);
  const [isNewBookingModalOpen, setIsNewBookingModalOpen] = useState(false);
  const [isNewAlertModalOpen, setIsNewAlertModalOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ studio: Studio; time: string } | null>(null);

  // Create time slots from 6am to 10pm in 30-minute intervals
  useEffect(() => {
    setTimeSlots(createTimeSlots(6, 22, 30));
  }, []);

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

  const rawBookings = propBookings.length > 0 ? propBookings : fetchedBookings;

  // Fetch booking-studio links to show multiple studios per booking
  const { data: bookingStudioLinks = [] } = useQuery<BookingStudio[]>({
    queryKey: ['/api/booking-studios'],
  });

  // Filter studios if selectedStudioIds is provided
  const filteredStudios = selectedStudioIds.length > 0
    ? studios.filter((studio) => selectedStudioIds.includes(studio.id))
    : studios;

  // Filter bookings based on selectedStudioIds
  const bookings = selectedStudioIds.length > 0 
    ? rawBookings.filter(booking => {
        // Always include facility alerts (no studio assignment)
        if (booking.studioId === null) {
          return true;
        }
        
        // Check if booking is directly assigned to a selected studio
        const directMatch = selectedStudioIds.includes(booking.studioId);
        
        // Check if booking is linked to a selected studio via junction table
        const linkedMatch = bookingStudioLinks.some(link => 
          link.bookingId === booking.id && selectedStudioIds.includes(link.studioId)
        );
        
        return directMatch || linkedMatch;
      })
    : rawBookings;

  // Handle cell click to create a new booking
  const handleSlotClick = (studio: Studio, time: string) => {
    // Only allow booking creation if not in readOnly mode
    if (!readOnly) {
      setSelectedSlot({ studio, time });
      setIsNewBookingModalOpen(true);
    }
  };

  // Handle booking click for editing
  const handleBookingClick = (booking: any) => {
    // Only allow editing if not in readOnly mode
    if (!readOnly) {
      console.log("[DEBUG] Handling booking click:", booking);
      
      // Special case: handle new booking requests
      if (booking.isNew) {
        console.log("[DEBUG] Creating new booking from day view");
        // Create a fake studio object for selectedSlot
        const studio = filteredStudios.find(s => s.id === booking.studioId) || filteredStudios[0];
        if (studio) {
          setSelectedSlot({ studio, time: "09:00" }); // Default time
          setIsNewBookingModalOpen(true);
        }
        return;
      }
      
      // Special case: this could be a new alert request from the "Add Alert" button
      if (booking.type && booking.type === "all-day:maintenance" && !booking.id) {
        console.log("[DEBUG] Creating new alert from button click");
        setIsNewAlertModalOpen(true);
        return;
      }
      
      // Check if it's a facility-wide alert or critical maintenance booking
      const isAlert = 
        // Regular maintenance or IT support
        ((booking.type === "maintenance" || booking.type === "it_support") && booking.studioId === null) ||
        // All-day maintenance or all-day IT support
        ((booking.type?.includes("maintenance") || booking.type?.includes("it_support")) && booking.severity === "critical") ||
        // Explicit alert type
        booking.type === "alert" ||
        // Title includes "alert"
        (booking.title && booking.title.toLowerCase().includes("alert"));
        
      console.log("[DEBUG] Is this an alert?", isAlert);
      
      if (isAlert) {
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
      // Create defensive copies of booking dates to avoid timezone issues
      const bookingStart = new Date(booking.start);
      const bookingEnd = new Date(booking.end);
      
      // Also create defensive copies of slot dates
      const slotStartCopy = new Date(slotDateTime.getTime());
      const slotEndCopy = new Date(slotEndDateTime.getTime());
      
      // Check if this booking is for this studio
      if (booking.studioId !== studioId) return false;
      
      // Check if the booking overlaps with the slot time
      return (
        (bookingStart <= slotStartCopy && bookingEnd > slotStartCopy) ||
        (bookingStart < slotEndCopy && bookingEnd >= slotEndCopy) ||
        (bookingStart >= slotStartCopy && bookingEnd <= slotEndCopy)
      );
    });
  };

  // Helper to parse time strings like "08:30" into hours and minutes
  const parseTimeString = (timeString: string) => {
    const [hour, minute] = timeString.split(":").map(Number);
    return { hour, minute };
  };

  // Define type for PCR Room
  type PcrRoom = {
    id: number;
    name: string;
    description: string;
    status?: string;
  };

  // Fetch PCR rooms to display with bookings
  const { data: pcrRooms = [] } = useQuery<PcrRoom[]>({
    queryKey: ['/api/pcr-rooms'],
  });

  // Get a PCR room name by its ID
  const getPcrRoomName = (pcrRoomId: number | null) => {
    if (!pcrRoomId) return null;
    const room = pcrRooms.find(room => room.id === pcrRoomId);
    return room ? room.name : null;
  };

  // Define type for BookingStudio (junction table)
  type BookingStudio = {
    id: number;
    bookingId: number;
    studioId: number;
  };

  // Get all studios for a booking
  const getBookingStudios = (bookingId: number): Studio[] => {
    if (!bookingStudioLinks || !studios) return [];
    
    // Filter booking-studio links for this booking
    const links = bookingStudioLinks.filter(link => link.bookingId === bookingId);
    
    // Map the studio IDs to actual studio objects
    return links.map(link => 
      studios.find(studio => studio.id === link.studioId)
    ).filter(Boolean) as Studio[];
  };

  // Get the appropriate slot class based on booking type and color
  const getSlotClass = (booking: Booking | undefined) => {
    const baseClass = readOnly ? "bg-white" : "bg-white hover:bg-gray-100";
    if (!booking) return baseClass;
    
    // For custom colored bookings, we'll use inline styles instead of classes
    // So just return the base class as the color is applied through style prop
    if (booking.color) {
      return baseClass;
    }
    
    // Use default color scheme based on type
    switch (booking.type) {
      case "maintenance":
        return readOnly ? "bg-amber-100" : "bg-amber-100 hover:bg-amber-200";
      case "it_support":
        return readOnly ? "bg-red-100" : "bg-red-100 hover:bg-red-200";
      case "rehearsal":
        return readOnly ? "bg-purple-100" : "bg-purple-100 hover:bg-purple-200";
      case "production":
        return readOnly ? "bg-blue-100" : "bg-blue-100 hover:bg-blue-200";
      default:
        return readOnly ? "bg-gray-100" : "bg-gray-100 hover:bg-gray-200";
    }
  };

  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'chron'>('chron');

  return (
    <>
      <div className="overflow-auto h-full">
        <DayChronView 
          date={currentDate}
          bookings={bookings}
          studios={filteredStudios}
          pcrRooms={pcrRooms}
          onBookingClick={handleBookingClick}
          readOnly={readOnly}
        />
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

      {/* New Alert Modal */}
      <AlertModal
        isOpen={isNewAlertModalOpen}
        onClose={() => setIsNewAlertModalOpen(false)}
        selectedDate={currentDate}
      />
    </>
  );
}
