FROM node:20-alpine AS app-base
WORKDIR /app

FROM app-base AS app-builder
COPY package*.json ./
RUN npm ci
COPY . .
# Make sure the docker-entrypoint.sh file has executable permissions
RUN chmod +x docker-entrypoint.sh
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
COPY --from=app-builder /app/docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

ENV NODE_ENV=production
ENV PORT=5000

EXPOSE ${PORT}

ENTRYPOINT ["/app/docker-entrypoint.sh"]