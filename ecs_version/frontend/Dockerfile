# syntax=docker/dockerfile:1

# ── Build stage ────────────────────────────────────────────────────────────────
FROM node:18-alpine AS builder
WORKDIR /app
COPY package.json .
RUN npm install
COPY . .

# REACT_APP_ALB_BASE_URL is no longer needed — Nginx proxies /api/*
# internally so the browser always calls the same HTTPS origin.
RUN npm run build

# ── Runtime stage ──────────────────────────────────────────────────────────────
FROM nginx:alpine

# React build output
COPY --from=builder /app/build /usr/share/nginx/html

# Nginx config with reverse proxy (INTERNAL_ALB_DNS placeholder)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Entrypoint replaces INTERNAL_ALB_DNS placeholder at container startup
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["/docker-entrypoint.sh"]
