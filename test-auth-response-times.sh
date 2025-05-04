#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "============================"
echo "BookStud.io API Response Test with Authentication"
echo "============================"
echo ""

# Get session cookie by logging in
echo -e "${YELLOW}Logging in to get session cookie...${NC}"
login_response=$(curl -s -c cookies.txt -w "\n%{time_total}\n" -X POST \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' \
  "http://localhost:5000/api/auth/login")

login_time=$(echo "$login_response" | tail -n1)
login_body=$(echo "$login_response" | sed '$d')

if [[ "$login_body" == *"id"* ]]; then
  echo -e "${GREEN}Login successful in ${login_time} seconds${NC}"
  echo -e "${BLUE}$(grep -o "express:sess[^;]*" cookies.txt | head -1)${NC}"
  echo ""
else
  echo -e "${RED}Login failed. Cannot continue with authenticated tests.${NC}"
  echo -e "${RED}Response: $login_body${NC}"
  exit 1
fi

test_endpoint() {
  local endpoint=$1
  local method=${2:-GET}
  local description=${3:-$endpoint}
  local data=${4:-""}
  
  echo -e "${YELLOW}Testing: ${description}${NC}"
  
  # Send request with cookie and capture response time
  if [ "$method" = "GET" ]; then
    result=$(curl -s -b cookies.txt -w "\n%{time_total}\n" -X $method "http://localhost:5000${endpoint}")
  else
    result=$(curl -s -b cookies.txt -w "\n%{time_total}\n" -X $method \
      -H "Content-Type: application/json" \
      -d "$data" \
      "http://localhost:5000${endpoint}")
  fi
  
  # Extract response time from last line
  response_time=$(echo "$result" | tail -n1)
  response_body=$(echo "$result" | sed '$d')
  
  # Check if request was successful (response contains data)
  if [[ "$response_body" == *"id"* || "$response_body" == *"status"* ]]; then
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
  
  # Print first 100 chars of response for verification
  echo -e "Preview: ${BLUE}${response_body:0:100}...${NC}"
  echo ""
}

# Track the average response time
total_time=0
request_count=0

# Test API endpoints (now with authentication)
test_endpoint "/api/auth/user" "GET" "User Authentication Status"
total_time=$(echo "$total_time + $response_time" | bc)
request_count=$((request_count + 1))

test_endpoint "/api/studios" "GET" "List All Studios"
total_time=$(echo "$total_time + $response_time" | bc)
request_count=$((request_count + 1))

test_endpoint "/api/bookings" "GET" "List All Bookings"
total_time=$(echo "$total_time + $response_time" | bc)
request_count=$((request_count + 1))

test_endpoint "/api/templates" "GET" "List All Templates"
total_time=$(echo "$total_time + $response_time" | bc)
request_count=$((request_count + 1))

test_endpoint "/api/bookings/user" "GET" "Current User Bookings"
total_time=$(echo "$total_time + $response_time" | bc)
request_count=$((request_count + 1))

test_endpoint "/health" "GET" "Application Health Check"
total_time=$(echo "$total_time + $response_time" | bc)
request_count=$((request_count + 1))

# Calculate average
average_time=$(echo "scale=4; $total_time / $request_count" | bc)

echo "============================"
echo -e "Test completed"
echo -e "Average response time: ${GREEN}${average_time} seconds${NC}"
echo "============================"

# Clean up cookies file
rm cookies.txt