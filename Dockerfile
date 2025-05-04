FROM node:20-slim

# Set environment variables
ENV NODE_ENV=production
ENV IS_DOCKER=true
ENV HOST=0.0.0.0
ENV PORT=3000

# Create app directory
WORKDIR /app

# Install postgresql-client for database health checks
RUN apt-get update && apt-get install -y postgresql-client && rm -rf /var/lib/apt/lists/*

# Copy package files first (for better caching)
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy the rest of the application
COPY . .

# Set proper permissions for scripts
RUN find ./scripts -name "*.sh" -exec chmod +x {} \; || true
RUN chmod +x ./docker-entrypoint.sh
RUN chmod +x ./docker-healthcheck.sh

# Expose the port that the app will run on
EXPOSE 3000

# Use our custom entrypoint script
ENTRYPOINT ["/app/docker-entrypoint.sh"]

# Default command - use tail -f /dev/null to keep container running 
# even if the app crashes or exits
CMD ["sh", "-c", "npm run start & tail -f /dev/null"]