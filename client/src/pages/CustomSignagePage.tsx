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

// Parse URL parameters
function parseURLParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    studios: params.get('studios'),
    title: params.get('title'),
    weather: params.get('weather')
  };
}

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
  
  return isActive && booking.status !== 'cancelled';
}

function getNextAvailable(studioId: number, bookings: Booking[], bookingStudioLinks: BookingStudioLink[], timezone: string) {
  const now = getFacilityTime(timezone);
  const studioBookings = bookings.filter(booking => {
    if (booking.studioId === studioId) return true;
    return bookingStudioLinks.some(link => link.studioId === studioId && link.bookingId === booking.id);
  }).sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  
  // Check if currently in use
  const activeBooking = studioBookings.find(booking => isBookingActive(booking, now));
  if (activeBooking) {
    return formatFacilityTime(activeBooking.end, 'h:mm a', timezone);
  }
  
  // Find next booking
  const nextBooking = studioBookings.find(booking => new Date(booking.start) > now);
  if (nextBooking) {
    return formatFacilityTime(nextBooking.start, 'h:mm a', timezone);
  }
  
  return 'Available';
}

export default function CustomSignagePage() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [facilityTimezone, setFacilityTimezone] = useState(BUILD_TIME_TIMEZONE);
  const { siteName } = useSiteSettings();
  
  // Weather state (using same structure as main signage page)
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [forecast, setForecast] = useState<WeatherForecast | null>(null);

  // Parse URL parameters
  const { studios: studioParam, title: titleParam, weather: weatherParam } = parseURLParams();
  
  // Determine if weather should be shown (default: true unless explicitly disabled)
  const showWeather = weatherParam !== 'false';
  
  console.log("[SIGNAGE] URL Parameters:", { studioParam, titleParam, weatherParam });
  console.log("[SIGNAGE DEBUG] showWeather:", showWeather);
  console.log("[SIGNAGE DEBUG] weather state:", weather);
  console.log("[SIGNAGE DEBUG] forecast state:", forecast);

  // Filter studios based on URL parameter
  const targetStudioIds = studioParam ? studioParam.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id)) : [];

  const { data: bookings = [] } = useQuery<Booking[]>({
    queryKey: ["/api/public/bookings"],
    refetchInterval: 2 * 60 * 1000, // 2 minutes
  });

  const { data: studios = [] } = useQuery<Studio[]>({
    queryKey: ["/api/studios"],
    refetchInterval: 2 * 60 * 1000,
  });

  const { data: bookingStudioLinks = [] } = useQuery<BookingStudioLink[]>({
    queryKey: ["/api/public/booking-studios"],
    refetchInterval: 2 * 60 * 1000,
  });

  const { data: alerts = [] } = useQuery({
    queryKey: ["/api/alerts"],
    refetchInterval: 2 * 60 * 1000,
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const loadTimezone = async () => {
      try {
        const tz = await getFacilityTimezoneAsync();
        setFacilityTimezone(tz);
      } catch (error) {
        console.error('Error loading timezone:', error);
      }
    };
    loadTimezone();
  }, []);

  // Weather data fetching (using same logic as main signage page)
  useEffect(() => {
    if (!showWeather) return;

    const fetchWeatherData = async () => {
      try {
        const API_KEY = import.meta.env.VITE_OPENWEATHER_API_KEY;
        const location = import.meta.env.VITE_WEATHER_LOCATION || 'Hendersonville,TN,US';
        
        if (!API_KEY) {
          console.log("[CUSTOM SIGNAGE WEATHER] No API key available");
          return;
        }

        console.log("[CUSTOM SIGNAGE WEATHER] Fetching weather for:", location);

        // Fetch both current weather and forecast simultaneously
        const [currentResponse, forecastResponse] = await Promise.all([
          fetch(`https://api.openweathermap.org/data/2.5/weather?q=${location}&appid=${API_KEY}&units=imperial`),
          fetch(`https://api.openweathermap.org/data/2.5/forecast?q=${location}&appid=${API_KEY}&units=imperial`)
        ]);

        let currentWeatherData = null;
        if (currentResponse.ok) {
          const currentData = await currentResponse.json();
          console.log("[CUSTOM SIGNAGE WEATHER] Current weather data:", currentData);
          
          currentWeatherData = {
            temperature: Math.round(currentData.main.temp),
            condition: currentData.weather[0].description,
            humidity: currentData.main.humidity,
            windSpeed: Math.round(currentData.wind?.speed || 0),
            icon: currentData.weather[0].icon,
            location: currentData.name
          };
          setWeather(currentWeatherData);
          console.log("[CUSTOM SIGNAGE WEATHER] Weather state updated");
        } else {
          console.error("[CUSTOM SIGNAGE WEATHER] Current weather API failed:", currentResponse.status);
        }

        if (forecastResponse.ok) {
          const forecastData = await forecastResponse.json();
          console.log("[CUSTOM SIGNAGE WEATHER] Forecast data received:", forecastData);
          
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
          
          console.log("[CUSTOM SIGNAGE WEATHER] Daily data grouped:", Array.from(dailyData.keys()));
          
          // Create daily forecasts with proper min/max calculations
          const dailyForecasts: ForecastDay[] = [];
          
          // Filter out past dates and only include today and future dates
          // Use the same date calculation as the weekly view to ensure consistency
          const now = new Date();
          const facilityNow = toZonedTime(now, facilityTimezone);
          const today = format(facilityNow, 'yyyy-MM-dd');
          console.log("[CUSTOM SIGNAGE WEATHER] Today's date for filtering:", today);
          console.log("[CUSTOM SIGNAGE WEATHER] Current UTC time:", now.toISOString());
          console.log("[CUSTOM SIGNAGE WEATHER] Current facility time:", facilityNow.toISOString());
          
          const futureDates = Array.from(dailyData.entries())
            .filter(([dateString]) => dateString >= today)
            .slice(0, 7);
          
          console.log("[CUSTOM SIGNAGE WEATHER] Filtered future dates:", futureDates.map(([date]) => date));
          
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
          
          console.log("[CUSTOM SIGNAGE WEATHER] Daily forecasts created:", dailyForecasts);
          setForecast({ forecast: dailyForecasts });
          console.log("[CUSTOM SIGNAGE WEATHER] Forecast state updated");
        } else {
          console.error("[CUSTOM SIGNAGE WEATHER] Forecast API failed:", forecastResponse.status, await forecastResponse.text());
        }
      } catch (error) {
        console.error("[CUSTOM SIGNAGE WEATHER] Weather API error:", error);
        // Continue without weather data if API unavailable
      }
    };

    // Fetch weather immediately and then every 5 minutes
    fetchWeatherData();
    const weatherTimer = setInterval(fetchWeatherData, 300000);
    return () => clearInterval(weatherTimer);
  }, [showWeather]);



  // Combine bookings and alerts
  const combinedBookings = useMemo(() => {
    const alertBookings = alerts.map((alert: any) => ({
      ...alert,
      studioId: null,
      color: alert.severity === 'critical' ? '#dc2626' : '#ea580c'
    }));
    return [...bookings, ...alertBookings];
  }, [bookings, alerts]);

  // Filter bookings based on selected studios
  const filteredBookings = targetStudioIds.length > 0 ? combinedBookings.filter(booking => {
    // Always include facility alerts (no studio assignment)
    if (!booking.studioId) return true;
    
    if (booking.studioId && targetStudioIds.includes(booking.studioId)) {
      return true;
    }
    return bookingStudioLinks.some(link => 
      link.bookingId === booking.id && targetStudioIds.includes(link.studioId)
    );
  }) : combinedBookings;

  // Get today's data in facility timezone
  const today = getFacilityTime(facilityTimezone);
  const todayStart = fromZonedTime(
    new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0),
    facilityTimezone
  );
  const todayEnd = fromZonedTime(
    new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59),
    facilityTimezone
  );

  // Get today's bookings
  const todaysBookings = filteredBookings.filter(booking => {
    const bookingStart = parseISO(booking.start);
    const bookingEnd = parseISO(booking.end);
    
    // Check if booking overlaps with today
    return bookingStart < todayEnd && bookingEnd > todayStart;
  }).sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  // Get weekly bookings
  const weeklyBookings = useMemo(() => {
    const weekStart = startOfDay(today);
    const days = [];
    
    for (let i = 0; i < 7; i++) {
      const day = addDays(weekStart, i);
      const dayStart = fromZonedTime(
        new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0),
        facilityTimezone
      );
      const dayEnd = fromZonedTime(
        new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59),
        facilityTimezone
      );
      
      const dayBookings = filteredBookings.filter(booking => {
        const bookingStart = parseISO(booking.start);
        const bookingEnd = parseISO(booking.end);
        return bookingStart < dayEnd && bookingEnd > dayStart;
      }).sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
      
      days.push({
        date: day,
        bookings: dayBookings
      });
    }
    
    return days;
  }, [filteredBookings, today, facilityTimezone]);

  // Get studio status
  const studioStatus = studios.map(studio => {
    const activeBooking = filteredBookings.find(booking => {
      if (booking.studioId === studio.id) {
        return isBookingActive(booking, getCurrentFacilityTime(facilityTimezone));
      }
      return bookingStudioLinks.some(link => 
        link.studioId === studio.id && 
        link.bookingId === booking.id &&
        isBookingActive(booking, getCurrentFacilityTime(facilityTimezone))
      );
    });

    return {
      ...studio,
      currentBooking: activeBooking,
      nextAvailable: getNextAvailable(studio.id, filteredBookings, bookingStudioLinks, facilityTimezone),
    };
  });

  // Get maintenance alerts from combined data
  const maintenanceAlerts = filteredBookings.filter(booking => {
    const isMaintenanceType = booking.type === 'maintenance' || booking.type === 'all-day:maintenance';
    return isMaintenanceType && 
           parseISO(booking.start) >= today &&
           parseISO(booking.start) <= addDays(today, 7);
  });

  const pageTitle = titleParam || siteName;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-10">
        <div className="flex items-center space-x-6">
          <div className="text-6xl font-bold text-white drop-shadow-lg">{pageTitle}</div>
          <Badge variant="outline" className="text-xl px-6 py-3 bg-blue-500/20 text-blue-300 border-blue-400 font-semibold">
            LIVE DISPLAY
          </Badge>
        </div>
        <div className="text-right text-white">
          <div className="flex items-center justify-end space-x-6">
            {/* Weather Info */}
            {showWeather && (
              <div className="text-center">
                {weather ? (
                  <>
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
                  </>
                ) : (
                  <div className="text-center">
                    <div className="w-12 h-12 bg-slate-600 rounded mb-1 mx-auto animate-pulse"></div>
                    <div className="text-lg text-slate-400">Loading weather...</div>
                  </div>
                )}
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
                          {booking.studioId ? getStudioNames(booking, studios, bookingStudioLinks) : 'Facility Alert'}
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
                  const dateString = formatFacilityTime(date, 'yyyy-MM-dd', facilityTimezone);
                  const dayForecast = forecast?.forecast.find(f => f.date === dateString);
                  
                  // Debug logging for weather forecast availability
                  if (index === 0) {
                    console.log("[SIGNAGE WEATHER] Available forecast dates:", forecast?.forecast.map(f => f.date) || []);
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
                      {showWeather && (
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
                      )}
                      
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

        {/* Studio Status */}
        <div className="xl:col-span-1">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="flex items-center text-white text-3xl">
                <Radio className="mr-4 h-8 w-8" />
                Studio Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                {studioStatus
                  .filter(studio => targetStudioIds.length === 0 || targetStudioIds.includes(studio.id))
                  .map((studio) => (
                  <div key={studio.id} className="p-3 rounded-lg bg-slate-700/30">
                    <div className="flex flex-col space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="text-lg font-semibold text-white truncate">
                          {studio.name}
                        </div>
                        <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                          studio.currentBooking ? 'bg-red-500' : 'bg-green-500'
                        }`} />
                      </div>
                      <div className="text-sm text-slate-300">
                        {studio.currentBooking ? (
                          <>
                            <div className="font-medium text-white truncate">{studio.currentBooking.title}</div>
                            <div className="text-xs text-slate-400">
                              Until {studio.nextAvailable}
                            </div>
                          </>
                        ) : (
                          <span className="text-green-400">Available</span>
                        )}
                      </div>
                      {!studio.currentBooking && studio.nextAvailable !== 'Available' && (
                        <div className="text-xs text-slate-400">
                          Next: {studio.nextAvailable}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Active Site Alerts */}
          <Card className="bg-slate-800/50 border-slate-700 mt-6">
            <CardHeader>
              <CardTitle className="flex items-center text-white text-3xl">
                <AlertTriangle className="mr-4 h-8 w-8" />
                Active Site Alerts
              </CardTitle>
            </CardHeader>
            <CardContent>
              {maintenanceAlerts.length === 0 ? (
                <div className="text-center py-8 text-slate-400">
                  <AlertTriangle className="mx-auto h-12 w-12 mb-3 opacity-50" />
                  <p className="text-lg">No active alerts</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {maintenanceAlerts.map((alert) => (
                    <div
                      key={alert.id}
                      className="p-3 rounded-lg bg-red-900/40 border border-red-500/50 animate-pulse"
                    >
                      <div className="flex items-start space-x-2">
                        <AlertTriangle className="h-5 w-5 text-red-400 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <div className="text-lg font-semibold text-white">
                            {alert.title}
                          </div>
                          <div className="text-sm text-slate-300">
                            {formatFacilityTime(alert.start, 'MMM d, h:mm a', facilityTimezone)} - {formatFacilityTime(alert.end, 'h:mm a', facilityTimezone)}
                          </div>
                          {alert.description && alert.description.trim() && (
                            <div className="text-sm text-slate-400 mt-1">
                              {alert.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}