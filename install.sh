#!/bin/sh

# This script installs all necessary dependencies for BookStud.io on a fresh Ubuntu or other Linux system
# It can be used to prepare a server for deployment

set -e

# Use basic echo commands for broader shell compatibility
# Check if terminal supports colors
if [ -t 1 ]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    BLUE='\033[0;34m'
    NC='\033[0m' # No Color
    color_support=true
else
    # No color support
    RED=''
    GREEN=''
    YELLOW=''
    BLUE=''
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

print_message "$GREEN" "Starting BookStud.io installation process..."

# Check if running as root
if [ "$(id -u)" -ne 0 ]; then
    print_message "$YELLOW" "This script is not running as root. Some operations might fail."
    print_message "$YELLOW" "Consider running with sudo if you encounter permission errors."
    printf "Press Enter to continue or Ctrl+C to abort..."
    read dummy
fi

# Detect package manager
if command -v apt-get >/dev/null 2>&1; then
    PKG_MANAGER="apt-get"
    print_message "$BLUE" "Debian/Ubuntu-based system detected, using apt-get"
elif command -v dnf >/dev/null 2>&1; then
    PKG_MANAGER="dnf"
    print_message "$BLUE" "Fedora/RHEL-based system detected, using dnf"
elif command -v yum >/dev/null 2>&1; then
    PKG_MANAGER="yum"
    print_message "$BLUE" "RHEL/CentOS-based system detected, using yum"
elif command -v pacman >/dev/null 2>&1; then
    PKG_MANAGER="pacman"
    print_message "$BLUE" "Arch-based system detected, using pacman"
elif command -v zypper >/dev/null 2>&1; then
    PKG_MANAGER="zypper"
    print_message "$BLUE" "SUSE-based system detected, using zypper"
else
    print_message "$RED" "Unable to detect package manager. Please install required packages manually:"
    print_message "$RED" "Required packages: curl, git, build-essential, nodejs (v16+), npm, postgresql"
    exit 1
fi

# Update system
print_message "$BLUE" "Updating package list..."
case $PKG_MANAGER in
    apt-get)
        apt-get update -qq
        ;;
    dnf|yum)
        $PKG_MANAGER check-update -q || true # ignore non-zero exit code when updates are available
        ;;
    pacman)
        pacman -Sy --noconfirm
        ;;
    zypper)
        zypper refresh -q
        ;;
esac

# Install prerequisites
print_message "$BLUE" "Installing prerequisites..."
case $PKG_MANAGER in
    apt-get)
        apt-get install -y curl git build-essential
        ;;
    dnf|yum)
        $PKG_MANAGER install -y curl git gcc-c++ make
        ;;
    pacman)
        pacman -S --noconfirm curl git base-devel
        ;;
    zypper)
        zypper install -y curl git patterns-devel-base-devel_basis
        ;;
esac

# Install Node.js if not installed
if ! command -v node >/dev/null 2>&1; then
    print_message "$BLUE" "Installing Node.js and npm..."
    
    # Check if nvm exists, otherwise install it
    if ! command -v nvm >/dev/null 2>&1 && [ ! -d "$HOME/.nvm" ]; then
        print_message "$BLUE" "Installing nvm (Node Version Manager)..."
        curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.3/install.sh | bash
        
        # Source nvm
        if [ -f "$HOME/.nvm/nvm.sh" ]; then
            . "$HOME/.nvm/nvm.sh"
        elif [ -f "$HOME/.bashrc" ]; then
            . "$HOME/.bashrc"
        fi
    fi
    
    if command -v nvm >/dev/null 2>&1; then
        nvm install 20
        nvm use 20
    else
        # Fallback to package manager if nvm installation failed
        case $PKG_MANAGER in
            apt-get)
                curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
                apt-get install -y nodejs
                ;;
            dnf)
                dnf module install -y nodejs:20/default
                ;;
            yum)
                curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
                yum install -y nodejs
                ;;
            pacman)
                pacman -S --noconfirm nodejs npm
                ;;
            zypper)
                zypper install -y nodejs20 npm20
                ;;
        esac
    fi
fi

# Install PostgreSQL if not installed
if ! command -v psql >/dev/null 2>&1; then
    print_message "$BLUE" "Installing PostgreSQL..."
    case $PKG_MANAGER in
        apt-get)
            apt-get install -y postgresql postgresql-contrib
            ;;
        dnf|yum)
            $PKG_MANAGER install -y postgresql-server postgresql-contrib
            if [ "$PKG_MANAGER" = "dnf" ] || [ "$PKG_MANAGER" = "yum" ]; then
                if [ -x /usr/bin/postgresql-setup ]; then
                    /usr/bin/postgresql-setup --initdb
                fi
                systemctl enable postgresql
                systemctl start postgresql
            fi
            ;;
        pacman)
            pacman -S --noconfirm postgresql
            if [ "$(id -u)" -eq 0 ]; then
                # Initialize DB as postgres user
                su - postgres -c "initdb -D /var/lib/postgres/data"
                systemctl enable postgresql
                systemctl start postgresql
            else
                print_message "$YELLOW" "Please run 'sudo -u postgres initdb -D /var/lib/postgres/data' to initialize PostgreSQL"
                print_message "$YELLOW" "Then run 'sudo systemctl enable postgresql' and 'sudo systemctl start postgresql'"
            fi
            ;;
        zypper)
            zypper install -y postgresql-server postgresql
            if [ "$(id -u)" -eq 0 ]; then
                # Initialize DB
                if [ -x /usr/bin/postgresql-setup ]; then
                    /usr/bin/postgresql-setup --initdb
                else
                    su - postgres -c "initdb -D /var/lib/pgsql/data"
                fi
                systemctl enable postgresql
                systemctl start postgresql
            else
                print_message "$YELLOW" "Please run 'sudo systemctl enable postgresql' and 'sudo systemctl start postgresql'"
            fi
            ;;
    esac
fi

# Install PM2 for process management
if ! command -v pm2 >/dev/null 2>&1; then
    print_message "$BLUE" "Installing PM2 process manager..."
    npm install -g pm2
fi

print_message "$GREEN" "Installation completed successfully!"
print_message "$GREEN" "------------------------------------"
print_message "$GREEN" "To deploy BookStud.io, run:"
print_message "$BLUE" "  1. Copy your project files to the server"
print_message "$BLUE" "  2. Create a PostgreSQL database and user"
print_message "$BLUE" "  3. Configure .env file with your settings"
print_message "$BLUE" "  4. Run './deploy.sh' (with Docker) or './start.sh' (without Docker)"
print_message "$GREEN" "------------------------------------"

exit 0