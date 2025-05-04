# BookStud.io - Television Studio Management System

A comprehensive web application for television studio management, providing intelligent scheduling, booking, and access control tools with enhanced multi-booking capabilities and streamlined containerized deployment.

## Features

- Studio reservation management via calendar interface
- Template-based bookings for common production setups
- Role-based access control system
- Email notifications for bookings and maintenance
- Public calendar view for embedding on websites
- Usage reports and analytics
- Mobile-friendly UI

## Requirements

- Ubuntu Linux server (recommended: 20.04 LTS or higher)
- Docker and Docker Compose installed
- Outbound internet access for SendGrid email delivery
- At least 2GB RAM and 10GB free disk space

## Quick Start Deployment

1. **Clone the repository**

   ```bash
   git clone https://github.com/your-org/bookstuio.git
   cd bookstuio
   ```

2. **Configure environment variables**

   Create a `.env` file by copying the example:

   ```bash
   cp .env.example .env
   ```

   Edit the `.env` file to add your SendGrid API key for email functionality:

   ```
   SENDGRID_API_KEY=your_sendgrid_api_key_here
   ```

3. **Make deployment script executable**

   ```bash
   chmod +x deploy.sh
   ```

4. **Run the deployment script**

   ```bash
   ./deploy.sh
   ```

5. **Access the application**

   After deployment completes, access the application at:
   
   ```
   http://your-server-ip:3000
   ```

   Default login credentials:
   - Username: `admin`
   - Password: `admin123`

   **Important**: Change the default password after first login!

## Manual Deployment Steps

If you prefer to deploy manually or if the automated script fails:

1. **Build the Docker images**

   ```bash
   docker compose build --no-cache
   ```

2. **Start the containers**

   ```bash
   docker compose up -d
   ```

3. **Check container status**

   ```bash
   docker compose ps
   ```

   Both containers should show as "Up" and "(healthy)".

## Troubleshooting

### Container Exits Immediately

If the application container exits immediately, check the logs:

```bash
docker compose logs app
```

Common causes:
- Database connection issues
- Port conflicts
- Missing environment variables

### Cannot Connect to Application

If you can't access the application in your browser:

1. Check if the container is running:
   ```bash
   docker ps | grep bookstuio-app
   ```

2. Check if the port is open on your firewall:
   ```bash
   sudo ufw status
   ```
   If port 3000 is not listed, open it:
   ```bash
   sudo ufw allow 3000/tcp
   ```

3. Verify the application logs:
   ```bash
   docker compose logs app
   ```

## Backing Up Your Data

To backup the PostgreSQL database:

```bash
docker compose exec db pg_dump -U postgres bookstudio > backup_$(date +%Y-%m-%d).sql
```

## Maintenance

### Viewing Logs

```bash
docker compose logs -f app   # Application logs
docker compose logs -f db    # Database logs
```

### Restarting the Application

```bash
docker compose restart app
```

### Stopping All Services

```bash
docker compose down
```

### Updating the Application

1. Pull the latest changes:
   ```bash
   git pull
   ```

2. Rebuild and restart:
   ```bash
   ./deploy.sh
   ```

## License

© 2025 Your Organization. All rights reserved.