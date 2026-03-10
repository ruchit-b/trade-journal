# TradeEdge

Swing trade journal for NSE/BSE (Indian stock market) traders.

## Structure

- **client/** – React + Vite frontend (Tailwind, React Router, TanStack Query, etc.)
- **server/** – Node.js + Express + Prisma backend (PostgreSQL, JWT auth)
- **shared/** – Shared TypeScript types

## Setup

1. **Install dependencies** (this also builds the `shared` package)

   ```bash
   npm install
   ```

2. **Environment**

   - Copy `client/.env.example` to `client/.env`
   - Copy `server/.env.example` to `server/.env`
   - Set `DATABASE_URL` and `JWT_SECRET` in `server/.env`

3. **Database**

   Start PostgreSQL (e.g. via Docker) then run:

   ```bash
   cd server && npx prisma migrate dev
   ```

   Or with Docker:

   ```bash
   docker compose up -d postgres
   cd server && npx prisma migrate dev
   ```

4. **Run dev**

   From repo root:

   ```bash
   npm run dev
   ```

   - Frontend: http://localhost:5173  
   - Backend: http://localhost:4000  

## Scripts

- `npm run dev` – run client and server concurrently
- `npm run dev:client` – client only (Vite, port 5173)
- `npm run dev:server` – server only (ts-node-dev, port 4000)
- `npm run build` – build shared, then client, then server (from repo root)
- **Server:** `db:migrate` for development; `db:migrate:deploy` for production (run before `npm start` in deploy)

---

## Production

### Required environment variables

**Server** (fail fast at startup if missing):

- `DATABASE_URL` – PostgreSQL connection string (e.g. [Neon](https://neon.tech))
- `JWT_SECRET` – strong random string for signing tokens
- `CLIENT_URL` – frontend origin for CORS (e.g. `https://your-app.vercel.app`); required when `NODE_ENV=production`
- `NODE_ENV=production` recommended in production

**Client** (build-time, set in hosting dashboard):

- `VITE_API_URL` – API base URL (e.g. `https://your-api.onrender.com`)

### Deploy (free tiers only)

1. **Database:** [Neon](https://neon.tech) – create project, copy connection string → `DATABASE_URL`.
2. **Backend:** [Render](https://render.com) – Web Service, Node; build: `npm install && npm run build` (from repo root); start: `npm run start:server` (runs migrations then server). Set `DATABASE_URL`, `JWT_SECRET`, `CLIENT_URL`, `NODE_ENV=production`. Use **Health Check Path** `/health` if offered.
3. **Frontend:** [Vercel](https://vercel.com) or [Cloudflare Pages](https://pages.cloudflare.com) – root `client`, build `npm run build`, output `dist`. Set `VITE_API_URL` to your Render API URL. Then set Render’s `CLIENT_URL` to your frontend URL.
4. **Uploads (optional):** On Render the filesystem is ephemeral. For persistent uploads use [Cloudflare R2](https://developers.cloudflare.com/r2/) (free tier); set `CLOUDFLARE_R2_*` and `CLOUDFLARE_R2_PUBLIC_URL` in the server environment.
