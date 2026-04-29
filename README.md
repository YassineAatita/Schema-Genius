<div align="center">

<img src="https://raw.githubusercontent.com/YassineAatita/Schema-Genius/main/frontend/public/logo.svg" alt="Schema Genius Logo" width="100" />

# Schema Genius

### Visual Database Schema Designer · AI-Powered · Real-time Collaborative

[![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=white)](https://reactjs.org)
[![Vite](https://img.shields.io/badge/Vite-7-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Laravel](https://img.shields.io/badge/Laravel-12-FF2D20?style=flat-square&logo=laravel&logoColor=white)](https://laravel.com)
[![MySQL](https://img.shields.io/badge/MySQL-8-4479A1?style=flat-square&logo=mysql&logoColor=white)](https://mysql.com)
[![Groq](https://img.shields.io/badge/AI-Groq%20Llama%204-F55036?style=flat-square)](https://groq.com)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

<br/>

> Design, share, and version your database schemas visually.  
> Generate them with AI. Collaborate on them in real-time.

<br/>

![Schema Genius Demo](https://user-images.githubusercontent.com/placeholder/demo.gif)

*← Drag tables, draw relationships, and let AI do the heavy lifting*

</div>

---

## ✨ What is Schema Genius?

**Schema Genius** is a full-stack SaaS platform that transforms how developers, students, and teams design relational databases. Instead of writing DDL by hand or fighting ERD desktop tools, you get a **live canvas** where tables snap into place, relationships are drawn with a single drag, and an AI assistant can generate your entire schema from a plain-English description — or even a photograph of a whiteboard.

Everything saves automatically, every change is versioned, and your whole team edits together in real-time with live cursors.

---

## 🖼️ Screenshots

| Designer Canvas | AI Generation | Explore Community |
|:-:|:-:|:-:|
| ![Canvas](https://user-images.githubusercontent.com/placeholder/canvas.gif) | ![AI Modal](https://user-images.githubusercontent.com/placeholder/ai-modal.gif) | ![Explore](https://user-images.githubusercontent.com/placeholder/explore.gif) |
| Drag-drop tables, draw FK relationships | Describe your schema in plain text | Browse, star, fork public schemas |

| Real-time Collaboration | Version History | Roast My Schema 🔥 |
|:-:|:-:|:-:|
| ![Collab](https://user-images.githubusercontent.com/placeholder/collab.gif) | ![Versions](https://user-images.githubusercontent.com/placeholder/versions.gif) | ![Roast](https://user-images.githubusercontent.com/placeholder/roast.gif) |
| Live cursors & instant sync | Browse and restore past saves | AI brutally reviews your design |

---

## 🚀 Feature Highlights

### 🎨 Visual Designer
| Feature | Details |
|---|---|
| **Drag-and-drop canvas** | Powered by React Flow — pan, zoom, snap to grid |
| **Table editor** | Add / rename / delete columns with full type picker |
| **Column flags** | PK · FK · Unique · Nullable · Auto-Increment · Default value |
| **Relationship drawing** | Drag from any handle to connect two tables |
| **Relationship editor** | Type selector (1:1, 1:N, N:1, M:M), UML role-name labels, line style |
| **Line styles** | Curved · Elbow · Step · Straight — switch per relationship |
| **Table annotations** | Sticky-note comments on any table, synced in real-time |
| **Undo / Redo** | `Ctrl+Z` / `Ctrl+Shift+Z`, up to 50 steps per session |
| **Multi-select delete** | Select multiple tables/edges and press `Delete` |
| **Dark mode** | Toggle Sun/Moon — preference saved to `localStorage` |

### 🤖 AI Features
| Feature | Details |
|---|---|
| **Text → Schema** | Describe your data model; full schema appears on canvas |
| **Image → Schema** | Upload an ER diagram photo; AI parses it into nodes & edges |
| **Add to Canvas** | Merge AI output alongside your existing tables (no overwrite) |
| **Schema Suggest** | Ask AI to add missing tables or improve an existing schema |
| **Roast My Schema 🔥** | AI acts as a brutally honest senior DBA and critiques your design — severity-coded `critical / bad / meh` feedback cards |
| **AI Bio Polish** | One-click enhancement for profile bios |
| Powered by | **Groq API** — `llama-4-scout-17b` (fast, free-tier friendly) |

### 🔄 Schema Management
| Feature | Details |
|---|---|
| **Auto-save** | Every manual save creates a new version in `schema_versions` |
| **Version history** | Paginated list of all saves; restore any point with one click |
| **Schema diff viewer** | Color-coded side-by-side diff for tables, columns, and relationships between any two versions |
| **SQL export** | Download a `.sql` file in MySQL, PostgreSQL, or SQLite dialect |
| **Copy SQL** | One-click clipboard copy of the generated SQL |
| **Import from SQL** | Paste or upload a `.sql` file to reverse-engineer a visual schema |
| **Schema validation** | Client-side panel catches duplicate names, missing PKs, reserved words, empty tables |
| **Unsaved changes guard** | Browser-close warning + custom confirm modal |

### 👥 Real-time Collaboration
| Feature | Details |
|---|---|
| **Live cursors** | Every collaborator's mouse shown with name label and unique colour |
| **Instant canvas sync** | Node moves, adds, edits, and deletes broadcast to all users |
| **Avatar stack** | Toolbar shows profile pictures of everyone currently online |
| **Viewer-role guard** | Viewers receive all updates but cannot broadcast changes |
| **Reconnect banner** | Detects offline/online events; shows yellow ↔ green status banner |
| Transport | **Laravel Reverb** (native WebSockets) + **Laravel Echo** presence channels |

### 🌐 Community & Explore
| Feature | Details |
|---|---|
| **Public gallery** | Browse all public schemas with search and tag filter |
| **Featured schema** | Admin-curated pick highlighted at the top of Explore |
| **Schema forking** | Clone any public schema into your own project |
| **Fork DNA tree** | Visual tree of a schema's full fork lineage |
| **Stars & Likes** | Bookmark and appreciate community schemas |
| **Comments** | Discussion threads on every public schema |
| **Collections** | Curate named lists of your favourite schemas |
| **Follow users** | Build a personal network; see their schemas in your Network feed |
| **Friend system** | Send/accept/decline friend requests; invite friends to projects |

### 🔐 Auth & User Management
| Feature | Details |
|---|---|
| **Email verification** | New accounts must verify before logging in |
| **Forgot/Reset password** | Token-based reset link sent by email; 60-minute expiry |
| **Branded emails** | Clean Notion-inspired HTML for verification and reset |
| **Account suspension** | Admins can suspend/reactivate any user |
| **Role-based access** | `admin`, `user` via Spatie Laravel Permission |
| **Token auth** | Laravel Sanctum — stateless API tokens |

### 🛡️ Admin Dashboard
| Feature | Details |
|---|---|
| **Overview stats** | Total users, projects, schemas, AI generation counts |
| **User management** | View all users, suspend/activate, change roles, delete |
| **Project management** | Force-private, feature on Explore, delete any project |
| **AI monitoring** | Per-user generation stats + full prompt history |
| **Community moderation** | View and delete any comment; top-projects leaderboard |
| **Featured schema** | Set and rotate the Explore spotlight with history log |

### 🔒 Security Hardening
| Protection | Details |
|---|---|
| **Rate limiting — auth** | Login `10/min`, register `5/min`, forgot-password `3/min`, reset `5/min`, resend-verification `3/min` — per IP |
| **Rate limiting — AI** | Generate `20/min`, image `10/min`, suggest `20/min`, roast `20/min`, enhance-bio `10/min` — prevents Groq API drain |
| **IDOR prevention** | `GET /schemas/{id}` and `GET /schemas/{id}/export/sql` verify ownership or accepted-collaborator status before responding |
| **Schema payload cap** | AI suggest & roast reject schemas exceeding 150 nodes / 300 edges — stops billing-amplification attacks |
| **Image MIME validation** | `generate-from-image` validates data-URL prefix before forwarding to Groq (JPEG, PNG, GIF, WebP only) |
| **Project ownership check** | AI generate endpoints verify the caller owns / has editor access on the supplied `project_id` |
| **Token expiration** | Sanctum tokens expire after 30 days (configurable via `SANCTUM_TOKEN_EXPIRATION`) |
| **Fork tree visibility** | `GET /projects/{id}/fork-tree` requires the root project to be public; private forks are excluded from all traversal output |
| **Email PII protection** | User search results never expose a stranger's email address — only visible once a friendship exists |
| **Security response headers** | Every response carries `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` |
| **CORS via env** | `CORS_ALLOWED_ORIGINS` env variable — no hardcoded `localhost` in production |
| **Safe env defaults** | `.env.example` ships with `APP_DEBUG=false`; all security-sensitive variables documented with warnings |

---

## 📚 Schema Templates

Jump-start any project with one of **15 pre-built templates** — loaded with tables, columns, data types, and labelled relationships, ready to customise.

| # | Template | Tables | Description |
|---|---|:---:|---|
| 1 | **Blog Platform** | 4 | Posts, categories, tags, comments |
| 2 | **E-Commerce Store** | 5 | Products, orders, carts, payments |
| 3 | **SaaS Platform** | 5 | Subscriptions, plans, billing |
| 4 | **Social Network** | 6 | Users, posts, follows, likes, messages |
| 5 | **Job Board** | 6 | Listings, applications, companies, skills |
| 6 | **Booking & Reservation** | 6 | Resources, time-slots, payments, reviews |
| 7 | **Hospital & Clinic** | 6 | Patients, doctors, appointments, prescriptions |
| 8 | **School & University** | 7 | Students, courses, enrolments, grades |
| 9 | **Library Management** | 7 | Books, members, loans, reservations |
| 10 | **Real Estate** | 7 | Properties, agents, listings, transactions |
| 11 | **Food Delivery** | 8 | Restaurants, menus, orders, delivery tracking |
| 12 | **Auth & Roles** | 7 | RBAC — users, roles, permissions, audit log |
| 13 | **CMS** | 9 | Content types, blocks, revisions, media |
| 14 | **Inventory Management** | 7 | Products, warehouses, stock movements |
| 15 | **Multi-tenant SaaS** | 8 | Tenants, workspaces, subscriptions, usage |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser (SPA)                           │
│                                                                 │
│  React 18 + Vite          Zustand            React Flow         │
│  ┌──────────────┐   ┌──────────────────┐  ┌──────────────────┐  │
│  │  Pages /     │   │  useSchemaStore  │  │  SchemaCanvas    │  │
│  │  Components  │◄──│  (nodes, edges,  │──│  TableNode       │  │
│  │  Panels      │   │   history, dirty)│  │  CustomEdge      │  │
│  └──────┬───────┘   └──────────────────┘  └──────────────────┘  │
│         │  Axios (REST)          Laravel Echo (WebSocket)        │
└─────────┼──────────────────────────────────────────────────────-┘
          │                              │
          ▼                              ▼
┌─────────────────────┐    ┌─────────────────────────────┐
│   Laravel 12 REST   │    │   Laravel Reverb (WS :8080) │
│   API  (:8000)      │    │   Presence channels          │
│                     │    │   Client whispers            │
│  Controllers:       │    │   Live cursors + canvas sync │
│  · Auth             │    └─────────────────────────────┘
│  · Projects         │
│  · Schemas          │    ┌──────────────────────────────┐
│  · AI (Groq)        │───►│   Groq API                   │
│  · Explore          │    │   llama-4-scout-17b           │
│  · Admin            │    │   Text→Schema, Image→Schema  │
│  · Social           │    │   Schema Roast, Bio Enhance  │
│  · Collections      │    └──────────────────────────────┘
│  · Notifications    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   MySQL / MariaDB   │
│                     │
│  users              │
│  projects           │
│  schemas            │
│  schema_versions    │
│  ai_generations     │
│  collaborators      │
│  invitations        │
│  friendships        │
│  follows            │
│  stars / likes      │
│  comments           │
│  collections        │
│  notifications      │
└─────────────────────┘
```

---

## 🛠️ Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Frontend Framework | React | 18 |
| Build Tool | Vite | 7 |
| Styling | Tailwind CSS | 4 |
| Canvas | React Flow (xyflow) | 12 |
| State Management | Zustand | 5 |
| HTTP Client | Axios | 1 |
| Icons | Lucide React | 0.577 |
| Backend Framework | Laravel | 12 |
| Auth | Laravel Sanctum | 4 |
| Roles & Permissions | Spatie Laravel Permission | 6 |
| Database | MySQL / MariaDB | 8 |
| WebSockets | Laravel Reverb | 1 |
| WebSocket Client | Laravel Echo + Pusher-JS | — |
| AI Provider | Groq API (Llama 4 Scout) | — |
| Email | Laravel Mail + Gmail SMTP | — |

---

## ⚡ Quick Start

### Prerequisites

- PHP 8.2+, Composer 2+
- Node.js 22+, npm 10+
- MySQL / MariaDB (XAMPP recommended on Windows)

### 1 — Clone & install

```bash
git clone https://github.com/YassineAatita/Schema-Genius.git
cd Schema-Genius

# Backend
cd backend && composer install

# Frontend
cd ../frontend && npm install
```

### 2 — Configure backend

```bash
cd backend
cp .env.example .env
php artisan key:generate
```

Edit `backend/.env`:

```env
# Database
DB_DATABASE=schema_genius
DB_USERNAME=root
DB_PASSWORD=

# Frontend URL (for CORS + email links)
FRONTEND_URL=http://localhost:5173
# Token expiration in minutes (43200 = 30 days). Set to null to disable.
SANCTUM_TOKEN_EXPIRATION=43200

# CORS — in production set to your real domain(s), comma-separated.
# Falls back to FRONTEND_URL when not set.
# CORS_ALLOWED_ORIGINS=https://schema-genius.com,https://www.schema-genius.com

# Email — use a Gmail App Password
MAIL_MAILER=smtp
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=your@gmail.com
MAIL_PASSWORD="your-16-char-app-password"
MAIL_ENCRYPTION=tls
MAIL_FROM_ADDRESS=your@gmail.com
MAIL_FROM_NAME="Schema Genius"

# AI — free at console.groq.com
GROQ_API_KEY=gsk_xxxxxxxxxxxxxxxxxxxx

# WebSockets — any random strings
REVERB_APP_ID=1
REVERB_APP_KEY=your-reverb-key
REVERB_APP_SECRET=your-reverb-secret
REVERB_HOST=127.0.0.1
REVERB_PORT=8080
REVERB_SCHEME=http
```

```bash
php artisan migrate
php artisan db:seed --class=RolesSeeder
php artisan db:seed --class=AdminSeeder
```

### 3 — Configure frontend

Create `frontend/.env`:

```env
VITE_REVERB_APP_KEY=your-reverb-key
VITE_REVERB_HOST=127.0.0.1
VITE_REVERB_PORT=8080
VITE_REVERB_SCHEME=http
```

### 4 — Run (3 terminals)

```bash
# Terminal 1 — REST API
cd backend && php artisan serve          # http://localhost:8000

# Terminal 2 — WebSocket server
cd backend && php artisan reverb:start   # ws://localhost:8080

# Terminal 3 — Frontend
cd frontend && npm run dev               # http://localhost:5173
```

### Default Admin Account

```
Email:    admin@schema-genius.com
Password: Admin@123456
```

---

## 📁 Project Structure

```
Schema-Genius/
│
├── backend/                            Laravel 12 REST API
│   ├── app/
│   │   ├── Http/
│   │   │   ├── Controllers/Api/        One controller per resource
│   │   │   │   ├── AuthController      Register, login, verify, reset
│   │   │   │   ├── ProjectController   CRUD + active presence counts
│   │   │   │   ├── SchemaController    Show, save, versions, restore, SQL export
│   │   │   │   ├── AiController        Generate, image, suggest, roast, enhance-bio
│   │   │   │   ├── CollaboratorController
│   │   │   │   ├── ExploreController   Gallery, featured, network, my-schemas
│   │   │   │   ├── StarController / LikeController / ForkController
│   │   │   │   ├── CommentController / FollowController / FriendshipController
│   │   │   │   ├── CollectionController
│   │   │   │   ├── NotificationController
│   │   │   │   ├── ProfileController
│   │   │   │   ├── FeaturedSchemaController
│   │   │   │   └── AdminController
│   │   │   └── Middleware/
│   │   │       └── SecurityHeaders     X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy
│   │   ├── Models/                     User, Project, Schema, SchemaVersion,
│   │   │                               AiGeneration, Collaborator, ...
│   │   ├── Notifications/              VerifyEmailNotification, ResetPasswordNotification
│   │   └── Events/                     Presence broadcast events
│   ├── database/
│   │   ├── migrations/                 Full schema history
│   │   └── seeders/                    RolesSeeder, AdminSeeder
│   ├── resources/views/emails/         Branded HTML email templates
│   ├── config/services.php             Groq API config
│   └── routes/api.php                  All 80+ REST routes
│
├── frontend/                           React 18 + Vite SPA
│   ├── src/
│   │   ├── components/
│   │   │   ├── canvas/
│   │   │   │   ├── SchemaCanvas.jsx    React Flow wrapper
│   │   │   │   ├── TableNode.jsx       Custom RF node with handles
│   │   │   │   └── CustomSchemaEdge.jsx Labelled edge with delete btn
│   │   │   ├── panels/
│   │   │   │   ├── TableEditor.jsx     Column CRUD right panel
│   │   │   │   └── RelationshipEditor.jsx Edge type + labels panel
│   │   │   └── ui/
│   │   │       └── ConfirmModal.jsx    Reusable confirm dialog
│   │   ├── data/
│   │   │   └── schemaTemplates.jsx     All 15 pre-built templates
│   │   ├── pages/
│   │   │   ├── LandingPage.jsx         Dark marketing homepage
│   │   │   ├── LoginPage.jsx           Auth page
│   │   │   ├── RegisterPage.jsx        Auth page
│   │   │   ├── DashboardPage.jsx       Projects list + stats
│   │   │   ├── DesignerPage.jsx        ★ Main canvas + all toolbar logic
│   │   │   ├── ExplorePage.jsx         Community gallery
│   │   │   ├── ProfilePage.jsx         Public / own profile
│   │   │   └── AdminPage.jsx           Admin dashboard
│   │   ├── services/
│   │   │   ├── api.js                  Axios instance (base URL + token)
│   │   │   └── echo.js                 Laravel Echo + Reverb init
│   │   ├── store/
│   │   │   ├── useAuthStore.js         Auth state (user, token)
│   │   │   └── useSchemaStore.js       Canvas state + undo/redo + collab emit
│   │   └── utils/
│   │       ├── validateSchema.js       Client-side schema linter
│   │       └── parseSql.js             SQL → nodes/edges parser
│   └── index.html
│
└── README.md
```

---

## 🔌 API Reference

<details>
<summary><strong>Auth endpoints</strong></summary>

| Method | Endpoint | Auth | Description |
|--------|----------|:----:|-------------|
| `POST` | `/api/auth/register` | ✗ | Register; sends verification email |
| `POST` | `/api/auth/login` | ✗ | Login; returns Bearer token |
| `POST` | `/api/auth/logout` | ✓ | Revoke current token |
| `GET`  | `/api/auth/me` | ✓ | Current user object |
| `GET`  | `/api/auth/email/verify/{id}/{hash}` | ✗ | Verify email from inbox link |
| `POST` | `/api/auth/email/resend` | ✗ | Resend verification email |
| `POST` | `/api/auth/forgot-password` | ✗ | Send password reset link |
| `POST` | `/api/auth/reset-password` | ✗ | Reset with token |

</details>

<details>
<summary><strong>Projects & Schemas</strong></summary>

| Method | Endpoint | Auth | Description |
|--------|----------|:----:|-------------|
| `GET` | `/api/projects` | ✓ | List owned + shared projects |
| `POST` | `/api/projects` | ✓ | Create project (auto-creates schema) |
| `GET` | `/api/projects/{id}` | ✓ | Show project |
| `PUT` | `/api/projects/{id}` | ✓ | Update project metadata |
| `DELETE` | `/api/projects/{id}` | ✓ | Delete project |
| `GET` | `/api/projects/active-counts` | ✓ | Live active-user count per project |
| `GET` | `/api/schemas/{id}` | ✓ | Schema + current version JSON |
| `PUT` | `/api/schemas/{id}` | ✓ | Save (creates new version) |
| `PATCH` | `/api/schemas/{id}/autosave` | ✓ | Autosave (overwrites current version) |
| `GET` | `/api/schemas/{id}/versions` | ✓ | List all saved versions |
| `POST` | `/api/schemas/{id}/versions/{vId}/restore` | ✓ | Restore a past version |
| `GET` | `/api/schemas/{id}/export/sql` | ✓ | SQL file (`?dialect=mysql\|postgresql\|sqlite`) |
| `GET` | `/api/schemas/shared/{projectId}` | ✗ | Read-only public share view |

</details>

<details>
<summary><strong>AI endpoints</strong></summary>

| Method | Endpoint | Auth | Description |
|--------|----------|:----:|-------------|
| `POST` | `/api/ai/generate` | ✓ | Text prompt → `{ nodes, edges }` |
| `POST` | `/api/ai/generate-from-image` | ✓ | Image upload → `{ nodes, edges }` |
| `PATCH` | `/api/ai/generations/{id}/apply` | ✓ | Mark generation as applied |
| `POST` | `/api/ai/suggest` | ✓ | Improve/extend an existing schema |
| `POST` | `/api/ai/roast` | ✓ | Critique schema → `{ roasts[] }` |
| `POST` | `/api/ai/enhance-bio` | ✗ | Polish a bio string |

</details>

<details>
<summary><strong>Explore & Community</strong></summary>

| Method | Endpoint | Auth | Description |
|--------|----------|:----:|-------------|
| `GET` | `/api/explore` | ✗ | Public schema gallery |
| `GET` | `/api/explore/featured` | ✗ | Current featured schema |
| `GET` | `/api/explore/projects/{id}` | ✗ | Public project detail |
| `GET` | `/api/explore/network` | ✓ | Feed from follows/friends |
| `GET` | `/api/explore/my-schemas` | ✓ | Own public schemas with stats |
| `POST/DELETE` | `/api/projects/{id}/star` | ✓ | Star / unstar |
| `POST/DELETE` | `/api/projects/{id}/like` | ✓ | Like / unlike |
| `POST` | `/api/projects/{id}/fork` | ✓ | Fork a public schema |
| `GET` | `/api/projects/{id}/forks` | ✗ | Fork list |
| `GET` | `/api/projects/{id}/fork-tree` | ✗ | Full lineage tree |
| `GET/POST` | `/api/projects/{id}/comments` | ✗/✓ | List / add comments |
| `PUT/DELETE` | `/api/comments/{id}` | ✓ | Edit / delete comment |

</details>

<details>
<summary><strong>Collections, Social & Notifications</strong></summary>

| Method | Endpoint | Auth | Description |
|--------|----------|:----:|-------------|
| `GET/POST` | `/api/collections` | ✓ | List / create collections |
| `GET/PUT/DELETE` | `/api/collections/{id}` | ✓ | Show / update / delete collection |
| `POST` | `/api/collections/{id}/items` | ✓ | Add schema to collection |
| `DELETE` | `/api/collections/{id}/items/{projectId}` | ✓ | Remove from collection |
| `GET` | `/api/users/search?q=` | ✓ | Search users |
| `GET` | `/api/users/{id}` | ✗ | Public profile |
| `GET` | `/api/users/{id}/followers` | ✗ | Follower list |
| `GET` | `/api/users/{id}/following` | ✗ | Following list |
| `POST/DELETE` | `/api/users/{id}/follow` | ✓ | Follow / unfollow |
| `GET/POST/DELETE` | `/api/friends` | ✓ | List / send / unfriend |
| `POST` | `/api/friends/{id}/accept` | ✓ | Accept request |
| `POST` | `/api/friends/{id}/decline` | ✓ | Decline / cancel |
| `GET` | `/api/notifications` | ✓ | Notification list |
| `POST` | `/api/notifications/read-all` | ✓ | Mark all read |
| `DELETE` | `/api/notifications/clear` | ✓ | Clear all |

</details>

<details>
<summary><strong>Collaborators & Invitations</strong></summary>

| Method | Endpoint | Auth | Description |
|--------|----------|:----:|-------------|
| `GET/POST` | `/api/projects/{id}/collaborators` | ✓ | List / invite |
| `PUT/DELETE` | `/api/projects/{id}/collaborators/{userId}` | ✓ | Update role / remove |
| `GET` | `/api/projects/{id}/my-access` | ✓ | Own access level |
| `POST` | `/api/projects/{id}/request-access` | ✓ | Request access to private project |
| `POST` | `/api/projects/{id}/access-requests/{userId}/approve` | ✓ | Approve request |
| `POST` | `/api/projects/{id}/access-requests/{userId}/decline` | ✓ | Decline request |
| `GET` | `/api/invitations` | ✓ | Pending invitations |
| `POST` | `/api/invitations/{projectId}/accept` | ✓ | Accept invitation |
| `POST` | `/api/invitations/{projectId}/decline` | ✓ | Decline invitation |

</details>

<details>
<summary><strong>Admin endpoints</strong></summary>

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/admin/overview` | Platform-wide stats |
| `GET` | `/api/admin/users` | All users (paginated) |
| `PUT` | `/api/admin/users/{id}/toggle-active` | Suspend / reactivate |
| `PUT` | `/api/admin/users/{id}/role` | Change role |
| `DELETE` | `/api/admin/users/{id}` | Delete user account |
| `GET` | `/api/admin/projects` | All projects |
| `PUT` | `/api/admin/projects/{id}/force-private` | Force project to private |
| `POST` | `/api/admin/projects/{id}/feature` | Feature on Explore page |
| `DELETE` | `/api/admin/projects/{id}` | Delete project |
| `GET` | `/api/admin/ai/stats` | AI usage overview |
| `GET` | `/api/admin/ai/users` | Per-user AI usage |
| `GET` | `/api/admin/ai/prompts` | Full prompt history |
| `GET` | `/api/admin/community/comments` | All community comments |
| `DELETE` | `/api/admin/community/comments/{id}` | Delete comment |
| `GET` | `/api/admin/community/top-projects` | Top-ranked projects |
| `POST` | `/api/admin/featured` | Set featured schema |
| `GET` | `/api/admin/featured/history` | Featured schema history |

</details>

---

## 🔄 Real-time Event Reference

Schema Genius uses **Laravel Reverb** presence channels and client whispers for zero-latency canvas sync.

| Event | Direction | Payload | Description |
|---|---|---|---|
| `SchemaNodeAdded` | whisper → peers | `{ node }` | New table dropped on canvas |
| `SchemaNodeMoved` | whisper → peers | `{ nodeId, position }` | Table drag stopped |
| `SchemaNodeUpdated` | whisper → peers | `{ nodeId, data }` | Column/name edit committed |
| `SchemaNodeDeleted` | whisper → peers | `{ nodeId }` | Table deleted |
| `SchemaEdgeAdded` | whisper → peers | `{ edge }` | Relationship drawn |
| `SchemaEdgeUpdated` | whisper → peers | `{ edgeId, changes }` | Edge type / label changed |
| `SchemaEdgeDeleted` | whisper → peers | `{ edgeId }` | Relationship deleted |
| `CursorMoved` | whisper → peers | `{ x, y, userId, name, color }` | Live cursor position |
| `whisper:joining` | presence | `{ id, name, avatar, color }` | User joined canvas |
| `whisper:leaving` | presence | `{ id }` | User left canvas |

---

## 🗺️ Roadmap

### ✅ Completed

- [x] Auth: register · email verify · login · logout · forgot/reset password · branded emails
- [x] Projects CRUD with auto-created versioned schema
- [x] Visual designer: drag-drop canvas, TableNode, RelationshipEditor
- [x] Column types, flags (PK, FK, Unique, Nullable, Auto-Increment, Default)
- [x] Relationship types (1:1, 1:N, N:1, M:M) with UML role-name labels
- [x] Line style switcher (Curved · Elbow · Step · Straight)
- [x] Table annotations (sticky notes, real-time synced)
- [x] Undo / Redo — 50-step history
- [x] Multi-select bulk delete
- [x] Schema validation panel (duplicate names, missing PKs, reserved words)
- [x] Version history browser + restore
- [x] Schema diff viewer (compare any two versions)
- [x] SQL export — MySQL / PostgreSQL / SQLite
- [x] Copy SQL to clipboard
- [x] Import from SQL (paste or file upload)
- [x] AI text → schema (Groq Llama 4 Scout)
- [x] AI image → schema (vision model)
- [x] AI suggest (improve existing schema)
- [x] AI roast 🔥 (severity-coded feedback)
- [x] AI bio enhancement
- [x] Real-time collaboration — live cursors, instant sync, avatar stack
- [x] Viewer-role enforcement (read-only collaborators)
- [x] Reconnect banner (offline/online events)
- [x] Dark mode with localStorage persistence
- [x] 15 pre-built schema templates with search
- [x] Explore public gallery — search, filter, featured schema
- [x] Stars · Likes · Comments · Forks · Fork DNA tree
- [x] Named collections
- [x] Follow / unfollow users · Network feed
- [x] Friend system (send · accept · decline · unfriend)
- [x] Invite collaborators (email + friends tab)
- [x] Access requests with owner approve/decline flow
- [x] Notification centre with read/clear
- [x] User profiles (public + edit + avatar upload)
- [x] Admin dashboard — users · projects · AI monitoring · moderation
- [x] Security hardening — rate limiting on all auth + AI endpoints, IDOR fixes, token expiration, security headers, CORS via env, schema payload caps, image MIME validation, email PII protection, fork tree visibility enforcement

### 🔜 Up Next

- [ ] **Deployment** — Dockerise both services, nginx reverse proxy, CI/CD pipeline, production `.env` guide
- [ ] Keyboard shortcuts overlay panel
- [ ] Organization accounts with shared project libraries
- [ ] Subscription plans (free tier + Pro)
- [ ] Weekly activity digest emails
- [ ] Native mobile-optimised canvas experience

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

Please follow the existing code style and include a brief description of your change.

---

## 👨‍💻 Authors

**Yassine Aatita** · **Fatima Zahra Aknioune**

Final Year Engineering Project — Visual Database Schema Designer

---

<div align="center">

Made with ❤️ and way too much ☕

⭐ Star this repo if Schema Genius saved you from writing DDL by hand!

</div>
