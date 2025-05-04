# Simple Docker Deployment for BookStud.io

This guide provides a straightforward approach to deploying BookStud.io using Docker and Docker Compose.

## Prerequisites

- Docker installed on your server (version 20.10 or later)
- Docker Compose V2 installed on your server

## Quick Steps to Deploy

1. **Clone the repository**

```bash
git clone https://your-repository-url/bookstudio.git
cd bookstudio
```

2. **Setup environment variables**

```bash
cp .env.docker.example .env
```

Edit the `.env` file to set your environment-specific values:
- `SESSION_SECRET`: Set to a secure random string
- `POSTGRES_PASSWORD`: Set to a secure password
- `SENDGRID_API_KEY`: Add your SendGrid API key if you want email notifications

3. **Build and start the application**

```bash
# Build with no cache to ensure a clean build
docker compose build --no-cache

# Start in detached mode
docker compose up -d
```

That's it! The application will be available at http://your-server-ip:5000

## Troubleshooting

If you encounter any issues:

1. **Check the logs**

```bash
docker compose logs
```

2. **Troubleshoot the app container specifically**

```bash
docker compose logs app
```

3. **Verify database connectivity**

```bash
docker compose logs postgres
```

4. **Restart the containers if needed**

```bash
docker compose restart
```

5. **If all else fails, try a full rebuild**

```bash
docker compose down
docker compose build --no-cache
docker compose up -d
```

6. **Make sure all environment variables are set properly**

Remember that the Docker Compose configuration is set to read from your `.env` file.

## Updating the Application

To update to a new version:

```bash
git pull
docker compose down
docker compose build --no-cache
docker compose up -d
```

## Common Issues and Solutions

1. **"No such file or directory" errors**:  
   This usually means there's a path issue or a script is missing. Make sure all scripts have executable permissions with `chmod +x script-name.sh`.

2. **Database connection failures**:  
   The app might start before PostgreSQL is fully ready. Try restarting just the app with `docker compose restart app`.

3. **Blank page or other frontend issues**:  
   Check that the build process completed successfully with `docker compose logs app`. You may need to rebuild with the `--no-cache` flag.