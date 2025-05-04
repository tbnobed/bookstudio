#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test configuration
NUM_REQUESTS=20
CONCURRENT=5
TARGET_URL="http://localhost:5000/api/studios"

echo "============================"
echo "BookStud.io Load Test"
echo "============================"
echo -e "${YELLOW}Target URL: ${TARGET_URL}${NC}"
echo -e "${YELLOW}Total Requests: ${NUM_REQUESTS}${NC}"
echo -e "${YELLOW}Concurrent Requests: ${CONCURRENT}${NC}"
echo ""

# Create a temporary file for results
results_file=$(mktemp)

# Function to make a single request and record time
make_request() {
  start_time=$(date +%s.%N)
  response=$(curl -s -o /dev/null -w "%{http_code}" "${TARGET_URL}")
  end_time=$(date +%s.%N)
  
  # Calculate response time
  time_diff=$(echo "$end_time - $start_time" | bc)
  
  # Record result
  echo "$time_diff $response" >> "$results_file"
  
  # Show progress dot
  echo -n "."
}

echo -e "${YELLOW}Starting load test...${NC}"
echo -n "Progress: "

# Start requests in background
for ((i=1; i<=$NUM_REQUESTS; i++)); do
  # Start requests in batches of $CONCURRENT
  make_request &
  
  # If we've started $CONCURRENT requests, wait for them to finish
  if (( i % CONCURRENT == 0 )); then
    wait
  fi
done

# Wait for any remaining requests
wait

echo "" # New line after progress dots

# Process results
total_time=0
success_count=0
failure_count=0
min_time=999999
max_time=0

while read -r line; do
  time=$(echo "$line" | cut -d' ' -f1)
  status=$(echo "$line" | cut -d' ' -f2)
  
  # Add to total time
  total_time=$(echo "$total_time + $time" | bc)
  
  # Update min/max
  if (( $(echo "$time < $min_time" | bc -l) )); then
    min_time=$time
  fi
  
  if (( $(echo "$time > $max_time" | bc -l) )); then
    max_time=$time
  fi
  
  # Count success/failure
  if [[ "$status" == "200" ]]; then
    success_count=$((success_count + 1))
  else
    failure_count=$((failure_count + 1))
  fi
done < "$results_file"

# Calculate average
average_time=$(echo "scale=4; $total_time / $NUM_REQUESTS" | bc)

# Print results
echo "============================"
echo -e "${GREEN}Load Test Results${NC}"
echo "============================"
echo -e "Successful requests: ${GREEN}${success_count}${NC}"
echo -e "Failed requests: ${RED}${failure_count}${NC}"
echo -e "Average response time: ${BLUE}${average_time} seconds${NC}"
echo -e "Minimum response time: ${BLUE}${min_time} seconds${NC}"
echo -e "Maximum response time: ${BLUE}${max_time} seconds${NC}"
echo -e "Throughput: ${GREEN}$(echo "scale=2; $NUM_REQUESTS / $total_time" | bc) requests/second${NC}"
echo "============================"

# Clean up
rm "$results_file"