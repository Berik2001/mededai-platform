# ─────────────────────────────────────────────────────────────────
# NestJS API — multi-stage build within the pnpm + Turborepo monorepo.
# Build context is the REPO ROOT (see docker-compose.yml).
# ─────────────────────────────────────────────────────────────────
FROM node:20-alpine AS base
# openssl: required by Prisma to detect/run the correct query engine on musl.
RUN apk add --no-cache openssl && corepack enable
WORKDIR /repo

# ---- deps: cached layer keyed on the workspace manifests ----
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY packages/ui/package.json packages/ui/
RUN pnpm install --frozen-lockfile=false

# ---- build: generate Prisma client + compile shared → api ----
FROM base AS build
# Bring the whole installed tree (root + per-package node_modules), then overlay
# source (node_modules is .dockerignore'd, so the installed deps survive).
COPY --from=deps /repo ./
COPY . .
RUN pnpm --filter @med/api db:generate \
 && pnpm turbo build --filter=@med/api

# ---- runner: only what the API needs, preserving the pnpm layout ----
FROM node:20-alpine AS runner
# openssl: Prisma engine; postgresql16-client: pg_dump for the backup module.
RUN apk add --no-cache openssl postgresql16-client && corepack enable
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/packages ./packages
COPY --from=build /repo/apps/api ./apps/api
# tsconfig.base.json is needed by ts-node when running `pnpm db:seed`.
COPY --from=build /repo/package.json /repo/pnpm-workspace.yaml /repo/turbo.json /repo/tsconfig.base.json ./
WORKDIR /repo/apps/api
RUN chmod +x docker-entrypoint.sh
EXPOSE 4000
# Applies pending migrations, then starts the API.
CMD ["./docker-entrypoint.sh"]
