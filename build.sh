#!/bin/bash
set -e

# Print section header
print_header() {
  echo ""
  echo "============================================"
  echo "  $1"
  echo "============================================"
  echo ""
}

# Print success message
print_success() {
  echo "✅ $1"
}

# Print error message
print_error() {
  echo "❌ $1"
}

# Print info message
print_info() {
  echo "ℹ️ $1"
}

# Build the application
build_application() {
  print_header "Building BookStud.io application"
  
  print_info "Installing dependencies..."
  npm ci
  
  print_info "Building application..."
  npm run build
  
  print_success "Application built successfully!"
}

# Main build process
main() {
  print_header "BookStud.io Build Script"
  
  # Set NODE_ENV to production for optimal build
  export NODE_ENV=production
  
  # Build the application
  build_application
  
  print_success "Build completed successfully!"
}

# Run build
main