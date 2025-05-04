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

ENV NODE_ENV=production
ENV PORT=5000

EXPOSE ${PORT}

# Use a direct shell command as the entrypoint instead of a script file
CMD sh -c 'echo "Waiting for PostgreSQL to be ready..." && \
until node --input-type=module -e "import pg from \"pg\"; const { Pool } = pg; const pool = new Pool({ connectionString: process.env.DATABASE_URL }); try { await pool.query(\"SELECT 1\"); console.log(\"PostgreSQL is ready\"); process.exit(0); } catch (err) { console.error(\"PostgreSQL connection error:\", err); process.exit(1); }" > /dev/null 2>&1; do echo "PostgreSQL is not ready yet - waiting..."; sleep 2; done && \
echo "Running database migrations..." && \
NODE_ENV=production node --input-type=module scripts/migrate-db.js && \
echo "Initializing application data if needed..." && \
NODE_ENV=production node --input-type=module scripts/init-db.js && \
echo "Starting BookStud.io application server..." && \
if [ -f "dist/index.js" ]; then \
  exec node --input-type=module dist/index.js; \
elif [ -f "server/docker-index.js" ]; then \
  exec node --input-type=module server/docker-index.js; \
else \
  echo "Error: No server entry point found!" && \
  exit 1; \
fi'