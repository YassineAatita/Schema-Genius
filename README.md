# Schema Genius — Visual Database Schema Designer

A web-based SaaS-style platform that lets developers, students, and teams visually design relational database schemas with a drag-and-drop canvas, AI-assisted generation, real-time collaboration, SQL export, and a public schema community.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite |
| Styling | Tailwind CSS v4 |
| Canvas | React Flow (xyflow) |
| State | Zustand |
| Backend | Laravel 12 |
| Auth | Laravel Sanctum (token-based) |
| Roles | Spatie Laravel Permission |
| Database | MySQL (MariaDB via XAMPP) |
| WebSockets | Laravel Reverb (real-time collaboration) |
| AI | Groq API — Llama 4 Scout (meta-llama/llama-4-scout-17b-16e-instruct) |
| Email | SMTP (Gmail) via Laravel Mail |

---

## Project Structure

```
Schema-Genius/
├── backend/                        Laravel 12 REST API
│   ├── app/
│   │   ├── Http/Controllers/Api/   All API controllers
│   │   ├── Models/                 Eloquent models
│   │   └── Notifications/          Branded email notifications
│   ├── database/
│   │   ├── migrations/
│   │   └── seeders/                AdminSeeder, RolesSeeder
│   ├── resources/views/emails/     Branded HTML email templates
│   └── routes/api.php
├── frontend/                       React + Vite SPA
│   ├── src/
│   │   ├── components/
│   │   │   ├── canvas/             SchemaCanvas, TableNode, CustomSchemaEdge
│   │   │   ├── panels/             TableEditor, RelationshipEditor
│   │   │   └── ui/                 ConfirmModal, shared UI
│   │   ├── pages/                  All route-level page components
│   │   ├── services/               Axios API client, WebSocket (Echo/Reverb)
│   │   ├── store/                  Zustand stores (auth, schema)
│   │   └── utils/                  validateSchema, parseSql, etc.
└── README.md
```

---

## Local Setup

### Requirements
- PHP 8.2+
- Composer 2+
- Node.js 22+
- MySQL (XAMPP recommended on Windows)

### Backend Setup

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
```

Update `.env` with your credentials:

```env
DB_DATABASE=schema_genius
DB_USERNAME=root
DB_PASSWORD=

FRONTEND_URL=http://localhost:5173

MAIL_MAILER=smtp
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=your@gmail.com
MAIL_PASSWORD="your app password"
MAIL_ENCRYPTION=tls
MAIL_FROM_ADDRESS=your@gmail.com
MAIL_FROM_NAME="Schema Genius"

GROQ_API_KEY=your_groq_api_key_here

REVERB_APP_ID=1
REVERB_APP_KEY=your_reverb_app_key
REVERB_APP_SECRET=your_reverb_app_secret
REVERB_HOST=127.0.0.1
REVERB_PORT=8080
REVERB_SCHEME=http
```

Run migrations and seed the admin account:

```bash
php artisan migrate
php artisan db:seed --class=RolesSeeder
php artisan db:seed --class=AdminSeeder
```

### Frontend Setup

```bash
cd frontend
npm install
```

Create `frontend/.env`:

```env
VITE_REVERB_APP_KEY=your_reverb_app_key
VITE_REVERB_HOST=127.0.0.1
VITE_REVERB_PORT=8080
VITE_REVERB_SCHEME=http
```

### Running the App (3 terminals)

**Terminal 1 — Backend API (port 8000)**
```bash
cd backend && php artisan serve
```

**Terminal 2 — WebSocket Server (port 8080)**
```bash
cd backend && php artisan reverb:start
```

**Terminal 3 — Frontend (port 5173)**
```bash
cd frontend && npm run dev
```

> All three processes must be running for real-time collaboration to work.

### Default Admin Account

```
Email:    admin@schema-genius.com
Password: Admin@123456
```

---

## Completed Features

### Authentication & Security
- User registration with **email verification** — new accounts must verify before logging in
- Branded HTML verification email (clean Notion-style design)
- Resend verification link from the login page
- **Forgot password / reset password** flow — tokenized reset link sent by email
- Branded HTML password reset email with 60-minute expiry
- Password strength indicator on the reset form
- Login with Sanctum token-based auth; blocks unverified and suspended accounts
- All existing users backfilled with verified status via migration

### Visual Designer
- Drag-and-drop canvas powered by React Flow
- Add tables with a default `id` primary key column
- Table editor — add/edit/delete columns with full type support
- Column flags: Primary Key, Foreign Key, Unique, Nullable, Auto-Increment, Default value
- Relationship drawing — drag from any handle to connect tables
- Relationship editor — type selector (1:1, 1:N, N:1, M:M) with UML role name labels
- **Line style switcher** — Curved, Elbow, Step, or Straight per relationship
- **Undo / Redo** — Ctrl+Z / Ctrl+Shift+Z (up to 50 steps)
- Delete key removes selected tables or relationships with full undo support
- **Table annotations** — sticky-note comments on any table node; persisted in schema JSON and synced to collaborators
- **Dark mode toggle** — Sun/Moon button switches the canvas; preference persisted to localStorage
- **Floating action pill** — bottom-center icon buttons for all canvas actions

### Schema Management
- Schema auto-saves as versioned JSON (`schema_versions` table)
- Auto-loads last saved schema when reopening a project
- **Version history browser** — visual list of saves; restore to any point
- **Schema diff viewer** — compare any two versions; color-coded inline diff for tables, columns, and relationships
- **Unsaved changes** indicator with browser-close warning
- **SQL export** — MySQL, PostgreSQL, and SQLite dialects; downloads a `.sql` file
- **Import from SQL** — paste or upload a `.sql` file to generate a visual schema

### AI Features
- **Natural language → schema** — describe your data model in plain text; full schema appears on canvas
- **Image → schema** — upload an ER diagram image and AI generates the matching schema
- Powered by Groq API (Llama 4 Scout — free tier)
- Confirmation modal before replacing an existing canvas
- **AI bio enhancement** — one-click polish for profile bios during registration and on the profile page

### Schema Validation
- Client-side validation panel detects errors and warnings
- Detects: duplicate table names, missing primary keys, reserved word conflicts, duplicate column names, empty tables
- Click any issue to jump directly to the affected table's editor

### Schema Templates
- One-click pre-built schemas: Blog Platform, E-Commerce Store, SaaS Platform
- Loads with tables, columns, and labeled relationships ready to customize

### Real-time Collaboration
- **Live cursor presence** — each collaborator's cursor visible with name label and unique color
- **Instant canvas sync** — moves, additions, edits, and deletions broadcast to all connected users
- **Avatar stack** in the toolbar showing who is currently online
- **Active users badge** on Dashboard project cards
- **Viewer-role enforcement** — viewers receive updates but cannot broadcast changes
- Powered by Laravel Reverb + Laravel Echo; presence channels + client whispers

### Explore & Community
- **Public schema gallery** — browse all public schemas with search and filter
- **Featured schema** — admin-curated schema showcased on the Explore page
- **Schema forking** — fork any public schema into your own project
- **Fork tree / Schema DNA** — visual tree showing a schema's full fork lineage
- **Stars** — bookmark schemas you find useful
- **Likes** — express appreciation for community schemas
- **Comments** — discuss and give feedback on public schemas
- **Named collections** — curate your own lists of favorite schemas
- **Follow / Unfollow users** — build a personal network and see their latest work
- **Network feed** — schemas from people you follow or are friends with

### Friends & Social
- Search any user by name or email
- Send / cancel / accept / decline friend requests
- Friends list with unfriend option
- Pending request badge on Dashboard sidebar

### Collaboration & Invitations
- **Invite from Friends** — Share modal has a Friends tab for one-click team invites
- **Invite by Email** — classic email-based invite
- Invitations are pending until the invitee accepts or declines
- Notification bell for pending invitations and activity
- Owners can remove collaborators or cancel pending invitations
- Role assignment (Editor or Viewer) per collaborator

### User Profile
- Edit name, user type, headline, and bio
- Upload profile photo (JPEG/PNG/GIF/WebP, max 2 MB)
- Public profile page visible to other users

### Admin Dashboard
- Overview stats: total users, projects, schemas, AI generations
- User management: view all users, toggle active/suspended, change roles, delete accounts
- Project management: view all projects, force-private, feature on Explore, delete
- AI usage monitoring: per-user generation stats, prompt history
- Community moderation: view and delete comments, top-projects leaderboard
- Featured schema management: set and rotate the featured schema with history log

---

## Key API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register (sends verification email) |
| POST | `/api/auth/login` | Login; returns token |
| POST | `/api/auth/logout` | Revoke token |
| GET | `/api/auth/me` | Current user |
| GET | `/api/auth/email/verify/{id}/{hash}` | Verify email from link |
| POST | `/api/auth/email/resend` | Resend verification email |
| POST | `/api/auth/forgot-password` | Send password reset link |
| POST | `/api/auth/reset-password` | Reset password with token |

### Projects & Schemas
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects` | List owned + shared projects |
| POST | `/api/projects` | Create project |
| GET/PUT/DELETE | `/api/projects/{id}` | Show / update / delete |
| GET | `/api/projects/active-counts` | Active user count per project |
| GET | `/api/schemas/{id}` | Get schema with current version |
| PUT | `/api/schemas/{id}` | Save schema (creates new version) |
| GET | `/api/schemas/{id}/versions` | List saved versions |
| POST | `/api/schemas/{id}/versions/{vId}/restore` | Restore a past version |
| GET | `/api/schemas/{id}/export/sql` | Download SQL (`?dialect=mysql\|postgresql\|sqlite`) |

### AI
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ai/generate` | Schema from text prompt |
| POST | `/api/ai/generate-from-image` | Schema from image |
| POST | `/api/ai/enhance-bio` | Polish a bio text |

### Explore & Community
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/explore` | Public schema gallery |
| GET | `/api/explore/featured` | Current featured schema |
| GET | `/api/explore/network` | Feed from follows/friends |
| GET | `/api/explore/my-schemas` | Own public schemas with stats |
| GET | `/api/explore/projects/{id}` | Public project detail |
| POST/DELETE | `/api/projects/{id}/star` | Star / unstar |
| POST/DELETE | `/api/projects/{id}/like` | Like / unlike |
| POST | `/api/projects/{id}/fork` | Fork a public schema |
| GET | `/api/projects/{id}/forks` | List forks |
| GET | `/api/projects/{id}/fork-tree` | Fork lineage tree |
| GET/POST | `/api/projects/{id}/comments` | List / add comments |
| PUT/DELETE | `/api/comments/{id}` | Edit / delete comment |
| GET/POST | `/api/collections` | List / create collections |
| GET/PUT/DELETE | `/api/collections/{id}` | Show / update / delete |
| POST | `/api/collections/{id}/items` | Add schema to collection |
| DELETE | `/api/collections/{id}/items/{projectId}` | Remove from collection |

### Social
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users/search?q=` | Search users |
| GET | `/api/users/{id}` | Public profile |
| GET | `/api/users/{id}/followers` | Follower list |
| GET | `/api/users/{id}/following` | Following list |
| POST/DELETE | `/api/users/{id}/follow` | Follow / unfollow |
| GET | `/api/friends` | Accepted friends |
| GET | `/api/friends/requests` | Incoming requests |
| POST | `/api/friends` | Send friend request |
| POST | `/api/friends/{id}/accept` | Accept request |
| POST | `/api/friends/{id}/decline` | Decline / cancel request |
| DELETE | `/api/friends/{id}` | Unfriend |

### Notifications & Collaboration
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/notifications` | List notifications |
| POST | `/api/notifications/read-all` | Mark all read |
| DELETE | `/api/notifications/clear` | Clear all |
| GET | `/api/invitations` | Pending invitations |
| POST | `/api/invitations/{projectId}/accept` | Accept invitation |
| POST | `/api/invitations/{projectId}/decline` | Decline invitation |
| GET/POST | `/api/projects/{id}/collaborators` | List / invite collaborators |
| PUT/DELETE | `/api/projects/{id}/collaborators/{userId}` | Update / remove collaborator |

### Profile
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/PUT | `/api/profile` | Get / update own profile |
| POST | `/api/profile/avatar` | Upload avatar |

### Admin
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/overview` | Platform-wide stats |
| GET | `/api/admin/users` | All users |
| PUT | `/api/admin/users/{id}/toggle-active` | Suspend / reactivate |
| PUT | `/api/admin/users/{id}/role` | Change role |
| DELETE | `/api/admin/users/{id}` | Delete user |
| GET | `/api/admin/projects` | All projects |
| PUT | `/api/admin/projects/{id}/force-private` | Force a project private |
| POST | `/api/admin/projects/{id}/feature` | Feature on Explore |
| DELETE | `/api/admin/projects/{id}` | Delete project |
| GET | `/api/admin/ai/stats` | AI usage overview |
| GET | `/api/admin/ai/users` | Per-user AI usage |
| GET | `/api/admin/ai/prompts` | Prompt history |
| GET | `/api/admin/community/comments` | All community comments |
| DELETE | `/api/admin/community/comments/{id}` | Delete comment |
| GET | `/api/admin/community/top-projects` | Top-ranked projects |
| POST | `/api/admin/featured` | Set featured schema |
| GET | `/api/admin/featured/history` | Featured schema history |

---

## Roadmap

- [ ] Keyboard shortcuts overlay panel
- [ ] Organization accounts with shared project libraries
- [ ] Subscription plans (free tier + Pro)
- [ ] Weekly activity digest emails

---

## Author

Yassine Aatita — Fatima Zahra Aknioune — Final Year Engineering Project
