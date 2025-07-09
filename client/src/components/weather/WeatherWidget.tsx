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
        <div className="animate-pulse">
          <div className="h-4 bg-gray-300 rounded w-24"></div>
        </div>
      </div>
    );
  }

  if (!weather) {
    // Show a fallback when weather data is not available
    return (
      <div className={`flex items-center space-x-2 text-gray-500 ${className}`}>
        <Cloud className="h-4 w-4" />
        <span className="text-xs">Weather unavailable</span>
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
    compact: 'h-5 w-5',
    normal: 'h-6 w-6',
    large: 'h-8 w-8'
  };

  return (
    <div className={`${className}`}>
      {/* Current Weather */}
      <div className="flex items-center justify-end space-x-4">
        <div className={`text-right ${sizeClasses[size]}`}>
          <div className="flex items-center justify-end space-x-2">
            <span className="text-gray-600 capitalize text-lg">{weather.condition}</span>
            <span className="font-bold text-2xl">{weather.temperature}°F</span>
          </div>
          {size !== 'compact' && (
            <div className="flex items-center justify-end space-x-4 text-gray-500 mt-2">
              <div className="flex items-center space-x-1">
                <Droplets className="h-4 w-4" />
                <span className="text-base">{weather.humidity}%</span>
              </div>
              <div className="flex items-center space-x-1">
                <Wind className="h-4 w-4" />
                <span className="text-base">{weather.windSpeed} mph</span>
              </div>
            </div>
          )}
        </div>
        <WeatherIcon className={`${iconSizes[size]} text-blue-500`} />
      </div>

      {/* Forecast */}
      {showForecast && forecast && forecast.forecast.length > 0 && (
        <div className="mt-6">
          <h4 className={`font-bold mb-3 text-right text-lg ${sizeClasses[size]}`}>6-Day Forecast</h4>
          <div className="grid grid-cols-6 gap-3 justify-items-center">
            {forecast.forecast.map((day, index) => {
              const ForecastIcon = getWeatherIcon(day.icon);
              const date = new Date(day.date + 'T12:00:00'); // Add time to avoid timezone shifts
              const dayName = date.toLocaleDateString('en-US', { 
                weekday: 'short',
                timeZone: FACILITY_TIMEZONE
              });
              
              return (
                <div key={day.date} className="text-center bg-white/50 rounded-lg p-2 backdrop-blur-sm">
                  <div className={`text-sm font-semibold text-gray-700 mb-1`}>
                    {index === 0 ? 'Today' : dayName}
                  </div>
                  <ForecastIcon className={`h-6 w-6 mx-auto text-blue-500 my-2`} />
                  <div className={`text-sm text-gray-600`}>
                    <div className="font-bold">{day.temperature.max}°</div>
                    <div className="text-gray-400">{day.temperature.min}°</div>
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