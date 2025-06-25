# Multi-City Deployment Guide for BookStud.io

BookStud.io is designed for multi-city deployments with location-specific configuration. Each deployment instance requires its own environment configuration.

## Required Location-Specific Configuration

### Weather Integration
Each city deployment requires these environment variables in `.env`:

```bash
# Weather API (required for signage page)
VITE_OPENWEATHER_API_KEY=your_api_key_here
VITE_WEATHER_LOCATION=YourCity,State,US
VITE_WEATHER_LAT=your_latitude
VITE_WEATHER_LON=your_longitude
```

### City-Specific Examples

#### Nashville, TN
```bash
VITE_WEATHER_LOCATION=Hendersonville,TN,US
VITE_WEATHER_LAT=36.3048
VITE_WEATHER_LON=-86.6200
```

#### Dallas, TX
```bash
VITE_WEATHER_LOCATION=Dallas,TX,US
VITE_WEATHER_LAT=32.7767
VITE_WEATHER_LON=-96.7970
```

#### Los Angeles, CA
```bash
VITE_WEATHER_LOCATION=Los Angeles,CA,US
VITE_WEATHER_LAT=34.0522
VITE_WEATHER_LON=-118.2437
```

## Deployment Steps for New City

1. **Copy the project to new deployment location**
2. **Create city-specific `.env` file** with:
   - Weather location coordinates
   - Unique database credentials
   - City-specific domain (APP_DOMAIN)
   - Local site manager email

3. **Build and deploy**:
   ```bash
   docker-compose build --no-cache
   docker-compose up -d
   ```

## Configuration Validation

The system will gracefully disable weather features if location is not configured, ensuring the application still functions for booking management even without weather data.

## Important Notes

- NO hardcoded locations in the codebase
- Each deployment is completely independent
- Weather coordinates should be obtained from: https://openweathermap.org/api
- Timezone configuration should match facility location in FACILITY_TIMEZONE