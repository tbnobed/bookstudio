FROM node:20-alpine
WORKDIR /app

# Copy package.json files first to leverage Docker cache
COPY package*.json ./
RUN npm ci

# Copy the rest of the project files
COPY . .

# Build the application
RUN mkdir -p client/dist
RUN npm run build

# Set environment variables
ENV NODE_ENV=production
ENV PORT=5000

# Create a simple entrypoint script
RUN echo '#!/bin/sh' > /app/entrypoint.sh && \
    echo 'set -e' >> /app/entrypoint.sh && \
    echo 'echo "Waiting for PostgreSQL to be ready..."' >> /app/entrypoint.sh && \
    echo 'sleep 5' >> /app/entrypoint.sh && \
    echo 'echo "Running database migrations..."' >> /app/entrypoint.sh && \
    echo 'NODE_ENV=production node --input-type=module scripts/migrate-db.js' >> /app/entrypoint.sh && \
    echo 'echo "Initializing application data..."' >> /app/entrypoint.sh && \
    echo 'NODE_ENV=production node --input-type=module scripts/init-db.js' >> /app/entrypoint.sh && \
    echo 'echo "Starting BookStud.io server..."' >> /app/entrypoint.sh && \
    echo 'NODE_ENV=production node --input-type=module server/docker-index.js' >> /app/entrypoint.sh && \
    chmod +x /app/entrypoint.sh

# Expose the application port
EXPOSE ${PORT}

# Run the application
CMD ["/bin/sh", "/app/entrypoint.sh"]