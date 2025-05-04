FROM node:20-slim

# Set environment variables
ENV NODE_ENV=production
ENV IS_DOCKER=true

# Create app directory
WORKDIR /app

# Install wget for health check
RUN apt-get update && apt-get install -y wget && rm -rf /var/lib/apt/lists/*

# Copy package files first (for better caching)
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy the rest of the application
COPY . .

# Build the application
RUN npm run build

# Remove development dependencies
RUN npm prune --production

# Expose the port that the app will run on
EXPOSE 3000

# Default command
CMD ["npm", "run", "start"]