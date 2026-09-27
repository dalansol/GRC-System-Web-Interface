import type {
  Finding
} from "../components/SharedComponents";

export {INITIAL_FINDINGS};


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