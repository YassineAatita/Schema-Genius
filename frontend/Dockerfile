# =============================================================================
# Schema Genius — Frontend Dockerfile
#
# Three stages, selected via --target in docker-compose:
#
#   builder     — Node 22 Alpine, installs deps, runs `npm run build`
#                 Used as the source stage for the production image.
#
#   production  — Nginx Alpine, copies the Vite dist from builder.
#                 Selected in docker-compose.prod.yml.
#                 Listens on port 80.
#
#   development — Node 22 Alpine, runs `npm run dev -- --host`.
#                 Source code is volume-mounted; hot reload (HMR) works.
#                 Selected in docker-compose.yml (dev).
#                 Listens on port 5173.
# =============================================================================

# ── Stage 1: builder ─────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Install deps first for layer caching
COPY package.json package-lock.json* ./
RUN npm ci

# Copy source
COPY . .

# Vite API / Reverb URLs are injected at build time via ARGs.
# Override these in docker-compose.prod.yml under build.args.
ARG VITE_API_URL=http://localhost:8000
ARG VITE_REVERB_HOST=localhost
ARG VITE_REVERB_PORT=8080
ARG VITE_REVERB_SCHEME=http
ARG VITE_REVERB_APP_KEY=sg-local-key

# Make ARGs visible to Vite as env vars
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_REVERB_HOST=$VITE_REVERB_HOST
ENV VITE_REVERB_PORT=$VITE_REVERB_PORT
ENV VITE_REVERB_SCHEME=$VITE_REVERB_SCHEME
ENV VITE_REVERB_APP_KEY=$VITE_REVERB_APP_KEY

RUN npm run build

# ── Stage 2: production ──────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS production

# Copy compiled React app from builder
COPY --from=builder /app/dist /usr/share/nginx/html

# Remove default Nginx config; the real one is mounted via docker-compose
RUN rm /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

# ── Stage 3: development ─────────────────────────────────────────────────────
FROM node:22-alpine AS development

WORKDIR /app

# Pre-install deps so the node_modules volume is populated on first start.
# The volume mount in docker-compose.yml keeps node_modules inside the
# container, preventing the host filesystem from shadowing them.
COPY package.json package-lock.json* ./
RUN npm ci

# Source code is volume-mounted at runtime — do NOT copy it here.

EXPOSE 5173

# --host binds Vite to 0.0.0.0 so it's reachable from outside the container.
# HMR WebSocket connections from the browser go to localhost:5173 (port-mapped).
CMD ["npm", "run", "dev", "--", "--host"]
