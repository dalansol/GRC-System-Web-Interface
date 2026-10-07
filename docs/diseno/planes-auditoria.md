# Planes de auditoría — backend (#117)

Historia #94 "Definición de planes de auditoría":

> Como jefatura de auditoría, quiero definir planes de auditoría anuales y trimestrales, para
> formalizar el calendario operativo y el alcance de las evaluaciones antes de asignar el trabajo
> a los auditores.

Módulo de **Planeación** (SF-01, SF-02). Esta tarea da persistencia a la vista que se hizo en la #118.

## Modelo de datos

Tabla `audit_plans` en `backend/sql/001_schema.sql`:

| Columna | Tipo | Regla |
|---|---|---|
| `id` | INT identity | PK |
| `code` | NVARCHAR(30) | único; se guarda en mayúsculas |
| `name` | NVARCHAR(200) | obligatorio |
| `period` | NVARCHAR(50) | opcional (p. ej. "Anual 2026", "Q1 2026") |
| `start_date`, `end_date` | DATE | la fecha de fin debe ser posterior a la de inicio |
| `status` | NVARCHAR(20) | `Borrador` (por omisión), `Aprobado`, `En Ejecución`, `Cerrado` |
| `estimated_hours` | INT | mayor a 0 |
| `responsible_id` | INT | FK a `users`; debe estar activo |
| `scope` | NVARCHAR(2000) | opcional |
| `created_by`, `created_at` | INT, DATETIME2 | quién y cuándo lo creó |

## Endpoints

| Método y ruta | Acceso | Respuesta |
|---|---|---|
| `GET /api/planes` | cualquier usuario con sesión | lista de planes |
| `GET /api/planes/:id` | cualquier usuario con sesión | plan |
| `POST /api/planes` | Administrador, Jefe de Auditoría | 201 con el plan creado |
| `PATCH /api/planes/:id` | Administrador, Jefe de Auditoría | plan actualizado (solo los campos enviados) |

Cuerpo: `codigo`, `nombre`, `periodo`, `fechaInicio` y `fechaFin` (AAAA-MM-DD), `estado`,
`horasEstimadas`, `responsableId`, `alcance`.

Errores con la forma de siempre, `{ "error": { "codigo", "mensaje" } }`:
`DATOS_INVALIDOS` (400), `ROL_NO_AUTORIZADO` (403), `NO_ENCONTRADO` (404) y `CODIGO_DUPLICADO` (409).

La bitácora registra `plan.alta` y `plan.edicion`.

## Fuera del alcance de esta tarea

Quedan como ideas para historias futuras, no para la #94:

- Flujo de aprobación con estados que solo avanzan y rechazo (SF-12).
- Asignación de auditores a un plan.
- Distinguir planes anuales y trimestrales con un campo propio en lugar del texto de `periodo`.
