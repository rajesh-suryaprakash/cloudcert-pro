# syntax=docker/dockerfile:1
# =============================================================================
# CloudCert Pro — Production Dockerfile
#
# Architecture: React (Vite) SPA + Express API server + SQLite
# Build strategy: Multi-stage — build tools stay out of the runtime image
# Runtime: Node.js 20 LTS (Alpine) running server.ts via tsx
#
# Required secrets at runtime (never bake into the image):
#   JWT_SECRET          — min 32 chars, for signing session tokens
#   RESET_TOKEN_SECRET  — min 32 chars, for password-reset tokens
#
# Optional env vars (see .env.example for full reference):
#   PORT                — defaults to 3000
#   ALLOWED_ORIGIN      — CORS origin, defaults to http://localhost:5173
#   SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS / SMTP_FROM
#   APP_URL
#
# Persistent storage:
#   Mount a volume at /app/data for the SQLite database file.
#   Example: docker run -v cloudcert-data:/app/data ...
# =============================================================================

# =============================================================================
# Stage 1: deps — install ALL dependencies (prod + dev) for the build
# =============================================================================
# Pinned to the multi-platform manifest digest for node:20-alpine (2026-04-15).
# Guide §2.1.1: "Pin base images to a digest for full supply-chain integrity."
# To update: docker pull node:20-alpine && docker inspect node:20-alpine --format '{{index .RepoDigests 0}}'
FROM node:20-alpine@sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293 AS deps

# Install build tools required by native modules (better-sqlite3 uses node-gyp)
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy manifests first — this layer is cached until package*.json changes
COPY package.json package-lock.json ./

# Install all dependencies (including devDependencies needed for the build)
RUN npm ci

# =============================================================================
# Stage 2: builder — compile TypeScript types, build the Vite frontend
# =============================================================================
FROM deps AS builder

# Copy the full source tree
COPY . .

# Build the React SPA into dist/
# NODE_ENV=production disables Vite HMR and enables production optimisations
RUN NODE_ENV=production npm run build

# =============================================================================
# Stage 3: prod-deps — install production-only dependencies cleanly
# Separating this from the builder stage keeps native module compilation
# isolated and ensures no dev tools leak into the final image.
# =============================================================================
FROM node:20-alpine@sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293 AS prod-deps

RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package.json package-lock.json ./

# --omit=dev installs only the packages listed under "dependencies"
RUN npm ci --omit=dev

# =============================================================================
# Stage 4: runtime — the final, minimal production image
# =============================================================================
FROM node:20-alpine@sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293 AS runtime

# ── OCI metadata ─────────────────────────────────────────────────────────────
# Populate COMMIT_SHA and BUILD_DATE from CI/CD at build time:
#   docker build \
#     --build-arg COMMIT_SHA=$(git rev-parse HEAD) \
#     --build-arg BUILD_DATE=$(date -u +%Y-%m-%dT%H:%M:%SZ) \
#     -t cloudcert-pro:1.0.0 .
ARG COMMIT_SHA=unknown
ARG BUILD_DATE=unknown

LABEL org.opencontainers.image.title="cloudcert-pro" \
      org.opencontainers.image.description="CloudCert Pro — cloud certification study platform" \
      org.opencontainers.image.version="1.0.0" \
      org.opencontainers.image.revision="${COMMIT_SHA}" \
      org.opencontainers.image.created="${BUILD_DATE}" \
      org.opencontainers.image.source="https://github.com/org/cloudcert-pro"

# ── System dependencies ───────────────────────────────────────────────────────
# better-sqlite3 is a native module — it needs the shared C++ runtime at runtime
# (not the full build toolchain, just the runtime library)
RUN apk add --no-cache libstdc++

# ── Non-root user + data directory ───────────────────────────────────────────
# All root-level filesystem operations are consolidated here before USER is set.
# Alpine BusyBox adduser flags (NOT the same as Debian/Ubuntu adduser):
#   -S  = system user (no password, no aging)
#   -D  = do not assign a password
#   -H  = do not create home directory (Alpine equivalent of --no-create-home)
#   -G  = primary group
# Note: --no-create-home and --no-log-init are Debian-only flags and do NOT
#       exist in Alpine's BusyBox implementation.
RUN addgroup -S appgroup && \
    adduser -S -D -H -G appgroup appuser && \
    mkdir -p /app/data && \
    chown appuser:appgroup /app/data

WORKDIR /app

# ── Copy artefacts from earlier stages ───────────────────────────────────────
# Production node_modules (native modules already compiled for this platform)
COPY --from=prod-deps --chown=appuser:appgroup /app/node_modules ./node_modules

# Compiled React SPA
COPY --from=builder --chown=appuser:appgroup /app/dist ./dist

# Application source needed at runtime by tsx (server.ts + src/server/**)
# tsx compiles TypeScript on-the-fly; no separate tsc emit step is needed
COPY --chown=appuser:appgroup server.ts ./
COPY --chown=appuser:appgroup src/server ./src/server
COPY --chown=appuser:appgroup tsconfig.json ./

# ── Data directory for SQLite ─────────────────────────────────────────────────
# The database file lives at /app/data/cloudcert.db inside the container.
# Mount a named volume here so data persists across container restarts:
#   docker run -v cloudcert-data:/app/data cloudcert-pro:latest
#
# NOTE: The connection module currently hardcodes 'cloudcert.db' in the CWD.
# Set DB_PATH or update connection.ts to point to /app/data/cloudcert.db
# before deploying to production with a persistent volume.
VOLUME ["/app/data"]

# ── Runtime configuration ─────────────────────────────────────────────────────
# Guide §2.6.5: ENV is image configuration — set before USER switch.
# Never set secrets here; inject JWT_SECRET and RESET_TOKEN_SECRET at runtime.
ENV NODE_ENV=production \
    PORT=3000

# ── Switch to non-root user ───────────────────────────────────────────────────
# Guide §1.5, §2.6.5: USER set after all root operations are complete.
USER appuser

# ── Health check ──────────────────────────────────────────────────────────────
# Kubernetes liveness/readiness probes will use this.
# Adjust the path if you add a dedicated /health endpoint.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health 2>/dev/null || \
      wget -qO- http://localhost:3000/ 2>/dev/null || exit 1

# ── Expose port ───────────────────────────────────────────────────────────────
EXPOSE 3000

# ── Entrypoint ────────────────────────────────────────────────────────────────
# ENTRYPOINT sets the fixed executable — it becomes PID 1 and receives SIGTERM
# from Docker/Kubernetes for graceful shutdown (exec form required).
# CMD provides the default argument, overridable at `docker run` time.
# Checklist: "ENTRYPOINT uses exec form for correct signal handling."
ENTRYPOINT ["node_modules/.bin/tsx"]
CMD ["server.ts"]
