import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { useQuery } from "@tanstack/react-query";
import { Studio, Booking } from "@shared/schema";
import { formatDateTimeRange } from "@/lib/dateUtils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import BookingModal from "@/components/booking/BookingModal";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export default function MyBookingsPage() {
  const { user } = useAuth();
  const [currentPage, setCurrentPage] = useState(1);
  const [teamCurrentPage, setTeamCurrentPage] = useState(1);
  const [editBookingId, setEditBookingId] = useState<number | null>(null);
  const [isNewBookingModalOpen, setIsNewBookingModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("personal");
  
  // Fetch paginated user bookings from today forward
  const { data: userBookingsData, isLoading, error, refetch } = useQuery<{ bookings: Booking[]; total: number; hasMore: boolean }>({
    queryKey: ["/api/bookings/user", { fromToday: true, page: currentPage, limit: 20 }],
    queryFn: async () => {
      const response = await fetch(`/api/bookings/user?fromToday=true&page=${currentPage}&limit=20`);
      if (!response.ok) {
        throw new Error('Failed to fetch user bookings');
      }
      return response.json();
    },
    refetchOnWindowFocus: true,
    staleTime: 30000,
  });

  // Fetch team bookings
  const { data: teamBookingsData, isLoading: teamLoading } = useQuery<{ bookings: Booking[]; total: number; hasMore: boolean }>({
    queryKey: ["/api/bookings/team", { fromToday: true, page: teamCurrentPage, limit: 20 }],
    queryFn: async () => {
      const response = await fetch(`/api/bookings/team?fromToday=true&page=${teamCurrentPage}&limit=20`);
      if (!response.ok) {
        // If endpoint doesn't exist or user has no teams, return empty data
        if (response.status === 404) {
          return { bookings: [], total: 0, hasMore: false };
        }
        throw new Error('Failed to fetch team bookings');
      }
      return response.json();
    },
    refetchOnWindowFocus: true,
    staleTime: 30000,
  });

  // Check if user is admin or site manager for team functionality
  const isAdminOrSiteManager = user?.role === "admin" || user?.role === "site_manager";

  // Fetch all bookings for admin view (separate from personal bookings)
  const { data: allBookingsData, isLoading: allBookingsLoading } = useQuery<Booking[]>({
    queryKey: ["/api/bookings"],
    queryFn: async () => {
      const response = await fetch('/api/bookings');
      if (!response.ok) {
        throw new Error('Failed to fetch all bookings');
      }
      return response.json();
    },
    enabled: isAdminOrSiteManager,
    refetchOnWindowFocus: true,
    staleTime: 30000,
  });

  // Process all bookings for admin view (separate from personal bookings)
  const allBookingsProcessed = allBookingsData || [];
  const upcomingAllBookings = allBookingsProcessed.filter(booking => 
    new Date(booking.end) >= new Date()
  );
  const pastAllBookings = allBookingsProcessed.filter(booking => 
    new Date(booking.end) < new Date()
  );

  // Fetch user's teams to show team info
  const { data: userTeams = [] } = useQuery({
    queryKey: ["/api/teams/my"],
    queryFn: async () => {
      const response = await fetch('/api/teams/my');
      if (!response.ok) {
        if (response.status === 404) return [];
        throw new Error('Failed to fetch teams');
      }
      return response.json();
    },
  });
  
  // Fetch studios to display names
  const { data: studios = [] } = useQuery<Studio[]>({
    queryKey: ["/api/studios"],
  });
  
  // Fetch user names to display owner names
  const { data: allUsers = [] } = useQuery({
    queryKey: ["/api/users/names"],
    queryFn: async () => {
      const response = await fetch('/api/users/names');
      if (!response.ok) {
        throw new Error('Failed to fetch user names');
      }
      return response.json();
    },
  });

  // Fetch user team memberships for accurate team name display
  const { data: userTeamMemberships = {} } = useQuery({
    queryKey: ["/api/users/team-memberships"],
    queryFn: async () => {
      const response = await fetch('/api/users/team-memberships');
      if (!response.ok) {
        throw new Error('Failed to fetch team memberships');
      }
      return response.json();
    },
  });

  // Get studio name by ID
  const getStudioName = (studioId: number) => {
    const studio = studios.find(s => s.id === studioId);
    return studio ? studio.name : `Studio ${studioId}`;
  };

  // Get user name by ID
  const getUserName = (userId: number) => {
    const userRecord = allUsers.find((u: any) => u.id === userId);
    return userRecord ? userRecord.name : `User ${userId}`;
  };

  // Get team name for a booking - find which team the booking belongs to
  const getTeamNameForBooking = (booking: any) => {
    // Check if this booking appears in team bookings
    const teamBookingsList = teamBookingsData?.bookings || [];
    const isTeamBooking = teamBookingsList.some(tb => tb.id === booking.id);
    
    if (!isTeamBooking) return null;
    
    // Get the teams that the booking creator belongs to
    const creatorTeams = userTeamMemberships[booking.userId] || [];
    
    if (creatorTeams.length === 0) return "Team Booking";
    
    // If the creator is part of multiple teams, show all teams or the most relevant one
    if (creatorTeams.length === 1) {
      return creatorTeams[0].name;
    } else {
      // For multiple teams, show the first one but could be enhanced to show all
      // or determine which team the booking was made for specifically
      return creatorTeams[0].name + (creatorTeams.length > 1 ? " (Multi-team)" : "");
    }
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

  // Function to get booking color - use assigned color if available, fallback to type color
  const getBookingColor = (booking: any) => {
    if (booking.color) {
      // Return the actual assigned color as inline style
      return {
        backgroundColor: booking.color,
        borderColor: booking.color
      };
    }
    // Fallback to type-based color for the top border
    return null; // Use default CSS classes
  };

  // Function to get the color stripe class or style for the top of booking cards
  const getBookingStripeStyle = (booking: any) => {
    if (booking.color) {
      return {
        backgroundColor: booking.color
      };
    }
    // Extract just the background color class for the stripe
    const typeColorClasses = getBookingTypeColor(booking.type);
    const bgClass = typeColorClasses.split(' ')[0]; // Get bg-xxx-xxx part
    return { className: bgClass };
  };

  // Handle delete booking
  const handleDeleteBooking = async (id: number) => {
    if (confirm("Are you sure you want to delete this booking?")) {
      try {
        const response = await fetch(`/api/bookings/${id}`, { method: 'DELETE' });
        if (response.ok) {
          // Trigger a refetch of the current page
          await refetch();
        } else {
          throw new Error('Failed to delete booking');
        }
      } catch (error) {
        console.error('Error deleting booking:', error);
      }
    }
  };

  // Get bookings and pagination info
  const userBookings = userBookingsData?.bookings || [];
  const totalBookings = userBookingsData?.total || 0;
  const hasMore = userBookingsData?.hasMore || false;
  
  // Separate into current and future vs past
  const currentTime = new Date();
  const upcomingBookings = userBookings.filter(booking => 
    new Date(booking.end) >= currentTime
  );
  
  const pastBookings = userBookings.filter(booking => 
    new Date(booking.end) < currentTime
  );

  // Find the booking to edit
  const bookingToEdit = userBookings.find(booking => booking.id === editBookingId);

  return (
    <div className="flex flex-col h-screen">
      <Header
        currentDate={new Date()}
        onDateChange={() => {}}
        view="week"
        onViewChange={() => {}}
        title="My Bookings"
        showViewToggle={false}
        hideNavigation={true}
      />
      
      <div className="container mx-auto p-4 pb-16 overflow-auto">
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold">My Bookings</h1>
            <p className="text-sm text-gray-600 mt-1">
              View your personal bookings and team member bookings
            </p>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList>
              <TabsTrigger value="personal">
                My Bookings ({totalBookings})
              </TabsTrigger>
              <TabsTrigger value="team">
                Team Bookings ({teamBookingsData?.total || 0})
              </TabsTrigger>
              {isAdminOrSiteManager && (
                <TabsTrigger value="admin">
                  Admin View (All Bookings)
                </TabsTrigger>
              )}
            </TabsList>
            
            <TabsContent value="personal">
              <div className="mb-4">
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
                        You don't have any upcoming bookings.
                      </div>
                    ) : (
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {upcomingBookings.map(booking => {
                          const stripeStyle = getBookingStripeStyle(booking);
                          const isCancelled = booking.status === 'cancelled';
                          const isTentative = booking.status === 'tentative';
                          
                          return (
                            <Card key={booking.id} className={cn(
                              "overflow-hidden",
                              isCancelled && "opacity-60 bg-red-50 border-red-300",
                              isTentative && "border-dashed opacity-80 bg-yellow-50"
                            )}>
                              <div 
                                className={`h-2 ${stripeStyle.className || ''}`}
                                style={stripeStyle.className ? {} : stripeStyle}
                              ></div>
                              <CardContent className="p-4">
                                <div className="flex justify-between items-start mb-2">
                                  <h3 className={cn(
                                    "font-semibold text-lg",
                                    isCancelled && "line-through text-red-600"
                                  )}>
                                    {booking.title}
                                  </h3>
                                  <div className="flex gap-2">
                                    <Badge variant="outline" className={getBookingTypeColor(booking.type)}>
                                      {formatBookingType(booking.type)}
                                    </Badge>
                                    {booking.status !== 'confirmed' && (
                                      <Badge variant={
                                        booking.status === 'cancelled' ? 'destructive' : 
                                        booking.status === 'tentative' ? 'secondary' : 'outline'
                                      }>
                                        {booking.status?.charAt(0).toUpperCase() + booking.status?.slice(1)}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                                <p className="text-xs text-green-600 mb-1">Created by you</p>
                                <p className="text-sm text-gray-500 mb-2">{booking.studioId ? getStudioName(booking.studioId) : 'No Studio Assigned'}</p>
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
                                    onClick={() => booking.id && handleDeleteBooking(booking.id)}
                                  >
                                    Delete
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
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
                        You don't have any past bookings.
                      </div>
                    ) : (
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {pastBookings.map(booking => {
                          const stripeStyle = getBookingStripeStyle(booking);
                          const isCancelled = booking.status === 'cancelled';
                          const isTentative = booking.status === 'tentative';
                          
                          return (
                            <Card key={booking.id} className={cn(
                              "overflow-hidden opacity-75",
                              isCancelled && "bg-red-50 border-red-300",
                              isTentative && "border-dashed bg-yellow-50"
                            )}>
                              <div 
                                className={`h-2 ${stripeStyle.className || ''}`}
                                style={stripeStyle.className ? {} : stripeStyle}
                              ></div>
                              <CardContent className="p-4">
                                <div className="flex justify-between items-start mb-2">
                                  <h3 className={cn(
                                    "font-semibold text-lg",
                                    isCancelled && "line-through text-red-600"
                                  )}>
                                    {booking.title}
                                  </h3>
                                  <div className="flex gap-2">
                                    <Badge variant="outline" className={getBookingTypeColor(booking.type)}>
                                      {formatBookingType(booking.type)}
                                    </Badge>
                                    {booking.status !== 'confirmed' && (
                                      <Badge variant={
                                        booking.status === 'cancelled' ? 'destructive' : 
                                        booking.status === 'tentative' ? 'secondary' : 'outline'
                                      }>
                                        {booking.status?.charAt(0).toUpperCase() + booking.status?.slice(1)}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                                <p className="text-xs text-green-600 mb-1">Created by you</p>
                                <p className="text-sm text-gray-500 mb-2">{booking.studioId ? getStudioName(booking.studioId) : 'No Studio Assigned'}</p>
                                <p className="text-sm mb-4">{formatDateTimeRange(booking.start, booking.end)}</p>
                                {booking.description && (
                                  <p className="text-sm text-gray-600 mb-4 line-clamp-2">{booking.description}</p>
                                )}
                                
                                {/* Personal Booking Edit Button - User can always edit their own bookings */}
                                <div className="flex justify-end pt-2 border-t">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setEditBookingId(booking.id)}
                                    className="h-8 px-3 text-xs"
                                  >
                                    Edit
                                  </Button>
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
            </TabsContent>
            
            <TabsContent value="team">
              <div className="mb-4">
                {teamLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
                  </div>
                ) : (teamBookingsData?.bookings || []).length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <p>No team bookings found.</p>
                    {userTeams.length === 0 && (
                      <p className="text-sm mt-2">You're not part of any teams yet.</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {(teamBookingsData?.bookings || []).map(booking => {
                        const stripeStyle = getBookingStripeStyle(booking);
                        const isCancelled = booking.status === 'cancelled';
                        const isTentative = booking.status === 'tentative';
                        
                        return (
                          <Card key={booking.id} className={cn(
                            "overflow-hidden border-l-4 border-blue-500",
                            isCancelled && "opacity-60 bg-red-50 border-red-300",
                            isTentative && "border-dashed opacity-80 bg-yellow-50"
                          )}>
                            <div 
                              className={`h-2 ${stripeStyle.className || ''}`}
                              style={stripeStyle.className ? {} : stripeStyle}
                            ></div>
                            <CardContent className="p-4">
                              <div className="flex justify-between items-start mb-2">
                                <h3 className={cn(
                                  "font-semibold text-lg",
                                  isCancelled && "line-through text-red-600"
                                )}>
                                  {booking.title}
                                </h3>
                                <div className="flex gap-2">
                                  <Badge variant="outline" className={getBookingTypeColor(booking.type)}>
                                    {formatBookingType(booking.type)}
                                  </Badge>
                                  {booking.status !== 'confirmed' && (
                                    <Badge variant={
                                      booking.status === 'cancelled' ? 'destructive' : 
                                      booking.status === 'tentative' ? 'secondary' : 'outline'
                                    }>
                                      {booking.status?.charAt(0).toUpperCase() + booking.status?.slice(1)}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <p className="text-xs text-blue-600 mb-1">
                                Created by {getUserName(booking.userId)} • {getTeamNameForBooking(booking) || "Team Booking"}
                              </p>
                              <p className="text-sm text-gray-500 mb-2">{booking.studioId ? getStudioName(booking.studioId) : 'No Studio Assigned'}</p>
                              <p className="text-sm mb-4">{formatDateTimeRange(booking.start, booking.end)}</p>
                              {booking.description && (
                                <p className="text-sm text-gray-600 mb-4 line-clamp-2">{booking.description}</p>
                              )}
                              
                              {/* Team Booking Edit Button - Team members can edit team bookings, admins can edit all */}
                              <div className="flex justify-end pt-2 border-t">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setEditBookingId(booking.id)}
                                  className="h-8 px-3 text-xs"
                                >
                                  Edit
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                    
                    {/* Team Bookings Pagination */}
                    {(teamBookingsData?.total || 0) > 20 && (
                      <div className="flex justify-between items-center mt-6 pt-6 border-t">
                        <div className="text-sm text-gray-600">
                          Page {teamCurrentPage} • Showing {(teamBookingsData?.bookings || []).length} of {teamBookingsData?.total || 0} team bookings
                        </div>
                        <div className="flex space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setTeamCurrentPage(teamCurrentPage - 1)}
                            disabled={teamCurrentPage === 1}
                          >
                            <ChevronLeft className="h-4 w-4 mr-1" />
                            Previous
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setTeamCurrentPage(teamCurrentPage + 1)}
                            disabled={!(teamBookingsData?.hasMore)}
                          >
                            Next
                            <ChevronRight className="h-4 w-4 ml-1" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </TabsContent>
            
            {/* Admin View Tab - Shows All System Bookings */}
            {isAdminOrSiteManager && (
              <TabsContent value="admin">
                <div className="mb-4">
                  <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg mb-6">
                    <h3 className="font-semibold text-blue-900 mb-1">Admin View</h3>
                    <p className="text-sm text-blue-700">Viewing all bookings in the system. This view is only available to administrators and site managers.</p>
                  </div>
                  
                  <Tabs defaultValue="upcoming" className="w-full">
                    <TabsList>
                      <TabsTrigger value="upcoming">Upcoming ({upcomingAllBookings.length})</TabsTrigger>
                      <TabsTrigger value="past">Past ({pastAllBookings.length})</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="upcoming">
                      {allBookingsLoading ? (
                        <div className="flex justify-center py-8">
                          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
                        </div>
                      ) : upcomingAllBookings.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          No upcoming bookings found in the system.
                        </div>
                      ) : (
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                          {upcomingAllBookings.map(booking => {
                            const stripeStyle = getBookingStripeStyle(booking);
                            const isOwner = booking.userId === user?.id;
                            const isCancelled = booking.status === 'cancelled';
                            const isTentative = booking.status === 'tentative';
                            
                            return (
                              <Card key={booking.id} className={cn(
                                "overflow-hidden border-l-4 border-purple-500",
                                isCancelled && "opacity-60 bg-red-50 border-red-300",
                                isTentative && "border-dashed opacity-80 bg-yellow-50"
                              )}>
                                <div 
                                  className={`h-2 ${stripeStyle.className || ''}`}
                                  style={stripeStyle.className ? {} : stripeStyle}
                                ></div>
                                <CardContent className="p-4">
                                  <div className="flex justify-between items-start mb-2">
                                    <h3 className={cn(
                                      "font-semibold text-lg",
                                      isCancelled && "line-through text-red-600"
                                    )}>
                                      {booking.title}
                                    </h3>
                                    <div className="flex gap-2">
                                      <Badge variant="outline" className={getBookingTypeColor(booking.type)}>
                                        {formatBookingType(booking.type)}
                                      </Badge>
                                      {booking.status !== 'confirmed' && (
                                        <Badge variant={
                                          booking.status === 'cancelled' ? 'destructive' : 
                                          booking.status === 'tentative' ? 'secondary' : 'outline'
                                        }>
                                          {booking.status?.charAt(0).toUpperCase() + booking.status?.slice(1)}
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                  <p className="text-xs text-purple-600 mb-1">
                                    {isOwner ? "Created by you" : `Created by ${getUserName(booking.userId)}`} • Admin View
                                  </p>
                                  <p className="text-sm text-gray-500 mb-2">{booking.studioId ? getStudioName(booking.studioId) : 'No Studio Assigned'}</p>
                                  <p className="text-sm mb-4">{formatDateTimeRange(booking.start, booking.end)}</p>
                                  {booking.description && (
                                    <p className="text-sm text-gray-600 mb-4 line-clamp-2">{booking.description}</p>
                                  )}
                                  
                                  {/* Admin View Edit Button - Admins can edit all bookings */}
                                  <div className="flex justify-end pt-2 border-t">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => setEditBookingId(booking.id)}
                                      className="h-8 px-3 text-xs"
                                    >
                                      Edit
                                    </Button>
                                  </div>
                                </CardContent>
                              </Card>
                            );
                          })}
                        </div>
                      )}
                    </TabsContent>
                    
                    <TabsContent value="past">
                      {allBookingsLoading ? (
                        <div className="flex justify-center py-8">
                          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
                        </div>
                      ) : pastAllBookings.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          No past bookings found in the system.
                        </div>
                      ) : (
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                          {pastAllBookings.map(booking => {
                            const stripeStyle = getBookingStripeStyle(booking);
                            const isOwner = booking.userId === user?.id;
                            const isCancelled = booking.status === 'cancelled';
                            const isTentative = booking.status === 'tentative';
                            
                            return (
                              <Card key={booking.id} className={cn(
                                "overflow-hidden opacity-75 border-l-4 border-purple-500",
                                isCancelled && "bg-red-50 border-red-300",
                                isTentative && "border-dashed bg-yellow-50"
                              )}>
                                <div 
                                  className={`h-2 ${stripeStyle.className || ''}`}
                                  style={stripeStyle.className ? {} : stripeStyle}
                                ></div>
                                <CardContent className="p-4">
                                  <div className="flex justify-between items-start mb-2">
                                    <h3 className={cn(
                                      "font-semibold text-lg",
                                      isCancelled && "line-through text-red-600"
                                    )}>
                                      {booking.title}
                                    </h3>
                                    <div className="flex gap-2">
                                      <Badge variant="outline" className={getBookingTypeColor(booking.type)}>
                                        {formatBookingType(booking.type)}
                                      </Badge>
                                      {booking.status !== 'confirmed' && (
                                        <Badge variant={
                                          booking.status === 'cancelled' ? 'destructive' : 
                                          booking.status === 'tentative' ? 'secondary' : 'outline'
                                        }>
                                          {booking.status?.charAt(0).toUpperCase() + booking.status?.slice(1)}
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                  <p className="text-xs text-purple-600 mb-1">
                                    {isOwner ? "Created by you" : `Created by ${getUserName(booking.userId)}`} • Admin View
                                  </p>
                                  <p className="text-sm text-gray-500 mb-2">{booking.studioId ? getStudioName(booking.studioId) : 'No Studio Assigned'}</p>
                                  <p className="text-sm mb-4">{formatDateTimeRange(booking.start, booking.end)}</p>
                                  {booking.description && (
                                    <p className="text-sm text-gray-600 mb-4 line-clamp-2">{booking.description}</p>
                                  )}
                                  
                                  {/* Admin View Edit Button - Admins can edit all bookings */}
                                  <div className="flex justify-end pt-2 border-t">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => setEditBookingId(booking.id)}
                                      className="h-8 px-3 text-xs"
                                    >
                                      Edit
                                    </Button>
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
              </TabsContent>
            )}

          </Tabs>
          
          {/* Pagination Controls */}
          {totalBookings > 20 && (
            <div className="flex justify-between items-center mt-6 pt-6 border-t">
              <div className="text-sm text-gray-600">
                Page {currentPage} • Showing {userBookings.length} of {totalBookings} bookings
              </div>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={!hasMore}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
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
        selectedDate={new Date()}
      />
    </div>
  );
}
