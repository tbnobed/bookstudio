import { useEffect, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Booking, PcrRoom } from "@shared/schema";
import { cn } from "@/lib/utils";
import { getMonthDays, MONTH_NAMES, isSameDay, formatTime, formatDate, FACILITY_TIMEZONE, isBookingActive } from "@/lib/dateUtils";
import BookingModal from "../booking/BookingModal";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { CalendarClock, Clock, FileText, User, Tag, Tv } from "lucide-react";
import WeatherForecastCell from './WeatherForecastCell';
import { useWeatherForecast } from '../../hooks/useWeatherForecast';
import { toZonedTime } from "date-fns-tz";

// Helper function to extract studios from a booking using booking-studio links
function extractStudiosFromBooking(booking: any, studiosList: any[], bookingStudioLinks: any[]): any[] {
  const result: any[] = [];
  
  // First, check for studios linked via the booking_studios junction table
  const linkedStudios = bookingStudioLinks.filter(link => link.bookingId === booking.id);
  if (linkedStudios.length > 0) {
    linkedStudios.forEach((link: any) => {
      const studio = studiosList.find(s => s.id === link.studioId);
      if (studio && !result.some(s => s.id === studio.id)) {
        result.push(studio);
      }
    });
  }
  
  // If no linked studios found, fall back to direct studio reference
  if (result.length === 0 && booking.studioId) {
    const studio = studiosList.find(s => s.id === booking.studioId);
    if (studio) result.push(studio);
  }
  
  // Add studios from studioIds array if present (used in some bookings)
  if (booking.studioIds && Array.isArray(booking.studioIds)) {
    booking.studioIds.forEach((studioId: number) => {
      const studio = studiosList.find(s => s.id === studioId);
      if (studio && !result.some(s => s.id === studio.id)) {
        result.push(studio);
      }
    });
  }
  
  return result;
}

interface MonthlyCalendarProps {
  date: Date;
  studios: any[];
  bookings: any[];
  readOnly?: boolean;
}

export default function MonthlyCalendar({ date: currentDate, studios: studiosProp, bookings: propBookings = [], readOnly = false }: MonthlyCalendarProps) {
  const [monthDays, setMonthDays] = useState<Date[]>([]);
  const [editBooking, setEditBooking] = useState<Booking | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isNewBookingModalOpen, setIsNewBookingModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  
  // Fetch weather forecast data
  const { forecast } = useWeatherForecast();
  
  // Fetch PCR rooms to display names instead of IDs
  const { data: pcrRooms = [] } = useQuery<PcrRoom[]>({
    queryKey: ["/api/pcr-rooms"],
  });
  
  // Fetch studios to display names
  const { data: allStudios = [] } = useQuery<any[]>({
    queryKey: ["/api/studios"],
  });
  
  // Fetch booking-studio links to show all linked studios
  const { data: bookingStudioLinks = [] } = useQuery<any[]>({
    queryKey: ["/api/public/booking-studios"],
  });
  
  // Function to get PCR room name from ID
  const getPcrRoomName = (pcrRoomId: number): string => {
    const pcrRoom = pcrRooms.find(room => room.id === pcrRoomId);
    return pcrRoom ? pcrRoom.name : `PCR #${pcrRoomId}`;
  };
  
  // Function to get studio names for a booking
  const getStudiosForBooking = (booking: any): string => {
    // Ensure data is available before processing
    if (!allStudios || !bookingStudioLinks) return "";
    
    const bookingStudios = extractStudiosFromBooking(booking, allStudios, bookingStudioLinks);
    if (bookingStudios.length === 0) return "";
    
    // Return all studio names separated by commas
    return bookingStudios.map(studio => studio.name).join(", ");
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
      // Check if this is an alert booking
      const isAlert = isAlertBooking(booking);
      
      // If it's an alert, don't allow editing (alerts should be view-only)
      if (!isAlert) {
        // Regular booking - open the standard edit modal
        setEditBooking(booking);
        setIsEditModalOpen(true);
      }
    }
  };

  // Check if a booking is an alert by checking its type and title
  const isAlertBooking = (booking: any) => {
    // Check for alert indicators:
    // 1. It has "alert" type, OR
    // 2. It has "Alert" in the title, OR
    // 3. It's an "all-day:maintenance" type booking, OR
    // 4. It's an "all-day:it_support" type booking
    // 5. It has "update" or "network" in the title (for network updates), OR
    // 6. It has maintenance or it_support type with severity property
    
    const hasAlertInTitle = booking.title && booking.title.toLowerCase().includes('alert');
    const hasUpdateInTitle = booking.title && booking.title.toLowerCase().includes('update');
    const hasNetworkInTitle = booking.title && booking.title.toLowerCase().includes('network');
    const hasIssueInTitle = booking.title && booking.title.toLowerCase().includes('issue');
    const isAllDayMaintenance = booking.type && booking.type.includes('all-day:maintenance');
    const isAllDayITSupport = booking.type && booking.type.includes('all-day:it_support');
    const isMaintenanceType = booking.type === 'maintenance';
    const isITSupportType = booking.type === 'it_support';
    
    // Special case handling for known alert titles
    const specialCaseAlerts = [
      'network update', 
      'mu2 toa space issue'
    ];
    
    const isSpecialCaseAlert = booking.title && 
      specialCaseAlerts.some(alertTitle => 
        booking.title.toLowerCase().includes(alertTitle.toLowerCase())
      );
    
    return booking.type === 'alert' || 
           hasAlertInTitle || 
           isSpecialCaseAlert ||
           (hasUpdateInTitle && hasNetworkInTitle) || // Network updates are alerts
           hasIssueInTitle || // Issues are alerts
           isAllDayMaintenance || 
           isAllDayITSupport ||
           (isMaintenanceType && booking.severity) ||
           (isMaintenanceType && hasUpdateInTitle) || // Maintenance updates are alerts 
           (isITSupportType && booking.severity);
  };
  
  // Pre-process bookings by date for performance, using facility timezone
  const [bookingsByDate, maxBookingsPerDay] = (() => {
    const result = new Map<string, any[]>();
    let maxCount = 0;
    
    // Helper function to get date string in facility timezone
    const getDateStringInFacilityTimezone = (date: Date): string => {
      // Use Intl.DateTimeFormat to get the date components in the facility timezone
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: FACILITY_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
      
      const parts = formatter.formatToParts(date);
      const month = parts.find(part => part.type === 'month')?.value || '01';
      const day = parts.find(part => part.type === 'day')?.value || '01';
      const year = parts.find(part => part.type === 'year')?.value || '2025';
      
      return `${year}-${month}-${day}`;
    };
    
    // First pass: Group bookings by date string in facility timezone
    bookings.forEach(booking => {
      const bookingDate = new Date(booking.start);
      const dateStr = getDateStringInFacilityTimezone(bookingDate);
      
      if (!result.has(dateStr)) {
        result.set(dateStr, []);
      }
      result.get(dateStr)?.push(booking);
    });
    
    // Second pass: Sort each day's bookings and find max count
    result.forEach((dayBookings, dateStr) => {
      // Sort to put alerts first, then by start time
      dayBookings.sort((a, b) => {
        const aIsAlert = isAlertBooking(a);
        const bIsAlert = isAlertBooking(b);
        
        if (aIsAlert && !bIsAlert) return -1;
        if (!aIsAlert && bIsAlert) return 1;
        
        // If both are alerts, sort by severity (critical first)
        if (aIsAlert && bIsAlert) {
          const severityOrder: Record<string, number> = { 
            critical: 0, 
            high: 1, 
            medium: 2, 
            low: 3 
          };
          const aSeverityValue = a.severity && typeof a.severity === 'string' ? severityOrder[a.severity] : 999;
          const bSeverityValue = b.severity && typeof b.severity === 'string' ? severityOrder[b.severity] : 999;
          return aSeverityValue - bSeverityValue;
        }
        
        // Otherwise sort by start time
        return new Date(a.start).getTime() - new Date(b.start).getTime();
      });
      
      maxCount = Math.max(maxCount, dayBookings.length);
    });
    
    return [result, maxCount];
  })();

  // Function to get bookings for a specific day, using the pre-processed map with timezone awareness
  const getBookingsForDay = (date: Date) => {
    // Use Intl.DateTimeFormat to get the date components in the facility timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: FACILITY_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    
    const parts = formatter.formatToParts(date);
    const month = parts.find(part => part.type === 'month')?.value || '01';
    const day = parts.find(part => part.type === 'day')?.value || '01';
    const year = parts.find(part => part.type === 'year')?.value || '2025';
    
    const dateStr = `${year}-${month}-${day}`;
    return bookingsByDate.get(dateStr) || [];
  };

  // Calculate max number of bookings to show per day based on bookings density
  const getMaxDisplayCount = () => {
    // Adaptive logic based on pre-calculated max
    if (maxBookingsPerDay <= 2) return 5;      // Very sparse
    if (maxBookingsPerDay <= 4) return 4;      // Sparse
    if (maxBookingsPerDay <= 6) return 3;      // Average
    return 2;                                  // Dense
  };

  // Pre-compute booking styles to avoid redundant calculations
  function getBookingStyles(booking: any, isAlert: boolean) {
    // Determine color based on booking type and alert status
    let colorClass = "bg-blue-100 text-blue-800";
    let borderStyle = "";
    
    if (isAlert) {
      // Default severity if not specified
      let effectiveSeverity = booking.severity || 'medium';
      
      // Special case handling for alerts based on title
      const isNetworkUpdate = booking.title && booking.title.toLowerCase().includes('network update');
      const isIssue = booking.title && booking.title.toLowerCase().includes('issue');
      
      // Override severity based on content if not explicitly set
      if (!booking.severity) {
        if (isNetworkUpdate) {
          effectiveSeverity = 'critical'; // Network updates are critical
        } else if (isIssue) {
          effectiveSeverity = 'high'; // Issues are high priority
        }
      }
      
      // Use severity-based colors for alerts
      switch (effectiveSeverity) {
        case "critical":
          colorClass = "bg-red-50 text-red-800 border-red-500";
          borderStyle = "border-l-4"; // Thicker border for critical
          break;
        case "high":
          colorClass = "bg-orange-50 text-orange-800 border-orange-500";
          borderStyle = "border-l-4"; // Thicker border for high
          break;
        case "medium":
          colorClass = "bg-amber-50 text-amber-800 border-amber-500";
          borderStyle = "border-l-2";
          break;
        default: // low or undefined
          colorClass = "bg-blue-50 text-blue-800 border-blue-500";
          borderStyle = "border-l-2";
      }
    } else {
      // Use regular booking type colors
      if (booking.type === "maintenance" || (booking.type && booking.type.includes("maintenance"))) {
        colorClass = "bg-amber-100 text-amber-800";
      } else if (booking.type === "it_support" || (booking.type && booking.type.includes("it_support"))) {
        colorClass = "bg-red-100 text-red-800";
      } else if (booking.type === "rehearsal") {
        colorClass = "bg-purple-100 text-purple-800";
      } else if (booking.type === "production") {
        colorClass = "bg-green-100 text-green-800";
      }
    }
    
    // Handle cancelled status styling first
    if (booking.status === "cancelled") {
      colorClass = "bg-red-50 text-red-600 opacity-60";
      borderStyle = "border border-red-300";
    }
    
    // Style object for custom colors (only apply for non-alerts and non-cancelled)
    const customStyle = !isAlert && booking.color && booking.status !== "cancelled" ? {
      backgroundColor: `${booking.color}20`,
      color: booking.color,
      borderColor: booking.color,
      border: '1px solid'
    } : booking.status === "cancelled" ? {
      backgroundColor: "#fef2f2",
      color: "#dc2626",
      borderColor: "#fca5a5",
      textDecoration: "line-through",
      opacity: 0.7
    } : {};
    
    // Extract the main part of the booking type (remove "all-day:" prefix)
    const bookingType = booking.type && booking.type.includes(':') 
      ? booking.type.split(':')[1] 
      : booking.type;
      
    return { colorClass, borderStyle, customStyle, bookingType };
  };

  // Get classes for a day cell
  const getDayClass = (date: Date) => {
    const isCurrentMonth = date.getMonth() === currentDate.getMonth();
    // Use facility timezone for today detection as instructed
    const facilityTz = import.meta.env.VITE_FACILITY_TIMEZONE || 'America/Chicago';
    const today = toZonedTime(new Date(), facilityTz);
    const isToday = isSameDay(date, today);
    
    return cn(
      "border p-1 transition-colors duration-200",
      isCurrentMonth ? "bg-white" : "bg-gray-50 text-gray-400",
      isToday && "bg-blue-50 border-blue-200",
      readOnly ? "cursor-default" : "cursor-pointer hover:bg-gray-100"
    );
  };

  return (
    <>
      <div className="h-[calc(100vh-8rem)] flex flex-col overflow-auto">
        <div className="p-2 flex-shrink-0">
          {/* Month Header */}
          <h2 className="text-xl font-semibold mb-2">
            {MONTH_NAMES[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h2>
        </div>
        
        <div className="flex-1 overflow-auto">
          {/* Calendar Grid */}
          <div className="grid grid-cols-7 min-h-full" style={{ minHeight: '600px' }}>
            {/* Day names */}
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <div key={day} className="text-center font-medium p-2 bg-gray-100 sticky top-0">
                {day}
              </div>
            ))}
            
            {/* Calendar days */}
            {monthDays.map((date, i) => (
              <div 
                key={i} 
                className={`${getDayClass(date)} flex flex-col min-h-32`}
                onClick={() => handleDayClick(date)}
              >
                <div className="flex justify-between items-start p-1 sticky top-0 bg-white z-10">
                  <span className={cn(
                    "text-sm font-semibold",
                    isSameDay(date, new Date()) && "bg-blue-100 text-blue-600 w-6 h-6 rounded-full flex items-center justify-center"
                  )}>
                    {date.getDate()}
                  </span>
                  <WeatherForecastCell 
                    date={date} 
                    forecast={forecast?.forecast.find(f => f.date === date.toISOString().split('T')[0]) || null} 
                    size="small" 
                  />
                </div>
                
                <div className="flex-1 overflow-y-auto space-y-1 text-xs" style={{ minHeight: '120px' }}>
                  {getBookingsForDay(date).slice(0, getMaxDisplayCount()).map((booking) => {
                    // Check if this is an alert booking
                    const isAlert = isAlertBooking(booking);
                    
                    // Check if booking is currently active
                    const isActive = isBookingActive(booking);
                    
                    // Use memoized classes for better performance
                    const { colorClass, borderStyle, customStyle, bookingType } = getBookingStyles(booking, isAlert);
                    
                    return (
                      <HoverCard key={booking.id}>
                        <HoverCardTrigger asChild>
                          <div 
                            className={cn(
                              "p-1 rounded truncate", 
                              !isAlert && booking.color ? "" : colorClass,
                              borderStyle,
                              "flex justify-between items-center",
                              isAlert ? "cursor-default" : (readOnly ? "cursor-default" : "cursor-pointer"),
                              isAlert && "ring-1 ring-opacity-50",
                              isActive && "animate-pulse ring-2 ring-green-400 ring-opacity-75 shadow-lg"
                            )}
                            style={!isAlert && booking.color ? customStyle : {}}
                            onClick={(e) => handleBookingClick(e, booking)}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">
                                {isAlert && (
                                  <span className="inline-flex items-center mr-1 text-destructive">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                                      <line x1="12" y1="9" x2="12" y2="13"></line>
                                      <line x1="12" y1="17" x2="12.01" y2="17"></line>
                                    </svg>
                                  </span>
                                )}
                                {booking.title}
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-xs">{formatTime(booking.start)} - {formatTime(booking.end)}</span>
                                {booking.pcrRoomId && (
                                  <span className="text-xs opacity-80">{getPcrRoomName(booking.pcrRoomId)}</span>
                                )}
                              </div>
                              {getStudiosForBooking(booking) && (
                                <div className="flex items-center text-xs opacity-80">
                                  <Tv className="h-3 w-3 mr-1" />
                                  <span className="truncate">{getStudiosForBooking(booking)}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </HoverCardTrigger>
                        <HoverCardContent className="w-80 p-4">
                          <div className="space-y-3">
                            <h4 className="text-sm font-semibold">{booking.title}</h4>
                            <div className="space-y-1">
                              {isAlert && (
                                <div className="flex items-center text-xs">
                                  <span className={cn(
                                    "px-2 py-0.5 rounded-full text-xs font-medium",
                                    booking.severity === "critical" ? "bg-red-100 text-red-800" : 
                                    booking.severity === "high" ? "bg-orange-100 text-orange-800" : 
                                    booking.severity === "medium" ? "bg-amber-100 text-amber-800" : 
                                    "bg-blue-100 text-blue-800"
                                  )}>
                                    {booking.severity || "Low"} Severity
                                  </span>
                                </div>
                              )}
                              <div className="flex items-center text-xs text-muted-foreground">
                                <CalendarClock className="mr-1 h-3 w-3" />
                                <span>{formatDate(booking.start)}</span>
                              </div>
                              <div className="flex items-center text-xs text-muted-foreground">
                                <Clock className="mr-1 h-3 w-3" />
                                <span>{formatTime(booking.start)} - {formatTime(booking.end)}</span>
                              </div>
                              {getStudiosForBooking(booking) && (
                                <div className="flex items-center text-xs text-muted-foreground">
                                  <Tv className="mr-1 h-3 w-3" />
                                  <span>{getStudiosForBooking(booking)}</span>
                                </div>
                              )}
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
                                <span className="capitalize">{bookingType?.replace('_', ' ')}</span>
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
                  
                  {getBookingsForDay(date).length > getMaxDisplayCount() && (
                    <HoverCard>
                      <HoverCardTrigger asChild>
                        <div className="text-xs text-gray-500 mt-1 bg-gray-50 hover:bg-gray-100 rounded p-1 text-center cursor-pointer">
                          +{getBookingsForDay(date).length - getMaxDisplayCount()} more
                        </div>
                      </HoverCardTrigger>
                      <HoverCardContent className="w-80 p-2">
                        <div className="space-y-2">
                          <h4 className="text-sm font-semibold">All bookings ({formatDate(date)})</h4>
                          <div className="max-h-60 overflow-y-auto space-y-1">
                            {getBookingsForDay(date).map((booking) => {
                              const isAlert = isAlertBooking(booking);
                              const isActive = isBookingActive(booking);
                              const { colorClass, borderStyle, customStyle } = getBookingStyles(booking, isAlert);
                              
                              return (
                                <div
                                  key={booking.id}
                                  className={cn(
                                    "p-1 rounded text-xs",
                                    !isAlert && booking.color ? "" : colorClass,
                                    borderStyle,
                                    "flex justify-between items-center",
                                    isAlert && "ring-1 ring-opacity-50",
                                    isActive && "animate-pulse ring-2 ring-green-400 ring-opacity-75 shadow-lg"
                                  )}
                                  style={!isAlert && booking.color ? customStyle : {}}
                                >
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium truncate">
                                      {isAlert && (
                                        <span className="inline-flex items-center mr-1 text-destructive">
                                          <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                                            <line x1="12" y1="9" x2="12" y2="13"></line>
                                            <line x1="12" y1="17" x2="12.01" y2="17"></line>
                                          </svg>
                                        </span>
                                      )}
                                      {booking.title}
                                    </div>
                                    <div className="flex items-center justify-between text-xs opacity-80">
                                      <span>{formatTime(booking.start)}</span>
                                      {booking.pcrRoomId && (
                                        <span>{getPcrRoomName(booking.pcrRoomId)}</span>
                                      )}
                                    </div>
                                    {getStudiosForBooking(booking) && (
                                      <div className="flex items-center text-xs opacity-80">
                                        <Tv className="h-3 w-3 mr-1" />
                                        <span className="truncate">{getStudiosForBooking(booking)}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </HoverCardContent>
                    </HoverCard>
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
