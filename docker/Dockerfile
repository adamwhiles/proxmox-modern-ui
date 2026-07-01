# syntax=docker/dockerfile:1

FROM node:22-slim AS base
RUN corepack enable
WORKDIR /app

# ---- install dependencies (cached unless package.json/lockfile change) ----
FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/server/package.json apps/server/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/proxmox-client/package.json packages/proxmox-client/package.json
RUN pnpm install --frozen-lockfile

# ---- build the SPA ----
FROM deps AS build
COPY . .
RUN pnpm --filter @proxmox-ui/web run build

# ---- runtime image ----
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json /app/pnpm-workspace.yaml ./
COPY --from=build /app/packages ./packages
COPY --from=build /app/apps/server ./apps/server
COPY --from=build /app/apps/web/package.json ./apps/web/package.json
COPY --from=build /app/apps/web/dist ./apps/web/dist

RUN mkdir -p /app/data
VOLUME ["/app/data"]
EXPOSE 3000

# The server runs via tsx (TS executed directly) rather than a compiled bundle — see apps/server/package.json
# for the rationale. This keeps the image simple; a fully compiled build is a natural follow-up.
CMD ["pnpm", "--filter", "@proxmox-ui/server", "start"]
