# syntax=docker/dockerfile:1

# ---- Stage 1: build the JS bundle ----
FROM node:22-alpine AS assets
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY web ./web
COPY scripts ./scripts
RUN npm run build

# ---- Stage 2: runtime ----
# NOTE: PHP's built-in server is fine for a demo; use php-fpm + nginx for real traffic.
FROM php:8.6-cli-alpine
WORKDIR /srv/app
COPY src ./src
COPY public ./public
COPY --from=assets /app/public/assets/app.js ./public/assets/app.js
RUN mkdir -p var && chown -R www-data:www-data var
USER www-data
ENV APP_DB=/srv/app/var/app.sqlite
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --retries=5 \
  CMD wget -qO- http://127.0.0.1:8080/api/health || exit 1
CMD ["php", "-S", "0.0.0.0:8080", "-t", "public", "public/index.php"]
