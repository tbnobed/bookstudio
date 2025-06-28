import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { useStudioBookings } from "@/hooks/useStudioBookings";
import { useQuery } from "@tanstack/react-query";
import { Studio } from "@shared/schema";
import { formatDateTimeRange } from "@/lib/dateUtils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import BookingModal from "@/components/booking/BookingModal";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { startOfWeek, endOfWeek, isWithinInterval, format } from "date-fns";
import { useSiteSettings } from "@/hooks/useSiteSettings";

export default function MyBookingsPage() {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const { userBookings, isLoading, deleteBooking } = useStudioBookings();
  const [editBookingId, setEditBookingId] = useState<number | null>(null);
  const [isNewBookingModalOpen, setIsNewBookingModalOpen] = useState(false);
  const { siteName } = useSiteSettings();
  
  // Detect mobile for responsive banner
  const isMobile = window.innerWidth <= 768;
  
  // Fetch studios to display names
  const { data: studios = [] } = useQuery<Studio[]>({
    queryKey: ["/api/studios"],
  });

  // Get studio name by ID
  const getStudioName = (studioId: number) => {
    const studio = studios.find(s => s.id === studioId);
    return studio ? studio.name : `Studio ${studioId}`;
  };

  // Get color for booking type
  const getBookingTypeColor = (type: string) => {
    switch (type) {
      case "production":
        return "bg-blue-100 text-blue-800 border-blue-300";
      case "maintenance":
        return "bg-amber-100 text-amber-800 border-amber-300";
      case "it_support":
        return "bg-red-100 text-red-800 border-red-300";
      case "rehearsal":
        return "bg-purple-100 text-purple-800 border-purple-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  // Format booking type for display
  const formatBookingType = (type: string) => {
    return type.replace("_", " ").split(" ").map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(" ");
  };

  // Handle delete booking
  const handleDeleteBooking = (id: number) => {
    if (confirm("Are you sure you want to delete this booking?")) {
      deleteBooking.mutate(id);
    }
  };

  // Get the week range for the selected date
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 }); // Start week on Sunday
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });
  
  // Filter bookings for the selected week
  const weekBookings = userBookings.filter(booking => {
    const bookingDate = new Date(booking.start);
    return isWithinInterval(bookingDate, { start: weekStart, end: weekEnd });
  }).sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  // Separate into current and future vs past for the selected week
  const currentTime = new Date();
  const upcomingBookings = weekBookings.filter(booking => 
    new Date(booking.end) >= currentTime
  );
  
  const pastBookings = weekBookings.filter(booking => 
    new Date(booking.end) < currentTime
  );

  // Find the booking to edit
  const bookingToEdit = userBookings.find(booking => booking.id === editBookingId);

  return (
    <div className={`flex flex-col h-screen ${isMobile ? 'mobile-gradient-bg' : ''}`}>
      {/* Site Name Banner - Only on mobile */}
      {isMobile && siteName && (
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-4 text-center sticky top-0 z-20">
          <h1 className="text-lg font-bold">{siteName}</h1>
        </div>
      )}
      
      <Header
        currentDate={currentDate}
        onDateChange={setCurrentDate}
        view="week"
        onViewChange={() => {}}
        title="My Bookings"
        showViewToggle={false}
      />
      
      <div className="container mx-auto p-4 pb-16 overflow-auto">
        <div className={`${isMobile ? 'bg-white/90 backdrop-blur-sm' : 'bg-white'} rounded-lg shadow-sm p-6 mb-6`}>
          <div className="mb-6">
            <h1 className="text-2xl font-bold">My Bookings</h1>
            <p className="text-sm text-gray-600 mt-1">
              Showing bookings for week of {format(weekStart, "MMM d")} - {format(weekEnd, "MMM d, yyyy")}
            </p>
          </div>

          <Tabs defaultValue="upcoming" className="w-full">
            <TabsList>
              <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
              <TabsTrigger value="past">Past</TabsTrigger>
            </TabsList>
            
            <TabsContent value="upcoming">
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
                </div>
              ) : upcomingBookings.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  You don't have any upcoming bookings for this week.
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {upcomingBookings.map(booking => (
                  <Card key={booking.id} className="overflow-hidden">
                    <div className={`h-2 ${getBookingTypeColor(booking.type).split(" ")[0]}`}></div>
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-semibold text-lg">{booking.title}</h3>
                        <Badge variant="outline" className={getBookingTypeColor(booking.type)}>
                          {formatBookingType(booking.type)}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-500 mb-2">{getStudioName(booking.studioId)}</p>
                      <p className="text-sm mb-4">{formatDateTimeRange(booking.start, booking.end)}</p>
                      {booking.description && (
                        <p className="text-sm text-gray-600 mb-4 line-clamp-2">{booking.description}</p>
                      )}
                      <div className="flex justify-end space-x-2 mt-2">
                        <Button variant="outline" size="sm" onClick={() => setEditBookingId(booking.id)}>
                          Edit
                        </Button>
                        <Button 
                          variant="destructive" 
                          size="sm" 
                          onClick={() => handleDeleteBooking(booking.id)}
                          disabled={deleteBooking.isPending}
                        >
                          Delete
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="past">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
              </div>
            ) : pastBookings.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                You don't have any past bookings for this week.
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {pastBookings.map(booking => (
                  <Card key={booking.id} className="overflow-hidden opacity-75">
                    <div className={`h-2 ${getBookingTypeColor(booking.type).split(" ")[0]}`}></div>
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-semibold text-lg">{booking.title}</h3>
                        <Badge variant="outline" className={getBookingTypeColor(booking.type)}>
                          {formatBookingType(booking.type)}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-500 mb-2">{getStudioName(booking.studioId)}</p>
                      <p className="text-sm mb-4">{formatDateTimeRange(booking.start, booking.end)}</p>
                      {booking.description && (
                        <p className="text-sm text-gray-600 mb-4 line-clamp-2">{booking.description}</p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Edit Booking Modal */}
      {bookingToEdit && (
        <BookingModal
          isOpen={editBookingId !== null}
          onClose={() => setEditBookingId(null)}
          booking={bookingToEdit}
        />
      )}

      {/* New Booking Modal */}
      <BookingModal
        isOpen={isNewBookingModalOpen}
        onClose={() => setIsNewBookingModalOpen(false)}
        selectedDate={currentDate}
      />
    </div>
  );
}
