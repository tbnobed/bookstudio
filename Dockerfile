FROM node:20-alpine AS app-base
WORKDIR /app

FROM app-base AS app-builder
COPY package*.json ./
RUN npm ci
COPY . .
# First make sure the client/dist directory exists
RUN mkdir -p client/dist
# Now run the build
RUN npm run build

FROM app-base AS app-runner
COPY package*.json ./
RUN npm ci --omit=dev
# Copy the dist directory which contains the built client and server
COPY --from=app-builder /app/dist /app/dist
# Copy necessary files for operation
COPY --from=app-builder /app/server /app/server
COPY --from=app-builder /app/shared /app/shared
COPY --from=app-builder /app/scripts /app/scripts
# Create the entrypoint script directly in the container
RUN echo '#!/bin/bash' > /app/entrypoint.sh && \
    echo 'set -e' >> /app/entrypoint.sh && \
    echo '' >> /app/entrypoint.sh && \
    echo '# Wait for PostgreSQL to be ready' >> /app/entrypoint.sh && \
    echo 'echo "Waiting for PostgreSQL to be ready..."' >> /app/entrypoint.sh && \
    echo 'until node --input-type=module -e "' >> /app/entrypoint.sh && \
    echo 'import pg from \"pg\";' >> /app/entrypoint.sh && \
    echo 'const { Pool } = pg;' >> /app/entrypoint.sh && \
    echo 'const pool = new Pool({' >> /app/entrypoint.sh && \
    echo '  connectionString: process.env.DATABASE_URL' >> /app/entrypoint.sh && \
    echo '});' >> /app/entrypoint.sh && \
    echo 'try {' >> /app/entrypoint.sh && \
    echo '  await pool.query(\"SELECT 1\");' >> /app/entrypoint.sh && \
    echo '  console.log(\"PostgreSQL is ready\");' >> /app/entrypoint.sh && \
    echo '  process.exit(0);' >> /app/entrypoint.sh && \
    echo '} catch (err) {' >> /app/entrypoint.sh && \
    echo '  console.error(\"PostgreSQL connection error:\", err);' >> /app/entrypoint.sh && \
    echo '  process.exit(1);' >> /app/entrypoint.sh && \
    echo '}' >> /app/entrypoint.sh && \
    echo '" > /dev/null 2>&1; do' >> /app/entrypoint.sh && \
    echo '  echo "PostgreSQL is not ready yet - waiting..."' >> /app/entrypoint.sh && \
    echo '  sleep 2' >> /app/entrypoint.sh && \
    echo 'done' >> /app/entrypoint.sh && \
    echo '' >> /app/entrypoint.sh && \
    echo '# Run database migrations' >> /app/entrypoint.sh && \
    echo 'echo "Running database migrations..."' >> /app/entrypoint.sh && \
    echo 'NODE_ENV=production node --input-type=module scripts/migrate-db.js' >> /app/entrypoint.sh && \
    echo '' >> /app/entrypoint.sh && \
    echo '# Initialize first-time data (admin user, default studios, etc.) if needed' >> /app/entrypoint.sh && \
    echo 'echo "Initializing application data if needed..."' >> /app/entrypoint.sh && \
    echo 'NODE_ENV=production node --input-type=module scripts/init-db.js' >> /app/entrypoint.sh && \
    echo '' >> /app/entrypoint.sh && \
    echo '# Start the server' >> /app/entrypoint.sh && \
    echo 'echo "Starting BookStud.io application server..."' >> /app/entrypoint.sh && \
    echo 'if [ -f "dist/index.js" ]; then' >> /app/entrypoint.sh && \
    echo '  # First check if the built server exists' >> /app/entrypoint.sh && \
    echo '  exec node --input-type=module dist/index.js' >> /app/entrypoint.sh && \
    echo 'elif [ -f "server/docker-index.js" ]; then' >> /app/entrypoint.sh && \
    echo '  # Fall back to the Docker-specific server entry point' >> /app/entrypoint.sh && \
    echo '  exec node --input-type=module server/docker-index.js' >> /app/entrypoint.sh && \
    echo 'else' >> /app/entrypoint.sh && \
    echo '  echo "Error: No server entry point found!"' >> /app/entrypoint.sh && \
    echo '  exit 1' >> /app/entrypoint.sh && \
    echo 'fi' >> /app/entrypoint.sh && \
    chmod +x /app/entrypoint.sh

ENV NODE_ENV=production
ENV PORT=5000

EXPOSE ${PORT}

ENTRYPOINT ["/app/entrypoint.sh"]