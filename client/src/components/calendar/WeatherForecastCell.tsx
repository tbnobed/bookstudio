import { Cloud, Sun, CloudRain, CloudSnow } from 'lucide-react';
import type { ForecastDay } from '@/hooks/useWeatherForecast';

interface WeatherForecastCellProps {
  date: Date;
  forecast: ForecastDay | null;
  size?: 'small' | 'normal';
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
  
  return iconMap[iconCode] || Cloud;
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

export default function WeatherForecastCell({ date, forecast, size = 'normal' }: WeatherForecastCellProps) {
  if (!forecast) {
    return null;
  }

  const WeatherIcon = getWeatherIcon(forecast.icon);
  
  const isSmall = size === 'small';
  
  return (
    <div className={`flex items-center justify-center space-x-1 ${isSmall ? 'text-xs' : 'text-sm'} text-gray-600 dark:text-gray-300 bg-blue-50/50 dark:bg-blue-900/20 px-1 py-0.5 rounded`}>
      <WeatherIcon className={`${isSmall ? 'h-3 w-3' : 'h-4 w-4'} ${getWeatherIconColor(forecast.icon)}`} />
      <div className="flex items-center space-x-0.5">
        <span className="font-medium">{forecast.temperature.max}°</span>
        <span className="text-gray-400 dark:text-gray-500">{forecast.temperature.min}°</span>
      </div>
    </div>
  );
}