# Schema-Genius — The Visual Database Architect

A web-based SaaS-style platform that lets developers, students, and teams visually design relational database schemas with a drag-and-drop canvas, AI-assisted generation, real-time collaboration, and SQL export.

---

## 🚀 Tech Stack

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

---

## 📁 Project Structure

```
Schema-Genius/
├── backend/                  ← Laravel 12 REST API
│   ├── app/Http/Controllers/Api/
│   ├── app/Models/
│   ├── database/migrations/
│   ├── config/reverb.php     ← Reverb WebSocket server config
│   └── routes/api.php
├── frontend/                 ← React + Vite SPA
│   ├── src/
│   │   ├── components/
│   │   │   ├── canvas/       ← SchemaCanvas, TableNode
│   │   │   ├── panels/       ← TableEditor, RelationshipEditor
│   │   │   └── ui/           ← ConfirmModal, shared UI
│   │   ├── pages/            ← Landing, Login, Register, Dashboard, Designer
│   │   ├── services/         ← API service layer, websocket.js (Reverb/Echo)
│   │   ├── store/            ← Zustand stores
│   │   └── utils/            ← validateSchema, parseSql, etc.
└── README.md
```

---

## ⚙️ Local Setup

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

Update `.env` with your database credentials, AI key, and Reverb config:
```env
DB_DATABASE=schema_genius
DB_USERNAME=root
DB_PASSWORD=

GROQ_API_KEY=your_groq_api_key_here

REVERB_APP_ID=your_reverb_app_id
REVERB_APP_KEY=your_reverb_app_key
REVERB_APP_SECRET=your_reverb_app_secret
REVERB_HOST=127.0.0.1
REVERB_PORT=8080
REVERB_SCHEME=http
```

Then run migrations:
```bash
php artisan migrate
```

### Frontend Setup
```bash
cd frontend
npm install
```

Update `frontend/.env` with the Reverb connection details:
```env
VITE_REVERB_APP_KEY=your_reverb_app_key
VITE_REVERB_HOST=127.0.0.1
VITE_REVERB_PORT=8080
VITE_REVERB_SCHEME=http
```

### Running the App (3 terminals)

**Terminal 1 — Backend API (port 8000)**
```bash
cd backend
php artisan serve
```

**Terminal 2 — WebSocket Server (port 8080)**
```bash
cd backend
php artisan reverb:start
```

**Terminal 3 — Frontend (port 5173)**
```bash
cd frontend
npm run dev
```

> All three processes must be running simultaneously for real-time collaboration to work. The WebSocket server (`reverb:start`) must be restarted whenever `config/reverb.php` or Reverb-related `.env` values change.

---

## ✅ Completed Features

### Authentication & Projects
- User registration and login with Sanctum token-based auth
- Project CRUD with auto-generated schema on creation
- Project visibility (private / public)
- Dark-themed Landing, Login, and Register pages

### Visual Designer
- Drag-and-drop canvas powered by React Flow
- Add tables with a default `id` primary key column
- Table editor — add/edit/delete columns with full type support
- Column flags: Primary Key, Foreign Key, Unique, Nullable, Auto-Increment, Default value
- Relationship drawing — drag from any handle to connect tables
- Relationship editor — type selector (1:1, 1:N, N:1, M:M) with UML role name labels
- **Line style switcher** — Curved (bezier), Elbow (smoothstep), Step, or Straight per relationship
- **Undo / Redo** — Ctrl+Z / Ctrl+Shift+Z (up to 50 steps) for add/delete/edit actions
- Delete key removes selected tables or relationships with full undo support
- **Floating action pill** — bottom-center of canvas; icon buttons for Add Table, Generate, Import SQL, Validate, Templates, Export SQL, Version History, Export PNG

### Schema Management
- Schema auto-saves as versioned JSON (`schema_versions` table)
- Auto-loads last saved schema when reopening a project
- **Version history browser** — visual list of past saves with restore to any point
- **Unsaved changes** indicator with browser-close warning
- **SQL export** — MySQL, PostgreSQL, and SQLite dialects; downloads a `.sql` file of the full schema
- **Import from SQL** — paste or upload a `.sql` file to generate a visual schema

### AI Schema Generation
- Natural language prompt → full schema on canvas
- Powered by Groq API (Llama 4 Scout — free tier)
- Image-to-schema: upload an ER diagram image and AI generates the schema
- Confirmation modal before replacing an existing canvas
- Example prompts for quick start
- AI-assisted bio enhancement on Profile page

### Schema Validation
- Client-side validation panel detects errors and warnings
- Issues: duplicate table names, no primary key, reserved word conflicts, duplicate column names, empty tables
- Click any issue to jump directly to that table's editor

### Schema Templates
- One-click pre-built schemas: Blog Platform, E-Commerce Store, SaaS Platform
- Each template loads with tables, columns, and labelled relationships ready to customize

### Real-time Collaboration
- **Live cursor presence** — each collaborator's cursor is visible on the canvas with their name label and a unique color
- **Instant canvas sync** — table moves, additions, edits, and deletions broadcast and apply to all connected users in real time
- **Avatar stack** in the toolbar showing who is currently online in the same project
- **Active users badge** on Dashboard project cards showing how many collaborators are currently designing
- **Viewer-role enforcement** — viewer-role users receive all real-time updates but cannot broadcast changes
- Powered by **Laravel Reverb** (WebSockets) with Laravel Echo on the frontend
- Presence channels track online members; client events (whispers) propagate lightweight cursor and canvas-change payloads

### Friends & Network
- Search any user by name or email — shows "user not found" feedback when no results match
- Send / cancel friend requests
- Accept or decline incoming friend requests
- Friends list with unfriend option
- Badge on Dashboard sidebar showing pending friend request count
- **Dashboard "Friends" view** — full friends management in one place (no separate page)

### Collaboration & Invitations
- **Invite from Friends** — Share modal now has a "Friends" tab to invite teammates in one click
- **Invite by Email** — classic email-based invite still works alongside friend invites
- Invitations are **pending** until the invitee accepts or declines
- Notification bell on Dashboard shows all pending invitations and notifications
- Owners can remove collaborators or cancel pending invitations from the Share modal
- Shared projects appear in the invitee's dashboard only after acceptance
- Role assignment (Editor or Viewer) for every collaborator

### User Profile
- Edit name, user type, headline, and bio
- Upload profile photo (JPEG/PNG/GIF/WebP, max 2 MB)
- AI-powered bio enhancement with one click
- Profile and Friends accessible directly from Dashboard sidebar

### UI / UX
- Sidebar navigation in Dashboard: Dashboard / Profile / Friends with active state + badges
- **Floating action pill** — clean bottom-center pill replaces the old toolbar dropdown menus; all canvas actions (Add Table, Generate, Import SQL, Validate, Templates, Export SQL, Version History, Export PNG) accessible via icon buttons with hover tooltips
- **Dark mode toggle** — Sun/Moon button in the floating pill switches the designer canvas between light and dark; preference persisted to localStorage
- Undo / Redo icon buttons in toolbar (grayed out when unavailable)
- "Undone / Redone" toast confirmation on keyboard shortcut use
- Bottom help bar with keyboard shortcut hints
- Toast notifications for all friend actions

---

## 🗺️ Roadmap

### Power User Features
- [ ] **Schema diff viewer** — compare any two saved versions with highlighted changes
- [ ] **Table annotations / notes** — add sticky-note style comments directly on canvas nodes
- [ ] **Keyboard shortcuts panel** — in-app cheat sheet overlay

### Community & Discovery
- [ ] **Public schema gallery** — browse and search schemas published by the community
- [ ] **Schema forking** — fork any public schema into your own project and customize it
- [ ] **Schema upvoting & comments** — rate and discuss community schemas

### Platform & Admin
- [ ] **Admin dashboard** — user management, schema stats, AI usage monitoring
- [ ] **Organization accounts** — team workspaces with shared project libraries
- [ ] **Subscription plans** — free tier + Pro features (unlimited projects, priority AI, history)
- [ ] **Email notifications** — invitation emails, weekly activity digest

---

## 🔑 Key API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register a new user |
| POST | `/api/auth/login` | Login and receive token |
| GET | `/api/projects` | List owned + shared projects |
| POST | `/api/projects` | Create a new project |
| GET | `/api/projects/{id}` | Get project with schema |
| GET | `/api/projects/active-counts` | Active user count per project |
| POST | `/api/projects/{id}/active` | Mark current user as active in project |
| DELETE | `/api/projects/{id}/active` | Mark current user as inactive in project |
| GET | `/api/schemas/{id}` | Get schema with current version |
| PUT | `/api/schemas/{id}` | Save schema (creates new version) |
| GET | `/api/schemas/{id}/versions` | List all saved versions |
| POST | `/api/schemas/{id}/versions/{versionId}/restore` | Restore a past version |
| GET | `/api/schemas/{id}/export/sql` | Download SQL file (supports `?dialect=mysql\|postgresql\|sqlite`) |
| POST | `/api/ai/generate` | AI schema generation from prompt |
| POST | `/api/ai/generate-from-image` | AI schema generation from image |
| POST | `/api/ai/enhance-bio` | AI bio enhancement |
| GET | `/api/users/search?q=` | Search users by name or email |
| GET | `/api/friends` | List accepted friends |
| GET | `/api/friends/requests` | List incoming friend requests |
| POST | `/api/friends` | Send a friend request |
| POST | `/api/friends/{id}/accept` | Accept a friend request |
| POST | `/api/friends/{id}/decline` | Decline or cancel a request |
| DELETE | `/api/friends/{id}` | Unfriend |
| POST | `/api/projects/{id}/collaborators` | Invite a collaborator (by email or user_id) |
| POST | `/api/projects/{id}/collaborators/invite-friend` | Invite a friend directly |
| DELETE | `/api/projects/{id}/collaborators/{userId}` | Remove a collaborator |
| GET | `/api/invitations` | List pending invitations |
| POST | `/api/invitations/{projectId}/accept` | Accept an invitation |
| POST | `/api/invitations/{projectId}/decline` | Decline an invitation |
| GET | `/api/profile` | Get own profile |
| PUT | `/api/profile` | Update profile |
| POST | `/api/profile/avatar` | Upload profile photo |
| GET | `/api/notifications` | List notifications |
| POST | `/api/notifications/read-all` | Mark all notifications as read |
| DELETE | `/api/notifications/clear` | Clear all notifications |

---

## 👨‍💻 Author

Yassine Aatita - Fatima Zahra Aknioune — Final Year Engineering Project
