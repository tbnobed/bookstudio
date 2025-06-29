import { useQuery } from "@tanstack/react-query";
import { Tv, MapPin, Settings, Clock, Loader2 } from "lucide-react";
import { formatTime } from "@/lib/dateUtils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import WeatherWidget from "@/components/weather/WeatherWidget";
import { MobileBanner } from "@/components/layout/MobileBanner";
import { useStudioStatus } from "@/hooks/use-studio-status";
import { useStudioBookings } from "@/hooks/useStudioBookings.ts";

interface Studio {
  id: number;
  name: string;
  description: string | null;
  status: string;
}

export default function StudiosPage() {
  const isMobile = useIsMobile();
  
  const { data: siteName = "BookStud.io" } = useQuery<string>({
    queryKey: ["/api/system/site-name"],
    select: (data: any) => data?.siteName || "BookStud.io"
  });
  
  // Get bookings for current time window to check real-time status
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  
  // Get bookings using the existing hook, but only check if bookings are loading (not user bookings)
  const { bookings } = useStudioBookings(oneWeekAgo, oneWeekFromNow);
  
  // Use a separate query to check if just the bookings are loaded
  const { isLoading: bookingsLoading } = useQuery({
    queryKey: ['/api/bookings', { start: oneWeekAgo.toISOString(), end: oneWeekFromNow.toISOString() }],
  });
  
  const { getAllStudiosWithStatus } = useStudioStatus(bookings as any);
  
  // Get all studios with their status - only when bookings are loaded
  const studiosWithStatus = !bookingsLoading ? getAllStudiosWithStatus() : [];
  


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

            {bookingsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                <span className="ml-2 text-gray-500">Loading studio status...</span>
              </div>
            ) : studiosWithStatus.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No studios found
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                {studiosWithStatus.map((studioWithStatus) => {
                const studio = studioWithStatus;
                const studioStatus = studioWithStatus.statusInfo;
                
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
                          {studioStatus.status === "in-use" ? "In Use" : 
                           studioStatus.status === "maintenance" ? "Maintenance" :
                           studioStatus.status === "upcoming" ? "Upcoming" : "Available"}
                        </Badge>
                        
                        <div className="text-xs text-gray-600 text-center">
                          {studioStatus.currentBooking ? 
                            `Until ${formatTime(new Date(studioStatus.currentBooking.end))}` :
                            studioStatus.nextBooking ?
                            `Until ${formatTime(new Date(studioStatus.nextBooking.start))}` :
                            "All day"}
                        </div>
                        
                        {(studioStatus.currentBooking || studioStatus.nextBooking) && (
                          <div className="text-xs text-center">
                            <div className="font-medium text-gray-900 truncate">
                              {(studioStatus.currentBooking || studioStatus.nextBooking)?.title}
                            </div>
                            <div className="text-xs text-gray-500">
                              {(studioStatus.currentBooking || studioStatus.nextBooking)?.start && 
                               formatTime(new Date((studioStatus.currentBooking || studioStatus.nextBooking)!.start))}
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}