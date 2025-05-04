FROM node:20-alpine

WORKDIR /app

# Install necessary system packages
RUN apk add --no-cache curl postgresql-client bash

# Copy package.json first to leverage Docker cache
COPY package.json package-lock.json ./
RUN npm ci

# Copy application files
COPY . .
RUN chmod +x docker-entrypoint.sh

# Build the application
RUN npm run build

# Expose application port
EXPOSE 3000