import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Calendar, Radio, AlertTriangle } from "lucide-react";
import { format, isWithinInterval, addDays, startOfDay, endOfDay, parseISO, isSameDay } from "date-fns";
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

interface ForecastDay {
  date: string;
  temperature: {
    min: number;
    max: number;
  };
  condition: string;
  icon: string;
}

interface WeatherForecast {
  forecast: ForecastDay[];
}

const BUILD_TIME_TIMEZONE = import.meta.env.VITE_FACILITY_TIMEZONE || 'America/Chicago';

function getFacilityTime(timezone: string) {
  // Get current time in facility timezone
  const now = new Date();
  // Convert UTC time to facility time
  return toZonedTime(now, timezone);
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

function getCurrentFacilityTime(timezone: string) {
  // Get current UTC time for comparison with database UTC times
  return new Date();
}

function getStudioNames(booking: Booking, studios: Studio[], bookingStudioLinks: BookingStudioLink[]) {
  const studioIds = new Set<number>();
  
  // Add primary studio
  if (booking.studioId) {
    studioIds.add(booking.studioId);
  }
  
  // Add linked studios
  bookingStudioLinks
    .filter(link => link.bookingId === booking.id)
    .forEach(link => studioIds.add(link.studioId));
  
  const studioNames = Array.from(studioIds)
    .map(id => studios.find(s => s.id === id)?.name)
    .filter(Boolean);
  
  return studioNames.length > 0 ? studioNames.join(', ') : 'Unknown Studio';
}

function isBookingActive(booking: Booking, now: Date) {
  const start = parseISO(booking.start);
  const end = parseISO(booking.end);
  const isActive = isWithinInterval(now, { start, end });
  
  // Debug logging for booking 240
  if (booking.id === 240) {
    console.log(`[isBookingActive Debug] Booking 240:`, {
      bookingStart: start.toISOString(),
      bookingEnd: end.toISOString(), 
      currentTime: now.toISOString(),
      isWithinInterval: isActive,
      status: booking.status,
      finalResult: isActive && booking.status !== 'cancelled'
    });
  }
  
  return isActive && booking.status !== 'cancelled';
}

function getNextAvailable(studioId: number, bookings: Booking[], bookingStudioLinks: BookingStudioLink[], timezone: string) {
  const now = getFacilityTime(timezone);
  const studioBookings = bookings.filter(booking => {
    if (booking.studioId === studioId) return true;
    return bookingStudioLinks.some(link => link.studioId === studioId && link.bookingId === booking.id);
  }).sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  
  // Debug logging for studios 1 and 2
  if (studioId === 1 || studioId === 2) {
    console.log(`[Studio ${studioId} Debug] Current time:`, now.toISOString());
    console.log(`[Studio ${studioId} Debug] Studio bookings:`, studioBookings.map(b => ({
      id: b.id,
      title: b.title,
      start: b.start,
      end: b.end,
      isActive: isBookingActive(b, now)
    })));
  }
  
  // Check if currently in use
  const activeBooking = studioBookings.find(booking => isBookingActive(booking, now));
  if (activeBooking) {
    if (studioId === 1 || studioId === 2) {
      console.log(`[Studio ${studioId} Debug] Active booking found:`, activeBooking.title);
    }
    return formatFacilityTime(activeBooking.end, 'h:mm a', timezone);
  }
  
  // Find next booking
  const nextBooking = studioBookings.find(booking => parseISO(booking.start) > now);
  if (nextBooking) {
    return formatFacilityTime(nextBooking.start, 'h:mm a', timezone);
  }
  
  return 'Available';
}

export default function SignagePage() {
  const [currentTime, setCurrentTime] = useState(() => getCurrentFacilityTime(BUILD_TIME_TIMEZONE));
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [forecast, setForecast] = useState<WeatherForecast | null>(null);
  const [facilityTimezone, setFacilityTimezone] = useState<string>(BUILD_TIME_TIMEZONE);
  
  // Get site settings
  const { siteName } = useSiteSettings();
  
  // Load facility timezone from database
  useEffect(() => {
    const loadTimezone = async () => {
      try {
        const timezone = await getFacilityTimezoneAsync();
        setFacilityTimezone(timezone);
      } catch (error) {
        console.error("Failed to load facility timezone:", error);
        // Keep using build-time timezone as fallback
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
  
  // Fetch weather data and forecast
  useEffect(() => {
    const fetchWeatherData = async () => {
      try {
        const apiKey = import.meta.env.VITE_OPENWEATHER_API_KEY;
        console.log("[SIGNAGE WEATHER] Weather API Key status:", apiKey ? "Available" : "Missing");
        // Fetch current weather
        const weatherLocation = import.meta.env.VITE_WEATHER_LOCATION;
        const weatherLat = import.meta.env.VITE_WEATHER_LAT;
        const weatherLon = import.meta.env.VITE_WEATHER_LON;
        
        console.log("[SIGNAGE WEATHER] Weather Location:", weatherLocation || "Not configured");
        console.log("[SIGNAGE WEATHER] Weather Lat:", weatherLat || "Not configured");
        console.log("[SIGNAGE WEATHER] Weather Lon:", weatherLon || "Not configured");
        console.log("[SIGNAGE WEATHER] All VITE env vars:", Object.keys(import.meta.env).filter(key => key.startsWith('VITE_')));
        
        if (!apiKey) {
          console.error("[SIGNAGE WEATHER] Weather integration disabled: API key not found");
          return;
        }

        if (!weatherLocation) {
          console.error("[SIGNAGE WEATHER] Weather integration disabled: Location not configured");
          return;
        }


        console.log("[SIGNAGE WEATHER] Fetching current weather...");
        const currentResponse = await fetch(
          `https://api.openweathermap.org/data/2.5/weather?q=${weatherLocation}&appid=${apiKey}&units=imperial`
        );
        
        console.log("[SIGNAGE WEATHER] Current weather response status:", currentResponse.status);
        
        if (currentResponse.ok) {
          const currentData = await currentResponse.json();
          console.log("[SIGNAGE WEATHER] Current weather data received:", currentData);
          setWeather({
            temperature: Math.round(currentData.main.temp),
            condition: currentData.weather[0].description,
            humidity: currentData.main.humidity,
            windSpeed: Math.round(currentData.wind.speed),
            icon: currentData.weather[0].icon,
            location: currentData.name
          });
          console.log("[SIGNAGE WEATHER] Weather state updated");
        } else {
          console.error("[SIGNAGE WEATHER] Current weather API failed:", currentResponse.status, await currentResponse.text());
        }

        // Fetch 7-day forecast
        console.log("[SIGNAGE WEATHER] Fetching forecast...");
        const forecastResponse = await fetch(
          `https://api.openweathermap.org/data/2.5/forecast?q=${weatherLocation}&appid=${apiKey}&units=imperial`
        );
        
        console.log("[SIGNAGE WEATHER] Forecast response status:", forecastResponse.status);
        
        if (forecastResponse.ok) {
          const forecastData = await forecastResponse.json();
          console.log("[SIGNAGE WEATHER] Forecast data received:", forecastData);
          
          // Process forecast data - get daily forecasts by grouping hourly data
          // Use facility timezone for proper date grouping
          const dailyData = new Map<string, any[]>();
          
          forecastData.list.forEach((item: any) => {
            const utcDate = new Date(item.dt * 1000);
            // Convert to facility timezone for proper date grouping
            const facilityDate = toZonedTime(utcDate, facilityTimezone);
            const dateString = format(facilityDate, 'yyyy-MM-dd');
            
            if (!dailyData.has(dateString)) {
              dailyData.set(dateString, []);
            }
            dailyData.get(dateString)!.push(item);
          });
          
          console.log("[SIGNAGE WEATHER] Daily data grouped:", Array.from(dailyData.keys()));
          
          // Create daily forecasts with proper min/max calculations
          const dailyForecasts: ForecastDay[] = [];
          
          // Filter out past dates and only include today and future dates
          // Use the same date calculation as the weekly view to ensure consistency
          const now = new Date();
          const facilityNow = toZonedTime(now, facilityTimezone);
          const today = format(facilityNow, 'yyyy-MM-dd');
          console.log("[SIGNAGE WEATHER] Today's date for filtering:", today);
          console.log("[SIGNAGE WEATHER] Current UTC time:", now.toISOString());
          console.log("[SIGNAGE WEATHER] Current facility time:", facilityNow.toISOString());
          
          const futureDates = Array.from(dailyData.entries())
            .filter(([dateString]) => dateString >= today)
            .slice(0, 7);
          
          console.log("[SIGNAGE WEATHER] Filtered future dates:", futureDates.map(([date]) => date));
          
          futureDates.forEach(([dateString, dayData]) => {
            const temps = dayData.map(item => item.main.temp);
            const minTemp = Math.min(...temps);
            const maxTemp = Math.max(...temps);
            
            // Use midday data for condition and icon (around noon)
            const middayData = dayData.find(item => {
              const hour = new Date(item.dt * 1000).getHours();
              return hour >= 11 && hour <= 13;
            }) || dayData[Math.floor(dayData.length / 2)];
            
            dailyForecasts.push({
              date: dateString,
              temperature: {
                min: Math.round(minTemp),
                max: Math.round(maxTemp)
              },
              condition: middayData.weather[0].description,
              icon: middayData.weather[0].icon
            });
          });
          
          console.log("[SIGNAGE WEATHER] Daily forecasts created:", dailyForecasts);
          setForecast({ forecast: dailyForecasts });
          console.log("[SIGNAGE WEATHER] Forecast state updated");
        } else {
          console.error("[SIGNAGE WEATHER] Forecast API failed:", forecastResponse.status, await forecastResponse.text());
        }
      } catch (error) {
        console.error("Weather API error:", error);
        // Continue without weather data if API unavailable
      }
    };

    // Try immediately and retry every 5 minutes
    fetchWeatherData();
    const weatherTimer = setInterval(fetchWeatherData, 300000);
    return () => clearInterval(weatherTimer);
  }, []);
  
  // Auto-refresh data every 2 minutes
  useEffect(() => {
    const refreshTimer = setInterval(() => {
      window.location.reload();
    }, 120000);
    
    return () => clearInterval(refreshTimer);
  }, []);

  const { data: bookings = [] } = useQuery<Booking[]>({
    queryKey: ['/api/public/bookings'],
    refetchInterval: 60000, // Refetch every minute
    staleTime: 0, // Always consider data stale
    gcTime: 0, // Don't cache data
  });

  // Fetch alerts from the dedicated alerts API
  const { data: allAlerts = [] } = useQuery<any[]>({
    queryKey: ['/api/alerts'],
    refetchInterval: 30000, // Refetch every 30 seconds for signage
    staleTime: 0, // Always consider data stale
    gcTime: 0, // Don't cache data
  });



  const { data: studios = [] } = useQuery<Studio[]>({
    queryKey: ['/api/studios'],
    refetchInterval: 60000,
  });

  const { data: bookingStudioLinks = [] } = useQuery<BookingStudioLink[]>({
    queryKey: ['/api/public/booking-studios'],
    refetchInterval: 60000,
  });

  // Combine bookings with alerts from API
  const combinedBookings = useMemo(() => {
    console.log(`SignagePage - Combining ${bookings.length} bookings with ${allAlerts.length} alerts`);
    
    // Convert alerts to booking format for display
    const alertsAsBookings = allAlerts.map(alert => ({
      id: `alert-${alert.id}`,
      title: alert.title,
      description: alert.description,
      start: alert.start,
      end: alert.end,
      type: alert.alertType || 'maintenance',
      severity: alert.severity,
      status: alert.status || 'active',
      studioId: null, // Alerts don't have studios
      pcrRoomId: null,
      userId: alert.createdBy,
      templateId: null,
      createdAt: alert.createdAt,
      notifyList: alert.notifyList || [],
      color: alert.severity === 'critical' ? '#f44336' : 
             alert.severity === 'high' ? '#ff9800' : 
             alert.severity === 'medium' ? '#ffc107' : 
             alert.severity === 'low' ? '#2196f3' : '#ffc107'
    }));
    
    console.log(`SignagePage - Converted ${alertsAsBookings.length} API alerts to booking format`);
    
    return [...bookings, ...alertsAsBookings];
  }, [bookings, allAlerts]);

  // Filter today's bookings and alerts - use proper facility timezone bounds
  // The issue is that currentTime is already timezone-converted, so we need to get
  // actual UTC boundaries for comparison with the UTC booking times
  const nowInFacility = toZonedTime(new Date(), facilityTimezone);
  const todayStartInFacility = startOfDay(nowInFacility);
  const todayEndInFacility = endOfDay(nowInFacility);
  // Convert back to UTC for comparison with booking.start which is in UTC
  const today = fromZonedTime(todayStartInFacility, facilityTimezone);
  const todayEnd = fromZonedTime(todayEndInFacility, facilityTimezone);
  const todaysBookings = combinedBookings.filter(booking => {
    const bookingStart = parseISO(booking.start);
    const isMaintenanceType = booking.type === 'maintenance' || booking.type === 'all-day:maintenance';
    const withinInterval = isWithinInterval(bookingStart, { start: today, end: todayEnd });
    

    
    return withinInterval && !isMaintenanceType;
  }).sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  // Get today's site alerts (from alerts API and maintenance type bookings)
  const todaysAlerts = combinedBookings.filter(booking => {
    const bookingStart = parseISO(booking.start);
    
    // Check if this is an alert from the alerts API (converted to booking format)
    const isApiAlert = typeof booking.id === 'string' && booking.id.startsWith('alert-');
    
    // Check if this is a maintenance type booking or has alert keywords
    const isMaintenanceType = booking.type === 'maintenance' || booking.type === 'all-day:maintenance' || booking.type === 'alert';
    const hasAlertKeyword = booking.title && (
      booking.title.toLowerCase().includes('alert') ||
      booking.title.toLowerCase().includes('outage') ||
      booking.title.toLowerCase().includes('emergency') ||
      booking.title.toLowerCase().includes('maintenance') ||
      booking.title.toLowerCase().includes('notice') ||
      booking.title.toLowerCase().includes('warning')
    );
    
    const isAlert = isApiAlert || isMaintenanceType || hasAlertKeyword;
    const withinToday = isWithinInterval(bookingStart, { start: today, end: todayEnd });
    
    console.log(`[todaysAlerts Debug] Booking ${booking.id} (${booking.title}):`, {
      isApiAlert,
      isMaintenanceType,
      hasAlertKeyword,
      isAlert,
      withinToday,
      bookingType: booking.type,
      bookingStart: bookingStart.toISOString(),
      todayStart: today.toISOString(),
      todayEnd: todayEnd.toISOString()
    });
    
    return withinToday && isAlert;
  }).sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  // Get weekly overview (next 7 days) - use proper timezone boundaries
  const weeklyBookings = Array.from({ length: 7 }, (_, i) => {
    const facilityDate = addDays(nowInFacility, i);
    const date = fromZonedTime(startOfDay(facilityDate), facilityTimezone);
    const dayEnd = fromZonedTime(endOfDay(facilityDate), facilityTimezone);
    const dayBookings = combinedBookings.filter(booking => {
      const bookingStart = parseISO(booking.start);
      return isWithinInterval(bookingStart, { start: date, end: dayEnd });
    }).sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    return {
      date,
      bookings: dayBookings,
    };
  });

  // Get current studio status
  const studioStatus = studios.map(studio => {
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

  // Get maintenance alerts from combined data (including alerts from API)
  const maintenanceAlerts = combinedBookings.filter(booking => {
    const isApiAlert = typeof booking.id === 'string' && booking.id.startsWith('alert-');
    const isMaintenanceType = booking.type === 'maintenance' || booking.type === 'all-day:maintenance';
    const isAlert = isApiAlert || isMaintenanceType;
    
    return isAlert && 
           parseISO(booking.start) >= today &&
           parseISO(booking.start) <= addDays(today, 7);
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-10">
        <div className="flex items-center space-x-6">
          <div className="text-6xl font-bold text-white drop-shadow-lg">{siteName}</div>
          <Badge variant="outline" className="text-xl px-6 py-3 bg-blue-500/20 text-blue-300 border-blue-400 font-semibold">
            LIVE DISPLAY
          </Badge>
        </div>
        <div className="text-right text-white">
          <div className="flex items-center justify-end space-x-6">
            {/* Weather Info */}
            {weather && (
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
                  {todaysBookings.map((booking) => {
                    const isAlert = booking.type === 'maintenance' || 
                                   booking.type === 'all-day:maintenance' ||
                                   booking.type === 'alert' ||
                                   (booking.title && (
                                     booking.title.toLowerCase().includes('alert') ||
                                     booking.title.toLowerCase().includes('outage') ||
                                     booking.title.toLowerCase().includes('emergency') ||
                                     booking.title.toLowerCase().includes('maintenance') ||
                                     booking.title.toLowerCase().includes('notice') ||
                                     booking.title.toLowerCase().includes('warning')
                                   ));
                    
                    return (
                      <div
                        key={booking.id}
                        className={`p-3 rounded-lg border-l-4 ${
                          isAlert 
                            ? 'bg-red-900/40 border-red-500 shadow-lg animate-pulse' 
                            : isBookingActive(booking, currentTime)
                            ? 'bg-green-500/20 border-green-400'
                            : parseISO(booking.start) > currentTime
                            ? 'bg-slate-700/50 border-slate-500'
                            : 'bg-slate-600/30 border-slate-600'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2 mb-1">
                              <h3 className="text-lg font-semibold text-white truncate">
                                {isAlert && <span className="mr-1 text-red-300">⚠️</span>}
                                {booking.title}
                              </h3>
                              {isBookingActive(booking, currentTime) && (
                                <Badge className="bg-red-500 text-white animate-pulse text-xs px-1 py-0">
                                  <Radio className="w-2 h-2 mr-1" />
                                  LIVE
                                </Badge>
                              )}
                            </div>
                            <Badge 
                              variant={booking.status === 'confirmed' ? 'default' : 'secondary'}
                              className={`text-xs ${booking.status === 'confirmed' ? 'bg-green-600' : ''}`}
                            >
                              {booking.status.toUpperCase()}
                            </Badge>
                          </div>
                          <div 
                            className="w-3 h-12 rounded ml-2 flex-shrink-0"
                            style={{ backgroundColor: booking.color }}
                          />
                        </div>
                        <div className="text-base text-slate-300 mb-1 truncate">
                          {getStudioNames(booking, studios, bookingStudioLinks)}
                        </div>
                        <div className="text-base text-slate-400">
                          {formatFacilityTime(booking.start, 'h:mm a', facilityTimezone)} - {formatFacilityTime(booking.end, 'h:mm a', facilityTimezone)}
                        </div>
                        {booking.description && booking.description.trim() && (
                          <div className="text-sm text-slate-500 mt-1 truncate" title={booking.description}>
                            {booking.description}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Weekly Overview */}
          <Card className="bg-slate-800/50 border-slate-700 mt-6">
            <CardHeader>
              <CardTitle className="flex items-center text-white text-3xl">
                <Clock className="mr-4 h-8 w-8" />
                Week at a Glance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-2">
                {weeklyBookings.map(({ date, bookings }, index) => {
                  const dateString = format(date, 'yyyy-MM-dd');
                  const dayForecast = forecast?.forecast.find(f => f.date === dateString);
                  
                  // Debug logging for weather display
                  if (index === 0) {
                    console.log("[SIGNAGE WEATHER] Today's date string:", dateString);
                    console.log("[SIGNAGE WEATHER] Available forecast dates:", forecast?.forecast.map(f => f.date));
                    console.log("[SIGNAGE WEATHER] Today's forecast found:", !!dayForecast);
                    console.log("[SIGNAGE WEATHER] Today's forecast data:", dayForecast);
                  }
                  
                  return (
                    <div key={index} className="text-center">
                      <div className={`text-lg font-medium mb-1 ${
                        index === 0 ? 'text-blue-400' : 'text-slate-300'
                      }`}>
                        {formatFacilityTime(date, 'EEE', facilityTimezone)}
                      </div>
                      <div className={`text-2xl font-bold mb-1 ${
                        index === 0 ? 'text-blue-400' : 'text-white'
                      }`}>
                        {formatFacilityTime(date, 'd', facilityTimezone)}
                      </div>
                      
                      {/* Weather forecast for the day */}
                      <div className="mb-2 flex flex-col items-center">
                        {dayForecast ? (
                          <>
                            <img 
                              src={`https://openweathermap.org/img/w/${dayForecast.icon}.png`}
                              alt={dayForecast.condition}
                              className="w-8 h-8 mb-1"
                            />
                            <div className="text-xs text-slate-300">
                              {dayForecast.temperature.max}°/{dayForecast.temperature.min}°
                            </div>
                          </>
                        ) : index === 0 && weather ? (
                          // Show current weather for today if forecast data doesn't match
                          <>
                            <img 
                              src={`https://openweathermap.org/img/w/${weather.icon}.png`}
                              alt={weather.condition}
                              className="w-8 h-8 mb-1"
                            />
                            <div className="text-xs text-slate-300">
                              {weather.temperature}°
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="w-8 h-8 mb-1 flex items-center justify-center">
                              <span className="text-slate-500 text-lg">☁</span>
                            </div>
                            <div className="text-xs text-slate-500">
                              --/--
                            </div>
                          </>
                        )}
                      </div>
                      
                      <div className="space-y-1">
                      {bookings.map((booking) => {
                        const isAlert = booking.type === 'maintenance' || 
                                       booking.type === 'all-day:maintenance' ||
                                       booking.type === 'alert' ||
                                       (booking.title && (
                                         booking.title.toLowerCase().includes('alert') ||
                                         booking.title.toLowerCase().includes('outage') ||
                                         booking.title.toLowerCase().includes('emergency') ||
                                         booking.title.toLowerCase().includes('maintenance') ||
                                         booking.title.toLowerCase().includes('notice') ||
                                         booking.title.toLowerCase().includes('warning')
                                       ));
                        
                        return (
                          <div
                            key={booking.id}
                            className={`text-xs p-2 rounded text-white ${
                              isAlert 
                                ? 'animate-pulse border border-red-400 shadow-md' 
                                : ''
                            }`}
                            style={{ 
                              backgroundColor: isAlert 
                                ? (booking.severity === 'critical' ? '#dc2626' : '#ea580c')
                                : booking.color 
                            }}
                            title={`${booking.title} - ${formatFacilityTime(booking.start, 'h:mm a', facilityTimezone)} to ${formatFacilityTime(booking.end, 'h:mm a', facilityTimezone)}`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <div className="font-medium truncate flex-1">
                                {isAlert && (
                                  <span className="mr-1">⚠️</span>
                                )}
                                {booking.title}
                              </div>
                              <div className="flex items-center space-x-1 ml-2 flex-shrink-0">
                                {booking.status === 'confirmed' && (
                                  <div className="w-1.5 h-1.5 bg-green-400 rounded-full" title="Confirmed" />
                                )}
                                {booking.status === 'tentative' && (
                                  <div className="w-1.5 h-1.5 bg-yellow-400 rounded-full" title="Tentative" />
                                )}
                                {booking.status === 'cancelled' && (
                                  <div className="w-1.5 h-1.5 bg-red-400 rounded-full" title="Cancelled" />
                                )}
                              </div>
                            </div>
                            <div className={`flex items-center text-xs opacity-90 ${isAlert ? 'justify-center' : 'justify-between'}`}>
                              <span>{formatFacilityTime(booking.start, 'h:mm a', facilityTimezone)}-{formatFacilityTime(booking.end, 'h:mm a', facilityTimezone)}</span>
                              {!isAlert && (
                                <div className="flex items-center space-x-2">
                                  {booking.type === 'maintenance' && (
                                    <span className="bg-orange-600/50 px-1 rounded text-xs">MAINT</span>
                                  )}
                                  {/* Show studio names for regular bookings (not alerts) */}
                                  <span className="text-xs opacity-80">
                                    {getStudioNames(booking, studios, bookingStudioLinks)}
                                  </span>
                                </div>
                              )}
                              {isAlert && booking.type === 'maintenance' && (
                                <span className="bg-orange-600/50 px-1 rounded text-xs ml-2">MAINT</span>
                              )}
                            </div>
                            {booking.description && booking.description.trim() && (
                              <div className="text-xs opacity-80 mt-1 truncate">
                                {booking.description}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          {/* Studio Status */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="flex items-center text-white text-2xl">
                <Radio className="mr-4 h-6 w-6" />
                Studio Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                {studioStatus.map((studio) => (
                  <div key={studio.id} className="flex flex-col p-2 rounded-lg bg-slate-700/30">
                    <div className="flex items-center justify-between mb-1">
                      <div className="font-medium text-white text-lg truncate">{studio.name}</div>
                      <div className={`w-4 h-4 rounded-full flex-shrink-0 ${
                        studio.currentBooking ? 'bg-red-500' : 'bg-green-500'
                      }`} />
                    </div>
                    {studio.currentBooking ? (
                      <div className="text-base text-slate-400 truncate">
                        {studio.currentBooking.title}
                      </div>
                    ) : (
                      <div className="text-base text-green-400">Available</div>
                    )}
                    <div className="text-sm text-slate-500 mt-1">
                      {studio.currentBooking ? `Until ${studio.nextAvailable}` : 'Ready'}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>



          {/* Active Site Alerts */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="flex items-center text-white text-2xl">
                <AlertTriangle className="mr-4 h-6 w-6" />
                Active Site Alerts
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Show today's site alerts and upcoming maintenance */}
              {todaysAlerts.length > 0 || maintenanceAlerts.length > 0 ? (
                <div className="space-y-2">
                  {/* Combine and sort all alerts chronologically */}
                  {[
                    // Active alerts from today
                    ...todaysAlerts
                      .filter(alert => isBookingActive(alert, currentTime))
                      .map(alert => ({ ...alert, alertCategory: 'active' })),
                    
                    // Today's upcoming alerts  
                    ...todaysAlerts
                      .filter(alert => !isBookingActive(alert, currentTime) && parseISO(alert.start) > currentTime)
                      .map(alert => ({ ...alert, alertCategory: 'today' })),
                    
                    // Upcoming maintenance (next 7 days, excluding today and already shown active alerts)
                    ...maintenanceAlerts
                      .filter(alert => 
                        !isSameDay(parseISO(alert.start), today) && 
                        !todaysAlerts.some(todayAlert => todayAlert.id === alert.id)
                      )
                      .slice(0, 2)
                      .map(alert => ({ ...alert, alertCategory: 'upcoming' }))
                  ]
                  .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
                  .map(alert => {
                    if (alert.alertCategory === 'active') {
                      return (
                        <div key={`active-${alert.id}`} className="p-3 rounded-lg bg-red-900/60 border-2 border-red-500 shadow-lg animate-pulse">
                          <div className="flex items-center gap-2 mb-2">
                            <AlertTriangle className="h-4 w-4 text-red-300 animate-bounce" />
                            <div className="text-sm font-bold text-red-100 uppercase tracking-wide">ACTIVE ALERT</div>
                          </div>
                          <div className="text-lg font-semibold text-red-50 mb-1">{alert.title}</div>
                          <div className="text-sm text-red-200">
                            {formatFacilityTime(alert.start, 'h:mm a', facilityTimezone)} - {formatFacilityTime(alert.end, 'h:mm a', facilityTimezone)}
                          </div>
                          {alert.description && alert.description.trim() && (
                            <div className="text-sm text-red-300 mt-1">
                              {alert.description}
                            </div>
                          )}
                        </div>
                      );
                    } else if (alert.alertCategory === 'today') {
                      return (
                        <div key={`today-${alert.id}`} className="p-3 rounded-lg bg-orange-900/50 border-2 border-orange-500 shadow-md">
                          <div className="flex items-center gap-2 mb-2">
                            <AlertTriangle className="h-4 w-4 text-orange-300" />
                            <div className="text-sm font-bold text-orange-100 uppercase tracking-wide">UPCOMING</div>
                          </div>
                          <div className="text-lg font-semibold text-orange-50 mb-1">{alert.title}</div>
                          <div className="text-sm text-orange-200">
                            {formatFacilityTime(alert.start, 'MMM d, h:mm a', facilityTimezone)} - {formatFacilityTime(alert.end, 'h:mm a', facilityTimezone)}
                          </div>
                          {alert.description && alert.description.trim() && (
                            <div className="text-sm text-orange-300 mt-1">
                              {alert.description}
                            </div>
                          )}
                        </div>
                      );
                    } else {
                      return (
                        <div key={`upcoming-${alert.id}`} className="p-3 rounded-lg bg-yellow-900/40 border border-yellow-500 shadow-sm">
                          <div className="flex items-center gap-2 mb-2">
                            <AlertTriangle className="h-4 w-4 text-yellow-300" />
                            <div className="text-sm font-bold text-yellow-100 uppercase tracking-wide">UPCOMING</div>
                          </div>
                          <div className="text-base font-semibold text-yellow-50 mb-1">{alert.title}</div>
                          <div className="text-sm text-yellow-200">
                            {formatFacilityTime(alert.start, 'MMM d, h:mm a', facilityTimezone)} - {formatFacilityTime(alert.end, 'h:mm a', facilityTimezone)}
                          </div>
                          {alert.description && alert.description.trim() && (
                            <div className="text-sm text-yellow-300 mt-1">
                              {alert.description}
                            </div>
                          )}
                        </div>
                      );
                    }
                  })}
                </div>
              ) : (
                <div className="text-center py-4">
                  <div className="text-green-400 text-sm">No Active Alerts</div>
                  <div className="text-slate-400 text-xs mt-1">All systems operational</div>
                </div>
              )}
              
              {/* Auto-refresh indicator */}
              <div className="text-center text-slate-400 pt-3 mt-3 border-t border-slate-600">
                <div className="flex items-center justify-center space-x-2 mb-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-xs">Auto-updating every 2 minutes</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}