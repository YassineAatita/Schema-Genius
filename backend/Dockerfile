# =============================================================================
# Schema Genius — Backend Dockerfile
# Base image: php:8.2-fpm
# Serves as the base for both the `app` (PHP-FPM) and `reverb` services.
# The `reverb` service uses this image with an overridden command.
# =============================================================================

FROM php:8.2-fpm

LABEL org.opencontainers.image.title="Schema Genius API"
LABEL org.opencontainers.image.description="Laravel 12 PHP-FPM backend"

# ── System dependencies ──────────────────────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
        curl \
        libpng-dev \
        libonig-dev \
        libxml2-dev \
        zip \
        unzip \
        git \
    && rm -rf /var/lib/apt/lists/*

# ── PHP extensions required by Laravel 12 ───────────────────────────────────
RUN docker-php-ext-install \
        pdo_mysql \
        mbstring \
        exif \
        pcntl \
        bcmath \
        gd

# ── Pass all Docker environment variables through to PHP-FPM workers ────────
#    Without this, PHP-FPM strips env vars and Laravel config() returns null.
RUN echo "[www]" > /usr/local/etc/php-fpm.d/zzz-env.conf \
 && echo "clear_env = no" >> /usr/local/etc/php-fpm.d/zzz-env.conf

# ── Composer 2 ──────────────────────────────────────────────────────────────
COPY --from=composer:2.8 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

# ── Install PHP dependencies (layer-cached separately from source code) ──────
#    --no-scripts   avoids running `php artisan package:discover` at build time
#                   (artisan needs a .env to run, which we don't have during build)
#    --no-autoloader defers autoloader generation until all source files are present
COPY composer.json composer.lock ./
RUN composer install \
        --no-dev \
        --no-scripts \
        --no-autoloader \
        --prefer-dist

# ── Copy application source ───────────────────────────────────────────────────
COPY . .

# ── Generate optimised autoloader ────────────────────────────────────────────
#    --no-scripts prevents post-autoload-dump from calling artisan during build
RUN composer dump-autoload --optimize --no-scripts

# ── Set correct ownership & permissions on writable directories ──────────────
#    mkdir -p first because bootstrap/cache is excluded from the build context
#    by .dockerignore (we don't want stale compiled cache files baked into the
#    image), so the directory won't exist after `COPY . .`.
#    The `|| true` guards handle any NTFS ownership errors on Windows/XAMPP
#    bind-mounts — the app still works because PHP-FPM runs as root and can
#    write regardless of ownership metadata.
RUN mkdir -p storage/app/public \
             storage/framework/cache \
             storage/framework/sessions \
             storage/framework/views \
             storage/logs \
             bootstrap/cache \
 && chown -R www-data:www-data storage bootstrap/cache || true \
 && chmod -R 775 storage bootstrap/cache || true

# ── Copy and register the entrypoint ────────────────────────────────────────
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# PHP-FPM listens on port 9000 (internal only; Nginx proxies to it)
EXPOSE 9000

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["php-fpm"]
