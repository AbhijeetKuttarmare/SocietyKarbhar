# Society Karbhar — Scaffold

This workspace contains a scaffold for the Society Karbhar application.

Structure
- backend/ — Node + Express + Sequelize (Postgres)
- frontend/ — React + Vite

Quick start (Windows)

1) Backend

 - Copy `.env.example` to `.env` inside `backend/` and fill values.
 - Install deps:

```bash
cd backend
npm install
```

 - Seed the database (creates sample users and society):

```bash
npm run seed
```

 - Run server

```bash
npm run dev
```

2) Frontend

 - Install deps and run

```bash
cd frontend
npm install
npm run dev
```

Notes
- This is a minimal scaffold. Add role-based middleware, Cloudinary integration, OTP service, and full CRUD endpoints.
- The backend uses Postgres by default. To switch to MSSQL, update the Sequelize dialect and connection settings.
