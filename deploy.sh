#!/bin/bash

set -e

# Colors for better readability
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting BookStud.io deployment process...${NC}"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed. Please install Docker before proceeding.${NC}"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}Error: Docker Compose is not installed. Please install Docker Compose before proceeding.${NC}"
    exit 1
fi

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}Warning: .env file not found. Creating from .env.example...${NC}"
    if [ -f .env.example ]; then
        cp .env.example .env
        echo -e "${YELLOW}Please update the .env file with your actual values before continuing${NC}"
        read -p "Press enter to continue after updating .env..."
    else
        echo -e "${RED}Error: .env.example file not found. Cannot create .env file.${NC}"
        exit 1
    fi
fi

# Check required environment variables
source .env
REQUIRED_VARS=("DATABASE_URL" "PGUSER" "PGPASSWORD" "PGDATABASE" "SENDGRID_API_KEY" "SESSION_SECRET")
MISSING_VARS=false

for VAR in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!VAR}" ]; then
        echo -e "${RED}Error: Required environment variable $VAR is not set in .env file.${NC}"
        MISSING_VARS=true
    fi
done

if [ "$MISSING_VARS" = true ]; then
    echo -e "${RED}Please update the .env file with the missing variables before continuing.${NC}"
    exit 1
fi

# Create backup directory if it doesn't exist
mkdir -p backups

# Check if we're running in a production environment
if [ "$NODE_ENV" = "production" ]; then
    echo -e "${YELLOW}Production environment detected. Creating database backup...${NC}"
    
    # Create backup timestamp
    TIMESTAMP=$(date +"%Y%m%d%H%M%S")
    
    # Check if we can connect to existing database for backup
    if docker-compose exec -T db pg_isready -U $PGUSER > /dev/null 2>&1; then
        echo -e "${GREEN}Backing up existing database...${NC}"
        docker-compose exec -T db pg_dump -U $PGUSER $PGDATABASE > "backups/backup_${TIMESTAMP}.sql"
        echo -e "${GREEN}Database backup created at backups/backup_${TIMESTAMP}.sql${NC}"
    else
        echo -e "${YELLOW}No existing database found or database is not running. Skipping backup.${NC}"
    fi
fi

echo -e "${GREEN}Building and starting containers...${NC}"
docker-compose up -d --build

echo -e "${GREEN}Waiting for database to be ready...${NC}"
sleep 10 # Give the database some time to initialize

echo -e "${GREEN}Running database migrations...${NC}"
docker-compose exec -T app npx tsx scripts/migrate-db.ts

echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}BookStud.io deployment completed successfully!${NC}"
echo -e "${GREEN}The application should now be running at:${NC}"
echo -e "${GREEN}http://localhost:${PORT:-5000}${NC}"
echo -e "${GREEN}============================================${NC}"

exit 0