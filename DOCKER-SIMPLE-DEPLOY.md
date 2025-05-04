# Simple Docker Deployment for BookStud.io

This guide provides a straightforward approach to deploying BookStud.io using Docker and Docker Compose.

## Prerequisites

- Docker installed on your server
- Docker Compose installed on your server

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
docker-compose build
docker-compose up -d
```

That's it! The application will be available at http://your-server-ip:5000

## Troubleshooting

If you encounter any issues:

1. **Check the logs**

```bash
docker-compose logs
```

2. **Verify database connectivity**

```bash
docker-compose logs postgres
```

3. **Make sure all environment variables are set properly**

Remember that the Docker Compose configuration is set to read from your `.env` file.

## Updating the Application

To update to a new version:

```bash
git pull
docker-compose down
docker-compose build
docker-compose up -d
```