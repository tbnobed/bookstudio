# Weather Integration Setup for Production

## Required Environment Variables

Add these variables to your production `.env` file:

```bash
# Weather Integration (OpenWeatherMap)
VITE_OPENWEATHER_API_KEY=your_openweather_api_key_here
VITE_WEATHER_LOCATION=Dallas,TX,US
```

## Getting an OpenWeatherMap API Key

1. Visit https://openweathermap.org/api
2. Sign up for a free account
3. Navigate to "API keys" section
4. Generate a new API key
5. Copy the API key to your `.env` file

## Location Configuration

The weather system supports two methods for location:

### Method 1: City Name (Current)
```bash
VITE_WEATHER_LOCATION=Dallas,TX,US
```

### Method 2: Coordinates (More Precise)
```bash
VITE_WEATHER_LAT=32.7767
VITE_WEATHER_LON=-96.7970
```

## Production Deployment Checklist

- [ ] OpenWeatherMap API key added to `.env` file
- [ ] Weather location configured in `.env` file
- [ ] Docker containers rebuilt with new environment variables
- [ ] Signage page tested with weather display
- [ ] Weather forecast appears in "Week at a Glance" view

## Features Enabled

With weather integration configured, the signage page will display:

- Current weather conditions in the header
- Temperature, humidity, wind speed
- Weather icons for current conditions
- 7-day forecast in "Week at a Glance" section
- High/low temperatures for each day
- Weather icons for each forecast day

## Troubleshooting

If weather data doesn't appear:
1. Verify API key is correct in `.env` file
2. Check API key activation (new keys may take 10-60 minutes)
3. Verify location format matches OpenWeatherMap requirements
4. Check browser console for API errors on signage page