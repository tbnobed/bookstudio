#!/bin/bash
# Script to run the BookStud.io display fix and then start the application
node --experimental-modules scripts/fix-bookstudio-display.js
npm run dev