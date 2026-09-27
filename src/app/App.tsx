import React, { useState, useEffect, useRef } from "react";
import {
  LayoutDashboard,
  Shield,
  ClipboardList,
  GitBranch,
  Settings,
  Bell,
  ChevronRight,
  ChevronDown,
  Search,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Circle,
  BarChart3,
  Users,
  FileText,
  Plus,
  Undo2,
  GripVertical,
  X,
  Sparkles,
  Filter,
  ChevronUp,
  ArrowRight,
  Loader2,
  Check,
  Building2,
  TrendingUp,
  PieChart,
  CalendarDays,
  ListTodo,
  Timer,
  RefreshCw,
  Save,
  Eye,
  Layers,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Palette,
  Maximize2,
  SlidersHorizontal,
  ClipboardCheck,
  ShieldAlert,
  MoreVertical,
  Trash2,
  Pencil,
  FileSpreadsheet,
  Lock,
  Download,
  MessageSquare,
  Send,
  HelpCircle,
  UploadCloud,
  BookOpen,
  UserCheck,
  Hash,
  ChevronLeft,
  Flag,
  FileCheck2,
  Ban,
  Activity,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { toast, Toaster } from "sonner";

// ─── Types ──────────────────────────────────────────────────────────────────
type NavView =
  "dashboard" | "filter" | "editor" | "hierarchy" | "settings" | "users"
  | "plans" | "findings" | "auditado" | "bitacora";
type DetailType =
  "general_risk" | "specific_risk" | "audit_entity" | "control";
type View = NavView; // alias kept for existing components
type StatusKey =
  "completed" | "in_progress" | "overdue" | "pending";

interface Task {
  id: string;
  name: string;
  status: StatusKey;
  dueDate: string;
  owner: string;
  type: string;
}

interface NavItem {
  id: NavView;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

// ─── Data Interfaces ─────────────────────────────────────────────────────────
interface GeneralRisk {
  id: string;
  name: string;
  description: string;
  auditDepartment: string;
}
interface AuditEntity {
  id: string;
  name: string;
  auditDepartment: string;
  auditDomain: string;
  divisionName: string;
  country: string;
}
interface SpecificRisk {
  id: string;
  generalRiskId: string;
  auditEntityId: string;
  inherentRiskLevel: string;
  residualRiskLevel: string;
  businessDeptName: string;
  businessName: string;
  divisionName: string;
  country: string;
  description: string;
}
interface ControlRecord {
  id: string;
  auditEntityId: string;
  specificRiskIds: string[];
  controlProcedureName: string;
  validityStatus: string;
  businessControlNumber: string;
  controlActivity: string;
  currentVulnerability: string;
  controlType: string;
  frequency: string;
  sampleSize: string;
  rotation: string;
  controlStatus: string;
}
interface ProcedureTracking {
  id: string;
  controlId: string;
  procedureName: string;
  identificator: string;
  businessDeptName: string;
  businessName: string;
  divisionName: string;
  area: string;
  country: string;
}
interface PlanEntity {
  id: string;
  name: string;
  auditDepartment: string;
  year: number;
  status: StatusKey;
  scope: string;
}

interface AuditPlan {
  id: string;
  code: string;
  name: string;
  period: string;
  startDate: string;
  endDate: string;
  status: "Borrador" | "Aprobado" | "En Ejecución" | "Cerrado";
  estimatedHours: number;
  responsible: string;
  scope: string;
}

interface ActionPlan {
  description: string;
  responsible: string;
  dueDate: string;
  status: "Asignado" | "En Progreso" | "Completado";
}

interface Finding {
  id: string;
  folio: string;
  title: string;
  severity: "Crítico" | "Alto" | "Medio" | "Bajo";
  failedControl: string;
  failedControlId: string;
  residualRisk: string;
  status: "Abierto" | "En Revisión" | "Cerrado" | "Asignado";
  actionPlan?: ActionPlan;
  auditId: string;
  date: string;
}

interface EvidenceFile {
  id: string;
  name: string;
  size: string;
  mimeType: string;
  hash: string;
  uploadDate: string;
  uploadedBy: string;
  entityId: string;
  version?: number;
}

interface BilacoraEntry {
  id: string;
  user: string;
  action: string;
  entity: string;
  entityId: string;
  date: string;
}

type CellFormat = "general" | "moneda" | "porcentaje";
type CellAlign  = "left" | "center" | "right";
interface XlsxCell { value: string; bold: boolean; italic: boolean; align: CellAlign; format: CellFormat; }
interface XlsxSheet { name: string; grid: XlsxCell[][]; }
interface XlsxVersionEntry { version: number; author: string; date: string; comment: string; }

// ─── Constants ──────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<
  StatusKey,
  { label: string; color: string; bg: string; dot: string }
> = {
  completed: {
    label: "Completado",
    color: "text-emerald-700",
    bg: "bg-emerald-50 border border-emerald-200",
    dot: "bg-emerald-500",
  },
  in_progress: {
    label: "En Progreso",
    color: "text-amber-700",
    bg: "bg-amber-50 border border-amber-200",
    dot: "bg-amber-500",
  },
  overdue: {
    label: "Vencido",
    color: "text-red-700",
    bg: "bg-red-50 border border-red-200",
    dot: "bg-red-500",
  },
  pending: {
    label: "Pendiente",
    color: "text-slate-600",
    bg: "bg-slate-50 border border-slate-200",
    dot: "bg-slate-400",
  },
};

const NAV_ITEMS: NavItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: <LayoutDashboard size={18} />,
    badge: 3,
  },
  {
    id: "filter",
    label: "Filtrar",
    icon: <SlidersHorizontal size={18} />,
  },
  {
    id: "hierarchy",
    label: "Catálogo",
    icon: <GitBranch size={18} />,
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

// ─── Evidence Files Data ───────────────────────────────────────────────────────
const INITIAL_EVIDENCES: EvidenceFile[] = [
  { id: "EV-001", name: "Conciliacion_Bancaria_Jun2025.xlsx", size: "2.1 MB", mimeType: "xlsx", hash: "sha256:a3f9c12e…4f2a1c0e", uploadDate: "2025-07-12", uploadedBy: "M. García", entityId: "CTR-001" },
  { id: "EV-002", name: "Listado_Accesos_SAP_Q2.pdf", size: "890 KB", mimeType: "pdf", hash: "sha256:b8e4d7c9…e1c8d4b7", uploadDate: "2025-07-15", uploadedBy: "C. Morales", entityId: "CTR-002" },
  { id: "EV-003", name: "Reporte_Accesos_Privilegiados_Jul.pdf", size: "1.4 MB", mimeType: "pdf", hash: "sha256:c9f5e2a8…c1e4f7a0", uploadDate: "2025-07-18", uploadedBy: "L. Fernández", entityId: "CTR-003" },
  { id: "EV-004", name: "Hallazgo_Segregacion_Evidencia.pdf", size: "560 KB", mimeType: "pdf", hash: "sha256:d7a3b9e1…f8c2d5b4", uploadDate: "2025-07-11", uploadedBy: "M. García", entityId: "FND-001" },
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

// ─── CSV Export Utility ────────────────────────────────────────────────────────
function exportToCSV(filename: string, headers: string[], rows: string[][]) {
  const csv = [headers, ...rows]
    .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ─── PDF Preview Modal ───────────────────────────────────────────────────────
interface PDFDoc {
  title: string;
  subtitle: string;
  sections: { heading: string; rows: [string, string][] }[];
}

const PDF_LOGOS = (
  <svg viewBox="0 0 96 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-7 w-auto">
    <rect width="24" height="24" rx="5" fill="#0F4FFF" y="4" />
    <path d="M7 16 L12 10 L17 16" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12 10 L12 22" stroke="white" strokeWidth="2" strokeLinecap="round" />
    <text x="30" y="22" fontFamily="'Plus Jakarta Sans', sans-serif" fontWeight="700" fontSize="13" fill="#0F1B2D">Expedite</text>
    <text x="30" y="32" fontFamily="'Plus Jakarta Sans', sans-serif" fontWeight="400" fontSize="8" fill="#5A6A85">GRC Platform</text>
  </svg>
);

function PDFPreviewModal({ doc, onClose }: { doc: PDFDoc; onClose: () => void }) {
  const today = new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });

  const handleDownload = () => {
    // Simulate download — in production this would call a PDF generation API
    toast.success(`"${doc.title}" descargado correctamente`);
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-background rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col pointer-events-auto"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          onClick={e => e.stopPropagation()}
        >
          {/* Modal chrome */}
          <div className="px-5 py-4 border-b border-border flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-red-50 rounded-lg"><FileText size={15} className="text-red-600" /></div>
              <div>
                <div className="text-sm font-bold text-foreground">Vista previa — PDF</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">Datos simulados · {today}</div>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary transition-colors">
              <X size={16} />
            </button>
          </div>

          {/* PDF preview area */}
          <div className="flex-1 overflow-y-auto px-6 py-5 min-h-0">
            {/* Simulated PDF paper */}
            <div className="bg-white rounded-xl border border-border shadow-sm mx-auto max-w-xl p-8 text-[13px]">
              {/* PDF header */}
              <div className="flex items-start justify-between mb-6 pb-5 border-b-2 border-primary/20">
                <div>
                  {PDF_LOGOS}
                  <div className="text-[10px] text-muted-foreground mt-1 font-mono">expedite-grc.com</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wide font-semibold">Fecha de generación</div>
                  <div className="text-xs font-mono text-foreground mt-0.5">{today}</div>
                  <div className="text-[10px] text-muted-foreground mt-2 uppercase tracking-wide font-semibold">Documento</div>
                  <div className="text-[10px] font-mono text-primary mt-0.5">EXP-{Date.now().toString().slice(-6)}</div>
                </div>
              </div>

              {/* Title block */}
              <div className="mb-6">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-1">Expedite GRC · Informe Oficial</div>
                <h1 className="text-lg font-bold text-foreground leading-snug">{doc.title}</h1>
                <p className="text-xs text-muted-foreground mt-1">{doc.subtitle}</p>
              </div>

              {/* Sections */}
              {doc.sections.map((sec, si) => (
                <div key={si} className={si > 0 ? "mt-5" : ""}>
                  <div className="flex items-center gap-2 mb-2.5">
                    <div className="h-px flex-1 bg-border" />
                    <div className="text-[10px] uppercase tracking-widest font-bold text-primary px-2">{sec.heading}</div>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                  <table className="w-full text-xs">
                    <tbody>
                      {sec.rows.map(([label, value], ri) => (
                        <tr key={ri} className={ri % 2 === 0 ? "bg-secondary/30" : ""}>
                          <td className="py-1.5 px-2 font-semibold text-muted-foreground w-2/5 align-top">{label}</td>
                          <td className="py-1.5 px-2 text-foreground align-top">{value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}

              {/* Footer */}
              <div className="mt-8 pt-4 border-t border-border text-[10px] text-muted-foreground flex items-center justify-between">
                <span>Confidencial — Expedite GRC Platform</span>
                <span className="font-mono">Pág. 1 de 1</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="px-5 py-4 border-t border-border flex items-center gap-3 flex-shrink-0">
            <button
              onClick={handleDownload}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors shadow-sm"
            >
              <Download size={14} /> Descargar PDF
            </button>
            <button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground transition-colors px-2">
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Shared Components ───────────────────────────────────────────────────────
function StatusBadge({ status }: { status: StatusKey }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function Breadcrumbs({ items }: { items: string[] }) {
  return (
    <nav className="flex items-center gap-1 text-xs text-muted-foreground mb-4">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && (
            <ChevronRight
              size={12}
              className="text-muted-foreground/50"
            />
          )}
          <span
            className={
              i === items.length - 1
                ? "text-foreground font-medium"
                : "hover:text-foreground cursor-pointer transition-colors"
            }
          >
            {item}
          </span>
        </span>
      ))}
    </nav>
  );
}

function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="text-xl font-bold text-foreground tracking-tight">
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm text-muted-foreground mt-0.5">
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2">{actions}</div>
      )}
    </div>
  );
}

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-card rounded-lg border border-border shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

function PrimaryBtn({
  children,
  onClick,
  icon,
  small,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  icon?: React.ReactNode;
  small?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 bg-primary text-primary-foreground font-semibold rounded-md hover:bg-primary/90 transition-colors active:scale-[0.98] ${small ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm"}`}
    >
      {icon}
      {children}
    </button>
  );
}

function GhostBtn({
  children,
  onClick,
  icon,
  small,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  icon?: React.ReactNode;
  small?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 bg-transparent text-foreground border border-border font-medium rounded-md hover:bg-secondary transition-colors ${small ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm"}`}
    >
      {icon}
      {children}
    </button>
  );
}

// ─── Sidebar ────────────────────────────────────────────────────────────────
function Sidebar({
  active,
  onNav,
}: {
  active: NavView;
  onNav: (v: NavView) => void;
}) {
  return (
    <aside className="w-56 min-h-screen bg-sidebar flex flex-col flex-shrink-0">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-sidebar-border">
        <div className="flex items-center gap-2.5">
          <svg viewBox="0 0 96 64" xmlns="http://www.w3.org/2000/svg" className="h-7 w-auto flex-shrink-0" fill="none">
            <path d="M6 6 L26 32 L6 58" stroke="white" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M38 6 L58 32 L38 58" stroke="white" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M70 6 L90 32 L70 58" stroke="white" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <div>
            <div className="text-white text-sm font-bold leading-none tracking-wide">
              Expedite
            </div>
            <div className="text-sidebar-foreground/50 text-[10px] mt-0.5 font-mono uppercase tracking-widest">
              GRC v1.0
            </div>
          </div>
        </div>
      </div>

      {/* Role pill */}
      <div className="px-4 py-3 border-b border-sidebar-border">
        <div className="flex items-center gap-2 bg-sidebar-accent rounded-md px-3 py-2">
          <div className="w-6 h-6 rounded-full bg-sidebar-primary flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            MG
          </div>
          <div className="min-w-0">
            <div className="text-white text-xs font-semibold truncate">
              María García
            </div>
            <div className="text-sidebar-foreground/60 text-[10px] truncate">
              Jefatura de Auditoría
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-3 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            id={`tour-nav-${item.id}`}
            onClick={() => onNav(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors text-left ${
              active === item.id
                ? "bg-sidebar-primary text-white"
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-white"
            }`}
          >
            <span className="flex-shrink-0">{item.icon}</span>
            <span className="flex-1">{item.label}</span>
            {item.badge && (
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${active === item.id ? "bg-white/20 text-white" : "bg-red-500 text-white"}`}
              >
                {item.badge}
              </span>
            )}
          </button>
        ))}

        <div className="pt-3 pb-1 px-3">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
            Auditoría
          </div>
        </div>

        {([
          { id: "plans" as NavView, label: "Planes de Auditoría", icon: <BookOpen size={16} /> },
          { id: "findings" as NavView, label: "Hallazgos", icon: <Flag size={16} /> },
          { id: "auditado" as NavView, label: "Portal del Auditado", icon: <UserCheck size={16} /> },
        ] as { id: NavView; label: string; icon: React.ReactNode }[]).map(item => (
          <button
            key={item.id}
            id={`tour-nav-${item.id}`}
            onClick={() => onNav(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors text-left ${
              active === item.id
                ? "bg-sidebar-primary text-white"
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-white"
            }`}
          >
            <span className="flex-shrink-0">{item.icon}</span>
            <span className="flex-1">{item.label}</span>
          </button>
        ))}

        <div className="pt-3 pb-1 px-3">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
            Configuración
          </div>
        </div>

        <button
          id="tour-nav-users"
          onClick={() => onNav("users")}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors text-left ${
            active === "users"
              ? "bg-sidebar-primary text-white"
              : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-white"
          }`}
        >
          <span className="flex-shrink-0"><Users size={16} /></span>
          Usuarios & Roles
        </button>
        <button
          id="tour-nav-bitacora"
          onClick={() => onNav("bitacora")}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors text-left ${
            active === "bitacora"
              ? "bg-sidebar-primary text-white"
              : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-white"
          }`}
        >
          <span className="flex-shrink-0"><Activity size={16} /></span>
          Bitácora
        </button>
        <button
          onClick={() => onNav("settings")}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors text-left ${
            active === "settings"
              ? "bg-sidebar-primary text-white"
              : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-white"
          }`}
        >
          <span className="flex-shrink-0">
            <Settings size={16} />
          </span>
          Ajustes sistema
        </button>
      </nav>

      <div className="px-4 py-3 border-t border-sidebar-border">
        <div className="text-[10px] text-sidebar-foreground/30 text-center font-mono">
          © 2025 Expedite
        </div>
      </div>
    </aside>
  );
}

// ─── Top Bar ────────────────────────────────────────────────────────────────
function TopBar({ viewLabel }: { viewLabel: string }) {
  return (
    <header className="h-12 bg-card border-b border-border flex items-center px-6 gap-4 flex-shrink-0">
      <div className="relative flex-1 max-w-sm">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <input
          placeholder="Buscar auditorías, riesgos, controles…"
          className="w-full bg-input-background text-sm pl-9 pr-3 py-1.5 rounded-md border border-border focus:outline-none focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground"
        />
      </div>
      <div className="flex-1" />
      <div className="flex items-center gap-3">
        <button className="relative p-1.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-secondary transition-colors">
          <Bell size={16} />
          <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-red-500 rounded-full" />
        </button>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarDays size={14} />
          <span className="font-mono text-xs">
            Lun 21 Jul 2025
          </span>
        </div>
      </div>
    </header>
  );
}

// ─── View 1: DASHBOARD ──────────────────────────────────────────────────────
type QuickLink = { label: string; urgency: string; desc: string };

const AUDIT_TYPE_OPTIONS = [
  "Auditoría Financiera",
  "Auditoría Operacional",
  "TI & Ciberseguridad",
  "Cumplimiento Regulatorio",
  "Auditoría de Nómina",
];

const EMPTY_AUDIT_FORM = {
  name: "",
  entityId: "",
  planId: "",
  leadAuditor: "",
  startDate: "",
  endDate: "",
  auditType: "",
};

function DashboardView({
  onNav,
}: {
  onNav: (v: NavView) => void;
}) {
  const [hours, setHours] = useState("");
  const [hourSaved, setHourSaved] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusKey | "all">("all");
  const [showNewAudit, setShowNewAudit] = useState(false);
  const [dashPdfOpen, setDashPdfOpen] = useState(false);
  const [auditForm, setAuditForm] = useState(EMPTY_AUDIT_FORM);
  const [auditErr, setAuditErr] = useState<Record<string, string>>({});
  const [auditCounter, setAuditCounter] = useState(47);
  const [quickLinks, setQuickLinks] = useState<QuickLink[]>([
    { label: "AUD-2025-041 — SOX Financiero",       urgency: "overdue",     desc: "Vencida · Entregable pendiente" },
    { label: "AUD-2025-038 — TI & Ciberseguridad",  urgency: "in_progress", desc: "En progreso · Faltan 6 días"    },
    { label: "AUD-2025-035 — Nómina México",         urgency: "pending",     desc: "Inicio en 12 días"              },
  ]);

  const saveHours = () => {
    if (!hours) return;
    setHourSaved(true);
    setTimeout(() => setHourSaved(false), 2500);
    setHours("");
  };

  const setField = (key: keyof typeof EMPTY_AUDIT_FORM, val: string) => {
    setAuditForm(f => ({ ...f, [key]: val }));
    setAuditErr(e => ({ ...e, [key]: "" }));
  };

  const validateAudit = () => {
    const e: Record<string, string> = {};
    if (!auditForm.name.trim())       e.name        = "Requerido";
    if (!auditForm.entityId)          e.entityId    = "Requerido";
    if (!auditForm.leadAuditor)       e.leadAuditor = "Requerido";
    if (!auditForm.startDate)         e.startDate   = "Requerido";
    if (!auditForm.endDate)           e.endDate     = "Requerido";
    if (auditForm.startDate && auditForm.endDate && auditForm.endDate <= auditForm.startDate)
      e.endDate = "Debe ser posterior a la fecha de inicio";
    return e;
  };

  const handleCreateAudit = () => {
    const errs = validateAudit();
    if (Object.keys(errs).length) { setAuditErr(errs); return; }
    const next = auditCounter + 1;
    setAuditCounter(next);
    const code = `AUD-2025-0${String(next).padStart(2, "0")}`;
    const entity = AUDIT_ENTITIES.find(a => a.id === auditForm.entityId);
    const newLink: QuickLink = {
      label: `${code} — ${auditForm.name}`,
      urgency: "pending",
      desc: `Pendiente · ${entity?.country ?? ""} · Inicio ${auditForm.startDate}`,
    };
    setQuickLinks(prev => [newLink, ...prev]);
    setShowNewAudit(false);
    setAuditForm(EMPTY_AUDIT_FORM);
    setAuditErr({});
    toast.success(`Auditoría ${code} creada correctamente`);
  };

  const filteredTasks =
    statusFilter === "all"
      ? TASKS
      : TASKS.filter((t) => t.status === statusFilter);

  const kpis = [
    { label: "Auditorías Activas",  value: "14",   delta: "+2 vs Q anterior", icon: <ClipboardList size={16} />, color: "text-blue-600 bg-blue-50"     },
    { label: "Hallazgos Abiertos",  value: "38",   delta: "7 críticos",        icon: <AlertTriangle size={16} />, color: "text-red-600 bg-red-50"       },
    { label: "Controles Probados",  value: "127",  delta: "83% aprobados",     icon: <CheckCircle2 size={16} />, color: "text-emerald-600 bg-emerald-50" },
    { label: "Horas Registradas",   value: "342h", delta: "Este mes",          icon: <Timer size={16} />,        color: "text-purple-600 bg-purple-50"  },
  ];

  const activeUsers = INITIAL_USERS.filter(u => u.status === "active");
  const auditPlansAll = AUDIT_PLANS_DATA;

  return (
    <>
    {/* ── Nueva Auditoría Modal ── */}
    {showNewAudit && (
      <>
        <div className="fixed inset-0 bg-black/40 z-40" onClick={() => { setShowNewAudit(false); setAuditErr({}); }} />
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-lg" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            {/* Header */}
            <div className="px-6 pt-5 pb-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-primary/10 rounded-lg"><ClipboardList size={15} className="text-primary" /></div>
                <div>
                  <div className="text-sm font-bold text-foreground">Nueva Auditoría</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">Completa todos los campos requeridos</div>
                </div>
              </div>
              <button onClick={() => { setShowNewAudit(false); setAuditErr({}); }} className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary transition-colors">
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-4">
              {/* Nombre */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">
                  Nombre de la auditoría <span className="text-destructive">*</span>
                </label>
                <input
                  value={auditForm.name}
                  onChange={e => setField("name", e.target.value)}
                  placeholder="Ej. Auditoría Financiera Q4 — Tesorería"
                  className={`w-full text-sm px-3 py-2 rounded-lg border bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 ${auditErr.name ? "border-destructive" : "border-border"}`}
                />
                {auditErr.name && <p className="text-xs text-destructive mt-0.5">{auditErr.name}</p>}
              </div>

              {/* Tipo */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Tipo de auditoría</label>
                <select
                  value={auditForm.auditType}
                  onChange={e => setField("auditType", e.target.value)}
                  className="w-full text-sm px-3 py-2 rounded-lg border border-border bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">— Seleccionar —</option>
                  {AUDIT_TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              {/* Entidad auditable */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">
                  Entidad auditable <span className="text-destructive">*</span>
                </label>
                <select
                  value={auditForm.entityId}
                  onChange={e => setField("entityId", e.target.value)}
                  className={`w-full text-sm px-3 py-2 rounded-lg border bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 ${auditErr.entityId ? "border-destructive" : "border-border"}`}
                >
                  <option value="">— Seleccionar entidad —</option>
                  {AUDIT_ENTITIES.map(ae => (
                    <option key={ae.id} value={ae.id}>{ae.id} — {ae.name.replace("Entidad Auditora — ", "")}</option>
                  ))}
                </select>
                {auditErr.entityId && <p className="text-xs text-destructive mt-0.5">{auditErr.entityId}</p>}
              </div>

              {/* Plan de auditoría */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Plan de auditoría asociado</label>
                <select
                  value={auditForm.planId}
                  onChange={e => setField("planId", e.target.value)}
                  className="w-full text-sm px-3 py-2 rounded-lg border border-border bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">— Sin plan asociado —</option>
                  {auditPlansAll.map(p => (
                    <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
                  ))}
                </select>
              </div>

              {/* Auditor líder */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">
                  Auditor líder <span className="text-destructive">*</span>
                </label>
                <select
                  value={auditForm.leadAuditor}
                  onChange={e => setField("leadAuditor", e.target.value)}
                  className={`w-full text-sm px-3 py-2 rounded-lg border bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 ${auditErr.leadAuditor ? "border-destructive" : "border-border"}`}
                >
                  <option value="">— Seleccionar auditor —</option>
                  {activeUsers.map(u => (
                    <option key={u.id} value={u.name}>{u.name} · {u.role}</option>
                  ))}
                </select>
                {auditErr.leadAuditor && <p className="text-xs text-destructive mt-0.5">{auditErr.leadAuditor}</p>}
              </div>

              {/* Fechas */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">
                    Fecha de inicio <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="date"
                    value={auditForm.startDate}
                    onChange={e => setField("startDate", e.target.value)}
                    className={`w-full text-sm px-3 py-2 rounded-lg border bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 ${auditErr.startDate ? "border-destructive" : "border-border"}`}
                  />
                  {auditErr.startDate && <p className="text-xs text-destructive mt-0.5">{auditErr.startDate}</p>}
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">
                    Fecha de fin <span className="text-destructive">*</span>
                  </label>
                  <input
                    type="date"
                    value={auditForm.endDate}
                    onChange={e => setField("endDate", e.target.value)}
                    className={`w-full text-sm px-3 py-2 rounded-lg border bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 ${auditErr.endDate ? "border-destructive" : "border-border"}`}
                  />
                  {auditErr.endDate && <p className="text-xs text-destructive mt-0.5">{auditErr.endDate}</p>}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 pb-5 flex items-center gap-3">
              <PrimaryBtn icon={<Check size={14} />} onClick={handleCreateAudit}>
                Crear auditoría
              </PrimaryBtn>
              <GhostBtn onClick={() => { setShowNewAudit(false); setAuditErr({}); setAuditForm(EMPTY_AUDIT_FORM); }}>
                Cancelar
              </GhostBtn>
            </div>
          </div>
        </div>
      </>
    )}

    <div
      className="flex-1 overflow-auto p-6"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      <Breadcrumbs
        items={["Inicio", "Dashboard", "Jefatura de Auditoría"]}
      />
      <PageHeader
        title="Dashboard — Jefatura de Auditoría"
        subtitle="Período activo: Q3 2025 · Última actualización: hace 4 min"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setDashPdfOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border text-muted-foreground hover:bg-secondary transition-colors font-semibold"
            >
              <FileText size={12} /> Exportar PDF
            </button>
            <PrimaryBtn icon={<Plus size={14} />} onClick={() => setShowNewAudit(true)}>
              Nueva Auditoría
            </PrimaryBtn>
          </div>
        }
      />
      {dashPdfOpen && (
        <PDFPreviewModal
          onClose={() => setDashPdfOpen(false)}
          doc={{
            title: "Resumen del Período Q3 2025",
            subtitle: "Jefatura de Auditoría · Expedite GRC Platform",
            sections: [
              {
                heading: "Indicadores Clave",
                rows: [
                  ["Auditorías activas", "14"],
                  ["Hallazgos abiertos", "38 (7 críticos)"],
                  ["Controles probados", "127 (83% aprobados)"],
                  ["Horas registradas", "342h (este mes)"],
                ],
              },
              {
                heading: "Tareas Urgentes",
                rows: [
                  ["AUD-2025-041", "SOX Financiero — Vencida"],
                  ["AUD-2025-038", "TI & Ciberseguridad — En progreso"],
                  ["AUD-2025-035", "Nómina México — Pendiente"],
                ],
              },
              {
                heading: "Tendencias Q3 2025",
                rows: [
                  ["Q1 completadas", "8"],
                  ["Q2 completadas", "11"],
                  ["Q3 en ejecución", "5 completadas · 7 en progreso"],
                  ["Q4 proyectadas", "9 pendientes"],
                ],
              },
            ],
          }}
        />
      )}

      {/* KPI Row */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {kpis.map((k) => (
          <Card key={k.label} className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div className={`p-2 rounded-lg ${k.color}`}>
                {k.icon}
              </div>
              <TrendingUp
                size={12}
                className="text-muted-foreground"
              />
            </div>
            <div className="text-2xl font-bold text-foreground tracking-tight">
              {k.value}
            </div>
            <div className="text-xs font-semibold text-foreground mt-0.5">
              {k.label}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {k.delta}
            </div>
          </Card>
        ))}
      </div>

      {/* Quick Access & Hour Log */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="col-span-2">
          <Card>
            <div className="px-4 pt-4 pb-3 border-b border-border flex items-center justify-between">
              <div className="text-sm font-semibold text-foreground">
                Accesos Rápidos — Registros Urgentes
              </div>
              <button
                onClick={() => onNav("filter")}
                className="text-xs text-accent flex items-center gap-1 hover:underline"
              >
                Ver todos <ArrowRight size={10} />
              </button>
            </div>
            <div className="divide-y divide-border">
              {quickLinks.map((link, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 cursor-pointer group transition-colors"
                >
                  <div
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_CONFIG[link.urgency as StatusKey].dot}`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate">
                      {link.label}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {link.desc}
                    </div>
                  </div>
                  <StatusBadge
                    status={link.urgency as StatusKey}
                  />
                  <ArrowRight
                    size={14}
                    className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                  />
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Hour logger */}
        <Card className="p-4 flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <Clock size={15} className="text-primary" />
            <div className="text-sm font-semibold text-foreground">
              Registro de Horas
            </div>
          </div>
          <div className="space-y-2.5 flex-1">
            <select className="w-full text-sm bg-input-background border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring/30">
              <option>AUD-2025-041 — SOX Financiero</option>
              <option>
                AUD-2025-038 — TI & Ciberseguridad
              </option>
              <option>AUD-2025-035 — Nómina México</option>
            </select>
            <select className="w-full text-sm bg-input-background border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring/30">
              <option>Planificación</option>
              <option>Trabajo de campo</option>
              <option>Revisión / QA</option>
              <option>Reporte</option>
            </select>
            <div className="flex gap-2">
              <input
                type="number"
                min="0.5"
                max="24"
                step="0.5"
                placeholder="Horas (ej. 3.5)"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                className="flex-1 text-sm bg-input-background border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground"
              />
              <button
                onClick={saveHours}
                className={`px-4 py-2 rounded-md text-sm font-semibold transition-all ${
                  hourSaved
                    ? "bg-emerald-500 text-white"
                    : "bg-primary text-primary-foreground hover:bg-primary/90"
                }`}
              >
                {hourSaved ? (
                  <Check size={16} />
                ) : (
                  <Save size={16} />
                )}
              </button>
            </div>
          </div>
          {hourSaved && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 rounded-md px-3 py-2">
              <CheckCircle2 size={12} />
              <span>Horas registradas correctamente</span>
            </div>
          )}
          <div className="mt-3 pt-3 border-t border-border">
            <div className="text-xs text-muted-foreground">
              Hoy:{" "}
              <span className="font-semibold text-foreground">
                4.5h
              </span>{" "}
              · Semana:{" "}
              <span className="font-semibold text-foreground">
                22h
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* Tasks Table */}
      <Card className="mb-6">
        <div className="px-4 pt-4 pb-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ListTodo size={15} className="text-primary" />
            <div className="text-sm font-semibold text-foreground">
              Tareas Pendientes
            </div>
            <span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full font-medium">
              {TASKS.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {(
              [
                "all",
                "overdue",
                "in_progress",
                "pending",
                "completed",
              ] as const
            ).map((f) => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${
                  statusFilter === f
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-secondary"
                }`}
              >
                {f === "all" ? "Todos" : STATUS_CONFIG[f].label}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  ID / Nombre
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Tipo
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Responsable
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Estatus
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Fecha Esperada
                </th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredTasks.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-muted-foreground"
                  >
                    <CheckCircle2
                      size={28}
                      className="mx-auto mb-2 text-muted-foreground/40"
                    />
                    <div className="text-sm">
                      No hay tareas con este filtro
                    </div>
                  </td>
                </tr>
              )}
              {filteredTasks.map((task) => (
                <tr
                  key={task.id}
                  className="hover:bg-secondary/30 cursor-pointer group transition-colors"
                  onClick={() => onNav("filter")}
                >
                  <td className="px-4 py-3">
                    <div className="font-mono text-xs text-muted-foreground mb-0.5">
                      {task.id}
                    </div>
                    <div className="font-medium text-foreground text-sm group-hover:text-primary transition-colors">
                      {task.name}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {task.type}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold text-primary flex-shrink-0">
                        {task.owner
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </div>
                      <span className="text-xs text-foreground">
                        {task.owner}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={task.status} />
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`font-mono text-xs ${task.status === "overdue" ? "text-red-600 font-semibold" : "text-muted-foreground"}`}
                    >
                      {task.dueDate}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <ArrowRight
                      size={14}
                      className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-4">
        {/* Quarterly */}
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={15} className="text-primary" />
            <div className="text-sm font-semibold text-foreground">
              Auditorías por Trimestre
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={QUARTERLY_DATA}
              barSize={12}
              barGap={4}
            >
              <CartesianGrid key="qgrid" strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
              <XAxis key="qxaxis" dataKey="quarter" tick={{ fontSize: 11, fill: "#5A6A85" }} axisLine={false} tickLine={false} />
              <YAxis key="qyaxis" tick={{ fontSize: 11, fill: "#5A6A85" }} axisLine={false} tickLine={false} />
              <Tooltip key="qtooltip" contentStyle={{ background: "#fff", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 6, fontSize: 12 }} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
              <Legend key="qlegend" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
              <Bar key="qbar-completadas" dataKey="completadas" name="Completadas" fill={CHART_COLORS.completadas} radius={[3, 3, 0, 0]} />
              <Bar key="qbar-en_progreso" dataKey="en_progreso" name="En Progreso" fill={CHART_COLORS.en_progreso} radius={[3, 3, 0, 0]} />
              <Bar key="qbar-pendientes" dataKey="pendientes" name="Pendientes" fill={CHART_COLORS.pendientes} radius={[3, 3, 0, 0]} />
              <Bar key="qbar-vencidas" dataKey="vencidas" name="Vencidas" fill={CHART_COLORS.vencidas} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Vertical/Country */}
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <Building2 size={15} className="text-primary" />
            <div className="text-sm font-semibold text-foreground">
              Por Vertical · Entidad Auditada
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={VERTICAL_DATA} barSize={14} barGap={3} layout="vertical">
              <CartesianGrid key="vgrid" strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" horizontal={false} />
              <XAxis key="vxaxis" type="number" tick={{ fontSize: 11, fill: "#5A6A85" }} axisLine={false} tickLine={false} />
              <YAxis key="vyaxis" dataKey="name" type="category" tick={{ fontSize: 11, fill: "#5A6A85" }} axisLine={false} tickLine={false} width={90} />
              <Tooltip key="vtooltip" contentStyle={{ background: "#fff", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 6, fontSize: 12 }} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
              <Legend key="vlegend" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
              <Bar key="vbar-mx" dataKey="mx" name="México" fill="#1A4FA0" radius={[0, 3, 3, 0]} />
              <Bar key="vbar-br" dataKey="br" name="Brasil" fill="#2B6FD4" radius={[0, 3, 3, 0]} />
              <Bar key="vbar-co" dataKey="co" name="Colombia" fill="#7BA7D9" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
    </>
  );
}

// ─── Shared detail helpers ────────────────────────────────────────────────────
type Navigate = (type: DetailType, id: string) => void;

function DetailField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">
        {label}
      </div>
      <div className="text-sm font-semibold text-foreground">
        {value}
      </div>
    </div>
  );
}

function RiskLevelBadge({ level }: { level: string }) {
  const map: Record<string, string> = {
    Crítico: "bg-red-50 text-red-700 border border-red-200",
    Alto: "bg-orange-50 text-orange-700 border border-orange-200",
    Medio: "bg-amber-50 text-amber-700 border border-amber-200",
    Bajo: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  };
  return (
    <span
      className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${map[level] ?? "bg-slate-50 text-slate-600 border border-slate-200"}`}
    >
      {level}
    </span>
  );
}

function ValidityBadge({ status }: { status: string }) {
  const isValid = status === "Válido";
  return (
    <span
      className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${isValid ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-700 border border-amber-200"}`}
    >
      {status}
    </span>
  );
}

// ─── View 2: FILTER / SEARCH PAGE ────────────────────────────────────────────
type FilterCategory =
  | "general_risk"
  | "specific_risk"
  | "audit_entity"
  | "plan_entity"
  | "audit";

const FILTER_TABS: {
  id: FilterCategory;
  label: string;
  icon: React.ReactNode;
}[] = [
  { id: "general_risk",  label: "Riesgos Generales",    icon: <Shield size={14} /> },
  { id: "specific_risk", label: "Riesgos Específicos",  icon: <ShieldAlert size={14} /> },
  { id: "audit_entity",  label: "Entidades Auditoras",  icon: <Building2 size={14} /> },
  { id: "plan_entity",   label: "Entidades de Plan",    icon: <ClipboardList size={14} /> },
  { id: "audit",         label: "Auditorías",           icon: <ClipboardCheck size={14} /> },
];

function FilterView({ navigate }: { navigate: Navigate }) {
  const [category, setCategory] =
    useState<FilterCategory>("general_risk");
  const [search, setSearch] = useState("");

  const q = search.toLowerCase().trim();

  const grResults = GENERAL_RISKS.filter(
    (r) =>
      !q ||
      r.id.toLowerCase().includes(q) ||
      r.name.toLowerCase().includes(q) ||
      r.description.toLowerCase().includes(q) ||
      r.auditDepartment.toLowerCase().includes(q),
  );
  const srResults = SPECIFIC_RISKS.filter(
    (r) =>
      !q ||
      r.id.toLowerCase().includes(q) ||
      r.description.toLowerCase().includes(q) ||
      r.businessName.toLowerCase().includes(q) ||
      r.country.toLowerCase().includes(q) ||
      r.inherentRiskLevel.toLowerCase().includes(q) ||
      r.residualRiskLevel.toLowerCase().includes(q),
  );
  const aeResults = AUDIT_ENTITIES.filter(
    (r) =>
      !q ||
      r.id.toLowerCase().includes(q) ||
      r.name.toLowerCase().includes(q) ||
      r.auditDomain.toLowerCase().includes(q) ||
      r.country.toLowerCase().includes(q) ||
      r.divisionName.toLowerCase().includes(q),
  );
  const peResults = PLAN_ENTITIES.filter(
    (r) =>
      !q ||
      r.id.toLowerCase().includes(q) ||
      r.name.toLowerCase().includes(q) ||
      r.scope.toLowerCase().includes(q) ||
      r.auditDepartment.toLowerCase().includes(q),
  );

  const auditResults = AUDIT_RECORDS.filter(
    (r) =>
      !q ||
      r.id.toLowerCase().includes(q) ||
      r.name.toLowerCase().includes(q) ||
      r.type.toLowerCase().includes(q) ||
      r.entity.toLowerCase().includes(q) ||
      r.responsible.toLowerCase().includes(q),
  );

  const counts: Record<FilterCategory, number> = {
    general_risk: grResults.length,
    specific_risk: srResults.length,
    audit_entity: aeResults.length,
    plan_entity: peResults.length,
    audit: auditResults.length,
  };

  return (
    <div
      className="flex-1 overflow-auto p-6"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      <Breadcrumbs items={["Inicio", "Filtrar"]} />
      <PageHeader
        title="Filtrar Registros"
        subtitle="Busca riesgos, entidades auditoras y entidades de plan por cualquier atributo"
      />

      {/* Search */}
      <div className="relative mb-5 max-w-2xl">
        <Search
          size={15}
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por ID, nombre, país, descripción, nivel de riesgo…"
          className="w-full bg-card border border-border rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30 shadow-sm placeholder:text-muted-foreground"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setCategory(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${
              category === tab.id
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-foreground border-border hover:border-primary/40 hover:bg-secondary"
            }`}
          >
            {tab.icon}
            {tab.label}
            <span
              className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${category === tab.id ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"}`}
            >
              {counts[tab.id]}
            </span>
          </button>
        ))}
      </div>

      {/* Results */}
      <Card>
        <div className="px-4 pt-4 pb-3 border-b border-border flex items-center justify-between">
          <div className="text-sm font-semibold text-foreground">
            {FILTER_TABS.find((t) => t.id === category)?.label}
          </div>
          <div className="text-xs text-muted-foreground">
            {counts[category]} resultado
            {counts[category] !== 1 ? "s" : ""}
          </div>
        </div>

        {category === "general_risk" &&
          (grResults.length === 0 ? (
            <EmptyResults />
          ) : (
            <div className="divide-y divide-border">
              {grResults.map((r) => (
                <FilterRow
                  key={r.id}
                  id={r.id}
                  name={r.name}
                  meta={r.auditDepartment}
                  onClick={() => navigate("general_risk", r.id)}
                />
              ))}
            </div>
          ))}
        {category === "specific_risk" &&
          (srResults.length === 0 ? (
            <EmptyResults />
          ) : (
            <div className="divide-y divide-border">
              {srResults.map((r) => (
                <FilterRow
                  key={r.id}
                  id={r.id}
                  name={r.description.slice(0, 80) + "…"}
                  meta={`${r.inherentRiskLevel} → ${r.residualRiskLevel} · ${r.country}`}
                  onClick={() =>
                    navigate("specific_risk", r.id)
                  }
                />
              ))}
            </div>
          ))}
        {category === "audit_entity" &&
          (aeResults.length === 0 ? (
            <EmptyResults />
          ) : (
            <div className="divide-y divide-border">
              {aeResults.map((r) => (
                <FilterRow
                  key={r.id}
                  id={r.id}
                  name={r.name}
                  meta={`${r.auditDomain} · ${r.country}`}
                  onClick={() => navigate("audit_entity", r.id)}
                />
              ))}
            </div>
          ))}
        {category === "plan_entity" &&
          (peResults.length === 0 ? (
            <EmptyResults />
          ) : (
            <div className="divide-y divide-border">
              {peResults.map((r) => (
                <FilterRow
                  key={r.id}
                  id={r.id}
                  name={r.name}
                  meta={`${r.auditDepartment} · ${r.year}`}
                  onClick={() => undefined}
                />
              ))}
            </div>
          ))}
        {category === "audit" &&
          (auditResults.length === 0 ? (
            <EmptyResults />
          ) : (
            <div className="divide-y divide-border">
              {auditResults.map((r) => (
                <AuditFilterCard key={r.id} audit={r} />
              ))}
            </div>
          ))}
      </Card>
    </div>
  );
}

function AuditFilterCard({ audit }: { audit: AuditRecord }) {
  const [expanded, setExpanded] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [auditPdfOpen, setAuditPdfOpen] = useState(false);
  const [xlsxEditorDoc, setXlsxEditorDoc] = useState<AuditDocument | null>(null);

  const DocIcon = ({ type }: { type: string }) => {
    if (type === "xlsx") return <FileSpreadsheet size={14} className="text-emerald-600 flex-shrink-0" />;
    if (type === "docx") return <FileText size={14} className="text-blue-600 flex-shrink-0" />;
    if (type === "pptx") return <Layers size={14} className="text-orange-500 flex-shrink-0" />;
    return <FileText size={14} className="text-red-500 flex-shrink-0" />;
  };

  return (
    <div className="px-4 py-4">
      <div
        className="flex items-center gap-3 cursor-pointer group"
        onClick={() => setExpanded(e => !e)}
      >
        <span className="font-mono text-xs font-bold text-primary bg-primary/8 px-2.5 py-1 rounded-md flex-shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
          {audit.id}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">{audit.name}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{audit.type} · {audit.entity} · {audit.responsible}</div>
        </div>
        <StatusBadge status={audit.status} />
        <span className="text-xs text-muted-foreground flex-shrink-0">{audit.documents.length} docs</span>
        {expanded
          ? <ChevronUp size={14} className="text-muted-foreground flex-shrink-0" />
          : <ChevronDown size={14} className="text-muted-foreground flex-shrink-0" />}
      </div>

      {expanded && (
        <div className="mt-4 ml-1 space-y-4">
          {/* Audit metadata grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-secondary/30 rounded-lg text-xs">
            {[
              ["Inicio", audit.startDate],
              ["Fin previsto", audit.endDate],
              ["Responsable", audit.responsible],
              ["Entidad", audit.entity],
            ].map(([label, value]) => (
              <div key={label}>
                <div className="text-muted-foreground font-semibold uppercase tracking-wide mb-0.5">{label}</div>
                <div className="font-medium text-foreground">{value}</div>
              </div>
            ))}
          </div>
          <div className="text-xs text-muted-foreground bg-secondary/20 rounded-md px-3 py-2 border-l-2 border-primary/30">
            <span className="font-semibold text-foreground/70">Alcance: </span>{audit.scope}
          </div>

          {/* Export actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={e => { e.stopPropagation(); setAuditPdfOpen(true); }}
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border border-border text-muted-foreground hover:bg-secondary transition-colors font-medium"
            >
              <FileText size={12} /> Exportar PDF
            </button>
            <button
              onClick={e => { e.stopPropagation(); exportToCSV(`auditoria_${audit.id}.csv`, ["Campo","Valor"], [["ID",audit.id],["Nombre",audit.name],["Tipo",audit.type],["Entidad",audit.entity],["Responsable",audit.responsible],["Inicio",audit.startDate],["Fin",audit.endDate],["Estado",audit.status]]); }}
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border border-border text-muted-foreground hover:bg-secondary transition-colors font-medium"
            >
              <Download size={12} /> Exportar CSV
            </button>
          </div>
          {auditPdfOpen && (
            <PDFPreviewModal
              onClose={() => setAuditPdfOpen(false)}
              doc={{
                title: `Informe de Auditoría — ${audit.id}`,
                subtitle: audit.name,
                sections: [
                  {
                    heading: "Información General",
                    rows: [
                      ["ID", audit.id],
                      ["Nombre", audit.name],
                      ["Tipo", audit.type],
                      ["Entidad auditada", audit.entity],
                      ["Responsable", audit.responsible],
                      ["Estado", audit.status],
                    ],
                  },
                  {
                    heading: "Alcance y Vigencia",
                    rows: [
                      ["Fecha de inicio", audit.startDate],
                      ["Fecha prevista de fin", audit.endDate],
                      ["Alcance", audit.scope],
                    ],
                  },
                  {
                    heading: "Documentos Adjuntos",
                    rows: audit.documents.map(d => [d.name, `${d.type.toUpperCase()} · ${d.size} · ${d.date}`]),
                  },
                ],
              }}
            />
          )}

          {/* Documents */}
          <div>
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Documentos relacionados</div>
            <div className="space-y-1.5">
              {audit.documents.map(doc => (
                <div key={doc.id} className="flex items-center gap-3 px-3 py-2.5 bg-white border border-border rounded-lg hover:bg-secondary/20 transition-colors">
                  <DocIcon type={doc.type} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-foreground truncate">{doc.name}</div>
                    <div className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                      {doc.type.toUpperCase()} · {doc.size} · {doc.date}
                    </div>
                  </div>
                  <div className="relative flex-shrink-0">
                    <button
                      onClick={e => { e.stopPropagation(); setOpenMenu(openMenu === doc.id ? null : doc.id); }}
                      className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <MoreVertical size={13} />
                    </button>
                    {openMenu === doc.id && (
                      <>
                        <div
                          className="fixed inset-0"
                          style={{ zIndex: 9 }}
                          onClick={e => { e.stopPropagation(); setOpenMenu(null); }}
                        />
                        <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-border rounded-lg shadow-lg overflow-hidden" style={{ zIndex: 10 }}>
                          {doc.type === "xlsx" ? (
                            <button
                              onClick={e => { e.stopPropagation(); setXlsxEditorDoc(doc); setOpenMenu(null); }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-emerald-700 hover:bg-emerald-50 transition-colors font-semibold"
                            >
                              <FileSpreadsheet size={12} /> Editar en Expedite
                            </button>
                          ) : (
                            <button
                              onClick={e => { e.stopPropagation(); setOpenMenu(null); }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-foreground hover:bg-secondary transition-colors"
                            >
                              <Pencil size={12} className="text-primary" /> Editar
                            </button>
                          )}
                          <button
                            onClick={e => { e.stopPropagation(); setOpenMenu(null); }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 size={12} /> Eliminar
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {xlsxEditorDoc && (
        <SpreadsheetEditor
          filename={xlsxEditorDoc.name}
          fileVersion={3}
          entityId={audit.id}
          onClose={() => setXlsxEditorDoc(null)}
          onHashUpdate={() => { setXlsxEditorDoc(null); }}
        />
      )}
    </div>
  );
}

function FilterRow({
  id,
  name,
  meta,
  onClick,
}: {
  id: string;
  name: string;
  meta: string;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="flex items-center gap-4 px-4 py-3.5 hover:bg-secondary/40 cursor-pointer group transition-colors"
    >
      <span className="font-mono text-xs font-bold text-primary bg-primary/8 px-2.5 py-1 rounded-md flex-shrink-0 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
        {id}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate">
          {name}
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">
          {meta}
        </div>
      </div>
      <ArrowRight
        size={14}
        className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
      />
    </div>
  );
}

function EmptyResults() {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      <Search
        size={28}
        className="text-muted-foreground/30 mb-3"
      />
      <div className="text-sm font-semibold text-muted-foreground">
        Sin resultados
      </div>
      <div className="text-xs text-muted-foreground/60 mt-1">
        Intenta con otro término o limpia la búsqueda
      </div>
    </div>
  );
}

// ─── AI Summary Card ──────────────────────────────────────────────────────────
const AI_SUMMARIES: Record<string, string> = {
  "GR-001": "Este riesgo de integridad financiera afecta al proceso de cierre contable mensual. Los controles vigentes (CTR-001, CTR-002) presentan una vulnerabilidad media en la segregación de funciones. Se recomienda reforzar la aprobación dual y auditar los roles SAP antes del próximo cierre trimestral.",
  "GR-002": "El riesgo de acceso no autorizado a sistemas críticos es gestionado por CTR-003 con revisión trimestral de privilegios. La vulnerabilidad residual es baja, aunque se detectó una brecha activa en el periodo actual (HAL-2025-002). Acción prioritaria: depurar cuentas inactivas en un plazo de 30 días.",
  "GR-003": "El incumplimiento normativo regulatorio presenta riesgo residual bajo tras la implementación de CTR-004. Sin embargo, el hallazgo HAL-2025-003 indica que el calendario normativo de Colombia no está actualizado. Recomendación: establecer alertas automáticas de vencimiento regulatorio.",
  "SR-001": "Riesgo específico de alta criticidad en la filial México. Las conciliaciones bancarias del cierre mensual presentan deficiencias de segregación de funciones. El control CTR-001 mitiga parcialmente el riesgo, pero CTR-002 requiere revisión urgente según el hallazgo HAL-2025-001 emitido el 10 de julio.",
  "SR-002": "Riesgo de tesorería con nivel inherente alto y residual medio. El control de autorización dual (CTR-002) está en estado 'Requiere Revisión'. Se identificaron 3 transacciones de alto valor en el Q2 sin aprobación dual documentada.",
  "SR-003": "Acceso privilegiado no revisado en sistemas de producción — Brasil. Control CTR-003 activo pero con instancias no resueltas. Hallazgo HAL-2025-002 pendiente de resolución. Riesgo residual alto; se recomienda revisión inmediata de cuentas de ex-empleados.",
  "SR-004": "Riesgo regulatorio en Colombia con residual bajo tras aplicación de CTR-004. Hallazgo menor HAL-2025-003 sobre actualización de calendario normativo. Estado: en proceso de remediación por el área de Legal & Cumplimiento.",
  "AE-001": "Entidad auditora de máxima criticidad. Concentra 2 riesgos específicos (SR-001, SR-002) con niveles inherentes Crítico y Alto. Los controles CTR-001 y CTR-002 cubren los riesgos, pero CTR-002 requiere revisión. Prioridad de auditoría: ALTA. Próxima verificación programada para Q3 2025.",
  "AE-002": "Entidad de ciberseguridad LATAM con riesgo residual alto en accesos privilegiados. Control CTR-003 activo pero con hallazgo abierto. Recomendación: acelerar el ciclo de revisión de accesos a mensual y automatizar la detección de cuentas inactivas.",
  "AE-003": "Entidad de cumplimiento normativo con riesgo residual bajo. Control CTR-004 efectivo. Hallazgo menor en actualización de calendario. Estado general: satisfactorio con área de mejora en automatización de alertas regulatorias.",
  "CTR-001": "Control preventivo de conciliación bancaria mensual con efectividad alta (vulnerabilidad Baja). Operado al 100% de muestra. Se han cargado 2 evidencias en el sistema. Sin hallazgos críticos asociados. El procedimiento cumple con los estándares SOX requeridos.",
  "CTR-002": "Control detectivo de segregación de funciones con estatus 'Requiere Revisión'. Hallazgo crítico HAL-2025-001 asociado. Vulnerabilidad media. Acción requerida: validar la reasignación de roles SAP antes del 15 de septiembre según el plan de acción asignado.",
  "CTR-003": "Control de revisión de accesos privilegiados con muestra del 100%. Vulnerabilidad baja, pero con hallazgo activo HAL-2025-002 sobre cuentas de ex-empleados. El control es efectivo pero la frecuencia trimestral puede no ser suficiente dado el riesgo actual. Considerar migrar a revisión mensual.",
  "CTR-004": "Control preventivo de monitoreo de obligaciones regulatorias con baja vulnerabilidad. Hallazgo HAL-2025-003 en proceso de resolución. Control de bajo riesgo residual; el principal punto de mejora es la automatización del seguimiento de compromisos con organismos reguladores.",
};

function AISummaryCard({ entityId, entityType }: { entityId: string; entityType: string }) {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);

  const generate = () => {
    setLoading(true);
    setSummary(null);
    setTimeout(() => {
      setLoading(false);
      setSummary(AI_SUMMARIES[entityId] ?? `Análisis de ${entityType} ${entityId}: Este registro presenta un perfil de riesgo moderado con controles activos en revisión. Se recomienda verificar el estado de los hallazgos asociados y actualizar el calendario de auditoría según los cambios normativos recientes.`);
    }, 1600);
  };

  return (
    <Card className="p-5 mt-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-primary/10 rounded-lg">
            <Sparkles size={14} className="text-primary" />
          </div>
          <div className="text-sm font-semibold text-foreground">Asistente IA — Resumen</div>
        </div>
        <button
          onClick={generate}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded-md hover:bg-primary/90 transition-colors disabled:opacity-60"
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
          {loading ? "Generando…" : "Generar resumen"}
        </button>
      </div>
      {!summary && !loading && (
        <p className="text-xs text-muted-foreground bg-secondary/40 rounded-md px-3 py-2.5">
          Haz clic en "Generar resumen" para obtener un análisis IA de este registro, incluyendo estado de controles, hallazgos y recomendaciones.
        </p>
      )}
      {loading && (
        <div className="space-y-2">
          {[1, 0.7, 0.5].map((w, i) => (
            <div key={i} className="h-3 bg-primary/10 rounded animate-pulse" style={{ width: `${w * 100}%` }} />
          ))}
        </div>
      )}
      {summary && (
        <div className="bg-primary/5 border border-primary/15 rounded-lg p-3.5 text-sm text-foreground leading-relaxed">
          {summary}
        </div>
      )}
    </Card>
  );
}

// ─── Evidencias Section ───────────────────────────────────────────────────────
const BLOCKED_EXTENSIONS = [".exe", ".bat", ".js", ".msi", ".sh", ".cmd", ".vbs", ".ps1"];

function EvidenciasSection({ entityId }: { entityId: string }) {
  const [files, setFiles] = useState<EvidenceFile[]>(
    () => INITIAL_EVIDENCES.filter(e => e.entityId === entityId).map(e => ({ ...e, version: e.version ?? 3 }))
  );
  const [error, setError] = useState<string | null>(null);
  const [xlsxTarget, setXlsxTarget] = useState<EvidenceFile | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (BLOCKED_EXTENSIONS.includes(ext)) {
      setError(`Tipo de archivo no permitido (${ext}). Solo se aceptan .pdf y .xlsx.`);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    if (![".pdf", ".xlsx"].includes(ext)) {
      setError(`Solo se aceptan archivos .pdf y .xlsx.`);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > 50) {
      setError("El archivo supera el límite de 50 MB.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    const fakeHash = "sha256:" + Math.random().toString(36).slice(2,10) + "…" + Math.random().toString(36).slice(2,10);
    const newEv: EvidenceFile = {
      id: `EV-${Date.now()}`, name: file.name,
      size: sizeMB < 1 ? `${Math.round(file.size / 1024)} KB` : `${sizeMB.toFixed(1)} MB`,
      mimeType: file.name.split(".").pop()?.toLowerCase() ?? "bin",
      hash: fakeHash, uploadDate: new Date().toISOString().slice(0,10),
      uploadedBy: "M. García", entityId, version: 1,
    };
    setFiles(prev => [newEv, ...prev]);
    toast.success(`Evidencia "${file.name}" cargada correctamente`);
    if (inputRef.current) inputRef.current.value = "";
  };

  const removeFile = (id: string) => setFiles(prev => prev.filter(f => f.id !== id));

  const handleHashUpdate = (fileId: string, newHash: string, newVersion: number) => {
    setFiles(prev => prev.map(f => f.id === fileId ? { ...f, hash: newHash, version: newVersion } : f));
  };

  const iconClass = (t: string) => t === "pdf" ? "text-red-500" : t === "xlsx" ? "text-emerald-600" : "text-blue-500";

  return (
    <>
      {xlsxTarget && (
        <SpreadsheetEditor
          filename={xlsxTarget.name}
          fileVersion={xlsxTarget.version ?? 3}
          entityId={entityId}
          onClose={() => setXlsxTarget(null)}
          onHashUpdate={(hash, ver) => { handleHashUpdate(xlsxTarget.id, hash, ver); setXlsxTarget(null); }}
        />
      )}
      <Card className="p-5 mt-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileCheck2 size={15} className="text-primary" />
            <div className="text-sm font-semibold text-foreground">Evidencias Documentales</div>
            <span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full font-semibold">{files.length}</span>
          </div>
          <label className="inline-flex items-center gap-1.5 cursor-pointer px-3 py-1.5 bg-secondary text-secondary-foreground text-xs font-semibold rounded-md hover:bg-secondary/70 transition-colors">
            <UploadCloud size={12} /> Adjuntar archivo
            <input ref={inputRef} type="file" accept=".pdf,.xlsx" className="hidden" onChange={handleUpload} />
          </label>
        </div>
        {error && (
          <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded-md text-xs text-red-700">
            <Ban size={12} className="flex-shrink-0" />{error}
          </div>
        )}
        {files.length === 0 ? (
          <div className="text-center py-8 text-xs text-muted-foreground bg-secondary/20 rounded-lg border-2 border-dashed border-border">
            <UploadCloud size={20} className="mx-auto mb-2 text-muted-foreground/40" />
            Sin evidencias adjuntas. Sube archivos .pdf o .xlsx (máx. 50 MB).
          </div>
        ) : (
          <div className="space-y-2">
            {files.map(f => (
              <div key={f.id} className="flex items-center gap-3 px-3 py-2.5 bg-secondary/20 border border-border rounded-lg hover:bg-secondary/40 transition-colors group">
                <FileText size={14} className={`flex-shrink-0 ${iconClass(f.mimeType)}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-foreground truncate">{f.name}</div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-[10px] text-muted-foreground font-mono">{f.mimeType.toUpperCase()} · {f.size}{f.version ? ` · v${f.version}` : ""}</span>
                    <span className="text-[10px] text-muted-foreground">·</span>
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-mono">
                      <Hash size={9} /><span className="truncate max-w-[140px]">{f.hash}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-[10px] text-muted-foreground">{f.uploadedBy}</div>
                  <div className="text-[10px] text-muted-foreground font-mono">{f.uploadDate}</div>
                </div>
                {f.mimeType === "xlsx" && (
                  <button
                    onClick={() => setXlsxTarget(f)}
                    className="flex-shrink-0 flex items-center gap-1 text-[10px] px-2 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md hover:bg-emerald-100 font-semibold transition-colors whitespace-nowrap"
                  >
                    <FileSpreadsheet size={10} /> Editar en Expedite
                  </button>
                )}
                <button onClick={() => removeFile(f.id)} className="p-1 text-muted-foreground hover:text-red-500 transition-colors flex-shrink-0">
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="mt-3 pt-3 border-t border-border text-[10px] text-muted-foreground">
          Formatos aceptados: PDF, XLSX · Máx. 50 MB · Hash SHA-256 · Los archivos .xlsx se pueden editar directamente en Expedite
        </div>
      </Card>
    </>
  );
}

// ─── GENERAL RISK DETAIL ──────────────────────────────────────────────────────
function GeneralRiskDetailView({
  id,
  navigate,
  crumbs,
}: {
  id: string;
  navigate: Navigate;
  crumbs: React.ReactNode;
}) {
  const gr = GENERAL_RISKS.find((r) => r.id === id)!;
  const registers = SPECIFIC_RISKS.filter(
    (sr) => sr.generalRiskId === id,
  );
  const [srSearch, setSrSearch] = useState("");
  const q = srSearch.toLowerCase();
  const filteredRegs = registers.filter(
    (r) =>
      !q ||
      r.id.toLowerCase().includes(q) ||
      r.auditEntityId.toLowerCase().includes(q) ||
      r.country.toLowerCase().includes(q) ||
      r.businessName.toLowerCase().includes(q),
  );

  const ae = (aeId: string) =>
    AUDIT_ENTITIES.find((a) => a.id === aeId);

  return (
    <div
      className="flex-1 overflow-auto p-6"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      {crumbs}
      {/* Header */}
      <Card className="mb-5 p-5">
        <div className="flex items-start gap-3 mb-3">
          <div className="p-2 bg-primary/10 rounded-lg flex-shrink-0">
            <Shield size={18} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs font-bold text-primary bg-primary/8 px-2.5 py-1 rounded-md">
                {gr.id}
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground bg-muted px-2 py-0.5 rounded">
                Riesgo General
              </span>
            </div>
            <h1 className="text-xl font-bold text-foreground leading-tight mb-1">
              {gr.name}
            </h1>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 pt-3 border-t border-border">
          <DetailField label="ID" value={gr.id} />
          <DetailField
            label="Departamento Auditor"
            value={gr.auditDepartment}
          />
          <DetailField
            label="Registros de Riesgo"
            value={`${registers.length} específico${registers.length !== 1 ? "s" : ""}`}
          />
        </div>
        <div className="mt-4 pt-3 border-t border-border">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
            Descripción
          </div>
          <p className="text-sm text-foreground leading-relaxed">
            {gr.description}
          </p>
        </div>
      </Card>

      {/* Risk Registers table */}
      <Card>
        <div className="px-4 pt-4 pb-3 border-b border-border flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <ShieldAlert size={15} className="text-primary" />
            <div className="text-sm font-semibold text-foreground">
              Registros de Riesgo (Riesgos Específicos)
            </div>
            <span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full font-semibold">
              {filteredRegs.length}
            </span>
          </div>
          <div className="relative">
            <Search
              size={13}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              value={srSearch}
              onChange={(e) => setSrSearch(e.target.value)}
              placeholder="Buscar…"
              className="text-xs bg-input-background border border-border rounded-md pl-8 pr-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring/30 w-48 placeholder:text-muted-foreground"
            />
          </div>
        </div>
        {filteredRegs.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Sin registros de riesgo específico para este riesgo
            general
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {[
                    "ID Riesgo Específico",
                    "Nivel Inherente",
                    "Nivel Residual",
                    "Entidad Auditora",
                    "Depto. Negocio",
                    "Negocio",
                    "División",
                    "País de Origen",
                  ].map((h) => (
                    <th
                      key={h}
                      className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredRegs.map((sr) => (
                  <tr
                    key={sr.id}
                    className="hover:bg-secondary/30 cursor-pointer group transition-colors"
                    onClick={() =>
                      navigate("specific_risk", sr.id)
                    }
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs font-bold text-primary group-hover:underline">
                        {sr.id}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <RiskLevelBadge
                        level={sr.inherentRiskLevel}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <RiskLevelBadge
                        level={sr.residualRiskLevel}
                      />
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {ae(sr.auditEntityId)?.id} —{" "}
                      {ae(sr.auditEntityId)
                        ?.name.split("—")[1]
                        ?.trim()}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {sr.businessDeptName}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {sr.businessName}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {sr.divisionName}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {sr.country}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <AISummaryCard entityId={gr.id} entityType="Riesgo General" />
    </div>
  );
}

// ─── SPECIFIC RISK DETAIL ─────────────────────────────────────────────────────
function SpecificRiskDetailView({
  id,
  navigate,
  crumbs,
}: {
  id: string;
  navigate: Navigate;
  crumbs: React.ReactNode;
}) {
  const sr = SPECIFIC_RISKS.find((r) => r.id === id)!;
  const ae = AUDIT_ENTITIES.find(
    (a) => a.id === sr.auditEntityId,
  );
  const gr = GENERAL_RISKS.find(
    (g) => g.id === sr.generalRiskId,
  );
  const controls = CONTROLS.filter((c) =>
    c.specificRiskIds.includes(id),
  );

  return (
    <div
      className="flex-1 overflow-auto p-6"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      {crumbs}
      {/* Header */}
      <Card className="mb-5 p-5">
        <div className="flex items-start gap-3 mb-3">
          <div className="p-2 bg-amber-100 rounded-lg flex-shrink-0">
            <ShieldAlert size={18} className="text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-mono text-xs font-bold text-primary bg-primary/8 px-2.5 py-1 rounded-md">
                {sr.id}
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground bg-muted px-2 py-0.5 rounded">
                Riesgo Específico
              </span>
              {gr && (
                <span className="text-xs text-muted-foreground">
                  ←{" "}
                  <span className="font-semibold text-foreground">
                    {gr.id}
                  </span>{" "}
                  {gr.name}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <RiskLevelBadge level={sr.inherentRiskLevel} />
              <ArrowRight
                size={12}
                className="text-muted-foreground"
              />
              <RiskLevelBadge level={sr.residualRiskLevel} />
              <span className="text-xs text-muted-foreground ml-1">
                Inherente → Residual
              </span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 pt-3 border-t border-border mb-3">
          <DetailField
            label="ID Riesgo Específico"
            value={sr.id}
          />
          <DetailField
            label="Nivel de Riesgo Inherente"
            value={sr.inherentRiskLevel}
          />
          <DetailField
            label="Nivel de Riesgo Residual"
            value={sr.residualRiskLevel}
          />
          <DetailField
            label="Entidad Auditora"
            value={`${ae?.id} — ${ae?.name.split("—")[1]?.trim() ?? ""}`}
          />
          <DetailField
            label="Depto. de Negocio"
            value={sr.businessDeptName}
          />
          <DetailField
            label="Negocio"
            value={sr.businessName}
          />
          <DetailField
            label="División"
            value={sr.divisionName}
          />
          <DetailField
            label="País de Origen"
            value={sr.country}
          />
        </div>
        <div className="pt-3 border-t border-border">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
            Descripción Detallada
          </div>
          <p className="text-sm text-foreground leading-relaxed">
            {sr.description}
          </p>
        </div>
      </Card>

      {/* Controls table */}
      <Card>
        <div className="px-4 pt-4 pb-3 border-b border-border flex items-center gap-2">
          <ClipboardCheck size={15} className="text-primary" />
          <div className="text-sm font-semibold text-foreground">
            Procedimientos de Control
          </div>
          <span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full font-semibold">
            {controls.length}
          </span>
        </div>
        {controls.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Sin procedimientos de control asociados
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {[
                    "ID Control",
                    "Validez del Control",
                    "N° Control Negocio",
                    "Actividad de Control",
                    "Vulnerabilidad Actual",
                  ].map((h) => (
                    <th
                      key={h}
                      className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {controls.map((c) => (
                  <tr
                    key={c.id}
                    className="hover:bg-secondary/30 cursor-pointer group transition-colors"
                    onClick={() => navigate("control", c.id)}
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs font-bold text-primary group-hover:underline">
                        {c.id}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <ValidityBadge
                        status={c.validityStatus}
                      />
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {c.businessControlNumber}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground max-w-xs">
                      {c.controlActivity}
                    </td>
                    <td className="px-4 py-3">
                      <RiskLevelBadge
                        level={c.currentVulnerability}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <AISummaryCard entityId={sr.id} entityType="Riesgo Específico" />
    </div>
  );
}

// ─── AUDIT ENTITY DETAIL ──────────────────────────────────────────────────────
function AuditEntityDetailView({
  id,
  navigate,
  crumbs,
}: {
  id: string;
  navigate: Navigate;
  crumbs: React.ReactNode;
}) {
  const ae = AUDIT_ENTITIES.find((a) => a.id === id)!;
  const linkedSRs = SPECIFIC_RISKS.filter(
    (sr) => sr.auditEntityId === id,
  );
  const linkedGRIds = [
    ...new Set(linkedSRs.map((sr) => sr.generalRiskId)),
  ];
  const linkedGRs = GENERAL_RISKS.filter((gr) =>
    linkedGRIds.includes(gr.id),
  );
  const linkedControls = CONTROLS.filter(
    (c) => c.auditEntityId === id,
  );

  return (
    <div
      className="flex-1 overflow-auto p-6"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      {crumbs}
      {/* Header */}
      <Card className="mb-5 p-5">
        <div className="flex items-start gap-3 mb-3">
          <div className="p-2 bg-violet-100 rounded-lg flex-shrink-0">
            <Building2 size={18} className="text-violet-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs font-bold text-primary bg-primary/8 px-2.5 py-1 rounded-md">
                {ae.id}
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground bg-muted px-2 py-0.5 rounded">
                Entidad Auditora
              </span>
            </div>
            <h1 className="text-xl font-bold text-foreground leading-tight">
              {ae.name}
            </h1>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 pt-3 border-t border-border">
          <DetailField label="ID Auditoría" value={ae.id} />
          <DetailField
            label="Departamento Auditor"
            value={ae.auditDepartment}
          />
          <DetailField
            label="Dominio de Auditoría"
            value={ae.auditDomain}
          />
          <DetailField
            label="División"
            value={ae.divisionName}
          />
          <DetailField
            label="País de Origen"
            value={ae.country}
          />
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        {/* General Risks */}
        <Card>
          <div className="px-4 pt-4 pb-3 border-b border-border flex items-center gap-2">
            <Shield size={14} className="text-primary" />
            <div className="text-sm font-semibold text-foreground">
              Riesgos Generales Asociados
            </div>
            <span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full font-semibold">
              {linkedGRs.length}
            </span>
          </div>
          <div className="divide-y divide-border">
            {linkedGRs.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                Sin riesgos generales
              </div>
            ) : (
              linkedGRs.map((gr) => (
                <div
                  key={gr.id}
                  onClick={() =>
                    navigate("general_risk", gr.id)
                  }
                  className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/40 cursor-pointer group transition-colors"
                >
                  <span className="font-mono text-xs font-bold text-primary group-hover:underline flex-shrink-0">
                    {gr.id}
                  </span>
                  <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors text-left flex-1">
                    {gr.name}
                  </span>
                  <ArrowRight
                    size={13}
                    className="text-muted-foreground opacity-0 group-hover:opacity-100 flex-shrink-0"
                  />
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Controls */}
        <Card>
          <div className="px-4 pt-4 pb-3 border-b border-border flex items-center gap-2">
            <ClipboardCheck
              size={14}
              className="text-primary"
            />
            <div className="text-sm font-semibold text-foreground">
              Procedimientos de Control
            </div>
            <span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full font-semibold">
              {linkedControls.length}
            </span>
          </div>
          <div className="divide-y divide-border">
            {linkedControls.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">
                Sin controles
              </div>
            ) : (
              linkedControls.map((c) => (
                <div
                  key={c.id}
                  onClick={() => navigate("control", c.id)}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/40 cursor-pointer group transition-colors"
                >
                  <span className="font-mono text-xs font-bold text-primary group-hover:underline flex-shrink-0">
                    {c.id}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate">
                      {c.controlProcedureName}
                    </div>
                    <ValidityBadge status={c.validityStatus} />
                  </div>
                  <ArrowRight
                    size={13}
                    className="text-muted-foreground opacity-0 group-hover:opacity-100 flex-shrink-0"
                  />
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
      <AISummaryCard entityId={ae.id} entityType="Entidad Auditora" />
    </div>
  );
}

// ─── CONTROL DETAIL ───────────────────────────────────────────────────────────
function ControlDetailView({
  id,
  crumbs,
}: {
  id: string;
  crumbs: React.ReactNode;
}) {
  const ctrl = CONTROLS.find((c) => c.id === id)!;
  const ae = AUDIT_ENTITIES.find(
    (a) => a.id === ctrl.auditEntityId,
  )!;
  const procedures = PROCEDURE_TRACKING.filter(
    (p) => p.controlId === id,
  );

  return (
    <div
      className="flex-1 overflow-auto p-6"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      {crumbs}
      {/* Header */}
      <Card className="mb-5 p-5">
        <div className="flex items-start gap-3 mb-3">
          <div className="p-2 bg-emerald-100 rounded-lg flex-shrink-0">
            <ClipboardCheck
              size={18}
              className="text-emerald-600"
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs font-bold text-primary bg-primary/8 px-2.5 py-1 rounded-md">
                {ctrl.id}
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground bg-muted px-2 py-0.5 rounded">
                Procedimiento de Control
              </span>
              <ValidityBadge status={ctrl.validityStatus} />
            </div>
            <h1 className="text-xl font-bold text-foreground leading-tight">
              {ctrl.controlProcedureName}
            </h1>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 pt-3 border-t border-border mb-4">
          <DetailField label="ID Control" value={ctrl.id} />
          <DetailField
            label="Entidad Auditora"
            value={ae.name}
          />
          <DetailField
            label="ID Entidad Auditora"
            value={ae.id}
          />
        </div>
        <div className="pt-3 border-t border-border">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
            Actividad de Control
          </div>
          <p className="text-sm text-foreground leading-relaxed">
            {ctrl.controlActivity}
          </p>
        </div>
      </Card>

      {/* Transversal Control Procedures */}
      <Card className="mb-5 p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="text-sm font-bold text-foreground">
            Procedimientos de Control Transversal
          </div>
          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-semibold">
            {ctrl.controlType}
          </span>
        </div>
        <div className="grid grid-cols-5 gap-4">
          {[
            {
              label: "Tipo de Control",
              value: ctrl.controlType,
            },
            {
              label: "Frecuencia de Operación",
              value: ctrl.frequency,
            },
            {
              label: "Tamaño de Muestra",
              value: ctrl.sampleSize,
            },
            { label: "Rotación", value: ctrl.rotation },
            { label: "Estatus", value: ctrl.controlStatus },
          ].map((f) => (
            <div
              key={f.label}
              className="bg-muted/40 rounded-lg p-3"
            >
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                {f.label}
              </div>
              <div className="text-sm font-bold text-foreground">
                {f.value}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Procedure Tracking Table */}
      <Card>
        <div className="px-4 pt-4 pb-3 border-b border-border flex items-center gap-2">
          <ClipboardList size={15} className="text-primary" />
          <div className="text-sm font-semibold text-foreground">
            Seguimiento de Procedimientos
          </div>
          <span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full font-semibold">
            {procedures.length}
          </span>
        </div>
        {procedures.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Sin procedimientos de seguimiento registrados
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {[
                    "ID Seguimiento",
                    "Nombre Procedimiento",
                    "Identificador",
                    "Depto. Negocio",
                    "Negocio",
                    "División",
                    "Área",
                    "País",
                  ].map((h) => (
                    <th
                      key={h}
                      className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {procedures.map((p) => (
                  <tr
                    key={p.id}
                    className="hover:bg-secondary/30 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-xs font-bold text-primary">
                      {p.id}
                    </td>
                    <td className="px-4 py-3 text-xs font-medium text-foreground">
                      {p.procedureName}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {p.identificator}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {p.businessDeptName}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {p.businessName}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {p.divisionName}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {p.area}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {p.country}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <EvidenciasSection entityId={ctrl.id} />
      <AISummaryCard entityId={ctrl.id} entityType="Control" />
    </div>
  );
}

// ─── View 3: DASHBOARD EDITOR ────────────────────────────────────────────────
const WIDGET_CATALOG = [
  {
    id: "kpi",
    label: "Tarjeta KPI",
    icon: <TrendingUp size={22} />,
    desc: "Métrica con delta y tendencia",
    color: "bg-blue-50 text-blue-600",
  },
  {
    id: "bar",
    label: "Gráfica de Barras",
    icon: <BarChart3 size={22} />,
    desc: "Comparativa por categoría o periodo",
    color: "bg-violet-50 text-violet-600",
  },
  {
    id: "table",
    label: "Tabla de Tareas",
    icon: <ListTodo size={22} />,
    desc: "Lista filtrable con estatus visual",
    color: "bg-emerald-50 text-emerald-600",
  },
  {
    id: "horas",
    label: "Log de Horas",
    icon: <Timer size={22} />,
    desc: "Entrada rápida de horas trabajadas",
    color: "bg-amber-50 text-amber-600",
  },
  {
    id: "links",
    label: "Accesos Rápidos",
    icon: <ArrowRight size={22} />,
    desc: "Links priorizados a registros clave",
    color: "bg-rose-50 text-rose-600",
  },
  {
    id: "pie",
    label: "Gráfica Circular",
    icon: <PieChart size={22} />,
    desc: "Distribución por estado o categoría",
    color: "bg-cyan-50 text-cyan-600",
  },
];

type PlacedWidget = {
  id: string;
  widgetId: string;
  label: string;
  col: number;
  row: number;
  w: number;
  h: number;
};

function EditorView() {
  const [placed, setPlaced] = useState<PlacedWidget[]>([
    {
      id: "p1",
      widgetId: "kpi",
      label: "Tarjeta KPI",
      col: 1,
      row: 1,
      w: 2,
      h: 1,
    },
    {
      id: "p2",
      widgetId: "bar",
      label: "Gráfica de Barras",
      col: 3,
      row: 1,
      w: 4,
      h: 2,
    },
    {
      id: "p3",
      widgetId: "table",
      label: "Tabla de Tareas",
      col: 1,
      row: 2,
      w: 4,
      h: 2,
    },
  ]);
  const [selected, setSelected] = useState<PlacedWidget | null>(
    null,
  );
  const [history, setHistory] = useState<PlacedWidget[][]>([]);
  const [dragging, setDragging] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const push = (next: PlacedWidget[]) => {
    setHistory((h) => [...h.slice(-20), placed]);
    setPlaced(next);
  };

  const undo = () => {
    if (!history.length) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setPlaced(prev);
    setSelected(null);
  };

  const addWidget = (wid: (typeof WIDGET_CATALOG)[0]) => {
    const next: PlacedWidget = {
      id: `p${Date.now()}`,
      widgetId: wid.id,
      label: wid.label,
      col: 1,
      row: placed.length + 1,
      w: 3,
      h: 1,
    };
    push([...placed, next]);
    setSelected(next);
  };

  const removeSelected = () => {
    if (!selected) return;
    push(placed.filter((p) => p.id !== selected.id));
    setSelected(null);
  };

  const updateProp = (
    field: keyof PlacedWidget,
    val: number,
  ) => {
    if (!selected) return;
    const updated = placed.map((p) =>
      p.id === selected.id ? { ...p, [field]: val } : p,
    );
    push(updated);
    setSelected((s) => (s ? { ...s, [field]: val } : s));
  };

  const saveLayout = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div
      className="flex-1 flex flex-col overflow-hidden"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      {/* Editor toolbar */}
      <div className="h-11 bg-card border-b border-border flex items-center px-4 gap-3 flex-shrink-0">
        <Breadcrumbs
          items={["Dashboard", "Editor de Vistas"]}
        />
        <div className="flex-1" />
        <button
          onClick={undo}
          disabled={!history.length}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border text-muted-foreground hover:bg-secondary transition-colors disabled:opacity-30"
        >
          <Undo2 size={13} />
          Deshacer
        </button>
        <button
          onClick={saveLayout}
          className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md font-semibold transition-all ${saved ? "bg-emerald-500 text-white" : "bg-primary text-primary-foreground hover:bg-primary/90"}`}
        >
          {saved ? (
            <>
              <Check size={13} />
              Guardado
            </>
          ) : (
            <>
              <Save size={13} />
              Guardar Vista
            </>
          )}
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left: Widget catalog */}
        <div className="w-56 bg-card border-r border-border flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <div className="text-xs font-semibold text-foreground uppercase tracking-wide">
              Catálogo de Widgets
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              Haz clic para añadir al canvas
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {WIDGET_CATALOG.map((wid) => (
              <button
                key={wid.id}
                onClick={() => addWidget(wid)}
                className="w-full text-left p-3 rounded-lg border border-border hover:border-primary/40 hover:bg-secondary/50 transition-all group"
              >
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center mb-2 ${wid.color}`}
                >
                  {wid.icon}
                </div>
                <div className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                  {wid.label}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">
                  {wid.desc}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Center: Canvas */}
        <div className="flex-1 overflow-auto p-5 bg-muted/40">
          <div className="text-xs text-muted-foreground mb-3 flex items-center gap-2">
            <Maximize2 size={11} />
            Canvas — 12 columnas · Snap a cuadrícula
          </div>
          <div
            className="relative bg-card rounded-xl border-2 border-dashed border-border min-h-96 overflow-hidden"
            style={{
              backgroundImage:
                "radial-gradient(circle, rgba(0,0,0,0.06) 1px, transparent 1px)",
              backgroundSize: "28px 28px",
            }}
          >
            {placed.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-8">
                <Layers
                  size={32}
                  className="text-muted-foreground/40 mb-3"
                />
                <div className="text-sm font-semibold text-muted-foreground">
                  Canvas vacío
                </div>
                <div className="text-xs text-muted-foreground/60 mt-1">
                  Selecciona widgets del panel izquierdo para
                  añadirlos
                </div>
              </div>
            )}
            <div className="p-4 grid grid-cols-6 gap-3 auto-rows-min">
              {placed.map((pw) => {
                const wdef = WIDGET_CATALOG.find(
                  (w) => w.id === pw.widgetId,
                );
                const isSelected = selected?.id === pw.id;
                return (
                  <div
                    key={pw.id}
                    onClick={() =>
                      setSelected(isSelected ? null : pw)
                    }
                    draggable
                    onDragStart={() => setDragging(pw.id)}
                    onDragEnd={() => setDragging(null)}
                    style={{
                      gridColumn: `span ${Math.min(pw.w, 6)}`,
                      gridRow: `span ${pw.h}`,
                    }}
                    className={`relative rounded-lg border-2 p-3 cursor-pointer transition-all min-h-20 flex flex-col ${
                      isSelected
                        ? "border-primary bg-primary/5 shadow-lg shadow-primary/10"
                        : dragging === pw.id
                          ? "border-accent/60 bg-accent/5 opacity-70"
                          : "border-border bg-white hover:border-primary/30 hover:shadow-sm"
                    }`}
                  >
                    <div className="flex items-start gap-2 mb-2">
                      <GripVertical
                        size={13}
                        className="text-muted-foreground/40 mt-0.5 flex-shrink-0"
                      />
                      <div
                        className={`p-1.5 rounded ${wdef?.color ?? ""}`}
                      >
                        {wdef?.icon && (
                          <div className="scale-75">
                            {wdef.icon}
                          </div>
                        )}
                      </div>
                      <div className="text-xs font-semibold text-foreground flex-1">
                        {pw.label}
                      </div>
                      {isSelected && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeSelected();
                          }}
                          className="text-muted-foreground hover:text-red-500 transition-colors"
                        >
                          <X size={13} />
                        </button>
                      )}
                    </div>
                    <div className="flex-1 rounded bg-muted/40 flex items-center justify-center">
                      <span className="text-[10px] text-muted-foreground/50">
                        Vista previa
                      </span>
                    </div>
                    {isSelected && (
                      <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-primary rounded-full ring-2 ring-white" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Properties */}
        <div className="w-56 bg-card border-l border-border flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <div className="text-xs font-semibold text-foreground uppercase tracking-wide">
              Propiedades
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              {selected
                ? selected.label
                : "Selecciona un widget"}
            </div>
          </div>
          {selected ? (
            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              {/* Content */}
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
                  <AlignLeft size={10} />
                  Contenido
                </div>
                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">
                      Etiqueta
                    </label>
                    <input
                      defaultValue={selected.label}
                      className="w-full text-xs bg-input-background border border-border rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring/30"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">
                      Fuente de datos
                    </label>
                    <select className="w-full text-xs bg-input-background border border-border rounded-md px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-ring/30">
                      <option>Auditorías activas</option>
                      <option>Hallazgos abiertos</option>
                      <option>Horas registradas</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Style */}
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Palette size={10} />
                  Estilo
                </div>
                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">
                      Color de acento
                    </label>
                    <div className="flex gap-1.5">
                      {[
                        "#1A4FA0",
                        "#16a34a",
                        "#d97706",
                        "#C8271C",
                        "#7C3AED",
                      ].map((c) => (
                        <button
                          key={c}
                          className="w-5 h-5 rounded-full border-2 border-white ring-1 ring-border hover:ring-primary transition-all"
                          style={{ background: c }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Size */}
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Maximize2 size={10} />
                  Tamaño
                </div>
                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">
                      Ancho (columnas)
                    </label>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5, 6].map((n) => (
                        <button
                          key={n}
                          onClick={() => updateProp("w", n)}
                          className={`flex-1 py-1 text-[10px] rounded font-medium transition-colors ${selected.w === n ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-secondary"}`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">
                      Alto (filas)
                    </label>
                    <div className="flex gap-1">
                      {[1, 2, 3].map((n) => (
                        <button
                          key={n}
                          onClick={() => updateProp("h", n)}
                          className={`flex-1 py-1 text-[10px] rounded font-medium transition-colors ${selected.h === n ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-secondary"}`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
              <Layers
                size={28}
                className="text-muted-foreground/30 mb-3"
              />
              <div className="text-xs text-muted-foreground">
                Haz clic en un widget del canvas para editar sus
                propiedades
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── View 4: HIERARCHY / CATALOG (drill-down) ───────────────────────────────
type TreeNode = {
  id: string;
  label: string;
  type: string;
  children?: TreeNode[];
  risks?: number;
  hasCritical?: boolean;
};

const TREE: TreeNode[] = [
  {
    id: "n1",
    label: "Servicios Financieros",
    type: "Negocio",
    risks: 14,
    hasCritical: true,
    children: [
      {
        id: "n1-1",
        label: "Banca Corporativa",
        type: "Unidad de Negocio",
        risks: 8,
        hasCritical: true,
        children: [
          {
            id: "n1-1-1",
            label: "División Crédito Empresarial",
            type: "División",
            risks: 5,
            hasCritical: true,
            children: [
              {
                id: "n1-1-1-1",
                label: "Área de Riesgo Crediticio",
                type: "Área",
                risks: 3,
                hasCritical: true,
                children: [
                  {
                    id: "n1-1-1-1-1",
                    label: "México",
                    type: "País",
                    risks: 2,
                    hasCritical: true,
                  },
                  {
                    id: "n1-1-1-1-2",
                    label: "Colombia",
                    type: "País",
                    risks: 1,
                    hasCritical: false,
                  },
                ],
              },
              {
                id: "n1-1-1-2",
                label: "Área de Tesorería",
                type: "Área",
                risks: 0,
                hasCritical: false,
              },
            ],
          },
        ],
      },
      {
        id: "n1-2",
        label: "Banca Personas",
        type: "Unidad de Negocio",
        risks: 6,
        hasCritical: false,
        children: [
          {
            id: "n1-2-1",
            label: "División Productos Digitales",
            type: "División",
            risks: 4,
            hasCritical: false,
            children: [
              {
                id: "n1-2-1-1",
                label: "Área de Pagos",
                type: "Área",
                risks: 2,
                hasCritical: false,
                children: [
                  {
                    id: "n1-2-1-1-1",
                    label: "Brasil",
                    type: "País",
                    risks: 2,
                    hasCritical: false,
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "n2",
    label: "Tecnología & Operaciones",
    type: "Negocio",
    risks: 11,
    hasCritical: false,
    children: [
      {
        id: "n2-1",
        label: "Infraestructura TI",
        type: "Unidad de Negocio",
        risks: 6,
        hasCritical: false,
        children: [
          {
            id: "n2-1-1",
            label: "División Ciberseguridad",
            type: "División",
            risks: 4,
            hasCritical: false,
            children: [
              {
                id: "n2-1-1-1",
                label: "Área de SOC",
                type: "Área",
                risks: 3,
                hasCritical: false,
                children: [
                  {
                    id: "n2-1-1-1-1",
                    label: "Argentina",
                    type: "País",
                    risks: 3,
                    hasCritical: false,
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        id: "n2-2",
        label: "Operaciones LATAM",
        type: "Unidad de Negocio",
        risks: 5,
        hasCritical: false,
        children: [
          {
            id: "n2-2-1",
            label: "División Procesos",
            type: "División",
            risks: 5,
            hasCritical: false,
            children: [
              {
                id: "n2-2-1-1",
                label: "Área de Back-Office",
                type: "Área",
                risks: 2,
                hasCritical: false,
                children: [
                  {
                    id: "n2-2-1-1-1",
                    label: "Chile",
                    type: "País",
                    risks: 2,
                    hasCritical: false,
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "n3",
    label: "Cumplimiento & Legal",
    type: "Negocio",
    risks: 7,
    hasCritical: false,
    children: [
      {
        id: "n3-1",
        label: "Regulatorio LATAM",
        type: "Unidad de Negocio",
        risks: 7,
        hasCritical: false,
        children: [
          {
            id: "n3-1-1",
            label: "División Normativa",
            type: "División",
            risks: 7,
            hasCritical: false,
            children: [
              {
                id: "n3-1-1-1",
                label: "Área de Compliance",
                type: "Área",
                risks: 4,
                hasCritical: false,
                children: [
                  {
                    id: "n3-1-1-1-1",
                    label: "Perú",
                    type: "País",
                    risks: 2,
                    hasCritical: false,
                  },
                  {
                    id: "n3-1-1-1-2",
                    label: "Uruguay",
                    type: "País",
                    risks: 2,
                    hasCritical: false,
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
];

const RISK_TABLE_ALL = [
  {
    id: "RIE-0187",
    name: "Error Material — Cierre Financiero",
    nivel: "Crítico",
    status: "in_progress" as StatusKey,
    area: "Banca Corporativa",
    pais: "México",
  },
  {
    id: "RIE-0188",
    name: "Acceso no autorizado a datos sensibles",
    nivel: "Alto",
    status: "overdue" as StatusKey,
    area: "Infraestructura TI",
    pais: "Brasil",
  },
  {
    id: "RIE-0190",
    name: "Concentración de contraparte — Crédito",
    nivel: "Medio",
    status: "pending" as StatusKey,
    area: "Banca Corporativa",
    pais: "Colombia",
  },
  {
    id: "RIE-0192",
    name: "Incumplimiento GDPR en app móvil",
    nivel: "Alto",
    status: "in_progress" as StatusKey,
    area: "Productos Digitales",
    pais: "Brasil",
  },
  {
    id: "RIE-0193",
    name: "Falta de segregación — Tesorería",
    nivel: "Medio",
    status: "pending" as StatusKey,
    area: "Banca Corporativa",
    pais: "México",
  },
  {
    id: "RIE-0194",
    name: "Brecha de política BYOD — SOC",
    nivel: "Bajo",
    status: "completed" as StatusKey,
    area: "Infraestructura TI",
    pais: "Argentina",
  },
  {
    id: "RIE-0195",
    name: "Incumplimiento normativa local — SUNAT",
    nivel: "Alto",
    status: "in_progress" as StatusKey,
    area: "Regulatorio LATAM",
    pais: "Perú",
  },
  {
    id: "RIE-0196",
    name: "Control KYC desactualizado",
    nivel: "Medio",
    status: "pending" as StatusKey,
    area: "Cumplimiento & Legal",
    pais: "Uruguay",
  },
  {
    id: "RIE-0197",
    name: "Retrasos en reconciliación — Back-Office",
    nivel: "Bajo",
    status: "in_progress" as StatusKey,
    area: "Operaciones LATAM",
    pais: "Chile",
  },
  {
    id: "RIE-0198",
    name: "Configuración firewall — Colombia",
    nivel: "Alto",
    status: "overdue" as StatusKey,
    area: "Infraestructura TI",
    pais: "Colombia",
  },
];

// Flatten tree to all nodes with their ancestor paths (for search)
function flattenTree(
  nodes: TreeNode[],
  ancestors: TreeNode[] = [],
): { node: TreeNode; path: TreeNode[] }[] {
  return nodes.flatMap((n) => [
    { node: n, path: ancestors },
    ...flattenTree(n.children ?? [], [...ancestors, n]),
  ]);
}

const ALL_NODES = flattenTree(TREE);

// Collect all labels under a subtree (for risk table filtering)
function collectLabels(node: TreeNode): string[] {
  return [
    node.label,
    ...(node.children ?? []).flatMap(collectLabels),
  ];
}

function riskColor(node: TreeNode): {
  stripe: string;
  badge: string;
  dot: string;
  label: string;
} {
  if (node.hasCritical || (node.risks ?? 0) >= 6)
    return {
      stripe: "bg-red-500",
      badge: "bg-red-50 text-red-700 border border-red-200",
      dot: "bg-red-500",
      label: "Crítico",
    };
  if ((node.risks ?? 0) >= 3)
    return {
      stripe: "bg-amber-400",
      badge:
        "bg-amber-50 text-amber-700 border border-amber-200",
      dot: "bg-amber-400",
      label: "Alto",
    };
  if ((node.risks ?? 0) >= 1)
    return {
      stripe: "bg-emerald-500",
      badge:
        "bg-emerald-50 text-emerald-700 border border-emerald-200",
      dot: "bg-emerald-500",
      label: "Normal",
    };
  return {
    stripe: "bg-slate-300",
    badge: "bg-slate-50 text-slate-500 border border-slate-200",
    dot: "bg-slate-300",
    label: "Sin riesgos",
  };
}

const NIVEL_COLOR: Record<string, string> = {
  Crítico: "text-red-700 bg-red-50 border border-red-200",
  Alto: "text-orange-700 bg-orange-50 border border-orange-200",
  Medio: "text-amber-700 bg-amber-50 border border-amber-200",
  Bajo: "text-emerald-700 bg-emerald-50 border border-emerald-200",
};

const TYPE_COLORS: Record<string, string> = {
  Negocio: "bg-blue-100 text-blue-700",
  "Unidad de Negocio": "bg-violet-100 text-violet-700",
  División: "bg-emerald-100 text-emerald-700",
  Área: "bg-amber-100 text-amber-700",
  País: "bg-slate-100 text-slate-600",
};

// Tree view helper (for the toggle mode)
function TreeRow({
  node,
  depth,
  expanded,
  onToggle,
  onJump,
  completedIds,
}: {
  node: TreeNode;
  depth: number;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onJump: (path: TreeNode[]) => void;
  completedIds: Set<string>;
}) {
  const isOpen = expanded.has(node.id);
  const hasChildren = !!node.children?.length;
  const col = riskColor(node);
  const nodeAllLabels = collectLabels(node);
  const nodeRisksForTree = RISK_TABLE_ALL.filter(r =>
    nodeAllLabels.some(l => r.pais === l || r.area.includes(l))
  );
  const completedCountTree = nodeRisksForTree.filter(r => completedIds.has(r.id)).length;
  const allCompletedTree = nodeRisksForTree.length > 0 && completedCountTree === nodeRisksForTree.length;
  const partialCompletedTree = completedCountTree > 0 && !allCompletedTree;

  return (
    <>
      <div
        className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-secondary/50 cursor-pointer group"
        style={{ paddingLeft: `${8 + depth * 18}px` }}
        onClick={() =>
          hasChildren ? onToggle(node.id) : undefined
        }
      >
        <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
          {hasChildren ? (
            isOpen ? (
              <ChevronDown
                size={13}
                className="text-muted-foreground"
              />
            ) : (
              <ChevronRight
                size={13}
                className="text-muted-foreground"
              />
            )
          ) : (
            <Circle
              size={4}
              className="text-muted-foreground/50"
            />
          )}
        </div>
        <span
          className={`text-[9px] px-1.5 py-0.5 rounded font-semibold flex-shrink-0 ${TYPE_COLORS[node.type] ?? "bg-gray-100 text-gray-600"}`}
        >
          {node.type}
        </span>
        <span className="text-sm font-medium text-foreground flex-1 group-hover:text-primary transition-colors">
          {node.label}
        </span>
        {allCompletedTree && (
          <CheckCircle2 size={13} className="text-emerald-500 flex-shrink-0" title="Todos los riesgos completados" />
        )}
        {partialCompletedTree && (
          <div
            className="w-3.5 h-3.5 rounded-full border-2 border-emerald-400 bg-emerald-100 flex-shrink-0"
            title={`${completedCountTree} de ${nodeRisksForTree.length} realizados`}
          />
        )}
        <span
          className={`w-2 h-2 rounded-full flex-shrink-0 ${col.dot}`}
        />
        {node.risks !== undefined && node.risks > 0 && (
          <span
            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded font-mono ${col.badge}`}
          >
            {node.risks}
          </span>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onJump([]);
          }}
          className="opacity-0 group-hover:opacity-100 text-[10px] text-accent font-medium hover:underline transition-opacity ml-1"
        >
          Ir →
        </button>
      </div>
      {isOpen &&
        node.children?.map((c) => (
          <TreeRow
            key={c.id}
            node={c}
            depth={depth + 1}
            expanded={expanded}
            onToggle={onToggle}
            onJump={onJump}
            completedIds={completedIds}
          />
        ))}
    </>
  );
}

function HierarchyView() {
  // Drill-down path: array of ancestors navigated into
  const [path, setPath] = useState<TreeNode[]>([]);
  const [viewMode, setViewMode] = useState<"cards" | "tree">(
    "cards",
  );
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [nivelFilter, setNivelFilter] = useState<string>("all");
  const [treeExpanded, setTreeExpanded] = useState<Set<string>>(
    new Set(["n1", "n2", "n3"]),
  );
  const [completedIds, setCompletedIds] = useState<Set<string>>(
    () => new Set(RISK_TABLE_ALL.filter(r => r.status === "completed").map(r => r.id))
  );
  const [showOnlyCompleted, setShowOnlyCompleted] = useState(false);

  const toggleComplete = (riskId: string) => {
    const wasCompleted = completedIds.has(riskId);
    const prevIds = new Set(completedIds);
    setCompletedIds(prev => {
      const next = new Set(prev);
      wasCompleted ? next.delete(riskId) : next.add(riskId);
      return next;
    });
    if (!wasCompleted) {
      const risk = RISK_TABLE_ALL.find(r => r.id === riskId);
      toast.success("Riesgo marcado como realizado", {
        description: risk?.name,
        action: { label: "Deshacer", onClick: () => setCompletedIds(prevIds) },
        duration: 4500,
      });
    }
  };

  const getNodeCompletion = (node: TreeNode) => {
    const labels = collectLabels(node);
    const risks = RISK_TABLE_ALL.filter(r => labels.some(l => r.pais === l || r.area.includes(l)));
    const completed = risks.filter(r => completedIds.has(r.id)).length;
    return { total: risks.length, completed };
  };

  // Current children to display as cards
  const currentNode =
    path.length > 0 ? path[path.length - 1] : null;
  const currentChildren: TreeNode[] = currentNode
    ? (currentNode.children ?? [])
    : TREE;
  const isLeaf = currentChildren.length === 0;

  // Navigate into a node
  const drillInto = (node: TreeNode) => {
    setPath([...path, node]);
    setNivelFilter("all");
    setSearch("");
    setSearchFocused(false);
  };

  // Jump to a specific breadcrumb level
  const jumpToLevel = (index: number) => {
    setPath(path.slice(0, index + 1));
    setNivelFilter("all");
  };

  // Jump to root
  const goRoot = () => {
    setPath([]);
    setNivelFilter("all");
  };

  // Search autocomplete results
  const searchResults =
    search.trim().length >= 1
      ? ALL_NODES.filter(({ node }) =>
          node.label
            .toLowerCase()
            .includes(search.toLowerCase()),
        ).slice(0, 7)
      : [];

  // Jump directly to any search result
  const jumpToNode = (entry: {
    node: TreeNode;
    path: TreeNode[];
  }) => {
    setPath([...entry.path, entry.node]);
    setSearch("");
    setSearchFocused(false);
    setNivelFilter("all");
  };

  // Risk table: at leaf (no children) show all risks matching current node labels
  const nodeLabels = currentNode
    ? collectLabels(currentNode)
    : [];
  const baseRisks =
    isLeaf && currentNode
      ? RISK_TABLE_ALL.filter((r) =>
          nodeLabels.some(
            (l) => r.pais === l || r.area.includes(l),
          ),
        )
      : RISK_TABLE_ALL;
  const byNivel = nivelFilter === "all" ? baseRisks : baseRisks.filter((r) => r.nivel === nivelFilter);
  const filteredRisks = showOnlyCompleted ? byNivel.filter(r => completedIds.has(r.id)) : byNivel;

  const toggleTreeNode = (id: string) => {
    setTreeExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div
      className="flex-1 overflow-auto flex flex-col"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      {/* ── Page header ── */}
      <div className="px-6 pt-5 pb-0 flex-shrink-0">
        {/* Macro breadcrumb (page location) */}
        <nav className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
          <span className="hover:text-foreground cursor-pointer transition-colors">
            Inicio
          </span>
          <ChevronRight
            size={11}
            className="text-muted-foreground/40"
          />
          <span className="text-foreground font-medium">
            Catálogo Organizacional
          </span>
        </nav>

        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">
              Catálogo Organizacional
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Navega la estructura corporativa y consulta los
              riesgos de cada entidad
            </p>
          </div>
          {/* View mode toggle */}
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            <button
              onClick={() => setViewMode("cards")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${viewMode === "cards" ? "bg-white text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Layers size={12} />
              Vista de tarjetas
            </button>
            <button
              onClick={() => setViewMode("tree")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${viewMode === "tree" ? "bg-white text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              <GitBranch size={12} />
              Vista de árbol
            </button>
          </div>
        </div>

        {/* Search bar */}
        <div className="relative mb-4 max-w-xl">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() =>
              setTimeout(() => setSearchFocused(false), 150)
            }
            placeholder="Buscar entidad… ej. Brasil, División Ciberseguridad, Banca Corporativa"
            className="w-full bg-card border border-border rounded-lg pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring/30 shadow-sm placeholder:text-muted-foreground"
          />
          {/* Autocomplete dropdown */}
          {searchFocused && searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-10 overflow-hidden">
              {searchResults.map(({ node, path: nodePath }) => {
                const col = riskColor(node);
                return (
                  <button
                    key={node.id}
                    onMouseDown={() =>
                      jumpToNode({ node, path: nodePath })
                    }
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-secondary/60 text-left transition-colors border-b border-border/50 last:border-0"
                  >
                    <span
                      className={`w-2 h-2 rounded-full flex-shrink-0 ${col.dot}`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-foreground">
                        {node.label}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {nodePath
                          .map((p) => p.label)
                          .join(" › ")}
                        {nodePath.length > 0 && " › "}
                        <span className="font-medium">
                          {node.label}
                        </span>
                      </div>
                    </div>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded font-semibold flex-shrink-0 ${TYPE_COLORS[node.type]}`}
                    >
                      {node.type}
                    </span>
                    {(node.risks ?? 0) > 0 && (
                      <span
                        className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded flex-shrink-0 ${col.badge}`}
                      >
                        {node.risks} riesgos
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
          {searchFocused &&
            search.trim().length >= 1 &&
            searchResults.length === 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-10 px-4 py-3 text-sm text-muted-foreground">
                Sin resultados para "{search}"
              </div>
            )}
        </div>

        {/* Drill-down breadcrumb — only in card mode */}
        {viewMode === "cards" && (
          <div className="flex items-center gap-1 flex-wrap mb-5">
            <button
              onClick={goRoot}
              className={`text-sm px-2 py-0.5 rounded transition-colors ${path.length === 0 ? "font-bold text-primary" : "text-muted-foreground hover:text-foreground"}`}
            >
              Todos los negocios
            </button>
            {path.map((node, i) => (
              <span
                key={node.id}
                className="flex items-center gap-1"
              >
                <ChevronRight
                  size={13}
                  className="text-muted-foreground/50"
                />
                <button
                  onClick={() => jumpToLevel(i)}
                  className={`text-sm px-2 py-0.5 rounded transition-colors ${i === path.length - 1 ? "font-bold text-primary bg-primary/8" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {node.label}
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── Content area ── */}
      <div className="flex-1 overflow-auto px-6 pb-6">
        {/* ── TREE VIEW MODE ── */}
        {viewMode === "tree" && (
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs text-muted-foreground font-medium">
                Vista completa de la jerarquía
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={() =>
                    setTreeExpanded(
                      new Set([
                        "n1",
                        "n1-1",
                        "n1-1-1",
                        "n1-1-1-1",
                        "n1-2",
                        "n1-2-1",
                        "n1-2-1-1",
                        "n2",
                        "n2-1",
                        "n2-1-1",
                        "n2-2",
                        "n2-2-1",
                        "n3",
                        "n3-1",
                        "n3-1-1",
                      ]),
                    )
                  }
                  className="text-[10px] px-2 py-1 rounded border border-border text-muted-foreground hover:bg-secondary transition-colors"
                >
                  Expandir todo
                </button>
                <button
                  onClick={() => setTreeExpanded(new Set())}
                  className="text-[10px] px-2 py-1 rounded border border-border text-muted-foreground hover:bg-secondary transition-colors"
                >
                  Colapsar
                </button>
              </div>
            </div>
            <div className="space-y-0.5">
              {TREE.map((n) => (
                <TreeRow
                  key={n.id}
                  node={n}
                  depth={0}
                  expanded={treeExpanded}
                  onToggle={toggleTreeNode}
                  onJump={setPath}
                  completedIds={completedIds}
                />
              ))}
            </div>
          </Card>
        )}

        {/* ── CARD / DRILL-DOWN MODE ── */}
        {viewMode === "cards" && (
          <>
            {/* Current level label */}
            {!isLeaf && (
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                  {currentNode
                    ? `${currentChildren[0]?.type ?? "Nodo"}s en ${currentNode.label}`
                    : "Unidades de Negocio"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {currentChildren.length} entidades
                </div>
              </div>
            )}

            {/* Cards grid */}
            {!isLeaf && (
              <div className="grid grid-cols-3 gap-4 mb-6">
                {currentChildren.map((node) => {
                  const col = riskColor(node);
                  const hasKids = !!node.children?.length;
                  const { total: nodeTotal, completed: nodeCompleted } = getNodeCompletion(node);
                  const allNodeComplete = nodeTotal > 0 && nodeCompleted === nodeTotal;
                  const pct = nodeTotal > 0 ? Math.round(nodeCompleted / nodeTotal * 100) : 0;
                  return (
                    <button
                      key={node.id}
                      onClick={() => drillInto(node)}
                      className="text-left bg-card border border-border rounded-xl overflow-hidden hover:border-primary/50 hover:shadow-md transition-all group"
                    >
                      {/* Color stripe */}
                      <div
                        className={`h-1.5 w-full ${allNodeComplete ? "bg-emerald-500" : col.stripe}`}
                      />
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div>
                            <span
                              className={`text-[10px] font-semibold px-2 py-0.5 rounded mb-1.5 inline-block ${TYPE_COLORS[node.type] ?? ""}`}
                            >
                              {node.type}
                            </span>
                            <div className="text-base font-bold text-foreground leading-tight group-hover:text-primary transition-colors">
                              {node.label}
                            </div>
                          </div>
                          <ChevronRight
                            size={16}
                            className="text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0 mt-1"
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span
                              className={`w-2 h-2 rounded-full ${allNodeComplete ? "bg-emerald-500" : col.dot}`}
                            />
                            {allNodeComplete ? (
                              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Completado
                              </span>
                            ) : (
                              <span
                                className={`text-xs font-semibold px-2 py-0.5 rounded-full ${col.badge}`}
                              >
                                {col.label}
                              </span>
                            )}
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-foreground leading-none">
                              {node.risks ?? 0}
                            </div>
                            <div className="text-[10px] text-muted-foreground">
                              riesgos
                            </div>
                          </div>
                        </div>
                        {nodeTotal > 0 && (
                          <div className="mt-2.5">
                            <div className="flex items-center gap-1.5 mb-1">
                              <CheckCircle2
                                size={11}
                                className={`flex-shrink-0 ${allNodeComplete ? "text-emerald-500" : "text-muted-foreground/60"}`}
                              />
                              <span className="text-xs text-muted-foreground">
                                {nodeCompleted} / {nodeTotal} realizados
                              </span>
                            </div>
                            <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        )}
                        {hasKids && (
                          <div className="mt-3 pt-3 border-t border-border/60 flex items-center gap-1 text-xs text-muted-foreground">
                            <span>
                              {node.children!.length}{" "}
                              {node.children![0]?.type ??
                                "sub-entidades"}
                              {node.children!.length > 1
                                ? "s"
                                : ""}
                            </span>
                            <span className="ml-auto text-primary font-medium group-hover:underline">
                              Ver detalle →
                            </span>
                          </div>
                        )}
                        {!hasKids && (
                          <div className="mt-3 pt-3 border-t border-border/60 text-xs text-primary font-medium group-hover:underline">
                            Ver riesgos asociados →
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* ── RISK TABLE — shown at leaf or when root and wanting risks ── */}
            {(isLeaf || path.length > 0) && (
              <Card>
                <div className="px-4 pt-4 pb-3 border-b border-border flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <Shield
                      size={15}
                      className="text-primary flex-shrink-0"
                    />
                    <div>
                      <div className="text-sm font-semibold text-foreground">
                        Riesgos{" "}
                        {currentNode
                          ? `— ${currentNode.label}`
                          : ""}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {isLeaf
                          ? "Nivel final de la jerarquía"
                          : "Todos los riesgos de esta rama"}
                      </div>
                    </div>
                    <span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full font-semibold">
                      {filteredRisks.length}
                    </span>
                  </div>
                  <button
                    onClick={() => exportToCSV(
                      "riesgos_catalogo.csv",
                      ["ID", "Nombre", "Nivel", "Área", "País", "Estatus"],
                      filteredRisks.map(r => [r.id, r.name, r.nivel, r.area, r.pais, completedIds.has(r.id) ? "Completado" : r.status])
                    )}
                    className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border border-border text-muted-foreground hover:bg-secondary transition-colors"
                  >
                    <Download size={12} /> Exportar CSV
                  </button>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Filter
                      size={12}
                      className="text-muted-foreground"
                    />
                    {(
                      [
                        "all",
                        "Crítico",
                        "Alto",
                        "Medio",
                        "Bajo",
                      ] as const
                    ).map((f) => (
                      <button
                        key={f}
                        onClick={() => setNivelFilter(f)}
                        className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${nivelFilter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}
                      >
                        {f === "all" ? "Todos" : f}
                      </button>
                    ))}
                    <div className="w-px h-4 bg-border mx-0.5 flex-shrink-0" />
                    <button
                      onClick={() => setShowOnlyCompleted(s => !s)}
                      className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${
                        showOnlyCompleted
                          ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                          : "text-muted-foreground hover:bg-secondary"
                      }`}
                    >
                      <CheckCircle2 size={11} />
                      Ver solo realizados
                    </button>
                  </div>
                </div>

                {filteredRisks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                    <div className="relative w-16 h-16 mb-4">
                      <div className="absolute inset-0 rounded-full bg-emerald-50 border-2 border-emerald-200" />
                      <CheckCircle2
                        size={28}
                        className="absolute inset-0 m-auto text-emerald-500"
                      />
                    </div>
                    <div className="text-base font-bold text-foreground mb-1">
                      {showOnlyCompleted ? "Sin riesgos realizados" : "Sin riesgos registrados"}
                    </div>
                    <div className="text-sm text-muted-foreground max-w-xs">
                      {showOnlyCompleted
                        ? "No hay riesgos marcados como realizados con el filtro actual."
                        : nivelFilter !== "all"
                          ? `No hay riesgos de nivel "${nivelFilter}" en esta entidad. Prueba otro filtro.`
                          : "Esta entidad no tiene riesgos registrados en el sistema. ¡Bien!"}
                    </div>
                    {(nivelFilter !== "all" || showOnlyCompleted) && (
                      <button
                        onClick={() => { setNivelFilter("all"); setShowOnlyCompleted(false); }}
                        className="mt-3 text-xs text-accent font-semibold hover:underline"
                      >
                        Limpiar filtros
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="overflow-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/30">
                          <th className="px-4 py-2.5 w-10 flex-shrink-0" />
                          <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            ID / Riesgo
                          </th>
                          <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            Nivel
                          </th>
                          <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            Área
                          </th>
                          <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            País
                          </th>
                          <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            Estatus
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {filteredRisks.map((r) => {
                          const done = completedIds.has(r.id);
                          return (
                            <tr
                              key={r.id}
                              className={`hover:bg-secondary/30 cursor-pointer group transition-colors ${done ? "opacity-60" : ""}`}
                            >
                              <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                                <button
                                  onClick={() => toggleComplete(r.id)}
                                  className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0 ${
                                    done
                                      ? "bg-emerald-500 border-emerald-500"
                                      : "border-border hover:border-emerald-400"
                                  }`}
                                >
                                  {done && <Check size={11} className="text-white" />}
                                </button>
                              </td>
                              <td className="px-4 py-3">
                                <div className="font-mono text-xs text-muted-foreground mb-0.5">
                                  {r.id}
                                </div>
                                <div className={`font-medium text-sm transition-colors ${done ? "line-through text-muted-foreground" : "text-foreground group-hover:text-primary"}`}>
                                  {r.name}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className={`text-xs font-semibold px-2 py-0.5 rounded-full ${NIVEL_COLOR[r.nivel]}`}
                                >
                                  {r.nivel}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-xs text-muted-foreground">
                                {r.area}
                              </td>
                              <td className="px-4 py-3 text-xs font-medium text-muted-foreground">
                                {r.pais}
                              </td>
                              <td className="px-4 py-3">
                                <StatusBadge status={done ? "completed" : r.status} />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            )}

            {/* Empty state at root with no selection */}
            {path.length === 0 && !isLeaf && (
              <div className="mt-2 text-xs text-muted-foreground text-center">
                Haz clic en una tarjeta para explorar su
                estructura interna
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Root App ────────────────────────────────────────────────────────────────
// ─── Settings View ───────────────────────────────────────────────────────────
function SettingsView({
  onOpenEditor,
}: {
  onOpenEditor: () => void;
}) {
  const [avatarSrc, setAvatarSrc] = useState<string | null>(
    null,
  );
  const [form, setForm] = useState({
    firstName: "María",
    lastName: "García",
    email: "m.garcia@auditcore.com",
    phone: "+34 91 555 0124",
    role: "Jefatura de Auditoría",
    department: "Auditoría Interna",
    location: "Madrid, España",
    bio: "",
  });
  const [saved, setSaved] = useState(false);

  const handleAvatarChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setAvatarSrc(url);
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const field = (
    label: string,
    key: keyof typeof form,
    placeholder?: string,
    type = "text",
  ) => (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        {label}
      </label>
      <input
        type={type}
        value={form[key]}
        onChange={(e) =>
          setForm((f) => ({ ...f, [key]: e.target.value }))
        }
        placeholder={placeholder}
        className="px-3 py-2 rounded-md border border-border bg-white text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition"
      />
    </div>
  );

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-8">
      <div>
        <h2 className="text-xl font-bold text-foreground">
          Ajustes del Sistema
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Administra tu perfil, información de contacto y la
          apariencia del dashboard.
        </p>
      </div>

      {/* Profile picture */}
      <section className="bg-white rounded-xl border border-border p-6 space-y-5">
        <div className="flex items-center gap-2 mb-1">
          <Users size={16} className="text-primary" />
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
            Foto de Perfil
          </h3>
        </div>
        <div className="flex items-center gap-6">
          <div className="relative flex-shrink-0">
            {avatarSrc ? (
              <img
                src={avatarSrc}
                alt="Avatar"
                className="w-20 h-20 rounded-full object-cover ring-4 ring-primary/20"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center ring-4 ring-primary/20">
                <span className="text-white text-2xl font-bold select-none">
                  MG
                </span>
              </div>
            )}
            <label className="absolute -bottom-1 -right-1 w-7 h-7 bg-white border-2 border-border rounded-full flex items-center justify-center cursor-pointer hover:bg-secondary transition-colors shadow-sm">
              <RefreshCw
                size={12}
                className="text-muted-foreground"
              />
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </label>
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">
              {form.firstName} {form.lastName}
            </p>
            <p className="text-xs text-muted-foreground">
              {form.role}
            </p>
            <label className="inline-flex items-center gap-1.5 mt-2 px-3 py-1.5 bg-secondary text-secondary-foreground text-xs font-semibold rounded-md cursor-pointer hover:bg-secondary/80 transition-colors">
              <Plus size={12} />
              Subir imagen
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </label>
            <p className="text-[10px] text-muted-foreground/60 mt-1">
              JPG, PNG o WebP · máx. 2 MB
            </p>
          </div>
        </div>
      </section>

      {/* Contact details */}
      <section className="bg-white rounded-xl border border-border p-6 space-y-5">
        <div className="flex items-center gap-2 mb-1">
          <FileText size={16} className="text-primary" />
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
            Datos de Contacto
          </h3>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {field("Nombre", "firstName", "María")}
          {field("Apellidos", "lastName", "García")}
          {field(
            "Correo electrónico",
            "email",
            "correo@empresa.com",
            "email",
          )}
          {field("Teléfono", "phone", "+34 91 000 0000")}
          {field(
            "Cargo / Rol",
            "role",
            "Jefatura de Auditoría",
          )}
          {field(
            "Departamento",
            "department",
            "Auditoría Interna",
          )}
          {field("Ubicación", "location", "Ciudad, País")}
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Biografía
          </label>
          <textarea
            value={form.bio}
            onChange={(e) =>
              setForm((f) => ({ ...f, bio: e.target.value }))
            }
            rows={3}
            placeholder="Breve descripción profesional (opcional)"
            className="px-3 py-2 rounded-md border border-border bg-white text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition resize-none"
          />
        </div>
        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={handleSave}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-md hover:bg-primary/90 transition-colors"
          >
            {saved ? <Check size={14} /> : <Save size={14} />}
            {saved ? "Guardado" : "Guardar cambios"}
          </button>
          {saved && (
            <span className="text-xs text-emerald-600 font-medium">
              Los cambios se guardaron correctamente.
            </span>
          )}
        </div>
      </section>

      {/* Dashboard appearance */}
      <section className="bg-white rounded-xl border border-border p-6">
        <div className="flex items-center gap-2 mb-1">
          <Layers size={16} className="text-primary" />
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
            Apariencia del Dashboard
          </h3>
        </div>
        <p className="text-sm text-muted-foreground mt-2 mb-5">
          Personaliza los widgets, el orden de las secciones y
          el diseño de tu vista de inicio usando el editor de
          layouts interactivo.
        </p>
        <div className="flex items-center gap-4 p-4 rounded-lg bg-secondary/50 border border-border">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Layers size={20} className="text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-foreground">
              Editor de Vistas
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Arrastra y suelta widgets, cambia tamaños y guarda
              tu layout personalizado.
            </div>
          </div>
          <button
            onClick={onOpenEditor}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-md hover:bg-primary/90 transition-colors flex-shrink-0"
          >
            <Eye size={14} />
            Abrir editor
          </button>
        </div>
      </section>

    </div>
  );
}

// ─── Bitácora View ───────────────────────────────────────────────────────────
// Maps an action string to one of the filter chip categories
function classifyAction(action: string): string {
  const a = action.toLowerCase();
  if (a.startsWith("creó") || a.startsWith("creo")) return "Creó";
  if (a.startsWith("modificó") || a.startsWith("modifico") || a.startsWith("asignó") || a.startsWith("marcó")) return "Modificó";
  if (a.startsWith("aprobó") || a.startsWith("aprobo")) return "Aprobó";
  if (a.startsWith("cargó") || a.startsWith("cargo")) return "Cargó evidencia";
  if (a.startsWith("exportó") || a.startsWith("exporto")) return "Exportó";
  if (a.startsWith("consultó") || a.startsWith("consulto")) return "Consultó";
  return "Otro";
}

// Maps an entity string to one of the entity type categories
function classifyEntity(entity: string): string {
  const e = entity.toLowerCase();
  if (e.startsWith("rie") || e.startsWith("rg-") || e.startsWith("riesgo")) return "Riesgos";
  if (e.startsWith("hal") || e.startsWith("hallazgo")) return "Hallazgos";
  if (e.startsWith("pai") || e.startsWith("plan")) return "Planes";
  if (e.startsWith("ctr") || e.startsWith("control")) return "Controles";
  if (e.startsWith("auditor") || e.startsWith("solo lectura") || e.startsWith("role")) return "Roles";
  if (e.startsWith("catálogo") || e.startsWith("catalogo")) return "Catálogo";
  return "Otro";
}

const ACTION_CHIPS = ["Todos", "Creó", "Modificó", "Aprobó", "Cargó evidencia", "Exportó", "Consultó"] as const;
const ENTITY_TYPES = ["Todos", "Riesgos", "Hallazgos", "Planes", "Controles", "Roles", "Catálogo"] as const;
const DATE_PRESETS = ["Todos", "Hoy", "Últimos 7 días", "Últimos 30 días", "Personalizado"] as const;
const PAGE_SIZE = 20;

function BitacoraView() {
  const [search, setSearch]         = useState("");
  const [actionChip, setActionChip] = useState<string>("Todos");
  const [entityType, setEntityType] = useState<string>("Todos");
  const [datePreset, setDatePreset] = useState<string>("Todos");
  const [dateFrom, setDateFrom]     = useState("");
  const [dateTo, setDateTo]         = useState("");
  const [userFilter, setUserFilter] = useState<string>("Todos");
  const [page, setPage]             = useState(1);

  const userList = ["Todos", ...Array.from(new Set(INITIAL_USERS.map(u => u.name)))];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const inDateRange = (dateStr: string): boolean => {
    const d = new Date(dateStr.slice(0, 10));
    if (datePreset === "Hoy") return d >= today;
    if (datePreset === "Últimos 7 días") { const t = new Date(today); t.setDate(t.getDate() - 6); return d >= t; }
    if (datePreset === "Últimos 30 días") { const t = new Date(today); t.setDate(t.getDate() - 29); return d >= t; }
    if (datePreset === "Personalizado") {
      if (dateFrom && d < new Date(dateFrom)) return false;
      if (dateTo   && d > new Date(dateTo))   return false;
    }
    return true;
  };

  const filtered = BITACORA_DATA.filter(b => {
    const q = search.trim().toLowerCase();
    if (q && !b.user.toLowerCase().includes(q) && !b.action.toLowerCase().includes(q) && !b.entity.toLowerCase().includes(q)) return false;
    if (actionChip !== "Todos" && classifyAction(b.action) !== actionChip) return false;
    if (entityType !== "Todos" && classifyEntity(b.entity) !== entityType) return false;
    if (userFilter !== "Todos" && b.user !== userFilter) return false;
    if (!inDateRange(b.date)) return false;
    return true;
  });

  const paginated = filtered.slice(0, page * PAGE_SIZE);
  const hasMore   = paginated.length < filtered.length;

  // Active filter chips for the "active filters" bar
  type ActiveFilter = { label: string; clear: () => void };
  const activeFilters: ActiveFilter[] = [];
  if (actionChip !== "Todos") activeFilters.push({ label: `Acción: ${actionChip}`, clear: () => setActionChip("Todos") });
  if (entityType !== "Todos") activeFilters.push({ label: `Entidad: ${entityType}`, clear: () => setEntityType("Todos") });
  if (userFilter !== "Todos") activeFilters.push({ label: `Usuario: ${userFilter}`, clear: () => setUserFilter("Todos") });
  if (datePreset !== "Todos") activeFilters.push({ label: datePreset === "Personalizado" ? `${dateFrom || "…"} → ${dateTo || "…"}` : datePreset, clear: () => { setDatePreset("Todos"); setDateFrom(""); setDateTo(""); } });
  if (search.trim()) activeFilters.push({ label: `"${search.trim()}"`, clear: () => setSearch("") });

  const clearAll = () => { setSearch(""); setActionChip("Todos"); setEntityType("Todos"); setUserFilter("Todos"); setDatePreset("Todos"); setDateFrom(""); setDateTo(""); setPage(1); };

  const handleExport = () => exportToCSV(
    "bitacora.csv",
    ["ID", "Usuario", "Acción", "Entidad", "Fecha"],
    filtered.map(b => [b.id, b.user, b.action, b.entity, b.date])
  );

  // Reset to page 1 whenever filters change
  const applyFilter = (fn: () => void) => { fn(); setPage(1); };

  return (
    <div className="flex-1 overflow-auto p-6" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <Breadcrumbs items={["Inicio", "Configuración", "Bitácora"]} />
      <PageHeader
        title="Bitácora de Actividad"
        subtitle="Registro completo de acciones realizadas por los usuarios del sistema."
        actions={
          <button onClick={handleExport}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border text-muted-foreground hover:bg-secondary transition-colors font-medium">
            <Download size={12} /> Exportar CSV
          </button>
        }
      />

      {/* ── Filter row 1: search + action chips ─────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar usuario, acción o entidad…"
            value={search}
            onChange={e => applyFilter(() => setSearch(e.target.value))}
            className="pl-8 pr-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 w-60"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {ACTION_CHIPS.map(chip => (
            <button key={chip}
              onClick={() => applyFilter(() => setActionChip(chip))}
              className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-colors ${
                actionChip === chip
                  ? "bg-primary text-white border-primary"
                  : "bg-background text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
              }`}>
              {chip}
            </button>
          ))}
        </div>
      </div>

      {/* ── Filter row 2: date, user, entity type ───────────────────────── */}
      <div className="flex flex-wrap gap-2 mb-3">
        {/* Date preset */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {DATE_PRESETS.map(p => (
            <button key={p}
              onClick={() => applyFilter(() => { setDatePreset(p); if (p !== "Personalizado") { setDateFrom(""); setDateTo(""); } })}
              className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
                datePreset === p
                  ? "bg-primary/10 text-primary border-primary/40"
                  : "bg-background text-muted-foreground border-border hover:border-primary/30"
              }`}>
              {p}
            </button>
          ))}
          {datePreset === "Personalizado" && (
            <div className="flex items-center gap-1.5 ml-1">
              <input type="date" value={dateFrom} onChange={e => applyFilter(() => setDateFrom(e.target.value))}
                className="text-xs px-2 py-1.5 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
              <span className="text-xs text-muted-foreground">→</span>
              <input type="date" value={dateTo} onChange={e => applyFilter(() => setDateTo(e.target.value))}
                className="text-xs px-2 py-1.5 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
          )}
        </div>

        {/* User dropdown */}
        <select value={userFilter} onChange={e => applyFilter(() => setUserFilter(e.target.value))}
          className="text-xs px-3 py-1.5 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer">
          {userList.map(u => <option key={u} value={u}>{u === "Todos" ? "Usuario: Todos" : u}</option>)}
        </select>

        {/* Entity type dropdown */}
        <select value={entityType} onChange={e => applyFilter(() => setEntityType(e.target.value))}
          className="text-xs px-3 py-1.5 border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer">
          {ENTITY_TYPES.map(t => <option key={t} value={t}>{t === "Todos" ? "Tipo de entidad: Todos" : t}</option>)}
        </select>
      </div>

      {/* ── Active filter chips ─────────────────────────────────────────── */}
      {activeFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {activeFilters.map((f, i) => (
            <span key={i} className="inline-flex items-center gap-1 text-xs bg-primary/8 text-primary border border-primary/20 px-2.5 py-1 rounded-full font-medium">
              {f.label}
              <button onClick={f.clear} className="ml-0.5 rounded-full hover:bg-primary/20 transition-colors p-0.5">
                <X size={10} />
              </button>
            </span>
          ))}
          <button onClick={clearAll} className="text-xs text-muted-foreground hover:text-primary underline-offset-2 hover:underline transition-colors">
            Limpiar filtros
          </button>
        </div>
      )}

      {/* ── Table ──────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <div className="px-6 py-3 border-b border-border bg-secondary/20 flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {filtered.length} {filtered.length === 1 ? "registro" : "registros"}
          </span>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Activity size={11} />
            Última actualización: {BITACORA_DATA[0]?.date ?? "—"}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                {["Usuario", "Acción", "Tipo", "Entidad afectada", "Fecha"].map(h => (
                  <th key={h} className="text-left px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-14 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Activity size={24} className="text-muted-foreground/30" />
                      <div className="text-sm font-semibold text-muted-foreground">Sin registros para los filtros seleccionados</div>
                      <button onClick={clearAll} className="text-xs text-primary hover:underline mt-1">Limpiar filtros</button>
                    </div>
                  </td>
                </tr>
              ) : paginated.map(b => {
                const cat = classifyAction(b.action);
                const catColor: Record<string, string> = {
                  "Creó":           "bg-emerald-50 text-emerald-700 border-emerald-200",
                  "Modificó":       "bg-blue-50 text-blue-700 border-blue-200",
                  "Aprobó":         "bg-violet-50 text-violet-700 border-violet-200",
                  "Cargó evidencia":"bg-amber-50 text-amber-700 border-amber-200",
                  "Exportó":        "bg-sky-50 text-sky-700 border-sky-200",
                  "Consultó":       "bg-secondary text-muted-foreground border-border",
                };
                return (
                  <tr key={b.id} className="hover:bg-secondary/20 transition-colors">
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-[10px] font-bold flex-shrink-0">
                          {b.user.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                        </div>
                        <span className="text-sm font-medium text-foreground">{b.user}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-sm text-foreground">{b.action}</td>
                    <td className="px-6 py-3">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${catColor[cat] ?? catColor["Consultó"]}`}>
                        {cat}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <span className="font-mono text-xs text-primary bg-primary/8 px-2 py-0.5 rounded-md">{b.entity}</span>
                    </td>
                    <td className="px-6 py-3 text-xs text-muted-foreground font-mono whitespace-nowrap">{b.date}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* ── Show more ───────────────────────────────────────────────── */}
        {hasMore && (
          <div className="px-6 py-4 border-t border-border flex items-center justify-between bg-secondary/10">
            <span className="text-xs text-muted-foreground">Mostrando {paginated.length} de {filtered.length} registros</span>
            <button onClick={() => setPage(p => p + 1)}
              className="text-xs px-4 py-1.5 rounded-lg border border-border bg-background text-foreground font-medium hover:bg-secondary transition-colors">
              Mostrar más
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Users & Roles View ──────────────────────────────────────────────────────
function UsersRolesView() {
  const [selectedRole, setSelectedRole] = useState("Jefe de Auditoría");
  const [permissions, setPermissions] = useState(DEFAULT_PERMISSIONS);
  const [users, setUsers] = useState<UserRecord[]>(INITIAL_USERS);
  const [saved, setSaved] = useState(false);

  const togglePerm = (role: string, perm: string) => {
    setPermissions(prev => ({
      ...prev,
      [role]: { ...prev[role], [perm]: !prev[role][perm] },
    }));
  };

  const changeUserRole = (userId: string, newRole: string) => {
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u));
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2200);
  };

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-8">
      <div>
        <h2 className="text-xl font-bold text-foreground">Usuarios & Roles</h2>
        <p className="text-sm text-muted-foreground mt-1">Administra los usuarios del sistema y configura los permisos por rol.</p>
      </div>

      {/* Role selector + permissions */}
      <section className="bg-white rounded-xl border border-border p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Lock size={16} className="text-primary" />
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Roles & Permisos</h3>
        </div>

        <div className="flex gap-2 flex-wrap">
          {ROLES.map(role => (
            <button
              key={role}
              onClick={() => setSelectedRole(role)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                selectedRole === role
                  ? "bg-primary text-white shadow-sm"
                  : "bg-secondary text-foreground hover:bg-secondary/70"
              }`}
            >
              {role}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
          {Object.entries(permissions[selectedRole] ?? {}).map(([perm, enabled]) => (
            <button
              key={perm}
              onClick={() => togglePerm(selectedRole, perm)}
              className={`flex items-center justify-between px-3 py-2.5 rounded-lg border text-xs font-medium transition-colors text-left ${
                enabled
                  ? "border-primary/30 bg-primary/5 text-primary"
                  : "border-border bg-background text-muted-foreground hover:border-border/80"
              }`}
            >
              <span>{perm}</span>
              <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 ml-2 transition-colors ${enabled ? "bg-primary" : "bg-muted"}`}>
                {enabled && <Check size={10} className="text-white" />}
              </div>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 pt-2 border-t border-border">
          <button
            onClick={handleSave}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-md hover:bg-primary/90 transition-colors"
          >
            {saved ? <Check size={14} /> : <Save size={14} />}
            {saved ? "Guardado" : "Guardar permisos"}
          </button>
          {saved && <span className="text-xs text-emerald-600 font-medium">Permisos actualizados correctamente.</span>}
        </div>
      </section>

      {/* Users table */}
      <section className="bg-white rounded-xl border border-border overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-primary" />
            <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Usuarios del Sistema</h3>
          </div>
          <span className="text-xs text-muted-foreground">{users.length} usuarios</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="text-left px-6 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Usuario</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Correo</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Rol</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Estado</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Último acceso</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map(user => {
                const initials = user.name.split(" ").map(n => n[0]).join("").slice(0, 2);
                return (
                  <tr key={user.id} className="hover:bg-secondary/20 transition-colors">
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold flex-shrink-0">
                          {initials}
                        </div>
                        <div>
                          <div className="font-semibold text-foreground text-sm">{user.name}</div>
                          <div className="text-[10px] text-muted-foreground font-mono">{user.id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-muted-foreground">{user.email}</td>
                    <td className="px-4 py-3.5">
                      <select
                        value={user.role}
                        onChange={e => changeUserRole(user.id, e.target.value)}
                        className="text-xs border border-border rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 font-medium text-foreground"
                      >
                        {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        user.status === "active"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-slate-50 text-slate-600 border border-slate-200"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${user.status === "active" ? "bg-emerald-500" : "bg-slate-400"}`} />
                        {user.status === "active" ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-muted-foreground font-mono">{user.lastLogin}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

// ─── View: PLANES DE AUDITORÍA ───────────────────────────────────────────────
const PLAN_STATUS_CFG: Record<AuditPlan["status"], { label: string; cls: string }> = {
  "Borrador":     { label: "Borrador",     cls: "bg-slate-50 text-slate-600 border border-slate-200" },
  "Aprobado":     { label: "Aprobado",     cls: "bg-emerald-50 text-emerald-700 border border-emerald-200" },
  "En Ejecución": { label: "En Ejecución", cls: "bg-amber-50 text-amber-700 border border-amber-200" },
  "Cerrado":      { label: "Cerrado",      cls: "bg-blue-50 text-blue-700 border border-blue-200" },
};

function AuditPlansView({ canCreate }: { canCreate: boolean }) {
  const [plans, setPlans] = useState<AuditPlan[]>(AUDIT_PLANS_DATA);
  const [showForm, setShowForm] = useState(false);
  const [planPdfTarget, setPlanPdfTarget] = useState<AuditPlan | null>(null);
  const [form, setForm] = useState({ code: "", name: "", period: "", startDate: "", endDate: "", estimatedHours: "", responsible: "M. García", scope: "" });
  const [formErr, setFormErr] = useState<Record<string, string>>({});

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.code.trim()) errs.code = "Requerido";
    if (!form.name.trim()) errs.name = "Requerido";
    if (!form.startDate) errs.startDate = "Requerido";
    if (!form.endDate) errs.endDate = "Requerido";
    if (form.startDate && form.endDate && form.endDate <= form.startDate) errs.endDate = "Debe ser posterior a la fecha de inicio";
    const h = Number(form.estimatedHours);
    if (!form.estimatedHours || h <= 0 || !Number.isFinite(h)) errs.estimatedHours = "Debe ser mayor a 0";
    return errs;
  };

  const handleSubmit = () => {
    const errs = validate();
    if (Object.keys(errs).length) { setFormErr(errs); return; }
    const newPlan: AuditPlan = {
      id: `AP-${String(plans.length + 1).padStart(3, "0")}`,
      code: form.code, name: form.name, period: form.period,
      startDate: form.startDate, endDate: form.endDate,
      status: "Borrador", estimatedHours: Number(form.estimatedHours),
      responsible: form.responsible, scope: form.scope,
    };
    setPlans(prev => [newPlan, ...prev]);
    setShowForm(false);
    setForm({ code: "", name: "", period: "", startDate: "", endDate: "", estimatedHours: "", responsible: "M. García", scope: "" });
    setFormErr({});
    toast.success(`Plan "${newPlan.name}" creado correctamente`);
  };

  const inp = (label: string, key: keyof typeof form, type = "text", placeholder = "") => (
    <div>
      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">{label}</label>
      <input
        type={type} value={form[key]} placeholder={placeholder}
        onChange={e => { setForm(f => ({ ...f, [key]: e.target.value })); setFormErr(f => ({ ...f, [key]: "" })); }}
        className={`w-full text-sm px-3 py-2 rounded-md border bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 ${formErr[key] ? "border-red-400" : "border-border"}`}
      />
      {formErr[key] && <div className="text-xs text-red-600 mt-0.5">{formErr[key]}</div>}
    </div>
  );

  return (
    <div className="flex-1 overflow-auto p-6" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <Breadcrumbs items={["Inicio", "Auditoría", "Planes de Auditoría"]} />
      <PageHeader
        title="Planes de Auditoría"
        subtitle={`${plans.length} planes registrados · Ciclo 2024–2025`}
        actions={canCreate ? (
          <PrimaryBtn icon={<Plus size={14} />} onClick={() => setShowForm(s => !s)}>
            {showForm ? "Cancelar" : "Nuevo plan"}
          </PrimaryBtn>
        ) : undefined}
      />

      {showForm && (
        <Card className="p-5 mb-6 border-primary/30 bg-primary/[0.02]">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen size={15} className="text-primary" />
            <div className="text-sm font-semibold text-foreground">Nuevo Plan de Auditoría</div>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            {inp("Código del plan", "code", "text", "PAI-2025-004")}
            {inp("Nombre del plan", "name", "text", "Plan de Auditoría…")}
            {inp("Periodo", "period", "text", "Q3–Q4 2025")}
            {inp("Responsable", "responsible")}
            {inp("Fecha de inicio", "startDate", "date")}
            {inp("Fecha de fin", "endDate", "date")}
            {inp("Horas estimadas", "estimatedHours", "number", "120")}
          </div>
          <div className="mb-4">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Alcance</label>
            <textarea
              value={form.scope} rows={2} placeholder="Descripción del alcance del plan…"
              onChange={e => setForm(f => ({ ...f, scope: e.target.value }))}
              className="w-full text-sm px-3 py-2 rounded-md border border-border bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </div>
          <PrimaryBtn icon={<Save size={14} />} onClick={handleSubmit}>Guardar plan</PrimaryBtn>
        </Card>
      )}

      <Card>
        <div className="px-4 pt-4 pb-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen size={14} className="text-primary" />
            <div className="text-sm font-semibold text-foreground">Planes registrados</div>
            <span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full font-semibold">{plans.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => exportToCSV("planes_auditoria.csv", ["ID","Código","Nombre","Periodo","Inicio","Fin","Estado","Horas"], plans.map(p => [p.id, p.code, p.name, p.period, p.startDate, p.endDate, p.status, String(p.estimatedHours)]))}
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border border-border text-muted-foreground hover:bg-secondary transition-colors"
            >
              <Download size={12} /> Exportar CSV
            </button>
            <button
              onClick={() => setPlanPdfTarget(plans[0])}
              className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border border-border text-muted-foreground hover:bg-secondary transition-colors"
            >
              <FileText size={12} /> Exportar PDF
            </button>
          </div>
        </div>
        {planPdfTarget && (
          <PDFPreviewModal
            onClose={() => setPlanPdfTarget(null)}
            doc={{
              title: `Plan de Auditoría — ${planPdfTarget.code}`,
              subtitle: planPdfTarget.name,
              sections: [
                {
                  heading: "Información General",
                  rows: [
                    ["Código", planPdfTarget.code],
                    ["Nombre del plan", planPdfTarget.name],
                    ["Período", planPdfTarget.period],
                    ["Estado", planPdfTarget.status],
                    ["Responsable", planPdfTarget.responsible],
                    ["Horas estimadas", `${planPdfTarget.estimatedHours}h`],
                  ],
                },
                {
                  heading: "Alcance y Fechas",
                  rows: [
                    ["Fecha de inicio", planPdfTarget.startDate],
                    ["Fecha de fin", planPdfTarget.endDate],
                    ["Alcance", planPdfTarget.scope || "No especificado"],
                  ],
                },
                {
                  heading: "Resumen de Planes",
                  rows: plans.map(p => [p.code, `${p.name} · ${p.status}`]),
                },
              ],
            }}
          />
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {["Código", "Nombre del Plan", "Periodo", "Inicio", "Fin", "Estado", "Horas Est.", "Responsable"].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {plans.map(p => {
                const st = PLAN_STATUS_CFG[p.status];
                return (
                  <tr key={p.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs font-bold text-primary bg-primary/8 px-2 py-0.5 rounded-md">{p.code}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground text-sm">{p.name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{p.scope}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{p.period}</td>
                    <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{p.startDate}</td>
                    <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{p.endDate}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-foreground font-semibold">{p.estimatedHours}h</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{p.responsible}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ─── View: HALLAZGOS ─────────────────────────────────────────────────────────
const SEV_COLOR: Record<Finding["severity"], string> = {
  "Crítico": "bg-red-50 text-red-700 border border-red-200",
  "Alto":    "bg-orange-50 text-orange-700 border border-orange-200",
  "Medio":   "bg-amber-50 text-amber-700 border border-amber-200",
  "Bajo":    "bg-emerald-50 text-emerald-700 border border-emerald-200",
};
const FIND_STATUS_CFG: Record<Finding["status"], string> = {
  "Abierto":     "bg-red-50 text-red-700 border border-red-200",
  "En Revisión": "bg-amber-50 text-amber-700 border border-amber-200",
  "Asignado":    "bg-blue-50 text-blue-700 border border-blue-200",
  "Cerrado":     "bg-emerald-50 text-emerald-700 border border-emerald-200",
};

function FindingsView() {
  const [findings, setFindings] = useState<Finding[]>(INITIAL_FINDINGS);
  const [actionModal, setActionModal] = useState<Finding | null>(null);
  const [findingPdf, setFindingPdf] = useState<Finding | null>(null);
  const [expandedFinding, setExpandedFinding] = useState<string | null>(null);
  const [actionForm, setActionForm] = useState({ description: "", responsible: "", dueDate: "" });
  const [actionErr, setActionErr] = useState<Record<string, string>>({});
  const [sevFilter, setSevFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filtered = findings.filter(f =>
    (sevFilter === "all" || f.severity === sevFilter) &&
    (statusFilter === "all" || f.status === statusFilter)
  );

  const saveActionPlan = () => {
    const errs: Record<string, string> = {};
    if (!actionForm.description.trim()) errs.description = "Requerido";
    if (!actionForm.responsible.trim()) errs.responsible = "Requerido";
    if (!actionForm.dueDate) errs.dueDate = "Requerido";
    if (Object.keys(errs).length) { setActionErr(errs); return; }
    setFindings(prev => prev.map(f => f.id === actionModal!.id ? {
      ...f, status: "Asignado",
      actionPlan: { description: actionForm.description, responsible: actionForm.responsible, dueDate: actionForm.dueDate, status: "Asignado" },
    } : f));
    setActionModal(null);
    setActionForm({ description: "", responsible: "", dueDate: "" });
    toast.success(`Plan de acción asignado para "${actionModal!.folio}"`);
  };

  return (
    <div className="flex-1 overflow-auto p-6" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <Breadcrumbs items={["Inicio", "Auditoría", "Hallazgos"]} />
      <PageHeader
        title="Hallazgos de Auditoría"
        subtitle={`${findings.length} hallazgos registrados · ${findings.filter(f => f.status !== "Cerrado").length} abiertos`}
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => exportToCSV("hallazgos.csv", ["Folio","Título","Gravedad","Control Fallido","Riesgo Residual","Estado","Fecha"], findings.map(f => [f.folio, f.title, f.severity, f.failedControl, f.residualRisk, f.status, f.date]))}
              className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border text-muted-foreground hover:bg-secondary transition-colors"
            >
              <Download size={12} /> Exportar CSV
            </button>
            <button
              onClick={() => setFindingPdf(findings[0])}
              className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border text-muted-foreground hover:bg-secondary transition-colors"
            >
              <FileText size={12} /> Exportar PDF
            </button>
          </div>
        }
      />
      {findingPdf && (
        <PDFPreviewModal
          onClose={() => setFindingPdf(null)}
          doc={{
            title: `Ficha de Hallazgo — ${findingPdf.folio}`,
            subtitle: findingPdf.title,
            sections: [
              {
                heading: "Datos del Hallazgo",
                rows: [
                  ["Folio", findingPdf.folio],
                  ["Fecha de registro", findingPdf.date],
                  ["Gravedad", findingPdf.severity],
                  ["Estado", findingPdf.status],
                  ["Riesgo residual", findingPdf.residualRisk],
                ],
              },
              {
                heading: "Control Fallido",
                rows: [
                  ["ID de control", findingPdf.failedControlId],
                  ["Descripción", findingPdf.failedControl],
                ],
              },
              ...(findingPdf.actionPlan ? [{
                heading: "Plan de Acción",
                rows: [
                  ["Descripción", findingPdf.actionPlan.description],
                  ["Responsable", findingPdf.actionPlan.responsible],
                  ["Fecha compromiso", findingPdf.actionPlan.dueDate],
                  ["Estado del plan", findingPdf.actionPlan.status],
                ] as [string, string][],
              }] : []),
              {
                heading: "Resumen Global",
                rows: [
                  ["Total hallazgos", String(findings.length)],
                  ["Abiertos", String(findings.filter(f => f.status === "Abierto").length)],
                  ["Asignados", String(findings.filter(f => f.status === "Asignado").length)],
                  ["Cerrados", String(findings.filter(f => f.status === "Cerrado").length)],
                ],
              },
            ],
          }}
        />
      )}

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap mb-5">
        <Filter size={12} className="text-muted-foreground" />
        <span className="text-xs text-muted-foreground font-medium">Gravedad:</span>
        {["all", "Crítico", "Alto", "Medio", "Bajo"].map(f => (
          <button key={f} onClick={() => setSevFilter(f)}
            className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${sevFilter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}>
            {f === "all" ? "Todos" : f}
          </button>
        ))}
        <div className="w-px h-4 bg-border mx-1" />
        <span className="text-xs text-muted-foreground font-medium">Estado:</span>
        {["all", "Abierto", "En Revisión", "Asignado", "Cerrado"].map(f => (
          <button key={f} onClick={() => setStatusFilter(f)}
            className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${statusFilter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}>
            {f === "all" ? "Todos" : f}
          </button>
        ))}
      </div>

      <Card>
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center">
            <Flag size={28} className="text-muted-foreground/30 mb-3" />
            <div className="text-sm font-semibold text-muted-foreground">Sin hallazgos con estos filtros</div>
            <button onClick={() => { setSevFilter("all"); setStatusFilter("all"); }} className="mt-2 text-xs text-accent font-semibold hover:underline">Limpiar filtros</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {["Folio", "Título", "Gravedad", "Control Fallido", "Riesgo Residual", "Estado", "Fecha", ""].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(f => {
                  const isExpanded = expandedFinding === f.id;
                  return (
                    <React.Fragment key={f.id}>
                      <tr
                        className={`transition-colors cursor-pointer group ${isExpanded ? "bg-secondary/40" : "hover:bg-secondary/30"}`}
                        onClick={() => setExpandedFinding(isExpanded ? null : f.id)}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <span className="text-muted-foreground transition-transform" style={{ transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)", display: "inline-block" }}>
                              <ChevronRight size={12} />
                            </span>
                            <span className="font-mono text-xs font-bold text-primary bg-primary/8 px-2 py-0.5 rounded-md">{f.folio}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 max-w-xs">
                          <div className="font-medium text-foreground text-sm line-clamp-2">{f.title}</div>
                          {f.actionPlan && (
                            <div className="text-[10px] text-emerald-600 mt-0.5 flex items-center gap-1">
                              <CheckCircle2 size={10} /> Plan asignado — {f.actionPlan.dueDate}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${SEV_COLOR[f.severity]}`}>{f.severity}</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                          <span className="font-mono text-primary">{f.failedControlId}</span>
                          <div className="text-[10px] mt-0.5 max-w-[140px] truncate">{f.failedControl}</div>
                        </td>
                        <td className="px-4 py-3"><RiskLevelBadge level={f.residualRisk} /></td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${FIND_STATUS_CFG[f.status]}`}>{f.status}</span>
                        </td>
                        <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{f.date}</td>
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          {!f.actionPlan && f.status !== "Cerrado" && (
                            <button onClick={() => setActionModal(f)}
                              className="text-xs px-2.5 py-1 bg-primary text-primary-foreground rounded-md font-semibold hover:bg-primary/90 transition-colors whitespace-nowrap">
                              Crear plan
                            </button>
                          )}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={8} className="px-4 pb-4 bg-secondary/20 border-b border-border">
                            <div className="pt-3 space-y-3">
                              {f.actionPlan && (
                                <div className="bg-white rounded-lg border border-border p-4">
                                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Plan de remediación</div>
                                  <p className="text-sm text-foreground mb-3">{f.actionPlan.description}</p>
                                  <div className="grid grid-cols-3 gap-4 text-xs">
                                    <div><div className="text-muted-foreground font-semibold mb-0.5">Responsable</div><div className="text-foreground font-medium">{f.actionPlan.responsible}</div></div>
                                    <div><div className="text-muted-foreground font-semibold mb-0.5">Fecha compromiso</div><div className="font-mono text-foreground">{f.actionPlan.dueDate}</div></div>
                                    <div><div className="text-muted-foreground font-semibold mb-0.5">Estado</div><div className="text-foreground">{f.actionPlan.status}</div></div>
                                  </div>
                                </div>
                              )}
                              <EvidenciasSection entityId={f.id} />
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Action Plan Modal */}
      {actionModal && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setActionModal(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-card rounded-xl shadow-2xl w-full max-w-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-sm font-bold text-foreground">Crear Plan de Acción</div>
                  <div className="text-xs text-muted-foreground mt-0.5 font-mono">{actionModal.folio} — {actionModal.title.slice(0, 50)}…</div>
                </div>
                <button onClick={() => setActionModal(null)} className="p-1.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-secondary transition-colors"><X size={16} /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Descripción del plan de remediación</label>
                  <textarea
                    value={actionForm.description} rows={3} placeholder="Describe las acciones a tomar para cerrar este hallazgo…"
                    onChange={e => { setActionForm(f => ({ ...f, description: e.target.value })); setActionErr(e => ({ ...e, description: "" })); }}
                    className={`w-full text-sm px-3 py-2 rounded-md border bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none ${actionErr.description ? "border-red-400" : "border-border"}`}
                  />
                  {actionErr.description && <div className="text-xs text-red-600 mt-0.5">{actionErr.description}</div>}
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Responsable auditado</label>
                  <input
                    value={actionForm.responsible} placeholder="Nombre y área del responsable"
                    onChange={e => { setActionForm(f => ({ ...f, responsible: e.target.value })); setActionErr(e => ({ ...e, responsible: "" })); }}
                    className={`w-full text-sm px-3 py-2 rounded-md border bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 ${actionErr.responsible ? "border-red-400" : "border-border"}`}
                  />
                  {actionErr.responsible && <div className="text-xs text-red-600 mt-0.5">{actionErr.responsible}</div>}
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Fecha de compromiso</label>
                  <input
                    type="date" value={actionForm.dueDate}
                    onChange={e => { setActionForm(f => ({ ...f, dueDate: e.target.value })); setActionErr(e => ({ ...e, dueDate: "" })); }}
                    className={`w-full text-sm px-3 py-2 rounded-md border bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 ${actionErr.dueDate ? "border-red-400" : "border-border"}`}
                  />
                  {actionErr.dueDate && <div className="text-xs text-red-600 mt-0.5">{actionErr.dueDate}</div>}
                </div>
              </div>
              <div className="flex gap-3 mt-5 pt-4 border-t border-border">
                <PrimaryBtn icon={<Check size={14} />} onClick={saveActionPlan}>Asignar plan</PrimaryBtn>
                <GhostBtn onClick={() => setActionModal(null)}>Cancelar</GhostBtn>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── View: PORTAL DEL AUDITADO ───────────────────────────────────────────────
function AuditadoPortalView() {
  const assignedPlans = INITIAL_FINDINGS.filter(f => f.actionPlan);
  return (
    <div className="flex-1 overflow-auto p-6" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      <Breadcrumbs items={["Inicio", "Auditoría", "Portal del Auditado"]} />
      <PageHeader
        title="Portal del Auditado"
        subtitle="Vista de solo lectura — Planes de acción asignados a tu área"
      />
      <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
        <Eye size={14} className="flex-shrink-0" />
        <span>Esta vista es de <strong>solo lectura</strong>. Para actualizar el estado de un plan, contacta al equipo de auditoría.</span>
      </div>
      {assignedPlans.length === 0 ? (
        <Card className="p-12 text-center">
          <UserCheck size={32} className="mx-auto text-muted-foreground/30 mb-3" />
          <div className="text-sm font-semibold text-muted-foreground">Sin planes de acción asignados</div>
          <div className="text-xs text-muted-foreground/60 mt-1">Los planes de acción asignados a tu área aparecerán aquí.</div>
        </Card>
      ) : (
        <div className="space-y-4">
          {assignedPlans.map(f => (
            <Card key={f.id} className="p-5">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs font-bold text-primary bg-primary/8 px-2 py-0.5 rounded-md">{f.folio}</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${SEV_COLOR[f.severity]}`}>{f.severity}</span>
                  </div>
                  <div className="text-base font-bold text-foreground leading-tight">{f.title}</div>
                </div>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${f.actionPlan?.status === "Completado" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-blue-50 text-blue-700 border border-blue-200"}`}>
                  {f.actionPlan?.status ?? "Asignado"}
                </span>
              </div>
              <div className="bg-secondary/40 rounded-lg p-4 space-y-3">
                <div>
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Plan de remediación</div>
                  <p className="text-sm text-foreground leading-relaxed">{f.actionPlan?.description}</p>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-3 border-t border-border">
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">Responsable</div>
                    <div className="text-sm font-medium text-foreground">{f.actionPlan?.responsible}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">Fecha de compromiso</div>
                    <div className={`text-sm font-semibold font-mono ${f.actionPlan?.dueDate && f.actionPlan.dueDate < new Date().toISOString().slice(0,10) ? "text-red-600" : "text-foreground"}`}>
                      {f.actionPlan?.dueDate}
                    </div>
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-border">
                <EvidenciasSection entityId={f.id} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Copilot Panel ────────────────────────────────────────────────────────────
const COPILOT_SUGGESTIONS: Record<string, string[]> = {
  dashboard:  ["Resumir hallazgos del trimestre", "Redactar informe ejecutivo Q3 2025", "Analizar tendencias de riesgo LATAM"],
  filter:     ["Filtrar riesgos críticos pendientes", "Exportar selección actual a PDF", "Comparar riesgos por país"],
  hierarchy:  ["Explicar la estructura de riesgo actual", "Identificar nodos sin controles asignados", "Resumir estado de cumplimiento"],
  plans:      ["Revisar cronograma de auditorías", "Identificar solapamientos de alcance", "Estimar recursos necesarios Q4"],
  findings:   ["Resumir hallazgos abiertos críticos", "Priorizar hallazgos por riesgo residual", "Redactar plan de remediación global"],
  auditado:   ["Explicar mis planes de acción asignados", "¿Cuándo vencen mis compromisos?", "Genera resumen de mis pendientes"],
  settings:   ["Revisar actividad reciente en bitácora", "¿Quién modificó permisos esta semana?", "Generar reporte de accesos"],
  users:      ["Revisar permisos del rol Auditor", "Comparar roles Auditor vs. Consultor", "Lista usuarios activos con acceso completo"],
  editor:     ["Sugiere un layout óptimo para el dashboard", "¿Qué widget añadir para riesgo operacional?"],
  general_risk: ["Resumir este riesgo general", "Redactar hallazgo basado en este riesgo", "Comparar con riesgos similares"],
  specific_risk: ["Analizar controles de este riesgo específico", "Estimar exposición residual ajustada", "Redactar hallazgo preliminar"],
  audit_entity: ["Resumir perfil de riesgo de esta entidad", "Listar hallazgos pendientes", "Comparar con entidades similares"],
  control: ["Evaluar efectividad de este control", "Sugerir mejoras al control", "Redactar conclusión de prueba de controles"],
};

const AI_RESPONSES: Record<string, string> = {
  "Resumir hallazgos del trimestre": "En Q3 2025 se registraron 4 hallazgos nuevos: 1 crítico (HAL-2025-001), 2 altos (HAL-2025-002, HAL-2025-004) y 1 medio (HAL-2025-003). El 75% está abierto o en revisión. El área de Finanzas concentra el mayor riesgo residual.",
  "Redactar informe ejecutivo Q3 2025": "**Informe Ejecutivo Q3 2025**\n\nEl período Q3 2025 muestra un incremento del 15% en hallazgos respecto al Q2. Los controles de segregación de funciones y accesos privilegiados presentan vulnerabilidades activas que requieren atención directiva. Se recomienda priorizar la remediación de HAL-2025-001 antes del cierre del trimestre.",
  "Analizar tendencias de riesgo LATAM": "Las tendencias regionales muestran que México concentra el mayor volumen de riesgos críticos (2 de 3), mientras Brasil presenta riesgo residual alto en TI. Colombia muestra mejora significativa tras la implementación de CTR-004. Se proyecta reducción del 20% en riesgos abiertos para Q4 si se cierran los hallazgos actuales.",
};

type ChatMsg = { role: "user" | "ai"; content: string };

function CopilotPanel({ currentView, open, onToggle }: { currentView: string; open: boolean; onToggle: () => void }) {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = COPILOT_SUGGESTIONS[currentView] ?? COPILOT_SUGGESTIONS.dashboard;
  const hasMessages = messages.length > 0;

  useEffect(() => {
    if (open) {
      // Small delay so the panel is rendered before focusing
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = (text: string) => {
    if (!text.trim() || loading) return;
    setMessages(prev => [...prev, { role: "user", content: text }]);
    setInput("");
    setLoading(true);
    setTimeout(() => {
      const resp = AI_RESPONSES[text] ?? `Entendido. Analizando "${text}"...\n\nBasado en los datos del sistema, los registros relacionados muestran niveles de riesgo dentro del rango esperado. Se recomienda revisar los controles asociados y verificar el estado de los hallazgos pendientes antes de tomar acción.`;
      setMessages(prev => [...prev, { role: "ai", content: resp }]);
      setLoading(false);
    }, 1400);
  };

  return (
    <>
      {/* Floating button — only visible when panel is closed */}
      {!open && (
        <button
          id="tour-copilot-btn"
          onClick={onToggle}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-3 rounded-full shadow-lg font-semibold text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-all"
        >
          <Sparkles size={16} className="animate-pulse" />
          Asistente IA
        </button>
      )}

      {/* Panel — full-height, flex column, nothing overflows the input bar */}
      {open && (
        <div
          className="fixed right-0 top-0 h-screen w-96 bg-card border-l border-border shadow-2xl z-30 flex flex-col overflow-hidden"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          {/* ── Header (fixed height) ── */}
          <div className="px-4 py-3.5 border-b border-border flex items-center gap-3 flex-shrink-0">
            <div className="p-1.5 bg-primary/10 rounded-lg">
              <Sparkles size={14} className="text-primary" />
            </div>
            <div>
              <div className="text-sm font-bold text-foreground">Asistente Copilot IA</div>
              <div className="text-[10px] text-muted-foreground">Expedite GRC · Datos simulados</div>
            </div>
            <button
              onClick={onToggle}
              className="ml-auto p-1.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-secondary transition-colors"
            >
              <X size={14} />
            </button>
          </div>

          {/* ── Scrollable body — takes all remaining space ── */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {!hasMessages ? (
              /* Empty state: suggestions centred in the chat area */
              <div className="flex flex-col items-center justify-center h-full px-5 py-8 text-center">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                  <Sparkles size={22} className="text-primary" />
                </div>
                <div className="text-sm font-bold text-foreground mb-1">¿En qué puedo ayudarte?</div>
                <p className="text-xs text-muted-foreground leading-relaxed mb-6">
                  Puedo analizar riesgos, redactar hallazgos y resumir información del sistema.
                </p>
                <div className="w-full space-y-2">
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">
                    Acciones sugeridas
                  </div>
                  {suggestions.map(s => (
                    <button
                      key={s}
                      onClick={() => sendMessage(s)}
                      className="w-full text-left text-xs px-3 py-2.5 rounded-lg bg-primary/5 text-primary border border-primary/15 hover:bg-primary/10 transition-colors font-medium leading-snug"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              /* Conversation messages */
              <div className="px-4 pt-4 pb-2 space-y-3">
                {/* Inline suggestions strip above messages */}
                <div className="pb-1 border-b border-border mb-1">
                  <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1.5">
                    Acciones sugeridas
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {suggestions.map(s => (
                      <button
                        key={s}
                        onClick={() => sendMessage(s)}
                        className="text-[10px] px-2 py-1 rounded-md bg-primary/5 text-primary border border-primary/15 hover:bg-primary/10 transition-colors font-medium leading-tight"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {messages.map((m, i) => (
                  <div key={i} className={`flex gap-2.5 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    {m.role === "ai" && (
                      <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Sparkles size={12} className="text-white" />
                      </div>
                    )}
                    <div className={`max-w-[85%] px-3 py-2.5 rounded-xl text-xs leading-relaxed whitespace-pre-wrap ${m.role === "user" ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-secondary/60 text-foreground rounded-bl-sm"}`}>
                      {m.content}
                    </div>
                  </div>
                ))}

                {loading && (
                  <div className="flex gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                      <Sparkles size={12} className="text-white" />
                    </div>
                    <div className="bg-secondary/60 rounded-xl rounded-bl-sm px-3 py-2.5 flex items-center gap-1.5">
                      {[0, 1, 2].map(j => (
                        <div key={j} className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: `${j * 0.15}s` }} />
                      ))}
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
            )}
          </div>

          {/* ── Input bar (fixed at bottom, never scrolls away) ── */}
          <div className="flex-shrink-0 border-t border-border bg-card px-3 py-3">
            <div className="flex items-center gap-2 bg-input-background border border-border rounded-lg px-3 py-2 focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary/50 transition-all">
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
                placeholder="Escribe una pregunta o instrucción…"
                className="flex-1 min-w-0 bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground"
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || loading}
                className="flex-shrink-0 p-1.5 bg-primary text-white rounded-md hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Send size={12} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Guided Tour ──────────────────────────────────────────────────────────────
const TOUR_STEPS = [
  {
    targetId: "tour-nav-dashboard",
    title: "Dashboard",
    description: "Resumen del trabajo del día: KPIs en tiempo real, tareas urgentes y gráficas del trimestre.",
  },
  {
    targetId: "tour-nav-filter",
    title: "Filtrar",
    description: "Busca riesgos, controles, entidades y auditorías. Filtra por cualquier atributo y navega con drill-down.",
  },
  {
    targetId: "tour-nav-hierarchy",
    title: "Catálogo",
    description: "Estructura organizacional completa y riesgos por entidad, con vista de tarjetas y árbol jerárquico.",
  },
  {
    targetId: "tour-nav-plans",
    title: "Planes de Auditoría",
    description: "Define el calendario anual y trimestral de auditorías: alcance, responsables y fechas clave.",
  },
  {
    targetId: "tour-nav-findings",
    title: "Hallazgos",
    description: "Registra lo que falló durante la auditoría y crea planes de acción con responsable y fecha compromiso.",
  },
  {
    targetId: "tour-nav-auditado",
    title: "Portal del Auditado",
    description: "La vista que ve el negocio para dar seguimiento a sus planes de acción y evidencias asignadas.",
  },
  {
    targetId: "tour-nav-users",
    title: "Usuarios & Roles",
    description: "Gestiona accesos y permisos granulares por rol. Solo disponible para administradores del sistema.",
  },
  {
    targetId: "tour-nav-bitacora",
    title: "Bitácora",
    description: "Registro completo de quién hizo qué y cuándo. Permite auditar la propia plataforma y detectar cambios no autorizados.",
  },
  {
    targetId: "tour-copilot-btn",
    title: "Asistente IA",
    description: "Genera resúmenes, redacta hallazgos y recibe ayuda contextual sobre cualquier vista del sistema.",
  },
];

const TOOLTIP_W = 288; // w-72 = 18rem = 288px
const TOOLTIP_H = 260; // approximate rendered height
const MARGIN = 16;     // min distance from viewport edge
const SPOTLIGHT_PAD = 6;
const GAP = 12;        // gap between highlight ring and tooltip

function computeTooltipPos(box: DOMRect): { left: number; top: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Available space on each side (from highlight edge to viewport edge)
  const spaceRight  = vw - (box.right  + SPOTLIGHT_PAD) - GAP;
  const spaceLeft   = (box.left  - SPOTLIGHT_PAD) - GAP;
  const spaceBottom = vh - (box.bottom + SPOTLIGHT_PAD) - GAP;
  const spaceTop    = (box.top   - SPOTLIGHT_PAD) - GAP;

  // Pick preferred horizontal side: right first, then left
  let left: number;
  if (spaceRight >= TOOLTIP_W + MARGIN) {
    left = box.right + SPOTLIGHT_PAD + GAP;
  } else if (spaceLeft >= TOOLTIP_W + MARGIN) {
    left = box.left - SPOTLIGHT_PAD - GAP - TOOLTIP_W;
  } else {
    // Neither side has enough room — center horizontally under/above
    left = box.left + box.width / 2 - TOOLTIP_W / 2;
  }

  // Pick preferred vertical placement:
  // If we placed the tooltip to the left or right, align top of tooltip with top of target.
  // If we placed it above/below (center case), use top/bottom.
  let top: number;
  const horizontalPlacement = spaceRight >= TOOLTIP_W + MARGIN || spaceLeft >= TOOLTIP_W + MARGIN;
  if (horizontalPlacement) {
    // Try to top-align with target; if tooltip overflows bottom, shift up
    top = box.top - SPOTLIGHT_PAD;
  } else {
    // Stacked: prefer below, fall back to above
    if (spaceBottom >= TOOLTIP_H + MARGIN) {
      top = box.bottom + SPOTLIGHT_PAD + GAP;
    } else {
      top = box.top - SPOTLIGHT_PAD - GAP - TOOLTIP_H;
    }
  }

  // Clamp to viewport with margin
  left = Math.max(MARGIN, Math.min(left, vw - TOOLTIP_W - MARGIN));
  top  = Math.max(MARGIN, Math.min(top,  vh - TOOLTIP_H - MARGIN));

  return { left, top };
}

function GuidedTour({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [box, setBox] = useState<DOMRect | null>(null);

  const current = TOUR_STEPS[step];

  useEffect(() => {
    const el = document.getElementById(current.targetId);
    if (el) {
      setBox(el.getBoundingClientRect());
      el.scrollIntoView({ block: "nearest" });
    }
  }, [step, current.targetId]);

  const next = () => { if (step < TOUR_STEPS.length - 1) setStep(s => s + 1); else onClose(); };
  const prev = () => { if (step > 0) setStep(s => s - 1); };

  const pos = box ? computeTooltipPos(box) : { left: MARGIN, top: MARGIN };

  return (
    <>
      {/* Overlay — z-[60] so it sits above floating buttons (z-40) */}
      <div className="fixed inset-0 z-[60] pointer-events-none">
        <svg width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
          <defs>
            <mask id="spotlight-mask">
              <rect width="100%" height="100%" fill="white" />
              {box && <rect x={box.left - SPOTLIGHT_PAD} y={box.top - SPOTLIGHT_PAD} width={box.width + SPOTLIGHT_PAD * 2} height={box.height + SPOTLIGHT_PAD * 2} rx="8" fill="black" />}
            </mask>
          </defs>
          <rect width="100%" height="100%" fill="rgba(0,0,0,0.55)" mask="url(#spotlight-mask)" />
        </svg>
        {/* Highlight ring */}
        {box && (
          <div
            className="absolute border-2 border-primary rounded-lg shadow-[0_0_0_4px_rgba(15,79,255,0.25)] transition-all duration-300"
            style={{ left: box.left - SPOTLIGHT_PAD, top: box.top - SPOTLIGHT_PAD, width: box.width + SPOTLIGHT_PAD * 2, height: box.height + SPOTLIGHT_PAD * 2 }}
          />
        )}
      </div>

      {/* Tooltip — z-[61] so it renders above the overlay */}
      <div
        className="fixed z-[61] bg-card border border-border rounded-xl shadow-2xl p-5 transition-all duration-200"
        style={{ left: pos.left, top: pos.top, width: TOOLTIP_W, pointerEvents: "auto" }}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-primary/10 rounded-lg">
              <Sparkles size={12} className="text-primary" />
            </div>
            <div className="text-xs font-bold text-primary uppercase tracking-wide">Tour guiado</div>
          </div>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground rounded transition-colors"><X size={14} /></button>
        </div>

        <div className="mb-1">
          <div className="text-sm font-bold text-foreground">{current.title}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">Paso {step + 1} de {TOUR_STEPS.length}</div>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed mt-2 mb-4">{current.description}</p>

        {/* Progress */}
        <div className="flex gap-1 mb-4">
          {TOUR_STEPS.map((_, i) => (
            <button key={i} onClick={() => setStep(i)}
              className={`h-1.5 flex-1 rounded-full transition-all ${i === step ? "bg-primary" : i < step ? "bg-primary/40" : "bg-border"}`} />
          ))}
        </div>

        <div className="flex items-center gap-2">
          {step > 0 && (
            <button onClick={prev} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-md border border-border text-muted-foreground hover:bg-secondary transition-colors">
              <ChevronLeft size={12} /> Anterior
            </button>
          )}
          <button onClick={next} className="flex-1 flex items-center justify-center gap-1 text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors">
            {step === TOUR_STEPS.length - 1 ? "Finalizar" : "Siguiente"} <ChevronRight size={12} />
          </button>
          <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2">Omitir</button>
        </div>
      </div>
    </>
  );
}

// ─── Spreadsheet Editor ──────────────────────────────────────────────────────
const XLSX_COLS = 10;
const XLSX_ROWS = 22;
const XLSX_COL_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

function makeXlsxCell(value = "", opts: Partial<XlsxCell> = {}): XlsxCell {
  return { value, bold: false, italic: false, align: "left", format: "general", ...opts };
}
function makeEmptyXlsxGrid(rows = XLSX_ROWS, cols = XLSX_COLS): XlsxCell[][] {
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => makeXlsxCell()));
}

function getInitialSheets(filename: string): XlsxSheet[] {
  const lower = filename.toLowerCase();
  if (lower.includes("concilia") || lower.includes("bancaria") || lower.includes("banco") || lower.includes("tesor")) {
    const grid = makeEmptyXlsxGrid(17, 6);
    ["Fecha","Concepto","Cargo","Abono","Saldo","Referencia"].forEach((h, c) => { grid[0][c] = makeXlsxCell(h, { bold: true, align: "center" }); });
    [
      ["01/06/2025","Saldo inicial",           "",           "125,000.00","125,000.00","REF-0601"],
      ["03/06/2025","Pago proveedor A",        "12,500.00",  "",          "112,500.00","CHQ-1042"],
      ["05/06/2025","Cobro cliente B",         "",           "38,200.00", "150,700.00","TRF-2208"],
      ["07/06/2025","Nómina quincenal",        "45,000.00",  "",          "105,700.00","NOM-0615"],
      ["10/06/2025","Pago servicios TI",       "8,750.00",   "",          "96,950.00", "CHQ-1043"],
      ["12/06/2025","Cobro factura 4412",      "",           "22,400.00", "119,350.00","TRF-2209"],
      ["15/06/2025","Impuestos ISR",           "31,200.00",  "",          "88,150.00", "SAT-0615"],
      ["17/06/2025","Cobro anticipo",          "",           "15,000.00", "103,150.00","TRF-2211"],
      ["20/06/2025","Pago renta oficinas",     "18,500.00",  "",          "84,650.00", "CHQ-1044"],
      ["22/06/2025","Venta activo fijo",       "",           "9,800.00",  "94,450.00", "TRF-2213"],
      ["24/06/2025","Pago seguros",            "4,200.00",   "",          "90,250.00", "CHQ-1045"],
      ["26/06/2025","Cobro cliente D",         "",           "55,000.00", "145,250.00","TRF-2215"],
      ["28/06/2025","Pago mantenimiento",      "3,100.00",   "",          "142,150.00","CHQ-1046"],
      ["30/06/2025","Cierre de mes",           "",           "",          "142,150.00","CIE-0630"],
      ["30/06/2025","TOTAL",                   "123,250.00", "265,400.00","142,150.00",""],
    ].forEach((r, i) => r.forEach((v, c) => { grid[i+1][c] = makeXlsxCell(v, { align: c >= 2 && c <= 4 ? "right" : "left", bold: i === 14 }); }));
    return [
      { name: "Conciliación", grid },
      { name: "Detalle",      grid: makeEmptyXlsxGrid() },
      { name: "Resumen",      grid: makeEmptyXlsxGrid() },
    ];
  }
  if (lower.includes("riesgo") || lower.includes("matriz") || lower.includes("control")) {
    const grid = makeEmptyXlsxGrid(10, 7);
    ["ID","Riesgo","Probabilidad","Impacto","Nivel","Control","Estado"].forEach((h, c) => { grid[0][c] = makeXlsxCell(h, { bold: true, align: "center" }); });
    [
      ["RIE-001","Fraude financiero",         "Alta", "Crítico","Crítico","CTR-001","Activo"],
      ["RIE-002","Acceso no autorizado",       "Media","Alto",   "Alto",  "CTR-002","Activo"],
      ["RIE-003","Error en nómina",            "Baja", "Medio",  "Medio", "CTR-003","Revisión"],
      ["RIE-004","Incumplimiento regulatorio", "Media","Alto",   "Alto",  "CTR-004","Activo"],
      ["RIE-005","Pérdida de datos",           "Baja", "Crítico","Alto",  "CTR-005","Activo"],
    ].forEach((r, i) => r.forEach((v, c) => { grid[i+1][c] = makeXlsxCell(v); }));
    return [{ name: "Matriz", grid }, { name: "Controles", grid: makeEmptyXlsxGrid() }, { name: "Seguimiento", grid: makeEmptyXlsxGrid() }];
  }
  const grid = makeEmptyXlsxGrid();
  ["Referencia","Descripción","Monto","Fecha","Responsable"].forEach((h, c) => { grid[0][c] = makeXlsxCell(h, { bold: true }); });
  return [{ name: "Hoja1", grid }, { name: "Hoja2", grid: makeEmptyXlsxGrid() }];
}

function formatXlsxCell(cell: XlsxCell): string {
  if (!cell.value) return "";
  if (cell.format === "moneda") {
    const n = parseFloat(cell.value.replace(/,/g, ""));
    if (!isNaN(n)) return `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`;
  }
  if (cell.format === "porcentaje") {
    const n = parseFloat(cell.value.replace(/%/g, ""));
    if (!isNaN(n)) return `${n}%`;
  }
  return cell.value;
}

function XlsxToolBtn({ active, onClick, title, children }: { active?: boolean; onClick: () => void; title?: string; children: React.ReactNode }) {
  return (
    <button onClick={onClick} title={title}
      className={`w-7 h-7 flex items-center justify-center rounded text-sm transition-colors select-none ${active ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}>
      {children}
    </button>
  );
}

interface SpreadsheetEditorProps {
  filename: string;
  fileVersion?: number;
  entityId: string;
  onClose: () => void;
  onHashUpdate?: (newHash: string, newVersion: number) => void;
}

function SpreadsheetEditor({ filename, fileVersion = 3, onClose, onHashUpdate }: SpreadsheetEditorProps) {
  const [sheets, setSheets] = useState<XlsxSheet[]>(() => getInitialSheets(filename));
  const [activeIdx, setActiveIdx] = useState(0);
  const [sel, setSel] = useState({ r: 0, c: 0 });
  const [editing, setEditing] = useState<{ r: number; c: number } | null>(null);
  const [editVal, setEditVal] = useState("");
  const [isDirty, setIsDirty] = useState(false);
  const [version, setVersion] = useState(fileVersion);
  const [showHistory, setShowHistory] = useState(false);
  const [showUnsaved, setShowUnsaved] = useState(false);
  const [showVerComment, setShowVerComment] = useState(false);
  const [verComment, setVerComment] = useState("");
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; r: number; c: number } | null>(null);
  const [confirmRestore, setConfirmRestore] = useState<XlsxVersionEntry | null>(null);
  const [history, setHistory] = useState<XlsxVersionEntry[]>([
    { version: 1, author: "A. Rodríguez", date: "2025-06-10 09:15", comment: "Versión inicial" },
    { version: 2, author: "C. Morales",   date: "2025-07-02 14:30", comment: "Ajuste saldos Q2" },
    { version: 3, author: "M. García",    date: "2025-07-20 11:45", comment: "Revisión cierre mes" },
  ]);
  const editRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const grid = sheets[activeIdx].grid;
  const selCell = grid[sel.r]?.[sel.c] ?? makeXlsxCell();
  const cellId = `${XLSX_COL_LETTERS[sel.c] ?? "?"}${sel.r + 1}`;

  useEffect(() => { if (editing && editRef.current) { editRef.current.focus(); editRef.current.select(); } }, [editing]);

  useEffect(() => {
    if (!ctxMenu) return;
    const h = () => setCtxMenu(null);
    window.addEventListener("click", h);
    return () => window.removeEventListener("click", h);
  }, [ctxMenu]);

  const patchCell = (r: number, c: number, patch: Partial<XlsxCell>) => {
    setSheets(prev => prev.map((sh, si) => si !== activeIdx ? sh : {
      ...sh,
      grid: sh.grid.map((row, ri) => ri !== r ? row : row.map((cell, ci) => ci !== c ? cell : { ...cell, ...patch }))
    }));
    setIsDirty(true);
  };

  const commitEdit = () => {
    if (!editing) return;
    patchCell(editing.r, editing.c, { value: editVal });
    setEditing(null);
  };

  const startEdit = (r: number, c: number) => {
    setSel({ r, c });
    setEditing({ r, c });
    setEditVal(grid[r]?.[c]?.value ?? "");
  };

  const moveSel = (dr: number, dc: number) => {
    const maxR = grid.length - 1;
    const maxC = (grid[0]?.length ?? XLSX_COLS) - 1;
    setSel(p => ({ r: Math.max(0, Math.min(maxR, p.r + dr)), c: Math.max(0, Math.min(maxC, p.c + dc)) }));
  };

  const handleGridKey = (e: React.KeyboardEvent) => {
    if (editing) {
      if (e.key === "Enter")  { e.preventDefault(); commitEdit(); moveSel(1, 0); }
      else if (e.key === "Tab")    { e.preventDefault(); commitEdit(); moveSel(0, e.shiftKey ? -1 : 1); }
      else if (e.key === "Escape") { setEditing(null); }
    } else {
      const nav: Record<string, () => void> = {
        ArrowUp:    () => moveSel(-1, 0),
        ArrowDown:  () => moveSel(1, 0),
        ArrowLeft:  () => moveSel(0, -1),
        ArrowRight: () => moveSel(0, 1),
        Enter: () => startEdit(sel.r, sel.c),
        F2:    () => startEdit(sel.r, sel.c),
        Delete:    () => patchCell(sel.r, sel.c, { value: "" }),
        Backspace:  () => patchCell(sel.r, sel.c, { value: "" }),
      };
      if (nav[e.key]) { e.preventDefault(); nav[e.key](); }
      else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
        setEditVal(e.key);
        setEditing(sel);
      }
    }
  };

  const doSave = (comment = "") => {
    const newVer = version + 1;
    setVersion(newVer);
    setIsDirty(false);
    const newHash = "sha256:" + Math.random().toString(36).slice(2,10) + "…" + Math.random().toString(36).slice(2,10);
    setHistory(prev => [...prev, { version: newVer, author: "M. García", date: new Date().toLocaleString("es-MX"), comment: comment || "Guardado" }]);
    onHashUpdate?.(newHash, newVer);
    toast.success(`Versión ${newVer} guardada · hash actualizado`);
  };

  const handleClose = () => { if (isDirty) setShowUnsaved(true); else onClose(); };

  const addRow = () => setSheets(prev => prev.map((sh, si) => si !== activeIdx ? sh : { ...sh, grid: [...sh.grid, Array.from({ length: sh.grid[0]?.length ?? XLSX_COLS }, () => makeXlsxCell())] }));
  const addCol = () => setSheets(prev => prev.map((sh, si) => si !== activeIdx ? sh : { ...sh, grid: sh.grid.map(row => [...row, makeXlsxCell()]) }));
  const insertRowAt = (r: number, below = false) => {
    const pos = below ? r + 1 : r;
    setSheets(prev => prev.map((sh, si) => si !== activeIdx ? sh : { ...sh, grid: [...sh.grid.slice(0, pos), Array.from({ length: sh.grid[0]?.length ?? XLSX_COLS }, () => makeXlsxCell()), ...sh.grid.slice(pos)] }));
    setIsDirty(true); setCtxMenu(null);
  };
  const deleteRow = (r: number) => { if (grid.length <= 1) return; setSheets(prev => prev.map((sh, si) => si !== activeIdx ? sh : { ...sh, grid: sh.grid.filter((_, ri) => ri !== r) })); setIsDirty(true); setCtxMenu(null); };
  const insertColAt = (c: number) => { setSheets(prev => prev.map((sh, si) => si !== activeIdx ? sh : { ...sh, grid: sh.grid.map(row => [...row.slice(0, c), makeXlsxCell(), ...row.slice(c)]) })); setIsDirty(true); setCtxMenu(null); };
  const deleteCol = (c: number) => { if (grid[0]?.length <= 1) return; setSheets(prev => prev.map((sh, si) => si !== activeIdx ? sh : { ...sh, grid: sh.grid.map(row => row.filter((_, ci) => ci !== c)) })); setIsDirty(true); setCtxMenu(null); };

  const COL_W = 110; const ROW_H = 28; const HDR_W = 44;

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-[#f4f5f7]" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>

      {/* ── Top bar ── */}
      <div className="flex items-center gap-3 px-4 h-12 bg-[#1a2e4a] text-white flex-shrink-0 shadow-md">
        <FileSpreadsheet size={16} className="text-emerald-400 flex-shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold truncate">{filename}</span>
            {isDirty && <span className="text-[10px] bg-amber-500/90 text-white px-1.5 py-0.5 rounded font-bold flex-shrink-0">Sin guardar</span>}
          </div>
          <div className="text-[10px] text-white/50 leading-none mt-0.5">v{version} · editado por M. García hace 2 h</div>
        </div>
        <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 bg-white/10 rounded text-[10px] text-white/60 border border-white/15 flex-shrink-0">
          <span>Editando con Excel Online (Microsoft 365)</span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button onClick={() => doSave()} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-md transition-colors">
            <Save size={12} /> Guardar
          </button>
          <button onClick={() => setShowVerComment(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-md transition-colors border border-white/20">
            <Plus size={12} /> Nueva versión
          </button>
          <button onClick={() => setShowHistory(h => !h)} className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors border border-white/20 ${showHistory ? "bg-white/25" : "bg-white/10 hover:bg-white/20"}`}>
            <Activity size={12} /> Historial
          </button>
          <button onClick={handleClose} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-md transition-colors border border-white/20 ml-1">
            <X size={12} /> Cerrar
          </button>
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-0.5 px-3 h-9 bg-white border-b border-border flex-shrink-0">
        <XlsxToolBtn active={selCell.bold}   onClick={() => patchCell(sel.r, sel.c, { bold: !selCell.bold })}   title="Negrita (Ctrl+B)"><span className="font-bold text-xs leading-none">N</span></XlsxToolBtn>
        <XlsxToolBtn active={selCell.italic} onClick={() => patchCell(sel.r, sel.c, { italic: !selCell.italic })} title="Cursiva (Ctrl+I)"><span className="italic text-xs leading-none">K</span></XlsxToolBtn>
        <div className="w-px h-5 bg-border mx-1" />
        <XlsxToolBtn active={selCell.align === "left"}   onClick={() => patchCell(sel.r, sel.c, { align: "left" })}   title="Izquierda"><AlignLeft   size={13} /></XlsxToolBtn>
        <XlsxToolBtn active={selCell.align === "center"} onClick={() => patchCell(sel.r, sel.c, { align: "center" })} title="Centrar"><AlignCenter size={13} /></XlsxToolBtn>
        <XlsxToolBtn active={selCell.align === "right"}  onClick={() => patchCell(sel.r, sel.c, { align: "right" })}  title="Derecha"><AlignRight  size={13} /></XlsxToolBtn>
        <div className="w-px h-5 bg-border mx-1" />
        <select value={selCell.format} onChange={e => patchCell(sel.r, sel.c, { format: e.target.value as CellFormat })}
          className="text-xs border border-border rounded px-1.5 py-0.5 bg-white focus:outline-none focus:ring-1 focus:ring-primary/40 text-foreground h-6">
          <option value="general">General</option>
          <option value="moneda">Moneda</option>
          <option value="porcentaje">Porcentaje</option>
        </select>
        <div className="w-px h-5 bg-border mx-1" />
        <button onClick={addRow} className="flex items-center gap-0.5 text-[11px] px-2 py-1 rounded hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"><Plus size={11} />Fila</button>
        <button onClick={addCol} className="flex items-center gap-0.5 text-[11px] px-2 py-1 rounded hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"><Plus size={11} />Columna</button>
      </div>

      {/* ── Formula bar ── */}
      <div className="flex items-center gap-2 px-3 h-8 bg-white border-b border-border flex-shrink-0">
        <div className="w-14 flex-shrink-0 text-xs font-mono font-bold text-primary bg-primary/8 px-2 py-0.5 rounded text-center select-none">{cellId}</div>
        <div className="w-px h-5 bg-border flex-shrink-0" />
        <input
          value={editing ? editVal : selCell.value}
          onChange={e => { if (editing) setEditVal(e.target.value); else { setEditing(sel); setEditVal(e.target.value); } }}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); commitEdit(); } else if (e.key === "Escape") setEditing(null); }}
          placeholder="Contenido de la celda…"
          className="flex-1 text-xs focus:outline-none bg-transparent font-mono text-foreground placeholder:text-muted-foreground/40"
        />
      </div>

      {/* ── Grid + optional history panel ── */}
      <div className="flex flex-1 overflow-hidden">
        <div ref={gridRef} className="flex-1 overflow-auto" onKeyDown={handleGridKey} tabIndex={0} style={{ outline: "none" }}>
          <table className="border-collapse" style={{ tableLayout: "fixed", minWidth: HDR_W + (grid[0]?.length ?? XLSX_COLS) * COL_W }}>
            <thead>
              <tr>
                <th style={{ width: HDR_W, minWidth: HDR_W }} className="bg-[#f0f1f3] border border-[#d0d3d8] text-[10px] text-muted-foreground sticky top-0 z-10" />
                {(grid[0] ?? []).map((_, c) => (
                  <th key={c} style={{ width: COL_W, minWidth: 64 }} className={`bg-[#f0f1f3] border border-[#d0d3d8] text-[10px] font-semibold text-center sticky top-0 z-10 select-none transition-colors ${sel.c === c ? "bg-primary/15 text-primary" : "text-muted-foreground"}`}>
                    {XLSX_COL_LETTERS[c] ?? String(c + 1)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grid.map((row, r) => (
                <tr key={r}>
                  <td className={`bg-[#f0f1f3] border border-[#d0d3d8] text-[10px] text-center select-none sticky left-0 z-10 transition-colors ${sel.r === r ? "bg-primary/15 text-primary font-semibold" : "text-muted-foreground"}`} style={{ width: HDR_W, height: ROW_H }}>{r + 1}</td>
                  {row.map((cell, c) => {
                    const isSelected = sel.r === r && sel.c === c;
                    const isEditing  = editing?.r === r && editing?.c === c;
                    return (
                      <td key={c}
                        style={{ width: COL_W, height: ROW_H, position: "relative" }}
                        className={`border border-[#d0d3d8] px-1.5 text-xs overflow-hidden select-none cursor-cell ${isSelected ? "outline outline-2 outline-primary outline-offset-[-2px] bg-primary/[0.04] z-10" : "hover:bg-blue-50/40"}`}
                        onClick={() => { commitEdit(); setSel({ r, c }); setEditing(null); }}
                        onDoubleClick={() => startEdit(r, c)}
                        onContextMenu={e => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, r, c }); setSel({ r, c }); }}
                      >
                        {isEditing ? (
                          <input ref={editRef} value={editVal} onChange={e => setEditVal(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); commitEdit(); moveSel(1,0); } else if (e.key === "Tab") { e.preventDefault(); commitEdit(); moveSel(0, e.shiftKey ? -1 : 1); } else if (e.key === "Escape") setEditing(null); }}
                            onBlur={commitEdit}
                            className="absolute inset-0 w-full h-full px-1.5 text-xs border-none bg-white z-20 font-mono focus:outline-none shadow-[0_0_0_2px_#0F4FFF]"
                            style={{ textAlign: cell.align }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center overflow-hidden" style={{ fontWeight: cell.bold ? 700 : 400, fontStyle: cell.italic ? "italic" : "normal", justifyContent: cell.align === "center" ? "center" : cell.align === "right" ? "flex-end" : "flex-start" }}>
                            <span className="truncate text-foreground">{formatXlsxCell(cell)}</span>
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* History panel */}
        {showHistory && (
          <div className="w-72 border-l border-border bg-white flex-shrink-0 flex flex-col shadow-inner">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <Activity size={13} className="text-primary" />
                <div className="text-sm font-bold text-foreground">Historial</div>
              </div>
              <button onClick={() => setShowHistory(false)} className="p-1 text-muted-foreground hover:text-foreground rounded transition-colors"><X size={13} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {[...history].reverse().map(v => (
                <div key={v.version} className={`p-3 rounded-lg border ${v.version === version ? "border-primary/40 bg-primary/5" : "border-border bg-secondary/20"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-xs font-bold text-primary">v{v.version}</span>
                        {v.version === version && <span className="text-[10px] bg-primary text-white px-1 rounded font-bold">Actual</span>}
                      </div>
                      <div className="text-[10px] text-muted-foreground">{v.author}</div>
                      <div className="text-[10px] font-mono text-muted-foreground">{v.date}</div>
                      {v.comment && <div className="text-xs text-foreground mt-1 italic truncate">"{v.comment}"</div>}
                    </div>
                    {v.version !== version && (
                      <button onClick={() => setConfirmRestore(v)} className="flex-shrink-0 text-[10px] px-2 py-1 border border-border rounded text-muted-foreground hover:text-primary hover:border-primary transition-colors">
                        Restaurar
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Sheet tabs ── */}
      <div className="flex items-center gap-0 h-8 bg-white border-t border-border flex-shrink-0 overflow-x-auto">
        {sheets.map((sh, i) => (
          <button key={i} onClick={() => setActiveIdx(i)}
            className={`px-4 h-full text-xs font-medium border-r border-border whitespace-nowrap transition-colors ${i === activeIdx ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"}`}>
            {sh.name}
          </button>
        ))}
        <button onClick={() => { setSheets(p => [...p, { name: `Hoja${sheets.length + 1}`, grid: makeEmptyXlsxGrid() }]); setActiveIdx(sheets.length); }}
          className="px-3 h-full text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
          <Plus size={12} />
        </button>
      </div>

      {/* ── Context menu ── */}
      {ctxMenu && (
        <div className="fixed bg-white border border-border rounded-lg shadow-xl py-1 z-[80] w-52" style={{ left: ctxMenu.x, top: ctxMenu.y }} onClick={e => e.stopPropagation()}>
          {([
            { label: "Insertar fila arriba",  fn: () => insertRowAt(ctxMenu.r, false) },
            { label: "Insertar fila abajo",   fn: () => insertRowAt(ctxMenu.r, true) },
            { label: "Eliminar fila",          fn: () => deleteRow(ctxMenu.r), danger: true },
            null,
            { label: "Insertar columna aquí", fn: () => insertColAt(ctxMenu.c) },
            { label: "Eliminar columna",       fn: () => deleteCol(ctxMenu.c), danger: true },
          ] as (null | { label: string; fn: () => void; danger?: boolean })[]).map((item, i) =>
            item ? (
              <button key={i} onClick={item.fn}
                className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${item.danger ? "text-red-600 hover:bg-red-50" : "text-foreground hover:bg-secondary"}`}>
                {item.label}
              </button>
            ) : <div key={i} className="h-px bg-border my-1" />
          )}
        </div>
      )}

      {/* ── Unsaved changes dialog ── */}
      {showUnsaved && (
        <>
          <div className="fixed inset-0 bg-black/50 z-[75]" />
          <div className="fixed inset-0 z-[76] flex items-center justify-center p-4">
            <div className="bg-card rounded-xl shadow-2xl p-6 max-w-sm w-full">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-amber-50 rounded-lg"><AlertTriangle size={16} className="text-amber-600" /></div>
                <div className="text-sm font-bold text-foreground">Cambios sin guardar</div>
              </div>
              <p className="text-xs text-muted-foreground mb-5">Tienes cambios sin guardar en <strong className="text-foreground">{filename}</strong>. ¿Qué deseas hacer?</p>
              <div className="flex gap-2">
                <button onClick={() => { doSave(); setShowUnsaved(false); onClose(); }} className="flex-1 px-3 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:bg-primary/90 transition-colors">Guardar</button>
                <button onClick={() => { setShowUnsaved(false); onClose(); }} className="px-3 py-2 border border-border text-xs font-semibold rounded-lg hover:bg-secondary transition-colors">Descartar</button>
                <button onClick={() => setShowUnsaved(false)} className="px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors">Cancelar</button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Nueva versión: comentario ── */}
      {showVerComment && (
        <>
          <div className="fixed inset-0 bg-black/50 z-[75]" />
          <div className="fixed inset-0 z-[76] flex items-center justify-center p-4">
            <div className="bg-card rounded-xl shadow-2xl p-6 max-w-sm w-full">
              <div className="text-sm font-bold text-foreground mb-1">Guardar como nueva versión</div>
              <div className="text-xs text-muted-foreground mb-4">Agrega un comentario opcional para identificar esta versión.</div>
              <textarea value={verComment} onChange={e => setVerComment(e.target.value)}
                placeholder="Ej. Ajuste de saldos cierre Q3…" rows={3}
                className="w-full text-xs px-3 py-2 border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white mb-4" />
              <div className="flex gap-2">
                <button onClick={() => { doSave(verComment); setShowVerComment(false); setVerComment(""); }}
                  className="flex-1 px-3 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:bg-primary/90 transition-colors">
                  Guardar versión
                </button>
                <button onClick={() => { setShowVerComment(false); setVerComment(""); }}
                  className="px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors border border-border rounded-lg">
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Restaurar confirmación ── */}
      {confirmRestore && (
        <>
          <div className="fixed inset-0 bg-black/50 z-[75]" />
          <div className="fixed inset-0 z-[76] flex items-center justify-center p-4">
            <div className="bg-card rounded-xl shadow-2xl p-6 max-w-sm w-full">
              <div className="text-sm font-bold text-foreground mb-1">Restaurar versión {confirmRestore.version}</div>
              <p className="text-xs text-muted-foreground mb-5">
                ¿Confirmas restaurar <strong>v{confirmRestore.version}</strong>{confirmRestore.comment ? ` — "${confirmRestore.comment}"` : ""}?
                Los cambios actuales sin guardar se perderán.
              </p>
              <div className="flex gap-2">
                <button onClick={() => { setSheets(getInitialSheets(filename)); setVersion(confirmRestore.version); setIsDirty(false); setConfirmRestore(null); toast.success(`Versión ${confirmRestore.version} restaurada correctamente`); }}
                  className="flex-1 px-3 py-2 bg-destructive text-destructive-foreground text-xs font-semibold rounded-lg hover:bg-destructive/90 transition-colors">
                  Restaurar
                </button>
                <button onClick={() => setConfirmRestore(null)} className="px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors border border-border rounded-lg">
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const NAV_LABELS: Record<NavView, string> = {
  dashboard: "Dashboard",
  filter: "Filtrar",
  editor: "Editor de Vistas",
  hierarchy: "Catálogo Organizacional",
  settings: "Ajustes del Sistema",
  users: "Usuarios & Roles",
  bitacora: "Bitácora de Actividad",
  plans: "Planes de Auditoría",
  findings: "Hallazgos",
  auditado: "Portal del Auditado",
};

const DETAIL_LABELS: Record<DetailType, string> = {
  general_risk: "Riesgo General",
  specific_risk: "Riesgo Específico",
  audit_entity: "Entidad Auditora",
  control: "Procedimiento de Control",
};

type StackEntry = { type: DetailType; id: string };

export default function App() {
  const [navView, setNavView] = useState<NavView>("dashboard");
  const [stack, setStack] = useState<StackEntry[]>([]);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [tourActive, setTourActive] = useState(() => {
    try { return localStorage.getItem("expedite_tour_done") !== "1"; } catch { return true; }
  });

  const goToNav = (v: NavView) => {
    setNavView(v);
    setStack([]);
  };
  const navigate: Navigate = (type, id) =>
    setStack((prev) => [...prev, { type, id }]);
  const popTo = (index: number) =>
    setStack((prev) => prev.slice(0, index + 1));
  const clearStack = () => setStack([]);

  const top = stack[stack.length - 1] ?? null;

  // Build breadcrumb nodes for detail views
  const crumbs = top ? (
    <nav className="flex items-center gap-1 text-xs text-muted-foreground mb-4 flex-wrap">
      <button
        onClick={() => {
          goToNav("dashboard");
        }}
        className="hover:text-foreground transition-colors"
      >
        Inicio
      </button>
      <ChevronRight
        size={11}
        className="text-muted-foreground/40"
      />
      <button
        onClick={clearStack}
        className="hover:text-foreground transition-colors"
      >
        {NAV_LABELS[navView]}
      </button>
      {stack.map((entry, i) => {
        const isLast = i === stack.length - 1;
        const label = entry.id;
        return (
          <span key={i} className="flex items-center gap-1">
            <ChevronRight
              size={11}
              className="text-muted-foreground/40"
            />
            {isLast ? (
              <span className="font-semibold text-foreground">
                {label}
              </span>
            ) : (
              <button
                onClick={() => popTo(i)}
                className="hover:text-foreground transition-colors"
              >
                {label}
              </button>
            )}
          </span>
        );
      })}
    </nav>
  ) : null;

  const renderContent = () => {
    if (top) {
      switch (top.type) {
        case "general_risk":
          return (
            <GeneralRiskDetailView
              id={top.id}
              navigate={navigate}
              crumbs={crumbs}
            />
          );
        case "specific_risk":
          return (
            <SpecificRiskDetailView
              id={top.id}
              navigate={navigate}
              crumbs={crumbs}
            />
          );
        case "audit_entity":
          return (
            <AuditEntityDetailView
              id={top.id}
              navigate={navigate}
              crumbs={crumbs}
            />
          );
        case "control":
          return (
            <ControlDetailView id={top.id} crumbs={crumbs} />
          );
      }
    }
    switch (navView) {
      case "dashboard":
        return <DashboardView onNav={goToNav} />;
      case "filter":
        return <FilterView navigate={navigate} />;
      case "editor":
        return <EditorView />;
      case "hierarchy":
        return <HierarchyView />;
      case "settings":
        return (
          <SettingsView
            onOpenEditor={() => goToNav("editor")}
          />
        );
      case "users":
        return <UsersRolesView />;
      case "bitacora":
        return <BitacoraView />;
      case "plans":
        return <AuditPlansView canCreate={true} />;
      case "findings":
        return <FindingsView />;
      case "auditado":
        return <AuditadoPortalView />;
    }
  };

  const topLabel = top
    ? `${DETAIL_LABELS[top.type]} — ${top.id}`
    : NAV_LABELS[navView];

  const handleTourClose = () => {
    setTourActive(false);
    try { localStorage.setItem("expedite_tour_done", "1"); } catch {}
  };

  return (
    <div
      className="flex h-screen w-full overflow-hidden bg-background"
      style={{
        fontFamily: "'Plus Jakarta Sans', Inter, sans-serif",
      }}
    >
      <Sidebar active={navView} onNav={goToNav} />
      <div className={`flex flex-col flex-1 overflow-hidden transition-all ${copilotOpen ? "mr-96" : ""}`}>
        <TopBar viewLabel={topLabel} />
        {renderContent()}
      </div>
      <Toaster position="bottom-right" richColors />
      <CopilotPanel currentView={top ? top.type : navView} open={copilotOpen} onToggle={() => setCopilotOpen(o => !o)} />
      {tourActive && <GuidedTour onClose={handleTourClose} />}
      {/* Tour relaunch button */}
      {!tourActive && !copilotOpen && (
        <button
          onClick={() => setTourActive(true)}
          title="Relanzar tour guiado"
          className="fixed bottom-6 left-[calc(256px+1rem)] z-[62] w-8 h-8 flex items-center justify-center rounded-full bg-card border border-border shadow-md text-muted-foreground hover:text-primary hover:border-primary transition-colors text-sm font-bold"
        >
          ?
        </button>
      )}
    </div>
  );
}