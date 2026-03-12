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
| AI | Groq API — Llama 3.3 70B |

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
│   │   └── utils/            ← validateSchema, etc.
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
- **Unsaved changes** indicator with browser-close warning
- SQL export — downloads a `.sql` file of the full schema

### AI Schema Generation
- Natural language prompt → full schema on canvas
- Powered by Groq API (Llama 3.3 70B — free tier)
- Confirmation modal before replacing an existing canvas
- Example prompts for quick start

### Schema Validation
- Client-side validation panel detects errors and warnings
- Issues: duplicate table names, no primary key, reserved word conflicts, duplicate column names, empty tables
- Click any issue to jump directly to that table's editor

### Schema Templates
- One-click pre-built schemas: Blog Platform, E-Commerce Store, SaaS Platform
- Each template loads with tables, columns, and labelled relationships ready to customize

### Collaboration & Invitations
- Project owners can invite teammates by email (Editor or Viewer role)
- Invitations are **pending** until the invitee accepts or declines
- Notification bell on Dashboard shows all pending invitations with Accept / Decline buttons
- Owners can remove collaborators or cancel pending invitations from the Share modal
- Shared projects appear in the invitee's dashboard only after acceptance

### UI / UX
- Toolbar decluttered — Templates, Validate Schema, and Export SQL moved into a **⋯ More** dropdown
- Undo / Redo icon buttons in toolbar (grayed out when unavailable)
- "Undone / Redone" toast confirmation on keyboard shortcut use
- Bottom help bar updated with keyboard shortcut hints

---

## 🗺️ Roadmap

### In Progress / Next Up
- [ ] **Version history browser** — visual list of past saves, ability to restore any version
- [ ] **Real-time collaboration** — live cursor presence and instant canvas sync via WebSockets (Laravel Reverb)

### Community & Discovery
- [ ] **Public schema gallery** — browse and search schemas published by the community
- [ ] **Schema forking** — fork any public schema into your own project and customize it
- [ ] **Schema upvoting & comments** — rate and discuss community schemas
- [ ] **User profile page** — public portfolio of published schemas

### Power User Features
- [ ] **Multi-DB SQL export** — PostgreSQL, SQLite, SQL Server (currently MySQL only)
- [ ] **Import from SQL** — paste or upload an existing `.sql` file to generate a visual schema
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
| GET | `/api/schemas/{id}/export/sql` | Download SQL file |
| POST | `/api/ai/generate` | AI schema generation |
| POST | `/api/projects/{id}/collaborators` | Invite a collaborator |
| GET | `/api/invitations` | List pending invitations |
| POST | `/api/invitations/{projectId}/accept` | Accept an invitation |
| POST | `/api/invitations/{projectId}/decline` | Decline an invitation |

---

## 👨‍💻 Author

Yassine Aatita — Final Year Engineering Project
