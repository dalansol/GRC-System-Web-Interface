import type {
  // Types
  DetailType,
  StatusKey,
  NavView,
  View,
  Navigate,
  // Interfaces
  Task,
  NavItem,
  GeneralRisk,
  AuditEntity,
  SpecificRisk,
  ControlRecord,
  ProcedureTracking,
  PlanEntity,
  AuditPlan,
  BilacoraEntry,
  ActionPlan,
  Finding,
} from "../components/SharedComponents";

export {INITIAL_FINDINGS, CONTROLS};


// ─── Findings (Hallazgos) Data ─────────────────────────────────────────────────
const INITIAL_FINDINGS: Finding[] = [
  {
    id: "FND-001", folio: "HAL-2025-001",
    title: "Segregación de funciones insuficiente en cierre contable",
    severity: "Crítico", failedControl: "Segregación de Funciones — Cierre Contable", failedControlId: "CTR-002",
    residualRisk: "Alto", status: "Asignado", auditId: "AUD-001", date: "2025-07-10",
    actionPlan: { description: "Revisar y reasignar roles en SAP para eliminar conflictos de acceso. Implementar aprobación dual en todas las conciliaciones.", responsible: "Carlos Morales — Finanzas Corporativas", dueDate: "2025-09-15", status: "Asignado" },
  },
  {
    id: "FND-002", folio: "HAL-2025-002",
    title: "Cuentas privilegiadas de ex-empleados activas en producción",
    severity: "Alto", failedControl: "Revisión de Accesos Privilegiados", failedControlId: "CTR-003",
    residualRisk: "Alto", status: "En Revisión", auditId: "AUD-001", date: "2025-07-14",
  },
  {
    id: "FND-003", folio: "HAL-2025-003",
    title: "Calendario normativo desactualizado — SFC Colombia",
    severity: "Medio", failedControl: "Monitoreo de Obligaciones Regulatorias", failedControlId: "CTR-004",
    residualRisk: "Medio", status: "Abierto", auditId: "AUD-003", date: "2025-07-18",
  },
  {
    id: "FND-004", folio: "HAL-2025-004",
    title: "Firewall con configuración obsoleta — Oficina Colombia",
    severity: "Alto", failedControl: "Revisión de Accesos Privilegiados", failedControlId: "CTR-003",
    residualRisk: "Alto", status: "Abierto", auditId: "AUD-002", date: "2025-07-20",
  },
  {
    id: "FND-005", folio: "HAL-2024-018",
    title: "Proceso de nómina sin doble aprobación — Operaciones",
    severity: "Bajo", failedControl: "Conciliación Bancaria Mensual", failedControlId: "CTR-001",
    residualRisk: "Bajo", status: "Cerrado", auditId: "AUD-004", date: "2024-11-05",
  },
];



const TASKS: Task[] = [
  {
    id: "T-0041",
    name: "Revisión controles SOX — Cuentas por pagar",
    status: "overdue",
    dueDate: "2025-07-15",
    owner: "M. García",
    type: "Auditoría Financiera",
  },
  {
    id: "T-0042",
    name: "Entrevista CISO — Políticas de acceso",
    status: "in_progress",
    dueDate: "2025-07-22",
    owner: "L. Herrera",
    type: "TI & Seguridad",
  },
  {
    id: "T-0043",
    name: "Pruebas sustantivas — Inventarios Q2",
    status: "in_progress",
    dueDate: "2025-07-28",
    owner: "P. Morales",
    type: "Auditoría Operacional",
  },
  {
    id: "T-0044",
    name: "Cierre hallazgos — Filial Brasil",
    status: "pending",
    dueDate: "2025-08-05",
    owner: "A. Costa",
    type: "Cumplimiento",
  },
  {
    id: "T-0045",
    name: "Informe ejecutivo — Riesgo regulatorio LATAM",
    status: "pending",
    dueDate: "2025-08-12",
    owner: "M. García",
    type: "Regulatorio",
  },
  {
    id: "T-0046",
    name: "Walkthrough — Proceso nómina México",
    status: "completed",
    dueDate: "2025-07-10",
    owner: "R. Jiménez",
    type: "Auditoría Operacional",
  },
];

const QUARTERLY_DATA = [
  {
    quarter: "Q1 2025",
    completadas: 8,
    en_progreso: 3,
    pendientes: 2,
    vencidas: 1,
  },
  {
    quarter: "Q2 2025",
    completadas: 11,
    en_progreso: 4,
    pendientes: 3,
    vencidas: 2,
  },
  {
    quarter: "Q3 2025",
    completadas: 5,
    en_progreso: 7,
    pendientes: 5,
    vencidas: 3,
  },
  {
    quarter: "Q4 2025",
    completadas: 0,
    en_progreso: 2,
    pendientes: 9,
    vencidas: 0,
  },
];

const VERTICAL_DATA = [
  { name: "TI & Ciberseg.", mx: 4, br: 3, co: 2 },
  { name: "Financiero", mx: 6, br: 5, co: 3 },
  { name: "Operacional", mx: 5, br: 4, co: 4 },
  { name: "Regulatorio", mx: 3, br: 2, co: 1 },
  { name: "Cumplimiento", mx: 4, br: 3, co: 2 },
];

const CHART_COLORS = {
  completadas: "#16a34a",
  en_progreso: "#d97706",
  pendientes: "#2B6FD4",
  vencidas: "#C8271C",
};

// ─── GRC Data ────────────────────────────────────────────────────────────────
const GENERAL_RISKS: GeneralRisk[] = [
  {
    id: "GR-001",
    name: "Integridad de Reportes Financieros",
    auditDepartment: "Beverage",
    description:
      "Riesgo de que los estados financieros consolidados contengan errores materiales derivados de debilidades en los controles del proceso de cierre contable mensual, incluyendo conciliaciones, segregación de funciones y aprobaciones por niveles directivos.",
  },
  {
    id: "GR-002",
    name: "Acceso No Autorizado a Sistemas Críticos",
    auditDepartment: "Beverage",
    description:
      "Riesgo de que usuarios internos o externos no autorizados accedan a sistemas críticos de información, comprometiendo la confidencialidad, integridad y disponibilidad de los datos operativos y financieros del grupo.",
  },
  {
    id: "GR-003",
    name: "Incumplimiento Normativo Regulatorio",
    auditDepartment: "Beverage",
    description:
      "Riesgo de incumplimiento de regulaciones locales e internacionales aplicables a las operaciones del grupo en los mercados LATAM, incluyendo normativas fiscales, de protección de datos y de reporte a organismos reguladores.",
  },
];

const AUDIT_ENTITIES: AuditEntity[] = [
  {
    id: "AE-001",
    name: "Entidad Auditora — Cierre Financiero MX",
    auditDepartment: "Beverage",
    auditDomain: "Integridad Financiera",
    divisionName: "Norteamérica",
    country: "México",
  },
  {
    id: "AE-002",
    name: "Entidad Auditora — Ciberseguridad LATAM",
    auditDepartment: "Beverage",
    auditDomain: "TI & Ciberseguridad",
    divisionName: "Sudamérica",
    country: "Brasil",
  },
  {
    id: "AE-003",
    name: "Entidad Auditora — Cumplimiento Normativo",
    auditDepartment: "Beverage",
    auditDomain: "Cumplimiento Regulatorio",
    divisionName: "Sudamérica",
    country: "Colombia",
  },
];

const SPECIFIC_RISKS: SpecificRisk[] = [
  {
    id: "SR-001",
    generalRiskId: "GR-001",
    auditEntityId: "AE-001",
    inherentRiskLevel: "Crítico",
    residualRiskLevel: "Alto",
    businessDeptName: "Finanzas",
    businessName: "Banca Corporativa",
    divisionName: "Norteamérica",
    country: "México",
    description:
      "Posibilidad de que las conciliaciones bancarias del proceso de cierre mensual en la filial México contengan discrepancias no detectadas a tiempo debido a la falta de segregación de funciones entre quien registra y quien aprueba.",
  },
  {
    id: "SR-002",
    generalRiskId: "GR-001",
    auditEntityId: "AE-001",
    inherentRiskLevel: "Alto",
    residualRiskLevel: "Medio",
    businessDeptName: "Tesorería",
    businessName: "Banca Corporativa",
    divisionName: "Norteamérica",
    country: "México",
    description:
      "Riesgo de que transacciones de tesorería de alto valor sean registradas sin autorización dual, permitiendo errores o fraudes que impacten el estado de resultados consolidado.",
  },
  {
    id: "SR-003",
    generalRiskId: "GR-002",
    auditEntityId: "AE-002",
    inherentRiskLevel: "Alto",
    residualRiskLevel: "Alto",
    businessDeptName: "Tecnología",
    businessName: "Infraestructura TI",
    divisionName: "Sudamérica",
    country: "Brasil",
    description:
      "Riesgo de que cuentas con privilegios administrativos en sistemas críticos no sean revisadas con la frecuencia requerida, permitiendo que ex-empleados o accesos no autorizados persistan activos en producción.",
  },
  {
    id: "SR-004",
    generalRiskId: "GR-003",
    auditEntityId: "AE-003",
    inherentRiskLevel: "Medio",
    residualRiskLevel: "Bajo",
    businessDeptName: "Legal & Cumplimiento",
    businessName: "Cumplimiento Corporativo",
    divisionName: "Sudamérica",
    country: "Colombia",
    description:
      "Riesgo de incumplimiento de obligaciones de reporte ante la Superintendencia Financiera de Colombia por desactualización del calendario regulatorio y falta de seguimiento formal de compromisos.",
  },
];

const CONTROLS: ControlRecord[] = [
  {
    id: "CTR-001",
    auditEntityId: "AE-001",
    specificRiskIds: ["SR-001"],
    controlProcedureName: "Conciliación Bancaria Mensual",
    validityStatus: "Válido",
    businessControlNumber: "BC-0041",
    controlActivity:
      "Revisión y aprobación formal de conciliaciones bancarias al cierre de cada mes por el Director Financiero y el Controller.",
    currentVulnerability: "Baja",
    controlType: "Preventivo",
    frequency: "Mensual",
    sampleSize: "100%",
    rotation: "No Aplica",
    controlStatus: "Activo",
  },
  {
    id: "CTR-002",
    auditEntityId: "AE-001",
    specificRiskIds: ["SR-001", "SR-002"],
    controlProcedureName:
      "Segregación de Funciones — Cierre Contable",
    validityStatus: "Requiere Revisión",
    businessControlNumber: "BC-0042",
    controlActivity:
      "Verificación semestral de que ningún usuario tiene acceso simultáneo a funciones de registro y autorización en el sistema ERP.",
    currentVulnerability: "Media",
    controlType: "Detectivo",
    frequency: "Semestral",
    sampleSize: "25 usuarios",
    rotation: "Anual",
    controlStatus: "Activo",
  },
  {
    id: "CTR-003",
    auditEntityId: "AE-002",
    specificRiskIds: ["SR-003"],
    controlProcedureName: "Revisión de Accesos Privilegiados",
    validityStatus: "Válido",
    businessControlNumber: "BC-0055",
    controlActivity:
      "Revisión trimestral de cuentas con privilegios administrativos en sistemas de producción y depuración de accesos inactivos.",
    currentVulnerability: "Baja",
    controlType: "Detectivo",
    frequency: "Trimestral",
    sampleSize: "100%",
    rotation: "Semestral",
    controlStatus: "Activo",
  },
  {
    id: "CTR-004",
    auditEntityId: "AE-003",
    specificRiskIds: ["SR-004"],
    controlProcedureName:
      "Monitoreo de Obligaciones Regulatorias",
    validityStatus: "Válido",
    businessControlNumber: "BC-0071",
    controlActivity:
      "Seguimiento mensual del calendario de obligaciones regulatorias y generación de alertas ante vencimientos próximos.",
    currentVulnerability: "Baja",
    controlType: "Preventivo",
    frequency: "Mensual",
    sampleSize: "N/A",
    rotation: "No Aplica",
    controlStatus: "Activo",
  },
];

const PROCEDURE_TRACKING: ProcedureTracking[] = [
  {
    id: "PT-001",
    controlId: "CTR-001",
    procedureName: "Verificación de saldos bancarios",
    identificator: "VER-BAN-001",
    businessDeptName: "Finanzas",
    businessName: "Banca Corporativa",
    divisionName: "Norteamérica",
    area: "Contabilidad",
    country: "México",
  },
  {
    id: "PT-002",
    controlId: "CTR-001",
    procedureName: "Aprobación por Director Financiero",
    identificator: "APR-DIR-001",
    businessDeptName: "Finanzas",
    businessName: "Banca Corporativa",
    divisionName: "Norteamérica",
    area: "Dirección Financiera",
    country: "México",
  },
  {
    id: "PT-003",
    controlId: "CTR-001",
    procedureName: "Carga en sistema ERP (SAP)",
    identificator: "ERP-CAR-001",
    businessDeptName: "Finanzas",
    businessName: "Banca Corporativa",
    divisionName: "Norteamérica",
    area: "Sistemas Financieros",
    country: "México",
  },
  {
    id: "PT-004",
    controlId: "CTR-002",
    procedureName: "Revisión de roles en SAP",
    identificator: "ROL-SAP-001",
    businessDeptName: "Finanzas",
    businessName: "Banca Corporativa",
    divisionName: "Norteamérica",
    area: "Auditoría Interna",
    country: "México",
  },
  {
    id: "PT-005",
    controlId: "CTR-003",
    procedureName: "Extracción de reporte de accesos",
    identificator: "ACC-REP-001",
    businessDeptName: "TI",
    businessName: "Infraestructura TI",
    divisionName: "Sudamérica",
    area: "IAM / Seguridad",
    country: "Brasil",
  },
  {
    id: "PT-006",
    controlId: "CTR-004",
    procedureName: "Actualización calendario normativo",
    identificator: "CAL-NOR-001",
    businessDeptName: "Legal",
    businessName: "Cumpl. Corporativo",
    divisionName: "Sudamérica",
    area: "Cumplimiento",
    country: "Colombia",
  },
];

const PLAN_ENTITIES: PlanEntity[] = [
  {
    id: "PE-001",
    name: "Plan de Auditoría Financiera 2025",
    auditDepartment: "Beverage",
    year: 2025,
    status: "in_progress",
    scope:
      "Cierre contable, conciliaciones y reportes a casa matriz",
  },
  {
    id: "PE-002",
    name: "Plan de Auditoría TI & Ciberseguridad 2025",
    auditDepartment: "Beverage",
    year: 2025,
    status: "pending",
    scope: "Accesos privilegiados, seguridad perimetral y BYOD",
  },
  {
    id: "PE-003",
    name: "Plan de Auditoría Cumplimiento LATAM 2025",
    auditDepartment: "Beverage",
    year: 2025,
    status: "pending",
    scope: "Obligaciones regulatorias MX, BR, CO, AR, CL, PE",
  },
];

// ─── Users & Roles Data ──────────────────────────────────────────────────────
interface UserRecord {
  id: string; name: string; email: string;
  role: string; status: "active" | "inactive"; lastLogin: string;
}

const ROLES = ["Administrador", "Jefe de Auditoría", "Auditor Senior", "Auditor", "Consultor", "Solo Lectura"];

const DEFAULT_PERMISSIONS: Record<string, Record<string, boolean>> = {
  "Administrador":      { "Ver Dashboard": true,  "Editar Registros": true,  "Gestionar Usuarios": true,  "Aprobar Riesgos": true,  "Exportar Datos": true,  "Ver Auditorías": true,  "Crear Auditorías": true,  "Eliminar Registros": true  },
  "Jefe de Auditoría":  { "Ver Dashboard": true,  "Editar Registros": true,  "Gestionar Usuarios": false, "Aprobar Riesgos": true,  "Exportar Datos": true,  "Ver Auditorías": true,  "Crear Auditorías": true,  "Eliminar Registros": false },
  "Auditor Senior":     { "Ver Dashboard": true,  "Editar Registros": true,  "Gestionar Usuarios": false, "Aprobar Riesgos": false, "Exportar Datos": true,  "Ver Auditorías": true,  "Crear Auditorías": false, "Eliminar Registros": false },
  "Auditor":            { "Ver Dashboard": true,  "Editar Registros": false, "Gestionar Usuarios": false, "Aprobar Riesgos": false, "Exportar Datos": false, "Ver Auditorías": true,  "Crear Auditorías": false, "Eliminar Registros": false },
  "Consultor":          { "Ver Dashboard": true,  "Editar Registros": false, "Gestionar Usuarios": false, "Aprobar Riesgos": false, "Exportar Datos": false, "Ver Auditorías": true,  "Crear Auditorías": false, "Eliminar Registros": false },
  "Solo Lectura":       { "Ver Dashboard": true,  "Editar Registros": false, "Gestionar Usuarios": false, "Aprobar Riesgos": false, "Exportar Datos": false, "Ver Auditorías": true,  "Crear Auditorías": false, "Eliminar Registros": false },
};

const INITIAL_USERS: UserRecord[] = [
  { id: "USR-001", name: "María García",      email: "m.garcia@expedite.com",    role: "Jefe de Auditoría", status: "active",   lastLogin: "2025-07-21" },
  { id: "USR-002", name: "Carlos Morales",    email: "c.morales@expedite.com",   role: "Auditor Senior",    status: "active",   lastLogin: "2025-07-20" },
  { id: "USR-003", name: "Ana Rodríguez",     email: "a.rodriguez@expedite.com", role: "Auditor",           status: "active",   lastLogin: "2025-07-19" },
  { id: "USR-004", name: "Pedro Sánchez",     email: "p.sanchez@expedite.com",   role: "Consultor",         status: "inactive", lastLogin: "2025-06-30" },
  { id: "USR-005", name: "Laura Fernández",   email: "l.fernandez@expedite.com", role: "Auditor",           status: "active",   lastLogin: "2025-07-21" },
  { id: "USR-006", name: "Diego Torres",      email: "d.torres@expedite.com",    role: "Solo Lectura",      status: "active",   lastLogin: "2025-07-18" },
];

// ─── Audit Records Data ──────────────────────────────────────────────────────
interface AuditDocument {
  id: string; name: string; type: "pdf" | "docx" | "xlsx" | "pptx"; size: string; date: string;
}
interface AuditRecord {
  id: string; name: string; type: string; status: StatusKey;
  entity: string; responsible: string; startDate: string; endDate: string;
  scope: string; documents: AuditDocument[];
}

const AUDIT_RECORDS: AuditRecord[] = [
  {
    id: "AUD-001", name: "Auditoría SOX — Cuentas por Pagar", type: "Auditoría Financiera",
    status: "in_progress", entity: "Finanzas Corporativas", responsible: "M. García",
    startDate: "2025-06-01", endDate: "2025-08-31",
    scope: "Revisión de controles SOX para el ciclo de cuentas por pagar y tesorería",
    documents: [
      { id: "D-001", name: "Plan de Auditoría SOX 2025.pdf",      type: "pdf",  size: "2.4 MB", date: "2025-06-05" },
      { id: "D-002", name: "Matriz de Riesgos y Controles.xlsx",  type: "xlsx", size: "1.8 MB", date: "2025-06-12" },
      { id: "D-003", name: "Informe Preliminar Q2.docx",          type: "docx", size: "890 KB", date: "2025-07-15" },
      { id: "D-004", name: "Evidencias de Muestreo.pdf",          type: "pdf",  size: "5.1 MB", date: "2025-07-20" },
    ],
  },
  {
    id: "AUD-002", name: "Auditoría Operacional — Cadena de Suministro", type: "Auditoría Operacional",
    status: "completed", entity: "Logística & Supply Chain", responsible: "C. Morales",
    startDate: "2025-03-01", endDate: "2025-05-30",
    scope: "Evaluación de procesos de compra, almacenamiento y distribución en LATAM",
    documents: [
      { id: "D-005", name: "Informe Final Supply Chain.pdf",      type: "pdf",  size: "3.7 MB", date: "2025-05-28" },
      { id: "D-006", name: "Hallazgos y Recomendaciones.docx",    type: "docx", size: "1.2 MB", date: "2025-05-29" },
      { id: "D-007", name: "Dashboard KPIs Logística.xlsx",       type: "xlsx", size: "2.1 MB", date: "2025-04-15" },
      { id: "D-008", name: "Presentación Resultados.pptx",        type: "pptx", size: "4.3 MB", date: "2025-05-30" },
    ],
  },
  {
    id: "AUD-003", name: "Auditoría de Cumplimiento — GDPR", type: "Auditoría de Cumplimiento",
    status: "pending", entity: "Tecnología & Datos", responsible: "A. Rodríguez",
    startDate: "2025-09-01", endDate: "2025-11-30",
    scope: "Revisión del cumplimiento normativo GDPR en sistemas de tratamiento y almacenamiento de datos",
    documents: [
      { id: "D-009", name: "Programa de Auditoría GDPR.pdf",      type: "pdf",  size: "1.1 MB", date: "2025-08-20" },
      { id: "D-010", name: "Cuestionario de Evaluación.docx",     type: "docx", size: "450 KB", date: "2025-08-22" },
    ],
  },
  {
    id: "AUD-004", name: "Auditoría Interna — Recursos Humanos", type: "Auditoría Interna",
    status: "overdue", entity: "Recursos Humanos", responsible: "L. Fernández",
    startDate: "2025-04-01", endDate: "2025-06-30",
    scope: "Revisión de procesos de contratación, nómina y evaluación del desempeño",
    documents: [
      { id: "D-011", name: "Plan de Trabajo RRHH.pdf",            type: "pdf",  size: "780 KB", date: "2025-04-03" },
      { id: "D-012", name: "Análisis Nómina Q1 2025.xlsx",        type: "xlsx", size: "3.2 MB", date: "2025-04-20" },
      { id: "D-013", name: "Entrevistas y Observaciones.docx",    type: "docx", size: "1.5 MB", date: "2025-05-10" },
    ],
  },
];

// ─── Audit Plans Data ─────────────────────────────────────────────────────────
const AUDIT_PLANS_DATA: AuditPlan[] = [
  { id: "AP-001", code: "PAI-2025-001", name: "Plan Auditoría Financiera LATAM", period: "Q1–Q2 2025", startDate: "2025-01-15", endDate: "2025-06-30", status: "Aprobado", estimatedHours: 320, responsible: "M. García", scope: "Cierre contable, conciliaciones bancarias y reportes a casa matriz en MX, BR, CO" },
  { id: "AP-002", code: "PAI-2025-002", name: "Plan Auditoría TI & Ciberseguridad", period: "Q2–Q3 2025", startDate: "2025-04-01", endDate: "2025-09-30", status: "En Ejecución", estimatedHours: 240, responsible: "C. Morales", scope: "Accesos privilegiados, seguridad perimetral, revisión de vulnerabilidades" },
  { id: "AP-003", code: "PAI-2025-003", name: "Plan Auditoría Cumplimiento Regulatorio", period: "Q3–Q4 2025", startDate: "2025-07-01", endDate: "2025-12-31", status: "Borrador", estimatedHours: 180, responsible: "A. Rodríguez", scope: "Obligaciones regulatorias GDPR, SUNAT, Superintendencia Financiera Colombia" },
  { id: "AP-004", code: "PAI-2024-012", name: "Plan Auditoría Operacional LATAM", period: "Q4 2024", startDate: "2024-10-01", endDate: "2024-12-31", status: "Cerrado", estimatedHours: 290, responsible: "M. García", scope: "Cadena de suministro, logística y distribución en toda la región" },
];





// ─── Bitácora Data ─────────────────────────────────────────────────────────────
const BITACORA_DATA: BilacoraEntry[] = [
  // Hoy (2026-09-10)
  { id: "BIT-001", user: "María García",    action: "Aprobó plan de auditoría",   entity: "PAI-2026-003",           entityId: "AP-003",   date: "2026-09-10 09:14" },
  { id: "BIT-002", user: "Carlos Morales",  action: "Cargó evidencia",            entity: "CTR-003",                entityId: "CTR-003",  date: "2026-09-10 11:40" },
  { id: "BIT-003", user: "Ana Rodríguez",   action: "Creó hallazgo",              entity: "HAL-2026-007",           entityId: "FND-007",  date: "2026-09-10 14:55" },
  // Últimos 7 días (2026-09-04 – 2026-09-09)
  { id: "BIT-004", user: "Laura Fernández", action: "Modificó control",           entity: "CTR-004",                entityId: "CTR-004",  date: "2026-09-09 10:22" },
  { id: "BIT-005", user: "Diego Torres",    action: "Consultó hallazgo",          entity: "HAL-2026-005",           entityId: "FND-005",  date: "2026-09-08 16:05" },
  { id: "BIT-006", user: "María García",    action: "Exportó CSV — Riesgos",      entity: "Catálogo Organizacional",entityId: "HIER",     date: "2026-09-07 08:48" },
  { id: "BIT-007", user: "Carlos Morales",  action: "Creó plan de auditoría",     entity: "PAI-2026-004",           entityId: "AP-004",   date: "2026-09-05 13:30" },
  // Últimos 30 días, fuera de últimos 7 (2026-08-11 – 2026-09-03)
  { id: "BIT-008", user: "Ana Rodríguez",   action: "Cargó evidencia",            entity: "HAL-2026-004",           entityId: "FND-004",  date: "2026-09-01 15:10" },
  { id: "BIT-009", user: "Laura Fernández", action: "Modificó permisos de rol",   entity: "Auditor Senior",         entityId: "ROLE-003", date: "2026-08-27 09:55" },
  { id: "BIT-010", user: "Diego Torres",    action: "Aprobó hallazgo",            entity: "HAL-2026-003",           entityId: "FND-003",  date: "2026-08-20 11:18" },
  { id: "BIT-011", user: "Carlos Morales",  action: "Exportó PDF — Informe Q2",   entity: "Dashboard",              entityId: "DASH",     date: "2026-08-15 14:40" },
  // Anteriores (más de 30 días)
  { id: "BIT-012", user: "María García",    action: "Marcó riesgo como completado",entity: "RIE-0187",              entityId: "RIE-0187", date: "2026-07-30 10:05" },
  { id: "BIT-013", user: "Ana Rodríguez",   action: "Consultó catálogo",          entity: "Catálogo Organizacional",entityId: "HIER",     date: "2026-07-18 16:33" },
  { id: "BIT-014", user: "Laura Fernández", action: "Creó riesgo específico",     entity: "RIE-0201",               entityId: "RIE-0201", date: "2026-07-05 08:20" },
  { id: "BIT-015", user: "Diego Torres",    action: "Modificó permisos de rol",   entity: "Solo Lectura",           entityId: "ROLE-006", date: "2026-06-22 13:45" },
];