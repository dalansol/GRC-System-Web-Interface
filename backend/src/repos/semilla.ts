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
