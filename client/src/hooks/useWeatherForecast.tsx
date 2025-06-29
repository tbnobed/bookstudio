import { useState, useEffect } from 'react';
import { toZonedTime, format } from 'date-fns-tz';
import { FACILITY_TIMEZONE } from '@/lib/dateUtils';

export interface ForecastDay {
  date: string;
  temperature: {
    min: number;
    max: number;
  };
  condition: string;
  icon: string;
}

export interface WeatherForecast {
  forecast: ForecastDay[];
}

export function useWeatherForecast() {
  const [forecast, setForecast] = useState<WeatherForecast | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchForecast = async () => {
      try {
        const apiKey = import.meta.env.VITE_OPENWEATHER_API_KEY;
        
        if (!apiKey) {
          console.warn("Weather forecast disabled: API key not found");
          setLoading(false);
          return;
        }

        const weatherLocation = import.meta.env.VITE_WEATHER_LOCATION;
        const weatherLat = import.meta.env.VITE_WEATHER_LAT;
        const weatherLon = import.meta.env.VITE_WEATHER_LON;
        
        if (!weatherLocation && (!weatherLat || !weatherLon)) {
          console.warn("Weather forecast disabled: Location not configured");
          setLoading(false);
          return;
        }

        // Use coordinates if available, otherwise use location name
        let forecastUrl;
        if (weatherLat && weatherLon) {
          forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${weatherLat}&lon=${weatherLon}&appid=${apiKey}&units=imperial`;
        } else {
          forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?q=${weatherLocation}&appid=${apiKey}&units=imperial`;
        }

        const response = await fetch(forecastUrl);
        
        if (!response.ok) {
          throw new Error(`Weather API error: ${response.status}`);
        }

        const data = await response.json();
        
        // Also get current weather data for today
        let currentUrl;
        if (weatherLat && weatherLon) {
          currentUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${weatherLat}&lon=${weatherLon}&appid=${apiKey}&units=imperial`;
        } else {
          currentUrl = `https://api.openweathermap.org/data/2.5/weather?q=${weatherLocation}&appid=${apiKey}&units=imperial`;
        }

        const currentResponse = await fetch(currentUrl);
        const currentData = currentResponse.ok ? await currentResponse.json() : null;
        
        // Process forecast data to get daily summaries
        const dailyData = new Map();
        
        // Add current weather data for today if available
        if (currentData) {
          const today = format(toZonedTime(new Date(), FACILITY_TIMEZONE), 'yyyy-MM-dd', { timeZone: FACILITY_TIMEZONE });
          dailyData.set(today, {
            temps: [currentData.main.temp, currentData.main.temp_min, currentData.main.temp_max],
            conditions: [currentData.weather[0].description],
            icons: [currentData.weather[0].icon]
          });
        }
        
        data.list.forEach((item: any) => {
          const date = new Date(item.dt * 1000);
          const facilityDate = toZonedTime(date, FACILITY_TIMEZONE);
          const dateString = format(facilityDate, 'yyyy-MM-dd', { timeZone: FACILITY_TIMEZONE });
          
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
        
        dailyData.forEach((data, dateString) => {
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
        
        setForecast({ forecast: dailyForecasts.slice(0, 14) }); // Get up to 14 days
        setError(null);
      } catch (error) {
        console.error("Weather forecast error:", error);
        setError(error instanceof Error ? error.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchForecast();
    
    // Refresh forecast data every 30 minutes
    const interval = setInterval(fetchForecast, 30 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, []);

  return { forecast, loading, error };
}