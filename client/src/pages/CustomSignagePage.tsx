import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import WeatherWidget from "@/components/weather/WeatherWidget";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { getFacilityTimezoneAsync } from "@/lib/timezoneConfig";
import { format, parseISO, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Calendar, Radio, AlertTriangle, Camera } from "lucide-react";

// Define timezone and time functions
const BUILD_TIME_TIMEZONE = import.meta.env.VITE_FACILITY_TIMEZONE || 'America/Chicago';

function getCurrentFacilityTime() {
  return new Date(); // Current UTC time for database comparison
}

function formatFacilityTime(date: Date | string, formatStr: string, timezone: string) {
  let facilityDate;
  if (typeof date === 'string') {
    facilityDate = toZonedTime(parseISO(date), timezone);
  } else {
    facilityDate = toZonedTime(date, timezone);
  }
  return format(facilityDate, formatStr);
}

interface CustomSignageProps {
  studioIds?: string;
  title?: string;
  layout?: 'grid' | 'list' | 'compact';
  showWeather?: boolean;
  showAlerts?: boolean;
  showWeekly?: boolean;
  refreshInterval?: number;
}

interface Studio {
  id: number;
  name: string;
  status?: string;
}

interface Booking {
  id: number;
  title: string;
  description?: string;
  start: string;
  end: string;
  type: string;
  status: string;
  color: string;
  studios?: Studio[];
  studioNames?: string;
}

interface Alert {
  id: number;
  title: string;
  description?: string;
  alert_type: string;
  severity: string;
  start: string;
  end: string;
  status: string;
}

export default function CustomSignagePage() {
  const [currentTime, setCurrentTime] = useState(() => getCurrentFacilityTime());
  const [facilityTimezone, setFacilityTimezone] = useState<string>(BUILD_TIME_TIMEZONE);
  
  // Parse URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const studioIds = urlParams.get('studios');
  const title = urlParams.get('title') || 'Studio Display';
  const layout = (urlParams.get('layout') as 'grid' | 'list' | 'compact') || 'grid';
  const showWeather = urlParams.get('weather') !== 'false';
  const showAlerts = urlParams.get('alerts') !== 'false';
  const showWeekly = urlParams.get('weekly') !== 'false';
  const refreshInterval = parseInt(urlParams.get('refresh') || '120') * 1000; // Convert to milliseconds
  
  const { siteName } = useSiteSettings();
  
  // Load facility timezone
  useEffect(() => {
    const loadTimezone = async () => {
      try {
        const timezone = await getFacilityTimezoneAsync();
        setFacilityTimezone(timezone);
      } catch (error) {
        console.error("Failed to load facility timezone:", error);
      }
    };
    loadTimezone();
  }, []);
  
  // Auto-refresh time
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(getCurrentFacilityTime(facilityTimezone));
    }, 30000);
    
    return () => clearInterval(timer);
  }, [facilityTimezone]);
  
  // Auto-refresh page data
  useEffect(() => {
    const timer = setInterval(() => {
      window.location.reload();
    }, refreshInterval);
    
    return () => clearInterval(timer);
  }, [refreshInterval]);
  
  // Fetch studios
  const { data: allStudios = [] } = useQuery({
    queryKey: ['/api/studios'],
    queryFn: async () => {
      const res = await fetch('/api/studios');
      return res.json();
    },
    refetchInterval: 60000, // Refresh every minute
  });
  
  // Fetch bookings
  const { data: allBookings = [] } = useQuery({
    queryKey: ['/api/bookings'],
    queryFn: async () => {
      const res = await fetch('/api/bookings');
      return res.json();
    },
    refetchInterval: 60000,
  });
  
  // Fetch booking-studio relationships
  const { data: bookingStudios = [] } = useQuery({
    queryKey: ['/api/booking-studios'],
    queryFn: async () => {
      const res = await fetch('/api/booking-studios');
      return res.json();
    },
    refetchInterval: 60000,
  });
  
  // Fetch alerts
  const { data: allAlerts = [] } = useQuery({
    queryKey: ['/api/alerts'],
    queryFn: async () => {
      const res = await fetch('/api/alerts');
      return res.json();
    },
    refetchInterval: 60000,
  });
  
  // Filter studios based on URL parameter
  const filteredStudios = studioIds 
    ? allStudios.filter((studio: Studio) => 
        studioIds.split(',').map(id => parseInt(id.trim())).includes(studio.id)
      )
    : allStudios;
  
  // Get today's date range in facility timezone
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  
  // Filter bookings for today and selected studios
  const todaysBookings = allBookings.filter((booking: Booking) => {
    const bookingStart = new Date(booking.start);
    const bookingEnd = new Date(booking.end);
    
    // Check if booking is today
    const isToday = (bookingStart >= todayStart && bookingStart < todayEnd) ||
                   (bookingEnd > todayStart && bookingEnd <= todayEnd) ||
                   (bookingStart <= todayStart && bookingEnd >= todayEnd);
    
    if (!isToday) return false;
    
    // If no specific studios are selected, show all bookings
    if (!studioIds) return true;
    
    // Check if booking involves any of the selected studios
    const selectedStudioIds = studioIds.split(',').map(id => parseInt(id.trim()));
    const bookingStudioIds = bookingStudios
      .filter((bs: any) => bs.bookingId === booking.id)
      .map((bs: any) => bs.studioId);
    
    return bookingStudioIds.some(id => selectedStudioIds.includes(id));
  });
  
  // Sort bookings by start time
  const sortedBookings = todaysBookings.sort((a: Booking, b: Booking) => 
    new Date(a.start).getTime() - new Date(b.start).getTime()
  );
  
  // Filter active alerts
  const activeAlerts = showAlerts ? allAlerts.filter((alert: Alert) => 
    alert.status === 'active'
  ) : [];
  
  // Get studio status for selected studios
  const studioStatus = filteredStudios.map((studio: Studio) => {
    const currentBooking = sortedBookings.find((booking: Booking) => {
      const now = new Date();
      const start = new Date(booking.start);
      const end = new Date(booking.end);
      const bookingStudioIds = bookingStudios
        .filter((bs: any) => bs.bookingId === booking.id)
        .map((bs: any) => bs.studioId);
      
      return bookingStudioIds.includes(studio.id) && now >= start && now <= end;
    });
    
    return {
      ...studio,
      currentBooking,
      status: currentBooking ? 'in-use' : 'available'
    };
  });
  
  // Format time
  const formatTime = (dateStr: string) => {
    return format(new Date(dateStr), 'h:mm a');
  };
  
  // Format booking duration
  const formatDuration = (start: string, end: string) => {
    return `${formatTime(start)} - ${formatTime(end)}`;
  };
  
  // Get layout classes
  const getLayoutClasses = () => {
    switch (layout) {
      case 'list':
        return 'space-y-4';
      case 'compact':
        return 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3';
      default: // grid
        return 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6';
    }
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-6xl font-bold text-white drop-shadow-lg">
              {title}
            </h1>
            <p className="text-2xl text-blue-200 mt-2">
              {siteName || 'BookStud.io'}
            </p>
          </div>
          
          <div className="text-right">
            <div className="text-4xl font-bold text-white drop-shadow-lg">
              {format(currentTime, 'h:mm a')}
            </div>
            <div className="text-xl text-blue-200">
              {format(currentTime, 'EEEE, MMMM d, yyyy')}
            </div>
          </div>
        </div>
        
        {showWeather && (
          <div className="flex justify-end">
            <WeatherWidget size="large" />
          </div>
        )}
      </div>
      
      {/* Active Alerts */}
      {showAlerts && activeAlerts.length > 0 && (
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-red-400 mb-4">
            🚨 Active Facility Alerts
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeAlerts.map((alert: Alert) => (
              <div
                key={alert.id}
                className={`p-4 rounded-lg border-l-4 ${
                  alert.severity === 'critical' ? 'bg-red-900 border-red-500' :
                  alert.severity === 'high' ? 'bg-orange-900 border-orange-500' :
                  alert.severity === 'medium' ? 'bg-yellow-900 border-yellow-500' :
                  'bg-blue-900 border-blue-500'
                }`}
              >
                <h3 className="text-xl font-bold text-white">{alert.title}</h3>
                {alert.description && (
                  <p className="text-gray-300 mt-2">{alert.description}</p>
                )}
                <p className="text-sm text-gray-400 mt-2">
                  {formatDuration(alert.start, alert.end)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Studio Status Overview */}
      {filteredStudios.length > 0 && (
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-white mb-6">
            Studio Status
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {studioStatus.map((studio) => (
              <div
                key={studio.id}
                className={`p-4 rounded-lg border-2 ${
                  studio.status === 'in-use' 
                    ? 'bg-red-900 border-red-500' 
                    : 'bg-green-900 border-green-500'
                }`}
              >
                <h3 className="text-lg font-bold text-white text-center">
                  {studio.name}
                </h3>
                <div className={`text-center mt-2 ${
                  studio.status === 'in-use' ? 'text-red-300' : 'text-green-300'
                }`}>
                  {studio.status === 'in-use' ? '🔴 IN USE' : '🟢 AVAILABLE'}
                </div>
                {studio.currentBooking && (
                  <div className="text-center mt-2 text-white text-sm">
                    {studio.currentBooking.title}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Today's Schedule */}
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-white mb-6">
          Today's Schedule
          {studioIds && (
            <span className="text-xl text-blue-300 ml-4">
              ({filteredStudios.map(s => s.name).join(', ')})
            </span>
          )}
        </h2>
        
        {sortedBookings.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-2xl text-gray-400">
              No bookings scheduled for today
            </p>
          </div>
        ) : (
          <div className={getLayoutClasses()}>
            {sortedBookings.map((booking: Booking) => {
              const bookingStudioNames = bookingStudios
                .filter((bs: any) => bs.bookingId === booking.id)
                .map((bs: any) => {
                  const studio = allStudios.find((s: Studio) => s.id === bs.studioId);
                  return studio?.name;
                })
                .filter(Boolean)
                .join(', ');
              
              return (
                <div
                  key={booking.id}
                  className={`p-6 rounded-lg shadow-lg border-l-4 ${
                    layout === 'compact' ? 'p-4' : 'p-6'
                  }`}
                  style={{
                    backgroundColor: `${booking.color}20`,
                    borderLeftColor: booking.color
                  }}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className={`font-bold text-white ${
                      layout === 'compact' ? 'text-lg' : 'text-xl'
                    }`}>
                      {booking.title}
                    </h3>
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      booking.status === 'confirmed' ? 'bg-green-600 text-white' :
                      booking.status === 'tentative' ? 'bg-yellow-600 text-white' :
                      'bg-gray-600 text-white'
                    }`}>
                      {booking.status.toUpperCase()}
                    </span>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center text-blue-300">
                      <span className="text-lg mr-2">🕒</span>
                      <span className={layout === 'compact' ? 'text-sm' : 'text-base'}>
                        {formatDuration(booking.start, booking.end)}
                      </span>
                    </div>
                    
                    {bookingStudioNames && (
                      <div className="flex items-center text-green-300">
                        <span className="text-lg mr-2">📺</span>
                        <span className={layout === 'compact' ? 'text-sm' : 'text-base'}>
                          {bookingStudioNames}
                        </span>
                      </div>
                    )}
                    
                    {booking.description && (
                      <p className="text-gray-300 text-sm mt-2">
                        {booking.description.length > 100 && layout === 'compact'
                          ? `${booking.description.substring(0, 100)}...`
                          : booking.description
                        }
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      
      {/* Footer */}
      <div className="text-center text-gray-400 text-lg">
        <p>Updated every {refreshInterval / 1000} seconds • {format(new Date(), 'h:mm:ss a')}</p>
      </div>
    </div>
  );
}