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
| AI | Groq API — Llama 4 Scout (meta-llama/llama-4-scout-17b-16e-instruct) |

---

## 📁 Project Structure

```
Schema-Genius/
├── backend/                  ← Laravel 12 REST API
│   ├── app/Http/Controllers/Api/
│   ├── app/Models/
│   ├── database/migrations/
│   └── routes/api.php
├── frontend/                 ← React + Vite SPA
│   ├── src/
│   │   ├── components/
│   │   │   ├── canvas/       ← SchemaCanvas, TableNode
│   │   │   ├── panels/       ← TableEditor, RelationshipEditor
│   │   │   └── ui/           ← ConfirmModal, shared UI
│   │   ├── pages/            ← Landing, Login, Register, Dashboard, Designer
│   │   ├── services/         ← API service layer
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

Update `.env` with your database credentials and AI key:
```env
DB_DATABASE=schema_genius
DB_USERNAME=root
DB_PASSWORD=

GROQ_API_KEY=your_groq_api_key_here
```

Then run:
```bash
php artisan migrate
php artisan serve
```

Backend runs at: `http://127.0.0.1:8000`

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

Frontend runs at: `http://localhost:5173`

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

### Schema Management
- Schema auto-saves as versioned JSON (`schema_versions` table)
- Auto-loads last saved schema when reopening a project
- **Version history browser** — visual list of past saves with restore to any point
- **Unsaved changes** indicator with browser-close warning
- SQL export — downloads a `.sql` file of the full schema
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
- Toolbar decluttered — Templates, Validate Schema, and Export SQL moved into a **⋯ More** dropdown
- Undo / Redo icon buttons in toolbar (grayed out when unavailable)
- "Undone / Redone" toast confirmation on keyboard shortcut use
- Bottom help bar updated with keyboard shortcut hints
- Toast notifications for all friend actions

---

## 🗺️ Roadmap

### In Progress / Next Up
- [ ] **Real-time collaboration** — live cursor presence and instant canvas sync via WebSockets (Laravel Reverb)

### Community & Discovery
- [ ] **Public schema gallery** — browse and search schemas published by the community
- [ ] **Schema forking** — fork any public schema into your own project and customize it
- [ ] **Schema upvoting & comments** — rate and discuss community schemas
- [ ] **User profile page** — public portfolio of published schemas

### Power User Features
- [ ] **Multi-DB SQL export** — PostgreSQL, SQLite, SQL Server (currently MySQL only)
- [ ] **Schema diff viewer** — compare any two saved versions with highlighted changes
- [ ] **Table annotations / notes** — add sticky-note style comments directly on canvas nodes
- [ ] **Dark mode** for the designer canvas
- [ ] **Keyboard shortcuts panel** — in-app cheat sheet overlay

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
| GET | `/api/schemas/{id}` | Get schema with current version |
| PUT | `/api/schemas/{id}` | Save schema (creates new version) |
| GET | `/api/schemas/{id}/versions` | List all saved versions |
| POST | `/api/schemas/{id}/versions/{versionId}/restore` | Restore a past version |
| GET | `/api/schemas/{id}/export/sql` | Download SQL file |
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
| GET | `/api/invitations` | List pending invitations |
| POST | `/api/invitations/{projectId}/accept` | Accept an invitation |
| POST | `/api/invitations/{projectId}/decline` | Decline an invitation |
| GET | `/api/profile` | Get own profile |
| PUT | `/api/profile` | Update profile |
| POST | `/api/profile/avatar` | Upload profile photo |

---

## 👨‍💻 Author

Yassine Aatita — Final Year Engineering Project
