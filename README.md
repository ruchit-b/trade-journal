# TradeEdge

Swing trade journal for NSE/BSE (Indian stock market) traders.

## Structure

- **client/** – React + Vite frontend (Tailwind, React Router, TanStack Query, Recharts, etc.)
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
