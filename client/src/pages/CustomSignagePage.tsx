import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Calendar, Radio, AlertTriangle } from "lucide-react";
import { format, isWithinInterval, addDays, startOfDay, endOfDay, parseISO, isSameDay } from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";
import { getFacilityTimezoneAsync } from "@/lib/timezoneConfig";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { useSearch } from 'wouter';

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
  const now = new Date();
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
  return new Date();
}

function getStudioNames(booking: Booking, studios: Studio[], bookingStudioLinks: BookingStudioLink[]) {
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

function isBookingActive(booking: Booking, currentTime: Date): boolean {
  const start = parseISO(booking.start);
  const end = parseISO(booking.end);
  return currentTime >= start && currentTime <= end;
}

function getNextAvailable(studioId: number, bookings: Booking[], bookingStudioLinks: BookingStudioLink[], timezone: string) {
  const currentTime = getCurrentFacilityTime(timezone);
  const futureBookings = bookings
    .filter(booking => {
      const isDirectStudio = booking.studioId === studioId;
      const hasLink = bookingStudioLinks.some(link => link.studioId === studioId && link.bookingId === booking.id);
      return (isDirectStudio || hasLink) && parseISO(booking.start) > currentTime;
    })
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  if (futureBookings.length > 0) {
    return formatFacilityTime(futureBookings[0].start, 'h:mm a', timezone);
  }
  
  return 'Ready';
}

export default function CustomSignagePage() {
  const search = useSearch();
  const searchParams = new URLSearchParams(search);
  
  // Parse URL parameters
  const studioIds = searchParams.get('studios');
  const customTitle = searchParams.get('title');
  const showWeather = searchParams.get('weather') !== 'false';
  const showAlerts = searchParams.get('alerts') !== 'false';
  const showWeekly = searchParams.get('weekly') !== 'false';

  const title = decodeURIComponent(customTitle || 'Custom Display');

  const [currentTime, setCurrentTime] = useState(new Date());
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [forecast, setForecast] = useState<WeatherForecast | null>(null);
  const [facilityTimezone, setFacilityTimezone] = useState<string>(BUILD_TIME_TIMEZONE);

  const { siteName } = useSiteSettings();

  // Fetch timezone
  useEffect(() => {
    const fetchTimezone = async () => {
      const timezone = await getFacilityTimezoneAsync();
      setFacilityTimezone(timezone);
    };
    fetchTimezone();
  }, []);

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch weather data
  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const apiKey = import.meta.env.VITE_OPENWEATHER_API_KEY;
        if (!apiKey) return;

        const location = import.meta.env.VITE_WEATHER_LOCATION || 'Dallas,TX,US';
        
        const currentResponse = await fetch(
          `https://api.openweathermap.org/data/2.5/weather?q=${location}&appid=${apiKey}&units=imperial`
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

        const forecastResponse = await fetch(
          `https://api.openweathermap.org/data/2.5/forecast?q=${location}&appid=${apiKey}&units=imperial`
        );
        
        if (forecastResponse.ok) {
          const forecastData = await forecastResponse.json();
          const dailyForecasts: { [key: string]: any } = {};
          
          forecastData.list.forEach((item: any) => {
            const facilityDateTime = toZonedTime(new Date(item.dt * 1000), facilityTimezone);
            const dateKey = format(facilityDateTime, 'yyyy-MM-dd');
            
            if (!dailyForecasts[dateKey]) {
              dailyForecasts[dateKey] = {
                temps: [],
                conditions: [],
                icons: []
              };
            }
            
            dailyForecasts[dateKey].temps.push(item.main.temp);
            dailyForecasts[dateKey].conditions.push(item.weather[0].description);
            dailyForecasts[dateKey].icons.push(item.weather[0].icon);
          });

          const forecastArray = Object.entries(dailyForecasts).map(([date, data]: [string, any]) => ({
            date,
            temperature: {
              min: Math.round(Math.min(...data.temps)),
              max: Math.round(Math.max(...data.temps))
            },
            condition: data.conditions[0],
            icon: data.icons[0]
          }));

          setForecast({ forecast: forecastArray });
        }
      } catch (error) {
        console.error('Weather fetch error:', error);
      }
    };

    if (showWeather) {
      fetchWeather();
      const weatherTimer = setInterval(fetchWeather, 300000); // Update every 5 minutes
      return () => clearInterval(weatherTimer);
    }
  }, [facilityTimezone, showWeather]);

  // Fetch bookings data
  const { data: bookings = [] } = useQuery<Booking[]>({
    queryKey: ['/api/public/bookings'],
  });

  const { data: studios = [] } = useQuery<Studio[]>({
    queryKey: ['/api/studios'],
  });

  const { data: bookingStudioLinks = [] } = useQuery<BookingStudioLink[]>({
    queryKey: ['/api/public/booking-studios'],
  });

  const { data: alerts = [] } = useQuery({
    queryKey: ['/api/alerts'],
  });

  // Filter studios based on URL parameter
  const filteredStudios = useMemo(() => {
    return studioIds 
      ? studios.filter(studio => 
          studioIds.split(',').map(id => parseInt(id.trim())).includes(studio.id)
        )
      : studios;
  }, [studios, studioIds]);

  // Create combined bookings and alerts data
  const combinedBookings = useMemo(() => [...bookings, ...alerts], [bookings, alerts]);

  // Calculate timezone-aware "today" for facility timezone
  const today = useMemo(() => {
    const nowInFacility = toZonedTime(new Date(), facilityTimezone);
    return fromZonedTime(startOfDay(nowInFacility), facilityTimezone);
  }, [facilityTimezone]);

  const todayEnd = useMemo(() => {
    const nowInFacility = toZonedTime(new Date(), facilityTimezone);
    return fromZonedTime(endOfDay(nowInFacility), facilityTimezone);
  }, [facilityTimezone]);

  // Filter today's bookings with studio filter
  const todaysBookings = useMemo(() => {
    return combinedBookings.filter(booking => {
      const bookingStart = parseISO(booking.start);
      const withinToday = isWithinInterval(bookingStart, { start: today, end: todayEnd });
      
      if (!withinToday) return false;
      
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
  }, [combinedBookings, today, todayEnd, studioIds, bookingStudioLinks]);

  // Filter today's alerts for site alerts section
  const todaysAlerts = useMemo(() => {
    return combinedBookings.filter(booking => {
      const bookingStart = parseISO(booking.start);
      const isMaintenanceType = booking.type === 'maintenance' || booking.type === 'all-day:maintenance';
      const hasAlertKeyword = booking.title && (
        booking.title.toLowerCase().includes('alert') ||
        booking.title.toLowerCase().includes('outage') ||
        booking.title.toLowerCase().includes('emergency') ||
        booking.title.toLowerCase().includes('maintenance') ||
        booking.title.toLowerCase().includes('notice') ||
        booking.title.toLowerCase().includes('warning')
      );
      return isWithinInterval(bookingStart, { start: today, end: todayEnd }) && (isMaintenanceType || hasAlertKeyword);
    }).sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  }, [combinedBookings, today, todayEnd]);

  // Get weekly overview (next 7 days) - use proper timezone boundaries
  const weeklyBookings = useMemo(() => {
    const nowInFacility = toZonedTime(new Date(), facilityTimezone);
    
    return Array.from({ length: 7 }, (_, i) => {
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
  }, [combinedBookings, facilityTimezone]);

  // Get current studio status
  const studioStatus = useMemo(() => {
    return filteredStudios.map(studio => {
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
  }, [filteredStudios, combinedBookings, bookingStudioLinks, currentTime, facilityTimezone]);

  // Get maintenance alerts from combined data
  const maintenanceAlerts = useMemo(() => {
    return combinedBookings.filter(booking => {
      const isMaintenanceType = booking.type === 'maintenance' || booking.type === 'all-day:maintenance';
      return isMaintenanceType && 
             parseISO(booking.start) >= today &&
             parseISO(booking.start) <= addDays(today, 7);
    });
  }, [combinedBookings, today]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-10">
        <div className="flex items-center space-x-6">
          <div className="text-6xl font-bold text-white drop-shadow-lg">{title}</div>
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
                Today&apos;s Schedule
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
                          {!isAlert && getStudioNames(booking, studios, bookingStudioLinks)}
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
          {showWeekly && (
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
          )}
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
          {showAlerts && (
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
                        .map(alert => ({ ...alert, alertCategory: 'upcoming' }))
                    ]
                      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
                      .map((alert) => {
                        if (alert.alertCategory === 'active') {
                          return (
                            <div key={`active-${alert.id}`} className="p-3 rounded-lg bg-red-900/60 border-2 border-red-400 shadow-lg animate-pulse">
                              <div className="flex items-center gap-2 mb-2">
                                <AlertTriangle className="h-4 w-4 text-red-200" />
                                <div className="text-sm font-bold text-red-100 uppercase tracking-wide">ACTIVE NOW</div>
                              </div>
                              <div className="text-lg font-semibold text-red-50 mb-1">{alert.title}</div>
                              <div className="text-sm text-red-200">
                                {formatFacilityTime(alert.start, 'MMM d, h:mm a', facilityTimezone)} - {formatFacilityTime(alert.end, 'h:mm a', facilityTimezone)}
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
                  <div className="text-center py-8 text-slate-400">
                    <AlertTriangle className="mx-auto h-12 w-12 mb-3 opacity-50" />
                    <p className="text-lg">No active alerts</p>
                    <p className="text-sm">All systems operational</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}