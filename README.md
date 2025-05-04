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

- Docker and Docker Compose installed on your Linux system (Compatible with any version of Ubuntu, Debian, CentOS, etc.)
- Git for cloning the repository

### Simple Two-Step Deployment

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd bookstuio
   ```

2. Create a `.env` file from the example (or use environment variables in step 3):
   ```bash
   cp .env.example .env
   # Edit the .env file with your desired configuration
   nano .env
   ```

3. Build and start with just two commands:
   ```bash
   # Build the application
   docker compose build
   
   # Start the application
   docker compose up -d
   ```

That's it! The application will automatically:
- Set up the PostgreSQL database
- Run all necessary migrations
- Initialize default data
- Start the web server

The application will be running at `http://your-server-ip:5000`

### Checking Application Status

```bash
# View logs
docker compose logs -f

# Check container status
docker compose ps
```

### Environment Variables

These are the important environment variables you can configure in your `.env` file:

| Variable | Description | Default |
|----------|-------------|---------|
| PORT | Port where the application will run | 5000 |
| SESSION_SECRET | Secret for session encryption | (auto-generated if not set) |
| PGUSER | PostgreSQL username | postgres |
| PGPASSWORD | PostgreSQL password | postgres |
| PGDATABASE | PostgreSQL database name | bookstudio |
| PGPORT | PostgreSQL port | 5432 |
| PGHOST | PostgreSQL host | db |
| DATABASE_URL | Full PostgreSQL connection string | (auto-generated from other variables) |
| SENDGRID_API_KEY | SendGrid API key for email notifications | (required for email functionality) |

### Using with a Reverse Proxy (NGINX)

For production use, it's recommended to set up NGINX as a reverse proxy to handle SSL termination and serve the application. Here's a sample NGINX configuration:

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

## Maintenance

- **Viewing Logs**: `docker compose logs -f`
- **Stopping the Application**: `docker compose down`
- **Restarting the Application**: `docker compose restart`
- **Updating the Application**: Pull the latest changes, then run `docker compose build && docker compose up -d`

## Default Users

The system comes with these default users for initial login:

- **Admin**: username: `admin`, password: `admin123`
- **Producer**: username: `producer`, password: `producer123`
- **Engineer**: username: `engineer`, password: `engineer123`

*Important: Change these passwords immediately after first login for security.*