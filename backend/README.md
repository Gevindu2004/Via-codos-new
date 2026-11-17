# Via Codos Standalone Backend API (Azure SQL)

This folder contains the standalone Express + TypeScript + Prisma backend service configured for **Azure SQL Database** (`provider = "sqlserver"`).

## Structure

- `prisma/schema.prisma` — Azure SQL schema with `@db.NVarChar(Max)` for long HTML/JSON/signature fields and SQL-Server-safe referential actions.
- `prisma/seed.ts` — Non-destructive initial data seeder for Azure SQL.
- `src/server.ts` — Express server entry point (`PORT=4000` by default).
- `src/middleware/auth.ts` — JWT cookie / Bearer token authentication (`requireAdmin`, `requireClient`).
- `src/routes/` — Modular REST API handlers (`health`, `auth`, `talent`, `portal`, `admin`, `public`).
- `src/lib/` — Prisma client, auth/JWT helpers, audit logging, SMTP email outbox, PDF e-sign stamping, and talent anonymization.

## Setup with Azure SQL

1. Install dependencies inside `backend/`:
   ```bash
   cd backend
   npm install
   ```

2. Create `backend/.env` from `backend/.env.example` and paste your Azure SQL connection string:
   ```env
   DATABASE_URL="sqlserver://<your-server>.database.windows.net:1433;database=<your-db>;user=<your-user>;password=<your-password>;encrypt=true;trustServerCertificate=false;hostNameInCertificate=*.database.windows.net;loginTimeout=30"
   ```
   *(Make sure your IP address is allowed in your Azure SQL Server firewall rules.)*

3. Push schema to Azure SQL and seed initial data:
   ```bash
   npx prisma generate
   npx prisma db push
   npm run db:seed
   ```

4. Start the backend server:
   ```bash
   npm run dev
   ```
   Verify health at `http://localhost:4000/api/health`.

