FROM node:20.18.1-alpine3.19

WORKDIR /app

# Set environment variable to indicate we're in a Docker container
ENV RUNNING_IN_DOCKER=true

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

# Start the application
CMD ["npm", "start"]