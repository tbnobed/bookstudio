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

# Set production environment
export NODE_ENV=production

# Check if the PORT variable is set in .env, if not use default 5000
if [ -z "$PORT" ]; then
    export PORT=5000
    print_message "$YELLOW" "PORT not set in .env, using default port 5000"
fi

print_message "$GREEN" "Starting BookStud.io application on port $PORT..."
node dist/index.js