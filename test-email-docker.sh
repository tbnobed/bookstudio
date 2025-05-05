#!/bin/bash

# Script to test email functionality in a Docker environment

# Check if docker-compose is running
if ! docker-compose ps | grep -q "app.*Up"; then
  echo "Error: Docker containers are not running. Please start them with 'docker-compose up -d'"
  exit 1
fi

# Display menu
echo "BookStud.io Email Testing Script"
echo "-------------------------------"
echo "1. Test password reset email"
echo "2. Test invitation email"
echo "3. Exit"
echo ""
read -p "Choose an option (1-3): " choice

case $choice in
  1)
    # Prompt for email
    read -p "Enter email address for password reset test: " email
    
    echo "Sending password reset test email to $email..."
    docker-compose exec app npx tsx server/test-reset.ts "$email"
    ;;
    
  2)
    # Prompt for email and role
    read -p "Enter email address for invitation test: " email
    read -p "Enter role for the user (producer, engineer, it, admin): " role
    
    echo "Sending invitation test email to $email with role $role..."
    docker-compose exec app npx tsx server/test-invite.ts "$email" "$role"
    ;;
    
  3)
    echo "Exiting..."
    exit 0
    ;;
    
  *)
    echo "Invalid option. Exiting."
    exit 1
    ;;
esac

echo ""
echo "Test completed."
echo "Note: If using a placeholder SendGrid API key, the email links will be printed to the console logs."
echo "You can view the logs with 'docker-compose logs app'"