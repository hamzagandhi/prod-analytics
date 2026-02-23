# Vigility Analytics Dashboard

An interactive full-stack analytics dashboard that tracks and visualizes its own usage. Every time a user interacts with a filter or chart, that action is recorded and reflected in the analytics.

**Live Demo:** https://prod-analytics.vercel.app
**Demo Login:** `alice / password123`

---

## Features

- JWT authentication (register and login)
- Tracks every dashboard interaction via `/track`
- Filter by date, age group, and gender
- Bar chart showing total clicks per feature
- Line chart showing daily trends
- Filter selections saved in cookies
- Seeder script with demo users and realistic event data

---

## Tech Stack

### Backend
- Node.js
- Express.js
- SQLite3
- JWT authentication
- bcrypt password hashing

### Frontend
- React 18
- Recharts (charts)
- js-cookie (filter persistence)

---

## Project Structure

```
analytics-dashboard/
│
├── backend/
│   ├── server.js       # All API endpoints
│   ├── db.js           # SQLite3 connection + schema
│   ├── auth.js         # JWT middleware
│   ├── seed.js         # Demo data seeder
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── pages/
    │   │   ├── AuthPage.js     # Login + Register
    │   │   └── Dashboard.js    # Charts + Filters
    │   ├── api.js              # API fetch wrappers
    │   ├── AuthContext.js      # Auth state
    │   ├── App.js
    │   └── App.css
    └── package.json
```

---

## Running Locally

### Backend

```bash
cd backend
npm install
cp .env.example .env
npm run seed
npm start
```

Runs on: `http://localhost:4000`

### Frontend

```bash
cd frontend
npm install
npm start
```

Runs on: `http://localhost:3000`

---

## Demo Accounts

| Username | Password    |
|----------|-------------|
| alice    | password123 |
| bob      | password123 |
| charlie  | password123 |
| diana    | password123 |
| evan     | password123 |

---

## Seeder

```bash
cd backend
npm run seed
```

Creates:
- 5 demo users
- 200 feature click events spread across the last 90 days

---

## API Overview

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/register` | No | Create a new account |
| POST | `/login` | No | Login and receive JWT token |
| POST | `/track` | Yes | Record a user interaction |
| GET | `/analytics` | Yes | Fetch aggregated analytics data |

---

## Deployment

**Backend:** Render  
**Frontend:** Vercel

### Environment Variables

Backend (`.env`):
```
PORT=4000
JWT_SECRET=secret
FRONTEND_URL=https://prod-analytics.vercel.app
DB_PATH=/var/data/analytics.db
```

Frontend (`.env`):
```
REACT_APP_API_URL=https://prod-analytics-9s0q.onrender.com
```

> **Note:** On Render, add a Persistent Disk mounted at `/var/data` so the SQLite3 file survives restarts.
Render may take a while responding to the first requests as it goes to sleep if idle for long time. please be patient.

---

## Scalability (1M events/min)

At large scale, direct DB writes would fail. The backend should publish events to a message queue like Kafka, and background workers would batch-insert into an analytics database such as ClickHouse. Multiple API instances behind a load balancer and Redis caching would ensure scalability and fast reads.

This ensures high throughput, reliability, and scalability.

## Author
Hamza Gandhi