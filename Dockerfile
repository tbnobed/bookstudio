FROM node:20.18.1-alpine3.19

WORKDIR /app

# Set environment variable to indicate we're in a Docker container
ENV RUNNING_IN_DOCKER=true
ENV PORT=5000

# Install build dependencies
RUN apk add --no-cache python3 make g++ wget curl

# Create logs and uploads directories
RUN mkdir -p logs uploads
RUN chmod 777 uploads

# Install dependencies first (for better caching)
COPY package*.json ./
RUN npm ci

# Copy all source files
COPY . .

# Build the application
RUN npm run build

# Expose application port
EXPOSE 5000

# Healthcheck to verify application is running
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:5000/ || exit 1

# Default command is overridden in docker-compose.yml to add migration step
CMD ["npm", "start"]