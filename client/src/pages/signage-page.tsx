import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Calendar, Radio, AlertTriangle } from "lucide-react";
import { format, isWithinInterval, addDays, startOfDay, endOfDay, parseISO } from "date-fns";
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
  
  // Auto-refresh time every 30 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(getCurrentChicagoTime());
    }, 30000);
    
    return () => clearInterval(timer);
  }, []);
  
  // Fetch weather data
  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const apiKey = import.meta.env.VITE_OPENWEATHER_API_KEY;
        
        if (!apiKey) {
          return;
        }

        const response = await fetch(
          `https://api.openweathermap.org/data/2.5/weather?q=Dallas,TX,US&appid=${apiKey}&units=imperial`
        );
        
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
        // Continue without weather data if API unavailable
      }
    };

    // Try immediately and retry every 5 minutes
    fetchWeather();
    const weatherTimer = setInterval(fetchWeather, 300000);
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

  // Filter today's bookings
  const today = startOfDay(currentTime);
  const todayEnd = endOfDay(currentTime);
  const todaysBookings = bookings.filter(booking => {
    const bookingStart = parseISO(booking.start);
    return isWithinInterval(bookingStart, { start: today, end: todayEnd });
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
  const maintenanceAlerts = bookings.filter(booking => 
    booking.type === 'maintenance' && 
    parseISO(booking.start) >= today &&
    parseISO(booking.start) <= addDays(today, 7)
  );

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
                todaysBookings.map((booking) => (
                  <div
                    key={booking.id}
                    className={`p-4 rounded-lg border-l-4 ${
                      isBookingActive(booking, currentTime)
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
                ))
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
                {weeklyBookings.map(({ date, bookings }, index) => (
                  <div key={index} className="text-center">
                    <div className={`text-sm font-medium mb-2 ${
                      index === 0 ? 'text-blue-400' : 'text-slate-300'
                    }`}>
                      {formatChicagoTime(date, 'EEE')}
                    </div>
                    <div className={`text-lg font-bold mb-2 ${
                      index === 0 ? 'text-blue-400' : 'text-white'
                    }`}>
                      {formatChicagoTime(date, 'd')}
                    </div>
                    <div className="space-y-1">
                      {bookings.slice(0, 3).map((booking) => (
                        <div
                          key={booking.id}
                          className="text-xs p-1 rounded text-white truncate"
                          style={{ backgroundColor: booking.color }}
                          title={booking.title}
                        >
                          {booking.title}
                        </div>
                      ))}
                      {bookings.length > 3 && (
                        <div className="text-xs text-slate-400">
                          +{bookings.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                ))}
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

          {/* Maintenance Alerts */}
          {maintenanceAlerts.length > 0 && (
            <Card className="bg-orange-900/50 border-orange-700">
              <CardHeader>
                <CardTitle className="flex items-center text-orange-200 text-xl">
                  <AlertTriangle className="mr-3 h-5 w-5" />
                  Upcoming Maintenance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {maintenanceAlerts.map((alert) => (
                  <div key={alert.id} className="p-3 rounded-lg bg-orange-800/30">
                    <div className="font-medium text-orange-200">{alert.title}</div>
                    <div className="text-sm text-orange-300">
                      {formatChicagoTime(alert.start, 'MMM d, h:mm a')} - {formatChicagoTime(alert.end, 'h:mm a')}
                    </div>
                    <div className="text-sm text-orange-400">
                      {getStudioNames(alert, studios, bookingStudioLinks)}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Weather Details & Auto-refresh Indicator */}
          {weather && (
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white text-lg">Weather Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Humidity:</span>
                  <span className="text-white">{weather.humidity}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-400">Wind:</span>
                  <span className="text-white">{weather.windSpeed} mph</span>
                </div>
                <div className="text-center text-slate-400 pt-2 border-t border-slate-600">
                  <div className="flex items-center justify-center space-x-2 mb-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-xs">Auto-updating</span>
                  </div>
                  <div className="text-xs">Weather: 10min • Data: 2min</div>
                </div>
              </CardContent>
            </Card>
          )}
          
          {!weather && (
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="pt-6">
                <div className="text-center text-slate-400">
                  <div className="flex items-center justify-center space-x-2 mb-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-sm">Auto-refreshing</span>
                  </div>
                  <div className="text-xs">Data updates every 2 minutes</div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}