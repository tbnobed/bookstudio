FROM node:20-alpine

WORKDIR /app

# Install necessary system packages
RUN apk add --no-cache netcat-openbsd postgresql-client bash

# Copy package.json first to leverage Docker cache
COPY package.json package-lock.json ./
RUN npm ci

# Copy remaining files
COPY . .

# Ensure scripts are executable
RUN chmod +x wait-for-postgres.sh docker-entrypoint.sh init-db-docker.sh simple-entrypoint.sh

# Copy CommonJS scripts to the right locations for Docker compatibility
RUN mkdir -p /app/scripts /app/shared
COPY scripts/db.cjs scripts/init-db.cjs scripts/migrate-db.cjs scripts/schema.cjs /app/scripts/
RUN cp /app/scripts/schema.cjs /app/shared/schema.cjs

# Build the application
RUN npm run build

# Expose application port
EXPOSE 3000

# Use simple entrypoint for direct application start
ENTRYPOINT ["/app/simple-entrypoint.sh"]