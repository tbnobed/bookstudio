import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Booking, Studio } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

// Define extended Booking type with bookingStudios
interface BookingWithStudios extends Booking {
  bookingStudios?: { bookingId: number; studioId: number }[];
}

import { cn } from "@/lib/utils";
import { isToday, isPast, isAfter, isBefore, formatDistance, format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, CalendarDays, AlertTriangle, Activity, Tv, MonitorPlay, LogIn } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLocation } from "wouter";
import { formatTime, formatDate, isSameDay, formatTimeRange } from "@/lib/dateUtils";
import { getDayRangeInChicago } from "@/utils/dateUtils";

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
  
  return result;
}

interface MobilePublicDailyViewProps {
  initialDate?: Date;
  onDateChange?: (date: Date) => void;
}

export default function MobilePublicDailyView({ 
  initialDate = new Date(),
  onDateChange = () => {}
}: MobilePublicDailyViewProps) {
  const [, navigate] = useLocation();
  const [currentDate, setCurrentDate] = useState<Date>(initialDate);
  const [activeTab, setActiveTab] = useState<"studios" | "alerts">("studios");
  
  // Handle date change from parent component
  useEffect(() => {
    setCurrentDate(initialDate);
  }, [initialDate]);
  
  // Fetch studios
  const { data: studios = [] } = useQuery<Studio[]>({
    queryKey: ['/api/studios'],
    staleTime: 60 * 1000, // 1 minute
  });
  
  // Get the date range for today in Chicago timezone
  const { startOfDay, endOfDay } = getDayRangeInChicago(currentDate);
  
  console.log("MobilePublicDailyView - Showing bookings for", formatDate(currentDate), "in Chicago timezone");
  console.log("MobilePublicDailyView - Date range:", startOfDay.toISOString(), "to", endOfDay.toISOString());
  
  // Fetch bookings from public API for the current date
  const { data: allBookings = [], isLoading, error } = useQuery<BookingWithStudios[]>({
    queryKey: ['/api/public/bookings', startOfDay.toISOString(), endOfDay.toISOString()],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/public/bookings?start=${startOfDay.toISOString()}&end=${endOfDay.toISOString()}`);
      return res.json();
    },
    staleTime: 60 * 1000, // 1 minute
  });
  
  // Fetch booking-studio links from public API
  const { data: bookingStudioLinks = [] } = useQuery({
    queryKey: ['/api/public/booking-studios'],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/public/booking-studios`);
      return res.json();
    },
    staleTime: 60 * 1000, // 1 minute
  });
  
  // Today's bookings
  const todayBookings = allBookings.filter(booking => {
    const bookingStart = new Date(booking.start);
    const bookingEnd = new Date(booking.end);
    
    // Check if booking overlaps with current day
    const overlapsWithToday = (
      (isSameDay(bookingStart, currentDate) || isSameDay(bookingEnd, currentDate)) ||
      (isBefore(bookingStart, startOfDay) && isAfter(bookingEnd, startOfDay))
    );
    
    console.log(`Booking ${booking.id} (${booking.title}) overlapping: ${overlapsWithToday}, on current day: ${isSameDay(bookingStart, currentDate)}`);
    
    return overlapsWithToday;
  });
  
  console.log(`After filtering, found ${todayBookings.length} bookings for today (${formatDate(currentDate)})`);
  
  // Enhanced bookings with bookingStudios junction data
  const bookingsWithStudios = todayBookings.map(booking => {
    const bookingId = booking.id;
    
    // Find all booking-studio links for this booking
    const studioLinks = bookingStudioLinks.filter(
      link => link.bookingId === bookingId
    );
    
    // Attach the links to the booking
    return {
      ...booking,
      bookingStudios: studioLinks
    };
  });
  
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
    // Update both the prop callback and the component state
    onDateChange(prevDay);
    setCurrentDate(prevDay);
  };

  const goToNextDay = () => {
    const nextDay = new Date(currentDate);
    nextDay.setDate(nextDay.getDate() + 1);
    // Update both the prop callback and the component state
    onDateChange(nextDay);
    setCurrentDate(nextDay);
  };
  
  // Navigate to today
  const goToToday = () => {
    const today = new Date();
    // Update both the prop callback and the component state
    onDateChange(today);
    setCurrentDate(today);
  };

  // Helper to get PCR room for a booking
  const getPcrRoom = (booking: BookingWithStudios) => {
    if (!booking?.pcrRoomId) return null;
    const room = pcrRooms.find(pcr => pcr.id === booking.pcrRoomId);
    return room;
  };
  
  // Fetch PCR rooms
  const { data: pcrRooms = [] } = useQuery({
    queryKey: ['/api/pcr-rooms'],
    staleTime: 60 * 1000, // 1 minute
  });

  // Navigate to login page
  const handleLoginClick = () => {
    navigate("/auth");
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white">
      {/* Header with date navigation */}
      <div className="border-b p-4 bg-white sticky top-0 z-10">
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
              {formatDate(currentDate)}
            </span>
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

      {/* Tabs for Studios and Alerts */}
      <div className="border-b">
        <Tabs 
          defaultValue="studios" 
          value={activeTab} 
          onValueChange={(value) => setActiveTab(value as "studios" | "alerts")}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="studios">Studios</TabsTrigger>
            <TabsTrigger value="alerts" className="relative">
              Alerts
              {facilityAlerts.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
                  {facilityAlerts.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="studios" className="p-0">
            {/* Studios List */}
            <div className="overflow-y-auto">
              {studios.map((studio) => {
                const studioBookings = bookingsByStudio[studio.id] || [];
                
                return (
                  <div key={studio.id} className="border-b last:border-b-0">
                    <div className="bg-gray-50 p-3 sticky top-0">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center">
                          <Tv className="h-4 w-4 mr-2 text-blue-800" />
                          <h3 className="font-medium">{studio.name}</h3>
                        </div>
                      </div>
                    </div>
                    
                    <div className="px-3 pb-2">
                      {studioBookings.length === 0 ? (
                        <div className="py-3 text-center text-gray-500 text-sm">
                          No bookings scheduled
                        </div>
                      ) : (
                        <div className="space-y-2 py-2">
                          {studioBookings.map((booking) => {
                            const startTime = new Date(booking.start);
                            const endTime = new Date(booking.end);
                            const pcrRoom = getPcrRoom(booking);
                            
                            // Get linked studios for this booking
                            const linkedStudios = extractStudiosFromBooking(booking, studios);
                            
                            console.log(`Getting linked studios for booking ${booking.id} (${booking.title})`);
                            if (booking.studioId) {
                              console.log(`Found direct link to studio ${booking.studioId} (${studios.find(s => s.id === booking.studioId)?.name})`);
                            }
                            
                            if (booking.bookingStudios && booking.bookingStudios.length > 0) {
                              console.log(`Finding linked studios for booking ${booking.id}: found ${booking.bookingStudios.length} links`);
                            }
                            console.log(`Total studios linked to booking ${booking.id}: ${linkedStudios.length} (${linkedStudios.map(s => s.name).join(', ')})`);
                            
                            return (
                              <div 
                                key={booking.id} 
                                className={cn(
                                  "rounded-md shadow-sm p-3 text-sm border-l-4",
                                  booking.status === "confirmed" ? "border-l-green-500 bg-green-50" :
                                  booking.status === "tentative" ? "border-l-orange-500 bg-orange-50" :
                                  booking.status === "cancelled" ? "border-l-red-500 bg-red-50" :
                                  booking.type === "maintenance" ? "border-l-purple-500 bg-purple-50" :
                                  booking.type === "alert" || booking.severity ? "border-l-amber-500 bg-amber-50" :
                                  "border-l-blue-500 bg-blue-50"
                                )}
                              >
                                <div className="flex justify-between mb-1">
                                  <div className="font-medium">{booking.title}</div>
                                  <div className="text-gray-600 text-xs flex items-center">
                                    <Clock className="h-3 w-3 mr-1 inline" /> 
                                    {formatTimeRange(startTime, endTime)}
                                  </div>
                                </div>
                                
                                {booking.description && (
                                  <div className="text-xs text-gray-600 mb-1 line-clamp-2">
                                    {booking.description}
                                  </div>
                                )}
                                
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                  {/* Status badge */}
                                  {booking.status && (
                                    <Badge variant="outline" className={cn(
                                      "text-xs",
                                      booking.status === "confirmed" ? "border-green-500 text-green-700 bg-green-50" :
                                      booking.status === "tentative" ? "border-orange-500 text-orange-700 bg-orange-50" :
                                      booking.status === "cancelled" ? "border-red-500 text-red-700 bg-red-50" :
                                      "border-gray-500 text-gray-700 bg-gray-50"
                                    )}>
                                      {booking.status}
                                    </Badge>
                                  )}
                                  
                                  {/* Type badge */}
                                  {booking.type && (
                                    <Badge variant="outline" className="text-xs border-gray-300">
                                      {booking.type}
                                    </Badge>
                                  )}
                                  
                                  {/* PCR Room badge */}
                                  {pcrRoom && (
                                    <Badge variant="outline" className="text-xs border-gray-300 bg-gray-100">
                                      <MonitorPlay className="mr-1 h-3 w-3" />
                                      {pcrRoom.name}
                                    </Badge>
                                  )}
                                  
                                  {/* Show studio links if more than the current studio */}
                                  {linkedStudios.length > 1 && (
                                    <Badge variant="outline" className="text-xs border-blue-300 bg-blue-50 text-blue-700">
                                      <Tv className="mr-1 h-3 w-3" />
                                      {linkedStudios.length} studios
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>
          
          <TabsContent value="alerts" className="p-0">
            {/* Alerts List */}
            <div className="p-3">
              {facilityAlerts.length === 0 ? (
                <div className="py-4 text-center text-gray-500">
                  No facility alerts for this day
                </div>
              ) : (
                <div className="space-y-3">
                  {facilityAlerts.map((alert) => {
                    const startTime = new Date(alert.start);
                    const endTime = new Date(alert.end);
                    
                    return (
                      <div 
                        key={alert.id} 
                        className={cn(
                          "rounded-md shadow-sm p-3 text-sm border-l-4",
                          alert.severity === "high" ? "border-l-red-500 bg-red-50" :
                          alert.severity === "medium" ? "border-l-amber-500 bg-amber-50" :
                          "border-l-blue-500 bg-blue-50"
                        )}
                      >
                        <div className="flex justify-between">
                          <div className="font-medium flex items-center">
                            <AlertTriangle className={cn(
                              "h-4 w-4 mr-1",
                              alert.severity === "high" ? "text-red-500" :
                              alert.severity === "medium" ? "text-amber-500" :
                              "text-blue-500"
                            )} />
                            {alert.title}
                          </div>
                          <div className="text-gray-600 text-xs">
                            {formatTimeRange(startTime, endTime)}
                          </div>
                        </div>
                        
                        {alert.description && (
                          <div className="text-xs text-gray-600 mt-1">
                            {alert.description}
                          </div>
                        )}
                        
                        <div className="flex gap-1 mt-2">
                          {alert.severity && (
                            <Badge variant={alert.severity === "high" ? "destructive" : "outline"} className="text-xs">
                              {alert.severity} severity
                            </Badge>
                          )}
                          
                          {alert.type && alert.type !== "alert" && (
                            <Badge variant="outline" className="text-xs">
                              {alert.type}
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="flex justify-center items-center h-full">
            <div className="animate-spin h-6 w-6 border-t-2 border-blue-500 rounded-full"></div>
          </div>
        )}
        
        {error && (
          <div className="p-4 text-center text-red-500">
            Failed to load bookings. Please try again.
          </div>
        )}
      </div>
      
      {/* Bottom Navigation Bar (Login button instead of Add button) */}
      <div className="border-t flex items-center bg-white h-16 px-4">
        <div className="grid grid-cols-3 w-full">
          {/* Calendar Navigation */}
          <button className="flex flex-col items-center justify-center h-full text-gray-600">
            <CalendarDays size={20} />
            <span className="text-xs mt-1">Calendar</span>
          </button>
          
          {/* Login Button */}
          <div className="flex flex-col items-center justify-center w-full h-full">
            <button 
              onClick={handleLoginClick}
              className="rounded-full bg-blue-600 p-3 text-white shadow-md"
            >
              <LogIn size={24} />
            </button>
          </div>
          
          {/* Empty slot for symmetry */}
          <div className="flex flex-col items-center justify-center w-full h-full">
          </div>
        </div>
      </div>
    </div>
  );
}