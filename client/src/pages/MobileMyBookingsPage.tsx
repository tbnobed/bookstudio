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
import { Clock, MapPin, Edit, Trash2, Calendar } from "lucide-react";

export default function MobileMyBookingsPage() {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const { userBookings, isLoading, deleteBooking } = useStudioBookings();
  const [editBookingId, setEditBookingId] = useState<number | null>(null);
  const [isNewBookingModalOpen, setIsNewBookingModalOpen] = useState(false);
  const { siteName } = useSiteSettings();
  
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
    <div className="flex flex-col h-screen mobile-gradient-bg">
      {/* Modern Site Banner */}
      <div className="relative overflow-hidden">
        {/* Background with modern gradient and animated effects */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-blue-900 to-transparent"></div>
        <div className="absolute inset-0 bg-gradient-to-b from-blue-600/20 via-purple-600/20 to-transparent"></div>
        
        {/* Subtle geometric pattern overlay */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-32 h-32 bg-gradient-to-br from-white to-transparent rounded-full -translate-x-16 -translate-y-16"></div>
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-white to-transparent rounded-full translate-x-12 -translate-y-12"></div>
          <div className="absolute bottom-0 right-0 w-40 h-40 bg-gradient-to-tl from-white to-transparent rounded-full translate-x-20 translate-y-20"></div>
        </div>
        
        {/* Content with extended height */}
        <div className="relative px-6 py-6 text-center flex items-center justify-center min-h-[5rem]">
          <div className="flex items-center justify-center gap-3">
            <img 
              src="/bookstudio-logo.png" 
              alt="BookStudio Logo" 
              className="w-8 h-8 object-contain drop-shadow-sm dark:hidden"
            />
            <img 
              src="/bookstudio-logo-dark.png" 
              alt="BookStudio Logo" 
              className="w-8 h-8 object-contain drop-shadow-sm hidden dark:block"
            />
            <h1 className="text-xl font-bold text-white tracking-wide drop-shadow-sm">
              {siteName}
            </h1>
          </div>
          <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 w-16 h-0.5 bg-gradient-to-r from-transparent via-white/60 to-transparent"></div>
        </div>
      </div>
      
      <Header
        currentDate={currentDate}
        onDateChange={setCurrentDate}
        view="week"
        onViewChange={() => {}}
        title="My Bookings"
        showViewToggle={false}
      />
      
      <div className="flex-1 overflow-auto p-4 pb-20">
        {/* Page Header */}
        <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm border border-white/20 dark:border-gray-700/50 shadow-lg rounded-2xl p-4 mb-4">
          <div className="flex items-center gap-3 mb-2">
            <Calendar className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">My Bookings</h1>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Week of {format(weekStart, "MMM d")} - {format(weekEnd, "MMM d, yyyy")}
          </p>
        </div>

        {/* Mobile Optimized Tabs */}
        <Tabs defaultValue="upcoming" className="w-full">
          <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm border border-white/20 dark:border-gray-700/50 shadow-lg rounded-2xl p-1 mb-4">
            <TabsList className="grid w-full grid-cols-2 bg-gray-100/80 dark:bg-gray-700/80 rounded-xl h-11">
              <TabsTrigger value="upcoming" className="rounded-lg font-medium data-[state=active]:bg-white dark:data-[state=active]:bg-gray-600 data-[state=active]:shadow-sm dark:text-gray-300 dark:data-[state=active]:text-white">
                Upcoming
              </TabsTrigger>
              <TabsTrigger value="past" className="rounded-lg font-medium data-[state=active]:bg-white dark:data-[state=active]:bg-gray-600 data-[state=active]:shadow-sm dark:text-gray-300 dark:data-[state=active]:text-white">
                Past
              </TabsTrigger>
            </TabsList>
          </div>
          
          {/* Upcoming Bookings */}
          <TabsContent value="upcoming" className="mt-0">
            {isLoading ? (
              <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm border border-white/20 dark:border-gray-700/50 shadow-lg rounded-2xl p-8">
                <div className="flex justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
                </div>
              </div>
            ) : upcomingBookings.length === 0 ? (
              <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm border border-white/20 dark:border-gray-700/50 shadow-lg rounded-2xl p-8">
                <div className="text-center text-gray-500 dark:text-gray-400">
                  <Calendar className="h-12 w-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
                  <p className="font-medium">No upcoming bookings</p>
                  <p className="text-sm mt-1">You don't have any bookings scheduled for this week.</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {upcomingBookings.map(booking => (
                  <Card key={booking.id} className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm border border-white/20 dark:border-gray-700/50 shadow-lg hover:shadow-xl rounded-2xl overflow-hidden transition-all duration-200 hover:scale-[1.02]">
                    {/* Color indicator */}
                    <div className={`h-1.5 ${getBookingTypeColor(booking.type).split(" ")[0]}`}></div>
                    
                    <CardContent className="p-4">
                      {/* Header with title and type */}
                      <div className="flex justify-between items-start mb-3">
                        <h3 className="font-bold text-base text-gray-900 dark:text-white leading-tight pr-2">
                          {booking.title}
                        </h3>
                        <Badge 
                          variant="secondary" 
                          className={`${getBookingTypeColor(booking.type)} text-xs font-medium px-2 py-1 rounded-full flex-shrink-0`}
                        >
                          {formatBookingType(booking.type)}
                        </Badge>
                      </div>

                      {/* Studio and Time Info */}
                      <div className="space-y-2 mb-4">
                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                          <MapPin className="h-4 w-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                          <span className="font-medium">{getStudioName(booking.studioId)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                          <Clock className="h-4 w-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                          <span>{formatDateTimeRange(booking.start, booking.end)}</span>
                        </div>
                      </div>

                      {/* Description */}
                      {booking.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2 leading-relaxed">
                          {booking.description}
                        </p>
                      )}

                      {/* Action Buttons */}
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => setEditBookingId(booking.id)}
                          className="flex-1 h-9 rounded-xl font-medium border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-200"
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          Edit
                        </Button>
                        <Button 
                          variant="destructive" 
                          size="sm" 
                          onClick={() => handleDeleteBooking(booking.id)}
                          disabled={deleteBooking.isPending}
                          className="flex-1 h-9 rounded-xl font-medium"
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
          
          {/* Past Bookings */}
          <TabsContent value="past" className="mt-0">
            {isLoading ? (
              <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm border border-white/20 dark:border-gray-700/50 shadow-lg rounded-2xl p-8">
                <div className="flex justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
                </div>
              </div>
            ) : pastBookings.length === 0 ? (
              <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm border border-white/20 dark:border-gray-700/50 shadow-lg rounded-2xl p-8">
                <div className="text-center text-gray-500 dark:text-gray-400">
                  <Calendar className="h-12 w-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
                  <p className="font-medium">No past bookings</p>
                  <p className="text-sm mt-1">You don't have any completed bookings for this week.</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {pastBookings.map(booking => (
                  <Card key={booking.id} className="bg-white/90 dark:bg-gray-800/70 backdrop-blur-sm border border-white/20 dark:border-gray-700/50 shadow-lg rounded-2xl overflow-hidden opacity-75 transition-all duration-200">
                    {/* Color indicator */}
                    <div className={`h-1.5 ${getBookingTypeColor(booking.type).split(" ")[0]} opacity-60`}></div>
                    
                    <CardContent className="p-4">
                      {/* Header with title and type */}
                      <div className="flex justify-between items-start mb-3">
                        <h3 className="font-bold text-base text-gray-700 dark:text-gray-300 leading-tight pr-2">
                          {booking.title}
                        </h3>
                        <Badge 
                          variant="secondary" 
                          className={`${getBookingTypeColor(booking.type)} text-xs font-medium px-2 py-1 rounded-full flex-shrink-0 opacity-80`}
                        >
                          {formatBookingType(booking.type)}
                        </Badge>
                      </div>

                      {/* Studio and Time Info */}
                      <div className="space-y-2 mb-4">
                        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                          <MapPin className="h-4 w-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                          <span className="font-medium">{getStudioName(booking.studioId)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                          <Clock className="h-4 w-4 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                          <span>{formatDateTimeRange(booking.start, booking.end)}</span>
                        </div>
                      </div>

                      {/* Description */}
                      {booking.description && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 leading-relaxed">
                          {booking.description}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
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