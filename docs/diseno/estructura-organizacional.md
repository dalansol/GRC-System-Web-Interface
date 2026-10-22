# Diseño: parametrización de la estructura organizacional

Historia "Parametrización de la estructura organizacional" (`ParametrizacionHU.md`):

> Como gerente de auditoría, quiero parametrizar y mantener la estructura organizacional, los
> periodos de auditoría y el catálogo de riesgos, para establecer el marco de referencia
> operativo necesario antes de planificar las auditorías.

Módulo de **Planeación** (SF-03, SF-05 parcial). Pruebas en
[`docs/pruebas/estructura-organizacional.md`](../pruebas/estructura-organizacional.md).
Fuentes de FEMSA: `00_Consolidado_2026Q1.xlsx` (hojas Catalogs, Risk Library, Risk Register) y
`02_Estructura.pptx`. El borrador original está en `estructura-organizacional.md` (raíz); este
documento describe lo que quedó implementado.

## Decisiones

| # | Decisión |
|---|---|
| 1 | **No existe "proceso" como entidad.** El "proceso" de la historia es el **área**; la UI la muestra como "Área (proceso)". La tabla `processes` queda en desuso (no se borra). |
| 2 | Jerarquía completa: **unidad de negocio → división → subdivisión → área**. En la base, la subdivisión es la tabla `business`. |
| 3 | **Solo el nombre de la unidad es único** (sin distinguir mayúsculas; sí acentos, por la intercalación `sin_mayusculas`). División, subdivisión y área repiten nombres legítimamente. |
| 4 | Unidad, división y subdivisión tienen **código** (el del Consolidado: UDN-0003, DIVISION-0002…) y **nombre** (KOF, Brasil…). El código es el identificador y **lo asigna el sistema** al dar de alta: el siguiente número del nivel en todo el catálogo (UDN-0007, DIVISION-0013…), **sin reutilizar** los de elementos borrados (contador `structure_code_counters` con bloqueo de fila, comparado con el mayor código existente para respetar los datos importados). El usuario no lo escribe ni lo edita (400 si lo envía); el formulario muestra el próximo como vista previa. Los datos del Consolidado conservan su código, aunque repite SUBDIVISION-0002 en KOF y Tragetta. El nombre es opcional, editable y no es único; sin él se muestra el código. El área no tiene código: solo su nombre, obligatorio. En la base, `name`/`business_name` guardan el código y `display_name` el nombre (023; no se renombraron columnas para no romper las semillas 018/022). Decidido el 2026-10-21 (código asignado por el sistema, a petición del equipo). |
| 5 | **Gerente responsable** = usuario activo con rol **Jefe de Auditoría** (no se crea un rol "Gerente"). |
| 6 | **Escriben** Administrador y Jefe de Auditoría; **consulta** cualquier usuario con sesión. |
| 7 | **Periodo de auditoría = trimestre** (2026Q1…Q4), uno activo a la vez; la unidad nueva toma el activo. |
| 8 | **Departamento de auditoría** (Retail & Spin / Beverage) es un atributo de la unidad, no un nivel. |
| 9 | **Auditoría activa** (bloquea el borrado): un `audit_engagement` de un plan `Aprobado` o `En Ejecución` cuya entidad auditable cuelga de la rama. Las entidades auditables cuelgan de la subdivisión; para un área se revisa su subdivisión. |
| 10 | **No se borra en cascada**: un nodo con hijos (o una subdivisión con riesgos registrados) responde `HIJOS_EXISTENTES`. Al borrar una subdivisión, sus entidades auditables se conservan sin vínculo. |
| 11 | **Riesgos**: cuelgan de la subdivisión (`risk_register.business_id`), con nivel opcional Crítico / Alto / Medio / Bajo en la biblioteca. En esta historia son de **solo lectura**. |

## Modelo de datos

Scripts (detalle y diagrama en [`base-de-datos.md`](base-de-datos.md)):

| Script | Qué hace |
|---|---|
| `008` | `fiscal_periods`, `business_units` (nombre único, gerente, periodo), `processes` (en desuso) |
| `010` | `division`, `business`, `area`, `audit_entity`, `catalog_department`, riesgos y ejecución, aún sin ligar |
| `017_jerarquia_organizacional.sql` | Liga los niveles (`division.business_unit_id`, `business.division_id`, `area.business_id`), `business.country`, `business_units.audit_department_id`, `audit_entity.business_id`; departamentos; periodos trimestrales con 2026Q4 activo |
| `019_riesgos_jerarquia.sql` | `risk_register.business_id`, `risk_library.level` |
| `021_nombres_reales.sql` | `display_name` en `business_units`, `division` y `business` |
| `018`, `020`, `022` (`--datos-prueba`) | Datos del Consolidado: 6 unidades, 12 divisiones, 39 subdivisiones, 338 áreas, 69 riesgos de biblioteca y 249 registrados, y los nombres inferidos |
| `024` (`--datos-prueba`) | Limpia bases que ya cargaron los datos anteriores: quita la subdivisión sin código con sus áreas y riesgos |

### Datos de prueba del Consolidado

- Se **generaron** del xlsx con un script (hoy fuera del repo), que produjo `018`, `020`, `022`,
  `backend/src/repos/semillaEstructura.ts` (la misma semilla para `DATA_MODE=memoria`) y
  `src/app/data/catalogoEstructura.ts` (sugerencias de los formularios). El 2026-10-21 se quitó a
  mano de esos archivos la subdivisión sin código.
- **Niveles de riesgo ficticios**: el Consolidado no los trae; se asignan por palabras clave del nombre.
- **Procedimiento de control**: el archivo solo trae su id (`CP-…`), que se usa como descripción.
- **Nombres inferidos**: el Consolidado solo trae códigos y el deck solo nombres. Confianza por
  fila en `022_seed_nombres_reales.sql`; UDN-0002 = Spin y UDN-0005 = FEMSA Servicios **sin confirmar**;
  DIVISION-0011 y las subdivisiones se quedan solo con su código.
- Ajustes: un área repetida por país dentro de la misma subdivisión lleva el país en el nombre
  ("Finanzas (KFS RTR)"); se omiten la subdivisión B-923765, que no tiene código en el archivo (con
  sus 5 áreas y 2 riesgos), y el único riesgo registrado sin subdivisión.

## Backend (`backend/src/`)

- `domain/estructura.ts`: tipos (unidad con `divisiones[].subdivisiones[].areas/riesgos`), validaciones y normalización.
- `repos/estructura.ts` (interfaz), `estructuraSql.ts`, `estructuraMemoria.ts` (con `sembrar` y helpers de prueba `registrarAuditoria`, `registrarRiesgo`).
- `routes/estructura.ts`, montado bajo `/api` con `autenticar`. Bitácora: `estructura.alta|edicion|baja` (con el nivel en el detalle), `periodo.alta|edicion`.

### Endpoints

| Método y ruta | Acceso | Respuesta |
|---|---|---|
| `GET /periodos`, `GET /periodos/activo` | con sesión | periodos / el activo (404 si no hay) |
| `POST /periodos`, `PATCH /periodos/:id` | gestión | activar uno desactiva los demás |
| `GET /departamentos-auditoria` | con sesión | Retail & Spin, Beverage |
| `GET /unidades-negocio`, `GET /unidades-negocio/:id` | con sesión | unidades con la jerarquía y los riesgos anidados |
| `GET /unidades-negocio/responsables` | gestión | Jefes de Auditoría activos |
| `POST /unidades-negocio` | gestión | `nombre`, `responsableId`, `departamentoAuditoriaId`; el `codigo` lo asigna el backend (enviarlo responde 400) |
| `PATCH /unidades-negocio/:id` | gestión | `nombre`, `responsableId`, `departamentoAuditoriaId`; enviar `codigo` responde 400 |
| `POST /divisiones`, `/subdivisiones`, `/areas` | gestión | `nombre` (obligatorio solo en el área), `padreId`, `pais` (solo subdivisión); el `codigo` de división y subdivisión lo asigna el backend (enviarlo responde 400) |
| `PATCH` / `DELETE` de `/unidades-negocio/:id`, `/divisiones/:id`, `/subdivisiones/:id`, `/areas/:id` | gestión | 200 / 204 |

Errores: `400 DATOS_INVALIDOS` (incluye gerente que no es Jefe de Auditoría activo),
`404 NO_ENCONTRADO` (también padre inexistente), `409 NOMBRE_DUPLICADO`,
`409 PERIODO_ACTIVO_NO_CONFIGURADO`, `409 AUDITORIAS_ACTIVAS`, `409 HIJOS_EXISTENTES`.

## Frontend (`src/app/`)

- `api/estructura.ts`: tipos y llamadas (usa `cliente.ts`); `ETIQUETA_NIVEL`, `NIVEL_HIJO`, `NIVELES_RIESGO`.
- `domain/estructura/` (lógica pura, con pruebas):
  - `useEstructuraViewModel.ts`: estado, carga y acciones; tras cambiar un nodo vuelve a leer su unidad.
  - `riesgos.ts`: peor nivel, riesgos de una rama, colores y `filtrarUnidades` (búsqueda y filtro por nivel).
  - `navegacion.ts`: ruta del explorador (solo ids; cae al ancestro si un nodo se borra o el filtro lo oculta), ancestros a expandir y conteos de la rama.
  - `sugerencias.ts`: siguiente código libre y sugerencias de áreas y países.
  - `nombres.ts`: `nombreVisible` (nombre o, si no hay, código).
- `components/catalogo/`:
  - `HierarchyView.tsx`: página "Catálogo Organizacional". Búsqueda (código, nombre, área o riesgo), filtro por nivel de riesgo y una tarjeta por unidad con su **árbol**. Sustituyó al "Explorador de Riesgos Corporativos" de datos fijos.
  - `ArbolCatalogo.tsx`: **árbol de navegación** (panel izquierdo, desde `lg`): solo unidad › división › subdivisión, contraído por defecto; al navegar se abren los ancestros y con filtro se expande todo.
  - `DetalleCatalogo.tsx`: **panel de detalle**: sin selección, resumen de unidades (indicadores y barra de riesgos por nivel); en unidad y división, encabezado con indicadores y lista de hijos; en la subdivisión, pestañas de riesgos (ordenados del peor nivel) y áreas. Migas para volver.
  - `piezasCatalogo.tsx`: piezas compartidas (resumen de riesgos, chips, `NombreConCodigo`, `Sugerencias`).
  - Modales: `ModalRegistrarUnidad`, `ModalRegistrarNodo`, `ModalEditarEntidad`. Los mensajes de duplicado y de borrado bloqueado se muestran en el formulario o diálogo. Los campos de nombre y país sugieren valores (`datalist`), pero aceptan texto libre.
- Las acciones de escritura solo se muestran a Administrador y Jefe de Auditoría.

## Fuera de alcance

- Alta y edición del **catálogo de riesgos** (tarea original de la historia): los riesgos solo se muestran.
- Unificar `controls` (008) con `control_procedure` (010), y `audits` con `audit_engagement`.

## Pendiente (TBD)

- Confirmar con FEMSA el **mapeo de nombres reales**, sobre todo Spin / FEMSA Servicios y DIVISION-0011.
- Confirmar la **escala de nivel de riesgo** y si un riesgo tiene **estado**.
- Duplicados con **distinto acento**: el borrador pedía rechazarlos; la intercalación los acepta como distintos.
- Futuro de `processes` y `controls.process_id`.
- Llevar el script generador de semillas al repositorio.
