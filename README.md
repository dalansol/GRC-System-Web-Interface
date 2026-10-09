# Expedite GRC

Plataforma web de Gobernanza, Riesgo y Cumplimiento para la Dirección de Auditoría
Interna. El diseño original está en
https://www.figma.com/design/81zRCWhIiue8fy0HTI3WPN/Expedite-GRC.

El proyecto tiene dos partes que se levantan por separado:

- **Frontend** (raíz del repo): React + Vite.
- **Backend** (`backend/`): Node + Express.

La aplicación pide iniciar sesión, así que **hay que levantar las dos**. Si solo
corre el frontend, aparece el mensaje "No se pudo conectar con el servidor de
Expedite".

## Cómo levantar el proyecto

### Requisitos

- Node.js 22 o 24 en una versión reciente (incluyen `npm` y `corepack`). Las
  herramientas de prueba exigen 22.22 o superior; el proyecto se desarrolló con la 24.19.
- No hace falta nada de Azure para trabajar en local.

### 1. Crear los archivos `.env`

Los `.env` no se suben a git, así que cada quien los crea en su máquina la primera vez.

`backend/.env`:

```
PORT=3000
DOMINIOS_PERMITIDOS=expedite.com
AUTH_MODE=dev
DATA_MODE=memoria
```

`.env` (en la raíz):

```
VITE_API_URL=http://localhost:3000/api
VITE_AUTH_MODE=dev
VITE_USE_REAL_BACKEND=false
```

### 2. Levantar el backend

En una terminal:

```bash
cd backend
corepack pnpm install     # solo la primera vez
corepack pnpm dev
```

Debe imprimir `API Expedite en http://localhost:3000/api (autenticación: dev, datos: memoria)`.

El backend usa **pnpm**. Si `corepack` no está disponible, instálalo con
`npm install -g pnpm` y usa `pnpm` en lugar de `corepack pnpm`.

### 3. Levantar el frontend

En otra terminal, desde la raíz:

```bash
npm install               # solo la primera vez
npm run dev
```

Abre la dirección que imprime Vite, normalmente http://localhost:5173. Si ese
puerto está ocupado Vite usa el 5174; el backend acepta ambos.

### 4. Entrar

En modo de desarrollo se entra escribiendo el correo de un usuario de prueba:

| Correo | Rol | Qué ve |
|---|---|---|
| `s.ramirez@expedite.com` | Administrador | Todo, incluido "Usuarios & Roles" |
| `m.garcia@expedite.com` | Jefe de Auditoría | Todo menos "Usuarios & Roles" |
| `a.rodriguez@expedite.com` | Auditor | Todo menos "Usuarios & Roles" |
| `p.sanchez@expedite.com` | Consultor (inactivo) | No puede entrar |

En este modo los datos de usuarios viven en memoria: se reinician cada vez que se
apaga el backend. La vista de hallazgos usa sus datos de prueba mientras
`VITE_USE_REAL_BACKEND` sea `false`; sus rutas en el backend solo existen con
`DATA_MODE=sql`, porque necesitan la base de datos. Los planes de acción de los
hallazgos (`/api/planes-accion`) sí funcionan en memoria: usan los hallazgos y
auditorías de prueba, y el portal del auditado muestra los planes asignados al
usuario con sesión (por ejemplo `c.morales@expedite.com` ya tiene uno).

### Problemas comunes

| Síntoma | Causa y solución |
|---|---|
| "No se pudo conectar con el servidor de Expedite" | El backend no está corriendo, o `VITE_API_URL` no apunta a su puerto. |
| "Expedite no pudo iniciar" al abrir la página | Falta el `.env` de la raíz. Después de crearlo hay que reiniciar `npm run dev`. |
| El backend termina con "Falta la variable de entorno ..." | Falta `backend/.env` o alguna de sus variables. |
| "Acceso no autorizado" | El correo no es de un usuario registrado o está inactivo. |

## Pruebas

```bash
npm test                          # frontend
cd backend && corepack pnpm test  # backend
```

Las pruebas del backend contra una base de datos real se omiten si no hay conexión
configurada; `docs/pruebas/usuarios-roles.md` explica cómo activarlas.

## Variables de entorno

Backend (`backend/.env`):

| Variable | Descripción |
|---|---|
| `PORT` | Puerto de la API. Por omisión `3000`. |
| `CORS_ORIGIN` | Orígenes del frontend permitidos, separados por coma. Por omisión `http://localhost:5173,http://localhost:5174`. |
| `DOMINIOS_PERMITIDOS` | Dominios de correo corporativo aceptados al dar de alta usuarios, separados por coma. Obligatoria. |
| `AUTH_MODE` | `entra` (Microsoft Entra ID, por omisión) o `dev` (solo local; no arranca en producción). |
| `ENTRA_TENANT_ID`, `ENTRA_CLIENT_ID` | Obligatorias con `AUTH_MODE=entra`. |
| `DATA_MODE` | `sql` (Azure SQL, por omisión) o `memoria` (solo local; no arranca en producción). |
| `DB_SERVER`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Obligatorias con `DATA_MODE=sql`. Las usan usuarios y hallazgos. |
| `DB_PORT` | Puerto de la base. Por omisión `1433`. |
| `DB_TRUST_CERT` | `true` para un SQL Server local con certificado autofirmado; no arranca en producción. La conexión siempre va cifrada. |

Frontend (`.env`):

| Variable | Descripción |
|---|---|
| `VITE_API_URL` | URL de la API, con el prefijo `/api`. Por omisión `http://localhost:3000/api`. |
| `VITE_USE_REAL_BACKEND` | `true` para que la vista de hallazgos use el backend; con `false` usa datos de prueba. |
| `VITE_AUTH_MODE` | `entra` (por omisión) o `dev` (requiere el backend con `AUTH_MODE=dev`). |
| `VITE_ENTRA_TENANT_ID`, `VITE_ENTRA_CLIENT_ID` | Obligatorias con `VITE_AUTH_MODE=entra`. |
| `VITE_ENTRA_API_SCOPE` | Opcional. Por omisión `api://<VITE_ENTRA_CLIENT_ID>/access_as_user`. |

## Conectar Azure SQL y Microsoft Entra ID

Cuando existan los recursos en Azure:

1. Ejecutar en la base de Azure SQL, en este orden, `backend/sql/001_schema.sql`,
   `002_seed.sql`, `003_primer_administrador.sql` (este último hay que editarlo
   antes con el nombre y correo del primer Administrador), `004_findings.sql`,
   `006_auditorias.sql` (auditorías con su fecha de cierre, usada por los planes
   de acción) y `007_action_plans.sql` (planes de acción de los hallazgos).
   `005_seed_findings.sql` carga hallazgos de prueba y solo es para desarrollo.
2. En `backend/.env`: `DATA_MODE=sql` con las variables `DB_*`, `AUTH_MODE=entra`
   con `ENTRA_TENANT_ID` y `ENTRA_CLIENT_ID`, y el dominio real en
   `DOMINIOS_PERMITIDOS`.
3. En el `.env` de la raíz: `VITE_AUTH_MODE=entra`, `VITE_ENTRA_TENANT_ID` y
   `VITE_ENTRA_CLIENT_ID`.

El registro de aplicación en Entra ID debe exponer el permiso `access_as_user` y
tener la URL del frontend como URI de redirección de tipo aplicación de página única.

## Documentación

- `docs/diseno/usuarios-roles.md`: diseño de la gestión de usuarios y roles.
- `docs/pruebas/usuarios-roles.md`: casos de prueba, resultados y defectos.
- `Visión y Alcance Sistema Auditoría.md`: requerimientos originales.
