# Multi-stage build for reduced image size and better security
# Stage 1: Build stage
FROM node:20.18.1-alpine3.19 AS builder

WORKDIR /app

# Install build dependencies with retry logic
RUN apk update && \
    apk add --no-cache --retry 3 python3 make g++ || \
    (echo "Retrying with different mirror..." && \
     echo "http://dl-cdn.alpinelinux.org/alpine/v3.19/main" > /etc/apk/repositories && \
     echo "http://dl-cdn.alpinelinux.org/alpine/v3.19/community" >> /etc/apk/repositories && \
     apk update && apk add --no-cache python3 make g++) 

# Install dependencies first (for better caching)
COPY package*.json ./
RUN npm ci

# Copy source files needed for build
COPY client/ ./client/
COPY server/ ./server/
COPY shared/ ./shared/
COPY scripts/ ./scripts/
COPY public/ ./public/
COPY *.ts ./
COPY *.js ./
COPY *.json ./

# Copy .env file for build-time environment variables
COPY .env* ./

# Build with embedded environment variables using ARG and ENV
ARG VITE_OPENWEATHER_API_KEY
ARG VITE_WEATHER_LOCATION
ARG VITE_WEATHER_LAT
ARG VITE_WEATHER_LON
ARG VITE_FACILITY_TIMEZONE
ARG TZ
ENV VITE_OPENWEATHER_API_KEY=$VITE_OPENWEATHER_API_KEY
ENV VITE_WEATHER_LOCATION=$VITE_WEATHER_LOCATION
ENV VITE_WEATHER_LAT=$VITE_WEATHER_LAT
ENV VITE_WEATHER_LON=$VITE_WEATHER_LON
ENV VITE_FACILITY_TIMEZONE=$VITE_FACILITY_TIMEZONE
ENV TZ=$TZ

RUN echo "=== Building with environment variables ===" && \
    echo "VITE_OPENWEATHER_API_KEY=${VITE_OPENWEATHER_API_KEY}" && \
    echo "VITE_WEATHER_LOCATION=${VITE_WEATHER_LOCATION}" && \
    echo "VITE_WEATHER_LAT=${VITE_WEATHER_LAT}" && \
    echo "VITE_WEATHER_LON=${VITE_WEATHER_LON}" && \
    echo "VITE_FACILITY_TIMEZONE=${VITE_FACILITY_TIMEZONE}" && \
    echo "TZ=${TZ}" && \
    echo "=== Creating client .env for Vite ===" && \
    echo "VITE_OPENWEATHER_API_KEY=${VITE_OPENWEATHER_API_KEY}" > client/.env && \
    echo "VITE_WEATHER_LOCATION=${VITE_WEATHER_LOCATION}" >> client/.env && \
    echo "VITE_WEATHER_LAT=${VITE_WEATHER_LAT}" >> client/.env && \
    echo "VITE_WEATHER_LON=${VITE_WEATHER_LON}" >> client/.env && \
    echo "VITE_FACILITY_TIMEZONE=${VITE_FACILITY_TIMEZONE}" >> client/.env && \
    echo "=== Starting Vite build ===" && \
    npm run build
# Create a production-ready server file
RUN echo "import express from 'express';" > server-prod.js && \
    echo "import { registerRoutes } from './server/routes.js';" >> server-prod.js && \
    echo "import fs from 'fs';" >> server-prod.js && \
    echo "import path from 'path';" >> server-prod.js && \
    echo "const app = express();" >> server-prod.js && \
    echo "app.use(express.json({ limit: '50mb' }));" >> server-prod.js && \
    echo "app.use(express.urlencoded({ extended: false, limit: '50mb' }));" >> server-prod.js && \
    echo "(async () => {" >> server-prod.js && \
    echo "  const server = await registerRoutes(app);" >> server-prod.js && \
    echo "  const distPath = path.resolve(process.cwd(), 'dist/public');" >> server-prod.js && \
    echo "  app.use(express.static(distPath, { maxAge: '1d' }));" >> server-prod.js && \
    echo "  app.use('*', (req, res) => {" >> server-prod.js && \
    echo "    res.sendFile(path.resolve(distPath, 'index.html'));" >> server-prod.js && \
    echo "  });" >> server-prod.js && \
    echo "  const port = process.env.PORT || 5000;" >> server-prod.js && \
    echo "  server.listen({" >> server-prod.js && \
    echo "    port," >> server-prod.js && \
    echo "    host: '0.0.0.0'," >> server-prod.js && \
    echo "  }, () => {" >> server-prod.js && \
    echo "    console.log(`Server running on port ${port}`);" >> server-prod.js && \
    echo "    console.log(`Application timezone: ${process.env.TZ || 'UTC'}`);" >> server-prod.js && \
    echo "    console.log(`Facility timezone: ${process.env.FACILITY_TIMEZONE || process.env.TZ || 'UTC'}`);" >> server-prod.js && \
    echo "    console.log('BookStudio Version: 1.5.4 - Asset Management');" >> server-prod.js && \
    echo "  });" >> server-prod.js && \
    echo "})();" >> server-prod.js && \
    npx esbuild server-prod.js --platform=node --packages=external --bundle --format=esm --outfile=dist/index.js
# Ensure static files are properly copied
RUN mkdir -p dist/public && cp -r public/* dist/public/
# Make files accessible
RUN chmod -R 755 dist

# Stage 2: Production stage
FROM node:20.18.1-alpine3.19

WORKDIR /app

# Set environment variables
ENV RUNNING_IN_DOCKER=true
ENV PORT=5000
ENV NODE_ENV=production
# Timezone will be set via build args and runtime environment

# Install production-only system packages with timeout and retry logic
# Including PostgreSQL client tools for backup/restore functionality
RUN timeout 300 sh -c 'apk update && apk add --no-cache curl wget tzdata postgresql15-client' || \
    (echo "Primary install failed, trying alternative approach..." && \
     echo "http://dl-cdn.alpinelinux.org/alpine/v3.19/main" > /etc/apk/repositories && \
     echo "http://dl-cdn.alpinelinux.org/alpine/v3.19/community" >> /etc/apk/repositories && \
     timeout 300 sh -c 'apk update && apk add --no-cache curl wget tzdata postgresql15-client') || \
    (echo "Package install failed, trying with basic postgresql client..." && \
     timeout 300 sh -c 'apk update && apk add --no-cache curl wget tzdata postgresql-client') || \
    (echo "All package installs failed, using minimal setup..." && \
     echo "Backup functionality will be disabled")

# Create unprivileged user early so --chown flags below can reference it
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Create app directories with correct ownership up-front (no sweep needed later)
RUN mkdir -p logs uploads backups && \
    chown appuser:appgroup logs uploads backups && \
    chmod 755 uploads

# Install production Node dependencies
# node_modules is created by root with 755/644 (umask 022) — readable by appuser
COPY package*.json ./
RUN npm ci --production

# Copy built application from builder stage, setting ownership inline
COPY --chown=appuser:appgroup --from=builder /app/dist ./dist
COPY --chown=appuser:appgroup --from=builder /app/scripts ./scripts

# Copy migration scripts, setting ownership inline
COPY --chown=appuser:appgroup scripts/consolidated-migration.cjs ./scripts/
COPY --chown=appuser:appgroup scripts/schema-repair.cjs ./scripts/
COPY --chown=appuser:appgroup scripts/docker-migrate-linked-bookings.cjs ./scripts/
COPY --chown=appuser:appgroup scripts/clean-invalid-notifications.cjs ./scripts/
COPY --chown=appuser:appgroup scripts/production-migration-v1.5.1.cjs ./scripts/
COPY --chown=appuser:appgroup scripts/production-migration-v1.5.2.cjs ./scripts/
COPY --chown=appuser:appgroup scripts/docker-migrate-teams-v1.5.3.cjs ./scripts/
COPY --chown=appuser:appgroup scripts/docker-audit-schema-fix-v1.5.3.cjs ./scripts/
COPY --chown=appuser:appgroup scripts/production-migration-v1.5.4.cjs ./scripts/
COPY --chown=appuser:appgroup scripts/production-migration-v1.5.5.cjs ./scripts/
COPY --chown=appuser:appgroup scripts/production-migration-v1.5.6.cjs ./scripts/

# Copy backup/restore scripts and make them executable
COPY --chown=appuser:appgroup scripts/production-backup.sh ./scripts/
COPY --chown=appuser:appgroup scripts/production-restore.sh ./scripts/
RUN chmod +x /app/scripts/production-backup.sh /app/scripts/production-restore.sh

# Copy static assets
COPY --chown=appuser:appgroup public ./public

# Switch to unprivileged user — no chown -R sweep needed
USER appuser

# Expose application port
EXPOSE 5000

# Healthcheck to verify application is running properly
HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=3 \
  CMD wget -qO- http://localhost:5000/api/health || exit 1

# Default command is overridden in docker-compose.yml to add migration step
CMD ["node", "dist/index.js"]