# syntax=docker/dockerfile:1.20
# apps/web/Dockerfile — build context is the repo root
FROM oven/bun:1.4.3-slim
WORKDIR /repo

# Manifests first, so code changes reuse the installed dependencies.
COPY package.json bun.lock ./
COPY --parents apps/*/package.json packages/*/package.json ./
RUN bun install --frozen-lockfile --production --ignore-scripts --filter '@tid/web'

# Bun reads the root tsconfig at runtime for the JSX import source.
COPY tsconfig.json ./
COPY packages/ packages/
COPY apps/web/ apps/web/

WORKDIR /repo/apps/web
ENV NODE_ENV=production
USER bun
EXPOSE 3000/tcp
CMD ["bun", "src/server.tsx"]
