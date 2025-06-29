import { useState, useEffect } from 'react';

export interface ForecastDay {
  date: string;
  temperature: {
    min: number;
    max: number;
  };
  condition: string;
  icon: string;
  humidity?: number;
  windSpeed?: number;
  pressure?: number;
  feelsLike?: number;
  uvIndex?: number;
  visibility?: number;
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
          const today = new Date().toISOString().split('T')[0];
          dailyData.set(today, {
            temps: [currentData.main.temp, currentData.main.temp_min, currentData.main.temp_max],
            conditions: [currentData.weather[0].description],
            icons: [currentData.weather[0].icon],
            humidity: [currentData.main.humidity],
            windSpeed: [currentData.wind?.speed || 0],
            pressure: [currentData.main.pressure],
            feelsLike: [currentData.main.feels_like],
            uvIndex: [0], // Current weather API doesn't provide UV index
            visibility: [(currentData.visibility || 0) / 1000] // Convert meters to kilometers
          });
        }
        
        data.list.forEach((item: any) => {
          const date = new Date(item.dt * 1000);
          const dateString = date.toISOString().split('T')[0];
          
          if (!dailyData.has(dateString)) {
            dailyData.set(dateString, {
              temps: [],
              conditions: [],
              icons: [],
              humidity: [],
              windSpeed: [],
              pressure: [],
              feelsLike: [],
              uvIndex: [],
              visibility: []
            });
          }
          
          const dayData = dailyData.get(dateString);
          dayData.temps.push(item.main.temp);
          dayData.conditions.push(item.weather[0].description);
          dayData.icons.push(item.weather[0].icon);
          dayData.humidity.push(item.main.humidity);
          dayData.windSpeed.push(item.wind?.speed || 0);
          dayData.pressure.push(item.main.pressure);
          dayData.feelsLike.push(item.main.feels_like);
          dayData.uvIndex.push(item.uvi || 0);
          dayData.visibility.push((item.visibility || 0) / 1000); // Convert meters to kilometers
        });

        const dailyForecasts: ForecastDay[] = [];
        
        dailyData.forEach((data, dateString) => {
          const minTemp = Math.min(...data.temps);
          const maxTemp = Math.max(...data.temps);
          
          // Use midday condition and icon
          const middayIndex = Math.floor(data.conditions.length / 2);
          
          // Calculate averages for additional weather data
          const avgHumidity = data.humidity.length > 0 ? Math.round(data.humidity.reduce((a: number, b: number) => a + b, 0) / data.humidity.length) : undefined;
          const avgWindSpeed = data.windSpeed.length > 0 ? Math.round(data.windSpeed.reduce((a: number, b: number) => a + b, 0) / data.windSpeed.length) : undefined;
          const avgPressure = data.pressure.length > 0 ? Math.round(data.pressure.reduce((a: number, b: number) => a + b, 0) / data.pressure.length) : undefined;
          const avgFeelsLike = data.feelsLike.length > 0 ? Math.round(data.feelsLike.reduce((a: number, b: number) => a + b, 0) / data.feelsLike.length) : undefined;
          const avgUvIndex = data.uvIndex && data.uvIndex.length > 0 ? Math.round(data.uvIndex.reduce((a: number, b: number) => a + b, 0) / data.uvIndex.length) : undefined;
          const avgVisibility = data.visibility && data.visibility.length > 0 ? Math.round(data.visibility.reduce((a: number, b: number) => a + b, 0) / data.visibility.length) : undefined;
          
          dailyForecasts.push({
            date: dateString,
            temperature: {
              min: Math.round(minTemp),
              max: Math.round(maxTemp)
            },
            condition: data.conditions[middayIndex],
            icon: data.icons[middayIndex],
            humidity: avgHumidity,
            windSpeed: avgWindSpeed,
            pressure: avgPressure,
            feelsLike: avgFeelsLike,
            uvIndex: avgUvIndex,
            visibility: avgVisibility
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