import { useState } from "react";
import { cn } from "@/lib/utils";
import { Booking, Studio } from "@shared/schema";
import { formatTime, isWeekend, isSameDay } from "@/lib/dateUtils";
import BookingModal from "../booking/BookingModal";

interface StudioRowProps {
  studio: Studio;
  weekDates: Date[];
  bookings: Booking[];
  onBookingClick: (booking: Booking) => void;
}

export default function StudioRow({ studio, weekDates, bookings, onBookingClick }: StudioRowProps) {
  const [isNewBookingModalOpen, setIsNewBookingModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  // Handle cell click to create a new booking
  const handleCellClick = (date: Date) => {
    setSelectedDate(date);
    setIsNewBookingModalOpen(true);
  };

  return (
    <>
      <div className="h-24 border-b"></div>
      {weekDates.map((date, index) => {
        // Filter bookings for this date and studio
        const dayBookings = bookings.filter(booking => 
          isSameDay(new Date(booking.start), date)
        );
        
        return (
          <div 
            key={index} 
            className={cn(
              "relative h-24 border-b border-r",
              isWeekend(date) ? "bg-gray-50" : "bg-white",
              "cursor-pointer hover:bg-gray-100"
            )}
            onClick={() => handleCellClick(date)}
          >
            {dayBookings.map((booking, bookingIndex) => {
              // Determine color based on booking type
              let colorClass = "bg-blue-100 border-blue-300 text-blue-800";
              if (booking.type === "maintenance") {
                colorClass = "bg-amber-100 border-amber-300 text-amber-800";
              } else if (booking.type === "it_support") {
                colorClass = "bg-red-500 border-red-600 text-white";
              } else if (booking.type === "rehearsal") {
                colorClass = "bg-purple-100 border-purple-300 text-purple-800";
              } else if (booking.type === "production") {
                colorClass = "bg-red-100 border-red-300 text-red-800";
              }
              
              return (
                <div 
                  key={booking.id}
                  className={cn(
                    "absolute w-[calc(100%-4px)] left-[2px] border rounded-md p-1 overflow-hidden text-overflow-ellipsis whitespace-nowrap text-xs z-10 top-2 h-20",
                    colorClass
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    onBookingClick(booking);
                  }}
                >
                  <div className="font-medium">{booking.title}</div>
                  <div className="text-xs">
                    {formatTime(booking.start)} - {formatTime(booking.end)}
                  </div>
                </div>
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
