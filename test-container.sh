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

# Check if containers are running and healthy
check_containers() {
  print_header "Checking container status"
  
  # Check if app container is running
  if docker ps | grep bookstuio-app > /dev/null; then
    print_success "Application container is running"
    
    # Check if app container is healthy
    if docker ps | grep bookstuio-app | grep "(healthy)" > /dev/null; then
      print_success "Application container is healthy"
    elif docker ps | grep bookstuio-app | grep "(starting)" > /dev/null; then
      print_info "Application container is still starting"
    else
      print_error "Application container is not healthy"
      print_info "Container health check details:"
      docker inspect --format "{{json .State.Health }}" bookstuio-app | jq
    fi
  else
    print_error "Application container is not running"
  fi
  
  # Check if DB container is running
  if docker ps | grep bookstuio-db > /dev/null; then
    print_success "Database container is running"
    
    # Check if DB container is healthy
    if docker ps | grep bookstuio-db | grep "(healthy)" > /dev/null; then
      print_success "Database container is healthy"
    elif docker ps | grep bookstuio-db | grep "(starting)" > /dev/null; then
      print_info "Database container is still starting"
    else
      print_error "Database container is not healthy"
      print_info "Container health check details:"
      docker inspect --format "{{json .State.Health }}" bookstuio-db | jq
    fi
  else
    print_error "Database container is not running"
  fi
}

# Check application logs
check_application_logs() {
  print_header "Recent application logs"
  
  # Get the latest 20 log lines
  docker logs bookstuio-app --tail 20
}

# Test the HTTP endpoints
test_http_endpoints() {
  print_header "Testing HTTP endpoints"
  
  # Get container IP
  container_ip=$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' bookstuio-app)
  
  # Test the health endpoint
  print_info "Testing health endpoint..."
  health_response=$(curl -s -o /dev/null -w "%{http_code}" http://$container_ip:3000/health)
  
  if [ "$health_response" = "200" ]; then
    print_success "Health endpoint is responding: HTTP $health_response"
  else
    print_error "Health endpoint returned HTTP $health_response"
  fi
  
  # Test the API endpoint
  print_info "Testing auth endpoint..."
  auth_response=$(curl -s -o /dev/null -w "%{http_code}" http://$container_ip:3000/api/auth/user)
  
  if [ "$auth_response" = "401" ]; then
    print_success "Auth endpoint is correctly returning HTTP $auth_response (unauthorized)"
  else
    print_error "Auth endpoint returned unexpected HTTP $auth_response"
  fi
}

# Main test process
main() {
  print_header "BookStud.io Container Test"
  
  check_containers
  check_application_logs
  test_http_endpoints
  
  print_header "Test complete"
}

# Run tests
main