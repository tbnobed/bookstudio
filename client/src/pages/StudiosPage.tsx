import { useQuery } from "@tanstack/react-query";
import { Tv, MapPin, Settings, Clock } from "lucide-react";
import { formatTime } from "@/lib/dateUtils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import WeatherWidget from "@/components/weather/WeatherWidget";
import { MobileBanner } from "@/components/layout/MobileBanner";

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
  
  const { data: siteName = "BookStud.io" } = useQuery<string>({
    queryKey: ["/api/system/site-name"],
    select: (data: any) => data?.siteName || "BookStud.io"
  });
  
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
        detail: `Until ${formatTime(endTime)}`,
        booking: currentBooking,
        color: "bg-red-500"
      };
    }
    
    if (nextBooking) {
      const startTime = new Date(nextBooking.start);
      return {
        status: "available",
        label: "Available",
        detail: `Until ${formatTime(startTime)}`,
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
      {/* Modern Site Banner - Only on mobile */}
      {isMobile && <MobileBanner />}
      
      <div className="flex-1 overflow-auto">
        <div className={`container mx-auto p-3 ${isMobile ? 'pb-20' : ''}`}>
          <div className={`${isMobile ? 'bg-white/90 backdrop-blur-sm' : 'bg-white'} rounded-lg shadow-sm p-4`}>
            {/* Weather Section - Only on mobile */}
            {isMobile && (
              <div className="mb-6">
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4 border border-blue-100">
                  <WeatherWidget 
                    showForecast={true} 
                    size="normal" 
                    className="w-full"
                  />
                </div>
              </div>
            )}

            <div className="mb-4">
              <h1 className="text-xl font-bold flex items-center gap-2">
                <Tv className="h-5 w-5" />
                Studio Status
              </h1>
              <p className="text-gray-600 text-sm mt-1">
                Real-time status and availability of all studios
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
              {studios.map((studio) => {
                const studioStatus = getStudioStatus(studio);
                
                return (
                  <Card key={studio.id} className="transition-all hover:shadow-md">
                    <CardContent className="p-2">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <Tv className="h-3 w-3" />
                          <span className="font-semibold text-xs">{studio.name}</span>
                        </div>
                        <div className={cn(
                          "w-2.5 h-2.5 rounded-full",
                          studioStatus.color
                        )} />
                      </div>
                      
                      <div className="space-y-1">
                        <Badge 
                          variant={studioStatus.status === "in-use" ? "destructive" : "secondary"}
                          className="text-xs px-1.5 py-0.5 w-full justify-center"
                        >
                          {studioStatus.label}
                        </Badge>
                        
                        <div className="text-xs text-gray-600 text-center">
                          {studioStatus.detail}
                        </div>
                        
                        {studioStatus.booking && (
                          <div className="text-xs text-center">
                            <div className="font-medium text-gray-900 truncate">
                              {studioStatus.booking.title}
                            </div>
                            <div className="text-xs text-gray-500">
                              {formatTime(studioStatus.booking.start)}
                            </div>
                          </div>
                        )}
                      </div>
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