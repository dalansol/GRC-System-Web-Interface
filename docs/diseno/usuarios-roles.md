# Diseño: gestión de usuarios y roles

Fecha: 2026-10-01
Requisitos: SF-16, SF-17, SNF-05
Módulo: Usuarios y accesos

## Objetivo

Que un Administrador pueda ver a todos los usuarios, cambiarles el rol y dar de alta
usuarios nuevos del dominio corporativo, con la sesión iniciada mediante Microsoft
Entra ID y los datos guardados en PostgreSQL (Supabase).

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
| `users` | `id` PK, `name`, `email` único, `role_id` FK, `status` (`active` / `inactive`), `entra_oid` único nulo, `last_login` nulo, `created_at`, `business_unit_id` FK nulo (034) |

Cambio respecto al modelo en Miro: `users.role` (texto) se sustituye por
`users.role_id` (llave foránea a `roles`). La relación rol–permiso es de muchos a
muchos, por eso existe `role_permissions`.

Datos iniciales: 8 roles y 10 permisos, en `backend/sql/002_seed.sql` y `backend/src/repos/semilla.ts`, que deben coincidir.

Scripts en `backend/sql/`: `001_schema.sql`, `002_seed.sql` y
`003_primer_administrador.sql` (crea al primer Administrador; hay que editar su nombre
y correo antes de ejecutarlo).

## Roles y acceso actual

Actualizado el 2026-11-04. Las rutas se protegen por el nombre del rol (`autorizar`), no por los
permisos de la tabla, que hoy solo se muestran y se devuelven en `/api/me`.

| Rol | Permisos |
|---|---|
| Administrador | Todos |
| Jefe de Auditoría | Ver Dashboard, Editar Registros, Aprobar Riesgos, Exportar Datos, Ver Auditorías, Crear Auditorías |
| Auditor Senior | Ver Dashboard, Editar Registros, Exportar Datos, Ver Auditorías |
| Auditor, Consultor, Solo Lectura | Ver Dashboard, Ver Auditorías |
| Jefe Auditado, Empleado Auditado | Ver Hallazgos, Ver Plan de Accion |

Los auditados solo ven Dashboard, Hallazgos, Planes de Acción y Ajustes en el menú. En Planes de Acción solo ven lo que tienen asignado, en una vista reducida, y solo cuando el plan ya se validó.

| Recurso | Quién puede |
|---|---|
| Ver hallazgos | Equipo de auditoría (Administrador, Jefe de Auditoría, Auditor Senior, Auditor): todos. Los demás roles: los propios y los de su unidad |
| Editar o eliminar hallazgos | Administrador y Jefe de Auditoría: todos. Auditor Senior y Auditor: los que registraron. Los demás roles: los propios y los de su unidad |
| Ver evidencia de un control | El Auditor que la subió; el Auditor Senior que asignó el control; el Jefe de Auditoría que creó el plan |
| Ver evidencia de un paso de plan de acción | Responsable del plan, asignado al paso y equipo de auditoría |
| Ver evidencia de un hallazgo | Quien la subió y equipo de auditoría (en pantalla, solo lectura para el equipo de auditoría) |
| Subir evidencia | Control: el Auditor asignado. Paso: el asignado, si el plan ya se validó y no está en `Pendiente`, `En Revisión` o `Aprobado`. Hallazgo: cualquier usuario en sesión por la API, sin opción en pantalla (TBD) |
| Eliminar evidencia | Control: el auditor asignado. Paso: quien la subió, si el plan ya se validó y no está en `Pendiente`, `En Revisión` o `Aprobado`. Hallazgo: quien la subió |
| Consultar la lista completa de planes de acción | Todos, salvo los auditados |
| Consultar sus planes de acción | Un auditado: plan validado, en vista reducida. El responsable ve todos los pasos; un asignado, solo los suyos |
| Crear plan de acción | Auditor y Auditor Senior. El responsable y los asignados deben ser auditados |
| Editar plan de acción | Auditor y Auditor Senior, salvo su responsable. En definición, todo; ya validado, solo el responsable y el estado manual |
| Enviar plan de acción a revisión | Auditor y Auditor Senior que no participen en el plan |
| Completar un paso de plan de acción | Su asignado, si el plan ya se validó y no está en revisión ni aprobado |
| Revisar, aprobar o rechazar plan de acción | Jefe de Auditoría, salvo que sea su responsable, lo haya creado o tenga un paso asignado |
| Solicitar prórroga de un plan de acción | Su responsable |
| Decidir una prórroga | Jefe de Auditoría, con los mismos impedimentos de la revisión |
| Consultar el historial del flujo de un plan | Equipo de auditoría |
| Consultar notificaciones | Cada usuario, solo las suyas |

La unidad del usuario sale de `users.business_unit_id`. Si está vacía se trata como unidad 10
(`repos/sql.ts`), y la aplicación todavía no permite asignarla. `GET /api/usuarios` y `/api/me`
devuelven `business_unit_id`.

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
repos/sql.ts               implementación sobre PostgreSQL (pg)
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

### Variables de entorno (`backend/.env`)

`PORT`, `AUTH_MODE`, `DATA_MODE` (`sql` / `memoria`), `DOMINIOS_PERMITIDOS`,
`ENTRA_TENANT_ID`, `ENTRA_CLIENT_ID`, `DB_SERVER`, `DB_NAME`, `DB_USER`,
`DB_PASSWORD`, `DB_PORT`, `DB_CA_CERT`, `DB_TRUST_CERT`, `CORS_ORIGIN`.

## Frontend

```
src/app/api/cliente.ts               fetch con token y manejo de errores
src/app/api/usuarios.ts              llamadas a los endpoints
src/app/auth/SesionContext.tsx       usuario en sesión, rol y permisos
src/app/auth/PuertaSesion.tsx        pantallas de inicio de sesión y acceso denegado
src/app/auth/proveedores.ts          identidad con MSAL (Entra ID) o modo de desarrollo
src/app/components/VistaUsuariosRoles.tsx  vista (sale de App.tsx)
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
- Que FEMSA confirme los roles de auditado y las reglas de la tabla de acceso.
- Asignar la unidad de negocio desde la aplicación y quitar el valor fijo de la unidad 10.
- Que FEMSA confirme las reglas de los planes de acción, tomadas del SRS (detalle en `aprobacion-planes-accion.md`).
- Rol definitivo para subir evidencia a un hallazgo.
