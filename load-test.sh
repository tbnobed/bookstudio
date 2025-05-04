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

# Default values
CONCURRENT_USERS=10
TEST_DURATION=30 # seconds
BASE_URL=${1:-"http://localhost:3000"}
ENDPOINT=${2:-"/health"}

# Run the load test
run_load_test() {
  print_header "Running load test for $BASE_URL$ENDPOINT"
  print_info "Concurrent users: $CONCURRENT_USERS"
  print_info "Test duration: $TEST_DURATION seconds"
  
  # Check if ApacheBench is installed
  if ! command -v ab &> /dev/null; then
    print_error "ApacheBench (ab) is required but not installed"
    print_info "Please install with: apt-get install apache2-utils"
    exit 1
  fi
  
  # Run the load test
  print_info "Starting load test..."
  
  ab -n $((CONCURRENT_USERS * 50)) -c $CONCURRENT_USERS -t $TEST_DURATION "$BASE_URL$ENDPOINT"
  
  print_success "Load test completed"
}

# Main function
main() {
  print_header "BookStud.io Load Test"
  
  # Run the load test
  run_load_test
}

# Run main
main