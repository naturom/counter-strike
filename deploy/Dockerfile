FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/server/package.json apps/server/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci --no-audit --no-fund
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run typecheck && npm test && npm run build
RUN npm prune --omit=dev --no-audit --no-fund

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=8080
WORKDIR /app
COPY --from=build --chown=node:node /app /app
USER node
EXPOSE 8080
CMD ["node", "apps/server/dist/index.cjs"]
