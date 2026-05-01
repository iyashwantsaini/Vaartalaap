# Multi-stage build for the Vaartalaap API server.
# Builds the workspace shared package + server, then runs the compiled JS.

FROM node:20-alpine AS builder
WORKDIR /app

# Copy manifests first for better layer caching
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/server/package.json apps/server/
COPY apps/client/package.json apps/client/

RUN npm install --legacy-peer-deps --ignore-scripts

# Copy source and tsconfigs
COPY tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/server ./apps/server

RUN npm --workspace @vaartalaap/shared run build \
 && npm --workspace @vaartalaap/server run build

# ---- Runtime ----
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Copy only what's needed to run
COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/server/package.json ./apps/server/
COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/apps/client/package.json ./apps/client/

# Install only production deps for the server workspace
RUN npm install --omit=dev --legacy-peer-deps --ignore-scripts \
 && npm cache clean --force

EXPOSE 4000
CMD ["node", "apps/server/dist/index.js"]
