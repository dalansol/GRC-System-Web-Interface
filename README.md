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
VITE_USE_REAL_BACKEND=true
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
apaga el backend. La vista de hallazgos usa la API por omisión; para trabajar sin
la base de datos se puede establecer explícitamente `VITE_USE_REAL_BACKEND=false`,
en cuyo caso usa sus datos de prueba. Las rutas reales de hallazgos solo existen
con `DATA_MODE=sql`, porque necesitan la base de datos. Los planes de acción de los
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
| `PERMITIR_DEV_EN_PRODUCCION` | `true` permite `AUTH_MODE=dev` en producción, solo para una demostración: cualquiera entra escribiendo el correo de un usuario registrado. |
| `ENTRA_TENANT_ID`, `ENTRA_CLIENT_ID` | Obligatorias con `AUTH_MODE=entra`. |
| `DATA_MODE` | `sql` (PostgreSQL en Supabase, por omisión) o `memoria` (solo local; no arranca en producción). |
| `DB_SERVER`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Obligatorias con `DATA_MODE=sql`. Las usan usuarios y hallazgos. |
| `DB_PORT` | Puerto de la base. Por omisión `5432`. |
| `DB_CA_CERT` | Archivo con el certificado de la autoridad que firma el del servidor; con Supabase, el que se descarga del proyecto. También acepta el contenido del certificado (`-----BEGIN CERTIFICATE-----…`), como se usa en Vercel. |
| `DB_TRUST_CERT` | `true` para un PostgreSQL local con certificado autofirmado; no arranca en producción. La conexión siempre va cifrada. |
| `IA_PROVEEDOR` | Asistente de IA (SF-19): `gemini`, `azure` o `ninguno` (por omisión; la función queda desactivada y el resto de la plataforma funciona). Comprueba la conexión con `corepack pnpm ia:probar` y las reglas de contención con `corepack pnpm ia:evaluar`. |
| `GEMINI_API_KEY`, `GEMINI_MODELO` | Obligatorias con `IA_PROVEEDOR=gemini` (clave de Google AI Studio y modelo, p. ej. `gemini-2.5-flash`). El plan gratuito solo es para documentos de prueba. |
| `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_DEPLOYMENT`, `AZURE_OPENAI_API_VERSION` | Obligatorias con `IA_PROVEEDOR=azure`. |
| `IA_TIEMPO_ESPERA_MS` | Tiempo máximo de espera de la IA. Por omisión `30000`. |

Frontend (`.env`):

| Variable | Descripción |
|---|---|
| `VITE_API_URL` | URL de la API, con el prefijo `/api`. Por omisión `http://localhost:3000/api`. |
| `VITE_USE_REAL_BACKEND` | `true` (por omisión) para que la vista de hallazgos use el backend; con `false` usa datos de prueba. |
| `VITE_AUTH_MODE` | `entra` (por omisión) o `dev` (requiere el backend con `AUTH_MODE=dev`). |
| `VITE_PERMITIR_DEV_EN_PRODUCCION` | `true` permite `VITE_AUTH_MODE=dev` en la compilación de producción (p. ej. en Vercel), solo para una demostración. |
| `VITE_ENTRA_TENANT_ID`, `VITE_ENTRA_CLIENT_ID` | Obligatorias con `VITE_AUTH_MODE=entra`. |
| `VITE_ENTRA_API_SCOPE` | Opcional. Por omisión `api://<VITE_ENTRA_CLIENT_ID>/access_as_user`. |

## Conectar Supabase y Microsoft Entra ID

Base de datos (detalle en `docs/diseno/base-de-datos.md`):

1. En `backend/.env`: `DATA_MODE=sql` con las variables `DB_*` de la base compartida
   (plantilla en `backend/.env.example`).
2. Aplicar el esquema desde `backend/`: `corepack pnpm db:migrar`. Corre, en orden, los
   scripts de `backend/sql/` que le falten a la base. Con `--datos-prueba` agrega
   hallazgos y controles de prueba (solo desarrollo), y con `--admin-nombre` y
   `--admin-correo` da de alta al primer Administrador.

Inicio de sesión, cuando exista el registro de aplicación en Entra ID:

1. En `backend/.env`: `AUTH_MODE=entra` con `ENTRA_TENANT_ID` y `ENTRA_CLIENT_ID`, y el
   dominio real en `DOMINIOS_PERMITIDOS`.
2. En el `.env` de la raíz: `VITE_AUTH_MODE=entra`, `VITE_ENTRA_TENANT_ID` y
   `VITE_ENTRA_CLIENT_ID`.

El registro de aplicación en Entra ID debe exponer el permiso `access_as_user` y
tener la URL del frontend como URI de redirección de tipo aplicación de página única.

## Documentación

- `docs/diseno/base-de-datos.md`: modelo entidad-relación, conexión a la base compartida y migraciones.
- `docs/diseno/usuarios-roles.md`: diseño de la gestión de usuarios y roles.
- `docs/pruebas/usuarios-roles.md`: casos de prueba, resultados y defectos.
- `Visión y Alcance Sistema Auditoría.md`: requerimientos originales.
