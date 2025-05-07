import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Booking, Studio } from "@shared/schema";
import { cn } from "@/lib/utils";
import { isToday, isPast, isAfter, isBefore, formatDistance, format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, CalendarDays, Plus, AlertTriangle, Activity } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import BookingModal from "@/components/booking/BookingModal";
import AlertModal from "@/components/alerts/AlertModal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLocation } from "wouter";
import { useStudioStatus } from "@/hooks/use-studio-status";
import { formatTime, formatDate, isSameDay, formatTimeRange } from "@/lib/dateUtils";

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
  
  // Use our studio status hook to get real-time status
  const { 
    getAllStudiosWithStatus, 
    getStudioStatus,
    studios,
    now 
  } = useStudioStatus();

  // Prepare date range for the day (midnight to midnight)
  const dayStart = new Date(currentDate);
  dayStart.setHours(0, 0, 0, 0);
  
  const dayEnd = new Date(currentDate);
  dayEnd.setHours(23, 59, 59, 999);

  // Fetch bookings for the selected day
  const { data: todayBookings = [] } = useQuery<Booking[]>({
    queryKey: [`/api/bookings?start=${dayStart.toISOString()}&end=${dayEnd.toISOString()}`],
  });

  // Group bookings by studio
  const bookingsByStudio = studios.reduce((acc, studio) => {
    acc[studio.id] = todayBookings.filter(booking => booking.studioId === studio.id);
    return acc;
  }, {} as Record<number, Booking[]>);

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
    onDateChange(prevDay);
  };

  const goToNextDay = () => {
    const nextDay = new Date(currentDate);
    nextDay.setDate(nextDay.getDate() + 1);
    onDateChange(nextDay);
  };

  // Switch to weekly view
  const switchToWeeklyView = () => {
    onViewChange("week");
  };

  // Handle booking/slot click
  const handleBookingClick = (booking: Booking) => {
    setEditBooking(booking);
    setIsEditModalOpen(true);
  };

  // Get all studios with their current status
  const studiosWithStatus = getAllStudiosWithStatus();

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white">
      {/* Header with date navigation */}
      <div className="border-b p-4 flex justify-between items-center bg-white sticky top-0 z-10">
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

      {/* View toggle */}
      <div className="p-2 flex justify-center">
        <Button 
          variant="outline" 
          size="sm"
          className="flex items-center gap-2" 
          onClick={switchToWeeklyView}
        >
          <CalendarDays size={16} />
          <span>Switch to Weekly View</span>
        </Button>
      </div>

      {/* Real-time Studio Status Banner */}
      {isToday(currentDate) && (
        <div className="px-4 py-2 bg-blue-50 border-y border-blue-100">
          <h2 className="text-sm font-semibold text-blue-800 mb-1 flex items-center gap-2">
            <Activity size={16} />
            Real-Time Studio Status
          </h2>
          <div className="flex flex-wrap gap-2">
            {studiosWithStatus.map(studio => {
              const { statusInfo } = studio;
              return (
                <Badge 
                  key={studio.id}
                  variant={
                    statusInfo.status === 'in-use' ? 'destructive' : 
                    statusInfo.status === 'maintenance' ? 'outline' :
                    statusInfo.status === 'upcoming' ? 'secondary' : 'default'
                  }
                  className="flex items-center gap-1"
                >
                  <div className={`w-2 h-2 rounded-full ${statusInfo.color}`}></div>
                  <span>{studio.name}</span>
                </Badge>
              );
            })}
          </div>
        </div>
      )}

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
      <Tabs defaultValue="studios" className="flex-1 overflow-hidden flex flex-col">
        <TabsList className="grid grid-cols-2 mx-4 mt-2 sticky top-0 z-10">
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
                                isActive ? "bg-red-50 border-red-200" : 
                                isUpcoming ? "bg-amber-50 border-amber-200" : 
                                "bg-gray-50 border-gray-200"
                              )}
                            >
                              <div className="font-medium text-sm">{booking.title}</div>
                              <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                                <Clock size={12} />
                                {formatTimeRange(bookingStart, bookingEnd)}
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
                      <div className="text-center text-gray-500 py-2 text-sm">
                        No bookings today
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
            <h2 className="text-lg font-semibold mb-4 sticky top-0 bg-white py-2 -mt-2 -mx-4 px-4 z-10 border-b">Today's Schedule</h2>
            
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
                    
                    // Find studio name if not a facility alert
                    const studio = !isFacilityAlert ? studios.find(s => s.id === booking.studioId) : null;
                    
                    return (
                      <div 
                        key={booking.id}
                        onClick={() => handleBookingClick(booking)}
                        className={cn(
                          "p-4 rounded-lg border shadow-sm cursor-pointer transition-colors active:bg-gray-100",
                          isFacilityAlert ? "bg-rose-50 border-rose-300" :
                          isActive ? "bg-red-50 border-red-200" : 
                          isUpcoming ? "bg-amber-50 border-amber-200" : 
                          "bg-gray-50 border-gray-200"
                        )}
                      >
                        <div className="flex justify-between items-start">
                          <h3 className="font-medium">{booking.title}</h3>
                          {isFacilityAlert ? (
                            <Badge variant="destructive">Facility Alert</Badge>
                          ) : (
                            <Badge variant="outline">{studio?.name || 'Unknown'}</Badge>
                          )}
                        </div>
                        
                        <div className="text-sm text-gray-500 flex items-center gap-1 mt-2">
                          <Clock size={14} />
                          {formatTimeRange(bookingStart, bookingEnd)}
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
      {editBooking && (
        <BookingModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          booking={editBooking}
        />
      )}
      
      {/* New Booking Modal */}
      <BookingModal
        isOpen={isNewBookingModalOpen}
        onClose={() => setIsNewBookingModalOpen(false)}
        selectedDate={currentDate}
      />
      
      {/* New Alert Modal */}
      <AlertModal
        isOpen={isNewAlertModalOpen}
        onClose={() => setIsNewAlertModalOpen(false)}
        selectedDate={currentDate}
      />
    </div>
  );
}