# Schema Genius — Docker Setup Guide

Run the entire Schema Genius stack (Laravel API + Reverb WebSocket + React + MySQL) with a single command. No local PHP, Node, or MySQL installation required.

---

## Architecture

### Development (`docker compose up`)

| Service | Image | Port | Purpose |
|---|---|---|---|
| `db` | mysql:8.0 | 3306 | MySQL database |
| `app` | backend/Dockerfile | — (internal 9000) | Laravel PHP-FPM |
| `webserver` | nginx:1.27-alpine | **8000** | Nginx → PHP-FPM proxy |
| `reverb` | backend/Dockerfile | **8080** | Reverb WebSocket server |
| `frontend` | frontend/Dockerfile (dev) | **5173** | Vite HMR dev server |

### Production (`make prod`)

| Service | Image | Port | Purpose |
|---|---|---|---|
| `db` | mysql:8.0 | 3306 | MySQL database |
| `app` | backend/Dockerfile | — (internal 9000) | Laravel PHP-FPM |
| `webserver` | nginx:1.27-alpine | — (internal 8000) | Nginx → PHP-FPM |
| `reverb` | backend/Dockerfile | — (internal 8080) | Reverb WebSocket |
| `frontend` | frontend/Dockerfile (prod) | **80** | Unified Nginx: serves React + proxies API + WebSocket |

In production, the browser only ever talks to port 80. The frontend Nginx handles everything:
- `/` → React static files (baked into the image)
- `/api/*`, `/sanctum/*`, `/broadcasting/*` → FastCGI to `app:9000`
- `/app/*`, `/apps/*` → WebSocket proxy to `reverb:8080`

---

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (includes Docker Compose v2)
- Git

---

## ⚠ Security — read before touching git

`.env.docker` contains real secrets (APP_KEY, API keys, mail password). It is listed in `.gitignore` and must **never** be committed.

- ✅ `.env.docker.example` — placeholder template, safe to commit, already in the repo
- ❌ `.env.docker` — your real secrets, gitignored, lives only on your machine

If you ever run `git add .` without checking first, git will silently skip `.env.docker`. To be safe, always confirm with `git status` before committing.

---

## Development Setup (first time)

### Step 1 — Clone and create your env file

```bash
git clone https://github.com/YassineAatita/Schema-Genius.git
cd Schema-Genius

# Create your local secrets file from the safe template
cp .env.docker.example .env.docker
```

### Step 2 — Fill in your secrets in `.env.docker`

Open `.env.docker` and fill in every line marked `← fill this in`:

| Variable | Where to get it |
|---|---|
| `APP_KEY` | Leave empty — generated automatically in Step 4 |
| `REVERB_APP_KEY` | Any random string, e.g. `openssl rand -hex 20` |
| `REVERB_APP_SECRET` | Any random string, e.g. `openssl rand -hex 20` |
| `GROQ_API_KEY` | Get a free key at https://console.groq.com |
| `MAIL_USERNAME` / `MAIL_PASSWORD` | Your Gmail address + a Gmail App Password |

Everything else (DB credentials, ports) works out of the box with the Docker defaults.

### Step 3 — Build and start

```bash
make dev-build
# or: docker compose up --build
```

Docker will:
1. Pull `mysql:8.0` and `nginx:1.27-alpine`
2. Build the `backend` image (PHP 8.2, Composer dependencies)
3. Build the `frontend` dev image (Node 22, npm packages)
4. Start all 5 containers

First build takes ~3–5 minutes. Subsequent starts take ~10 seconds.

### Step 4 — Generate APP_KEY

```bash
make key
```

Copy the printed `APP_KEY=base64:...` line into `.env.docker`, then restart:

```bash
make down && make dev
```

### Step 5 — Run database migrations

```bash
make migrate
# optional: make seed
```

### Step 6 — Open the app

| URL | What you see |
|---|---|
| http://localhost:5173 | React frontend (Vite HMR) |
| http://localhost:8000/api | Laravel API |
| ws://localhost:8080 | Reverb WebSocket |
| localhost:3306 | MySQL (connect with TablePlus / DBeaver) |

---

## Daily Development Workflow

```bash
make dev          # start containers (no rebuild)
make down         # stop containers
make logs         # tail all container logs
make logs-app     # tail only the PHP-FPM logs
make shell        # open a bash shell in the app container
make tinker       # open Laravel Tinker
make migrate      # run new migrations
make fresh        # drop everything, re-migrate + seed (DESTRUCTIVE)
make test         # run PHPUnit tests
```

---

## Production Setup

### Deploying to a real server (Google Cloud, VPS, any Linux VM)

This is the recommended workflow for first-time deployment to a new server.

#### Step 1 — SSH into your server and clone the repo

```bash
ssh user@your-server-ip
git clone https://github.com/YassineAatita/Schema-Genius.git
cd Schema-Genius
```

Make sure Docker and Docker Compose v2 are installed:

```bash
docker --version          # Docker 24+
docker compose version    # v2.x
```

#### Step 2 — Create and configure `.env.docker`

```bash
cp .env.docker.example .env.docker
nano .env.docker          # or vim, or any editor
```

Fill in every value marked `← fill this in`, plus these two **required for production**:

| Variable | What to set | Example |
|---|---|---|
| `SERVER_URL` | Full public URL of your server — scheme + IP/domain, no trailing slash | `http://34.163.220.141` |
| `REVERB_PUBLIC_HOST` | Just the hostname or IP, **no** `http://` prefix | `34.163.220.141` |
| `APP_KEY` | Generate with `make key` (run once in dev, copy here) | `base64:abc...` |
| `REVERB_APP_KEY` | Any random string | `openssl rand -hex 20` |
| `REVERB_APP_SECRET` | Any random string | `openssl rand -hex 20` |
| `GROQ_API_KEY` | From https://console.groq.com | `gsk_...` |
| `MAIL_*` | Your Gmail credentials + App Password | — |

Also set production mode:

```env
APP_ENV=production
APP_DEBUG=false
SANCTUM_STATEFUL_DOMAINS=your-server-ip-or-domain
```

> ⚠ **`SERVER_URL` format:** write `http://` exactly once.
> `http://34.163.220.141` ✅ — `http:http://34.163.220.141` ❌

#### Step 3 — Build and start

```bash
make prod-build
# or: docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

The React app is compiled inside Docker with the correct relative API URL baked in. No Node.js is needed on the server at runtime.

#### Step 4 — Run migrations

```bash
make migrate
# optional: make seed  (creates roles + admin user)
```

#### Step 5 — Open the app

```
http://your-server-ip   →   everything (React + API + WebSocket on port 80)
```

The app works on **any IP or domain** without code changes — `SERVER_URL` and `REVERB_PUBLIC_HOST` in `.env.docker` are the only things that need updating when the server changes.

---

### Updating an existing deployment (re-deploy after a code push)

```bash
# On the server:
git pull origin main
make prod-build     # rebuilds images with the new code
make migrate        # run any new migrations
```

---

### Local production test (no real server needed)

```bash
# On your dev machine — simulates production mode locally:
make prod-build
# Access at http://localhost
```

---

## Recommended Git → Deploy Workflow

```
dev branch (local)
    ↓  test with: make dev-build
    ↓  everything works locally?
    ↓
git push origin dev
    ↓
open PR: dev → main
merge PR when ready
    ↓
On the server (Google Cloud):
    git pull origin main
    make prod-build
    make migrate
```

**Step by step:**

1. **Work on `dev` branch** — all feature work, bug fixes, and config changes go here
2. **Test locally with Docker** — `make dev-build` to rebuild, `make dev` to start, visit http://localhost:5173
3. **Push and merge to `main`** — `git push origin dev`, open a PR in GitHub, merge when satisfied
4. **Deploy on the server** — SSH in, run `git pull origin main && make prod-build && make migrate`
5. **Done** — the new version is live at http://your-server-ip

> Your plan is correct. The only thing to add: always test in local Docker **before** merging to main — this catches environment variable issues, migration errors, and build failures before they affect the live server.

---

## Makefile Reference

```bash
make help          # list all commands

# Development
make dev           # docker compose up
make dev-build     # docker compose up --build
make down          # stop containers
make down-v        # stop + delete all volumes (wipes DB)
make restart       # restart without rebuild

# Logs
make logs          # all containers
make logs-app      # app only
make logs-reverb   # reverb only

# Database
make migrate       # php artisan migrate
make seed          # php artisan db:seed
make fresh         # migrate:fresh --seed  ⚠ destructive
make rollback      # migrate:rollback

# App key
make key           # generate and print APP_KEY

# Shells
make shell         # bash in app container
make shell-db      # MySQL shell
make tinker        # Laravel Tinker

# Frontend
make npm-install   # npm install in frontend container
make npm-build     # npm run build in frontend container

# Production
make prod          # docker compose prod up -d
make prod-build    # docker compose prod up -d --build

# Tests
make test          # php artisan test

# Generic artisan
make artisan CMD="route:list"
make artisan CMD="cache:clear"
```

---

## Troubleshooting

### Running from XAMPP htdocs on Windows (read this first)

The project lives in `C:\xampp\htdocs` which introduces two Windows-specific issues that are already fixed in the Docker files, but useful to understand:

**Issue 1 — `tar: Cannot change ownership … Input/output error` during build**

Docker Desktop (WSL2) creates a tar archive of every file in the build context before running `COPY` instructions. XAMPP's `htdocs` folder has NTFS permissions that prevent WSL2 from setting Linux ownership metadata on those files, causing the tar to abort.

**Fix already applied:** `backend/.dockerignore` and `frontend/.dockerignore` exclude `vendor/`, `node_modules/`, `.git/`, and Windows artifact files (`Thumbs.db`, `desktop.ini`) from the build context. Docker never tars those problematic files.

If the error persists, make sure Docker Desktop is using the **WSL2 backend** (not Hyper-V):
> Docker Desktop → Settings → General → "Use the WSL 2 based engine" ✓

**Issue 2 — `daemon.json is invalid: fork/exec … input/output error`**

This is a Docker Desktop daemon crash, usually triggered by XAMPP's services (Apache on port 80, MySQL on port 3306) conflicting with Docker at startup.

Steps to recover:
1. Stop XAMPP completely (XAMPP Control Panel → Stop All)
2. In PowerShell (run as Administrator): `wsl --shutdown`
3. Restart Docker Desktop and wait for the whale icon to stop animating
4. Start XAMPP again (its ports no longer conflict because Docker MySQL uses port **3307**)

**Issue 3 — MySQL port conflict**

XAMPP MySQL occupies port 3306. Docker's MySQL is mapped to host port **3307** to avoid this.

| Tool | Host | Port | Credentials |
|---|---|---|---|
| XAMPP MySQL | localhost | 3306 | root / (none) |
| Docker MySQL | localhost | **3307** | schema_user / schema_password |

Connect TablePlus / DBeaver / HeidiSQL to `localhost:3307` for the Docker database.
The `DB_PORT=3306` in `.env.docker` is the **container-internal** port — leave it as 3306.

---

### Container won't start

```bash
docker compose logs app        # PHP-FPM errors
docker compose logs webserver  # Nginx errors
docker compose logs db         # MySQL errors
```

### Database connection refused

The `app` container retries until MySQL is healthy. If it keeps failing:

1. Check MySQL is running: `docker compose ps`
2. Verify credentials in `.env.docker` match the `db` service environment
3. `DB_HOST` must be `db` — not `127.0.0.1` or `localhost`

```bash
make shell-db   # try connecting manually
```

### `Class not found` / `Target class does not exist`

The autoloader or service providers may not have been discovered. Run:

```bash
docker compose exec app php artisan package:discover
docker compose exec app composer dump-autoload --optimize
```

### `php artisan key:generate` says "No .env file"

The entrypoint auto-copies `.env.example` → `.env` inside the container on every start. If that fails:

```bash
docker compose exec app cp .env.example .env
make key
```

### Vite hot reload (HMR) not working on Windows

HMR uses a WebSocket from the browser to Vite. Ensure the `frontend` service has these env vars (already set in `docker-compose.yml`):

```yaml
environment:
  - CHOKIDAR_USEPOLLING=true
  - WATCHPACK_POLLING=true
```

If files still don't trigger rebuilds, increase Docker Desktop's file sharing resources or use WSL 2 backend.

### WebSocket connection fails

1. Ensure `REVERB_APP_KEY` in `.env.docker` matches `VITE_REVERB_APP_KEY` in the frontend environment
2. Check the `reverb` service is running: `docker compose ps`
3. Tail reverb logs: `make logs-reverb`
4. In dev, the browser connects to `ws://localhost:8080` directly (port-mapped)

### Port already in use

Find and kill the process using the port:

```bash
# Windows PowerShell
netstat -ano | findstr :8000
taskkill /PID <pid> /F

# macOS / Linux
lsof -i :8000
kill -9 <pid>
```

Or change the port in `docker-compose.yml` (e.g., `"8001:8000"`).

### Vendor / node_modules out of sync

If you add a new Composer or npm package, rebuild the relevant image:

```bash
docker compose up --build app        # rebuild after composer require
docker compose up --build frontend   # rebuild after npm install
```

Or run the install inside the running container:

```bash
docker compose exec app  composer require vendor/package
docker compose exec frontend npm install new-package
```

### Reset everything

```bash
make down-v          # stops containers and deletes ALL volumes (wipes the DB)
make dev-build       # fresh build and start
make migrate
make seed
```

---

## File Overview

```
Schema-Genius/
├── docker-compose.yml          Base (development) compose config
├── docker-compose.prod.yml     Production overrides
├── .env.docker                 Environment variables for Docker (commit-safe)
├── Makefile                    Shorthand commands
├── README-DOCKER.md            This file
│
├── backend/
│   ├── Dockerfile              PHP 8.2-FPM image (app + reverb share this)
│   └── docker-entrypoint.sh   Runs on container start: permissions, key check
│
├── frontend/
│   └── Dockerfile              Multi-stage: builder → production (Nginx) / development (Node)
│
└── nginx/
    ├── laravel.conf            Dev Nginx: serves Laravel API on port 8000
    └── default.conf            Prod Nginx: unified server on port 80
```
