# CLAUDE.md — Cerebro del proyecto Expedite

> Este archivo se carga automáticamente en cada sesión. Úsalo como fuente de verdad antes de implementar cualquier cosa.
> Si algo aquí contradice el código, **verifica el código** y actualiza este archivo.
> Última actualización del contexto SRS: 2026-09-06.

---

## 1. Qué es Expedite

- Plataforma web de **Gobernanza, Riesgo y Cumplimiento (GRC)** para la **Dirección de Auditorías Internas de FEMSA**, en sustitución de **Archer IRM**.
- Desarrollada por el equipo **XPDN** (Tec de Monterrey). Socio formador: FEMSA (contactos: David Llanas y Alicia Alemán).
- Integrantes: Jesús Leonardo Pérez Guerrero, Héctor Aranda García, Daniela Landín Solís, Alex André Caballero García, Andrés Felipe Godoy López.
- Documento base de negocio: `Visión y Alcance Sistema Auditoría.md` (requerimientos funcionales y no funcionales originales de FEMSA). Consúltalo cuando una tarea toque reglas de negocio.

## 2. Reglas de trabajo para Claude

1. **Idioma:** toda la UI, textos, comentarios de dominio y documentación en **español**. Nombres de variables/tipos pueden seguir el estilo existente (mezcla inglés/español, p. ej. `BilacoraEntry`, `AuditadoPortalView`).
2. **Trazabilidad:** cuando implementes una funcionalidad, identifica el requisito que cubre (SF-xx, SNF-xx, UF-xx, INT-xx) y el módulo al que pertenece (sección 5). Menciónalo en tu respuesta.
3. **Flujo de auditoría:** respeta el flujo unidireccional **Planeación → Ejecución → Reporte y cierre → Seguimiento**. El único retorno permitido es por **rechazo en aprobación (SF-12)**.
4. **Seguridad y trazabilidad son transversales:** acciones relevantes deben poder registrarse en la bitácora (SF-15/SF-18) y respetar roles/permisos (SF-16, SF-17, SNF-05).
5. **No inventes decisiones pendientes** (sección 7). Si una tarea depende de una, pregunta o márcala como `TBD`.
6. **Commits:** sin trailers `Co-Authored-By` automáticos (instrucción global del usuario).
7. **Mantén vivo este archivo:** si se toma una decisión nueva de arquitectura, alcance o diseño, propón actualizar CLAUDE.md.

## 3. Stack técnico (estado actual del repo)

- **Frontend** exportado desde Figma Make ("Expedite GRC"). Casi todos los datos siguen siendo mocks en memoria (`src/app/data/mock_data.tsx`); **usuarios y roles ya salen del backend**.
- React 18 + TypeScript + **Vite 6**, Tailwind CSS v4 (`@tailwindcss/vite`), componentes **shadcn/ui** (Radix) en `src/app/components/ui/`, iconos `lucide-react`, gráficas `recharts`, toasts `sonner`, también MUI instalado.
- **Backend** en `backend/`: Node + Express 5 + TypeScript (módulos ES), `mssql` para Azure SQL, `jose` para validar tokens de Entra ID. Usa **pnpm** (`corepack pnpm ...`); la raíz usa **npm**.
- Comandos frontend: `npm i`, `npm run dev`, `npm run build`, `npm test` (Vitest + Testing Library). Comandos backend: `corepack pnpm dev`, `test`, `typecheck`, `build`. No hay linter ni revisión de tipos en el frontend.
- La app exige sesión: sin el backend corriendo muestra un error de conexión. Para desarrollo local hace falta un `.env` en la raíz y otro en `backend/` (variables en el README; modo `dev`, sin Azure). Nunca leer ni versionar los `.env`.
- Diseño y pruebas de usuarios y roles: `docs/diseno/usuarios-roles.md`, `docs/pruebas/usuarios-roles.md`.
- Alias `@` → `src/`. Plugin `figma:asset/…` → `src/assets/`. **No quitar** los plugins `react()` ni `tailwindcss()` de `vite.config.ts`.

### Estructura

```
src/
  main.tsx                 ← monta la sesión (ProveedorSesion + PuertaSesion) y la app
  app/App.tsx              ← la mayoría de las vistas (en proceso de refactorización para reducir su tamaño)
  app/api/                 ← cliente HTTP y llamadas a la API
  app/auth/                ← sesión, inicio de sesión (MSAL / modo dev)
  app/components/          ← SharedComponents, UsuariosRolesView, VistaHallazgo, FormularioPlanAccion, VistaControles, EvidenciasSection, SpreadsheetEditor
  app/components/ui/       ← shadcn/ui (no editar salvo necesidad)
  app/components/figma/    ← ImageWithFallback
  app/domain/              ← lógica de estado/ViewModels (ej. useHallazgosViewModel)
  app/data/mock_data.tsx   ← constantes y datos de prueba
  imports/logo.svg         ← logo Expedite
  styles/theme.css         ← tokens de diseño (colores, radios, sidebar, charts)
backend/
  sql/                     ← scripts de Azure SQL (esquema, datos iniciales, primer administrador, hallazgos y sus datos de prueba, auditorías, planes de acción)
  src/server.ts            ← único punto de arranque; abre la conexión a la base y monta las rutas
  src/app.ts               ← app Express; recibe repositorio, verificador de tokens y rutas
  src/db.ts                ← conexión compartida (la registra server.ts)
  src/routes/              ← endpoints: usuarios.ts, planes.ts y planesAccion.ts (con sesión); hallazgos.ts y evidencias.ts (aún sin sesión, solo con DATA_MODE=sql)
  src/domain/              ← tipos y validaciones (planes.ts, planesAccion.ts)
  src/middleware/          ← autenticar (token → usuario), autorizar (por rol) y upload (archivos de evidencia)
  src/repos/               ← repositorio SQL y en memoria
  test/                    ← pruebas (las de SQL requieren SQL_TEST_*)
```

Nota: La aplicación está en proceso de refactorización hacia un enfoque MVVM modular. Se están extrayendo vistas, lógicas de dominio y constantes desde el monolito `App.tsx` hacia los directorios `components/`, `domain/` y `data/`.

### Mapa de `App.tsx` (buscar por nombre, las líneas cambian)

- **Tipos:** `NavView` (`dashboard | filter | editor | hierarchy | settings | users | plans | findings | auditado | bitacora`), `DetailType`, `StatusKey`, `AuditEntity`, `GeneralRisk`, `SpecificRisk`, `ControlRecord`, `AuditPlan`, `Finding`, `ActionPlan`, `EvidenceFile`, `BilacoraEntry`, `UserRecord`, `Xlsx*`.
- **Mocks/constantes:** `STATUS_CONFIG`, `NAV_ITEMS`, `TASKS`, `GENERAL_RISKS`, `AUDIT_ENTITIES`, `SPECIFIC_RISKS`, `CONTROLS`, `PROCEDURE_TRACKING`, `ROLES`, `DEFAULT_PERMISSIONS`, `INITIAL_USERS`, `AUDIT_RECORDS`, `AUDIT_PLANS_DATA`, `INITIAL_FINDINGS`, `INITIAL_EVIDENCES`, `BITACORA_DATA`.
- **Componentes base:** `StatusBadge`, `Breadcrumbs`, `PageHeader`, `Card`, `PrimaryBtn`, `GhostBtn`, `Sidebar`, `TopBar`, `PDFPreviewModal`, `exportToCSV`.
- **Vistas:** `DashboardView`, `FilterView`, `EditorView`, `HierarchyView` (Catálogo), `SettingsView`, `BitacoraView`, `AuditPlansView`, `FindingsView`, `AuditadoPortalView` (usuarios y roles vive en `components/UsuariosRolesView.tsx`, solo para Administrador), vistas de detalle (`GeneralRiskDetailView`, `SpecificRiskDetailView`, `AuditEntityDetailView`, `ControlDetailView`).
- **IA / extras:** `CopilotPanel`, `AISummaryCard`, `GuidedTour`, `SpreadsheetEditor` (editor tipo Excel con versiones y hash).

### Convenciones de código

- Reutiliza los componentes base de `App.tsx` (`Card`, `PageHeader`, `PrimaryBtn`, `StatusBadge`…) antes de crear nuevos.
- Colores vía tokens de `src/styles/theme.css` (`--primary #0F4FFF`, `--sidebar #0F1B2D`, `--chart-1..5`, etc.); no hardcodear paletas nuevas.
- Si agregas mucho código nuevo, está bien extraerlo a archivos bajo `src/app/` (el archivo único ya es muy grande), pero sigue el estilo existente.

## 4. Arquitectura objetivo (según SRS)

Aplicación web **cliente-servidor modular**: **SPA + backend**, comunicación exclusiva por **API REST/JSON documentada con OpenAPI 3.0**.

Principios: **desacoplamiento**, **aislamiento de servicios externos**, **continuidad ante fallos parciales**, **seguridad y trazabilidad**.

Componentes:
- SPA Expedite
- Capa de exposición (API)
- Capa de negocio
- BD API Gateway
- Copilot API Gateway (IA consumida vía componente intermedio, nunca directo desde la SPA)
- Adaptador de almacenamiento (proveedor por definir en diseño técnico)

Autenticación prevista: **Microsoft Entra ID**. Evidencias con **hash de integridad**; **bitácora inmutable** como responsabilidad transversal.

## 5. Módulos y requisitos

### Módulos del ciclo de auditoría

| Módulo | Requisitos SF |
|---|---|
| Planeación | SF-01, SF-02, SF-03, SF-05 |
| Ejecución | SF-04 (conflictos de interés), SF-06, SF-07, SF-08 |
| Reporte y cierre | SF-09, SF-12 (aprobación/rechazo), SF-13, SF-14 |
| Seguimiento | SF-10, SF-11 (incluye solicitudes de prórroga) |

### Módulos de apoyo

| Módulo | Requisitos |
|---|---|
| Usuarios y accesos | SF-16, SF-17, SNF-05 |
| Documentos y evidencia | SF-08, SF-20 |
| Asistente de IA | SF-19 |
| Analítica y tableros | SF-13, SF-14 |
| Registro y respaldo | SF-15, SF-18 |

Otros identificadores del SRS: requisitos de usuario **UF-01…UF-17**, **UNF-REND/ACCS/USAB/LENG/MANT**, **NPP-01…NPP-07**; del sistema **SF-01…SF-20**, **SNF-01…SNF-10**, **INT-01…INT-03**.

## 6. Documento SRS (entregable académico)

- SRS v1.0 (07/09/2026), estructura de **Sommerville** (no IEEE 29148): Prefacio, Introducción, Glosario, Requisitos de Usuario, Arquitectura del Sistema, Requisitos del Sistema, Modelos del Sistema, Evolución del Sistema, Apéndices, Referencias.
- El SRS dice **qué** hace el sistema, **no cómo** (no es documento de diseño). Marcar información faltante como **TBD**.
- Estilo de redacción: registro formal sin tecnicismo innecesario; conservar términos estándar (OpenAPI, Entra ID, hash de integridad, bitácora inmutable); no duplicar lo cubierto en otros capítulos.

| Capítulo | Estado |
|---|---|
| Prefacio, Introducción | Completo |
| Glosario | Completo (25 términos, APA) |
| Requisitos de Usuario | Completo |
| Arquitectura del Sistema | Completo (3 subsecciones: estilo, componentes, distribución de funciones) |
| Requisitos del Sistema | Completo |
| Modelos del Sistema | ERD y arquitectura en Miro; **falta texto** |
| Evolución del Sistema | Completo |
| Apéndices A y B | Completos |
| Referencias | Completo |

### Erratas pendientes en el capítulo de Arquitectura

- "contacto con dos artefactos" → "compuesta por"
- "Continuidad antes fallos parciales" → "ante"
- "a través de de un componente" → "de un"
- "bitácora inmutable de eventos de responsabilidad" → cerrar como responsabilidad transversal del sistema
- "siguen la fase de auditorio" → "las fases del ciclo de auditoría"
- "dan servicio a las demás" → "los demás"
- Reporte y cierre: "Clasificar las responsabilidades y asignarles folio" → "los hallazgos"
- Seguimiento: "antes de la prórroga" → "de prórroga"
- Ejecución: falta mencionar SF-04 en la descripción
- Tabla de apoyo: encabezado "SF relacionado" incluye SNF-05 (renombrar a "Requisitos relacionados")

## 7. Decisiones pendientes / conflictos abiertos (NO asumir)

1. **Proveedor de almacenamiento:** SF-08 e INT-03 aún tienen placeholders en rojo; alinear con Apéndice B ("se elegirá en diseño técnico").
2. **Tamaño máximo de archivo:** SNF-01 excluye >30 MB; Archer usa 100 MB de referencia.
3. **Prioridad de la IA:** UF-16 (agente Copilot) y UF-17 (Excel) en prioridad Baja, pero la IA es la prioridad #1 de FEMSA y objetivo central del MVP.
4. **Copilot API vs Copilot Premium:** términos usados indistintamente; implican gobernanzas distintas de datos en prompts.
5. **Lineamientos de ciberseguridad de FEMSA:** pendientes de solicitar; condicionan la arquitectura de IA.
6. **Índice del SRS** no lista "Distribución de las funciones sobre los módulos".
7. **Modelos del Sistema** sin texto explicativo.

8. **Dominio corporativo real** para el alta de usuarios: hoy `DOMINIOS_PERMITIDOS=expedite.com` como valor de desarrollo.
9. **Recursos de Azure** (base Azure SQL y registro de aplicación en Entra ID) aún sin crear; el backend ya está listo para conectarse por variables de entorno.
10. **Sesión en las rutas de hallazgos:** `/api/hallazgos` todavía responde sin iniciar sesión y la vista de hallazgos no envía el token. Hay que pasarlas detrás de `autenticar` y usar `src/app/api/cliente.ts` en esa vista.

11. **Rol "Auditado":** no existe como rol; hoy el responsable de un plan de acción es cualquier usuario activo. Falta definir si FEMSA quiere un rol propio con acceso restringido al portal.
12. **Entidad "auditoría":** `audits` solo guarda id, nombre y fecha de cierre para los planes de acción; el resto del modelo (SF-05) está pendiente.

### Decisiones tomadas

- Tablas `users`, `roles`, `permissions`, `role_permissions` siguiendo el modelo de datos de Miro (inglés, `snake_case`). `users.role` (texto) se sustituyó por `users.role_id`; **falta reflejarlo en el diagrama de Miro**.
- Los permisos se leen de la base en cada petición (sin caché ni claims en el token) para que el cambio de rol sea inmediato (SF-17).
- Un solo backend: arranca en `backend/src/server.ts`, puerto 3000, todo bajo `/api`, con una sola conexión a la base (variables `DB_*`).
- **Planes de acción (historia #91, SF-10/SF-11):** tabla `action_plans` (un plan por hallazgo, responsable = usuario registrado, estado inicial `Asignado`) y tabla mínima `audits` (id, nombre, `end_date`) porque la fecha de cierre de la auditoría no existía en la base. Rutas `/api/planes-accion` (listar, `mios`, `responsables`, `hallazgos/:id`, POST) detrás de `autenticar`; crean Administrador, Jefe de Auditoría, Auditor Senior y Auditor. La validación "fecha de compromiso ≥ cierre de auditoría" vive en `backend/src/domain/planesAccion.ts` y se repite en el formulario. Al crear el plan el hallazgo pasa a `Asignado` y se registra `plan_accion.alta` en bitácora. El portal del auditado lee `/planes-accion/mios` del usuario en sesión.

## 8. Referencias

- `Visión y Alcance Sistema Auditoría.md` — visión, situación actual, alcance y requerimientos de FEMSA.
- Diseño original en Figma: https://www.figma.com/design/81zRCWhIiue8fy0HTI3WPN/Expedite-GRC
- Curso: diapositivas "Ingeniería de Requisitos Parte 4" (FIng-CETP) — estructura del SRS y checklist de defectos.
