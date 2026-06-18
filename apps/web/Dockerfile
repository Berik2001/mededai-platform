# ─────────────────────────────────────────────────────────────────
# Next.js web app — multi-stage build within the pnpm + Turborepo monorepo.
# Build context is the REPO ROOT (see docker-compose.yml).
# ─────────────────────────────────────────────────────────────────
FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /repo

# ---- deps ----
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY packages/ui/package.json packages/ui/
RUN pnpm install --frozen-lockfile=false

# ---- build ----
FROM base AS build
# Bring the whole installed tree (root + per-package node_modules), then overlay
# source (node_modules is .dockerignore'd, so the installed deps survive).
COPY --from=deps /repo ./
COPY . .
# NEXT_PUBLIC_* are inlined at build time. Empty → same-origin "/api" (behind nginx).
ARG NEXT_PUBLIC_API_URL=""
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN pnpm turbo build --filter=@med/web

# ---- runner ----
FROM base AS runner
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/packages ./packages
COPY --from=build /repo/apps/web ./apps/web
COPY --from=build /repo/package.json /repo/pnpm-workspace.yaml ./
WORKDIR /repo/apps/web
EXPOSE 3000
CMD ["pnpm", "start"]
