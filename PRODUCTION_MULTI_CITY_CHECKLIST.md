# Production Multi-City Deployment Checklist

## Pre-Deployment Setup

### 1. Environment Configuration
- [ ] Create production `.env` file with city-specific values:
  ```bash
  VITE_OPENWEATHER_API_KEY=your_api_key_here
  VITE_WEATHER_LOCATION=YourCity,State,US
  VITE_WEATHER_LAT=your_latitude
  VITE_WEATHER_LON=your_longitude
  APP_DOMAIN=https://your-production-domain.com
  SITE_MANAGER_EMAIL=manager@yourfacility.com
  ```

### 2. Database Configuration
- [ ] Configure unique database credentials for each city
- [ ] Set appropriate SESSION_SECRET (32+ character random string)
- [ ] Configure SENDGRID_API_KEY and SENDGRID_VERIFIED_SENDER

### 3. City Coordinates Reference
Use these coordinates or obtain precise ones from OpenWeatherMap:

| City | Location | Latitude | Longitude |
|------|----------|-----------|-----------|
| Nashville, TN | Hendersonville,TN,US | 36.3048 | -86.6200 |
| Dallas, TX | Dallas,TX,US | 32.7767 | -96.7970 |
| Los Angeles, CA | Los Angeles,CA,US | 34.0522 | -118.2437 |
| New York, NY | New York,NY,US | 40.7128 | -74.0060 |
| Chicago, IL | Chicago,IL,US | 41.8781 | -87.6298 |

## Deployment Process

### 1. Build and Deploy
```bash
# Clean build (recommended for location changes)
docker-compose build --no-cache

# Start services
docker-compose up -d

# Verify logs
docker-compose logs app
```

### 2. Verification Steps
- [ ] Check application loads at your domain
- [ ] Navigate to signage page (`/signage`)
- [ ] Verify weather data displays for your city
- [ ] Check browser console for weather variable loading:
  - Weather API Key status: Available
  - Weather Location: [Your configured location]
  - Weather Lat: [Your configured latitude]  
  - Weather Lon: [Your configured longitude]

### 3. System Health Check
- [ ] Test booking creation and email notifications
- [ ] Verify timezone displays correctly (facility timezone)
- [ ] Check that site manager emails work
- [ ] Confirm database operations function properly

## Troubleshooting

### Weather Not Loading
1. Check `.env` file has all VITE_WEATHER_* variables
2. Verify OpenWeatherMap API key is valid
3. Ensure coordinates are correct format (decimal degrees)
4. Rebuild Docker image: `docker-compose build --no-cache`

### Email Issues
1. Verify SENDGRID_API_KEY is valid
2. Check SENDGRID_VERIFIED_SENDER domain is verified
3. Ensure APP_DOMAIN points to actual production domain

### Database Connection Issues
1. Check DATABASE_URL format and credentials
2. Verify PostgreSQL service is running
3. Check network connectivity between services

## Multi-City Management

### Independent Deployments
- Each city runs completely independently
- No shared data between cities
- Each requires its own domain/subdomain
- Separate database per deployment

### Scaling Considerations
- Use different ports if deploying multiple cities on same server
- Consider separate servers for each major city
- Implement proper backup strategies per city
- Monitor resource usage per deployment