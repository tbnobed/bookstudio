# BookStud.io - Television Studio Management System

A comprehensive web application for television studio management, providing intelligent scheduling, booking, and access control tools with enhanced multi-booking capabilities.

## Features

- **Comprehensive Calendar Views**: Daily, weekly, and monthly views for studio bookings
- **Real-time Status Indicators**: See which studios are available, booked, or in maintenance 
- **Template System**: Save and reuse common production setups
- **Role-based Authentication**: Different access levels for producers, engineers, and administrators
- **Facility-wide Alerts**: System for outages and maintenance notifications
- **Email Notifications**: Automated emails for booking confirmations, updates, and cancellations
- **Public Calendar Integration**: Embeddable public view of studio availability
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
- Runs all necessary migrations
- Initializes default data
- Starts the web server

The application will be running at `http://your-server-ip:5000`

### Understanding the Docker Deployment Process

The Docker deployment follows this sequence:
1. The PostgreSQL database container (`db`) starts first
2. Once the database is healthy (responds to connection attempts), the database initialization container (`db-init`) runs:
   - Creates all necessary database tables
   - Seeds initial data including default users and notification groups
   - Exits when complete
3. After successful database initialization, the main application container (`app`) starts
4. The application serves both the frontend and backend on port 5000

This process ensures that the database is fully configured before the application attempts to use it.

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
- **Producer**: username: `producer`, password: `producer123`
- **Engineer**: username: `engineer`, password: `engineer123`

*Important: Change these passwords immediately after first login for security.*