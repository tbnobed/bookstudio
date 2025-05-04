FROM node:20-alpine AS app-base
WORKDIR /app

FROM app-base AS app-builder
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
# Skip TypeScript compilation for production - we'll rely on the build step above
# RUN npx tsc --project tsconfig.prod.json

FROM app-base AS app-runner
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=app-builder /app/client/dist /app/client/dist
COPY --from=app-builder /app/server /app/server
COPY --from=app-builder /app/shared /app/shared
COPY --from=app-builder /app/scripts /app/scripts
COPY --from=app-builder /app/docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

ENV NODE_ENV=production
ENV PORT=5000

EXPOSE ${PORT}

ENTRYPOINT ["/app/docker-entrypoint.sh"]