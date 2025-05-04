FROM node:20-alpine

WORKDIR /app

# Install netcat for the wait script
RUN apk add --no-cache netcat-openbsd

# Install dependencies first (for better caching)
COPY package.json package-lock.json ./
RUN npm ci

# Copy the rest of the application
COPY . .

# Make the wait script executable
RUN chmod +x wait-for-postgres.sh

# Build the application
RUN npm run build

# Skip TypeScript compilation - we'll use the JavaScript files directly
# The JS files are already created and work properly

# Expose the port
EXPOSE 3000

# Define environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Copy the simple entrypoint script
COPY simple-entrypoint.sh /app/
RUN chmod +x /app/simple-entrypoint.sh

# Start with the simple entrypoint script
ENTRYPOINT ["/app/simple-entrypoint.sh"]