#!/bin/bash

# Script to reset PCR room IDs to start from 1
# This maintains proper order and fixes existing bookings

echo "Running PCR room ID reset script..."
tsx scripts/reset-pcr-room-ids.ts

echo "PCR room ID reset completed!"