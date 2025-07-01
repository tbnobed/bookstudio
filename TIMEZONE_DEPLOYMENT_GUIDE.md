# BookStud.io Multi-City Timezone Deployment Guide

## Overview

BookStud.io is now fully configurable for deployment in any timezone without rebuilding Docker images. All timezone settings are controlled through environment variables in the .env file.

## Timezone Configuration Variables

The system uses three timezone environment variables:

- `TZ` - System timezone for the entire Docker environment (containers, database, logs)
- `FACILITY_TIMEZONE` - Server-side timezone for API operations and database queries
- `VITE_FACILITY_TIMEZONE` - Client-side timezone for display formatting and date calculations

## City-Specific Configurations

### Chicago/Nashville (Central Time)
```env
TZ=America/Chicago
FACILITY_TIMEZONE=America/Chicago
VITE_FACILITY_TIMEZONE=America/Chicago
```

### Los Angeles/Tustin (Pacific Time)
```env
TZ=America/Los_Angeles
FACILITY_TIMEZONE=America/Los_Angeles
VITE_FACILITY_TIMEZONE=America/Los_Angeles
```

### New York (Eastern Time)
```env
TZ=America/New_York
FACILITY_TIMEZONE=America/New_York
VITE_FACILITY_TIMEZONE=America/New_York
```

### Denver (Mountain Time)
```env
TZ=America/Denver
FACILITY_TIMEZONE=America/Denver
VITE_FACILITY_TIMEZONE=America/Denver
```

## Deployment Steps

1. **Update .env file** with appropriate timezone for your city
2. **Run Docker Compose**: `docker-compose up -d`
3. **Verify timezone**: Check application logs for timezone confirmation

## Weather Integration

Don't forget to also update weather coordinates for your city:

```env
# Example for Tustin, CA
VITE_WEATHER_LOCATION=Tustin,CA,US
VITE_WEATHER_LAT=33.7458
VITE_WEATHER_LON=-117.8265
```

## Database Considerations

- PostgreSQL automatically uses the `TZ` environment variable
- All existing bookings remain in UTC in the database
- Display formatting converts to the configured facility timezone
- No data migration is required when changing timezones

## Important Notes

1. **Consistency**: All three timezone variables should be set to the same value
2. **Valid Timezones**: Use standard IANA timezone names (America/Chicago, America/Los_Angeles, etc.)
3. **No Rebuild Required**: Changing timezones only requires updating .env and restarting containers
4. **Database Persistence**: Timezone settings are also stored in the system_settings table and persist across restarts

## Troubleshooting

If bookings appear on wrong dates:
1. Verify all three timezone variables are identical
2. Check Docker container logs for timezone loading confirmation
3. Restart all containers: `docker-compose restart`
4. Clear browser cache to reload client-side timezone settings

## Testing Timezone Changes

1. Create a test booking at a known time
2. Check that it displays correctly in daily/weekly/monthly views
3. Verify signage displays show correct local time
4. Confirm email notifications use proper facility timezone