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
      <div className="h-24 border-b flex items-center px-2">
        <span className="text-xs font-medium text-gray-700 truncate">{studio.name}</span>
      </div>
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
                  <div className="font-medium truncate flex items-center">
                    {(booking.type === "maintenance" || booking.type === "it_support") && (
                      <span className={`w-2 h-2 rounded-full mr-1 ${
                        booking.severity === "critical" ? "bg-red-500" : 
                        booking.severity === "high" ? "bg-orange-500" :
                        booking.severity === "medium" ? "bg-amber-500" : "bg-blue-500"
                      }`}></span>
                    )}
                    {booking.title}
                  </div>
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
