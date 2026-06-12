import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tv, MapPin, Settings, Clock, LayoutGrid, Map as MapIcon } from "lucide-react";
import { formatTime } from "@/lib/dateUtils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import WeatherWidget from "@/components/weather/WeatherWidget";
import { MobileBanner } from "@/components/layout/MobileBanner";
import FacilityMap from "@/components/studios/FacilityMap";

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
  const [view, setView] = useState<"cards" | "map">("cards");
  
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

  const { data: bookingStudios = [] } = useQuery<any[]>({
    queryKey: ["/api/booking-studios"],
  });

  // Get current time for comparison
  const now = new Date();
  
  // Function to get current booking for a studio
  const getCurrentBooking = (studioId: number) => {
    return bookings.find(booking => {
      // Skip cancelled bookings - they don't make studios "in-use"
      if (booking.status === 'cancelled') return false;
      
      // Check direct studio link
      if (booking.studioId === studioId) {
        const start = new Date(booking.start);
        const end = new Date(booking.end);
        return start <= now && end > now;
      }
      
      // Check junction table links
      const hasJunctionLink = bookingStudios.some(bs => 
        Number(bs.bookingId) === Number(booking.id) && 
        Number(bs.studioId) === Number(studioId)
      );
      
      if (hasJunctionLink) {
        const start = new Date(booking.start);
        const end = new Date(booking.end);
        return start <= now && end > now;
      }
      
      return false;
    });
  };

  // Function to get next booking for a studio
  const getNextBooking = (studioId: number) => {
    const futureBookings = bookings
      .filter(booking => {
        // Skip cancelled bookings - they don't affect studio availability
        if (booking.status === 'cancelled') return false;
        
        // Check direct studio link
        if (booking.studioId === studioId) {
          const start = new Date(booking.start);
          return start > now;
        }
        
        // Check junction table links
        const hasJunctionLink = bookingStudios.some(bs => 
          Number(bs.bookingId) === Number(booking.id) && 
          Number(bs.studioId) === Number(studioId)
        );
        
        if (hasJunctionLink) {
          const start = new Date(booking.start);
          return start > now;
        }
        
        return false;
      })
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    
    return futureBookings[0];
  };

  // Function to get all linked studios for a booking
  const getLinkedStudiosForBooking = (booking: any): string[] => {
    if (!booking) return [];
    
    const studioNames: string[] = [];
    
    // Check direct studio reference first
    if (booking.studioId) {
      const studio = studios.find(s => s.id === booking.studioId);
      if (studio) {
        studioNames.push(studio.name);
      }
    }
    
    // Add studios from the bookingStudios junction table
    const links = bookingStudios.filter(bs => 
      Number(bs.bookingId) === Number(booking.id)
    );
    
    if (links && links.length > 0) {
      links.forEach(link => {
        const studio = studios.find(s => s.id === link.studioId);
        if (studio && !studioNames.includes(studio.name)) {
          studioNames.push(studio.name);
        }
      });
    }
    
    return studioNames;
  };

  // Function to get other linked studios (excluding current studio)
  const getOtherLinkedStudios = (booking: any, currentStudioId: number): string => {
    const allLinkedStudios = getLinkedStudiosForBooking(booking);
    const currentStudio = studios.find(s => s.id === currentStudioId);
    
    if (!currentStudio) return "";
    
    // Remove current studio from the list
    const otherStudios = allLinkedStudios.filter(name => name !== currentStudio.name);
    
    if (otherStudios.length === 0) return "";
    if (otherStudios.length === 1) return `+ ${otherStudios[0]}`;
    return `+ ${otherStudios.length} other studios`;
  };

  // Function to get studio status
  const getStudioStatus = (studio: Studio) => {
    const currentBooking = getCurrentBooking(studio.id);
    const nextBooking = getNextBooking(studio.id);
    
    if (currentBooking) {
      const endTime = new Date(currentBooking.end);
      const endDate = new Date(currentBooking.end).toLocaleDateString('en-US', {
        timeZone: import.meta.env.VITE_FACILITY_TIMEZONE || 'America/Chicago',
        month: 'short',
        day: 'numeric',
        year: new Date(currentBooking.end).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
      });
      const todayInChicago = new Date().toLocaleDateString('en-US', { timeZone: import.meta.env.VITE_FACILITY_TIMEZONE || 'America/Chicago' });
      const bookingEndInChicago = new Date(currentBooking.end).toLocaleDateString('en-US', { timeZone: import.meta.env.VITE_FACILITY_TIMEZONE || 'America/Chicago' });
      const isToday = bookingEndInChicago === todayInChicago;
      return {
        status: "in-use",
        label: "In Use",
        detail: `Until ${formatTime(endTime)}${isToday ? '' : ` on ${endDate}`}`,
        booking: currentBooking,
        color: "bg-red-500"
      };
    }
    
    if (nextBooking) {
      const startTime = new Date(nextBooking.start);
      const startDate = new Date(nextBooking.start).toLocaleDateString('en-US', {
        timeZone: import.meta.env.VITE_FACILITY_TIMEZONE || 'America/Chicago',
        month: 'short',
        day: 'numeric',
        year: new Date(nextBooking.start).getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
      });
      const todayInChicago = new Date().toLocaleDateString('en-US', { timeZone: import.meta.env.VITE_FACILITY_TIMEZONE || 'America/Chicago' });
      const bookingStartInChicago = new Date(nextBooking.start).toLocaleDateString('en-US', { timeZone: import.meta.env.VITE_FACILITY_TIMEZONE || 'America/Chicago' });
      const isToday = bookingStartInChicago === todayInChicago;
      return {
        status: "available",
        label: "Available",
        detail: `Until ${formatTime(startTime)}${isToday ? '' : ` on ${startDate}`}`,
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
      
      <div className={`flex-1 overflow-auto p-3 ${isMobile ? 'pb-20' : ''} space-y-4`}>
        {/* Weather Section - Only on mobile - Floating */}
        {isMobile && (
          <div className="bg-white/95 dark:bg-neutral-800/95 backdrop-blur-sm border border-white/20 dark:border-neutral-700/50 shadow-lg rounded-2xl p-4 mx-3">
            <WeatherWidget 
              showForecast={true} 
              size="normal" 
              className="w-full"
            />
          </div>
        )}

        {/* Header Section - Floating */}
        <div className={`${isMobile ? 'bg-white/95 dark:bg-neutral-800/95 backdrop-blur-sm border border-white/20 dark:border-neutral-700/50 shadow-lg' : 'bg-white dark:bg-neutral-800 shadow-lg border dark:border-neutral-700'} rounded-2xl p-4 mx-3`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2 dark:text-white">
                <Tv className="h-5 w-5" />
                Studio Status
              </h1>
              <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
                Real-time status and availability of all studios
              </p>
            </div>
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-neutral-700 rounded-lg p-1 shrink-0">
              <Button
                size="sm"
                variant={view === "cards" ? "default" : "ghost"}
                className="h-8 px-2.5"
                onClick={() => setView("cards")}
                data-testid="button-view-cards"
              >
                <LayoutGrid className="h-4 w-4 sm:mr-1.5" />
                <span className="hidden sm:inline">Cards</span>
              </Button>
              <Button
                size="sm"
                variant={view === "map" ? "default" : "ghost"}
                className="h-8 px-2.5"
                onClick={() => setView("map")}
                data-testid="button-view-map"
              >
                <MapIcon className="h-4 w-4 sm:mr-1.5" />
                <span className="hidden sm:inline">Map</span>
              </Button>
            </div>
          </div>
        </div>

        {view === "map" && (
          <div className="mx-3">
            <FacilityMap />
          </div>
        )}

        {/* Studios Grid - Floating Cards */}
        {view === "cards" && (
        <>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 mx-3">
          {studios.map((studio) => {
            const studioStatus = getStudioStatus(studio);
            
            return (
              <Card key={studio.id} className={cn(
                "transition-all hover:shadow-xl border-2 shadow-lg",
                studioStatus.status === "in-use" 
                  ? "bg-red-50 dark:bg-red-950/50 border-red-300 dark:border-red-800 hover:border-red-400 dark:hover:border-red-700" 
                  : "bg-green-50 dark:bg-green-950/50 border-green-300 dark:border-green-800 hover:border-green-400 dark:hover:border-green-700"
              )}>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <Tv className="h-3 w-3 dark:text-gray-300" />
                      <span className="font-semibold text-xs dark:text-white">{studio.name}</span>
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
                    
                    <div className="text-xs text-gray-600 dark:text-gray-400 text-center">
                      {studioStatus.detail}
                    </div>
                    
                    {studioStatus.booking && (
                      <div className="text-xs text-center">
                        <div className="font-medium text-neutral-900 dark:text-gray-100 truncate">
                          {studioStatus.booking.title}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {formatTime(studioStatus.booking.start)}
                        </div>

                        {getOtherLinkedStudios(studioStatus.booking, studio.id) && (
                          <div className="text-xs text-blue-600 dark:text-blue-400 mt-0.5 truncate">
                            {getOtherLinkedStudios(studioStatus.booking, studio.id)}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
        
        {/* Empty State - Floating */}
        {studios.length === 0 && (
          <div className={`${isMobile ? 'bg-white/95 dark:bg-neutral-800/95 backdrop-blur-sm border border-white/20 dark:border-neutral-700/50 shadow-lg' : 'bg-white dark:bg-neutral-800 shadow-lg border dark:border-neutral-700'} rounded-2xl p-12 mx-3`}>
            <div className="text-center text-gray-500 dark:text-gray-400">
              <Tv className="h-12 w-12 mx-auto mb-4 text-gray-400 dark:text-gray-500" />
              <p>No studios found</p>
            </div>
          </div>
        )}
        </>
        )}
      </div>
    </div>
  );
}