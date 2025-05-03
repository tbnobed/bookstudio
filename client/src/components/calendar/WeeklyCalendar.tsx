import { useState, useEffect } from "react";
import { getWeekDates, formatDateShort, SHORT_DAY_NAMES, isWeekend } from "@/lib/dateUtils";
import { useQuery } from "@tanstack/react-query";
import { Studio, Booking } from "@shared/schema";
import { cn } from "@/lib/utils";
import StudioRow from "./StudioRow";
import BookingModal from "../booking/BookingModal";

interface WeeklyCalendarProps {
  currentDate: Date;
  selectedStudioIds?: number[];
}

export default function WeeklyCalendar({ currentDate, selectedStudioIds = [] }: WeeklyCalendarProps) {
  const [weekDates, setWeekDates] = useState<Date[]>([]);
  const [editBooking, setEditBooking] = useState<Booking | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
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
    setEditBooking(booking);
    setIsEditModalOpen(true);
  };

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
            {/* Studios List */}
            <div className="absolute left-0 top-0 z-20 w-[80px] bg-white border-r">
              {filteredStudios.map((studio) => (
                <div key={studio.id} className="h-24 border-b px-2 flex items-center">
                  <div className="text-xs font-medium text-gray-700 truncate">{studio.name}</div>
                </div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-[80px_repeat(7,1fr)]">
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

      {/* Edit Booking Modal */}
      {editBooking && (
        <BookingModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          booking={editBooking}
        />
      )}
    </>
  );
}
