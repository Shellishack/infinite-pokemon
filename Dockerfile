# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV ELECTRON_SKIP_BINARY_DOWNLOAD=1
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.server.json vite.config.ts ./
COPY game ./game
COPY scripts ./scripts
RUN npm run build
RUN npm prune --omit=dev

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    INFINITE_DATA_DIR=/app/data \
    CODEX_HOME=/home/node/.codex \
    CODEX_EXECUTABLE=/app/node_modules/@openai/codex/bin/codex.js \
    PORT=8787 \
    ADMIN_PORT=8788
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates git ripgrep && rm -rf /var/lib/apt/lists/*
COPY --from=build --chown=node:node /app/package.json /app/package-lock.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/dist-server ./dist-server
COPY --chown=node:node skills ./skills
COPY --chown=node:node game/content ./game/content
RUN mkdir -p /app/data /home/node/.codex && chown -R node:node /app/data /home/node/.codex
USER node
# The admin listener is loopback-only and must never be publicly published.
EXPOSE 8787
STOPSIGNAL SIGTERM
CMD ["node", "dist-server/game/server/index.js"]
