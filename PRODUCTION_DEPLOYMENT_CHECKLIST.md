# Production Deployment Checklist - BookStud.io

## Pre-Deployment Setup

### 1. Environment Configuration
- [ ] Copy `.env.example` to `.env`
- [ ] Set secure `SESSION_SECRET` (use: `openssl rand -hex 32`)
- [ ] Configure `PGPASSWORD` with secure database password
- [ ] Set `APP_DOMAIN` to your production domain
- [ ] Configure `SENDGRID_API_KEY` for email notifications
- [ ] Add `VITE_OPENWEATHER_API_KEY` for weather integration
- [ ] Verify timezone settings: `TZ=America/Chicago`

### 2. Weather API Setup
- [ ] Create OpenWeatherMap account at https://openweathermap.org/api
- [ ] Generate API key
- [ ] Wait 10-60 minutes for key activation
- [ ] Test API key with sample request
- [ ] Configure location in `VITE_WEATHER_LOCATION`

### 3. Email Configuration
- [ ] Set up SendGrid account
- [ ] Verify sender email address
- [ ] Test email sending functionality
- [ ] Configure site manager email

## Deployment Process

### 4. Docker Deployment
```bash
# Build and start services
docker-compose up -d --build

# Verify services are running
docker-compose ps

# Check application logs
docker-compose logs app

# Check database logs
docker-compose logs db
```

### 5. Post-Deployment Verification
- [ ] Application accessible on configured port
- [ ] Database connection successful
- [ ] User authentication working
- [ ] Email notifications sending
- [ ] Weather data displaying on signage page
- [ ] All studio bookings visible
- [ ] Mobile forms functional
- [ ] Alert system operational

### 6. Production Features Test
- [ ] Create test booking
- [ ] Verify email notification received
- [ ] Test mobile booking creation
- [ ] Create facility alert via mobile
- [ ] Verify alert appears on signage page
- [ ] Check weather forecast in "Week at a Glance"
- [ ] Test multi-studio booking
- [ ] Verify timezone display accuracy

## Security Checklist

### 7. Production Security
- [ ] Strong database passwords configured
- [ ] Session secret is cryptographically secure
- [ ] HTTPS properly configured (if using SSL)
- [ ] Cookie security settings appropriate
- [ ] Database access restricted to application
- [ ] API keys stored securely in environment

### 8. Monitoring Setup
- [ ] Log rotation configured
- [ ] Backup system operational (if enabled)
- [ ] Database health monitoring
- [ ] Application uptime monitoring
- [ ] Email delivery monitoring

## Troubleshooting

### Common Issues
- **Weather not displaying**: Check API key activation and network access
- **Emails not sending**: Verify SendGrid configuration and sender verification
- **Database connection errors**: Check credentials and network connectivity
- **Timezone issues**: Ensure TZ environment variable is set correctly
- **Mobile forms not working**: Verify all API endpoints accessible

### Log Locations
- Application logs: `docker-compose logs app`
- Database logs: `docker-compose logs db`
- File uploads: `./uploads/` directory
- Backups: `./backups/` directory (if enabled)

## Support Contacts
- Technical issues: Check application logs and error messages
- API issues: Refer to service documentation (OpenWeatherMap, SendGrid)
- Database issues: Verify connection strings and credentials