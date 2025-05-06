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

# Ensure booking copy script is included
RUN test -f scripts/apply-booking-copy.ts || echo "Booking copy script not found"

# Build the application
RUN npm run build

# Stage 2: Production stage
FROM node:20.18.1-alpine3.19

WORKDIR /app

# Set environment variables
ENV RUNNING_IN_DOCKER=true
ENV PORT=5000
ENV NODE_ENV=production
ENV TZ=America/Chicago

# Install production-only dependencies
RUN apk add --no-cache curl wget tzdata

# Set timezone
RUN cp /usr/share/zoneinfo/America/Chicago /etc/localtime && \
    echo "America/Chicago" > /etc/timezone

# Create unprivileged user for running the application
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Create necessary directories
RUN mkdir -p logs uploads
RUN chown -R appuser:appgroup logs uploads
RUN chmod 755 uploads

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/scripts ./scripts

# Copy other necessary files
COPY public ./public

# Change ownership to the unprivileged user
RUN chown -R appuser:appgroup /app

# Switch to unprivileged user
USER appuser

# Expose application port
EXPOSE 5000

# Healthcheck to verify application is running
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:5000/ || exit 1

# Default command is overridden in docker-compose.yml to add migration step
CMD ["npm", "start"]