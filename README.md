## Campus Lost and Found Management System

**Group Members:**
- Rayandayan, Justine R.
- Jereza, Robert S.
- Sarabi, Aldemhar Khan F.
- Macaumbos Jr, Sadjid E.
- Arique, Enrico Nillo V.


## ReFound

ReFound is a mobile-first lost-and-found app built with React, Express, and MySQL. Users can post lost or found items, browse and search open reports.

## Requirements

- Node.js 18 or newer and npm
- MySQL 8

## Setup

1. Copy `server/.env.example` to `server/.env` and configure the MySQL connection.
2. Set `STAFF_USERNAME` and a unique `STAFF_PASSWORD` (at least 12 characters) in `server/.env` for the initial staff account. The server stores a scrypt password hash. The account is created only if that username does not already exist.
3. Copy `client/.env.example` to `client/.env` if the API is not at `http://localhost:5000/api`.
4. Create the database once. Replace `refound` and `root` if your server environment uses different values:

```powershell
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS refound CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;"
```

The server creates the required tables from `server/src/db/schema.sql` before it starts. The configured database user needs permission to create tables.

5. Install dependencies and run each app in its own terminal:

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
- Public found reports are listed immediately as **With finder**; lost reports are listed as **Lost report**.
- Claimants can submit claims before staff receives the item. Claims are reviewed by authenticated staff.
- Staff receive found items into a recorded storage location, verify them, approve or reject claims, and mark approved returns resolved.
- Staff can reopen resolved cases. Reporter management access is read-only; only staff can change workflow states or decide claims.

There is no email delivery. A random management key is created when a report is submitted and saved in that browser. Keep that browser's storage to view the report and its claims. If browser storage is unavailable, the key is shown once; save it privately. Reporter and claimant contact details are not public. Staff login sessions expire after eight hours and are cleared when the API restarts.

## API

- `GET /api/health` — API process health; does not test MySQL.
- `GET /api/items` — list open items; optional `type=lost|found`, `q=search`, and `category`.
- `POST /api/items` — create a report; returns the public item and one-time management key.
- `GET /api/items/:id/matches` — return possible opposite-type matches.
- `POST /api/items/:id/claims` — submit a claim for an active report, including a found item still with its finder.
- `GET /api/manage/:id` — get a managed item and its claims; requires `X-Management-Token`.
- `POST /api/staff/auth/login`, `GET /api/staff/auth/session`, `POST /api/staff/auth/logout` — staff session lifecycle.
- `GET /api/staff/items?status=active|all|<status>` — staff dashboard and private report/claim details; requires a staff bearer token.
- `PATCH /api/staff/items/:id/receive` — receive a found item and record its storage location.
- `PATCH /api/staff/items/:id/verify` — verify a received item.
- `PATCH /api/staff/items/:id/claims/:claimId` — approve or decline a pending claim after verification.
- `PATCH /api/staff/items/:id/resolve` and `/reopen` — resolve an approved return or reopen a case.

The item lifecycle is enforced by the API: found reports start `with_finder`, only staff can receive and verify them, claim approval requires verification, and resolution requires an approved pickup. Lost reports use `lost_reported` and cannot be processed as found-item custody cases.

The client uses `VITE_API_URL`, defaulting to `http://localhost:5000/api`. The server reads `PORT`, `FRONTEND_URL`, database settings, and initial staff credentials from `server/.env`. Never commit `.env` files. Existing database installations are migrated on server startup.

## Verify

```powershell
cd server
npm test
cd ..\client
npm run build
```
