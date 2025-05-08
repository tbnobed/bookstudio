import { useState, useEffect } from "react";
import { getWeekDates, formatDateShort, SHORT_DAY_NAMES, isWeekend } from "@/lib/dateUtils";
import { useQuery } from "@tanstack/react-query";
import { Studio, Booking, PcrRoom } from "@shared/schema";
import { cn } from "@/lib/utils";
import StudioRow from "./StudioRow";
import AlertsRow from "./AlertsRow";
import BookingModal from "../booking/BookingModal";
import AlertModal from "../alerts/AlertModal";
import { useStudioBookings } from "../../hooks/useStudioBookings";

interface WeeklyCalendarProps {
  currentDate?: Date;
  startDate?: Date;
  studios?: Studio[];
  bookings?: any[];
  readOnly?: boolean;
  selectedStudioIds?: number[];
}

export default function WeeklyCalendar({ 
  currentDate, 
  startDate,
  studios: externalStudios, 
  bookings: externalBookings,
  readOnly = false,
  selectedStudioIds = [] 
}: WeeklyCalendarProps) {
  // Use startDate if provided (for public calendar), fall back to currentDate
  const [effectiveDate, setEffectiveDate] = useState(startDate || currentDate || new Date());
  const [weekDates, setWeekDates] = useState<Date[]>([]);
  const [editBooking, setEditBooking] = useState<Booking | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isEditAlertModalOpen, setIsEditAlertModalOpen] = useState(false);
  
  // Update effectiveDate when props change with guaranteed fresh Date object
  useEffect(() => {
    // Always create a new Date object to ensure we break any reference issues
    if (startDate || currentDate) {
      const sourceDate = startDate || currentDate || new Date();
      const newDate = new Date(sourceDate.getTime());
      
      // Add timestamp to ensure unique logging and force re-renders
      const timestamp = Date.now();
      console.log(`WeeklyCalendar - [Timestamp: ${timestamp}] Props changed, new date: ${newDate.toISOString()}`);
      
      // Only update if the date has actually changed (comparing ISO strings)
      if (newDate.toISOString() !== effectiveDate.toISOString()) {
        console.log(`WeeklyCalendar - [Timestamp: ${timestamp}] Setting new effectiveDate`);
        setEffectiveDate(newDate);
      } else {
        console.log(`WeeklyCalendar - [Timestamp: ${timestamp}] Date unchanged, skipping update`);
      }
    }
  }, [startDate, currentDate, effectiveDate]);
  
  // Calculate week dates whenever effective date changes
  useEffect(() => {
    console.log(`WeeklyCalendar - effectiveDate changed: ${effectiveDate.toISOString()}`);
    const dates = getWeekDates(effectiveDate);
    console.log(`WeeklyCalendar - New week dates: ${dates.map(d => d.toISOString()).join(', ')}`);
    setWeekDates(dates);
  }, [effectiveDate]);

  // Fetch studios if not provided externally
  const studiosQuery = useQuery<Studio[]>({
    queryKey: ["/api/studios"],
    refetchInterval: 5000, // Refetch every 5 seconds
    enabled: !externalStudios // Only run this query if no external studios are provided
  });
  const studios = externalStudios || studiosQuery.data || [];

  // Fetch bookings for the week if not provided externally
  // Move these calculations inside the useEffect to ensure they update with weekDates
  const [weekStart, setWeekStart] = useState<Date>(new Date());
  const [weekEnd, setWeekEnd] = useState<Date>(new Date());

  // Update week start and end dates whenever week dates change
  useEffect(() => {
    if (weekDates.length >= 7) {
      // Use the first day (Sunday) as the start date
      const newWeekStart = new Date(weekDates[0]);
      // Make sure to set hours to 00:00:00 in UTC to include all bookings on first day
      // We need to set to midnight in UTC to ensure no timezone issues with dates
      newWeekStart.setUTCHours(0, 0, 0, 0);
      
      const newWeekEnd = new Date(weekDates[6]);
      newWeekEnd.setUTCHours(23, 59, 59, 999);
      
      console.log(`Setting new date range: ${newWeekStart.toISOString()} to ${newWeekEnd.toISOString()}`);
      
      setWeekStart(newWeekStart);
      setWeekEnd(newWeekEnd);
    }
  }, [weekDates]);

  // Use the useStudioBookings hook if no external bookings are provided
  const { bookings: fetchedBookings = [], isLoading: bookingsLoading } = 
    useStudioBookings(weekStart, weekEnd);
  
  // Log when fetchedBookings changes
  useEffect(() => {
    console.log(`WeeklyCalendar - Fetched bookings updated, received ${fetchedBookings.length} bookings`);
    console.log(`WeeklyCalendar - Current date range: ${weekStart?.toISOString()} to ${weekEnd?.toISOString()}`);
  }, [fetchedBookings, weekStart, weekEnd]);
  
  // Use external bookings if provided, otherwise use fetched bookings
  const bookings = externalBookings || fetchedBookings;
  
  // Setup a polling effect to refetch bookings every 2 seconds
  useEffect(() => {
    // Only set up polling if we're not in read-only mode (public view)
    if (!readOnly) {
      const interval = setInterval(() => {
        // Force re-render to pickup changes from the bookings query
        setWeekDates([...getWeekDates(effectiveDate)]);
      }, 2000);
      
      return () => clearInterval(interval);
    }
  }, [effectiveDate, readOnly]);

  // Filter studios if selectedStudioIds is provided
  const filteredStudios = selectedStudioIds.length > 0
    ? studios.filter((studio) => selectedStudioIds.includes(studio.id))
    : studios;

  // Handle booking click for editing (only if not in read-only mode)
  const handleBookingClick = (booking: any) => {
    // If in read-only mode (public view), don't allow editing
    if (readOnly) {
      return;
    }
    
    // Log the booking object to debug
    console.log("WeeklyCalendar - handleBookingClick received:", booking);
    
    // Check if it's an ApiBooking format (for alerts) or regular Booking
    const isApiFormat = 'studio_id' in booking;
    
    // Convert ApiBooking to Booking format if needed
    const bookingToEdit: Booking = isApiFormat 
      ? {
          id: booking.id,
          title: booking.title,
          description: booking.description,
          studioId: booking.studio_id,
          pcrRoomId: booking.pcr_room_id,
          userId: booking.user_id,
          start: booking.start,
          end: booking.end,
          type: booking.type,
          templateId: booking.template_id,
          notifyList: booking.notify_list,
          createdAt: booking.created_at,
          severity: booking.severity,
          status: booking.status || "confirmed",
          color: booking.color || null
        }
      : booking;
    
    // Log detailed booking information
    console.log(`WeeklyCalendar - Processing booking for studio selection:`, {
      id: bookingToEdit.id, 
      title: bookingToEdit.title,
      studioId: bookingToEdit.studioId,
      isNewBooking: bookingToEdit.id === 0
    });
    
    // Check if it's a facility-wide alert
    if ((bookingToEdit.type === "maintenance" || bookingToEdit.type === "it_support") && bookingToEdit.studioId === null) {
      // Use the dedicated AlertModal for facility-wide alerts
      setEditBooking(bookingToEdit);
      setIsEditAlertModalOpen(true);
    } else {
      // Use regular BookingModal for studio bookings
      setEditBooking(bookingToEdit);
      setIsEditModalOpen(true);
    }
  };
  
  // Filter alerts (maintenance and IT support bookings) and only include facility-wide alerts
  console.log("All bookings:", JSON.stringify(bookings));
  
  // Debug specifically alert ID 4 (the one for April 27th)
  const alert4 = bookings.find(b => b.id === 4);
  if (alert4) {
    console.log("Found Alert ID 4 (April 27th):", JSON.stringify(alert4));
  } else {
    console.log("Alert ID 4 (April 27th) is missing from bookings response");
  }
  
  // Get all bookings from API - this is for debugging
  useEffect(() => {
    const fetchAllBookings = async () => {
      try {
        const response = await fetch('/api/bookings');
        if (response.ok) {
          const data = await response.json();
          console.log("ALL bookings from API directly:", JSON.stringify(data));
        }
      } catch (error) {
        console.error("Error fetching bookings directly:", error);
      }
    };
    
    fetchAllBookings();
  }, []);
  
  const filteredAlerts = bookings.filter(booking => {
    // Check if we're getting snake_case properties (from API) or camelCase (from our code)
    const hasSnakeCase = 'studio_id' in booking;
    const studioId = hasSnakeCase ? booking.studio_id : booking.studioId;
    
    const isMaintenanceOrIT = booking.type === "maintenance" || 
                     booking.type === "it_support" || 
                     booking.type?.startsWith("all-day:maintenance") ||
                     booking.type?.startsWith("all-day:it_support");
    const isFacilityWide = studioId === null;
    
    console.log(`Booking ${booking.id}: type=${booking.type}, studioId=${studioId}, format=${hasSnakeCase ? 'snake_case' : 'camelCase'}, isMaintenanceOrIT=${isMaintenanceOrIT}, isFacilityWide=${isFacilityWide}`);
    
    return isMaintenanceOrIT && isFacilityWide;
  });
  
  console.log("Filtered facility-wide alerts:", JSON.stringify(filteredAlerts));
  
  // Convert to consistent ApiBooking format
  const alerts = filteredAlerts.map(booking => {
    // Check if we're getting snake_case properties (from API) or camelCase (from our code)
    const hasSnakeCase = 'studio_id' in booking;
    
    const apiBooking = hasSnakeCase ? {
      // Already in API format, just pass it through
      id: booking.id,
      title: booking.title,
      description: booking.description,
      studio_id: booking.studio_id, // Already null for facility-wide alerts
      pcr_room_id: booking.pcr_room_id,
      user_id: booking.user_id,
      start: booking.start,
      end: booking.end,
      type: booking.type,
      template_id: booking.template_id,
      notify_list: booking.notify_list,
      created_at: booking.created_at,
      severity: booking.severity
    } : {
      // Convert from camelCase to snake_case
      id: booking.id,
      title: booking.title,
      description: booking.description,
      studio_id: booking.studioId, // This is explicitly null for facility-wide alerts
      pcr_room_id: booking.pcrRoomId,
      user_id: booking.userId,
      start: booking.start,
      end: booking.end,
      type: booking.type,
      template_id: booking.templateId,
      notify_list: booking.notifyList,
      created_at: booking.createdAt,
      severity: booking.severity
    };
    
    console.log("Converted API booking:", JSON.stringify(apiBooking));
    return apiBooking;
  });

  return (
    <>
      <div className="overflow-auto h-[calc(100vh-8rem)]">
        <div className="min-w-[800px]">
          {/* Calendar Days Header - Using default height */}
          <div className="grid grid-cols-[80px_repeat(7,1fr)] sticky top-0 z-10">
            <div className="h-12 border-b bg-white"></div>
            {weekDates.map((date, index) => (
              <div 
                key={index} 
                className={cn(
                  "h-12 border-b text-center flex flex-col justify-center",
                  isWeekend(date) ? "bg-gray-50" : "bg-white",
                  new Date().toDateString() === date.toDateString() && "bg-blue-50 border-blue-200"
                )}
              >
                <div className="text-sm font-medium">{SHORT_DAY_NAMES[date.getDay()]}</div>
                <div className={cn(
                  "text-lg font-semibold",
                  new Date().toDateString() === date.toDateString() && "text-blue-600 rounded-full w-8 h-8 mx-auto flex items-center justify-center bg-blue-100"
                )}>
                  {date.getDate()}
                </div>
              </div>
            ))}
          </div>

          {/* Calendar Time Grid */}
          <div className="relative">
            {/* Calendar Grid */}
            <div className="grid grid-cols-[80px_repeat(7,1fr)]">
              {/* Alerts Row - First row of the grid */}
              <div className="contents">
                <AlertsRow
                  weekDates={weekDates}
                  alerts={alerts}
                  onAlertClick={handleBookingClick}
                />
              </div>
              
              {/* Visual separator */}
              <div className="col-span-8 h-2 bg-gray-200 border-b border-gray-300"></div>
              
              {/* Studio Rows */}
              {filteredStudios.map((studio) => (
                <StudioRow
                  key={studio.id}
                  studio={studio}
                  weekDates={weekDates}
                  bookings={bookings} // Pass ALL bookings and let StudioRow filter by both direct ID and junction table
                  onBookingClick={handleBookingClick}
                  readOnly={readOnly}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Booking Modal - for studio bookings */}
      {editBooking && (
        <BookingModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          booking={editBooking}
          selectedStudio={editBooking.studioId !== null && editBooking.studioId !== undefined ? Number(editBooking.studioId) : undefined}
          selectedDate={editBooking.start ? new Date(editBooking.start) : undefined}
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
    </>
  );
}
