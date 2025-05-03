import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Booking } from "@shared/schema";
import { cn } from "@/lib/utils";
import { getMonthDays, MONTH_NAMES, isSameDay, formatTime } from "@/lib/dateUtils";
import BookingModal from "../booking/BookingModal";

interface MonthlyCalendarProps {
  currentDate: Date;
}

export default function MonthlyCalendar({ currentDate }: MonthlyCalendarProps) {
  const [monthDays, setMonthDays] = useState<Date[]>([]);
  const [editBooking, setEditBooking] = useState<Booking | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isNewBookingModalOpen, setIsNewBookingModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Calculate month days whenever current date changes
  useEffect(() => {
    setMonthDays(getMonthDays(currentDate.getFullYear(), currentDate.getMonth()));
  }, [currentDate]);

  // Prepare date range for the month
  const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59, 999);

  // Fetch bookings for the month
  const { data: bookings = [] } = useQuery<Booking[]>({
    queryKey: [`/api/bookings?start=${monthStart.toISOString()}&end=${monthEnd.toISOString()}`],
  });

  // Handle day click to create a new booking
  const handleDayClick = (date: Date) => {
    setSelectedDate(date);
    setIsNewBookingModalOpen(true);
  };

  // Handle booking click for editing
  const handleBookingClick = (e: React.MouseEvent, booking: Booking) => {
    e.stopPropagation();
    setEditBooking(booking);
    setIsEditModalOpen(true);
  };

  // Get bookings for a specific day
  const getBookingsForDay = (date: Date) => {
    return bookings.filter(booking => isSameDay(new Date(booking.start), date));
  };

  // Get classes for a day cell
  const getDayClass = (date: Date) => {
    const isCurrentMonth = date.getMonth() === currentDate.getMonth();
    const isToday = isSameDay(date, new Date());
    
    return cn(
      "h-32 border p-1 transition-colors duration-200",
      isCurrentMonth ? "bg-white" : "bg-gray-50 text-gray-400",
      isToday && "bg-blue-50",
      "cursor-pointer hover:bg-gray-100"
    );
  };

  return (
    <>
      <div className="overflow-auto h-[calc(100vh-8rem)]">
        <div className="container mx-auto p-4">
          {/* Month Header */}
          <h2 className="text-xl font-semibold mb-4">
            {MONTH_NAMES[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h2>
          
          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-px">
            {/* Day names */}
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div key={day} className="text-center font-medium p-2 bg-gray-100">
                {day}
              </div>
            ))}
            
            {/* Calendar days */}
            {monthDays.map((date, i) => (
              <div 
                key={i} 
                className={getDayClass(date)}
                onClick={() => handleDayClick(date)}
              >
                <div className="flex justify-between items-start">
                  <span className="text-sm font-semibold">{date.getDate()}</span>
                </div>
                
                <div className="mt-1 space-y-1 max-h-[90px] overflow-y-auto text-xs">
                  {getBookingsForDay(date).slice(0, 3).map((booking) => {
                    // Determine color based on booking type
                    let colorClass = "bg-blue-100 text-blue-800";
                    if (booking.type === "maintenance") {
                      colorClass = "bg-amber-100 text-amber-800";
                    } else if (booking.type === "it_support") {
                      colorClass = "bg-red-100 text-red-800";
                    } else if (booking.type === "rehearsal") {
                      colorClass = "bg-purple-100 text-purple-800";
                    } else if (booking.type === "production") {
                      colorClass = "bg-green-100 text-green-800";
                    }
                    
                    return (
                      <div 
                        key={booking.id}
                        className={cn("p-1 rounded truncate", colorClass)}
                        onClick={(e) => handleBookingClick(e, booking)}
                      >
                        <span className="font-medium">{booking.title}</span>
                        <div>{formatTime(booking.start)}</div>
                      </div>
                    );
                  })}
                  
                  {getBookingsForDay(date).length > 3 && (
                    <div className="text-xs text-gray-500 mt-1">
                      +{getBookingsForDay(date).length - 3} more
                    </div>
                  )}
                </div>
              </div>
            ))}
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

      {/* New Booking Modal */}
      {selectedDate && (
        <BookingModal
          isOpen={isNewBookingModalOpen}
          onClose={() => setIsNewBookingModalOpen(false)}
          selectedDate={selectedDate}
        />
      )}
    </>
  );
}
