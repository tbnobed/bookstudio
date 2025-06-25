import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Calendar, Radio, AlertTriangle } from "lucide-react";
import { format, isWithinInterval, addDays, startOfDay, endOfDay, parseISO, isSameDay } from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";

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

const FACILITY_TIMEZONE = 'America/Chicago';

function getChicagoTime() {
  // Get current time in Chicago timezone
  const now = new Date();
  // Convert UTC time to Chicago time
  return toZonedTime(now, FACILITY_TIMEZONE);
}

function formatChicagoTime(date: Date | string, formatStr: string) {
  let chicagoDate;
  if (typeof date === 'string') {
    chicagoDate = toZonedTime(parseISO(date), FACILITY_TIMEZONE);
  } else {
    chicagoDate = toZonedTime(date, FACILITY_TIMEZONE);
  }
  return format(chicagoDate, formatStr, { timeZone: FACILITY_TIMEZONE });
}

function getCurrentChicagoTime() {
  // Get current time and create a proper Chicago timezone date
  const now = new Date();
  // This creates a new Date object representing the current time in Chicago
  const chicagoTime = new Date(now.toLocaleString("en-US", { timeZone: FACILITY_TIMEZONE }));
  return chicagoTime;
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
  return isWithinInterval(now, { start, end });
}

function getNextAvailable(studioId: number, bookings: Booking[], bookingStudioLinks: BookingStudioLink[]) {
  const now = getChicagoTime();
  const studioBookings = bookings.filter(booking => {
    if (booking.studioId === studioId) return true;
    return bookingStudioLinks.some(link => link.studioId === studioId && link.bookingId === booking.id);
  }).sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  
  // Check if currently in use
  const activeBooking = studioBookings.find(booking => isBookingActive(booking, now));
  if (activeBooking) {
    return formatChicagoTime(activeBooking.end, 'h:mm a');
  }
  
  // Find next booking
  const nextBooking = studioBookings.find(booking => parseISO(booking.start) > now);
  if (nextBooking) {
    return formatChicagoTime(nextBooking.start, 'h:mm a');
  }
  
  return 'Available';
}

export default function SignagePage() {
  const [currentTime, setCurrentTime] = useState(getCurrentChicagoTime());
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [forecast, setForecast] = useState<WeatherForecast | null>(null);
  
  // Auto-refresh time every 30 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(getCurrentChicagoTime());
    }, 30000);
    
    return () => clearInterval(timer);
  }, []);
  
  // Fetch weather data and forecast
  useEffect(() => {
    const fetchWeatherData = async () => {
      try {
        const apiKey = import.meta.env.VITE_OPENWEATHER_API_KEY;
        
        if (!apiKey) {
          return;
        }

        // Fetch current weather
        const currentResponse = await fetch(
          `https://api.openweathermap.org/data/2.5/weather?q=Dallas,TX,US&appid=${apiKey}&units=imperial`
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

        // Fetch 7-day forecast
        const forecastResponse = await fetch(
          `https://api.openweathermap.org/data/2.5/forecast?q=Dallas,TX,US&appid=${apiKey}&units=imperial`
        );
        
        if (forecastResponse.ok) {
          const forecastData = await forecastResponse.json();
          
          // Process forecast data - get daily forecasts
          const dailyForecasts: ForecastDay[] = [];
          const processedDates = new Set<string>();
          
          forecastData.list.forEach((item: any) => {
            const date = new Date(item.dt * 1000);
            const dateString = format(date, 'yyyy-MM-dd');
            
            if (!processedDates.has(dateString) && dailyForecasts.length < 7) {
              dailyForecasts.push({
                date: dateString,
                temperature: {
                  min: Math.round(item.main.temp_min),
                  max: Math.round(item.main.temp_max)
                },
                condition: item.weather[0].description,
                icon: item.weather[0].icon
              });
              processedDates.add(dateString);
            }
          });
          
          console.log("Weather debug - Forecast data:", dailyForecasts.length + " days");
          setForecast({ forecast: dailyForecasts });
        }
      } catch (error) {
        console.error("Weather debug - Error:", error);
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
  });

  const { data: studios = [] } = useQuery<Studio[]>({
    queryKey: ['/api/studios'],
    refetchInterval: 60000,
  });

  const { data: bookingStudioLinks = [] } = useQuery<BookingStudioLink[]>({
    queryKey: ['/api/public/booking-studios'],
    refetchInterval: 60000,
  });

  // Filter today's bookings and alerts
  const today = startOfDay(currentTime);
  const todayEnd = endOfDay(currentTime);
  const todaysBookings = bookings.filter(booking => {
    const bookingStart = parseISO(booking.start);
    const isMaintenanceType = booking.type === 'maintenance' || booking.type === 'all-day:maintenance';
    return isWithinInterval(bookingStart, { start: today, end: todayEnd }) && !isMaintenanceType;
  }).sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  // Get today's site alerts (maintenance type bookings and alert keywords)
  const todaysAlerts = bookings.filter(booking => {
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
  }).sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  // Get weekly overview (next 7 days)
  const weeklyBookings = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(today, i);
    const dayEnd = endOfDay(date);
    const dayBookings = bookings.filter(booking => {
      const bookingStart = parseISO(booking.start);
      return isWithinInterval(bookingStart, { start: date, end: dayEnd });
    });
    return {
      date,
      bookings: dayBookings,
    };
  });

  // Get current studio status
  const studioStatus = studios.map(studio => {
    const activeBooking = bookings.find(booking => {
      const isDirectStudio = booking.studioId === studio.id;
      const hasLink = bookingStudioLinks.some(link => link.studioId === studio.id && link.bookingId === booking.id);
      return (isDirectStudio || hasLink) && isBookingActive(booking, currentTime);
    });

    return {
      ...studio,
      currentBooking: activeBooking,
      nextAvailable: getNextAvailable(studio.id, bookings, bookingStudioLinks),
    };
  });

  // Get maintenance alerts
  const maintenanceAlerts = bookings.filter(booking => {
    const isMaintenanceType = booking.type === 'maintenance' || booking.type === 'all-day:maintenance';
    return isMaintenanceType && 
           parseISO(booking.start) >= today &&
           parseISO(booking.start) <= addDays(today, 7);
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center space-x-4">
          <div className="text-4xl font-bold text-white">The Plex Studios</div>
          <Badge variant="outline" className="text-lg px-4 py-2 bg-blue-500/20 text-blue-300 border-blue-400">
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
                  <div className="text-2xl font-bold">{weather.temperature}°F</div>
                </div>
                <div className="text-sm text-slate-300 capitalize">{weather.condition}</div>
                <div className="text-xs text-slate-400">{weather.location}</div>
              </div>
            )}
            
            {/* Time Info */}
            <div>
              <div className="text-3xl font-bold">
                {new Date().toLocaleTimeString('en-US', { 
                  timeZone: FACILITY_TIMEZONE,
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true
                })}
              </div>
              <div className="text-lg text-slate-300">
                {new Date().toLocaleDateString('en-US', {
                  timeZone: FACILITY_TIMEZONE,
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </div>
              <div className="text-sm text-slate-400">Central Time</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Today's Schedule */}
        <div className="xl:col-span-2">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader>
              <CardTitle className="flex items-center text-white text-2xl">
                <Calendar className="mr-3 h-6 w-6" />
                Today's Schedule
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {todaysBookings.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <Calendar className="mx-auto h-16 w-16 mb-4 opacity-50" />
                  <p className="text-xl">No bookings scheduled for today</p>
                </div>
              ) : (
                todaysBookings.map((booking) => {
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
                      className={`p-4 rounded-lg border-l-4 ${
                        isAlert 
                          ? 'bg-red-900/40 border-red-500 shadow-lg animate-pulse' 
                          : isBookingActive(booking, currentTime)
                          ? 'bg-green-500/20 border-green-400'
                          : parseISO(booking.start) > currentTime
                          ? 'bg-slate-700/50 border-slate-500'
                          : 'bg-slate-600/30 border-slate-600'
                      }`}
                    >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="text-lg font-semibold text-white">
                            {isAlert && <span className="mr-2 text-red-300">⚠️</span>}
                            {booking.title}
                          </h3>
                          {isBookingActive(booking, currentTime) && (
                            <Badge className="bg-red-500 text-white animate-pulse">
                              <Radio className="w-3 h-3 mr-1" />
                              LIVE
                            </Badge>
                          )}
                          <Badge 
                            variant={booking.status === 'confirmed' ? 'default' : 'secondary'}
                            className={booking.status === 'confirmed' ? 'bg-green-600' : ''}
                          >
                            {booking.status.toUpperCase()}
                          </Badge>
                        </div>
                        <div className="text-slate-300 mb-2">
                          {getStudioNames(booking, studios, bookingStudioLinks)}
                        </div>
                        <div className="text-slate-400">
                          {formatChicagoTime(booking.start, 'h:mm a')} - {formatChicagoTime(booking.end, 'h:mm a')}
                        </div>
                      </div>
                      <div 
                        className="w-4 h-16 rounded"
                        style={{ backgroundColor: booking.color }}
                      />
                    </div>
                  </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          {/* Weekly Overview */}
          <Card className="bg-slate-800/50 border-slate-700 mt-6">
            <CardHeader>
              <CardTitle className="flex items-center text-white text-2xl">
                <Clock className="mr-3 h-6 w-6" />
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
                      <div className={`text-sm font-medium mb-1 ${
                        index === 0 ? 'text-blue-400' : 'text-slate-300'
                      }`}>
                        {formatChicagoTime(date, 'EEE')}
                      </div>
                      <div className={`text-lg font-bold mb-1 ${
                        index === 0 ? 'text-blue-400' : 'text-white'
                      }`}>
                        {formatChicagoTime(date, 'd')}
                      </div>
                      
                      {/* Weather forecast for the day */}
                      {dayForecast && (
                        <div className="mb-2 flex flex-col items-center">
                          <img 
                            src={`https://openweathermap.org/img/w/${dayForecast.icon}.png`}
                            alt={dayForecast.condition}
                            className="w-8 h-8 mb-1"
                          />
                          <div className="text-xs text-slate-300">
                            {dayForecast.temperature.max}°/{dayForecast.temperature.min}°
                          </div>
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
                            className={`text-xs p-1 rounded text-white truncate ${
                              isAlert 
                                ? 'animate-pulse border border-red-400 shadow-md' 
                                : ''
                            }`}
                            style={{ 
                              backgroundColor: isAlert 
                                ? (booking.severity === 'critical' ? '#dc2626' : '#ea580c')
                                : booking.color 
                            }}
                            title={booking.title}
                          >
                            {isAlert && (
                              <span className="mr-1">⚠️</span>
                            )}
                            {booking.title}
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
              <CardTitle className="flex items-center text-white text-xl">
                <Radio className="mr-3 h-5 w-5" />
                Studio Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                {studioStatus.map((studio) => (
                  <div key={studio.id} className="flex flex-col p-2 rounded-lg bg-slate-700/30">
                    <div className="flex items-center justify-between mb-1">
                      <div className="font-medium text-white text-sm truncate">{studio.name}</div>
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        studio.currentBooking ? 'bg-red-500' : 'bg-green-500'
                      }`} />
                    </div>
                    {studio.currentBooking ? (
                      <div className="text-xs text-slate-400 truncate">
                        {studio.currentBooking.title}
                      </div>
                    ) : (
                      <div className="text-xs text-green-400">Available</div>
                    )}
                    <div className="text-xs text-slate-500 mt-1">
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
              <CardTitle className="flex items-center text-white text-lg">
                <AlertTriangle className="mr-2 h-4 w-4" />
                Active Site Alerts
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Show today's site alerts and upcoming maintenance */}
              {todaysAlerts.length > 0 || maintenanceAlerts.length > 0 ? (
                <div className="space-y-2">
                  {/* Show active site alerts from today */}
                  {todaysAlerts
                    .filter(alert => isBookingActive(alert, currentTime))
                    .map(alert => (
                      <div key={`active-${alert.id}`} className="p-3 rounded-lg bg-red-900/60 border-2 border-red-500 shadow-lg animate-pulse">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertTriangle className="h-4 w-4 text-red-300 animate-bounce" />
                          <div className="text-sm font-bold text-red-100 uppercase tracking-wide">ACTIVE ALERT</div>
                        </div>
                        <div className="text-lg font-semibold text-red-50 mb-1">{alert.title}</div>
                        <div className="text-sm text-red-200">
                          {formatChicagoTime(alert.start, 'h:mm a')} - {formatChicagoTime(alert.end, 'h:mm a')}
                        </div>
                        <div className="text-sm text-red-300">
                          {getStudioNames(alert, studios, bookingStudioLinks)}
                        </div>
                      </div>
                    ))
                  }
                  
                  {/* Show today's upcoming alerts */}
                  {todaysAlerts
                    .filter(alert => !isBookingActive(alert, currentTime) && parseISO(alert.start) > currentTime)
                    .map(alert => (
                      <div key={`today-${alert.id}`} className="p-3 rounded-lg bg-orange-900/50 border-2 border-orange-500 shadow-md">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertTriangle className="h-4 w-4 text-orange-300" />
                          <div className="text-sm font-bold text-orange-100 uppercase tracking-wide">Today</div>
                        </div>
                        <div className="text-lg font-semibold text-orange-50 mb-1">{alert.title}</div>
                        <div className="text-sm text-orange-200">
                          {formatChicagoTime(alert.start, 'h:mm a')} - {formatChicagoTime(alert.end, 'h:mm a')}
                        </div>
                        <div className="text-sm text-orange-300">
                          {getStudioNames(alert, studios, bookingStudioLinks)}
                        </div>
                      </div>
                    ))
                  }
                  
                  {/* Show upcoming maintenance (next 7 days, excluding today) */}
                  {maintenanceAlerts
                    .filter(alert => !isSameDay(parseISO(alert.start), today))
                    .slice(0, 2)
                    .map(alert => (
                      <div key={`upcoming-${alert.id}`} className="p-3 rounded-lg bg-yellow-900/40 border border-yellow-500 shadow-sm">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertTriangle className="h-4 w-4 text-yellow-300" />
                          <div className="text-sm font-bold text-yellow-100 uppercase tracking-wide">Upcoming</div>
                        </div>
                        <div className="text-base font-semibold text-yellow-50 mb-1">{alert.title}</div>
                        <div className="text-sm text-yellow-200">
                          {formatChicagoTime(alert.start, 'MMM d, h:mm a')} - {formatChicagoTime(alert.end, 'h:mm a')}
                        </div>
                        <div className="text-sm text-yellow-300">
                          {getStudioNames(alert, studios, bookingStudioLinks)}
                        </div>
                      </div>
                    ))}
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