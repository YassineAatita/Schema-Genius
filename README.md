# Schema-Genius — The Visual Database Architect

A web-based SaaS-style platform that allows developers, students, and teams to visually design relational database schemas using a drag-and-drop interface, with AI-assisted schema generation and SQL export.

## 🚀 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite |
| Styling | Tailwind CSS |
| Canvas | React Flow |
| State | Zustand |
| Backend | Laravel 12 |
| Auth | Laravel Sanctum |
| Roles | Spatie Laravel Permission |
| Database | MySQL (MariaDB via XAMPP) |

## 📁 Project Structure
```
Schema-Genius/
├── backend/        ← Laravel 12 REST API
├── frontend/       ← React + Vite SPA
└── README.md
```

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

Update `.env` with your database credentials:
```env
DB_DATABASE=schema_genius
DB_USERNAME=root
DB_PASSWORD=
```

Then run:
```bash
php artisan migrate:fresh --seed
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

## ✅ Current Features (Week 1-4)

- User registration and login with token authentication
- Project creation, listing, and deletion
- Visual schema canvas with drag-and-drop tables
- Table editor — add/edit/delete columns with types, PK, FK flags
- Relationship drawing between tables with type selector (1:1, 1:N, N:1, N:N)
- Schema save and version history
- Auto-load saved schema when reopening a project

## 🗺️ Roadmap

- [ ] SQL export (MySQL)
- [ ] AI schema generation
- [ ] Collaboration / invite users
- [ ] Version history browser
- [ ] Admin dashboard
- [ ] Schema validation panel

## 👨‍💻 Author

Yassine Aatita — Final Year Engineering Project