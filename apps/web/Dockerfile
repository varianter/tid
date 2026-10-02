# apps/web/Dockerfile — build context is the repo root
FROM oven/bun:1.4 AS base
WORKDIR /repo

COPY . .
RUN bun install --frozen-lockfile --production

WORKDIR /repo/apps/web
ENV NODE_ENV=production
USER bun
CMD ["bun", "src/server.tsx"]
