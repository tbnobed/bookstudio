# BookStud.io - Television Studio Management System

A comprehensive web application for television studio management, providing intelligent scheduling, booking, and access control tools with enhanced multi-booking capabilities.

## Features

- **Comprehensive Calendar Views**: Daily, weekly, and monthly views for studio bookings
- **Real-time Status Indicators**: See which studios are available, booked, or in maintenance 
- **Multi-Studio Bookings**: Link multiple studios to a single booking for complex productions
- **PCR Integration**: Assign Production Control Rooms to bookings with clear visibility
- **Template System**: Save and reuse common production setups
- **Role-based Authentication**: Different access levels for producers, engineers, site managers, and administrators
- **Facility-wide Alerts**: System for outages and maintenance notifications
- **Email Notifications**: Automated emails for booking confirmations, updates, and cancellations
- **Public Calendar Integration**: Embeddable public view of studio availability with multi-studio booking display
- **Mobile-friendly UI**: Fully responsive design works on all devices

## Technology Stack

- **Frontend**: React.js with TypeScript, TailwindCSS, shadcn/ui components
- **Backend**: Node.js with Express
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Passport.js with session-based auth
- **Email**: SendGrid for transactional emails
- **Deployment**: Docker Compose for simplified deployment

## Docker-Only Deployment

BookStud.io uses a Docker-only deployment approach for maximum consistency and reliability across environments. This eliminates system-level dependency conflicts and ensures a predictable deployment experience.

### Prerequisites

- Docker and Docker Compose installed on your system
- Compatible with any Linux distribution (Ubuntu, Debian, CentOS, etc.)

### Simple Two-Command Deployment

1. Clone the repository and navigate to the directory:
   ```bash
   git clone <repository-url>
   cd bookstudio
   ```

2. Create a `.env` file from the example:
   ```bash
   cp .env.example .env
   # Edit the .env file with your configuration
   nano .env
   ```

3. Deploy with just two commands:
   ```bash
   # Build the application containers
   docker compose build
   
   # Start the application
   docker compose up -d
   ```

That's it! The system automatically:
- Sets up the PostgreSQL database
- Runs all necessary migrations (including PCR rooms and multi-studio booking support)
- Initializes default data
- Starts the web server

The application will be running at `http://your-server-ip:5000`

### Understanding the Docker Deployment Process

The Docker deployment follows this sequence:
1. The PostgreSQL database container (`db`) starts first
2. Once the database is healthy (responds to connection attempts), the database initialization container (`db-init`) runs:
   - Creates all necessary database tables
   - Runs migrations for PCR rooms and the booking-studios junction table
   - Seeds initial data including default users and notification groups
   - Exits when complete
3. After successful database initialization, the main application container (`app`) starts
4. The application serves both the frontend and backend on port 5000

This process ensures that the database is fully configured before the application attempts to use it.

### Session Persistence in Docker

BookStud.io uses PostgreSQL for session storage, ensuring user sessions persist even when containers restart. This provides several benefits:

1. **Consistent User Experience**: Users remain logged in even if the application container restarts
2. **Container Resilience**: Application updates or container restarts don't interrupt active user sessions
3. **Horizontal Scalability**: Multiple application containers can share session data

This session persistence is automatically configured when using Docker deployment. The following environment variables control session behavior:

- `SESSION_SECRET`: Secret key for session encryption
- `COOKIE_SECURE`: Set to `true` in production with HTTPS
- `COOKIE_SAME_SITE`: Cookie security policy (`lax`, `strict`, or `none`)

### Troubleshooting Docker Deployment

If you encounter issues during deployment, here are some common solutions:

#### Database Connection Issues

1. **Check container status**:
   ```bash
   docker compose ps
   ```
   Ensure that the `db` container shows as "running" and "healthy".

2. **View database initialization logs**:
   ```bash
   docker compose logs db-init
   ```
   Look for any error messages during the database setup process.

3. **Reset the database** if needed:
   ```bash
   # Stop all containers
   docker compose down
   
   # Remove the database volume
   docker volume rm bookstudio_postgres_data
   
   # Restart the application
   docker compose up -d
   ```

#### Application Container Not Starting

1. **Check app container logs**:
   ```bash
   docker compose logs app
   ```
   Look for error messages like "Error connecting to database" or other startup failures.

2. **Verify environment variables**:
   Make sure your `.env` file contains all necessary configuration, especially database connection parameters.

3. **Increase initialization wait time** if needed:
   If the database initialization is completing successfully but the app still has connection issues,
   edit the `db-init` container's command in `docker-compose.yml` to increase the `sleep` duration
   from 5 seconds to 10-15 seconds.

#### Network or Port Issues

1. **Check if port 5000 is available**:
   ```bash
   netstat -tuln | grep 5000
   ```
   If it's already in use, edit the port mapping in `docker-compose.yml`.

2. **Verify network connectivity** between containers:
   ```bash
   # Enter the app container
   docker compose exec app sh
   
   # Test database connection
   ping db
   ```

#### Authentication and Session Issues

1. **Users get logged out after container restart**:
   - Check that PostgreSQL session store is working properly
   - Ensure `DATABASE_URL` is correctly set
   - Verify that the PostgreSQL tables are properly created
   - Try setting explicit cookie settings:
     ```
     COOKIE_SECURE=false
     COOKIE_SAME_SITE=lax
     ```

2. **401 Unauthorized errors in logs**:
   - Check session configuration in `.env` file
   - Ensure the same `SESSION_SECRET` is used across restarts
   - Reset the session table if needed:
     ```bash
     docker compose exec db psql -U postgres bookstudio -c "DROP TABLE IF EXISTS session;"
     ```
   - Restart the application to recreate the session table:
     ```bash
     docker compose restart
     ```

#### SendGrid Email Issues

1. **Verify your SendGrid API key** is correctly set in the `.env` file
2. **Check email logs** in the application container:
   ```bash
   docker compose logs app | grep "SendGrid"
   ```

## Environment Configuration

### Required Environment Variables

These can be configured in your `.env` file:

| Variable | Description | Default |
|----------|-------------|---------|
| PORT | Application port | 5000 |
| SESSION_SECRET | Secret for session encryption | Auto-generated |
| COOKIE_SECURE | Whether to use secure cookies | false |
| COOKIE_SAME_SITE | SameSite cookie attribute | lax |
| SENDGRID_API_KEY | API key for SendGrid email notifications | Required for emails |

### Database Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| PGUSER | PostgreSQL username | postgres |
| PGPASSWORD | PostgreSQL password | postgres |
| PGDATABASE | PostgreSQL database name | bookstudio |
| PGHOST | PostgreSQL host | db |
| PGPORT | PostgreSQL port | 5432 |

## Production Deployment

### Using with NGINX as a Reverse Proxy

For production use, we recommend NGINX as a reverse proxy to handle SSL termination:

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Updating the Application

To update to the latest version:

```bash
git pull
docker compose build
docker compose up -d
```

### Database Backups

To backup the PostgreSQL database:

```bash
docker compose exec db pg_dump -U postgres bookstudio > backup_$(date +%Y%m%d_%H%M%S).sql
```

To restore from a backup:

```bash
cat backup_file.sql | docker compose exec -T db psql -U postgres bookstudio
```

## Administration

### Viewing Container Logs

```bash
# View all container logs
docker compose logs -f

# View only app container logs
docker compose logs -f app

# View only database logs
docker compose logs -f db
```

### Container Management

```bash
# Stop all containers
docker compose down

# Restart all containers
docker compose restart

# View container status
docker compose ps
```

## Default Users

The system comes with these default users for initial login:

- **Admin**: username: `admin`, password: `admin123`
- **Site Manager**: username: `sitemanager`, password: `sitemanager123`
- **Producer**: username: `producer`, password: `producer123`
- **Engineer**: username: `engineer`, password: `engineer123`

*Important: Change these passwords immediately after first login for security.*

## User Roles and Permissions

BookStud.io implements a comprehensive role-based access control system:

| Role | Permissions |
|------|-------------|
| **Admin** | Full access to all features including User Management, Reports, Studios, Bookings, Templates, Alerts, Settings |
| **Site Manager** | Access to Reports, Studios, Bookings, Templates, Maintenance, Alerts, Settings, and Producer Management (can only invite/manage producers) |
| **Engineer** | Access to Reports, Studios, Bookings, Templates, Maintenance, Alerts, Settings (no User Management) |
| **Producer** | Limited to creating/managing bookings, using templates, viewing studio availability, and personal settings |

This role hierarchy ensures that each user has appropriate access to system features based on their responsibilities in the organization.

## Production Control Room (PCR) Integration

BookStud.io includes support for Production Control Rooms (PCRs) - critical infrastructure that connects to one or more studios for complex productions:

- PCR assignments are linked to bookings and displayed in the calendar view
- When a booking has a PCR assigned, it shows as "Title (PCR X)" in the calendar
- PCR information is included in booking confirmation emails and notifications
- PCR status can be tracked and managed (available, maintenance, reserved)
- PCR information is visible in both standard and public calendar views

## Multi-Studio Booking

The system supports linking multiple studios to a single booking, essential for complex productions:

- Bookings can be scheduled across multiple studios simultaneously
- The booking-studio junction table maintains these relationships in the database
- When creating a booking, users can select multiple studios via checkboxes
- Each studio selected appears in the calendar with the same booking information
- The public calendar correctly displays multi-studio bookings
- Conflicts are automatically detected across all selected studios
- Email notifications include the complete list of studios booked