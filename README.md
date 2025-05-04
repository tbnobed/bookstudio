# BookStud.io - Television Studio Management System

A comprehensive web application for television studio management, providing intelligent scheduling, booking, and access control tools with enhanced multi-booking capabilities.

## Features

- **Comprehensive Calendar Views**: Daily, weekly, and monthly views for studio bookings
- **Real-time Status Indicators**: See which studios are available, booked, or in maintenance 
- **Template System**: Save and reuse common production setups
- **Role-based Authentication**: Different access levels for producers, engineers, and administrators
- **Facility-wide Alerts**: System for outages and maintenance notifications
- **Public Calendar Integration**: Embeddable public view of studio availability
- **Mobile-friendly UI**: Fully responsive design works on all devices

## Technology Stack

- **Frontend**: React.js with TypeScript, TailwindCSS, shadcn/ui components
- **Backend**: Node.js with Express
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Passport.js with session-based auth
- **Deployment**: Docker and Docker Compose

## Deployment Instructions

### Prerequisites

- Docker and Docker Compose installed on your Ubuntu server
- Git for cloning the repository

### Steps to Deploy

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd bookstuio
   ```

2. Make the scripts executable:
   ```bash
   chmod +x deploy.sh wait-for-postgres.sh
   ```

3. Run the deployment script:
   ```bash
   ./deploy.sh
   ```

4. The script will create a `.env` file from the example if one doesn't exist. Edit this file with your specific configuration:
   ```bash
   nano .env
   ```
   
   Be sure to set:
   - `POSTGRES_PASSWORD` to a secure password
   - `SESSION_SECRET` to a secure random string
   - `SENDGRID_API_KEY` to your SendGrid API key for email notifications

5. Run the deployment script again to start the application:
   ```bash
   ./deploy.sh
   ```

6. The application will be running at `http://your-server-ip:3000`

7. Initial login credentials:
   - Admin: admin / admin123
   - Producer: producer / producer123
   - Engineer: engineer / engineer123

### Environment Variables

These are the important environment variables you can configure in your `.env` file:

| Variable | Description | Default |
|----------|-------------|---------|
| APP_PORT | Port where the application will run | 3000 |
| SESSION_SECRET | Secret for session encryption | (needs to be set) |
| POSTGRES_USER | PostgreSQL username | postgres |
| POSTGRES_PASSWORD | PostgreSQL password | (needs to be set) |
| POSTGRES_DB | PostgreSQL database name | bookstuio |
| DB_PORT | PostgreSQL port | 5432 |
| SENDGRID_API_KEY | API key for SendGrid email service | (needs to be set) |

### Using with a Reverse Proxy (NGINX)

For production use, it's recommended to set up NGINX as a reverse proxy to handle SSL termination and serve the application. Here's a sample NGINX configuration:

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Maintenance

- **Viewing Logs**: `docker-compose logs -f`
- **Stopping the Application**: `docker-compose down`
- **Restarting the Application**: `docker-compose restart`
- **Updating the Application**: Pull the latest changes and run `./deploy.sh` again

## Default Users

The system comes with these default users for initial login:

- **Admin**: username: `admin`, password: `admin123`
- **Producer**: username: `producer`, password: `producer123`
- **Engineer**: username: `engineer`, password: `engineer123`

*Important: Change these passwords immediately after first login for security.*

## Email Notifications with SendGrid

BookStud.io uses SendGrid to deliver professionally formatted emails for all system notifications. The application includes specialized templates for different notification types that match your studio branding.

### Setting Up SendGrid

1. [Sign up](https://signup.sendgrid.com/) for a SendGrid account if you don't have one
2. Create an API key with full access to "Mail Send" permissions
3. Add your API key to the `.env` file as `SENDGRID_API_KEY`

### Notification Groups

The system comes with pre-configured notification groups for different departments:

- **Camera Operators**: Notifications for camera department staff
- **Lighting Technicians**: Notifications for lighting department staff
- **Sound Engineers**: Notifications for audio engineers and technicians
- **Directors**: Notifications for show directors and production leaders
- **Facility Maintenance**: Notifications for maintenance staff
- **All Staff**: Facility-wide announcements for all studio personnel

Administrators can modify these groups, add new ones, or change the associated email addresses from the Settings page. The system sends formatted email notifications for:

- New booking confirmations
- Booking updates/changes
- Booking cancellations
- Maintenance alerts
- Facility alerts and announcements

Each notification type uses a specifically designed email template with your studio's branding. If the SendGrid API key is missing or invalid, notifications will still be recorded in the system but emails will not be sent.