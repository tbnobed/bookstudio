#!/bin/sh

# This script is used to start the application in production mode
# It can be used to start the application directly on a server without Docker

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

# Check if node and npm are installed
if ! command -v node >/dev/null 2>&1; then
    print_message "$RED" "Error: Node.js is not installed. Please install Node.js before proceeding."
    exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
    print_message "$RED" "Error: npm is not installed. Please install npm before proceeding."
    exit 1
fi

# Check for correct Node.js version
REQUIRED_NODE_VERSION="20.18.1"
CURRENT_NODE_VERSION=$(node -v | sed 's/^v//')

if [ "$CURRENT_NODE_VERSION" != "$REQUIRED_NODE_VERSION" ]; then
    print_message "$YELLOW" "Warning: Current Node.js version is $CURRENT_NODE_VERSION, but BookStud.io requires version $REQUIRED_NODE_VERSION"
    
    # Try to use nvm if available
    if command -v nvm >/dev/null 2>&1 || [ -f "$HOME/.nvm/nvm.sh" ]; then
        if [ -f "$HOME/.nvm/nvm.sh" ]; then
            . "$HOME/.nvm/nvm.sh"
        fi
        
        if command -v nvm >/dev/null 2>&1; then
            print_message "$BLUE" "Attempting to switch to Node.js $REQUIRED_NODE_VERSION using nvm..."
            if nvm ls $REQUIRED_NODE_VERSION >/dev/null 2>&1; then
                nvm use $REQUIRED_NODE_VERSION
            else
                print_message "$BLUE" "Installing Node.js $REQUIRED_NODE_VERSION using nvm..."
                nvm install $REQUIRED_NODE_VERSION
                nvm use $REQUIRED_NODE_VERSION
            fi
        fi
    else
        # Try to use n if available
        if command -v npm >/dev/null 2>&1; then
            print_message "$BLUE" "Attempting to install Node.js $REQUIRED_NODE_VERSION using n..."
            npm install -g n
            n $REQUIRED_NODE_VERSION
        else
            print_message "$RED" "Please install Node.js version $REQUIRED_NODE_VERSION manually or run ./install.sh"
            printf "Press enter to continue anyway (not recommended) or Ctrl+C to abort..."
            read dummy
        fi
    fi
    
    # Verify if version changed
    CURRENT_NODE_VERSION=$(node -v | sed 's/^v//')
    if [ "$CURRENT_NODE_VERSION" != "$REQUIRED_NODE_VERSION" ]; then
        print_message "$YELLOW" "Warning: Still using Node.js $CURRENT_NODE_VERSION. Some features may not work correctly."
    else
        print_message "$GREEN" "Successfully switched to Node.js $REQUIRED_NODE_VERSION"
    fi
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

# Load environment variables - using . instead of source for broader compatibility
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

# Check if the build directory exists
if [ ! -d dist ] || [ ! -f dist/index.js ]; then
    print_message "$YELLOW" "Production build not found. Building application..."
    npm run build
fi

# Set production environment and timezone
export NODE_ENV=production
export TZ=America/Chicago
export FACILITY_TIMEZONE=America/Chicago

# Verify timezone settings
print_message "$BLUE" "Setting timezone to America/Chicago for consistent facility time handling"
date
print_message "$BLUE" "Current timezone: $(date +%Z)"

# Run any additional migration scripts for new features
print_message "$BLUE" "Running database migrations for new features..."

# Run the PCR rooms migration
if [ -f "scripts/migrate-pcr-rooms.ts" ]; then
    print_message "$BLUE" "Migrating PCR rooms schema..."
    npx tsx scripts/migrate-pcr-rooms.ts
else
    print_message "$YELLOW" "Warning: PCR rooms migration script not found"
fi

# Run the booking-studios junction table migration
if [ -f "scripts/create-booking-studios-table.ts" ]; then
    print_message "$BLUE" "Creating booking-studios junction table..."
    npx tsx scripts/create-booking-studios-table.ts
else
    print_message "$YELLOW" "Warning: Booking-studios junction table migration script not found"
fi

# Check if the PORT variable is set in .env, if not use default 5000
if [ -z "$PORT" ]; then
    export PORT=5000
    print_message "$YELLOW" "PORT not set in .env, using default port 5000"
fi

print_message "$GREEN" "Starting BookStud.io application on port $PORT..."
node dist/index.js