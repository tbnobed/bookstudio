import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Tv, MapPin, Settings, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface Studio {
  id: number;
  name: string;
  description: string | null;
  status: string;
}

interface Booking {
  id: number;
  title: string;
  start: string;
  end: string;
  studioId: number | null;
  status: string;
  color?: string;
}

export default function StudiosPage() {
  const isMobile = useIsMobile();
  
  const { data: studios = [] } = useQuery<Studio[]>({
    queryKey: ["/api/studios"],
  });

  const { data: bookings = [] } = useQuery<Booking[]>({
    queryKey: ["/api/bookings"],
  });

  // Get current time for comparison
  const now = new Date();
  
  // Function to get current booking for a studio
  const getCurrentBooking = (studioId: number) => {
    return bookings.find(booking => {
      if (booking.studioId !== studioId) return false;
      const start = new Date(booking.start);
      const end = new Date(booking.end);
      return start <= now && end > now;
    });
  };

  // Function to get next booking for a studio
  const getNextBooking = (studioId: number) => {
    const futureBookings = bookings
      .filter(booking => {
        if (booking.studioId !== studioId) return false;
        const start = new Date(booking.start);
        return start > now;
      })
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    
    return futureBookings[0];
  };

  // Function to get studio status
  const getStudioStatus = (studio: Studio) => {
    const currentBooking = getCurrentBooking(studio.id);
    const nextBooking = getNextBooking(studio.id);
    
    if (currentBooking) {
      const endTime = new Date(currentBooking.end);
      return {
        status: "in-use",
        label: "In Use",
        detail: `Until ${format(endTime, "h:mm a")}`,
        booking: currentBooking,
        color: "bg-red-500"
      };
    }
    
    if (nextBooking) {
      const startTime = new Date(nextBooking.start);
      return {
        status: "available",
        label: "Available",
        detail: `Until ${format(startTime, "h:mm a")}`,
        booking: nextBooking,
        color: "bg-green-500"
      };
    }
    
    return {
      status: "available",
      label: "Available",
      detail: "All day",
      booking: null,
      color: "bg-green-500"
    };
  };

  return (
    <div className={`flex flex-col h-screen ${isMobile ? 'mobile-gradient-bg' : ''}`}>
      {/* Site Name Banner - Only on mobile */}
      {isMobile && (
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-4 text-center sticky top-0 z-20">
          <h1 className="text-lg font-bold">The Plex Studios</h1>
        </div>
      )}
      
      <div className="flex-1 overflow-auto">
        <div className="container mx-auto p-4">
          <div className={`${isMobile ? 'bg-white/90 backdrop-blur-sm' : 'bg-white'} rounded-lg shadow-sm p-6`}>
            <div className="mb-6">
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Tv className="h-6 w-6" />
                Studio Status
              </h1>
              <p className="text-gray-600 mt-1">
                Real-time status and availability of all studios
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {studios.map((studio) => {
                const studioStatus = getStudioStatus(studio);
                
                return (
                  <Card key={studio.id} className="transition-all hover:shadow-md">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Tv className="h-5 w-5" />
                          {studio.name}
                        </CardTitle>
                        <div className={cn(
                          "w-3 h-3 rounded-full",
                          studioStatus.color
                        )} />
                      </div>
                      {studio.description && (
                        <CardDescription className="flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          {studio.description}
                        </CardDescription>
                      )}
                    </CardHeader>
                    
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Badge 
                          variant={studioStatus.status === "in-use" ? "destructive" : "secondary"}
                          className="flex items-center gap-1"
                        >
                          {studioStatus.status === "in-use" ? (
                            <Settings className="h-3 w-3" />
                          ) : (
                            <Clock className="h-3 w-3" />
                          )}
                          {studioStatus.label}
                        </Badge>
                        <span className="text-sm text-gray-600">
                          {studioStatus.detail}
                        </span>
                      </div>
                      
                      {studioStatus.booking && (
                        <div className="text-sm">
                          <div className="font-medium text-gray-900">
                            {studioStatus.status === "in-use" ? "Current:" : "Next:"}
                          </div>
                          <div className="text-gray-600">
                            {studioStatus.booking.title}
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {format(new Date(studioStatus.booking.start), "MMM d, h:mm a")} - {format(new Date(studioStatus.booking.end), "h:mm a")}
                          </div>
                        </div>
                      )}
                      
                      {studio.status !== "available" && (
                        <Badge variant="outline" className="w-full justify-center">
                          {studio.status === "maintenance" ? "Under Maintenance" : studio.status}
                        </Badge>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            
            {studios.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <Tv className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p>No studios found</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}