# BookStud.io Docker Deployment Guide

This guide explains how to deploy BookStud.io on an Ubuntu Server 24.04 environment using Docker and Docker Compose.

## Prerequisites

- Ubuntu Server 24.04 LTS
- Docker (v24+)
- Docker Compose (v2+)

## Step 1: Install Docker and Docker Compose

If you don't already have Docker and Docker Compose installed, you can install them using the following commands:

```bash
# Update package index
sudo apt update

# Install required packages
sudo apt install -y apt-transport-https ca-certificates curl software-properties-common

# Add Docker's official GPG key
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# Add Docker repository
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Update and install Docker Engine
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Add your user to the docker group
sudo usermod -aG docker $USER

# Apply the new group (log out and back in to apply these changes)
newgrp docker
```

## Step 2: Clone the Repository

Clone the BookStud.io repository to your server:

```bash
# Replace with your actual repository URL
git clone https://github.com/yourusername/bookstudio.git
cd bookstudio
```

## Step 3: Configure Environment Variables

Create a `.env` file for your deployment:

```bash
cp .env.docker.example .env
```

Edit the `.env` file to set your environment-specific values:

```bash
nano .env
```

Make sure to update at minimum:
- `SESSION_SECRET`: Set to a strong random string
- `POSTGRES_PASSWORD`: Set to a strong password
- `SENDGRID_API_KEY`: Your SendGrid API key for email notifications (if used)

> **IMPORTANT:** The docker-compose.yml file is configured to read environment variables directly from the `.env` file. Any changes to environment variables should be made in this file. Both the application and database containers will automatically load these variables.

## Step 4: Deploy with Docker Compose

Build and start the containers:

```bash
# Build the containers
docker compose build

# Start the containers in detached mode
docker compose up -d
```

The application will be accessible at http://your-server-ip:5000

## Managing Your Deployment

### View logs

```bash
# View logs from all services
docker compose logs

# View logs from a specific service
docker compose logs app
docker compose logs postgres
```

### Stop the application

```bash
docker compose down
```

### Restart the application

```bash
docker compose restart
```

### Update to a new version

```bash
# Pull latest changes
git pull

# Rebuild and restart containers
docker compose down
docker compose build
docker compose up -d
```

## Persistent Data

The PostgreSQL database stores its data in a named Docker volume, which persists even when containers are removed.

## Backup and Restore

### Backup the database

```bash
docker compose exec postgres pg_dump -U bookstudio bookstudio > bookstudio_backup_$(date +%Y%m%d).sql
```

### Restore from backup

```bash
# Stop the services
docker compose down

# Start only the database
docker compose up -d postgres

# Wait for the database to be ready
sleep 10

# Restore from backup
cat your_backup_file.sql | docker compose exec -T postgres psql -U bookstudio bookstudio

# Start all services
docker compose up -d
```

## Security Considerations

1. Always change default passwords in the `.env` file
2. Consider setting up a reverse proxy with SSL (Nginx, Traefik, etc.)
3. Configure a firewall to limit access to the server
4. Regularly update the application and Docker images