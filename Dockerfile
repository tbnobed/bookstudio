FROM node:20-alpine

WORKDIR /app

# Install dependencies first (for better caching)
COPY package.json package-lock.json ./
RUN npm ci

# Copy the rest of the application
COPY . .

# Build the application
RUN npm run build

# Skip TypeScript compilation - we'll use the JavaScript files directly
# The JS files are already created and work properly

# Expose the port
EXPOSE 3000

# Define environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Start the application
CMD ["node", "dist/index.js"]