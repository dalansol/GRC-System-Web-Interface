// Roles y permisos iniciales. Deben coincidir con sql/002_seed.sql.

export const PERMISOS = [
  "Ver Dashboard",
  "Editar Registros",
  "Gestionar Usuarios",
  "Aprobar Riesgos",
  "Exportar Datos",
  "Ver Auditorías",
  "Crear Auditorías",
  "Eliminar Registros",
] as const;

export const ROLES_PERMISOS: Record<string, readonly string[]> = {
  "Administrador": PERMISOS,
  "Jefe de Auditoría": ["Ver Dashboard", "Editar Registros", "Aprobar Riesgos", "Exportar Datos", "Ver Auditorías", "Crear Auditorías"],
  "Auditor Senior": ["Ver Dashboard", "Editar Registros", "Exportar Datos", "Ver Auditorías"],
  "Auditor": ["Ver Dashboard", "Ver Auditorías"],
  "Consultor": ["Ver Dashboard", "Ver Auditorías"],
  "Solo Lectura": ["Ver Dashboard", "Ver Auditorías"],
};

// Usuarios de prueba para el modo de datos en memoria.
export const USUARIOS_DEMO = [
  { nombre: "Sofía Ramírez", correo: "s.ramirez@expedite.com", rol: "Administrador", estado: "active" },
  { nombre: "María García", correo: "m.garcia@expedite.com", rol: "Jefe de Auditoría", estado: "active" },
  { nombre: "Carlos Morales", correo: "c.morales@expedite.com", rol: "Auditor Senior", estado: "active" },
  { nombre: "Ana Rodríguez", correo: "a.rodriguez@expedite.com", rol: "Auditor", estado: "active" },
  { nombre: "Pedro Sánchez", correo: "p.sanchez@expedite.com", rol: "Consultor", estado: "inactive" },
  { nombre: "Laura Fernández", correo: "l.fernandez@expedite.com", rol: "Auditor", estado: "active" },
  { nombre: "Diego Torres", correo: "d.torres@expedite.com", rol: "Solo Lectura", estado: "active" },
] as const;

// Planes de prueba para el modo de datos en memoria (los mismos que mock_data.tsx).
export const PLANES_DEMO = [
  {
    codigo: "PAI-2025-001", nombre: "Plan Auditoría Financiera LATAM", tipo: "Anual" as const, periodo: "Q1–Q2 2025",
    fechaInicio: "2025-01-15", fechaFin: "2025-06-30", estado: "Aprobado" as const, horasEstimadas: 320,
    responsable: "m.garcia@expedite.com",
    alcance: "Cierre contable, conciliaciones bancarias y reportes a casa matriz en MX, BR, CO",
  },
  {
    codigo: "PAI-2025-002", nombre: "Plan Auditoría TI & Ciberseguridad", tipo: "Anual" as const, periodo: "Q2–Q3 2025",
    fechaInicio: "2025-04-01", fechaFin: "2025-09-30", estado: "En Ejecución" as const, horasEstimadas: 240,
    responsable: "c.morales@expedite.com",
    alcance: "Accesos privilegiados, seguridad perimetral, revisión de vulnerabilidades",
  },
  {
    codigo: "PAI-2025-003", nombre: "Plan Auditoría Cumplimiento Regulatorio", tipo: "Trimestral" as const, periodo: "Q3–Q4 2025",
    fechaInicio: "2025-07-01", fechaFin: "2025-12-31", estado: "Borrador" as const, horasEstimadas: 180,
    responsable: "a.rodriguez@expedite.com",
    alcance: "Obligaciones regulatorias GDPR, SUNAT, Superintendencia Financiera Colombia",
  },
  {
    codigo: "PAI-2024-012", nombre: "Plan Auditoría Operacional LATAM", tipo: "Trimestral" as const, periodo: "Q4 2024",
    fechaInicio: "2024-10-01", fechaFin: "2024-12-31", estado: "Cerrado" as const, horasEstimadas: 290,
    responsable: "m.garcia@expedite.com",
    alcance: "Cadena de suministro, logística y distribución en toda la región",
  },
] as const;

// Auditorías de prueba (las mismas que AUDIT_RECORDS en mock_data.tsx). La fecha de cierre
// es la que se compara con la fecha de compromiso de los planes de acción.
export const AUDITORIAS_DEMO = [
  { id: "AUD-001", nombre: "Auditoría SOX — Cuentas por Pagar", fechaCierre: "2025-08-31" },
  { id: "AUD-002", nombre: "Auditoría Operacional — Cadena de Suministro", fechaCierre: "2025-05-30" },
  { id: "AUD-003", nombre: "Auditoría de Cumplimiento — GDPR", fechaCierre: "2025-11-30" },
  { id: "AUD-004", nombre: "Auditoría Interna — Recursos Humanos", fechaCierre: "2025-06-30" },
] as const;

// Hallazgos de prueba para el modo en memoria (los mismos que INITIAL_FINDINGS en mock_data.tsx).
export const HALLAZGOS_DEMO = [
  { id: "HAL-2025-001", folio: "HAL-2025-001", titulo: "Segregación de funciones insuficiente en cierre contable", severidad: "Crítico", auditoriaId: "AUD-001", controlId: "CTR-002" },
  { id: "HAL-2025-002", folio: "HAL-2025-002", titulo: "Cuentas privilegiadas de ex-empleados activas en producción", severidad: "Alto", auditoriaId: "AUD-001", controlId: "CTR-003" },
  { id: "HAL-2025-003", folio: "HAL-2025-003", titulo: "Calendario normativo desactualizado — SFC Colombia", severidad: "Medio", auditoriaId: "AUD-003", controlId: "CTR-004" },
  { id: "HAL-2025-004", folio: "HAL-2025-004", titulo: "Firewall con configuración obsoleta — Oficina Colombia", severidad: "Alto", auditoriaId: "AUD-002", controlId: "CTR-003" },
  { id: "HAL-2024-018", folio: "HAL-2024-018", titulo: "Proceso de nómina sin doble aprobación — Operaciones", severidad: "Bajo", auditoriaId: "AUD-004", controlId: "CTR-001" },
] as const;

// Plan de acción de prueba (el mismo que trae HAL-2025-001 en mock_data.tsx).
export const PLANES_ACCION_DEMO = [
  {
    hallazgoId: "HAL-2025-001",
    descripcion: "Revisar y reasignar roles en SAP para eliminar conflictos de acceso. Implementar aprobación dual en todas las conciliaciones.",
    responsable: "c.morales@expedite.com",
    fechaCompromiso: "2025-09-15",
  },
] as const;
