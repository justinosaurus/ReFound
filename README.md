# ReFound

ReFound is a starter lost-and-found web app built with React, Express, and MySQL. This first version includes a welcoming home page, placeholder browsing and reporting pages, and a small API health check. Matching, claims, and item storage are not implemented yet.

## Project structure

```text
ReFound/
├── backend/     Express API and MySQL connection
└── frontend/    React app built with Vite
```

## Requirements

- Node.js 18 or newer and npm
- MySQL 8 (needed when you add database-backed features; the health check works without it)

## Setup

1. In `backend/`, copy `.env.example` to `.env` and set your MySQL connection values and desired port.
2. In `frontend/`, copy `.env.example` to `.env` if the API is not at the default `http://localhost:5000/api`.
3. Install dependencies and run each app in its own terminal:

```bash
cd backend
npm install
npm run dev
```

```bash
cd frontend
npm install
npm run dev
```

Vite prints the local frontend address, usually `http://localhost:5173`. The Express API runs at `http://localhost:5000` by default.

## Check the API

Open `http://localhost:5000/api/health` or run:

```bash
curl http://localhost:5000/api/health
```

The response includes `status: "ok"` and a timestamp. This endpoint confirms that Express is running; it does not test the MySQL connection.

## MySQL configuration

Create the database named in `DB_NAME` before connecting database-backed routes. The connection pool in `backend/src/config/db.js` reads `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, and `DB_NAME` from the backend environment. Never commit your `.env` files; `.env.example` contains safe placeholders.

## Frontend API URL

The frontend reads `VITE_API_URL` from its environment. Its default is `http://localhost:5000/api`. Set another URL in `frontend/.env` when the API runs elsewhere, then restart the Vite server. The home page uses this setting to check the API health endpoint.
