
  # Expedite GRC

  This is a code bundle for Expedite GRC. The original project is available at https://www.figma.com/design/81zRCWhIiue8fy0HTI3WPN/Expedite-GRC.

  ## Running the code

  The app needs both the frontend and the backend running, each with its own `.env`
  file. The `.env` files are not committed.

  ### Backend

  Create `backend/.env`:

  ```
  PORT=3001
  DOMINIOS_PERMITIDOS=expedite.com
  AUTH_MODE=dev
  DATA_MODE=memoria
  ```

  ```bash
  cd backend
  corepack pnpm install
  corepack pnpm dev       # http://localhost:3001
  ```

  ### Frontend

  Create `.env` in the project root:

  ```
  VITE_API_URL=http://localhost:3001
  VITE_AUTH_MODE=dev
  ```

  ```bash
  npm i
  npm run dev             # http://localhost:5173
  ```

  With these values the app runs in local development mode: no Azure resources
  needed, sign in with a test user such as `s.ramirez@expedite.com` (Administrador)
  or `a.rodriguez@expedite.com` (Auditor). Data lives in memory and resets when the
  backend restarts.

  ### Environment variables

  Backend (`backend/.env`):

  | Variable | Description |
  |---|---|
  | `PORT` | API port. Default `3001`. |
  | `CORS_ORIGIN` | Allowed frontend origins, comma separated. Default `http://localhost:5173,http://localhost:5174`. |
  | `DOMINIOS_PERMITIDOS` | Corporate email domains allowed when creating users, comma separated. Required. |
  | `AUTH_MODE` | `entra` (Microsoft Entra ID, default) or `dev` (local only, refused in production). |
  | `ENTRA_TENANT_ID`, `ENTRA_CLIENT_ID` | Required when `AUTH_MODE=entra`. |
  | `DATA_MODE` | `sql` (Azure SQL, default) or `memoria` (local only, refused in production). |
  | `SQL_SERVER`, `SQL_DATABASE`, `SQL_USER`, `SQL_PASSWORD` | Required when `DATA_MODE=sql`. |
  | `SQL_PORT`, `SQL_TRUST_CERT` | Optional, only for a local SQL Server (e.g. Docker). |

  Frontend (`.env`):

  | Variable | Description |
  |---|---|
  | `VITE_API_URL` | Backend URL. Default `http://localhost:3001`. |
  | `VITE_AUTH_MODE` | `entra` (default) or `dev` (requires the backend in `AUTH_MODE=dev`). |
  | `VITE_ENTRA_TENANT_ID`, `VITE_ENTRA_CLIENT_ID` | Required when `VITE_AUTH_MODE=entra`. |
  | `VITE_ENTRA_API_SCOPE` | Optional. Default `api://<VITE_ENTRA_CLIENT_ID>/access_as_user`. |

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
