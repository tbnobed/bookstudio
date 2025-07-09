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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      <div className="flex justify-between items-center mb-10">
        <div className="flex items-center space-x-6">
          <div className="text-6xl font-bold text-white drop-shadow-lg">{title}</div>
          <Badge variant="outline" className="text-xl px-6 py-3 bg-blue-500/20 text-blue-300 border-blue-400 font-semibold">
            LIVE DISPLAY
          </Badge>
        </div>
        <div className="text-right text-white">
          <div className="flex items-center justify-end space-x-6">
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
            </div>
          </div>
        </div>
      </div>

      <div className="text-center py-12 text-white">
        <h2 className="text-4xl font-bold mb-4">Custom Signage Display</h2>
        <p className="text-xl text-slate-300">
          URL Parameters: studios={studioIds || 'none'}, title={customTitle || 'default'}, weather={showWeather ? 'true' : 'false'}
        </p>
      </div>
    </div>
  );
}