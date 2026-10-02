# Diseño: gestión de usuarios y roles

Fecha: 2026-10-01
Requisitos: SF-16, SF-17, SNF-05
Módulo: Usuarios y accesos

## Objetivo

Que un Administrador pueda ver a todos los usuarios, cambiarles el rol y dar de alta
usuarios nuevos del dominio corporativo, con la sesión iniciada mediante Microsoft
Entra ID y los datos guardados en Azure SQL.

## Criterios de aceptación

1. La tabla de usuarios muestra nombre completo, correo corporativo, rol actual y
   estado de cuenta.
2. Al cambiar el rol de un usuario, sus permisos se actualizan de inmediato.
3. El alta de un usuario cuyo correo no pertenece al dominio corporativo se rechaza
   con un mensaje de error explícito.

El acceso a las tres funciones es exclusivo del rol Administrador.

## Modelo de datos

Sigue las convenciones del modelo de datos del equipo (tablero de Miro "EXPDN -
Modelos del sistema GRC"): nombres en inglés, `snake_case`, llave primaria `id`
entera. Otras tablas del modelo ya referencian `users.id`.

| Tabla | Columnas |
|---|---|
| `roles` | `id` PK, `name` único |
| `permissions` | `id` PK, `name` único |
| `role_permissions` | `role_id` FK, `permission_id` FK, PK compuesta |
| `users` | `id` PK, `name`, `email` único, `role_id` FK, `status` (`active` / `inactive`), `entra_oid` único nulo, `last_login` nulo, `created_at` |

Cambio respecto al modelo en Miro: `users.role` (texto) se sustituye por
`users.role_id` (llave foránea a `roles`). La relación rol–permiso es de muchos a
muchos, por eso existe `role_permissions`.

Datos iniciales: los 6 roles y 8 permisos de `src/app/data/mock_data.tsx`.

Scripts en `backend/sql/`: `001_schema.sql`, `002_seed.sql` y
`003_primer_administrador.sql` (crea al primer Administrador; hay que editar su nombre
y correo antes de ejecutarlo).

## Backend (`backend/src/`)

Node + Express 5 + TypeScript, módulos ES.

```
config.ts                  variables de entorno
app.ts                     crea la app Express a partir de sus dependencias
server.ts                  arranque
domain/tipos.ts            Usuario, Rol
domain/dominio.ts          validación de dominio de correo
repos/repositorio.ts       interfaz RepositorioUsuarios
repos/memoria.ts           implementación en memoria (pruebas y desarrollo)
repos/sql.ts               implementación sobre Azure SQL (mssql)
auth/verificador.ts        interfaz VerificadorToken + implementación Entra y dev
middleware/autenticar.ts   valida el token y carga al usuario
middleware/autorizar.ts    exige uno de los roles indicados
routes/usuarios.ts         endpoints
bitacora.ts                punto único de registro de eventos
```

### Endpoints

| Método y ruta | Acceso | Respuesta |
|---|---|---|
| `GET /api/me` | autenticado | usuario en sesión con rol y permisos |
| `GET /api/roles` | autenticado | roles con sus permisos |
| `GET /api/usuarios` | Administrador | lista de usuarios |
| `POST /api/usuarios` | Administrador | 201 con el usuario creado |
| `PATCH /api/usuarios/:id/rol` | Administrador | usuario actualizado con permisos nuevos |

Errores con forma `{ "error": { "codigo", "mensaje" } }`:

| Situación | HTTP | Código |
|---|---|---|
| Sin token o token inválido | 401 | `NO_AUTENTICADO` |
| Usuario no registrado o inactivo | 403 | `USUARIO_NO_AUTORIZADO` |
| Rol sin acceso | 403 | `ROL_NO_AUTORIZADO` |
| Datos faltantes o mal formados | 400 | `DATOS_INVALIDOS` |
| Correo fuera del dominio corporativo | 422 | `DOMINIO_NO_AUTORIZADO` |
| Correo ya registrado | 409 | `CORREO_DUPLICADO` |
| Quitar el rol al único Administrador activo | 409 | `ULTIMO_ADMINISTRADOR` |
| Usuario inexistente | 404 | `NO_ENCONTRADO` |

Un rol inexistente en el cuerpo de la petición cuenta como `DATOS_INVALIDOS`.

### Autenticación y autorización

- El frontend obtiene un token de Entra ID con MSAL y lo envía en
  `Authorization: Bearer`.
- `autenticar` verifica firma, emisor y audiencia contra las llaves públicas del
  tenant, y busca al usuario por `entra_oid` o, en su primer acceso, por correo
  (guardando entonces el `entra_oid`).
- Los permisos no viajan en el token ni se guardan en caché: se leen de la base en
  cada petición. Así el cambio de rol surte efecto en la siguiente petición del
  usuario afectado.
- `AUTH_MODE=dev` sustituye la verificación de Entra por un encabezado
  `X-Dev-Usuario` con el correo del usuario. El servidor se niega a arrancar con
  `AUTH_MODE=dev` cuando `NODE_ENV=production`.

### Dominio corporativo

Variable `DOMINIOS_PERMITIDOS` (lista separada por comas). La comparación es exacta
sobre la parte posterior a la `@`, sin distinguir mayúsculas; un subdominio no
cuenta como dominio autorizado.

### Variables de entorno (`backend/.env.example`)

`PORT`, `AUTH_MODE`, `DATA_MODE` (`sql` / `memoria`), `DOMINIOS_PERMITIDOS`,
`ENTRA_TENANT_ID`, `ENTRA_CLIENT_ID`, `SQL_SERVER`, `SQL_DATABASE`, `SQL_USER`,
`SQL_PASSWORD`, `CORS_ORIGIN`.

## Frontend

```
src/app/api/cliente.ts               fetch con token y manejo de errores
src/app/api/usuarios.ts              llamadas a los endpoints
src/app/auth/SesionContext.tsx       usuario en sesión, rol y permisos
src/app/auth/PuertaSesion.tsx        pantallas de inicio de sesión y acceso denegado
src/app/auth/proveedores.ts          identidad con MSAL (Entra ID) o modo de desarrollo
src/app/components/UsuariosRolesView.tsx   vista (sale de App.tsx)
```

- Tabla con nombre completo, correo, rol y estado.
- Cambio de rol: el selector llama al `PATCH`; si falla, vuelve al valor anterior y
  muestra el error.
- Formulario de alta (nombre, correo, rol). El dominio se valida en el servidor; el
  mensaje de `DOMINIO_NO_AUTORIZADO` se muestra junto al campo de correo.
- Matriz de permisos por rol en solo lectura.
- Si el usuario en sesión no es Administrador, el botón "Usuarios" no aparece en la
  barra lateral y la vista muestra un aviso de acceso restringido.
- La sesión vuelve a leer rol y permisos del servidor cuando el usuario regresa a la
  pestaña y cuando el servidor responde que su rol ya no tiene acceso.
- Variables `VITE_API_URL`, `VITE_AUTH_MODE`, `VITE_ENTRA_TENANT_ID`,
  `VITE_ENTRA_CLIENT_ID`, `VITE_ENTRA_API_SCOPE`. En modo `dev` se entra escribiendo
  el correo de un usuario de prueba.

## Pruebas

- Backend: Vitest + Supertest sobre la app con el repositorio en memoria.
- Frontend: Vitest + Testing Library con la API simulada.
- Documento `docs/pruebas/usuarios-roles.md`: casos de prueba por criterio de
  aceptación, resultado obtenido y bitácora de defectos.

## Fuera de alcance

- Creación de los recursos en Azure y ejecución de los scripts contra la base real.
- Bitácora inmutable (SF-15 / SF-18): solo se deja el punto de registro.
- Baja o desactivación de usuarios y edición de permisos por rol.

## Pendiente (TBD)

- Dominio corporativo real. En desarrollo se usa `expedite.com`.
