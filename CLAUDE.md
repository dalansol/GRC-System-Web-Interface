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

1. **Idioma:** toda la UI, textos, comentarios de dominio y documentación en **español**. Nombres de variables/tipos pueden seguir el estilo existente (mezcla inglés/español, p. ej. `BilacoraEntry`, `VistaPlanesAccion`).
2. **Trazabilidad:** cuando implementes una funcionalidad, identifica el requisito que cubre (SF-xx, SNF-xx, UF-xx, INT-xx) y el módulo al que pertenece (sección 5). Menciónalo en tu respuesta.
3. **Flujo de auditoría:** respeta el flujo unidireccional **Planeación → Ejecución → Reporte y cierre → Seguimiento**. El único retorno permitido es por **rechazo en aprobación (SF-12)**.
4. **Seguridad y trazabilidad son transversales:** acciones relevantes deben poder registrarse en la bitácora (SF-15/SF-18) y respetar roles/permisos (SF-16, SF-17, SNF-05).
5. **No inventes decisiones pendientes** (sección 7). Si una tarea depende de una, pregunta o márcala como `TBD`.
6. **Commits:** sin trailers `Co-Authored-By` automáticos (instrucción global del usuario).
7. **Mantén vivo este archivo:** si se toma una decisión nueva de arquitectura, alcance o diseño, propón actualizar CLAUDE.md.

## 3. Stack técnico (estado actual del repo)

### Estado del trabajo (leer antes de empezar)

- **Rama base:** `master`. Desde el 2026-11-05 (PR #6) reúne `integracion-planes-accion` (planes de acción, vista del auditado, catálogos, trimestres y R2), `estandar-proyecto`, `Andre` (evaluación de controles) y `SPRINT-3-HU-EXCEL`. Las ramas nuevas salen de `master` actualizado (`CONTRIBUTING.md`).
- **Base compartida (Supabase):** migrada con `db:migrar` hasta el script `048` (2026-11-05). Tenía columnas agregadas a mano; 042 las replica en las demás bases. `schema_migrations` también registra nombres antiguos y scripts de datos de prueba que no están en la lista principal de `migrar.ts`; no afectan. Detalle en `docs/diseno/base-de-datos.md`.
- **Cambios de esquema:** siempre en un script nuevo (el siguiente es `049`) agregado a `backend/src/migrar.ts`. No editar scripts ya aplicados ni cambiar Supabase a mano.
- **Nunca contra Supabase:** `db:migrar --datos-prueba` ni las pruebas con `SQL_TEST_*` (`sql.integracion.test.ts` borra tablas). Usar una base exclusiva de pruebas.
- **Pruebas:** sin `SQL_TEST_*` se omiten las de integración, que cubren los permisos de hallazgos, evidencias y controles. Necesitan un PostgreSQL con TLS y una base exclusiva; se comprobaron con `postgres:17` en Docker y en serie: `corepack pnpm exec vitest run --no-file-parallelism`. Las 10 fallas de `planes.test.ts` son conocidas (pendiente 22); todo lo demás debe pasar. Con el equipo sobrecargado, las pruebas del frontend pueden fallar por tiempo de espera: repetirlas antes de investigar.
- **Modo memoria:** con `DATA_MODE=memoria` no existen las rutas de hallazgos ni de evidencias.

### Tecnologías

- **Frontend** exportado desde Figma Make ("Expedite GRC"). Parte de los datos sigue siendo mocks en memoria (`src/app/data/mock_data.tsx`); **usuarios y roles, planes de auditoría, planes de acción, hallazgos, controles, evidencias, la estructura organizacional (Catálogo) y el asistente de IA ya salen del backend**.
- React 18 + TypeScript + **Vite 6**, Tailwind CSS v4 (`@tailwindcss/vite`), componentes **shadcn/ui** (Radix) en `src/app/components/ui/`, iconos `lucide-react`, gráficas `recharts`, toasts `sonner`, también MUI instalado.
- **Backend** en `backend/`: Node + Express 5 + TypeScript (módulos ES), `pg` para PostgreSQL en Supabase, `jose` para validar tokens de Entra ID, `unpdf` y `exceljs` para leer evidencias en el asistente de IA. Usa **pnpm** (`corepack pnpm ...`); la raíz usa **npm**.
- Comandos frontend: `npm i`, `npm run dev`, `npm run build`, `npm test` (Vitest + Testing Library). Comandos backend: `corepack pnpm dev`, `test`, `typecheck`, `build`, `db:migrar`, `ia:probar` (conexión con la IA) e `ia:evaluar` (reglas de contención contra la IA real). `npm run lint` (ESLint para frontend y backend, lo corre la revisión de cada pull request) y `npm run format` (Prettier en los archivos cambiados; `format:check` solo revisa); ver `CONTRIBUTING.md`. No hay revisión de tipos en el frontend.
- La app exige sesión: sin el backend corriendo muestra un error de conexión. Para desarrollo local hace falta un `.env` en la raíz y otro en `backend/` (variables en el README; modo `dev`, sin Entra ID). Nunca leer ni versionar los `.env`.
- Diseño y pruebas de usuarios y roles: `docs/diseno/usuarios-roles.md`, `docs/pruebas/usuarios-roles.md`.
- Diseño y pruebas de la estructura organizacional (Catálogo, SF-03): `docs/diseno/estructura-organizacional.md`, `docs/pruebas/estructura-organizacional.md`.
- Diseño y pruebas del flujo de aprobación de planes de acción (SF-12): `docs/diseno/aprobacion-planes-accion.md`, `docs/pruebas/aprobacion-planes-accion.md`.
- Diseño y pruebas de la evaluación de controles (historia #98, SF-07): `docs/diseno/evaluacion-controles.md`, `docs/pruebas/evaluacion-controles.md`.
- Diseño y pruebas de la edición de Excel (UF-17, SF-08): `docs/diseno/edicion-excel.md`, `docs/pruebas/edicion-excel.md`. El frontend usa `exceljs` (cargado bajo demanda) para leer y escribir `.xlsx`.
- Alias `@` → `src/`. Plugin `figma:asset/…` → `src/assets/`. **No quitar** los plugins `react()` ni `tailwindcss()` de `vite.config.ts`.

### Estructura

```
src/
  main.tsx                 ← monta la sesión (ProveedorSesion + PuertaSesion) y la app
  app/App.tsx              ← la mayoría de las vistas (en proceso de refactorización para reducir su tamaño)
  app/api/                 ← cliente HTTP y llamadas a la API
  app/auth/                ← sesión, inicio de sesión (MSAL / modo dev)
  app/components/          ← SharedComponents (tipos y componentes base), UsuariosRolesView, VistaDashboard, VistaPlanesAudito, FormularioPlanAudito, VistaHallazgo, VistaHallazgoDetallado, FormularioHallazgo, VistaPlanesAccion, PortalPlanesAuditado, BandejaRevisionPlanes, BandejaProrrogas, HistorialFlujoPlan, InsigniaEstadoPlan, FormularioPlanAccion, VistaControles, VistaControlDetallado, FormularioAsignarControl, EvaluacionControl, EvidenciasSection, SpreadsheetEditor, PanelAsistenteEvidencia, CopilotPanel, ConflictosPlan, CampanaNotificaciones, CatalogosEstructuraSection
  app/components/catalogo/ ← Catálogo Organizacional: HierarchyView (explorador), ArbolCatalogo (árbol de navegación), DetalleCatalogo (panel de detalle), modales y piezasCatalogo
  app/components/hoja/     ← vista del editor de Excel: cuadrícula virtualizada, cinta, barra de fórmulas, pestañas, barra de estado, menú contextual
  app/components/ui/       ← shadcn/ui (no editar salvo necesidad)
  app/components/figma/    ← ImageWithFallback
  app/domain/              ← lógica de estado/ViewModels (hallazgos, controles, planes-auditoria) y contextoVista (datos que recibe el asistente Copilot)
  app/domain/estructura/   ← useEstructuraViewModel y lógica pura: riesgos, navegacion, sugerencias, nombres, periodos
  app/domain/hoja/         ← editor de Excel: modelo del libro, fórmulas (es/en), formato, portapapeles, operaciones, xlsx (exceljs) y estadoHoja/useHojaCalculo
  app/data/mock_data.tsx   ← constantes y datos de prueba
  imports/logo.svg         ← logo Expedite
  styles/theme.css         ← tokens de diseño (colores, radios, sidebar, charts)
backend/
  sql/                     ← scripts de PostgreSQL (esquema, datos iniciales, primer administrador, hallazgos y sus datos de prueba, auditorías, planes de acción, estructura y controles, catálogos, riesgos y ejecución; 017 jerarquía, 019 riesgos en la jerarquía, 021 nombre opcional; 023 código asignado por el sistema; 018/020/022 datos del Consolidado; 024 quita la subdivisión sin código; 025 nombres únicos; 026 formato de periodos; 027 formatos de evidencia; 028–029 seguimiento de controles y conflictos por plan; 030 datos de prueba del modo en memoria; 034 y 035 son dos scripts cada uno: catálogos de área y país y portal del auditado, relación de planes y trimestres "T1…T4"; 036–037 varios planes por hallazgo; 038 folio del plan; 039–040 evidencia ligada a una sola entidad; 041 estado "En Revisión"; 042 columnas de `processes` y `audit_controls.process_id`; 043 plan de prueba; 044 flujo de aprobación; 045 etapas, archivos señalados y prórrogas; 046 usuarios auditados de prueba; 047 evaluación de controles; 048 versiones de evidencia y `.xlsm`)
  src/server.ts            ← único punto de arranque; abre la conexión a la base y monta las rutas
  src/app.ts               ← app Express; recibe repositorio, verificador de tokens y rutas
  src/db.ts                ← conexión compartida (la registra server.ts)
  src/routes/              ← endpoints: usuarios.ts, planes.ts, planesAccion.ts, estructura.ts, catalogos.ts, conflictos.ts, evaluaciones.ts, notificaciones.ts, asistente.ts, auditControls.ts (con sesión); evidencias.ts y hallazgos.ts (con sesión, solo con DATA_MODE=sql)
  src/asistente/           ← gateway de IA: interfaz ProveedorIA, adaptadores Gemini y Azure OpenAI, extracción de texto, instrucciones y reglas de contención
  src/scripts/             ← ia:probar e ia:evaluar
  src/domain/              ← tipos y validaciones (planes.ts, planesAccion.ts, flujoPlanAccion.ts, estructura.ts, catalogos.ts, conflictos.ts, evaluaciones.ts)
  src/middleware/          ← autenticar (token → usuario), autorizar (por rol) y upload (archivos de evidencia)
  src/repos/               ← repositorio SQL y en memoria (incluye evidencias para el asistente y documentos de ejemplo EV-001…EV-004; semillaEstructura.ts: datos del Consolidado para DATA_MODE=memoria, generado; evidenciasAcceso.ts: quién puede ver una evidencia, para el asistente y el editor de Excel)
  test/                    ← pruebas (las de SQL requieren SQL_TEST_*)
```

Nota: La aplicación está en proceso de refactorización hacia un enfoque MVVM modular. Se están extrayendo vistas, lógicas de dominio y constantes desde el monolito `App.tsx` hacia los directorios `components/`, `domain/` y `data/`.

### Mapa del frontend (buscar por nombre, las líneas cambian)

- **Tipos (`components/SharedComponents.tsx`):** `NavView` (`dashboard | filter | editor | hierarchy | settings | users | plans | findings | controles | auditado | bitacora`), `DetailType`, `StatusKey`, `AuditEntity`, `GeneralRisk`, `SpecificRisk`, `ControlRecord`, `AuditPlan`, `Finding`, `ActionPlan`, `BilacoraEntry`, `UserRecord`, `Xlsx*`. `EvidenceFile` está en `EvidenciasSection.tsx`.
- **Mocks/constantes (`data/mock_data.tsx`):** `STATUS_CONFIG`, `TASKS`, `GENERAL_RISKS`, `AUDIT_ENTITIES`, `SPECIFIC_RISKS`, `CONTROLS`, `PROCEDURE_TRACKING`, `ROLES`, `DEFAULT_PERMISSIONS`, `INITIAL_USERS`, `AUDIT_RECORDS`, `AUDIT_PLANS_DATA`, `INITIAL_FINDINGS`, `INITIAL_EVIDENCES`, `BITACORA_DATA`. `NAV_ITEMS` está en `App.tsx`.
- **Componentes base (`components/SharedComponents.tsx`):** `StatusBadge`, `Breadcrumbs`, `PageHeader`, `Card`, `PrimaryBtn`, `GhostBtn`, `PDFPreviewModal`, `exportToCSV`. `Sidebar` y `TopBar` están en `App.tsx`.
- **Vistas en `App.tsx`:** `FilterView`, `EditorView`, `SettingsView`, `BitacoraView` (usuarios y roles vive en `components/UsuariosRolesView.tsx`, solo para Administrador), vistas de detalle (`GeneralRiskDetailView`, `SpecificRiskDetailView`, `AuditEntityDetailView`). Ya viven en `components/`: `VistaDashboard`, `VistaPlanesAudito`, `VistaHallazgo`, `VistaHallazgoDetallado`, `VistaControles`, `VistaControlDetallado` y `VistaPlanesAccion` (sustituye al antiguo portal del auditado). El Catálogo (`HierarchyView`) ya no está en `App.tsx`: vive en `components/catalogo/` (se borró la copia antigua de datos fijos y el "Explorador de Riesgos Corporativos").
- **IA / extras:** `GuidedTour`, `SpreadsheetEditor` (envoltura de `components/hoja/EditorHojaCalculo`: editor tipo Excel que abre y guarda el `.xlsx` real). `CopilotPanel` ya vive en `components/CopilotPanel.tsx` y `AISummaryCard` en `SharedComponents.tsx`; ambos usan la IA real (sin respuestas fijas).

### Convenciones de código

- Reutiliza los componentes base de `SharedComponents.tsx` (`Card`, `PageHeader`, `PrimaryBtn`, `StatusBadge`…) antes de crear nuevos.
- Colores vía tokens de `src/styles/theme.css` (`--primary #0F4FFF`, `--sidebar #0F1B2D`, `--chart-1..5`, etc.); no hardcodear paletas nuevas.
- Si agregas mucho código nuevo, está bien extraerlo a archivos bajo `src/app/` (`App.tsx` todavía es muy grande), pero sigue el estilo existente.

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

1. ~~**Proveedor de almacenamiento**~~: resuelto (Cloudflare R2), ver "Decisiones tomadas". Falta reemplazar los placeholders en rojo de SF-08 e INT-03 en el SRS y alinear el Apéndice B.
2. ~~**Tamaño máximo de archivo**~~: resuelto (100 MB), ver "Decisiones tomadas". Falta alinear el texto de SNF-01 (>30 MB) en el SRS.
3. **Prioridad de la IA:** UF-16 (agente Copilot) y UF-17 (Excel) en prioridad Baja, pero la IA es la prioridad #1 de FEMSA y objetivo central del MVP.
4. **Copilot API vs Copilot Premium:** términos usados indistintamente; implican gobernanzas distintas de datos en prompts.
5. **Lineamientos de ciberseguridad de FEMSA:** pendientes de solicitar; condicionan la arquitectura de IA.
6. **Índice del SRS** no lista "Distribución de las funciones sobre los módulos".
7. **Modelos del Sistema** sin texto explicativo.

8. **Dominio corporativo real** para el alta de usuarios: hoy `DOMINIOS_PERMITIDOS=expedite.com` como valor de desarrollo.
9. **Registro de aplicación en Entra ID** aún sin crear; el backend ya está listo para conectarse por variables de entorno.
10. ~~**Sesión en las rutas de hallazgos**~~: resuelto; `/api/hallazgos` exige sesión y el frontend usa `src/app/api/cliente.ts`.

11. **Roles de auditado:** ya existen "Jefe Auditado" y "Empleado Auditado" (con permisos `Ver Hallazgos` y `Ver Plan de Accion`, 002 y `semilla.ts`) y solo ven Dashboard, Hallazgos, Planes de Acción y Ajustes. Falta que FEMSA confirme estas reglas de acceso.
12. **Entidad "auditoría":** `audits` solo guarda id, nombre y fecha de cierre para los planes de acción; el resto del modelo (SF-05) está pendiente.
13. **Proveedor de IA definitivo:** la task #134 pedía Copilot vía Microsoft Graph, pero no hay licencias de Microsoft 365 Copilot (la cuenta del equipo es "Copilot Chat (Basic)") ni permisos en Azure (la suscripción "ITESM - LabVirtual" no da roles). En desarrollo se usa **Gemini** (plan gratuito, solo datos de prueba: Google puede usar lo que recibe). El destino depende de H-04 (Copilot API vs Premium) y de los lineamientos de ciberseguridad de FEMSA: Azure OpenAI o Copilot vía Graph (este último pide el archivo en SharePoint/OneDrive y token de usuario con OBO). Falta anotar el cambio en Azure DevOps.
14. **Evidencias en modo memoria:** con `DATA_MODE=memoria` no existen las rutas `/api/evidencias`; `EvidenciasSection` entra en modo de respaldo y "Adjuntar archivo" solo agrega una fila en el navegador con id y hash falsos. El asistente no puede analizar esos archivos ("La evidencia no existe."); solo los de ejemplo EV-001…EV-004. Opciones: guardar las cargas en memoria en el backend (recomendada), desactivar el botón de IA en archivos locales o usar SQL.
15. **Asistente Copilot general (UF-16):** en las vistas generales responde con los datos que la vista le envía, que siguen siendo los mocks del frontend. Con un hallazgo expandido ya usa el expediente real del backend (ver "Memoria y contexto del asistente"). El detalle de un control abierto desde un plan también usa su expediente real. Falta pasar las demás vistas a datos reales y registrarlo como historia propia en Azure DevOps.
13. **Nombres de la estructura:** el mapeo código → nombre (UDN-0003 = KOF…) se **infirió** de `02_Estructura.pptx`; falta que FEMSA lo confirme, sobre todo UDN-0002 = Spin / UDN-0005 = FEMSA Servicios y DIVISION-0011. Las subdivisiones no tienen nombre en ningún archivo.
14. **Nivel y estado del riesgo:** la escala Crítico/Alto/Medio/Bajo no está confirmada y los niveles de los datos de prueba son ficticios (el Consolidado no los trae). No hay estado del riesgo en el modelo.
15. **Catálogo de riesgos:** la historia pedía su alta y edición; hoy los riesgos solo se muestran en el Catálogo.
16. **Duplicados con acento:** los nombres únicos (unidad y área en su subdivisión, 025) no distinguen mayúsculas pero sí acentos (intercalación `sin_mayusculas`, nivel 2); el borrador pedía rechazar también por acento.
17. **`processes` y `controls.process_id`:** `processes` volvió a usarse: `audit_controls.process_id` liga cada asignación a un proceso, y de ahí sale la unidad de negocio de los hallazgos. `controls.process_id` sigue en desuso; falta decidir si se retira y cómo convive `processes` con la estructura organizacional.
18. **Periodo de la unidad:** la unidad conserva el periodo activo al darla de alta ("Periodo de alta") aunque después se active otro; falta que FEMSA confirme si debe seguir al periodo activo.
19. **Quién sube evidencia a un hallazgo:** TBD. La pantalla ya no permite subirla: `VistaHallazgoDetallado` muestra una lista de solo lectura y la evidencia nueva va en los pasos del plan de acción. `POST /evidencias/upload` todavía acepta `hallazgo` de cualquier usuario en sesión; falta decidir si se retira o a quién se limita. En controles solo sube el Auditor asignado.
20. **Filas de `processes`:** el formulario de asignar controles exige un proceso con `control_id`, y nada en la aplicación crea esas filas. Supabase ya las tiene (2026-11-04: 6 procesos que cubren sus 4 controles), cargadas a mano; 042 solo crea las columnas, así que en una base nueva no se pueden asignar controles. Falta definir cómo se dan de alta.
21. **Acceso a hallazgos:** Administrador y Jefe de Auditoría ven, editan y eliminan todos. Auditor Senior y Auditor ven todos, pero solo editan o eliminan los que registraron (`findings."ownerId"`, que el backend toma de la sesión); los que no tienen registrante válido solo los modifican Administrador y Jefe de Auditoría. Los demás roles, incluidos Consultor y Solo Lectura, solo trabajan con los propios y los de su unidad (`HALLAZGO_VISIBLE_POR_USUARIO`), y las rutas aún no les impiden crear, editar o eliminar dentro de ese alcance. `POST /hallazgos` tampoco comprueba el rol ni que el control y el plan sean del usuario; eso solo lo limita la pantalla. Hoy ninguna pantalla ofrece editar o eliminar hallazgos. Un usuario sin unidad se trata como unidad 10 (`business_unit_id ?? 10` en `repos/sql.ts`), y la aplicación no permite asignarle unidad: en Supabase solo 2 usuarios la tienen, puesta a mano. Falta que FEMSA confirme estas reglas.
22. **Pruebas de `planes.test.ts`:** 10 fallan desde `c1b717e` (2026-10-16), que exige un Auditor Senior como responsable y limita a cada Auditor a los planes que tiene asignados (el repositorio en memoria no modela asignaciones). Las pruebas no se actualizaron; no se encontró una falla en las reglas.
23. **Folio del plan de acción:** 038 guarda `public_id`, pero las consultas lo ignoran y arman el folio con el id del plan. Pueden diferir (por ejemplo, entre años); falta decidir cuál es el válido.
24. **Proveedor de IA definitivo:** la task #134 pedía Copilot vía Microsoft Graph, pero no hay licencias de Microsoft 365 Copilot (la cuenta del equipo es "Copilot Chat (Basic)") ni permisos en Azure (la suscripción "ITESM - LabVirtual" no da roles). En desarrollo se usa **Gemini** (plan gratuito, solo datos de prueba: Google puede usar lo que recibe). El destino depende de H-04 (Copilot API vs Premium) y de los lineamientos de ciberseguridad de FEMSA: Azure OpenAI o Copilot vía Graph (este último pide el archivo en SharePoint/OneDrive y token de usuario con OBO). Falta anotar el cambio en Azure DevOps.
25. **Evidencias en modo memoria:** con `DATA_MODE=memoria` no existen las rutas `/api/evidencias`, así que `EvidenciasSection` muestra un error al cargar; su código de respaldo con datos locales ya no se activa nunca (`usingFallback` siempre queda en falso). El asistente solo puede analizar los archivos de ejemplo EV-001…EV-004. Opciones: guardar las cargas en memoria en el backend (recomendada) o usar SQL.
26. **Asistente Copilot general (UF-16):** responde con los datos que la vista le envía, que hoy son los mocks del frontend (Hallazgos lee mocks aunque la vista use el backend). Falta registrarlo como historia propia en Azure DevOps.
27. ~~**Quién crea planes de acción**~~: resuelto con el SRS (UF-08, SF-10): Auditor y Auditor Senior (2026-11-05). Falta que FEMSA lo confirme.
28. **Evidencia sin vínculo en Supabase:** 6 archivos de hallazgos y 5 de controles anteriores a 039 perdieron su vínculo y no aparecen en ninguna pantalla. Eran de prueba y se decidió no recuperarlos; falta decidir si se borran.
29. ~~**Script 044 en Supabase**~~: resuelto; se aplicó a la base compartida (2026-11-05).
30. **Aprobación multinivel:** hoy hay un solo nivel (Jefe de Auditoría). UF-09 pide jefatura y gerencia, Visión y Alcance agrega dirección, y el Consolidado trae Audit Chief y Audit Manager, pero el rol de Gerente no existe. Falta que FEMSA confirme la cadena y sus roles.
31. **Notificación por correo:** las notificaciones solo existen dentro de la aplicación; falta elegir un proveedor de correo.
32. **Validez de la firma:** la firma de un plan es un registro electrónico (firmante, rol, fecha y huella SHA-256); falta confirmar con FEMSA si basta legalmente.
33. **`Completado` manual:** `PATCH /planes-accion/:id` todavía permite fijar `Completado` fuera del flujo de aprobación; falta decidir si se retira.
34. **Evidencia para completar un paso:** solo la pantalla la exige al completar un paso; el envío a la revisión de cierre sí la exige en el backend.
35. ~~**Usuarios de prueba en SQL**~~: resuelto con `046_seed_auditados.sql`.
36. ~~**Scripts 045, 047 y 048 en Supabase**~~: resuelto; se aplicaron a la base compartida (2026-11-05).
37. **Reglas de planes de acción por confirmar con FEMSA:** quién envía a revisión y qué es un "entregable" no están en el SRS; el equipo decidió que el entregable es la evidencia de un plan y que envía el auditor. También falta anotar en el SRS que un plan nuevo empieza en `Borrador` (SF-10 dice `Asignado`).
38. **Papeles de trabajo (paso 8 del proceso E2E):** la revisión de controles sigue sin firma ni bitácora del flujo; quedó fuera del flujo de aprobación de planes.
39. **SF-16 fuera de los planes:** el portal filtra por asignación y no por área, porque los usuarios no tienen unidad confiable (pendiente 21). Tampoco se revisó qué calificaciones internas muestra la pantalla de hallazgos al auditado.
40. **Modelo de madurez (SF-07, historia #98):** FEMSA no definió los criterios, si todos son obligatorios, la fórmula, qué es madurez baja ni los estatus. Son **datos de prueba**: 8 criterios en `evaluation_criteria`; calificación = el menor de los promedios de diseño y efectividad; 4 o más Efectivo, de 3 a menos de 4 Parcialmente efectivo, menos de 3 Deficiente. Detalle en `docs/diseno/evaluacion-controles.md`.
41. **Evaluar antes de enviar a revisión:** hoy un control puede enviarse y aprobarse sin evaluación; falta decidir si debe bloquearse (toca el flujo de aprobación de controles).
42. **Edición de Excel (UF-17), pendientes menores:** el evento `evidencia.version` en bitácora (`rutasEvidencias` no recibe `registrarEvento`), restaurar una versión anterior (falta una ruta de descarga por versión) y las rutas en modo memoria (con `DATA_MODE=memoria` el editor abre el libro de ejemplo). Las pruebas de las rutas (`backend/test/evidenciasVersiones.integracion.test.ts`) solo corren con `SQL_TEST_*`.
43. **Vulnerabilidad del control:** el backend no la guarda. Al registrar un hallazgo, "Nuevo hallazgo" usa `Alta` si el control tiene deficiencia en ese plan y `Baja` si no; el detalle del control usa `Baja` salvo que el hallazgo venga de "Generar hallazgo". Esto afecta el riesgo residual calculado; falta definir de dónde sale el dato.
44. **Recorrido manual de la fusión del sprint 3:** las pruebas automáticas pasan, pero falta probar en la aplicación los flujos de la lista del PR #6.

### Decisiones tomadas

- **Base de datos en Supabase (PostgreSQL), no en Azure SQL** (2026-10-09). El backend se conecta con `pg` directo a Postgres por el *Session pooler*; no se usan la API ni el cliente de Supabase. Todas las tablas llevan seguridad por filas activada y sin políticas para que esa API no las exponga. El esquema se aplica con `corepack pnpm db:migrar` (detalle en `docs/diseno/base-de-datos.md`).
- Tablas `users`, `roles`, `permissions`, `role_permissions` siguiendo el modelo de datos de Miro (inglés, `snake_case`). `users.role` (texto) se sustituyó por `users.role_id`; **falta reflejarlo en el diagrama de Miro**.
- Los permisos se leen de la base en cada petición (sin caché ni claims en el token) para que el cambio de rol sea inmediato (SF-17).
- Un solo backend: arranca en `backend/src/server.ts`, puerto 3000, todo bajo `/api`, con una sola conexión a la base (variables `DB_*`).
- **Planes de acción (historia #91, SF-10/SF-11):** tabla `action_plans` (un hallazgo puede tener varios planes y un plan varios hallazgos, por `action_plan_findings`; pasos en `action_plan_steps`; responsable = usuario registrado, estado inicial `Borrador`, ver el flujo de aprobación) y tabla mínima `audits` (id, nombre, `end_date`) porque la fecha de cierre de la auditoría no existía en la base. Rutas `/api/planes-accion` (listar, `mios`, `responsables`, `hallazgos/:id`, POST) detrás de `autenticar`; crean y editan Auditor y Auditor Senior. La validación "fecha de compromiso ≥ cierre de auditoría" vive en `backend/src/domain/planesAccion.ts` y se repite en el formulario. Al crear el plan se registra `plan_accion.alta` en bitácora. `VistaPlanesAccion` lee la lista completa para el equipo de auditoría y `PortalPlanesAuditado` lee `/planes-accion/mios` para los auditados.
- **Flujo de aprobación de planes de acción (SF-12, 2026-11-05, reglas tomadas del SRS y provisionales hasta que FEMSA las confirme):** el entregable es la evidencia documental de un plan, y cada plan tiene dos revisiones (`action_plans.review_stage`). **Definición:** Auditor o Auditor Senior crea el plan en `Borrador` y lo envía; el Jefe de Auditoría lo valida y pasa a `Asignado`, o lo rechaza y el auditor lo corrige; el auditado no lo ve hasta entonces. **Cierre:** el auditado sube evidencia y completa sus pasos; el auditor la revisa y envía; el Jefe la aprueba (`Aprobado`, final) o la rechaza señalando archivos, y el auditado corrige. En ambas: `Pendiente`, al abrir `En Revisión`, y motivo obligatorio para rechazar. Un archivo señalado reabre su paso: el auditado lo vuelve a marcar, se avisa al auditor y este reenvía. Revisa solo el Jefe de Auditoría, salvo que sea responsable del plan, lo haya creado o tenga un paso asignado. **Auditados:** solo reciben una vista reducida de lo asignado (`vistaAuditadoPlan`), sin causa raíz, severidad, historial ni firma; el responsable ve todos los pasos y un asignado los suyos; responsable y asignados de planes nuevos deben ser auditados. **Ya validado,** el contenido queda fijo: solo se reasigna el responsable, y la fecha se mueve con una prórroga (SF-11) que pide el responsable y decide el Jefe. La firma guarda firmante, rol, fecha y una huella SHA-256 del plan y de los hashes de su evidencia; `GET /planes-accion/:id/flujo` la vuelve a calcular (`firmaIntegra`). Estado, evento (`action_plan_approval_events`, inmutable) y notificaciones (`notifications`) van en una sola transacción. En `Pendiente`, `En Revisión` y `Aprobado` no se edita el plan, ni sus pasos, ni su evidencia. Los planes anteriores a 045 quedan como ya validados. Las notificaciones son dentro de la aplicación (campana de la barra superior). Los hallazgos pasan a `Asignado` al validar el plan; aprobar el cierre no los cambia. Detalle en `docs/diseno/aprobacion-planes-accion.md`.
- **Evidencias documentales (SF-08, 2026-10-21):** tamaño máximo **100 MB** por archivo (referencia de Archer). Formatos aceptados: `.pdf`, `.xlsx`, `.xlsm`, `.eml`, `.msg`, `.zip` y `.7z` (027 y 048 amplían `ck_evidence_mime_type`; `mime_type` guarda la extensión). Como los navegadores reportan `.msg`/`.7z` (y a veces `.zip`/`.eml`) como `application/octet-stream` o sin tipo, para esos formatos el filtro de `backend/src/middleware/upload.ts` también acepta ese tipo genérico. La subida usa `multer.memoryStorage()` (el archivo entero en RAM para calcular el hash); para límites mucho mayores habría que pasar a subida por flujo.
- **A qué se liga la evidencia (SF-08, 2026-11-04):** cada archivo se liga a una sola entidad con `entity_id` y `entity_type` (`control`, `hallazgo` o `action_plan_step`); no hay vínculos múltiples ni copias automáticas. En controles, `entity_id` es `audit_controls.id` (la asignación), no el id del control. **Quién la consulta:** en controles, el Auditor que la subió y quien revisa la asignación (Auditor Senior que asignó, Jefe de Auditoría creador del plan; pueden consultar con el id del control y, opcionalmente, `auditId`); en pasos, el responsable del plan, el asignado al paso y el equipo de auditoría (Administrador, Jefe de Auditoría, Auditor Senior, Auditor); en hallazgos, quien la subió y el equipo de auditoría. Las mismas reglas valen para el asistente y el editor de Excel (`repos/evidenciasAcceso.ts`), y quien subió una evidencia siempre puede leerla. **Subir y eliminar:** en controles sube el auditor asignado y elimina quien subió, si sigue asignado; en pasos sube el asignado y elimina quien subió; en hallazgos elimina quien subió.
- **Almacenamiento de evidencias en Cloudflare R2 (SF-08, INT-03, 2026-10-23):** el backend guarda los archivos detrás de la interfaz `AlmacenamientoArchivos` (`backend/src/almacenamiento.ts`), elegida con `ALMACENAMIENTO` (`local` por omisión, carpeta `backend/uploads`; `r2` usa la API compatible con S3 de R2 con `@aws-sdk/client-s3` y las variables `R2_*`). La base solo guarda la clave en `evidence.storage_path`; en R2 los objetos van bajo `evidencias/`. Al subir se guarda el archivo antes que el registro (si el registro falla se borra el archivo); al eliminar se borra primero el registro y después el archivo vigente y los de sus versiones anteriores. El asistente de IA lee el contenido por el mismo adaptador. El bucket es privado: el navegador nunca accede directo a R2.
- **Estructura organizacional (SF-03, Planeación):** jerarquía **unidad → división → subdivisión (`business`) → área**; el "proceso" de la historia es el área. Cada unidad, división y subdivisión tiene **código** (formato del Consolidado: UDN-0007…), que es su identificador y **lo asigna el backend** al dar de alta (mayor código existente del nivel más uno, así que se reutiliza el del último borrado, decisión del 2026-10-28; el usuario no lo escribe ni lo edita), y **nombre** opcional y editable (sin él se muestra el código); el área solo tiene nombre. **Nombres únicos (AC2):** el de la unidad, si lo tiene, y el del área dentro de su subdivisión (025, sin distinguir mayúsculas; `409 NOMBRE_DUPLICADO`). En la base el código vive en `name`/`business_name`, el nombre en `display_name` y `structure_code_counters` (023) solo sirve de candado para altas simultáneas. Gerente = Jefe de Auditoría activo; escriben Administrador y Jefe de Auditoría. Periodos = los cuatro trimestres de cada año ("2026 T1", con T de trimestre; 035 renombró los "2026 Q1") más el año fiscal ("2026 Fiscal"), uno activo; se crean con un botón por año y se activan desde el Catálogo (insignia del encabezado), y la unidad conserva el de su alta. **Auditoría activa** = engagement de un plan `Aprobado` o `En Ejecución` en la rama, y bloquea el borrado; tampoco se borra un nodo con hijos o una subdivisión con riesgos (sin cascada). Los riesgos cuelgan de la subdivisión y son de solo lectura. El Catálogo es un explorador de dos paneles: árbol de navegación (unidad › división › subdivisión, sin áreas ni riesgos) y panel de detalle (resumen de unidades, indicadores, lista de hijos y, en la subdivisión, pestañas de riesgos y áreas). Los datos de prueba se generan del Consolidado (anonimizado). Detalle en `docs/diseno/estructura-organizacional.md`.
- **Catálogos de área y país (SF-03, 2026-11-03):** el nombre del área y el país o región de la subdivisión solo aceptan opciones de la tabla `structure_options` (034), que **solo el Administrador** edita en Ajustes (`CatalogosEstructuraSection`, rutas `/api/catalogos/:tipo`). Sin texto libre: el backend responde `400 OPCION_NO_VALIDA` y guarda la grafía del catálogo. Renombrar propaga el cambio a la estructura; una opción en uso no se elimina (`409 OPCION_EN_USO`). El país sigue siendo opcional. Bitácora `catalogo.alta|edicion|baja`. Los nombres de unidad, división y subdivisión siguen siendo texto libre.
- **Fusión del sprint 3 (2026-11-05):** se unieron la evaluación de controles y la edición de Excel con el flujo de aprobación. El hallazgo que nace de una evaluación con deficiencia usa el formulario del detalle del control, con vulnerabilidad alta. El botón "Nuevo hallazgo" de `VistaHallazgo` (equipo de auditoría) ofrece los controles de `GET /controles/para-hallazgo`, uno por plan, y guarda el plan real; el Administrador no tiene asignaciones y no recibe controles. `repos/evidenciasAcceso.ts` repite la regla de `GET /evidencias`, que conserva su propia consulta: un cambio a la regla debe hacerse en ambos. Guardar una versión de Excel en un paso respeta el bloqueo del plan (`409 PLAN_BLOQUEADO`).
- **Asistente de IA (historia #105, tasks #134/#135, SF-19):** el backend es el único que habla con la IA (Copilot API Gateway del SRS); la clave vive en `backend/.env` y nunca llega al frontend. El proveedor queda detrás de la interfaz `ProveedorIA` y se elige con `IA_PROVEEDOR` (`gemini`, `azure` o `ninguno`; sin proveedor la plataforma funciona y la función queda desactivada). Llamadas sin reintentos y con tiempo de espera (`IA_TIEMPO_ESPERA_MS`); cualquier falla responde 503 y el frontend desactiva el panel con un aviso. Rutas `/api/asistente/estado`, `/asistente/evidencias/:id/resumen`, `/asistente/evidencias/:id/preguntas` y `/asistente/consultas` (datos de la vista; acepta hasta 100 kB), para Administrador, Jefe de Auditoría, Auditor Senior y Auditor. Bitácora: `asistente.resumen`, `asistente.pregunta` y `asistente.consulta`, sin guardar preguntas ni respuestas.
- **Edición de Excel en la plataforma (UF-17, SF-08, 2026-10-23):** editor propio (sin librería de hoja de cálculo) con `exceljs` en el frontend solo para leer/escribir `.xlsx`. Lógica pura en `src/app/domain/hoja/` (fórmulas en español e inglés; en el archivo se guardan en inglés con su resultado), vista en `components/hoja/`. Guardar crea una **versión nueva** de la evidencia (no sobrescribe): `POST /api/evidencias/:id/versiones` calcula el SHA-256 en el servidor, guarda el archivo como `EV-…-vN.xlsx`, lo anota en `evidence_versions` (048) y deja la fila de `evidence` apuntando a la versión vigente; `GET …/archivo` entrega el binario y `GET …/versiones` el historial (reglas de acceso en `docs/diseno/edicion-excel.md`). Sin permiso para subir evidencia se abre en solo lectura. Lo que `exceljs` no conserva (celdas combinadas, imágenes, validaciones, formato condicional, gráficos) se avisa al abrir. **Macros (historia #106):** se acepta `.xlsm`; el editor detecta `xl/vbaProject.bin`, avisa que las macros no son compatibles, muestra el resto y la versión guardada sale como `.xlsx`.
- **Reglas de contención de la IA:** instrucciones del sistema en `backend/src/asistente/instrucciones.ts`; el documento o los datos de la vista van delimitados y se tratan como datos, no instrucciones; temperatura 0.2 y tope de longitud; cada pregunta es independiente (sin historial); pregunta de 5 a 500 caracteres. La IA responde un JSON con `estado` (`respondida`, `fuera_de_tema`, `sin_informacion`) y el backend sustituye los dos últimos por mensajes fijos. Cualquier cambio a las reglas debe pasar `corepack pnpm ia:evaluar` (22/22 al 2026-10-09).
- **Evaluación de controles (historia #98, SF-07, 2026-11-02):** una evaluación por control y plan; evalúa el auditor asignado, con declaración de conflictos y la asignación en `En Progreso`. La calificación la calcula siempre el backend (`backend/src/domain/evaluaciones.ts`). El resultado (`control_evaluations.result`) es independiente del flujo de revisión (`audit_controls.status`).
- **Memoria y contexto del asistente (UF-16, SF-19):** al expandir un hallazgo, el Copilot conversa sobre él. El navegador solo manda el id. El backend arma el expediente desde la base: hallazgo, responsable, plan de acción, auditoría, control y las evidencias **que el usuario puede ver**, cuyo texto lee de R2 con un tope de 60 000 caracteres repartido entre archivos. La conversación se guarda en `ai_conversations`/`ai_messages` (049), **privada de cada usuario**, y el usuario la puede borrar ("Nueva conversación"). Al modelo se mandan los últimos 20 mensajes; son contexto, no fuente de datos. Rutas: `GET`/`DELETE /api/asistente/hallazgos/:id/conversacion` y `POST /api/asistente/hallazgos/:id/consultas`. La regla de visibilidad de evidencias vive en `backend/src/repos/evidenciasAcceso.ts` y la comparten el listado y el asistente: `/asistente/evidencias/:id` ya no lee archivos ajenos. Bitácora: `asistente.hallazgo` y `asistente.conversacion_borrada`, sin texto. Con Gemini gratuito, las conversaciones guardadas deben ser solo datos de prueba (pendiente 13).
- **Contexto de la IA en Planes de Auditoría (UF-16, SF-19, SF-08):** el backend arma el expediente de un **control dentro de un plan**. Incluye el control (actividad, tipo, frecuencia, `size`, `rotation`), el plan (código, nombre, periodo, alcance, responsable), las asignaciones visibles (misma regla que `GET /planes/:id/controles`: horas, estado, retroalimentación, conflicto de interés), los hallazgos con ese `controlId` (no se filtran por plan) y las evidencias visibles (`condicionControlVisible`), leídas de R2.
  - **"Analizar con IA" de un archivo:** usa `/api/asistente/evidencias/:id/conversacion|consultas`. El archivo es el documento principal y el contexto es su control y plan (o su hallazgo), con las demás evidencias solo por nombre. Tiene memoria por usuario y archivo, y el botón **"Validar contra el control"** (`accion: "validar"`, solo para evidencias de control, se ejecuta solo a petición).
  - **Copilot y tarjeta "Resumen IA" del control:** usan `/api/asistente/planes/:planId/controles/:controlId/...`, con memoria por usuario, plan y control (migración 050).
  - **Detalle del control:** muestra solo datos reales. Se quitaron la muestra "30", la rotación "Semanal", la entidad de relleno, la insignia "Vigente" y los procedimientos de mock; se agregó la tarjeta del plan.
  - Las rutas viejas `/asistente/evidencias/:id/resumen|preguntas` se conservan pero ya no las usa el panel.

## 8. Referencias

- `Visión y Alcance Sistema Auditoría.md` — visión, situación actual, alcance y requerimientos de FEMSA.
- `XPDN- DocumentoSRS.md` — SRS del proyecto, con el texto de los requisitos UF-xx y SF-xx. Sin versionar.
- Diseño original en Figma: https://www.figma.com/design/81zRCWhIiue8fy0HTI3WPN/Expedite-GRC
- Curso: diapositivas "Ingeniería de Requisitos Parte 4" (FIng-CETP) — estructura del SRS y checklist de defectos.
