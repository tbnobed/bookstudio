import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Booking, Studio } from "@shared/schema";

// Define extended Booking type with bookingStudios
interface BookingWithStudios extends Booking {
  bookingStudios?: { bookingId: number; studioId: number }[];
}
import { cn } from "@/lib/utils";
import { isToday, isPast, isAfter, isBefore, formatDistance, format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, CalendarDays, Plus, AlertTriangle, Activity, Tv, MonitorPlay } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import MobileBookingForm from "@/components/booking/MobileBookingForm";
import AlertModal from "@/components/alerts/AlertModal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLocation } from "wouter";
import { useStudioStatus } from "@/hooks/use-studio-status";
import { formatTime, formatDate, isSameDay, formatTimeRange } from "@/lib/dateUtils";
import { useCalendarContext } from "@/contexts/CalendarContext";
import { getDayRangeInChicago } from "@/utils/dateUtils";
import { useWeatherForecast } from "@/hooks/useWeatherForecast";
import WeatherForecastCell from "@/components/calendar/WeatherForecastCell";
import { MobileBanner } from "@/components/layout/MobileBanner";

// Helper function to extract studios from a booking
function extractStudiosFromBooking(booking: any, studiosList: any[]): any[] {
  const result: any[] = [];
  
  // Add direct studio reference if exists
  if (booking.studioId) {
    const studio = studiosList.find(s => s.id === booking.studioId);
    if (studio) result.push(studio);
  }
  
  // Add studios from junction table
  if (booking.bookingStudios && booking.bookingStudios.length > 0) {
    booking.bookingStudios.forEach((bs: any) => {
      const studio = studiosList.find(s => s.id === bs.studioId);
      if (studio && !result.some(s => s.id === studio.id)) {
        result.push(studio);
      }
    });
  }
  
  // Log the booking studio links to help with debugging
  console.log(`Booking ${booking.id} (${booking.title}) has these studio links:`, 
    booking.bookingStudios ? booking.bookingStudios.map((bs: any) => bs.studioId) : "none");
  
  return result;
}

interface MobileDailyViewProps {
  currentDate: Date;
  onDateChange: (date: Date) => void;
  onViewChange: (view: "day" | "week" | "month") => void;
}

export default function MobileDailyView({ 
  currentDate,
  onDateChange,
  onViewChange,
}: MobileDailyViewProps) {
  const [, navigate] = useLocation();
  const [isNewBookingModalOpen, setIsNewBookingModalOpen] = useState(false);
  const [isNewAlertModalOpen, setIsNewAlertModalOpen] = useState(false);
  const [editBooking, setEditBooking] = useState<Booking | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  
  // Get date from context as well as props
  const { selectedDate, setSelectedDate } = useCalendarContext();
  
  // Ensure context stays in sync with props
  useEffect(() => {
    if (currentDate && (!selectedDate || !isSameDay(currentDate, selectedDate))) {
      setSelectedDate(currentDate);
    }
  }, [currentDate, selectedDate, setSelectedDate]);
  
  // Get date range in Chicago timezone for the day (midnight to midnight)
  // This is important because we want bookings for the day as seen in Chicago
  // regardless of the user's local timezone
  const { start: dayStart, end: dayEnd } = getDayRangeInChicago(currentDate);
  
  console.log(`MobileDailyView - Showing bookings for ${currentDate.toDateString()} in Chicago timezone`);
  console.log(`MobileDailyView - Date range: ${dayStart.toISOString()} to ${dayEnd.toISOString()}`);

  // Fetch bookings for the selected day using Chicago midnight-to-midnight
  const { data: fetchedBookings = [] } = useQuery<Booking[]>({
    queryKey: [`/api/bookings?start=${dayStart.toISOString()}&end=${dayEnd.toISOString()}`],
  });
  
  // Apply additional client-side filter to ensure only bookings from the current day are shown
  // A booking is considered to be "on the current day" if it starts on or before the end of the day
  // and ends after the start of the day (i.e., it overlaps with the day)
  const todayBookings = useMemo(() => {
    return fetchedBookings.filter(booking => {
      const bookingStart = new Date(booking.start);
      const bookingEnd = new Date(booking.end);
      
      // Check if the booking overlaps with the day range
      const isOverlapping = bookingStart <= dayEnd && bookingEnd > dayStart;
      
      // Additional check for bookings that span exactly at midnight
      const isOnCurrentDay = isSameDay(bookingStart, currentDate) || 
                             isSameDay(bookingEnd, currentDate) ||
                             (bookingStart < dayStart && bookingEnd > dayEnd);
      
      console.log(`Booking ${booking.id} (${booking.title}) overlapping: ${isOverlapping}, on current day: ${isOnCurrentDay}`);
      
      return isOverlapping && isOnCurrentDay;
    });
  }, [fetchedBookings, dayStart, dayEnd, currentDate]);
  
  console.log(`After filtering, found ${todayBookings.length} bookings for today (${currentDate.toDateString()})`);
  
  // Use our studio status hook to get real-time status, passing our filtered bookings
  const { 
    getAllStudiosWithStatus, 
    getStudioStatus,
    studios,
    now 
  } = useStudioStatus(todayBookings);
  
  // Fetch booking-studios junction data
  const { data: bookingStudios = [] } = useQuery<{ bookingId: number, studioId: number }[]>({
    queryKey: ['/api/booking-studios'],
  });
  
  // Fetch PCR rooms
  const { data: pcrRooms = [] } = useQuery<any[]>({
    queryKey: ['/api/pcr-rooms'],
  });

  // Weather forecast hook
  const { forecast } = useWeatherForecast();

  // Site name query
  const { data: siteData } = useQuery<{ siteName: string }>({
    queryKey: ['/api/system/site-name'],
    staleTime: 1000 * 60 * 30, // Cache for 30 minutes
  });
  
  // Merge booking-studios data into the bookings
  const bookingsWithStudios = useMemo<BookingWithStudios[]>(() => {
    return todayBookings.map(booking => {
      // Find all entries in bookingStudios that match this booking
      const relatedBookingStudios = bookingStudios.filter(
        bs => bs.bookingId === booking.id
      );
      
      // Debug logging for Sunday entry specifically
      if (booking.title === "Sunday entry") {
        console.log(`DEBUG: Booking ${booking.id} (${booking.title}) junction data:`, relatedBookingStudios);
      }
      
      // Return a new booking object with the bookingStudios property
      return {
        ...booking,
        bookingStudios: relatedBookingStudios
      };
    });
  }, [todayBookings, bookingStudios]);

  // Log the booking studios data
  console.log("All bookingStudios data:", bookingStudios);
  console.log("Sunday entry booking studios for booking 218:", bookingStudios.filter(bs => bs.bookingId === 218));
  
  // Group bookings by studio (including linked bookings through booking_studios)
  const bookingsByStudio = studios.reduce((acc, studio) => {
    // Get all bookings that are linked to this studio (either directly or through booking_studios)
    acc[studio.id] = bookingsWithStudios.filter(booking => {
      // Direct studio reference
      if (booking.studioId === studio.id) {
        console.log(`Booking ${booking.id} (${booking.title}) is directly linked to Studio ${studio.id} (${studio.name})`);
        return true;
      }
      
      // Check booking_studios junction table
      if (booking.bookingStudios && booking.bookingStudios.length > 0) {
        const isLinked = booking.bookingStudios.some(bs => bs.studioId === studio.id);
        if (isLinked) {
          console.log(`Booking ${booking.id} (${booking.title}) is linked via junction table to Studio ${studio.id} (${studio.name})`);
        }
        return isLinked;
      }
      
      return false;
    });
    return acc;
  }, {} as Record<number, BookingWithStudios[]>);

  // Get facility-wide alerts (bookings with studioId === null)
  const facilityAlerts = todayBookings.filter(booking => 
    booking.studioId === null && 
    (booking.type === "maintenance" || 
     booking.type === "it_support" || 
     booking.type === "facility_alert" || 
     booking.type === "alert" ||
     booking.severity !== null) // Include any booking with a severity set
  );
  
  // Debug alerts
  console.log("Mobile view - All bookings:", todayBookings);
  console.log("Mobile view - Facility alerts:", facilityAlerts);

  // Navigate to previous/next day
  const goToPreviousDay = () => {
    const prevDay = new Date(currentDate);
    prevDay.setDate(prevDay.getDate() - 1);
    // Update both the prop callback and the context
    onDateChange(prevDay);
    setSelectedDate(prevDay);
  };

  const goToNextDay = () => {
    const nextDay = new Date(currentDate);
    nextDay.setDate(nextDay.getDate() + 1);
    // Update both the prop callback and the context
    onDateChange(nextDay);
    setSelectedDate(nextDay);
  };
  
  // Navigate to today
  const goToToday = () => {
    const today = new Date();
    // Update both the prop callback and the context
    onDateChange(today);
    setSelectedDate(today);
  };

  // Switch to weekly view
  const switchToWeeklyView = () => {
    // Update both via props and context
    onViewChange("week");
  };

  // Handle booking/slot click - differentiate between regular bookings and maintenance/alerts
  const handleBookingClick = (booking: Booking) => {
    console.log("MobileDailyView - handleBookingClick - Original booking:", booking);
    
    // Check if this is a maintenance/alert booking
    const isMaintenanceOrAlert = booking.type === 'maintenance' || 
                                 booking.type === 'alert' || 
                                 booking.type === 'it_support' ||
                                 booking.studioId === null;
    
    console.log("MobileDailyView - Booking type check:", {
      bookingId: booking.id,
      title: booking.title,
      type: booking.type,
      studioId: booking.studioId,
      isMaintenanceOrAlert
    });
    
    if (isMaintenanceOrAlert) {
      // Open alert modal for maintenance/alert bookings
      console.log("MobileDailyView - Opening AlertModal for maintenance booking");
      
      // Prepare the booking data for the alert modal
      const alertData = {
        id: booking.id,
        title: booking.title || '',
        description: booking.description || '',
        studioId: booking.studioId || null,
        pcrRoomId: booking.pcrRoomId || null,
        userId: booking.userId || 1,
        start: booking.start,
        end: booking.end,
        type: booking.type || 'maintenance',
        status: booking.status || 'confirmed',
        severity: booking.severity || 'low',
        templateId: booking.templateId || null,
        notifyList: booking.notifyList || [],
        color: booking.color || '#ff6b35',
        createdAt: booking.createdAt || new Date()
      };
      
      setEditBooking(alertData);
      setIsNewAlertModalOpen(true);
      return;
    }
    
    // Regular booking processing for studio bookings
    const linkedStudioNames = getLinkedStudiosForBooking(booking);
    
    // Get linked studio IDs by looking up each studio by name
    const linkedStudioIds = linkedStudioNames
      .map(name => {
        const studio = studios.find(s => s.name === name);
        return studio ? studio.id : null;
      })
      .filter(id => id !== null);
    
    console.log("MobileDailyView - handleBookingClick - Linked studios:", {
      linkedStudioNames,
      linkedStudioIds
    });
    
    // Enhanced booking cleanup and preparation
    // This creates a clean booking object with all required props explicitly
    const cleanBooking: any = {
      id: booking.id,
      title: booking.title || '',
      description: booking.description || '',
      studioId: booking.studioId || null,
      pcrRoomId: booking.pcrRoomId || null,
      // Keep original string dates for API compatibility
      start: booking.start,
      end: booking.end,
      // Store Date objects explicitly in special properties
      _startDate: new Date(booking.start),
      _endDate: new Date(booking.end),
      type: booking.type || 'production',
      status: booking.status || 'confirmed',
      severity: booking.severity || null,
      templateId: booking.templateId || 0,
      notifyList: booking.notifyList || [],
      color: booking.color || '#3b82f6',
      // Use the linked studios we fetched
      studioIds: linkedStudioIds.length > 0 ? linkedStudioIds : (booking.studioId ? [booking.studioId] : [])
    };
    
    // Add any missing fields that might be needed by the form
    cleanBooking.userId = booking.userId || 1; // Default to admin
    
    console.log("MobileDailyView - handleBookingClick - Enhanced booking:", cleanBooking);
    
    // Force a delay to ensure booking data is set before modal opens
    setTimeout(() => {
      setEditBooking(cleanBooking);
      setIsEditModalOpen(true);
      console.log("MobileDailyView - Edit Modal Opening:", {
        bookingId: cleanBooking.id,
        bookingTitle: cleanBooking.title,
        editModalIsOpen: true,
        editBookingData: cleanBooking
      });
    }, 50); // Increased timeout for more reliable state updates
  };

  // Get all studios with their current status
  const studiosWithStatus = getAllStudiosWithStatus();
  
  // Function to get directly linked studios for a booking
  const getDirectStudiosForBooking = (booking: any): string => {
    if (!booking || !booking.studioId) return "";
    const studio = studios.find(s => s.id === booking.studioId);
    return studio ? studio.name : "";
  };
  
  // Function to get linked studios from the booking-studios junction table
  const getLinkedStudiosForBooking = (booking: any): string[] => {
    if (!booking) return [];
    
    console.log(`Getting linked studios for booking ${booking.id} (${booking.title})`);
    
    const studioNames: string[] = [];
    
    // Check direct studio reference first
    if (booking.studioId) {
      const studio = studios.find(s => s.id === booking.studioId);
      if (studio) {
        console.log(`Found direct link to studio ${studio.id} (${studio.name})`);
        studioNames.push(studio.name);
      }
    }
    
    // Add studios from the bookingStudios lookup data we fetched
    // Make sure we're comparing numbers to numbers
    const links = bookingStudios.filter(bs => 
      Number(bs.bookingId) === Number(booking.id)
    );
    
    console.log(`Finding linked studios for booking ${booking.id}: found ${links.length} links`);
    
    if (links && links.length > 0) {
      links.forEach(link => {
        const studio = studios.find(s => s.id === link.studioId);
        if (studio && !studioNames.includes(studio.name)) {
          console.log(`Found linked studio ${studio.id} (${studio.name}) via junction table`);
          studioNames.push(studio.name);
        }
      });
    }
    
    console.log(`Total studios linked to booking ${booking.id}: ${studioNames.length} (${studioNames.join(', ')})`);
    return studioNames;
  };
  
  // Function to get a summary of studio names for a booking
  const getStudiosForBooking = (booking: any): string => {
    const studioNames = getLinkedStudiosForBooking(booking);
    if (studioNames.length === 0) return "";
    
    // If there's just one studio, return its name
    if (studioNames.length === 1) return studioNames[0];
    
    // If there are multiple studios, return a summary
    return `${studioNames[0]} +${studioNames.length - 1}`;
  };
  
  // Function to get all studio names for a booking (without truncation)
  const getAllStudiosForBooking = (booking: any): string => {
    const studioNames = getLinkedStudiosForBooking(booking);
    if (studioNames.length === 0) return "";
    
    // Return all studio names joined with commas
    return studioNames.join(", ");
  };
  
  // Function to get PCR room for a booking
  const getPcrRoom = (booking: any) => {
    console.log("Checking PCR room for booking:", booking.id, booking.title);
    console.log("PCR room ID:", booking.pcrRoomId);
    console.log("Available PCR rooms:", pcrRooms);
    
    if (!booking?.pcrRoomId) return null;
    const room = pcrRooms.find(pcr => pcr.id === booking.pcrRoomId);
    console.log("Found PCR room:", room);
    return room;
  };

  return (
    <div className="flex flex-col h-full overflow-hidden mobile-gradient-bg">
      {/* Modern Site Banner */}
      <MobileBanner />
      
      {/* Header with date navigation */}
      <div className="border-b p-4 bg-white/90 backdrop-blur-sm sticky top-0 z-10">
        {/* Date navigation buttons */}
        <div className="flex justify-between items-center mb-2">
          <Button variant="ghost" size="icon" onClick={goToPreviousDay}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Button>
          
          <div className="flex flex-col items-center">
            <h1 className="text-lg font-bold">
              {isToday(currentDate) ? "Today" : formatDate(currentDate)}
            </h1>
            <span className="text-sm text-gray-500">
              {currentDate.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'America/Chicago' })}
            </span>
            <WeatherForecastCell 
              date={currentDate} 
              forecast={forecast?.forecast.find(day => 
                new Date(day.date).toDateString() === currentDate.toDateString()
              ) || null}
              size="small"
            />
          </div>
          
          <Button variant="ghost" size="icon" onClick={goToNextDay}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </Button>
        </div>
        
        {/* Today button - only visible when not on today's date */}
        {!isToday(currentDate) && (
          <div className="flex justify-center">
            <Button 
              variant="outline" 
              size="sm"
              className="text-blue-600 border-blue-300 hover:bg-blue-50"
              onClick={goToToday}
            >
              <Calendar className="h-4 w-4 mr-1" /> Today
            </Button>
          </div>
        )}
      </div>

      {/* Removed "Switch to Weekly View" button as requested */}



      {/* Alerts section - facility-wide alerts */}
      {facilityAlerts.length > 0 && (
        <div className="p-4 bg-red-50 border-b border-red-100">
          <h2 className="text-sm font-semibold text-red-800 mb-2 flex items-center gap-2">
            <AlertTriangle size={16} />
            Facility Alerts
          </h2>
          <div className="space-y-2">
            {facilityAlerts.map(alert => (
              <div 
                key={alert.id} 
                className="bg-white p-3 rounded-md border border-red-200 shadow-sm"
                onClick={() => handleBookingClick(alert)}
              >
                <div className="font-medium text-red-700">{alert.title}</div>
                <div className="text-xs text-gray-500">
                  {formatTimeRange(new Date(alert.start), new Date(alert.end))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main content - Studios and bookings */}
      <Tabs defaultValue="timeline" className="flex-1 overflow-hidden flex flex-col">
        <TabsList className="grid grid-cols-2 mx-4 mt-2 sticky top-0 z-10 bg-white/90 backdrop-blur-sm">
          <TabsTrigger value="studios">Studios Status</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>
        
        {/* Studios Status Tab */}
        <TabsContent value="studios" className="flex-1 overflow-auto pb-20 -mx-1 px-1 overscroll-contain">
          <div className="p-4 grid grid-cols-1 gap-4">
            {studiosWithStatus.map(studio => {
              const studioBookings = bookingsByStudio[studio.id] || [];
              const { statusInfo } = studio;
              
              return (
                <div key={studio.id} className="bg-white rounded-lg border shadow-sm overflow-hidden touch-pan-y">
                  <div className="flex items-center p-4 border-b sticky top-0 bg-white">
                    <div className={`w-3 h-3 rounded-full mr-2 ${statusInfo.color}`}></div>
                    <h3 className="font-medium flex-1">{studio.name}</h3>
                    <Badge 
                      variant={
                        statusInfo.status === 'in-use' ? 'destructive' : 
                        statusInfo.status === 'maintenance' ? 'outline' :
                        statusInfo.status === 'upcoming' ? 'secondary' : 'default'
                      }
                    >
                      {statusInfo.status === 'in-use' ? 'In-Use' :
                       statusInfo.status === 'maintenance' ? 'Maintenance' :
                       statusInfo.status === 'upcoming' ? 'Booked Soon' : 'Available'}
                    </Badge>
                  </div>
                  
                  <div className="p-3">
                    {studioBookings.length > 0 ? (
                      <div className="space-y-2">
                        {studioBookings.map(booking => {
                          const bookingStart = new Date(booking.start);
                          const bookingEnd = new Date(booking.end);
                          const isActive = bookingStart <= now && bookingEnd > now;
                          const isUpcoming = isAfter(bookingStart, now);
                          const isPastBooking = isBefore(bookingEnd, now);
                          
                          return (
                            <div 
                              key={booking.id}
                              onClick={() => handleBookingClick(booking)}
                              className={cn(
                                "p-3 rounded-md border cursor-pointer transition-colors active:bg-gray-100",
                                booking.status === "tentative" ? "border-dashed" : "",
                                booking.color 
                                  ? { 
                                      "bg-opacity-15 border-opacity-30": true,
                                      "border-current": true
                                    }
                                  : isActive 
                                    ? "bg-red-50 border-red-200" 
                                    : isUpcoming 
                                      ? "bg-amber-50 border-amber-200" 
                                      : "bg-gray-50 border-gray-200"
                              )}
                              style={booking.color ? { 
                                backgroundColor: `${booking.color}20`, /* 12.5% opacity */
                                borderColor: booking.color,
                                color: booking.color
                              } : {}}
                            >
                              <div className="font-medium text-sm" style={booking.color ? { color: booking.color } : {}}>
                                {booking.title}
                              </div>
                              <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                                <Clock size={12} />
                                {formatTimeRange(bookingStart, bookingEnd)}
                              </div>
                              
                              {/* Show linked studios display for this booking if multiple */}
                              {getLinkedStudiosForBooking(booking).length > 1 && (
                                <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                                  <Tv size={12} />
                                  {getAllStudiosForBooking(booking)}
                                </div>
                              )}

                              {/* PCR Room Information */}
                              <div className="text-xs text-gray-500 flex items-center gap-1 mt-1 bg-gray-100 p-1 rounded">
                                <MonitorPlay size={12} className="text-blue-500" />
                                PCR: {booking.pcrRoomId ? getPcrRoom(booking)?.name || "None" : "None"}
                              </div>
                              
                              {isUpcoming && (
                                <div className="text-xs text-amber-700 mt-1">
                                  Starts in {formatDistance(bookingStart, now)}
                                </div>
                              )}
                              
                              {isActive && (
                                <div className="text-xs text-red-700 mt-1">
                                  Ends in {formatDistance(bookingEnd, now)}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-sm">
                        {/* Show current status summary */}
                        <div className={cn(
                          "rounded-md py-3 px-4 border flex flex-col gap-2",
                          statusInfo.status === 'in-use' ? 'bg-red-50 border-red-200' : 
                          statusInfo.status === 'upcoming' ? 'bg-amber-50 border-amber-200' : 
                          'bg-green-50 border-green-200'
                        )}>
                          {/* PCR Room Information */}
                          <div className="text-xs text-gray-500 flex items-center gap-1 bg-gray-100 p-1 rounded mb-1">
                            <MonitorPlay size={14} className="text-blue-500" />
                            <span>PCR: None assigned</span>
                          </div>
                          
                          {/* Current status */}
                          <div className={cn(
                            "font-medium",
                            statusInfo.status === 'in-use' ? 'text-red-600' : 
                            statusInfo.status === 'upcoming' ? 'text-amber-600' : 
                            'text-green-600'
                          )}>
                            {statusInfo.status === 'in-use' 
                              ? statusInfo.currentBooking?.title || 'In Use' 
                              : statusInfo.status === 'upcoming' 
                                ? statusInfo.nextBooking?.title || 'Upcoming Booking'
                                : 'Available'}
                          </div>
                          
                          {/* Time information for status */}
                          {statusInfo.status === 'in-use' && statusInfo.currentBooking && (
                            <div className="text-xs text-gray-600 mt-1 flex items-center gap-1">
                              <Clock size={12} />
                              {formatTimeRange(
                                new Date(statusInfo.currentBooking.start), 
                                new Date(statusInfo.currentBooking.end)
                              )}
                            </div>
                          )}
                          
                          {/* Show linked studios if applicable */}
                          {statusInfo.currentBooking && getLinkedStudiosForBooking(statusInfo.currentBooking).length > 1 && (
                            <div className="text-xs text-gray-600 flex items-center gap-1 mt-1">
                              <Tv size={12} />
                              {getAllStudiosForBooking(statusInfo.currentBooking)}
                            </div>
                          )}
                          
                          {statusInfo.status === 'upcoming' && statusInfo.nextBooking && (
                            <div className="text-xs text-amber-600 mt-1">
                              Starts in {formatDistance(new Date(statusInfo.nextBooking.start), now)}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>
        
        {/* Timeline Tab */}
        <TabsContent value="timeline" className="flex-1 overflow-auto pb-20 -mx-1 px-1 overscroll-contain">
          <div className="p-4 space-y-4">
            
            {todayBookings.length > 0 ? (
              <div className="space-y-3">
                {todayBookings
                  // Include both studio bookings and facility alerts in timeline view
                  .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
                  .map(booking => {
                    const bookingStart = new Date(booking.start);
                    const bookingEnd = new Date(booking.end);
                    const isActive = bookingStart <= now && bookingEnd > now;
                    const isUpcoming = isAfter(bookingStart, now);
                    const isPastBooking = isBefore(bookingEnd, now);
                    
                    // Determine if this is a facility alert
                    const isFacilityAlert = booking.studioId === null;
                    
                    // Get all studios linked to this booking
                    const linkedStudios = extractStudiosFromBooking(booking, studios);
                    
                    return (
                      <div 
                        key={booking.id}
                        onClick={() => handleBookingClick(booking)}
                        className={cn(
                          "p-4 rounded-lg border shadow-sm cursor-pointer transition-colors active:bg-gray-100",
                          booking.status === "tentative" ? "border-dashed" : "",
                          isFacilityAlert 
                            ? "bg-rose-50 border-rose-300" 
                            : booking.color 
                              ? {
                                  "bg-opacity-15 border-opacity-30": true,
                                  "border-current": true
                                }
                              : isActive 
                                ? "bg-red-50 border-red-200" 
                                : isUpcoming 
                                  ? "bg-amber-50 border-amber-200" 
                                  : "bg-gray-50 border-gray-200"
                        )}
                        style={!isFacilityAlert && booking.color ? { 
                          backgroundColor: `${booking.color}20`, /* 12.5% opacity */
                          borderColor: booking.color
                        } : {}}
                      >
                        <div className="flex justify-between items-start">
                          <h3 className="font-medium">{booking.title}</h3>
                          {isFacilityAlert ? (
                            <Badge variant="destructive">Facility Alert</Badge>
                          ) : (
                            <Badge 
                              variant={getLinkedStudiosForBooking(booking).length > 1 ? "secondary" : "outline"}
                              className="flex items-center gap-1"
                            >
                              {getLinkedStudiosForBooking(booking).length > 1 && <Tv size={12} />}
                              {getLinkedStudiosForBooking(booking).length > 1 
                                ? `${getLinkedStudiosForBooking(booking).length} Studios` 
                                : getStudiosForBooking(booking) || 'Unknown'}
                            </Badge>
                          )}
                        </div>
                        
                        <div className="text-sm text-gray-500 flex items-center gap-1 mt-2">
                          <Clock size={14} />
                          {formatTimeRange(bookingStart, bookingEnd)}
                        </div>
                        
                        {/* Show detailed studio list for all non-facility bookings */}
                        {!isFacilityAlert && getLinkedStudiosForBooking(booking).length > 0 && (
                          <div className="text-xs text-gray-500 flex items-center gap-1 mt-2">
                            <Tv size={14} />
                            {getAllStudiosForBooking(booking)}
                          </div>
                        )}

                        {/* PCR Room - Direct Display */}
                        <div className="text-xs text-gray-500 flex items-center gap-1 mt-2 bg-gray-100 p-1 rounded">
                          <MonitorPlay size={14} className="text-blue-500" />
                          <div>
                            PCR: {booking.pcrRoomId ? getPcrRoom(booking)?.name || "None" : "None"} 
                          </div>
                        </div>
                        
                        {isFacilityAlert && booking.severity && (
                          <div className="text-xs text-red-600 mt-1 flex items-center">
                            <AlertTriangle size={12} className="mr-1" />
                            <span className="capitalize">{booking.severity} severity</span>
                          </div>
                        )}
                        
                        {isUpcoming && (
                          <div className="text-xs text-amber-700 mt-2 flex items-center gap-1">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="12" r="10" />
                              <polyline points="12 6 12 12 16 14" />
                            </svg>
                            Starts in {formatDistance(bookingStart, now)}
                          </div>
                        )}
                        
                        {isActive && (
                          <div className="text-xs text-red-700 mt-2 flex items-center gap-1">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M10 2h4v4h-4z" />
                              <path d="M4.6 10.4L2.5 8.3l2.8-2.9L7.4 7.5z" />
                              <path d="M19.4 10.4l2.1-2.1-2.8-2.9-2.1 2.1z" />
                              <path d="M2 18h20" />
                              <path d="M18 18a5 5 0 0 0-5-5h-2a5 5 0 0 0-5 5" />
                            </svg>
                            In progress - Ends in {formatDistance(bookingEnd, now)}
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Calendar size={48} className="mx-auto mb-2 text-gray-400" />
                <p>No bookings scheduled for today</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Modals */}
      {/* Edit Booking Modal */}
      {editBooking && editBooking.type !== 'maintenance' && editBooking.type !== 'alert' && editBooking.type !== 'it_support' && (
        <MobileBookingForm
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setEditBooking(null);
          }}
          booking={editBooking}
          selectedDate={currentDate}
        />
      )}
      
      {/* Debug log when edit modal opens */}
      {isEditModalOpen && editBooking && console.log("MobileDailyView - Edit Modal Opening:", {
        bookingId: editBooking.id,
        bookingTitle: editBooking.title,
        editModalIsOpen: isEditModalOpen,
        editBookingData: editBooking
      })}
      
      {/* New Booking Modal */}
      <MobileBookingForm
        isOpen={isNewBookingModalOpen}
        onClose={() => setIsNewBookingModalOpen(false)}
        selectedDate={selectedDate || currentDate}
      />
      
      {/* New Alert Modal */}
      <AlertModal
        isOpen={isNewAlertModalOpen}
        onClose={() => {
          setIsNewAlertModalOpen(false);
          setEditBooking(null);
        }}
        selectedDate={selectedDate || currentDate}
        alert={editBooking && (editBooking.type === 'maintenance' || editBooking.type === 'alert' || editBooking.type === 'it_support') ? editBooking : undefined}
      />
    </div>
  );
}