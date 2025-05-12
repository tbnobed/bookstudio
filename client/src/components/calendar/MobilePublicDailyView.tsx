import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Booking, Studio } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { isToday, isAfter, isBefore, format } from "date-fns";
import { Button } from "@/components/ui/button";
import { 
  Calendar, 
  Clock, 
  Tv, 
  MonitorPlay, 
  LogIn, 
  AlertTriangle,
  Activity
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLocation } from "wouter";
import { formatDate, isSameDay, formatTimeRange } from "@/lib/dateUtils";
import { getDayRangeInChicago } from "@/utils/dateUtils";
import { useStudioStatus } from "@/hooks/use-studio-status";

// Define extended Booking type with bookingStudios
interface BookingWithStudios extends Booking {
  bookingStudios?: { bookingId: number; studioId: number }[];
}

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
    booking.bookingStudios.forEach((bs: { bookingId: number; studioId: number }) => {
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
  
  // Handle date change from parent component
  useEffect(() => {
    setCurrentDate(initialDate);
  }, [initialDate]);
  
  // Fetch studios
  const { data: studios = [] } = useQuery<Studio[]>({
    queryKey: ['/api/studios'],
    staleTime: 60 * 1000, // 1 minute
  });
  
  // Fetch PCR rooms
  const { data: pcrRooms = [] } = useQuery<any[]>({
    queryKey: ['/api/pcr-rooms'],
    staleTime: 60 * 1000, // 1 minute
  });
  
  // Get the date range for today in Chicago timezone
  const dateRange = getDayRangeInChicago(currentDate);
  
  // Fetch public bookings for the current date
  const { data: publicBookings = [], isLoading, error } = useQuery<BookingWithStudios[]>({
    queryKey: ['/api/public/bookings', dateRange.start.toISOString(), dateRange.end.toISOString()],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/public/bookings?start=${dateRange.start.toISOString()}&end=${dateRange.end.toISOString()}`);
      return res.json();
    },
    staleTime: 30 * 1000, // 30 seconds
  });
  
  // Fetch booking-studio relationships
  const { data: bookingStudios = [] } = useQuery<{ id: number; bookingId: number; studioId: number }[]>({
    queryKey: ['/api/public/booking-studios'],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/public/booking-studios`);
      return res.json();
    },
    staleTime: 60 * 1000, // 1 minute
  });
  
  // Use studio status hook to show real-time status
  const { getAllStudiosWithStatus } = useStudioStatus(publicBookings);
  const studiosWithStatus = getAllStudiosWithStatus();
  
  // Console logs for debugging
  console.log("MobilePublicDailyView - Showing bookings for", format(currentDate, "MMM d, yyyy"), "in Chicago timezone");
  console.log("MobilePublicDailyView - Date range:", dateRange.start.toISOString(), "to", dateRange.end.toISOString());
  
  // Filter bookings for today
  const todayBookings = publicBookings.filter(booking => {
    const bookingStart = new Date(booking.start);
    const bookingEnd = new Date(booking.end);
    
    // Check if booking overlaps with current day
    const overlapsWithToday = (
      (isSameDay(bookingStart, currentDate) || isSameDay(bookingEnd, currentDate)) ||
      (bookingStart <= dateRange.end && bookingEnd >= dateRange.start)
    );
    
    return overlapsWithToday && booking.type !== 'alert' && booking.type !== 'maintenance';
  });
  
  // Process bookings to include their studio relationships
  const bookingsWithStudios = todayBookings.map(booking => {
    const relatedBookingStudios = bookingStudios.filter(bs => bs.bookingId === booking.id);
    return {
      ...booking,
      bookingStudios: relatedBookingStudios,
    };
  });
  
  // Filter facility alerts (bookings with type 'alert' or 'maintenance')
  const facilityAlerts = publicBookings.filter(booking => 
    booking.type === 'alert' || 
    booking.type === 'maintenance' || 
    booking.severity !== null
  );
  
  // Organize bookings by studio
  const bookingsByStudio: Record<number, BookingWithStudios[]> = {};
  
  studios.forEach(studio => {
    // Get all bookings that are linked to this studio (either directly or through booking_studios)
    bookingsByStudio[studio.id] = bookingsWithStudios.filter(booking => {
      // Direct studio reference
      if (booking.studioId === studio.id) {
        return true;
      }
      
      // Check booking_studios junction table
      if (booking.bookingStudios && booking.bookingStudios.length > 0) {
        return booking.bookingStudios.some(bs => bs.studioId === studio.id);
      }
      
      return false;
    });
  });
  
  // Navigation functions
  function goToPreviousDay() {
    const prevDay = new Date(currentDate);
    prevDay.setDate(prevDay.getDate() - 1);
    setCurrentDate(prevDay);
    onDateChange(prevDay);
  }
  
  function goToNextDay() {
    const nextDay = new Date(currentDate);
    nextDay.setDate(nextDay.getDate() + 1);
    setCurrentDate(nextDay);
    onDateChange(nextDay);
  }
  
  function goToToday() {
    const today = new Date();
    setCurrentDate(today);
    onDateChange(today);
  }
  
  function handleLoginClick() {
    navigate("/auth");
  }
  
  // Helper to get PCR room for a booking
  const getPcrRoom = (booking: BookingWithStudios) => {
    if (!booking?.pcrRoomId) return null;
    const room = pcrRooms.find((pcr: { id: number; name: string }) => pcr.id === booking.pcrRoomId);
    return room || { id: booking.pcrRoomId, name: `PCR ${booking.pcrRoomId}` };
  };
  
  // Update document title with site name
  useEffect(() => {
    fetch('/api/system/site-name')
      .then(res => res.json())
      .then(data => {
        document.title = data.siteName || "Studio Booking";
      })
      .catch(err => {
        console.error("Error fetching site name:", err);
      });
  }, []);

  // Map studio status to a color
  const getStudioStatusColor = (studio: any) => {
    if (!studio.statusInfo) return 'bg-gray-300';
    
    switch (studio.statusInfo.status) {
      case 'in-use':
        return 'bg-red-500';
      case 'maintenance':
        return 'bg-orange-500';
      case 'upcoming':
        return 'bg-yellow-400';
      case 'available':
        return 'bg-blue-500';
      default:
        return 'bg-gray-300';
    }
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
              {isToday(currentDate) ? "Today" : format(currentDate, "MMM d, yyyy")}
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



      {/* Main content - Studios and bookings */}
      <Tabs defaultValue="studios" className="flex-1 overflow-hidden flex flex-col">
        <TabsList className="grid grid-cols-2 mx-4 mt-2 sticky top-0 z-10">
          <TabsTrigger value="studios">Studios Status</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>
        
        {/* Studios Status Tab */}
        <TabsContent value="studios" className="flex-1 overflow-auto pb-20 -mx-1 px-1 overscroll-contain">
          {isLoading ? (
            <div className="flex justify-center items-center h-32">
              <div className="animate-spin h-6 w-6 border-t-2 border-blue-500 rounded-full"></div>
            </div>
          ) : error ? (
            <div className="p-4 text-center text-red-500">
              Failed to load bookings. Please try again.
            </div>
          ) : (
            <div className="p-4 grid grid-cols-1 gap-4">
              {studios.map(studio => {
                const studioBookings = bookingsByStudio[studio.id] || [];
                const studioStatus = studiosWithStatus.find(s => s.id === studio.id);
                const statusColor = getStudioStatusColor(studioStatus || {});
                
                return (
                  <div key={studio.id} className="bg-white rounded-lg border shadow-sm overflow-hidden touch-pan-y">
                    <div className="flex items-center p-4 border-b sticky top-0 bg-white">
                      <div className={`w-3 h-3 rounded-full mr-2 ${statusColor}`}></div>
                      <h3 className="font-medium flex-1">{studio.name}</h3>
                    </div>
                    
                    <div className="divide-y">
                      {studioBookings.length === 0 ? (
                        <div className="p-4 text-center text-gray-500 italic">
                          No bookings scheduled
                        </div>
                      ) : (
                        studioBookings.map(booking => {
                          const startTime = new Date(booking.start);
                          const endTime = new Date(booking.end);
                          const pcrRoom = getPcrRoom(booking);
                          
                          return (
                            <div key={booking.id} className="p-3 hover:bg-gray-50">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <h4 className="font-medium text-gray-900">{booking.title}</h4>
                                  {booking.description && (
                                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                                      {booking.description}
                                    </p>
                                  )}
                                </div>
                                
                                <div className="text-sm text-gray-500 whitespace-nowrap ml-2">
                                  {formatTimeRange(startTime, endTime)}
                                </div>
                              </div>
                              
                              {/* Status badges */}
                              <div className="flex flex-wrap gap-1 mt-2">
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
                                
                                {booking.type && (
                                  <Badge variant="outline" className="text-xs border-gray-300">
                                    {booking.type}
                                  </Badge>
                                )}
                                
                                {pcrRoom && (
                                  <Badge variant="outline" className="text-xs border-gray-300 bg-gray-50 flex items-center gap-1">
                                    <MonitorPlay className="h-3 w-3" />
                                    {pcrRoom.name}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="timeline" className="flex-1 overflow-auto pb-20">
          {isLoading ? (
            <div className="flex justify-center items-center h-32">
              <div className="animate-spin h-6 w-6 border-t-2 border-blue-500 rounded-full"></div>
            </div>
          ) : error ? (
            <div className="p-4 text-center text-red-500">
              Failed to load bookings. Please try again.
            </div>
          ) : (
            <div className="p-4">
              {/* Timeline view - all bookings sorted by time */}
              {bookingsWithStudios.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Calendar size={48} className="mx-auto mb-2 text-gray-400" />
                  <p>No bookings scheduled for today</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {bookingsWithStudios.map(booking => {
                    const startTime = new Date(booking.start);
                    const endTime = new Date(booking.end);
                    const pcrRoom = getPcrRoom(booking);
                    
                    // Get linked studios for this booking
                    const linkedStudios = extractStudiosFromBooking(booking, studios);
                    
                    return (
                      <div 
                        key={booking.id} 
                        className={cn(
                          "rounded-lg border shadow-sm overflow-hidden",
                          booking.status === "confirmed" ? "border-l-4 border-l-green-500" :
                          booking.status === "tentative" ? "border-l-4 border-l-orange-500" :
                          booking.status === "cancelled" ? "border-l-4 border-l-red-500" :
                          "border-l-4 border-l-blue-500"
                        )}
                      >
                        <div className="p-4">
                          <div className="flex justify-between items-start mb-2">
                            <h3 className="font-medium">{booking.title}</h3>
                            <div className="text-sm text-gray-500">
                              {formatTimeRange(startTime, endTime)}
                            </div>
                          </div>
                          
                          {booking.description && (
                            <p className="text-sm text-gray-600 mb-3">
                              {booking.description}
                            </p>
                          )}
                          
                          {/* Studios involved */}
                          <div className="flex flex-wrap gap-2 mb-2">
                            {linkedStudios.map(studio => (
                              <Badge key={studio.id} className="bg-blue-100 text-blue-800 hover:bg-blue-200">
                                <Tv className="h-3 w-3 mr-1" /> {studio.name}
                              </Badge>
                            ))}
                          </div>
                          
                          {/* Status and other badges */}
                          <div className="flex flex-wrap gap-1 mt-2">
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
                            
                            {booking.type && (
                              <Badge variant="outline" className="text-xs border-gray-300">
                                {booking.type}
                              </Badge>
                            )}
                            
                            {pcrRoom && (
                              <Badge variant="outline" className="text-xs border-gray-300 bg-gray-50 flex items-center gap-1">
                                <MonitorPlay className="h-3 w-3" />
                                {pcrRoom.name}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
      
      {/* Fixed bottom navigation bar with only login button */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
        <div className="flex items-center justify-center h-16">
          {/* Login Button (center only) */}
          <div className="flex flex-col items-center justify-center">
            <button 
              onClick={handleLoginClick}
              className="rounded-full bg-blue-600 p-3 text-white shadow-md"
            >
              <LogIn size={24} />
            </button>
            <span className="text-xs mt-1">Log in</span>
          </div>
        </div>
      </div>
    </div>
  );
}