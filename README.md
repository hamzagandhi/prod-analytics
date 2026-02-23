# Vigility Analytics Dashboard

An interactive full-stack product analytics dashboard that **visualizes its own usage**. Every interaction a user makes with the dashboard (changing a filter, clicking a chart bar) is tracked as an event and fed back into the visualizations.

---

## Live Demo

> **URL**: _Deploy and add your URL here_  
> **Demo Credentials**: `alice / password123`

---

## Features

- **JWT Authentication** — Register and login with hashed passwords
- **Self-Tracking** — Every filter change and chart interaction fires a `POST /track` event
- **Filter Persistence** — Selected filters (date range, age group, gender) are saved in cookies and restored on page refresh
- **Bar Chart** — Horizontal bar chart showing total clicks per feature; clicking a bar drills into the line chart
- **Line Chart** — Daily click trend for the selected feature (or all features)
- **Stats Strip** — At-a-glance numbers: total events, features tracked, days with data, top feature
- **Seeding** — Script to populate 5 demo users + 200 click events across 90 days

---

## Architecture

```
analytics-dashboard/
├── backend/          # Node.js + Express REST API
│   ├── server.js     # Main app with all endpoints
│   ├── db.js         # SQLite connection + schema init
│   ├── auth.js       # JWT middleware + token generation
│   ├── seed.js       # Database seeder (npm run seed)
│   ├── .env.example
│   └── package.json
│
└── frontend/         # React SPA
    ├── src/
    │   ├── App.js         # Root + routing between auth and dashboard
    │   ├── App.css        # All styles (dark theme, responsive)
    │   ├── AuthContext.js # React context for user session
    │   ├── api.js         # Fetch wrappers for all API calls
    │   ├── pages/
    │   │   ├── AuthPage.js    # Login + Register form
    │   │   └── Dashboard.js   # Main dashboard with charts + filters
    │   └── index.js
    └── package.json
```

### Technology Choices

| Concern | Choice | Reason |
|---|---|---|
| Backend framework | **Express.js** | Minimal, fast, widely understood |
| Database | **SQLite (better-sqlite3)** | Zero-config for dev; swap to PostgreSQL for production |
| Auth | **JWT (jsonwebtoken)** | Stateless, easy to verify on every request |
| Password hashing | **bcryptjs** | Industry standard, pure JS (no native deps) |
| Frontend framework | **React 18** | Component model fits the dashboard well |
| Charts | **Recharts** | Composable, well-maintained, works with Recharts' ResponsiveContainer |
| Filter persistence | **js-cookie** | Tiny, no deps; stores last-used filters for 30 days |
| Date helpers | **date-fns** | Tree-shakeable, functional API |

---

## Local Development

### Prerequisites
- Node.js v18+
- npm v9+

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd analytics-dashboard
```

### 2. Set up the Backend

```bash
cd backend
npm install
cp .env.example .env   # Edit JWT_SECRET at minimum
npm run seed           # Populate DB with demo data
npm run dev            # Starts on http://localhost:4000
```

**Environment variables** (`.env`):
```
PORT=4000
JWT_SECRET=your-random-secret-here
FRONTEND_URL=http://localhost:3000
```

### 3. Set up the Frontend

```bash
cd ../frontend
npm install
# Optional: set REACT_APP_API_URL if backend is not on port 4000
npm start              # Starts on http://localhost:3000
```

> The `"proxy": "http://localhost:4000"` in frontend's `package.json` forwards API calls in dev automatically.

### 4. Open the app

Navigate to `http://localhost:3000` and log in with:
- `alice / password123`
- `bob / password123`
- `charlie / password123`
- `diana / password123`
- `evan / password123`

---

## Seed Instructions

```bash
cd backend
npm run seed
```

This script:
1. Inserts 5 demo users (or skips if they already exist via `INSERT OR IGNORE`)
2. Inserts **200 feature click events** randomly distributed across the last 90 days
3. Weights feature usage realistically (`date_filter` is used most, `dashboard_refresh` least)

Re-running the seeder is safe — it will not duplicate users, but will add another 200 click records.

---

## API Reference

### `POST /register`
```json
{ "username": "alice", "password": "password123", "age": 25, "gender": "Female" }
```
Returns `{ token, user }`.

### `POST /login`
```json
{ "username": "alice", "password": "password123" }
```
Returns `{ token, user }`.

### `POST /track` _(requires Bearer token)_
```json
{ "feature_name": "date_filter" }
```
Returns the created record.

### `GET /analytics` _(requires Bearer token)_
Query params: `start_date`, `end_date`, `age` (`<18` | `18-40` | `>40`), `gender`, `feature`

Returns:
```json
{
  "bar_chart":  [{ "feature_name": "date_filter", "total_clicks": 87 }, ...],
  "line_chart": [{ "date": "2025-01-01", "feature_name": "date_filter", "clicks": 5 }, ...],
  "total_clicks": 312
}
```

---

## Deployment

### Backend → Render (recommended)

1. Create a new **Web Service** on [Render](https://render.com)
2. Set root directory to `backend/`
3. Build command: `npm install`
4. Start command: `node server.js`
5. Add environment variables: `JWT_SECRET`, `FRONTEND_URL`, `PORT`
6. For persistence across restarts, upgrade to a **PostgreSQL** add-on (see PostgreSQL note below)

### Frontend → Vercel or Netlify

1. Set root directory to `frontend/`
2. Build command: `npm run build`
3. Output directory: `build`
4. Add environment variable: `REACT_APP_API_URL=https://your-backend.onrender.com`

### PostgreSQL Note

The backend is written for SQLite but can be switched to PostgreSQL by:
1. Installing `pg` and `knex`: `npm install pg knex`
2. Replacing `better-sqlite3` calls in `db.js` and `server.js` with parameterized Knex queries
3. Setting `DATABASE_URL` environment variable on Render's managed Postgres

---

## Scalability Essay

> **If this dashboard needed to handle 1 million write events per minute, how would you change the backend architecture?**

At 1M writes/min (~16,700/sec), a single Express + SQLite/PostgreSQL instance would immediately become the bottleneck. The first change would be to decouple the write path from the read path entirely: instead of writing directly to PostgreSQL on every `POST /track`, the API would publish each event to a **message queue** (Apache Kafka or AWS Kinesis). The `/track` endpoint becomes near-instant — it just produces a Kafka message and returns 201. A separate fleet of **consumer workers** reads from Kafka and bulk-inserts events into the database in efficient batches (e.g., 1,000 rows at a time every 500ms), dramatically reducing write amplification. The PostgreSQL database itself would be replaced or supplemented with a **columnar analytics store** like ClickHouse or AWS Redshift, which is purpose-built for high-throughput append workloads and aggregation queries. The `/analytics` read endpoint would query this OLAP store. For horizontal scaling, multiple stateless Express API instances would run behind a **load balancer** (AWS ALB / NGINX), all publishing to the same Kafka topic. Finally, heavily-repeated analytics queries (e.g., last-24h totals) would be cached in **Redis** with a short TTL (30–60 seconds) to avoid hammering the OLAP store on every dashboard refresh.

---

## Evaluation Checklist

- [x] **Auth** — JWT register + login, protected endpoints
- [x] **Filters work** — All filter combinations hit SQL `WHERE` clauses correctly
- [x] **Filter persistence** — Saved to cookies, restored on page refresh
- [x] **Bar chart** — Feature usage with click-through to drill into line chart
- [x] **Line chart** — Daily trend, updates when bar is clicked
- [x] **Self-tracking** — Every filter/chart interaction fires `POST /track`
- [x] **Seeding** — `npm run seed` produces 200 realistic events across 5 users
- [x] **Responsive** — Grid collapses gracefully on mobile
- [x] **Code quality** — Separation of concerns: db, auth, routes, React components, API layer
- [x] **SQL aggregations** — `COUNT(*) GROUP BY` for bar; `COUNT(*) GROUP BY DATE` for line
