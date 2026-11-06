// src/app/data/datosPortalAuditado.ts

export interface DbUser {
  id: number;
  name: string;
  email: string;
  role_id: number;
  status: string;
  entra_oid?: string | null;
  last_login?: string | null;
  created_at: string;
  manager_id?: number | null;
  business_unit_id?: number | null;
}

export interface DbFinding {
  id: string;
  folio?: string | null;
  title: string;
  description?: string | null;
  type?: string | null;
  severity: string;
  status: string;
  auditId?: string | null;
  controlId?: string | null;
  failedControl?: string | null;
  residualRisk?: string | null;
  ownerId?: string | null;
  created_at: string;
}

export interface DbActionPlan {
  id: number;
  public_id: string;
  title: string; // New column added to action_plans
  root_cause: string;
  responsible_id: number;
  due_date: string;
  status: string;
  created_by: number;
  created_at: string;
}

export interface DbActionPlanFinding {
  action_plan_id: number;
  finding_id: string;
}

export interface DbActionPlanStep {
  id: number;
  action_plan_id: number;
  assigned_user_id?: number | null;
  description: string;
  due_date?: string | null;
  is_completed?: boolean | null;
  created_at: string;
}

// ============================================================================
// MOCK USERS (#20 & #21)
// ============================================================================

export const mockUsers: DbUser[] = [
  {
    id: 20,
    name: "Javier Ejemplo",
    email: "j.ejemplo@expedite.com",
    role_id: 25,
    status: "active",
    entra_oid: null,
    last_login: "2026-10-29 16:03:05+00",
    created_at: "2026-10-24 17:44:04+00",
    manager_id: null,
    business_unit_id: 10
  },
  {
    id: 21,
    name: "Charlie Ejemplo",
    email: "c.ejemplo@expedite.com",
    role_id: 26,
    status: "active",
    entra_oid: null,
    last_login: null,
    created_at: "2026-10-24 17:45:06+00",
    manager_id: 20,
    business_unit_id: 10
  }
];

export const mockUsuarioAuditado = mockUsers[0];

// ============================================================================
// MOCK FINDINGS
// ============================================================================

export const mockDbFindings: DbFinding[] = [
  {
    id: "1792772643602",
    folio: "HAL-2026-001",
    title: "Inconsistencia en Conciliación Bancaria Mensual",
    description: "Se identificaron discrepancias en las partidas en tránsito con antigüedad superior a 90 días dentro de la cuenta operativa principal de la Unidad de Negocio #10.",
    type: "Control Interno",
    severity: "Alto",
    status: "Abierto",
    auditId: "10",
    controlId: "CTR-001",
    failedControl: "Control de Conciliación Bancaria",
    residualRisk: "Medio",
    ownerId: "20",
    created_at: "2026-10-25T10:00:00+00"
  },
  {
    id: "1792772643603",
    folio: "HAL-2026-002",
    title: "Falta de Segregación de Funciones en Altas de Proveedores",
    description: "El mismo usuario en el sistema ERP registra y aprueba la creación de nuevos proveedores en la base maestra sin una revisión independiente requerida.",
    type: "SoD / Acceso",
    severity: "Crítico",
    status: "En Proceso",
    auditId: "10",
    controlId: "CTR-002",
    failedControl: "Matriz SoD ERP",
    residualRisk: "Alto",
    ownerId: "20",
    created_at: "2026-10-25T11:30:00+00"
  }
];

// ============================================================================
// MOCK ACTION PLANS (Updated with title column)
// ============================================================================

export const mockDbActionPlans: DbActionPlan[] = [
  {
    id: 101,
    public_id: "PACC-2026-001",
    title: "Plan Remedial para Conciliaciones Bancarias de Tesorería",
    root_cause: "Falta de automatización en el proceso de conciliación bancaria y ausencia de alertas tempranas para partidas antiguas.",
    responsible_id: 20, // Javier Ejemplo
    due_date: "2026-11-15",
    status: "En Progreso",
    created_by: 20,
    created_at: "2026-10-26T09:00:00+00"
  },
  {
    id: 102,
    public_id: "PACC-2026-002",
    title: "Implementación de Matriz de Segregación de Funciones en ERP",
    root_cause: "Controles de acceso desactualizados en el ERP tras la reestructuración de roles del departamento de cuentas por pagar.",
    responsible_id: 20, // Javier Ejemplo
    due_date: "2026-12-01",
    status: "Asignado",
    created_by: 20,
    created_at: "2026-10-27T14:20:00+00"
  }
];

export const mockDbActionPlanFindings: DbActionPlanFinding[] = [
  { action_plan_id: 101, finding_id: "1792772643602" },
  { action_plan_id: 102, finding_id: "1792772643603" },
];

// ============================================================================
// MOCK ACTION PLAN STEPS
// ============================================================================

export const mockDbActionPlanSteps: DbActionPlanStep[] = [
  {
    id: 1,
    action_plan_id: 101,
    assigned_user_id: 21, // Charlie Ejemplo
    description: "Diseño y actualización del manual de procedimientos operativos.",
    due_date: "2026-11-05",
    is_completed: true,
    created_at: "2026-10-26T09:30:00+00"
  },
  {
    id: 2,
    action_plan_id: 101,
    assigned_user_id: 21, // Charlie Ejemplo
    description: "Implementación de la validación cruzada automatizada en el módulo ERP.",
    due_date: "2026-11-12",
    is_completed: false,
    created_at: "2026-10-26T09:30:00+00"
  },
  {
    id: 3,
    action_plan_id: 101,
    assigned_user_id: 20, // Javier Ejemplo
    description: "Capacitación al equipo operativo y entrega de evidencias al auditor.",
    due_date: "2026-11-15",
    is_completed: false,
    created_at: "2026-10-26T09:30:00+00"
  },
  {
    id: 4,
    action_plan_id: 102,
    assigned_user_id: 21, // Charlie Ejemplo
    description: "Revisión de la matriz SoD con el equipo de Seguridad Informática.",
    due_date: "2026-11-20",
    is_completed: false,
    created_at: "2026-10-27T15:00:00+00"
  },
  {
    id: 5,
    action_plan_id: 102,
    assigned_user_id: 20, // Javier Ejemplo
    description: "Aplicación de reglas de bloqueo directo en ambiente de producción.",
    due_date: "2026-12-01",
    is_completed: false,
    created_at: "2026-10-27T15:00:00+00"
  }
];

export const cargarMockDatosPortal = async () => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        users: mockUsers,
        findings: mockDbFindings,
        actionPlans: mockDbActionPlans,
        actionPlanSteps: mockDbActionPlanSteps
      });
    }, 400);
  });
};