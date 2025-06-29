import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, startOfWeek, endOfWeek } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { BookingModal } from "@/components/booking/BookingModal";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobileBanner } from "@/components/layout/MobileBanner";
import { apiRequest } from "@/lib/queryClient";

type Booking = {
  id: number;
  title: string;
  description: string;
  start: string;
  end: string;
  studioId: number | null;
  userId: number;
  type: string;
  status?: string;
};

type Studio = {
  id: number;
  name: string;
  description: string | null;
  status: string;
};

export default function MyBookingsPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [editBookingId, setEditBookingId] = useState<number | null>(null);
  const [isNewBookingModalOpen, setIsNewBookingModalOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  // Calculate week range for current date
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });

  // Fetch user's bookings
  const { data: userBookings = [], isLoading: bookingsLoading } = useQuery<Booking[]>({
    queryKey: ["/api/bookings/user"],
  });

  // Fetch studios for display
  const { data: studios = [] } = useQuery<Studio[]>({
    queryKey: ["/api/studios"],
  });

  // Filter bookings for the current week
  const weekBookings = userBookings.filter(booking => {
    const bookingStart = new Date(booking.start);
    return bookingStart >= weekStart && bookingStart <= weekEnd;
  });

  // Split into upcoming and past bookings
  const currentTime = new Date();
  const upcomingBookings = weekBookings.filter(booking => 
    new Date(booking.end) >= currentTime
  );
  
  const pastBookings = weekBookings.filter(booking => 
    new Date(booking.end) < currentTime
  );

  // Find the booking to edit
  const bookingToEdit = userBookings.find(booking => booking.id === editBookingId);

  // Delete booking mutation
  const deleteBookingMutation = useMutation({
    mutationFn: async (bookingId: number) => {
      const response = await apiRequest("DELETE", `/api/bookings/${bookingId}`);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bookings/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
      toast({
        title: "Success",
        description: "Booking deleted successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete booking",
        variant: "destructive",
      });
    },
  });

  const handleEdit = (bookingId: number) => {
    setEditBookingId(bookingId);
  };

  const handleDelete = async (bookingId: number) => {
    if (window.confirm("Are you sure you want to delete this booking?")) {
      deleteBookingMutation.mutate(bookingId);
    }
  };

  return (
    <div className={`flex flex-col h-screen ${isMobile ? 'mobile-gradient-bg' : ''}`}>
      {/* Modern Site Banner - Only on mobile */}
      {isMobile && <MobileBanner />}
      
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
            
            <TabsContent value="upcoming" className="mt-4">
              {upcomingBookings.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No upcoming bookings for this week</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingBookings.map((booking) => {
                    const startTime = new Date(booking.start);
                    const endTime = new Date(booking.end);
                    const studio = studios.find(s => s.id === booking.studioId);
                    
                    return (
                      <Card key={booking.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h3 className="font-semibold">{booking.title}</h3>
                                {booking.type === 'maintenance' && (
                                  <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full">
                                    Maintenance
                                  </span>
                                )}
                                {booking.type === 'production' && (
                                  <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                                    Production
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-gray-600 mb-1">
                                {studio ? studio.name : 'Studio null'}
                              </p>
                              <p className="text-sm text-gray-500">
                                {format(startTime, "MMM d, yyyy, h:mm a")} - {format(endTime, "h:mm a")}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEdit(booking.id)}
                              >
                                Edit
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDelete(booking.id)}
                              >
                                Delete
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="past" className="mt-4">
              {pastBookings.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No past bookings for this week</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pastBookings.map((booking) => {
                    const startTime = new Date(booking.start);
                    const endTime = new Date(booking.end);
                    const studio = studios.find(s => s.id === booking.studioId);
                    
                    return (
                      <Card key={booking.id} className="opacity-75">
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h3 className="font-semibold">{booking.title}</h3>
                                {booking.type === 'maintenance' && (
                                  <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full">
                                    Maintenance
                                  </span>
                                )}
                                {booking.type === 'production' && (
                                  <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                                    Production
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-gray-600 mb-1">
                                {studio ? studio.name : 'Studio null'}
                              </p>
                              <p className="text-sm text-gray-500">
                                {format(startTime, "MMM d, yyyy, h:mm a")} - {format(endTime, "h:mm a")}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEdit(booking.id)}
                              >
                                Edit
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDelete(booking.id)}
                              >
                                Delete
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Edit Booking Modal */}
      {editBookingId && (
        <BookingModal
          isOpen={!!editBookingId}
          onClose={() => setEditBookingId(null)}
          selectedDate={currentDate}
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