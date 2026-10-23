# Base de datos — modelo, conexión y migraciones

Una sola base de **PostgreSQL en Supabase** para todo el equipo. El esquema vive en
`backend/sql/` como scripts numerados y se aplica con `pnpm db:migrar`.

De Supabase solo se usa la base: el backend se conecta directo a PostgreSQL con `pg`.
No se usan su API, su cliente (`supabase-js`) ni su autenticación.

## Conectarse a la base compartida

En `backend/.env` (hay una plantilla en `backend/.env.example`):

```
DATA_MODE=sql
DB_SERVER=aws-0-<región>.pooler.supabase.com
DB_NAME=postgres
DB_USER=postgres.<referencia-del-proyecto>
DB_PASSWORD=<contraseña>
DB_CA_CERT=certs/supabase-ca.crt
```

- Los valores salen del botón **Connect** del proyecto en Supabase, opción **Session
  pooler** (*View parameters*). La conexión directa (`db.<referencia>.supabase.co`) solo
  funciona con IPv6, así que no sirve en la mayoría de las redes.
- `DB_PORT` es `5432` por omisión, el del Session pooler.
- La conexión siempre va cifrada. El certificado del servidor lo firma la autoridad de
  Supabase, que Node no conoce: `DB_CA_CERT` apunta al archivo que se descarga en
  **Database → Settings → SSL Configuration → Download certificate**, guardado como
  `backend/certs/supabase-ca.crt`. Es un certificado público y puede ir en git.
- `DB_TRUST_CERT=true` cifra sin validar el certificado. Es para un PostgreSQL local con
  certificado autofirmado y no arranca en producción.
- El backend arma la conexión con esas variables en `RepositorioSql.conectar`
  (`backend/src/repos/sql.ts`) y todas las rutas comparten ese mismo pool.
- La contraseña se comparte por un canal privado. Los `.env` no se suben a git.
- En el plan gratuito, Supabase pausa el proyecto tras una semana sin actividad; se
  reactiva desde su panel.
- En el `.env` de la raíz, `VITE_USE_REAL_BACKEND=true` para que la vista de hallazgos
  use la base en lugar de sus datos de prueba.

Para trabajar sin la base compartida sigue sirviendo `DATA_MODE=memoria`.

## Migraciones

```bash
cd backend
corepack pnpm db:migrar                  # aplica los scripts que falten
corepack pnpm db:migrar --datos-prueba   # además, hallazgos y controles de prueba
corepack pnpm db:migrar --admin-nombre "Nombre Apellido" --admin-correo correo@dominio.com
```

El comando usa las variables `DB_*` del `.env`, así que corre contra la base a la que
apunta el backend. Anota cada script aplicado en la tabla `schema_migrations` (nombre,
huella del contenido y fecha) y la siguiente vez solo corre los que faltan.

| Script | Contenido |
|---|---|
| `001_schema.sql` | `roles`, `permissions`, `role_permissions`, `users`, `audit_plans`, `evidence` |
| `002_seed.sql` | Roles y permisos iniciales; dos evidencias de prueba |
| `003_primer_administrador.sql` | Primer Administrador. Lo sustituye `--admin-nombre` y `--admin-correo` |
| `004_findings.sql` | `findings` |
| `005_seed_findings.sql` | Hallazgos de prueba. Solo con `--datos-prueba` |
| `006_auditorias.sql` | `audits` y cuatro auditorías de prueba |
| `007_action_plans.sql` | `action_plans` |
| `008_estructura_y_controles.sql` | `fiscal_periods`, `business_units`, `processes`, `controls`, `audit_controls`, `conflict_declarations` |
| `009_seed_controles.sql` | Controles de prueba. Solo con `--datos-prueba` |
| `010_catalogos_riesgos_y_ejecucion.sql` | Catálogos (`catalogs`, `catalog_department`, `catalog_domain`, `audit_status`, `audit_procedure_type`), estructura (`division`, `business`, `area`, `audit_entity`), riesgos (`risk_library`, `control_procedure`, `risk_register`) y ejecución (`audit_engagement`, `audit_engagement_team`, `audit_procedures`); agrega `business_units.catalog_id` |
| `011_audit_controls_plan.sql` | `audit_controls.audit_id` apunta a `audit_plans` (asignación de controles por plan) |
| `012_seguimiento_controles.sql` | Estado, horas y retroalimentación de controles; tabla `control_horas` |
| `013_seguimiento_asignaciones_control.sql` | Estado, horas y retroalimentación por asignación (`audit_controls`) |
| `014_quitar_seguimiento_controles_catalogo.sql` | Quita el seguimiento del catálogo `controls` (queda en cada asignación) |
| `015_seed_estructura.sql` | Año fiscal 2026 (inactivo) como periodo inicial de la estructura organizacional |
| `016_mantener_controles_al_eliminar_proceso.sql` | Al borrar un proceso, sus controles se conservan sin proceso |
| `017_jerarquia_organizacional.sql` | Jerarquía organizacional (SF-03): `division.business_unit_id`, `business.division_id` y `business.country` (`business` = subdivisión), `area.business_id`, `business_units.audit_department_id`, `audit_entity.business_id`; departamentos `Retail & Spin` y `Beverage`; periodos trimestrales `2026Q1…Q4` con `2026Q4` activo |
| `018_seed_jerarquia.sql` | Jerarquía del Consolidado (hoja Catalogs, nombres anonimizados): 6 unidades, 12 divisiones, 39 subdivisiones y 338 áreas (sin la subdivisión B-923765, que no tiene código). Solo con `--datos-prueba`; requiere un Jefe de Auditoría activo. Generado, no editar a mano |
| `019_riesgos_jerarquia.sql` | Riesgos en la jerarquía: `risk_register.business_id` (el riesgo cuelga de la subdivisión) y `risk_library.level` (Crítico, Alto, Medio o Bajo; opcional) |
| `020_seed_riesgos.sql` | Biblioteca (69 riesgos) y registro (249) del Consolidado sobre las subdivisiones de 018; el procedimiento de control es el id `CP-…`. **Niveles ficticios** (el archivo no los trae). Solo con `--datos-prueba`. Generado, no editar a mano |
| `021_nombres_reales.sql` | `display_name` opcional en `business_units`, `division` y `business`: el nombre real (KOF, Brasil…) que se muestra junto al código; `name` sigue siendo el código único |
| `022_seed_nombres_reales.sql` | Nombres **inferidos** de `02_Estructura.pptx` para las 6 unidades y 11 de las 12 divisiones (confianza anotada en el script; Spin y FEMSA Servicios sin confirmar). Solo con `--datos-prueba` |
| `023_codigo_y_nombre.sql` | Fija el significado: `name`/`business_name` = **código** (identificador que asigna el backend, fijo) y `display_name` = **nombre** opcional y editable. Crea `structure_code_counters` (último número asignado por nivel; su fila se bloquea en el alta y no baja al borrar) y, como respaldo, el índice `uq_division_unit_code` |
| `024_seed_quitar_sin_codigo.sql` | Limpia bases que ya cargaron los datos de prueba anteriores: quita la subdivisión "SIN NOMBRE (B-923765)", que no sigue el formato de código, con sus áreas y riesgos. Solo con `--datos-prueba`; en una base nueva no hace nada |
| `025_nombres_unicos.sql` | AC2 de la parametrización: `uq_business_units_display_name` (el nombre de la unidad, si lo tiene, no se repite) y `uq_area_business_name` (el nombre del área no se repite dentro de su subdivisión), ambos con la intercalación `sin_mayusculas`. El backend traduce su violación a `409 NOMBRE_DUPLICADO` |
| `026_nombres_periodos.sql` | Formato de los periodos: "2026 Q1"…"2026 Q4" y "2026 Fiscal" (año completo). Renombra los de formato anterior ("2026Q1" de 017, "Fiscal 2026" de 015) si el nombre nuevo no existe. 015 y 017 ahora insertan por fechas, no por nombre |
| `027_formatos_evidencia.sql` | Formatos de evidencia (SF-08): además de PDF y XLSX, correos (`eml`, `msg`) y comprimidos (`zip`, `7z`) |
| `028_estado_inicial_controles_progreso.sql` | Las asignaciones nuevas empiezan `En Progreso` |
| `029_conflictos_por_plan.sql` | `conflict_declarations.audit_id` apunta a `audit_plans` (historia #96) |
| `030_seed_demo.sql` | Usuarios de "Usar un rol de prueba", planes de auditoría, hallazgos y plan de acción del modo en memoria. Solo con `--datos-prueba` |
| `031_rls_control_horas.sql` | Activa la seguridad por filas en `control_horas` (012 la creó sin ella y quedaba expuesta en la API de Supabase) |
| `034_asistente_conversaciones.sql` | Memoria del asistente de IA (SF-19, UF-16): `ai_conversations` (una por usuario y hallazgo) y `ai_messages` (preguntas y respuestas; se borran en cascada con la conversación) |
| `035_asistente_evidencias_controles.sql` | `ai_conversations.entity_type` admite `evidencia` (una conversación por usuario y archivo) y `control` (`entity_id = "<planId>:<controlId>"`) |

### Cómo agregar un cambio al esquema

1. Crear un script nuevo con el siguiente número (`010_...sql`). **No editar uno que ya
   se aplicó a la base compartida**: quien ya lo corrió no recibiría el cambio.
2. Escribirlo de modo que se pueda repetir (`CREATE TABLE IF NOT EXISTS`,
   `ON CONFLICT DO NOTHING`) y activar la seguridad por filas en cada tabla nueva
   (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`).
3. Agregarlo a la lista `SCRIPTS` de `backend/src/migrar.ts` (o a `SCRIPTS_DATOS_PRUEBA`
   si son datos de prueba).
4. Probarlo en una base local y luego correr `pnpm db:migrar` contra la compartida.
5. Actualizar el diagrama de abajo y el de Miro.

Cada script corre dentro de una transacción: si falla, no se aplica nada de él.

### Particularidades de PostgreSQL

- **Seguridad por filas.** Supabase publica por su API las tablas del esquema `public`.
  Todas llevan la seguridad por filas activada y ninguna política, así que por esa API
  no se lee ni se escribe nada; el backend entra con el usuario dueño de las tablas.
- **Mayúsculas.** PostgreSQL distingue mayúsculas al comparar texto. Las columnas que
  deben ser únicas sin distinguirlas (`users.email`, `roles.name`, `permissions.name`,
  `audit_plans.code`, `findings.folio`, `fiscal_periods.name`, `business_units.name`,
  `processes.name`, `controls.code`) usan la intercalación `sin_mayusculas`, definida en
  `001_schema.sql`. Esas columnas no admiten `LIKE`.
- **Columnas en camelCase.** `findings` conserva `auditId`, `controlId`, `failedControl`,
  `residualRisk` y `ownerId`; en cada consulta van entre comillas dobles (`f."auditId"`).
- **Fechas.** Las columnas `DATE` se piden como texto (`p.start_date::text`) para que
  lleguen como `AAAA-MM-DD`; los `TIMESTAMPTZ` llegan como `Date`.
- **Parámetros.** Las consultas usan `$1`, `$2`… y `RETURNING` para devolver la fila
  insertada o modificada.

### Probar contra un PostgreSQL local

Las pruebas de `test/sql.integracion.test.ts` (repositorios) y de
`test/esquema.integracion.test.ts` (los scripts completos: las 30 tablas existen, tienen
la seguridad por filas activada, se pueden consultar y hacen cumplir sus llaves) se
omiten si no hay conexión. Para
correrlas hace falta un PostgreSQL con TLS y una base exclusiva de pruebas:

```bash
docker run -d --name expedite-pg -e POSTGRES_PASSWORD=<contraseña> -e POSTGRES_DB=expedite_test \
  -p 5432:5432 postgres:17 -c ssl=on \
  -c ssl_cert_file=/etc/ssl/certs/ssl-cert-snakeoil.pem -c ssl_key_file=/etc/ssl/private/ssl-cert-snakeoil.key

SQL_TEST_SERVER=localhost SQL_TEST_DATABASE=expedite_test SQL_TEST_USER=postgres \
  SQL_TEST_PASSWORD=<contraseña> SQL_TEST_TRUST_CERT=true corepack pnpm test
```

## Modelo entidad-relación

Las líneas punteadas son referencias que la base todavía no valida con llave foránea.

```mermaid
erDiagram
    roles ||--o{ users : "role_id"
    roles ||--o{ role_permissions : "role_id"
    permissions ||--o{ role_permissions : "permission_id"
    users ||--o{ audit_plans : "responsible_id, created_by"
    fiscal_periods ||--o{ business_units : "fiscal_period_id"
    users ||--o{ business_units : "manager_id, created_by"
    business_units ||--o{ processes : "business_unit_id"
    processes ||--o{ controls : "process_id"
    users ||--o{ controls : "owner_id"
    audits ||--o{ audit_controls : "audit_id"
    controls ||--o{ audit_controls : "control_id"
    users ||--o{ audit_controls : "auditor_id, assigned_by"
    audits ||--o{ conflict_declarations : "audit_id"
    users ||--o{ conflict_declarations : "auditor_id"
    findings ||--o| action_plans : "finding_id"
    users ||--o{ action_plans : "responsible_id, created_by"
    audits ||..o{ findings : "auditId"
    controls ||..o{ findings : "controlId"
    users ||..o{ findings : "ownerId"
    audits ||..o{ evidence : "audit_id"
    controls ||..o{ evidence : "control_id"
    findings ||..o{ evidence : "finding_id"
    business_units ||--o{ division : "business_unit_id"
    division ||--o{ business : "division_id"
    business ||--o{ area : "business_id"
    business ||--o{ audit_entity : "business_id"
    catalog_department ||--o{ business_units : "audit_department_id"
    catalogs ||--o{ division : "catalog_id"
    catalogs ||--o{ business : "catalog_id"
    catalogs ||--o{ area : "catalog_id"
    catalogs ||--o{ business_units : "catalog_id"
    catalogs ||--o{ control_procedure : "catalog_id"
    catalogs ||--o{ risk_register : "catalog_id"
    risk_library ||--o{ risk_register : "risk_library_id"
    business ||--o{ risk_register : "business_id"
    control_procedure ||--o{ risk_register : "control_procedure_id"
    catalog_department ||--o{ audit_entity : "department_id"
    catalog_domain ||--o{ audit_entity : "domain_id"
    audit_plans ||--o{ audit_engagement : "audit_plan_id"
    audit_entity ||--o{ audit_engagement : "audit_entity_id"
    catalog_department ||--o{ audit_engagement : "department_id"
    catalog_domain ||--o{ audit_engagement : "domain_id"
    users ||--o{ audit_engagement : "lead_auditor_id"
    audit_status ||--o{ audit_engagement : "status_id"
    audit_engagement ||--o{ audit_engagement_team : "audit_engagement_id"
    users ||--o{ audit_engagement_team : "auditor_id"
    audit_engagement ||--o{ audit_procedures : "audit_engagement_id"
    audit_procedure_type ||--o{ audit_procedures : "procedure_type_id"
    catalog_department ||--o{ audit_procedures : "department_id"
    catalog_domain ||--o{ audit_procedures : "domain_id"
    users ||--o{ audit_procedures : "assigned_to"
    audit_status ||--o{ audit_procedures : "status_id"

    roles {
        int id PK
        string name UK
    }
    permissions {
        int id PK
        string name UK
    }
    role_permissions {
        int role_id PK, FK
        int permission_id PK, FK
    }
    users {
        int id PK
        string name
        string email UK
        int role_id FK
        string status
        string entra_oid UK
        datetime last_login
        datetime created_at
    }
    audit_plans {
        int id PK
        string code UK
        string name
        string type
        string period
        date start_date
        date end_date
        string status
        int estimated_hours
        int responsible_id FK
        string scope
        int created_by FK
        datetime created_at
    }
    fiscal_periods {
        int id PK
        string name UK
        date start_date
        date end_date
        boolean is_active
        datetime created_at
    }
    business_units {
        int id PK
        string name UK
        int manager_id FK
        int fiscal_period_id FK
        int created_by FK
        datetime created_at
        int catalog_id FK
        int audit_department_id FK
    }
    processes {
        int id PK
        int business_unit_id FK
        string name
        datetime created_at
    }
    controls {
        string id PK
        string code UK
        string name
        string description
        string type
        string frequency
        int process_id FK
        int owner_id FK
        datetime created_at
    }
    audits {
        string id PK
        string name
        date end_date
        datetime created_at
    }
    audit_controls {
        int id PK
        string audit_id FK
        string control_id FK
        int auditor_id FK
        boolean is_lead
        int assigned_by FK
        datetime created_at
    }
    conflict_declarations {
        int id PK
        string audit_id FK
        int auditor_id FK
        boolean has_conflict
        string justification
        datetime declared_at
    }
    findings {
        string id PK
        string folio UK
        string title
        string description
        string type
        string severity
        string status
        string auditId
        string controlId
        string failedControl
        string residualRisk
        string ownerId
        datetime created_at
    }
    action_plans {
        int id PK
        string finding_id FK, UK
        string description
        int responsible_id FK
        date due_date
        string status
        int created_by FK
        datetime created_at
    }
    evidence {
        string id PK
        string entity_id
        string entity_type
        string file_name
        string mime_type
        bigint file_size
        string file_hash
        string storage_path
        string uploaded_by
        datetime created_at
        string control_id
        string finding_id
        string audit_id
    }
    catalogs {
        int catalog_id PK
        string business
        string country
    }
    catalog_department {
        int id PK
        string name
    }
    catalog_domain {
        int id PK
        string name
    }
    division {
        int division_id PK
        string name
        int catalog_id FK
        int business_unit_id FK
    }
    business {
        int business_id PK
        string business_name
        int catalog_id FK
        int division_id FK
        string country
    }
    area {
        int area_id PK
        string area_name
        int catalog_id FK
        int business_id FK
    }
    audit_entity {
        int id PK
        string name
        int department_id FK
        int domain_id FK
        int business_id FK
    }
    risk_library {
        int risk_library_id PK
        string name
        string level
    }
    control_procedure {
        int control_procedure_id PK
        string description
        int catalog_id FK
    }
    risk_register {
        int risk_register_id PK
        int catalog_id FK
        int risk_library_id FK
        int control_procedure_id FK
        int business_id FK
    }
    audit_status {
        int id PK
        string name
    }
    audit_procedure_type {
        int id PK
        string name
    }
    audit_engagement {
        int id PK
        string code
        int audit_plan_id FK
        int audit_entity_id FK
        int department_id FK
        int domain_id FK
        int lead_auditor_id FK
        int status_id FK
    }
    audit_engagement_team {
        int id PK
        int audit_engagement_id FK
        int auditor_id FK
        string role_in_engagement
    }
    audit_procedures {
        int id PK
        string code
        int audit_engagement_id FK
        int procedure_type_id FK
        int department_id FK
        int domain_id FK
        int assigned_to FK
        int status_id FK
    }
```

## Reglas que hace cumplir la base

| Tabla | Regla |
|---|---|
| `fiscal_periods` | Nombre único; la fecha de fin es posterior a la de inicio; un solo periodo activo a la vez |
| `business_units` | Nombre único (sin distinguir mayúsculas; sí acentos, por `sin_mayusculas`); gerente responsable y periodo fiscal obligatorios |
| `division`, `business`, `area` | Jerarquía unidad → división → subdivisión (`business`) → área; cada nivel exige su padre. Los nombres se repiten entre ramas: no son únicos |
| `risk_library` | `level` es nulo o uno de Crítico, Alto, Medio, Bajo (escala por confirmar con FEMSA) |
| `risk_register` | Cuelga de la subdivisión (`business_id`, nulo si el dato no viene en el Consolidado). El backend no deja eliminar una subdivisión con riesgos registrados |
| `audit_entity` | Cuelga de la subdivisión (`business_id`); si la subdivisión se elimina, la entidad se conserva sin vínculo |
| `processes` | El nombre no se repite dentro de la misma unidad de negocio |
| `controls` | Código único. El `id` es texto (`CTR-001`), igual que en `findings.controlId` y `evidence.control_id` |
| `audit_controls` | Un auditor se asigna una sola vez al mismo control en una auditoría; un control tiene a lo más un auditor líder por auditoría |
| `conflict_declarations` | Una declaración por auditor y auditoría; si hay conflicto, la justificación es obligatoria |
| `action_plans` | Un plan por hallazgo |
| `ai_conversations` | Una conversación por usuario y entidad (`entity_type`: `hallazgo`, `evidencia` o `control`); es privada de su usuario |
| `ai_messages` | `role` es `usuario` o `asistente`; `estado` solo en respuestas (`respondida`, `fuera_de_tema`, `sin_informacion`) |

## Pendiente

- `findings` y `evidence` guardan sus referencias (`auditId`, `controlId`, `ownerId`,
  `control_id`, `finding_id`, `audit_id`) como texto sin llave foránea.
- `audits` solo tiene `id`, `name` y `end_date`; falta ligarla a `audit_plans` y a la
  unidad de negocio (SF-05).
- Las horas invertidas por control (historia de asignación de controles) no tienen tabla.
- De las tablas de `010_catalogos_riesgos_y_ejecucion.sql`, la estructura (`division`,
  `business`, `area`), `catalog_department`, `risk_library`, `risk_register` y
  `control_procedure` ya las usa el Catálogo (017, 019 y 021; ver
  [`estructura-organizacional.md`](estructura-organizacional.md)); `audit_entity`,
  `audit_engagement` y `audit_plans` solo se leen para la regla de auditoría activa. Las
  demás no tienen rutas todavía. Falta definir cómo conviven `audits` con
  `audit_engagement`, y `catalogs` queda en desuso.
- Regla de borrado de la estructura (en el backend, no en la base): no se elimina una
  unidad, división, subdivisión o área si un `audit_engagement` de un plan `Aprobado` o
  `En Ejecución` apunta a una entidad auditable de su rama (para un área, la de su
  subdivisión), ni si tiene hijos; no se borra en cascada.
- `processes` y `controls.process_id` ya no los usa la parametrización (el "proceso" de
  la historia es el área). Falta decidir si se retiran (TBD). Al eliminar una unidad de
  la primera versión se borran sus procesos y los controles quedan sin proceso (016).
- El comentario de `015_seed_estructura.sql` dice "solo con --datos-prueba", pero el
  script se aplica siempre; no se corrige para no cambiar un script ya aplicado.
- Mapeo de `UDN-0001…0006` a nombres: **inferido** en 022 (datos de prueba); falta que FEMSA lo confirme, sobre todo Spin / FEMSA Servicios (UDN-0002 / UDN-0005) y DIVISION-0011. Las subdivisiones no tienen nombre en ningún archivo.
- Riesgos: el catálogo solo los muestra (sin alta ni edición); falta el CRUD del catálogo
  de riesgos de la historia original, confirmar la escala de `level` y definir si un
  riesgo tiene estado (el explorador de prueba anterior lo tenía; el modelo no). TBD.
