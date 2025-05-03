import { useState, useEffect } from "react";
import { getWeekDates, formatDateShort, SHORT_DAY_NAMES, isWeekend } from "@/lib/dateUtils";
import { useQuery } from "@tanstack/react-query";
import { Studio, Booking } from "@shared/schema";
import { cn } from "@/lib/utils";
import StudioRow from "./StudioRow";
import AlertsRow from "./AlertsRow";
import BookingModal from "../booking/BookingModal";
import AlertModal from "../alerts/AlertModal";

interface WeeklyCalendarProps {
  currentDate: Date;
  selectedStudioIds?: number[];
}

export default function WeeklyCalendar({ currentDate, selectedStudioIds = [] }: WeeklyCalendarProps) {
  const [weekDates, setWeekDates] = useState<Date[]>([]);
  const [editBooking, setEditBooking] = useState<Booking | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isEditAlertModalOpen, setIsEditAlertModalOpen] = useState(false);
  
  // Calculate week dates whenever current date changes
  useEffect(() => {
    setWeekDates(getWeekDates(currentDate));
  }, [currentDate]);

  // Fetch studios
  const { data: studios = [] } = useQuery<Studio[]>({
    queryKey: ["/api/studios"],
  });

  // Fetch bookings for the week
  const weekStart = weekDates[0] ? new Date(weekDates[0]) : new Date();
  const weekEnd = weekDates[6] ? new Date(weekDates[6]) : new Date();
  weekEnd.setHours(23, 59, 59, 999);

  const { data: bookings = [] } = useQuery<Booking[]>({
    queryKey: [`/api/bookings?start=${weekStart.toISOString()}&end=${weekEnd.toISOString()}`],
    enabled: weekDates.length > 0,
  });

  // Filter studios if selectedStudioIds is provided
  const filteredStudios = selectedStudioIds.length > 0
    ? studios.filter((studio) => selectedStudioIds.includes(studio.id))
    : studios;

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
  
  // Filter alerts (maintenance and IT support bookings)
  const alerts = bookings.filter(booking => 
    booking.type === "maintenance" || booking.type === "it_support"
  );

  return (
    <>
      <div className="overflow-auto h-[calc(100vh-8rem)]">
        <div className="min-w-[800px]">
          {/* Calendar Days Header */}
          <div className="grid grid-cols-[80px_repeat(7,1fr)] sticky top-0 z-10">
            <div className="h-14 border-b bg-white"></div>
            {weekDates.map((date, index) => (
              <div 
                key={index} 
                className={cn(
                  "h-14 border-b bg-white text-center py-2",
                  isWeekend(date) && "bg-gray-50"
                )}
              >
                <div className="text-sm font-medium">{SHORT_DAY_NAMES[date.getDay()]}</div>
                <div className="text-lg font-semibold">{date.getDate()}</div>
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
                  bookings={bookings.filter(b => b.studioId === studio.id)}
                  onBookingClick={handleBookingClick}
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
