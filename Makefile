# =============================================================================
# Schema Genius — Makefile
# Shortcuts for common Docker Compose operations.
#
# Usage:  make <target>
# Tip:    Run `make help` to see all available commands.
# =============================================================================

DC      = docker compose
DC_PROD = docker compose -f docker-compose.yml -f docker-compose.prod.yml

.PHONY: help dev prod build down restart logs shell \
        migrate seed fresh rollback key tinker \
        test npm-install npm-build queue artisan

# ── Default target ────────────────────────────────────────────────────────────
.DEFAULT_GOAL := help

help: ## Show this help message
	@echo ""
	@echo "  Schema Genius — Docker Makefile"
	@echo ""
	@awk 'BEGIN {FS = ":.*##"} /^[a-zA-Z_-]+:.*##/ { printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)
	@echo ""

# ── Development ───────────────────────────────────────────────────────────────
dev: ## Start all containers in development mode (hot reload on port 5173)
	$(DC) up

dev-build: ## Rebuild images then start in development mode
	$(DC) up --build

# ── Production ────────────────────────────────────────────────────────────────
prod: ## Start all containers in production mode (port 80)
	$(DC_PROD) up -d

prod-build: ## Rebuild production images then start
	$(DC_PROD) up -d --build

# ── Stop ─────────────────────────────────────────────────────────────────────
down: ## Stop and remove containers (keeps volumes)
	$(DC) down

down-v: ## Stop and remove containers AND all volumes (deletes DB data)
	$(DC) down -v

restart: ## Restart all containers without rebuilding
	$(DC) restart

# ── Logs ──────────────────────────────────────────────────────────────────────
logs: ## Tail logs from all containers
	$(DC) logs -f

logs-app: ## Tail logs from the app (PHP-FPM) container only
	$(DC) logs -f app

logs-reverb: ## Tail logs from the Reverb WebSocket container only
	$(DC) logs -f reverb

# ── Database ──────────────────────────────────────────────────────────────────
migrate: ## Run pending database migrations
	$(DC) exec app php artisan migrate

seed: ## Run database seeders
	$(DC) exec app php artisan db:seed

fresh: ## Drop all tables and re-run migrations + seeders (DESTRUCTIVE)
	$(DC) exec app php artisan migrate:fresh --seed

rollback: ## Roll back the last migration batch
	$(DC) exec app php artisan migrate:rollback

# ── Application key ───────────────────────────────────────────────────────────
key: ## Generate APP_KEY and print it — copy into .env.docker
	@echo ""
	@echo "  Generated key (copy the APP_KEY line into .env.docker):"
	@echo ""
	$(DC) exec app php artisan key:generate --show
	@echo ""

# ── Shells ────────────────────────────────────────────────────────────────────
shell: ## Open a bash shell inside the app container
	$(DC) exec app bash

shell-db: ## Open a MySQL shell inside the db container
	$(DC) exec db mysql -u schema_user -pschema_password schema_genius

tinker: ## Open Laravel Tinker (interactive PHP REPL)
	$(DC) exec app php artisan tinker

# ── Frontend ──────────────────────────────────────────────────────────────────
npm-install: ## Run npm install inside the frontend container
	$(DC) exec frontend npm install

npm-build: ## Run npm run build inside the frontend container
	$(DC) exec frontend npm run build

# ── Queue ─────────────────────────────────────────────────────────────────────
queue: ## Start the queue worker (runs in foreground)
	$(DC) exec app php artisan queue:work --tries=3

# ── Generic artisan passthrough ───────────────────────────────────────────────
artisan: ## Run any artisan command: make artisan CMD="route:list"
	$(DC) exec app php artisan $(CMD)

# ── Tests ─────────────────────────────────────────────────────────────────────
test: ## Run the PHPUnit test suite
	$(DC) exec app php artisan test
