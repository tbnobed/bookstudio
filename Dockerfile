FROM node:20-slim

# Set environment variables
ENV NODE_ENV=production
ENV IS_DOCKER=true

# Create app directory
WORKDIR /app

# Copy package files first (for better caching)
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy the rest of the application
COPY . .

# Set proper permissions for scripts
RUN chmod +x scripts/*.sh

# Build the application
RUN npm run build

# Expose the port that the app will run on
EXPOSE 3000

# Define the command to run the application
CMD ["node", "dist/index.js"]