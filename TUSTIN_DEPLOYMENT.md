# Tustin, California Deployment Guide

## Environment Configuration for Tustin

Copy this configuration to your Tustin deployment .env file:

```bash
# Timezone Configuration for Tustin, CA
TZ=America/Los_Angeles
FACILITY_TIMEZONE=America/Los_Angeles

# Weather Configuration for Tustin, CA
VITE_WEATHER_LOCATION=Tustin,CA,US
# Optional: Use precise coordinates for better weather accuracy
VITE_WEATHER_LAT=33.7458
VITE_WEATHER_LON=-117.8265

# Site Information
SITE_NAME=Tustin Production Studios
APP_DOMAIN=https://your-tustin-domain.com

# Email Configuration
SENDGRID_VERIFIED_SENDER=studio@your-tustin-domain.com
SITE_MANAGER_EMAIL=manager@your-tustin-domain.com
```

## Key Changes from Dallas System

1. **Timezone**: `America/Chicago` → `America/Los_Angeles`
2. **Weather Location**: Hendersonville, TN → Tustin, CA
3. **Site Name**: Configurable per deployment

## Verification Checklist

- [ ] All bookings display in Pacific Time
- [ ] Weather shows Tustin, CA data
- [ ] Email links point to correct domain
- [ ] Calendar dates match local facility time

## No Code Changes Required

The system automatically uses these environment variables throughout:
- All date/time displays
- Weather integration
- Email notifications
- Calendar operations

Your deployment will work perfectly with just environment variable changes!