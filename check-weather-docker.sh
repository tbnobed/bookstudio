#!/bin/bash

echo "=== Checking Weather API Configuration in Docker ==="
echo

# Check if containers are running
echo "1. Container Status:"
docker-compose ps

echo
echo "2. Weather Environment Variables:"
docker-compose exec app env | grep -E "(VITE_OPENWEATHER|VITE_WEATHER)" || echo "No weather environment variables found"

echo
echo "3. Testing Weather API Connection (if API key is set):"
WEATHER_KEY=$(docker-compose exec app env | grep VITE_OPENWEATHER_API_KEY | cut -d'=' -f2)
if [ ! -z "$WEATHER_KEY" ] && [ "$WEATHER_KEY" != "your_openweather_api_key_here" ]; then
    echo "API Key found, testing connection..."
    docker-compose exec app curl -s "https://api.openweathermap.org/data/2.5/weather?q=Dallas,TX,US&appid=${WEATHER_KEY}&units=imperial" | head -100
else
    echo "No valid API key found. Set VITE_OPENWEATHER_API_KEY in your .env file"
fi

echo
echo "4. Application Logs (last 20 lines):"
docker-compose logs --tail=20 app

echo
echo "5. Check if signage page is accessible:"
echo "Visit: http://localhost:5000/signage to test weather display"
echo "Or check container IP: docker inspect bookstudio-app-1 | grep IPAddress"