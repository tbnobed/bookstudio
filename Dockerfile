FROM node:20-slim AS builder

# Set environment variables for build
ENV NODE_ENV=development
ENV IS_DOCKER=true

# Create app directory
WORKDIR /app

# Copy package files first (for better caching)
COPY package*.json ./

# Install all dependencies (including dev dependencies needed for build)
RUN npm ci

# Copy the rest of the application
COPY . .

# Set proper permissions for scripts
RUN chmod +x scripts/*.sh

# Build the application
RUN npm run build

# Create production image
FROM node:20-slim

# Set environment variables
ENV NODE_ENV=production
ENV IS_DOCKER=true

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy the built application from the builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/public ./public

# Set proper permissions for scripts
RUN chmod +x scripts/*.sh

# Expose the port that the app will run on
EXPOSE 3000

# Define the command to run the application
CMD ["node", "dist/index.js"]