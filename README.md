
  # Expedite GRC

  This is a code bundle for Expedite GRC. The original project is available at https://www.figma.com/design/81zRCWhIiue8fy0HTI3WPN/Expedite-GRC.

  ## Running the code

  The app needs both the frontend and the backend running.

  ### Backend

  ```bash
  cd backend
  cp .env.example .env    # first time only
  corepack pnpm install
  corepack pnpm dev       # http://localhost:3001
  ```

  ### Frontend

  ```bash
  cp .env.example .env    # first time only
  npm i
  npm run dev             # http://localhost:5173
  ```

  With the example `.env` files the app runs in local development mode: no Azure
  resources needed, sign in with a test user such as `s.ramirez@expedite.com`
  (Administrador) or `a.rodriguez@expedite.com` (Auditor). Data lives in memory and
  resets when the backend restarts.

  ### Connecting Azure SQL and Microsoft Entra ID

  1. Run `backend/sql/001_schema.sql`, `002_seed.sql` and `003_primer_administrador.sql`
     (edit the name and email first) on the Azure SQL database.
  2. In `backend/.env` set `DATA_MODE=sql`, the `SQL_*` variables, `AUTH_MODE=entra`,
     `ENTRA_TENANT_ID`, `ENTRA_CLIENT_ID` and `DOMINIOS_PERMITIDOS`.
  3. In `.env` set `VITE_AUTH_MODE=entra`, `VITE_ENTRA_TENANT_ID` and `VITE_ENTRA_CLIENT_ID`.

  The Entra ID app registration must expose the scope `access_as_user` and list the
  frontend URL as a single-page application redirect URI.

  ## Tests

  ```bash
  npm test                          # frontend
  cd backend && corepack pnpm test  # backend
  ```

  Design and test documentation for users and roles: `docs/diseno/usuarios-roles.md`
  and `docs/pruebas/usuarios-roles.md`.
