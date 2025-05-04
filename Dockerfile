FROM node:20-alpine

WORKDIR /app

# Install netcat and PostgreSQL client for the wait script and database connection checks
RUN apk add --no-cache netcat-openbsd postgresql-client bash

# Install dependencies first (for better caching)
COPY package.json package-lock.json ./
RUN npm ci

# Copy the rest of the application
COPY . .

# Make scripts executable
RUN chmod +x wait-for-postgres.sh docker-entrypoint.sh init-db-docker.sh simple-entrypoint.sh
RUN mkdir -p /app/scripts

# Prepare scripts for ES module compatibility
RUN echo '// This file is a specialized version for use with ES modules in scripts\n\
import { Pool } from \"pg\";\n\
import { drizzle } from \"drizzle-orm/node-postgres\";\n\
import * as schema from \"../shared/schema.js\";\n\
\n\
if (!process.env.DATABASE_URL) {\n\
  throw new Error(\n\
    \"DATABASE_URL must be set. Did you forget to provision a database?\",\n\
  );\n\
}\n\
\n\
// PostgreSQL connection for initialization scripts\n\
export const pool = new Pool({ connectionString: process.env.DATABASE_URL });\n\
export const db = drizzle(pool, { schema });\n\
' > /app/scripts/db.js

# Build the application
RUN npm run build

# Expose the port
EXPOSE 3000

# Define environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Use our simple entrypoint script as default entry point
# This makes it easier to override at runtime with the more complex 
# initialization sequence if needed
ENTRYPOINT ["/app/simple-entrypoint.sh"]