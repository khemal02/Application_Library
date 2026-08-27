# Application Library and Management System (ALMS)

A single enterprise platform — one login, one database, one dashboard, one navigation, one
notification system, one RBAC system — covering three integrated modules:

1. **Application Tracking & Documentation** — the living knowledge base for every internal
   application: tech stack, features, AI prompt library, architecture/API/DB docs, releases,
   bug history, known issues, roadmap, and development timeline.
2. **Application Ideas** — two lanes (brand-new ideas vs. feature requests for an existing
   application), each auto-numbered (`Idea #N`) and routed through submitted → discussion →
   technical review (two rounds) → review → approved/rejected → development-ready, with comments,
   replies, voting, tags, and analytics.
3. **Existing Application Review & Improvement** — per-application suggestions grouped by
   department, through submitted → technical review → discussion → approved → assigned →
   implemented → closed, with comments, voting, and progress tracking.

## Stack

- **Frontend**: React 18, React Router, Redux Toolkit, MUI, Axios, React Hook Form, Vite
- **Backend**: Node.js, Express (MVC + clean architecture: routes → validate → controller → service → model)
- **Database**: PostgreSQL 16 (Sequelize ORM, migrations + seeders, full-text search via `tsvector`)
- **Auth**: JWT, data-driven RBAC (`roles` / `role_permissions` tables, not hard-coded per role)

## Project layout

```
backend/    Express API — src/{config,models,migrations,seeders,middlewares,modules,routes,docs}
frontend/   React app (Vite) — src/{app,features,pages,components,routes,services,theme}
```

Each backend module follows `routes.js -> validate(Joi) -> auth -> rbac -> controller -> service -> model`.
Comments, votes, tags, attachments, and status history are generic polymorphic tables/modules
reused by all three feature modules instead of being reimplemented per entity.

## Getting started

### 1. Database

Uses the native PostgreSQL install on this machine (port 5432) — no Docker involved. A dedicated
login role and database were created for the app:

```sql
-- Already done for this machine, shown here for reference / other environments:
CREATE ROLE aams WITH LOGIN PASSWORD 'your-password-here';
CREATE DATABASE aams OWNER aams;
```

Adjust `DB_HOST`/`DB_PORT`/`DB_USER`/`DB_PASSWORD` in `backend/.env` to match whatever Postgres
instance you're pointing at.

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env      # adjust DB_PORT etc. if needed
npm run migrate
npm run seed
npm run dev                # http://localhost:5000, Swagger UI at /api-docs
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev                 # http://localhost:5173
```

Or from the repo root, once both `node_modules` are installed: `npm run dev` runs both
concurrently.

### Demo accounts (password: `Passw0rd!`)

| Email | Role |
|---|---|
| admin@aams.local | Admin |
| ceo@aams.local | CEO |
| manager@aams.local | Manager |
| teamlead@aams.local | Team Lead |
| employee1@aams.local / employee2@aams.local / employee3@aams.local / employee4@aams.local / employee5@aams.local | Employee |

## What's seeded

3 demo applications (with tech stack, features, AI prompts, architecture docs, release notes,
bug history, roadmap, timeline), 3 demo ideas (in various workflow states, with comments/votes),
2 demo suggestions (with comments/votes/notifications), departments, and the full
role → permission matrix.

## Notes / roadmap

- Notifications are polled (every 30s) rather than pushed over a websocket — noted as a
  follow-up in the in-app roadmap tab.
- DB table docs (`db_table_docs`) are hand-maintained documentation, not a live schema
  introspection — also flagged as a roadmap item on the seeded "Application Library and
  Management System" application itself.
- File storage is local disk behind a driver interface (`backend/src/modules/attachments/storage.js`)
  ready to swap for S3 by adding a driver with the same `{save, remove}` shape.
