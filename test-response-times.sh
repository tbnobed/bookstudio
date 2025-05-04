#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

echo "============================"
echo "BookStud.io API Response Test"
echo "============================"
echo ""

test_endpoint() {
  local endpoint=$1
  local method=${2:-GET}
  local description=${3:-$endpoint}
  
  echo -e "${YELLOW}Testing: ${description}${NC}"
  
  # Send request and capture response time
  if [ "$method" = "GET" ]; then
    result=$(curl -s -w "\n%{time_total}\n" -X $method "http://localhost:5000${endpoint}")
  else
    result=$(curl -s -w "\n%{time_total}\n" -X $method -H "Content-Type: application/json" "http://localhost:5000${endpoint}")
  fi
  
  # Extract response time from last line
  response_time=$(echo "$result" | tail -n1)
  response_body=$(echo "$result" | sed '$d')
  
  # Check if request was successful (response contains data)
  if [[ "$response_body" == *"id"* ]]; then
    status="Success"
    color=$GREEN
  else
    status="Failed"
    color=$RED
  fi
  
  # Print results
  echo -e "Status: ${color}${status}${NC}"
  echo -e "Response time: ${color}${response_time} seconds${NC}"
  echo -e "Response size: ${color}$(echo "$response_body" | wc -c) bytes${NC}"
  echo ""
}

# Test API endpoints
test_endpoint "/api/auth/user" "GET" "User Authentication Status"
test_endpoint "/api/studios" "GET" "List All Studios"
test_endpoint "/api/bookings" "GET" "List All Bookings"
test_endpoint "/api/templates" "GET" "List All Templates"
test_endpoint "/health" "GET" "Application Health Check"

echo "============================"
echo "Test completed"
echo "============================"