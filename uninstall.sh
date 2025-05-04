#!/bin/bash

# ANSI color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colorized messages
print_message() {
    local color=$1
    local message=$2
    
    if [ -t 1 ]; then
        printf "${color}%s${NC}\n" "$message"
    else
        printf "%s\n" "$message"
    fi
}

print_message "$BLUE" "BookStud.io Docker-Only Cleanup Script"
print_message "$BLUE" "======================================="
print_message "$YELLOW" "This script helps you remove all non-Docker components installed by install.sh"
print_message "$YELLOW" "After running this script, you'll only need to use docker-compose for deployment"
echo

# Confirm before proceeding
read -p "Are you sure you want to proceed with cleanup? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_message "$GREEN" "Operation cancelled. Nothing has been removed."
    exit 0
fi

# Stop any running docker containers from previous installation methods
if command -v docker >/dev/null 2>&1; then
    print_message "$BLUE" "Stopping any existing docker containers..."
    docker compose down 2>/dev/null || true
fi

# Step 1: Remove Node.js if installed by install.sh
print_message "$BLUE" "STEP 1: Checking for installed Node.js version..."

# Check if nvm is being used (our script installs nvm)
if [ -f "$HOME/.nvm/nvm.sh" ]; then
    print_message "$BLUE" "Found NVM installation. Removing BookStud.io Node.js version..."
    . "$HOME/.nvm/nvm.sh"
    nvm uninstall 20.18.1 2>/dev/null || true
    print_message "$GREEN" "Removed Node.js 20.18.1 from NVM if it was installed."
fi

# Check if n is installed (our script uses n as a fallback)
if command -v n >/dev/null 2>&1; then
    print_message "$BLUE" "Found Node.js version manager 'n'. Removing..."
    sudo npm uninstall -g n 2>/dev/null || true
    print_message "$GREEN" "Removed Node.js version manager 'n'."
fi

# Step 2: Remove global NPM packages
print_message "$BLUE" "STEP 2: Removing global NPM packages installed by BookStud.io..."

if command -v npm >/dev/null 2>&1; then
    # Remove PM2 if it was installed
    if command -v pm2 >/dev/null 2>&1; then
        print_message "$BLUE" "Stopping PM2 processes..."
        pm2 stop all 2>/dev/null || true
        pm2 delete all 2>/dev/null || true
        
        print_message "$BLUE" "Removing PM2 process manager..."
        sudo npm uninstall -g pm2 2>/dev/null || true
    fi
    
    # Remove other global packages that might have been installed
    print_message "$BLUE" "Removing any other global packages..."
    sudo npm uninstall -g drizzle-kit tsx 2>/dev/null || true
    print_message "$GREEN" "Removed global NPM packages."
fi

# Step 3: Clean up systemd services if they exist
print_message "$BLUE" "STEP 3: Checking for BookStud.io systemd services..."

if [ -f "/etc/systemd/system/bookstudio.service" ]; then
    print_message "$BLUE" "Found BookStud.io systemd service. Removing..."
    sudo systemctl stop bookstudio.service 2>/dev/null || true
    sudo systemctl disable bookstudio.service 2>/dev/null || true
    sudo rm -f /etc/systemd/system/bookstudio.service
    sudo systemctl daemon-reload
    print_message "$GREEN" "Removed BookStud.io systemd service."
else
    print_message "$GREEN" "No BookStud.io systemd services found."
fi

# Step 4: Clean up temporary files
print_message "$BLUE" "STEP 4: Cleaning up temporary files..."
rm -rf ./tmp 2>/dev/null || true
rm -rf ./logs/*.log 2>/dev/null || true
print_message "$GREEN" "Temporary files removed."

# Step 5: Remove the install.sh and start.sh scripts - they're not needed
print_message "$BLUE" "STEP 5: Removing obsolete scripts (install.sh and start.sh)..."
if [ -f "./install.sh" ]; then
    rm -f ./install.sh
    print_message "$GREEN" "Removed install.sh script."
fi

if [ -f "./start.sh" ]; then
    rm -f ./start.sh
    print_message "$GREEN" "Removed start.sh script."
fi

print_message "$GREEN" "✅ Cleanup completed!"
print_message "$GREEN" "============================================"
print_message "$GREEN" "Your system is now set up for Docker-only deployment!"
print_message "$GREEN" "You can now deploy BookStud.io with just:"
print_message "$BLUE" "  docker compose build"
print_message "$BLUE" "  docker compose up -d"
print_message "$GREEN" "============================================"
print_message "$YELLOW" "Note: This script did NOT remove Docker, Docker Compose, or PostgreSQL"
print_message "$YELLOW" "as they are required for the Docker-based deployment."
print_message "$GREEN" "============================================"

exit 0