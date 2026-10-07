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
