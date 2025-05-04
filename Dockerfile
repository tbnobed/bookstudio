FROM node:20-alpine

WORKDIR /app

# Install dependencies first (for better caching)
COPY package.json package-lock.json ./
RUN npm ci

# Copy the rest of the application
COPY . .

# Build the application
RUN npm run build

# Compile TypeScript files for database initialization and migration
RUN npx tsc scripts/init-db.ts --outDir scripts/ --esModuleInterop true --module CommonJS
RUN npx tsc scripts/migrate-db.ts --outDir scripts/ --esModuleInterop true --module CommonJS

# Expose the port
EXPOSE 3000

# Define environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Start the application
CMD ["node", "dist/index.js"]