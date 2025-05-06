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
COPY attached_assets/ ./attached_assets/
COPY *.ts ./
COPY *.js ./
COPY *.json ./
COPY vite-stub.js ./

# Ensure booking copy script is included
RUN test -f scripts/apply-booking-copy.ts || echo "Booking copy script not found"

# Build the application (standard build with Vite)
RUN npm run build

# Make a backup of the build files for debugging if needed
RUN cp ./dist/index.js ./dist/index.js.original || true

# Stage 2: Production stage
FROM node:20.18.1-alpine3.19

WORKDIR /app

# Set environment variables
ENV RUNNING_IN_DOCKER=true
ENV PORT=5000
ENV NODE_ENV=production
ENV TZ=America/Chicago

# Accept build arguments for customizing the build
ARG VITE_PATCHING=false

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

# Install production dependencies only - we don't need Vite plugins in production
# since we've patched the imports in the build step
RUN npm ci --only=production

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/server ./server
COPY --from=builder /app/shared ./shared

# Copy other necessary files
COPY public ./public
COPY attached_assets ./attached_assets
COPY tsconfig.json .

# Copy Vite production replacement file and vite-stub
COPY server/vite.prod.ts ./dist/server/vite.js
COPY vite-stub.js ./dist/vite-stub.js

# Fix import paths in production build - replace Vite plugin imports with our stub file
RUN echo "Applying Vite plugin patches" \
    && sed -i 's/from.*@vitejs\/plugin-react.*/from "\/app\/dist\/vite-stub.js";/g' ./dist/index.js \
    && sed -i 's/from.*vite.*/from "\/app\/dist\/vite-stub.js";/g' ./dist/index.js \
    && sed -i 's/cartographer.*/cartographer;/g' ./dist/index.js | true \
    && sed -i 's/runtimeErrorModal.*/runtimeErrorModal;/g' ./dist/index.js | true \
    && sed -i 's/from.*@replit\/vite-plugin-cartographer.*/from "\/app\/dist\/vite-stub.js";/g' ./dist/index.js \
    && sed -i 's/from.*@replit\/vite-plugin-runtime-error-modal.*/from "\/app\/dist\/vite-stub.js";/g' ./dist/index.js

# Use a more robust approach to patch function calls
RUN echo "Patching function calls" \
    && if grep -q "react()" ./dist/index.js; then \
        # Find all line numbers with react() calls
        echo "Found react() calls, patching..." \
        && LINE_NUMS=$(grep -n "react()" ./dist/index.js | cut -d':' -f1) \
        && for LINE in $LINE_NUMS; do \
            # Replace each individual occurrence with a valid plugin object
            sed -i "${LINE}s/react()/({ name: 'mock-react-plugin', transform: () => null })/" ./dist/index.js; \
        done; \
    fi \
    && if grep -q "cartographer()" ./dist/index.js; then \
        echo "Found cartographer() calls, patching..." \
        && LINE_NUMS=$(grep -n "cartographer()" ./dist/index.js | cut -d':' -f1) \
        && for LINE in $LINE_NUMS; do \
            sed -i "${LINE}s/cartographer()/({ name: 'mock-cartographer', transform: () => null })/" ./dist/index.js; \
        done; \
    fi \
    && if grep -q "runtimeErrorModal()" ./dist/index.js; then \
        echo "Found runtimeErrorModal() calls, patching..." \
        && LINE_NUMS=$(grep -n "runtimeErrorModal()" ./dist/index.js | cut -d':' -f1) \
        && for LINE in $LINE_NUMS; do \
            sed -i "${LINE}s/runtimeErrorModal()/({ name: 'mock-error-modal', transform: () => null })/" ./dist/index.js; \
        done; \
    fi

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