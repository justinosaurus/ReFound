# ReFound

ReFound is a mobile-first lost-and-found app built with React, Express, and MySQL. Users can post lost or found items, browse and search open reports, view possible matches, and send private claims to reporters.

## Requirements

- Node.js 18 or newer and npm
- MySQL 8

## Setup

1. Copy `server/.env.example` to `server/.env` and configure the MySQL connection.
2. Copy `client/.env.example` to `client/.env` if the API is not at `http://localhost:5000/api`.
3. Create the database once. Replace `refound` and `root` if your server environment uses different values:

```powershell
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS refound CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;"
```

The server creates the required tables from `server/src/db/schema.sql` before it starts. The configured database user needs permission to create tables.

4. Install dependencies and run each app in its own terminal:

```powershell
cd server
npm install
npm run dev
```

```powershell
cd client
npm install
npm run dev
```

Vite prints the frontend address, usually `http://localhost:5173`. The API runs at `http://localhost:5000`.

## Features

- Create lost or found reports with private contact details.
- Browse and search open items by type and keywords.
- View up to five possible opposite-type matches based on category, location, and description.
- Send a private claim with contact details and identifying information.
- Manage reports, review claims, contact claimants, and mark reports open or resolved.

There are no user accounts or email delivery. A random management key is created when a report is submitted and saved in that browser. Keep that browser's storage to manage the report. If browser storage is unavailable, the key is shown once; save it privately. Reporter and claimant contact details are not public. Reporters review claims and contact claimants themselves.

## API

- `GET /api/health` — API process health; does not test MySQL.
- `GET /api/items` — list open items; optional `type=lost|found`, `q=search`, and `category`.
- `POST /api/items` — create a report; returns the public item and one-time management key.
- `GET /api/items/:id/matches` — return possible opposite-type matches.
- `POST /api/items/:id/claims` — submit a claim for an open report.
- `GET /api/manage/:id` — get a managed item and its claims; requires `X-Management-Token`.
- `PATCH /api/manage/:id/status` — set report status to `open` or `resolved`.
- `PATCH /api/manage/:id/claims/:claimId` — accept or decline a pending claim.

The client uses `VITE_API_URL`, defaulting to `http://localhost:5000/api`. The server reads `PORT`, `FRONTEND_URL`, and `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` from `server/.env`. Never commit `.env` files.

## Verify

```powershell
cd server
npm test
cd ..\client
npm run build
```
