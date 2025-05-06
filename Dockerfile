# Multi-stage build for production deployment
FROM node:20.18.1-alpine3.19 AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++ 

# Install dependencies first (for better caching)
COPY package*.json ./
RUN npm ci

# Copy source files
COPY . .

# Build the application and shared schema files
RUN npm run build
RUN npx tsc --declaration shared/schema.ts --outDir shared/ --esModuleInterop --module CommonJS

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

# Create unprivileged user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Create necessary directories
RUN mkdir -p logs uploads
RUN chown -R appuser:appgroup logs uploads
RUN chmod 755 uploads

# Copy package files and install production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy only what's needed from the builder stage
COPY --from=builder /app/dist ./dist 
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/server/vite.prod.ts ./dist/server/vite.js
COPY --from=builder /app/public ./public
COPY --from=builder /app/attached_assets ./attached_assets
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# Ensure the shared directory exists with compiled schema
RUN mkdir -p shared
COPY --from=builder /app/shared/schema.js ./shared/
COPY --from=builder /app/shared/schema.d.ts ./shared/

# Copy production-specific file to handle server-side routes
RUN echo '// Production export stubs for Vite plugins\nexport function react() { return { name: "react-stub", transform: () => null } }\nexport function cartographer() { return { name: "cartographer-stub" } }\nexport function runtimeErrorModal() { return { name: "error-modal-stub" } }\nexport default { name: "default-stub" };\nexport const defineConfig = (config) => config;\n' > ./dist/vite-plugins-stub.js

# Ensure directories exist and have correct permissions
RUN mkdir -p logs uploads
RUN chown -R appuser:appgroup /app

# Switch to unprivileged user
USER appuser

# Expose application port
EXPOSE 5000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:5000/api/health || exit 1

# Start the application
CMD ["node", "dist/index.js"]