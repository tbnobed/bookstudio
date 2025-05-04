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

# Use CMD instead of ENTRYPOINT for more robustness
CMD ["sh", "-c", "\
    echo 'Waiting for PostgreSQL to start...' && \
    ./wait-for-postgres.sh db 5432 && \
    echo 'PostgreSQL is up and running at db:5432 - executing command' && \
    echo 'Initializing database schema and tables...' && \
    npm run db:push && \
    echo 'Setting up notification groups...' && \
    node scripts/migrate-db.js && \
    echo 'Seeding initial data...' && \
    node scripts/init-db.js && \
    echo 'Database initialization complete!' && \
    echo 'Starting the application...' && \
    node dist/index.js"]