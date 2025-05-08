# Multi-stage build for reduced image size and better security
# Stage 1: Build stage
FROM node:20.18.1-alpine3.19 AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++ 

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

# Build the application directly in the Dockerfile
# Client build
RUN npm run build
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
    echo "    console.log('BookStudio Version: 1.4.0');" >> server-prod.js && \
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
ENV TZ=America/Chicago
ENV FACILITY_TIMEZONE=America/Chicago

# Install production-only dependencies
RUN apk add --no-cache curl wget tzdata

# Set timezone with proper configuration
RUN cp /usr/share/zoneinfo/America/Chicago /etc/localtime && \
    echo "America/Chicago" > /etc/timezone

# Create unprivileged user for running the application
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Create necessary directories with proper permissions
RUN mkdir -p logs uploads
RUN chown -R appuser:appgroup logs uploads
RUN chmod 755 uploads

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --production

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/scripts ./scripts

# Copy Docker-specific migration scripts
COPY scripts/docker-migrate-db.cjs ./scripts/
COPY scripts/docker-init-db.cjs ./scripts/
COPY scripts/docker-migrate-pcr-rooms.cjs ./scripts/
COPY scripts/docker-create-booking-studios.cjs ./scripts/
COPY scripts/docker-migrate-file-attachments.cjs ./scripts/
COPY scripts/docker-migrate-booking-colors.cjs ./scripts/
COPY scripts/docker-migrate-booking-status.cjs ./scripts/
COPY scripts/docker-migrate-site-manager-notifications.cjs ./scripts/

# Copy other necessary files
COPY public ./public

# Change ownership to the unprivileged user
RUN chown -R appuser:appgroup /app

# Switch to unprivileged user
USER appuser

# Expose application port
EXPOSE 5000

# Healthcheck to verify application is running properly
HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=3 \
  CMD wget -qO- http://localhost:5000/api/health || exit 1

# Default command is overridden in docker-compose.yml to add migration step
CMD ["node", "dist/index.js"]