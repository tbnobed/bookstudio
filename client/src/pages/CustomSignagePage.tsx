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
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [forecast, setForecast] = useState<WeatherForecast | null>(null);
  const { siteName } = useSiteSettings();

  // Parse URL parameters
  const { studios: studioParam, title: titleParam, weather: weatherParam } = parseURLParams();

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

  // Get facility timezone
  useEffect(() => {
    const loadTimezone = async () => {
      try {
        const timezone = await getFacilityTimezoneAsync();
        setFacilityTimezone(timezone);
      } catch (error) {
        console.error('Error loading timezone:', error);
      }
    };
    loadTimezone();
  }, []);

  // Update current time
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);

  // Weather fetching
  useEffect(() => {
    const API_KEY = import.meta.env.VITE_OPENWEATHER_API_KEY;
    const WEATHER_LOCATION = import.meta.env.VITE_WEATHER_LOCATION;
    
    if (!API_KEY || !WEATHER_LOCATION) {
      console.log('Weather API key or location not configured');
      return;
    }

    const fetchWeather = async () => {
      try {
        const response = await fetch(`https://api.openweathermap.org/data/2.5/weather?q=${WEATHER_LOCATION}&appid=${API_KEY}&units=imperial`);
        if (response.ok) {
          const data = await response.json();
          setWeather({
            temperature: Math.round(data.main.temp),
            condition: data.weather[0].description,
            humidity: data.main.humidity,
            windSpeed: Math.round(data.wind.speed),
            icon: data.weather[0].icon,
            location: data.name
          });
        }
      } catch (error) {
        console.error('Error fetching weather:', error);
      }
    };

    const fetchForecast = async () => {
      try {
        const response = await fetch(`https://api.openweathermap.org/data/2.5/forecast?q=${WEATHER_LOCATION}&appid=${API_KEY}&units=imperial`);
        if (response.ok) {
          const data = await response.json();
          
          const forecastDays: ForecastDay[] = [];
          const processedDates = new Set<string>();
          
          for (const item of data.list) {
            const dateStr = format(new Date(item.dt * 1000), 'yyyy-MM-dd');
            
            if (!processedDates.has(dateStr) && forecastDays.length < 7) {
              forecastDays.push({
                date: dateStr,
                temperature: {
                  min: Math.round(item.main.temp_min),
                  max: Math.round(item.main.temp_max)
                },
                condition: item.weather[0].description,
                icon: item.weather[0].icon
              });
              processedDates.add(dateStr);
            }
          }
          
          setForecast({ forecast: forecastDays });
        }
      } catch (error) {
        console.error('Error fetching forecast:', error);
      }
    };

    fetchWeather();
    fetchForecast();
    
    // Refresh every 10 minutes
    const interval = setInterval(() => {
      fetchWeather();
      fetchForecast();
    }, 10 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [facilityTimezone, weatherParam]);

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
  const showWeather = weatherParam !== 'false';

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
            {weather && showWeather && (
              <div className="text-center">
                <div className="flex items-center justify-center space-x-2 mb-1">
                  <img 
                    src={`https://openweathermap.org/img/w/${weather.icon}.png`}
                    alt={weather.condition}
                    className="w-12 h-12"
                  />
                  <span className="text-4xl font-bold">{weather.temperature}°F</span>
                </div>
                <div className="text-lg text-slate-300 capitalize">{weather.condition}</div>
                <div className="text-sm text-slate-400">
                  Humidity: {weather.humidity}% • Wind: {weather.windSpeed} mph
                </div>
              </div>
            )}
            {/* Current Time */}
            <div className="text-center">
              <div className="text-4xl font-bold">
                {formatFacilityTime(currentTime, 'h:mm a', facilityTimezone)}
              </div>
              <div className="text-lg text-slate-300">
                {formatFacilityTime(currentTime, 'EEEE, MMMM d, yyyy', facilityTimezone)}
              </div>
              <div className="text-sm text-slate-400">
                Central Time
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Today's Schedule */}
        <div className="lg:col-span-2">
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {todaysBookings.map((booking) => (
                    <div
                      key={booking.id}
                      className="p-4 rounded-lg border border-slate-600 bg-slate-700/30"
                      style={{
                        borderLeftColor: booking.color,
                        borderLeftWidth: '4px'
                      }}
                    >
                      <div className="flex flex-col space-y-2">
                        <div className="text-lg font-semibold text-white">
                          {booking.title}
                        </div>
                        
                        <div className="flex items-center text-slate-300 text-sm">
                          <Clock className="mr-2 h-4 w-4" />
                          {formatFacilityTime(booking.start, 'h:mm a', facilityTimezone)} - {formatFacilityTime(booking.end, 'h:mm a', facilityTimezone)}
                        </div>
                        
                        {booking.studioId && (
                          <div className="flex items-center text-slate-300 text-sm">
                            <Radio className="mr-2 h-4 w-4" />
                            {getStudioNames(booking, studios, bookingStudioLinks)}
                          </div>
                        )}
                        
                        {booking.description && booking.description.trim() && (
                          <div className="text-sm text-slate-400">
                            {booking.description}
                          </div>
                        )}
                        
                        <div className="flex items-center justify-between">
                          <Badge 
                            variant={booking.status === 'confirmed' ? 'default' : 'secondary'}
                            className={`
                              ${booking.status === 'confirmed' ? 'bg-green-500/20 text-green-300 border-green-500/50' : ''}
                              ${booking.status === 'tentative' ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/50' : ''}
                              ${booking.status === 'cancelled' ? 'bg-red-500/20 text-red-300 border-red-500/50' : ''}
                            `}
                          >
                            {booking.status.toUpperCase()}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Studio Status */}
        <div>
          <Card className="bg-slate-800/50 border-slate-700 mb-6">
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
                    <div
                      key={studio.id}
                      className="p-3 rounded-lg border border-slate-600 bg-slate-700/30"
                    >
                      <div className="flex flex-col space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-white text-sm">{studio.name}</span>
                          <div className={`w-3 h-3 rounded-full ${
                            studio.currentBooking ? 'bg-red-500' : 'bg-green-500'
                          }`} />
                        </div>
                        
                        <div className="text-xs text-slate-300">
                          {studio.currentBooking ? (
                            <>
                              <div className="font-medium">{studio.currentBooking.title}</div>
                              <div className="text-slate-400">Until {studio.nextAvailable}</div>
                            </>
                          ) : (
                            <div className="text-green-400 font-medium">Available</div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>

          {/* Active Site Alerts */}
          <Card className="bg-slate-800/50 border-slate-700">
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
                  )}
                  
                  <div className="space-y-1">
                    {bookings.map((booking) => {
                      const isAlert = booking.type === 'maintenance' || 
                                     booking.type === 'all-day:maintenance' ||
                                     !booking.studioId;
                      
                      return (
                        <div
                          key={booking.id}
                          className={`p-1 rounded text-xs text-white ${
                            isAlert ? 'bg-red-600/80' : 'bg-blue-600/80'
                          }`}
                          style={!isAlert ? { backgroundColor: `${booking.color}80` } : {}}
                        >
                          <div className="font-medium truncate">
                            {booking.title}
                          </div>
                          <div className="text-xs opacity-90">
                            {formatFacilityTime(booking.start, 'h:mm a', facilityTimezone)}
                          </div>
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
  );
}