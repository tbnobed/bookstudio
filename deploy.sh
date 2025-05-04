#!/bin/sh

set -e

# Use basic echo commands for broader shell compatibility
# Check if terminal supports colors
if [ -t 1 ]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    NC='\033[0m' # No Color
    color_support=true
else
    # No color support
    RED=''
    GREEN=''
    YELLOW=''
    NC=''
    color_support=false
fi

# Print colored message if color is supported
print_message() {
    local color="$1"
    local message="$2"
    
    if [ "$color_support" = true ]; then
        printf "%b%s%b\n" "$color" "$message" "$NC"
    else
        printf "%s\n" "$message"
    fi
}

print_message "$GREEN" "Starting BookStud.io deployment process..."

# Check if Docker is installed
if ! command -v docker >/dev/null 2>&1; then
    print_message "$RED" "Error: Docker is not installed. Please install Docker before proceeding."
    exit 1
fi

# Check for docker-compose or docker compose (newer versions use the plugin system)
docker_compose_cmd=""
if command -v docker-compose >/dev/null 2>&1; then
    docker_compose_cmd="docker-compose"
elif docker compose version >/dev/null 2>&1; then
    docker_compose_cmd="docker compose"
else
    print_message "$RED" "Error: Docker Compose is not installed. Please install Docker Compose before proceeding."
    exit 1
fi

# Check if .env file exists
if [ ! -f .env ]; then
    print_message "$YELLOW" "Warning: .env file not found. Creating from .env.example..."
    if [ -f .env.example ]; then
        cp .env.example .env
        print_message "$YELLOW" "Please update the .env file with your actual values before continuing"
        printf "Press enter to continue after updating .env..."
        read dummy
    else
        print_message "$RED" "Error: .env.example file not found. Cannot create .env file."
        exit 1
    fi
fi

# Check required environment variables - using . instead of source for broader compatibility
. ./.env

# Check environment variables
check_env_var() {
    eval val=\$$1
    if [ -z "$val" ]; then
        print_message "$RED" "Error: Required environment variable $1 is not set in .env file."
        return 1
    fi
    return 0
}

env_error=0
for var in DATABASE_URL PGUSER PGPASSWORD PGDATABASE SENDGRID_API_KEY SESSION_SECRET; do
    if ! check_env_var "$var"; then
        env_error=1
    fi
done

if [ $env_error -eq 1 ]; then
    print_message "$RED" "Please update the .env file with the missing variables before continuing."
    exit 1
fi

# Create backup directory if it doesn't exist
mkdir -p backups

# Check if we're running in a production environment
if [ "$NODE_ENV" = "production" ]; then
    print_message "$YELLOW" "Production environment detected. Creating database backup..."
    
    # Create backup timestamp
    TIMESTAMP=$(date +"%Y%m%d%H%M%S")
    
    # Check if we can connect to existing database for backup
    if $docker_compose_cmd exec -T db pg_isready -U $PGUSER > /dev/null 2>&1; then
        print_message "$GREEN" "Backing up existing database..."
        $docker_compose_cmd exec -T db pg_dump -U $PGUSER $PGDATABASE > "backups/backup_${TIMESTAMP}.sql"
        print_message "$GREEN" "Database backup created at backups/backup_${TIMESTAMP}.sql"
    else
        print_message "$YELLOW" "No existing database found or database is not running. Skipping backup."
    fi
fi

print_message "$GREEN" "Building and starting containers..."
$docker_compose_cmd up -d --build

print_message "$GREEN" "Waiting for database to be ready..."
sleep 10 # Give the database some time to initialize

print_message "$GREEN" "Running database migrations..."
$docker_compose_cmd exec -T app npx tsx scripts/migrate-db.ts

print_message "$GREEN" "============================================"
print_message "$GREEN" "BookStud.io deployment completed successfully!"
print_message "$GREEN" "The application should now be running at:"
print_message "$GREEN" "http://localhost:${PORT:-5000}"
print_message "$GREEN" "============================================"

exit 0