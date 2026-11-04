# syntax=docker/dockerfile:1.20
# apps/web/Dockerfile — build context is the repo root

# Typst is released as a .tar.xz, which the slim image has no tools to unpack.
FROM oven/bun:1.4.4 AS typst
RUN apt-get update && apt-get install -y --no-install-recommends xz-utils && rm -rf /var/lib/apt/lists/*
WORKDIR /repo
COPY --parents packages/pdf-export/scripts/installTypst.ts packages/pdf-export/src/typstBinary.ts ./
RUN bun packages/pdf-export/scripts/installTypst.ts

FROM oven/bun:1.4.4-slim
WORKDIR /repo

# Manifests first, so code changes reuse the installed dependencies.
COPY package.json bun.lock ./
COPY --parents apps/*/package.json packages/*/package.json ./
RUN bun install --frozen-lockfile --production --ignore-scripts --filter '@tid/web'

# Bun reads the root tsconfig at runtime for the JSX import source.
COPY tsconfig.json ./
COPY packages/ packages/
COPY apps/web/ apps/web/
COPY --from=typst /repo/packages/pdf-export/.typst packages/pdf-export/.typst

WORKDIR /repo/apps/web
ENV NODE_ENV=production
USER bun
EXPOSE 3000/tcp
CMD ["bun", "src/server.tsx"]
