import { useState, useEffect } from 'react';
import { Cloud, Sun, CloudRain, CloudSnow, Thermometer, Droplets, Wind } from 'lucide-react';
import { toZonedTime, format } from 'date-fns-tz';
import { FACILITY_TIMEZONE } from '@/lib/dateUtils';

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

interface WeatherWidgetProps {
  showForecast?: boolean;
  size?: 'compact' | 'normal' | 'large';
  className?: string;
}

const getWeatherIcon = (iconCode: string) => {
  const iconMap: { [key: string]: any } = {
    '01d': Sun, '01n': Sun,
    '02d': Cloud, '02n': Cloud,
    '03d': Cloud, '03n': Cloud,
    '04d': Cloud, '04n': Cloud,
    '09d': CloudRain, '09n': CloudRain,
    '10d': CloudRain, '10n': CloudRain,
    '11d': CloudRain, '11n': CloudRain,
    '13d': CloudSnow, '13n': CloudSnow,
    '50d': Cloud, '50n': Cloud,
  };
  
  const IconComponent = iconMap[iconCode] || Cloud;
  return IconComponent;
};

const getWeatherIconColor = (iconCode: string) => {
  // Sun icons should be yellow
  if (iconCode === '01d' || iconCode === '01n') {
    return 'text-yellow-500';
  }
  // Rain/snow icons should be blue
  if (iconCode.startsWith('09') || iconCode.startsWith('10') || iconCode.startsWith('11') || iconCode.startsWith('13')) {
    return 'text-blue-500';
  }
  // Cloud icons should be gray
  return 'text-gray-500';
};

export default function WeatherWidget({ showForecast = false, size = 'normal', className = '' }: WeatherWidgetProps) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [forecast, setForecast] = useState<WeatherForecast | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWeatherData = async () => {
      try {
        const apiKey = import.meta.env.VITE_OPENWEATHER_API_KEY;
        
        if (!apiKey) {
          console.warn("Weather integration disabled: API key not found");
          setLoading(false);
          return;
        }

        // Fetch current weather
        const weatherLocation = import.meta.env.VITE_WEATHER_LOCATION;
        const weatherLat = import.meta.env.VITE_WEATHER_LAT;
        const weatherLon = import.meta.env.VITE_WEATHER_LON;
        
        if (!weatherLocation && (!weatherLat || !weatherLon)) {
          console.warn("Weather integration disabled: Location not configured");
          setLoading(false);
          return;
        }

        // Use coordinates if available, otherwise use location name
        let weatherUrl;
        if (weatherLat && weatherLon) {
          weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${weatherLat}&lon=${weatherLon}&appid=${apiKey}&units=imperial`;
        } else {
          weatherUrl = `https://api.openweathermap.org/data/2.5/weather?q=${weatherLocation}&appid=${apiKey}&units=imperial`;
        }

        const currentResponse = await fetch(weatherUrl);
        let currentData = null;
        
        if (currentResponse.ok) {
          currentData = await currentResponse.json();
          setWeather({
            temperature: Math.round(currentData.main.temp),
            condition: currentData.weather[0].description,
            humidity: currentData.main.humidity,
            windSpeed: Math.round(currentData.wind.speed),
            icon: currentData.weather[0].icon,
            location: currentData.name
          });
        }

        // Fetch forecast if requested
        if (showForecast) {
          let forecastUrl;
          if (weatherLat && weatherLon) {
            forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${weatherLat}&lon=${weatherLon}&appid=${apiKey}&units=imperial`;
          } else {
            forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?q=${weatherLocation}&appid=${apiKey}&units=imperial`;
          }

          const forecastResponse = await fetch(forecastUrl);
          
          if (forecastResponse.ok) {
            const forecastData = await forecastResponse.json();
            
            // Process forecast data to get daily summaries
            const dailyData = new Map();
            
            forecastData.list.forEach((item: any) => {
              const date = new Date(item.dt * 1000);
              const facilityDate = toZonedTime(date, FACILITY_TIMEZONE);
              const dateString = format(facilityDate, 'yyyy-MM-dd');
              
              if (!dailyData.has(dateString)) {
                dailyData.set(dateString, {
                  temps: [],
                  conditions: [],
                  icons: []
                });
              }
              
              const dayData = dailyData.get(dateString);
              dayData.temps.push(item.main.temp);
              dayData.conditions.push(item.weather[0].description);
              dayData.icons.push(item.weather[0].icon);
            });

            const dailyForecasts: ForecastDay[] = [];
            
            // First, add today's weather from current weather data
            const today = new Date();
            const todayInFacility = toZonedTime(today, FACILITY_TIMEZONE);
            const todayString = format(todayInFacility, 'yyyy-MM-dd');
            
            if (currentData) {
              dailyForecasts.push({
                date: todayString,
                temperature: {
                  min: Math.round(currentData.main.temp_min || currentData.main.temp),
                  max: Math.round(currentData.main.temp_max || currentData.main.temp)
                },
                condition: currentData.weather[0].description,
                icon: currentData.weather[0].icon
              });
            }
            
            // Then add forecast data starting from tomorrow
            dailyData.forEach((data, dateString) => {
              // Skip today since we already added current weather
              if (dateString === todayString) return;
              
              const minTemp = Math.min(...data.temps);
              const maxTemp = Math.max(...data.temps);
              
              // Use midday condition and icon
              const middayIndex = Math.floor(data.conditions.length / 2);
              
              dailyForecasts.push({
                date: dateString,
                temperature: {
                  min: Math.round(minTemp),
                  max: Math.round(maxTemp)
                },
                condition: data.conditions[middayIndex],
                icon: data.icons[middayIndex]
              });
            });
            
            // Sort by date and take first 6 days
            dailyForecasts.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            setForecast({ forecast: dailyForecasts.slice(0, 6) });
          }
        }

        setLoading(false);
      } catch (error) {
        console.error("Weather API error:", error);
        setLoading(false);
      }
    };

    fetchWeatherData();
    
    // Refresh weather data every 5 minutes
    const interval = setInterval(fetchWeatherData, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [showForecast]);

  if (loading) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <div className="animate-pulse flex items-center gap-2 px-3 py-1 rounded-full bg-gray-100 dark:bg-neutral-800 w-32 h-7" />
      </div>
    );
  }

  if (!weather) {
    return (
      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-100 dark:bg-neutral-800 text-gray-400 dark:text-gray-500 ${className}`}>
        <Cloud className="h-3.5 w-3.5" />
        <span className="text-xs">Unavailable</span>
      </div>
    );
  }

  const WeatherIcon = getWeatherIcon(weather.icon);

  const sizeClasses = {
    compact: 'text-sm',
    normal: 'text-base',
    large: 'text-lg'
  };

  const iconSizes = {
    compact: 'h-4 w-4',
    normal: 'h-6 w-6',
    large: 'h-8 w-8'
  };

  // Compact mode: fun pill badge
  if (size === 'compact') {
    const isSunny = weather.icon === '01d' || weather.icon === '01n';
    const isRainy = weather.icon.startsWith('09') || weather.icon.startsWith('10') || weather.icon.startsWith('11');
    const isSnowy = weather.icon.startsWith('13');

    const pillBg = isSunny
      ? 'from-amber-50 to-yellow-50 dark:from-amber-950/40 dark:to-yellow-950/30 border-amber-200 dark:border-amber-700/50'
      : isRainy
      ? 'from-sky-50 to-blue-50 dark:from-sky-950/40 dark:to-blue-950/30 border-sky-200 dark:border-sky-700/50'
      : isSnowy
      ? 'from-slate-50 to-blue-50 dark:from-neutral-900/40 dark:to-blue-950/30 border-slate-200 dark:border-slate-600/50'
      : 'from-slate-50 to-gray-50 dark:from-neutral-900/40 dark:to-neutral-900/30 border-gray-200 dark:border-neutral-700/50';

    return (
      <div className={`flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r border ${pillBg} shadow-sm ${className}`}>
        <WeatherIcon className={`${iconSizes.compact} ${getWeatherIconColor(weather.icon)} shrink-0`} />
        <span className="text-[11px] font-medium text-gray-600 dark:text-gray-300 capitalize leading-none">
          {weather.condition}
        </span>
        <span className="w-px h-3 bg-gray-300 dark:bg-gray-600 shrink-0" />
        <span className="text-[13px] font-bold text-neutral-800 dark:text-white leading-none whitespace-nowrap">
          {weather.temperature}°F
        </span>
      </div>
    );
  }

  return (
    <div className={`${className}`}>
      {/* Current Weather — normal / large */}
      <div className="flex items-center justify-end space-x-4">
        <div className={`text-right ${sizeClasses[size]}`}>
          <div className="flex items-center justify-end space-x-2">
            <span className="text-gray-600 dark:text-gray-300 capitalize text-lg">{weather.condition}</span>
            <span className="font-bold text-2xl dark:text-white">{weather.temperature}°F</span>
          </div>
          <div className="flex items-center justify-end space-x-4 text-gray-500 dark:text-gray-400 mt-2">
            <div className="flex items-center space-x-1">
              <Droplets className="h-4 w-4" />
              <span className="text-base">{weather.humidity}%</span>
            </div>
            <div className="flex items-center space-x-1">
              <Wind className="h-4 w-4" />
              <span className="text-base">{weather.windSpeed} mph</span>
            </div>
          </div>
        </div>
        <WeatherIcon className={`${iconSizes[size]} ${getWeatherIconColor(weather.icon)}`} />
      </div>

      {/* Forecast */}
      {showForecast && forecast && forecast.forecast.length > 0 && (
        <div className="mt-4">
          <h4 className={`font-semibold mb-2 ${sizeClasses[size]} dark:text-gray-200`}>6-Day Forecast</h4>
          <div className="grid grid-cols-6 gap-2 justify-items-center">
            {forecast.forecast.map((day, index) => {
              const ForecastIcon = getWeatherIcon(day.icon);
              const date = new Date(day.date + 'T12:00:00'); // Add time to avoid timezone shifts
              const dayName = date.toLocaleDateString('en-US', { 
                weekday: 'short',
                timeZone: FACILITY_TIMEZONE
              });
              
              return (
                <div key={day.date} className="text-center">
                  <div className={`${sizeClasses[size]} font-medium text-neutral-700 dark:text-gray-300`}>
                    {index === 0 ? 'Today' : dayName}
                  </div>
                  <ForecastIcon className={`${iconSizes[size]} mx-auto ${getWeatherIconColor(day.icon)} my-1`} />
                  <div className={`${sizeClasses[size]} text-gray-600 dark:text-gray-400`}>
                    <div>{day.temperature.max}°</div>
                    <div className="text-gray-400 dark:text-gray-500">{day.temperature.min}°</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}