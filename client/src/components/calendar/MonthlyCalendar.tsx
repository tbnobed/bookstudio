import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Booking, PcrRoom } from "@shared/schema";
import { cn } from "@/lib/utils";
import { getMonthDays, MONTH_NAMES, isSameDay, formatTime, formatDate } from "@/lib/dateUtils";
import BookingModal from "../booking/BookingModal";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { CalendarClock, Clock, FileText, User, Tag } from "lucide-react";

interface MonthlyCalendarProps {
  date: Date;
  studios: any[];
  bookings: any[];
  readOnly?: boolean;
}

export default function MonthlyCalendar({ date: currentDate, studios, bookings: propBookings = [], readOnly = false }: MonthlyCalendarProps) {
  const [monthDays, setMonthDays] = useState<Date[]>([]);
  const [editBooking, setEditBooking] = useState<Booking | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isNewBookingModalOpen, setIsNewBookingModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  
  // Fetch PCR rooms to display names instead of IDs
  const { data: pcrRooms = [] } = useQuery<PcrRoom[]>({
    queryKey: ["/api/pcr-rooms"],
  });
  
  // Function to get PCR room name from ID
  const getPcrRoomName = (pcrRoomId: number): string => {
    const pcrRoom = pcrRooms.find(room => room.id === pcrRoomId);
    return pcrRoom ? pcrRoom.name : `PCR #${pcrRoomId}`;
  };

  // Calculate month days whenever current date changes
  useEffect(() => {
    setMonthDays(getMonthDays(currentDate.getFullYear(), currentDate.getMonth()));
  }, [currentDate]);

  // Prepare date range for the month
  const monthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const monthEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59, 999);

  // Use bookings passed from props
  const bookings = propBookings;

  // Handle day click to create a new booking
  const handleDayClick = (date: Date) => {
    // Only allow booking creation if not in readOnly mode
    if (!readOnly) {
      setSelectedDate(date);
      setIsNewBookingModalOpen(true);
    }
  };

  // Handle booking click for editing
  const handleBookingClick = (e: React.MouseEvent, booking: Booking) => {
    e.stopPropagation();
    // Only allow editing if not in readOnly mode
    if (!readOnly) {
      setEditBooking(booking);
      setIsEditModalOpen(true);
    }
  };

  // Get bookings for a specific day
  const getBookingsForDay = (date: Date) => {
    return bookings.filter(booking => {
      // Create defensive copies of dates to avoid timezone issues
      const bookingStartDate = new Date(booking.start);
      const targetDate = new Date(date.getTime());
      return isSameDay(bookingStartDate, targetDate);
    });
  };

  // Get classes for a day cell
  const getDayClass = (date: Date) => {
    const isCurrentMonth = date.getMonth() === currentDate.getMonth();
    const isToday = isSameDay(date, new Date());
    
    return cn(
      "h-32 border p-1 transition-colors duration-200",
      isCurrentMonth ? "bg-white" : "bg-gray-50 text-gray-400",
      isToday && "bg-blue-50 border-blue-200",
      readOnly ? "cursor-default" : "cursor-pointer hover:bg-gray-100"
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
                  <span className={cn(
                    "text-sm font-semibold",
                    isSameDay(date, new Date()) && "bg-blue-100 text-blue-600 w-6 h-6 rounded-full flex items-center justify-center"
                  )}>
                    {date.getDate()}
                  </span>
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
                    
                    // Style object for custom colors
                    const customStyle = booking.color ? {
                      backgroundColor: `${booking.color}20`,
                      color: booking.color,
                      borderColor: booking.color,
                      border: '1px solid'
                    } : {};
                    
                    return (
                      <HoverCard key={booking.id}>
                        <HoverCardTrigger asChild>
                          <div 
                            className={cn(
                              "p-1 rounded truncate", 
                              booking.color ? "" : colorClass, 
                              readOnly ? "cursor-default" : "cursor-pointer"
                            )}
                            style={booking.color ? customStyle : {}}
                            onClick={(e) => handleBookingClick(e, booking)}
                          >
                            <span className="font-medium">
                              {booking.title}
                              {booking.pcrRoomId ? ` (${getPcrRoomName(booking.pcrRoomId)})` : ''}
                            </span>
                            <div>{formatTime(booking.start)}</div>
                          </div>
                        </HoverCardTrigger>
                        <HoverCardContent className="w-80 p-4">
                          <div className="space-y-3">
                            <h4 className="text-sm font-semibold">{booking.title}</h4>
                            <div className="space-y-1">
                              <div className="flex items-center text-xs text-muted-foreground">
                                <CalendarClock className="mr-1 h-3 w-3" />
                                <span>{formatDate(booking.start)}</span>
                              </div>
                              <div className="flex items-center text-xs text-muted-foreground">
                                <Clock className="mr-1 h-3 w-3" />
                                <span>{formatTime(booking.start)} - {formatTime(booking.end)}</span>
                              </div>
                              {booking.pcrRoomId && (
                                <div className="flex items-center text-xs text-muted-foreground">
                                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1 h-3 w-3">
                                    <path d="M20 16V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9m16 0H4m16 0 1.28 2.55a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45L4 16"></path>
                                  </svg>
                                  <span>{getPcrRoomName(booking.pcrRoomId)}</span>
                                </div>
                              )}
                              <div className="flex items-center text-xs text-muted-foreground">
                                <Tag className="mr-1 h-3 w-3" />
                                <span className="capitalize">{booking.type.replace('_', ' ')}</span>
                              </div>
                              {booking.description && (
                                <div className="flex items-start mt-2 text-xs text-muted-foreground">
                                  <FileText className="mr-1 h-3 w-3 mt-0.5 flex-shrink-0" />
                                  <span>{booking.description}</span>
                                </div>
                              )}
                              {booking.notifyList && Array.isArray(booking.notifyList) && booking.notifyList.length > 0 && (
                                <div className="mt-2">
                                  <div className="text-xs font-medium mb-1">Notifying:</div>
                                  <div className="flex flex-wrap gap-1">
                                    {booking.notifyList.map((crew: string, i: number) => (
                                      <span key={i} className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-800">
                                        <User className="mr-1 h-3 w-3" />
                                        {crew}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </HoverCardContent>
                      </HoverCard>
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
