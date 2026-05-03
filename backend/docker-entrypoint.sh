#!/bin/bash
# =============================================================================
# Schema Genius — Docker Entrypoint
# Runs before php-fpm (app) or php artisan reverb:start (reverb)
# =============================================================================
set -e

cd /var/www/html

# ── 1. Ensure a .env file exists (artisan needs it to write APP_KEY) ────────
if [ ! -f .env ]; then
    echo "[entrypoint] No .env file found — copying .env.example → .env"
    cp .env.example .env
fi

# ── 2. Fix storage / cache permissions ──────────────────────────────────────
#    Necessary in dev because the host volume mount resets ownership.
#    The `|| true` guards are critical on Windows + XAMPP: Docker Desktop
#    bind-mounts Windows NTFS paths through WSL2, and chown/chmod can fail
#    with "Operation not permitted" on XAMPP-managed directories.
#    The app still works — PHP-FPM runs as root inside the container and
#    can write to those directories regardless of ownership metadata.
echo "[entrypoint] Setting storage permissions (errors here are safe to ignore on Windows)..."
chown -R www-data:www-data storage bootstrap/cache 2>/dev/null || true
chmod -R 775 storage bootstrap/cache 2>/dev/null || true

# ── 3. Auto-generate APP_KEY when neither the env var nor .env has one ──────
#    Docker env var (APP_KEY) takes precedence over .env file via clear_env=no.
#    If the Docker env var is already set, Laravel will use it and this block
#    is skipped entirely.
if [ -z "$APP_KEY" ]; then
    # Check whether .env already has a real key (starts with "base64:")
    FILE_KEY=$(grep '^APP_KEY=' .env 2>/dev/null | cut -d= -f2- | tr -d '"' | tr -d "'")
    if [ -z "$FILE_KEY" ] || [ "$FILE_KEY" = "null" ]; then
        echo "[entrypoint] APP_KEY is empty — generating a temporary one..."
        php artisan key:generate --force --no-interaction
        echo ""
        echo "╔══════════════════════════════════════════════════════════════╗"
        echo "║  APP_KEY was generated but will be lost on container restart ║"
        echo "║  To persist it, copy the line below into .env.docker:       ║"
        echo "║  $(grep '^APP_KEY=' .env)                      ║"
        echo "╚══════════════════════════════════════════════════════════════╝"
        echo ""
    fi
fi

# ── 4. Clear stale bootstrap cache before package:discover ──────────────────
#    CRITICAL: The host machine runs `composer install` with dev packages,
#    which writes bootstrap/cache/packages.php containing dev-only providers
#    like PailServiceProvider. Docker volume-mounts this file into the container
#    but installs with --no-dev, so those classes don't exist in vendor/.
#
#    When artisan boots it immediately loads packages.php → class not found →
#    crash. The fix: delete the stale cache files so Laravel bootstraps with
#    an empty provider list, then package:discover regenerates a clean one
#    that only contains providers from the actually-installed packages.
echo "[entrypoint] Clearing stale bootstrap cache..."
rm -f bootstrap/cache/packages.php bootstrap/cache/services.php 2>/dev/null || true

# ── 5. Discover packages (registers service providers from vendor) ──────────
echo "[entrypoint] Running package:discover..."
php artisan package:discover --ansi --no-interaction 2>/dev/null || true

# ── 5. Clear config cache so fresh env vars are picked up ──────────────────
php artisan config:clear --no-interaction 2>/dev/null || true

# ── Hand off to the main command (php-fpm or reverb:start) ─────────────────
echo "[entrypoint] Starting: $*"
exec "$@"
