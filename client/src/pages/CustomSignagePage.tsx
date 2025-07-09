import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Calendar, Radio, AlertTriangle } from "lucide-react";
import { format, isWithinInterval, addDays, startOfDay, endOfDay, parseISO } from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";
import { getFacilityTimezoneAsync } from "@/lib/timezoneConfig";
import { useSiteSettings } from "@/hooks/useSiteSettings";

interface Booking {
  id: number;
  title: string;
  description: string;
  start: string;
  end: string;
  status: 'confirmed' | 'tentative' | 'cancelled';
  type: 'production' | 'maintenance' | 'meeting';
  color: string;
  studioId: number;
}

interface Studio {
  id: number;
  name: string;
  status: 'available' | 'maintenance' | 'in_use';
}

interface BookingStudioLink {
  id: number;
  bookingId: number;
  studioId: number;
}

interface WeatherData {
  temperature: number;
  condition: string;
  humidity: number;
  windSpeed: number;
  icon: string;
  location: string;
}

const BUILD_TIME_TIMEZONE = import.meta.env.VITE_FACILITY_TIMEZONE || 'America/Chicago';

function getCurrentFacilityTime(timezone: string) {
  return new Date();
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

function isBookingActive(booking: any, currentTime: Date): boolean {
  const start = parseISO(booking.start);
  const end = parseISO(booking.end);
  return currentTime >= start && currentTime <= end;
}

function getNextAvailable(studioId: number, bookings: any[], bookingStudioLinks: any[], timezone: string): string {
  const now = new Date();
  
  const studioBookings = bookings.filter(booking => {
    const isDirectStudio = booking.studioId === studioId;
    const hasLink = bookingStudioLinks.some(link => link.studioId === studioId && link.bookingId === booking.id);
    return isDirectStudio || hasLink;
  }).sort((a, b) => parseISO(a.start).getTime() - parseISO(b.start).getTime());

  const nextBooking = studioBookings.find(booking => parseISO(booking.start) > now);
  if (nextBooking) {
    return formatFacilityTime(nextBooking.start, 'h:mm a', timezone);
  }
  
  return 'Available';
}

function getStudioNames(booking: any, studios: any[], bookingStudioLinks: any[]) {
  const studioIds = new Set<number>();
  
  if (booking.studioId) {
    studioIds.add(booking.studioId);
  }
  
  bookingStudioLinks
    .filter(link => link.bookingId === booking.id)
    .forEach(link => studioIds.add(link.studioId));
  
  const studioNames = Array.from(studioIds)
    .map(id => studios.find(s => s.id === id)?.name)
    .filter(Boolean);
  
  return studioNames.length > 0 ? studioNames.join(', ') : 'Unknown Studio';
}

export default function CustomSignagePage() {
  const [currentTime, setCurrentTime] = useState(() => getCurrentFacilityTime(BUILD_TIME_TIMEZONE));
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [facilityTimezone, setFacilityTimezone] = useState<string>(BUILD_TIME_TIMEZONE);
  
  // Parse URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const studioIds = urlParams.get('studios');
  const title = urlParams.get('title') || 'Studio Display';
  const showWeather = urlParams.get('weather') !== 'false';
  const showAlerts = urlParams.get('alerts') !== 'false';
  const showWeekly = urlParams.get('weekly') !== 'false';
  const refreshInterval = parseInt(urlParams.get('refresh') || '120') * 1000;
  
  const { siteName } = useSiteSettings();
  
  // Load facility timezone from database
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
  
  // Auto-refresh time every 30 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(getCurrentFacilityTime(facilityTimezone));
    }, 30000);
    
    return () => clearInterval(timer);
  }, [facilityTimezone]);
  
  // Auto-refresh data every 2 minutes
  useEffect(() => {
    const refreshTimer = setInterval(() => {
      window.location.reload();
    }, refreshInterval);
    
    return () => clearInterval(refreshTimer);
  }, [refreshInterval]);

  // Fetch weather data if enabled
  useEffect(() => {
    if (!showWeather) return;
    
    const fetchWeatherData = async () => {
      try {
        const apiKey = import.meta.env.VITE_OPENWEATHER_API_KEY;
        if (!apiKey) return;

        const weatherLocation = import.meta.env.VITE_WEATHER_LOCATION;
        if (!weatherLocation) return;

        const currentResponse = await fetch(
          `https://api.openweathermap.org/data/2.5/weather?q=${weatherLocation}&appid=${apiKey}&units=imperial`
        );
        
        if (currentResponse.ok) {
          const currentData = await currentResponse.json();
          setWeather({
            temperature: Math.round(currentData.main.temp),
            condition: currentData.weather[0].description,
            humidity: currentData.main.humidity,
            windSpeed: Math.round(currentData.wind.speed),
            icon: currentData.weather[0].icon,
            location: currentData.name
          });
        }
      } catch (error) {
        console.error("Weather API error:", error);
      }
    };

    fetchWeatherData();
    const weatherTimer = setInterval(fetchWeatherData, 300000);
    return () => clearInterval(weatherTimer);
  }, [showWeather]);

  const { data: bookings = [] } = useQuery<Booking[]>({
    queryKey: ['/api/public/bookings'],
    refetchInterval: 60000,
    staleTime: 0,
    gcTime: 0,
  });

  const { data: allAlerts = [] } = useQuery<any[]>({
    queryKey: ['/api/alerts'],
    refetchInterval: 30000,
    staleTime: 0,
    gcTime: 0,
  });

  const { data: studios = [] } = useQuery<Studio[]>({
    queryKey: ['/api/studios'],
    refetchInterval: 60000,
  });

  const { data: bookingStudioLinks = [] } = useQuery<BookingStudioLink[]>({
    queryKey: ['/api/public/booking-studios'],
    refetchInterval: 60000,
  });

  // Filter studios based on URL parameter
  const filteredStudios = studioIds 
    ? studios.filter((studio: Studio) => 
        studioIds.split(',').map(id => parseInt(id.trim())).includes(studio.id)
      )
    : studios;

  // Combine bookings with alerts
  const combinedBookings = useMemo(() => {
    const alertsAsBookings = allAlerts.map(alert => ({
      id: `alert-${alert.id}`,
      title: alert.title,
      description: alert.description,
      start: alert.start,
      end: alert.end,
      type: alert.alertType || 'maintenance',
      severity: alert.severity,
      status: alert.status || 'active',
      studioId: null,
      color: alert.severity === 'critical' ? '#f44336' : 
             alert.severity === 'high' ? '#ff9800' : 
             alert.severity === 'medium' ? '#ffc107' : 
             alert.severity === 'low' ? '#2196f3' : '#ffc107'
    }));
    
    return [...bookings, ...alertsAsBookings];
  }, [bookings, allAlerts]);

  // Filter today's bookings - use proper facility timezone bounds
  const nowInFacility = toZonedTime(new Date(), facilityTimezone);
  const todayStartInFacility = startOfDay(nowInFacility);
  const todayEndInFacility = endOfDay(nowInFacility);
  const today = fromZonedTime(todayStartInFacility, facilityTimezone);
  const todayEnd = fromZonedTime(todayEndInFacility, facilityTimezone);
  
  const todaysBookings = combinedBookings.filter(booking => {
    const bookingStart = parseISO(booking.start);
    const isMaintenanceType = booking.type === 'maintenance' || booking.type === 'all-day:maintenance';
    const withinInterval = isWithinInterval(bookingStart, { start: today, end: todayEnd });
    
    if (!withinInterval) return false;
    
    // Apply studio filter for regular bookings
    if (!isMaintenanceType && studioIds) {
      const selectedStudioIds = studioIds.split(',').map(id => parseInt(id.trim()));
      const bookingStudioIds = bookingStudioLinks
        .filter((bs: any) => bs.bookingId === booking.id)
        .map((bs: any) => bs.studioId);
      
      const hasDirectStudio = selectedStudioIds.includes(booking.studioId);
      const hasLinkedStudio = bookingStudioIds.some(id => selectedStudioIds.includes(id));
      
      return hasDirectStudio || hasLinkedStudio;
    }
    
    return !isMaintenanceType;
  }).sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  // Get today's alerts
  const todaysAlerts = showAlerts ? combinedBookings.filter(booking => {
    const bookingStart = parseISO(booking.start);
    const isMaintenanceType = booking.type === 'maintenance' || booking.type === 'all-day:maintenance' || booking.type === 'alert';
    const hasAlertKeyword = booking.title && (
      booking.title.toLowerCase().includes('alert') ||
      booking.title.toLowerCase().includes('outage') ||
      booking.title.toLowerCase().includes('emergency') ||
      booking.title.toLowerCase().includes('maintenance') ||
      booking.title.toLowerCase().includes('notice') ||
      booking.title.toLowerCase().includes('warning')
    );
    return isWithinInterval(bookingStart, { start: today, end: todayEnd }) && (isMaintenanceType || hasAlertKeyword);
  }).sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()) : [];

  // Get weekly overview
  const weeklyBookings = showWeekly ? Array.from({ length: 7 }, (_, i) => {
    const facilityDate = addDays(nowInFacility, i);
    const date = fromZonedTime(startOfDay(facilityDate), facilityTimezone);
    const dayEnd = fromZonedTime(endOfDay(facilityDate), facilityTimezone);
    const dayBookings = combinedBookings.filter(booking => {
      const bookingStart = parseISO(booking.start);
      const withinInterval = isWithinInterval(bookingStart, { start: date, end: dayEnd });
      
      if (!withinInterval) return false;
      
      // Apply studio filter
      if (studioIds) {
        const selectedStudioIds = studioIds.split(',').map(id => parseInt(id.trim()));
        const bookingStudioIds = bookingStudioLinks
          .filter((bs: any) => bs.bookingId === booking.id)
          .map((bs: any) => bs.studioId);
        
        const hasDirectStudio = selectedStudioIds.includes(booking.studioId);
        const hasLinkedStudio = bookingStudioIds.some(id => selectedStudioIds.includes(id));
        
        return hasDirectStudio || hasLinkedStudio;
      }
      
      return true;
    }).sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    
    return {
      date,
      bookings: dayBookings,
    };
  }) : [];

  // Get current studio status for filtered studios
  const studioStatus = filteredStudios.map(studio => {
    const activeBooking = combinedBookings.find(booking => {
      const isDirectStudio = booking.studioId === studio.id;
      const hasLink = bookingStudioLinks.some(link => link.studioId === studio.id && link.bookingId === booking.id);
      return (isDirectStudio || hasLink) && isBookingActive(booking, currentTime);
    });

    return {
      ...studio,
      currentBooking: activeBooking,
      nextAvailable: getNextAvailable(studio.id, combinedBookings, bookingStudioLinks, facilityTimezone),
    };
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-10">
        <div className="flex items-center space-x-6">
          <div className="text-6xl font-bold text-white drop-shadow-lg">{title}</div>
          <Badge variant="outline" className="text-xl px-6 py-3 bg-blue-500/20 text-blue-300 border-blue-400 font-semibold">
            CUSTOM DISPLAY
          </Badge>
        </div>
        <div className="text-right text-white">
          <div className="flex items-center justify-end space-x-6">
            {/* Weather Info */}
            {weather && showWeather && (
              <div className="text-center">
                <div className="flex items-center justify-center space-x-2 mb-1">
                  <img 
                    src={`https://openweathermap.org/img/w/${weather.icon}.png`}
                    alt={weather.condition}
                    className="w-12 h-12"
                  />
                  <div className="text-3xl font-bold">{weather.temperature}°F</div>
                </div>
                <div className="text-lg text-slate-300 capitalize">{weather.condition}</div>
                <div className="text-base text-slate-400">{weather.location}</div>
              </div>
            )}
            
            {/* Time Info */}
            <div>
              <div className="text-4xl font-bold">
                {new Date().toLocaleTimeString('en-US', { 
                  timeZone: facilityTimezone,
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true
                })}
              </div>
              <div className="text-xl text-slate-300">
                {new Date().toLocaleDateString('en-US', {
                  timeZone: facilityTimezone,
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </div>
              <div className="text-lg text-slate-400">
                {facilityTimezone?.includes('Los_Angeles') ? 'Pacific Time' : 
                 facilityTimezone?.includes('Chicago') ? 'Central Time' : 
                 facilityTimezone?.includes('New_York') ? 'Eastern Time' : 
                 facilityTimezone?.includes('Denver') ? 'Mountain Time' : 
                 facilityTimezone || 'Local Time'}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Today's Schedule */}
        <div className="xl:col-span-2">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="flex items-center text-white text-3xl">
                <Calendar className="mr-4 h-8 w-8" />
                Today's Schedule
              </CardTitle>
            </CardHeader>
            <CardContent>
              {todaysBookings.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <Calendar className="mx-auto h-16 w-16 mb-4 opacity-50" />
                  <p className="text-xl">No bookings scheduled for today</p>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-4">
                  {todaysBookings.map((booking) => (
                    <div key={booking.id} className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
                      <div className="text-lg font-semibold text-white mb-2 truncate">
                        {booking.title}
                      </div>
                      <div className="text-sm text-slate-300 mb-2">
                        {formatFacilityTime(booking.start, 'h:mm a', facilityTimezone)} - {formatFacilityTime(booking.end, 'h:mm a', facilityTimezone)}
                      </div>
                      <div className="text-sm text-slate-400">
                        {getStudioNames(booking, studios, bookingStudioLinks)}
                      </div>
                      {booking.status && (
                        <div className="mt-2">
                          <Badge variant="outline" className={`text-xs ${
                            booking.status === 'confirmed' ? 'bg-green-500/20 text-green-300 border-green-400' :
                            booking.status === 'tentative' ? 'bg-yellow-500/20 text-yellow-300 border-yellow-400' :
                            'bg-red-500/20 text-red-300 border-red-400'
                          }`}>
                            {booking.status.toUpperCase()}
                          </Badge>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Active Site Alerts */}
          {showAlerts && todaysAlerts.length > 0 && (
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="flex items-center text-white text-2xl">
                  <AlertTriangle className="mr-3 h-6 w-6" />
                  Active Site Alerts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {todaysAlerts.map((alert) => (
                    <div key={alert.id} className="bg-orange-500/20 rounded-lg p-4 border border-orange-400">
                      <div className="text-lg font-semibold text-white mb-2">
                        {alert.title}
                      </div>
                      <div className="text-sm text-slate-300 mb-2">
                        {formatFacilityTime(alert.start, 'h:mm a', facilityTimezone)} - {formatFacilityTime(alert.end, 'h:mm a', facilityTimezone)}
                      </div>
                      {alert.description && (
                        <div className="text-sm text-slate-400">
                          {alert.description}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Studio Status */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="flex items-center text-white text-2xl">
                <Radio className="mr-3 h-6 w-6" />
                Studio Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                {studioStatus.map((studio) => (
                  <div key={studio.id} className="bg-slate-700/50 rounded-lg p-3">
                    <div className="text-lg font-semibold text-white mb-1">
                      {studio.name}
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className={`w-3 h-3 rounded-full ${
                        studio.currentBooking ? 'bg-red-500' : 'bg-green-500'
                      }`} />
                      <div className="text-sm text-slate-300">
                        {studio.currentBooking ? 'IN USE' : 'AVAILABLE'}
                      </div>
                    </div>
                    {studio.currentBooking && (
                      <div className="text-sm text-slate-400 mt-1 truncate">
                        {studio.currentBooking.title}
                      </div>
                    )}
                    <div className="text-xs text-slate-500 mt-1">
                      Next: {studio.nextAvailable}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Weekly Overview */}
          {showWeekly && (
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="flex items-center text-white text-2xl">
                  <Clock className="mr-3 h-6 w-6" />
                  Weekly Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {weeklyBookings.map((day, index) => (
                    <div key={index} className="border-l-4 border-slate-600 pl-4">
                      <div className="text-lg font-semibold text-white mb-2">
                        {formatFacilityTime(day.date, 'EEEE, MMM d', facilityTimezone)}
                      </div>
                      {day.bookings.length === 0 ? (
                        <div className="text-sm text-slate-500">No bookings</div>
                      ) : (
                        <div className="space-y-2">
                          {day.bookings.slice(0, 3).map((booking) => (
                            <div key={booking.id} className="text-sm">
                              <div className="text-slate-300 font-medium truncate">
                                {booking.title}
                              </div>
                              <div className="text-slate-500">
                                {formatFacilityTime(booking.start, 'h:mm a', facilityTimezone)} - {formatFacilityTime(booking.end, 'h:mm a', facilityTimezone)}
                              </div>
                            </div>
                          ))}
                          {day.bookings.length > 3 && (
                            <div className="text-xs text-slate-500">
                              +{day.bookings.length - 3} more
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}