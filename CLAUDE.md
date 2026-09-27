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

- **Frontend-only prototipo** exportado desde Figma Make ("Expedite GRC"). Aún **no hay backend**; todos los datos son mocks en memoria.
- React 18 + TypeScript + **Vite 6**, Tailwind CSS v4 (`@tailwindcss/vite`), componentes **shadcn/ui** (Radix) en `src/app/components/ui/`, iconos `lucide-react`, gráficas `recharts`, toasts `sonner`, también MUI instalado.
- Comandos: `npm i`, `npm run dev`, `npm run build`. No hay tests ni linter configurados.
- Alias `@` → `src/`. Plugin `figma:asset/…` → `src/assets/`. **No quitar** los plugins `react()` ni `tailwindcss()` de `vite.config.ts`.

### Estructura

```
src/
  main.tsx
  app/App.tsx              ← TODA la app (~7,100 líneas): tipos, mocks, vistas, componentes
  app/components/ui/       ← shadcn/ui (no editar salvo necesidad)
  app/components/figma/    ← ImageWithFallback
  imports/logo.svg         ← logo Expedite
  styles/theme.css         ← tokens de diseño (colores, radios, sidebar, charts)
```

Nota: en la rama `Version-2` se eliminaron `src/app/views/*` y `components/shared/SharedComponents.tsx`; todo vive ahora en `App.tsx`.

### Mapa de `App.tsx` (buscar por nombre, las líneas cambian)

- **Tipos:** `NavView` (`dashboard | filter | editor | hierarchy | settings | users | plans | findings | auditado | bitacora`), `DetailType`, `StatusKey`, `AuditEntity`, `GeneralRisk`, `SpecificRisk`, `ControlRecord`, `AuditPlan`, `Finding`, `ActionPlan`, `EvidenceFile`, `BilacoraEntry`, `UserRecord`, `Xlsx*`.
- **Mocks/constantes:** `STATUS_CONFIG`, `NAV_ITEMS`, `TASKS`, `GENERAL_RISKS`, `AUDIT_ENTITIES`, `SPECIFIC_RISKS`, `CONTROLS`, `PROCEDURE_TRACKING`, `ROLES`, `DEFAULT_PERMISSIONS`, `INITIAL_USERS`, `AUDIT_RECORDS`, `AUDIT_PLANS_DATA`, `INITIAL_FINDINGS`, `INITIAL_EVIDENCES`, `BITACORA_DATA`.
- **Componentes base:** `StatusBadge`, `Breadcrumbs`, `PageHeader`, `Card`, `PrimaryBtn`, `GhostBtn`, `Sidebar`, `TopBar`, `PDFPreviewModal`, `exportToCSV`.
- **Vistas:** `DashboardView`, `FilterView`, `EditorView`, `HierarchyView` (Catálogo), `SettingsView`, `BitacoraView`, `UsersRolesView`, `AuditPlansView`, `FindingsView`, `AuditadoPortalView`, vistas de detalle (`GeneralRiskDetailView`, `SpecificRiskDetailView`, `AuditEntityDetailView`, `ControlDetailView`).
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

## 8. Referencias

- `Visión y Alcance Sistema Auditoría.md` — visión, situación actual, alcance y requerimientos de FEMSA.
- Diseño original en Figma: https://www.figma.com/design/81zRCWhIiue8fy0HTI3WPN/Expedite-GRC
- Curso: diapositivas "Ingeniería de Requisitos Parte 4" (FIng-CETP) — estructura del SRS y checklist de defectos.
