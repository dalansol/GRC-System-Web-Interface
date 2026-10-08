-- Roles y permisos iniciales. Debe coincidir con src/repos/semilla.ts.
-- Se puede ejecutar más de una vez sin duplicar datos.

-- Los índices filtrados exigen estas opciones; sqlcmd no las activa por omisión.
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;

INSERT INTO dbo.roles (name)
SELECT v.name
FROM (VALUES
    (1, N'Administrador'),
    (2, N'Jefe de Auditoría'),
    (3, N'Auditor Senior'),
    (4, N'Auditor'),
    (5, N'Consultor'),
    (6, N'Solo Lectura')
) AS v (orden, name)
WHERE NOT EXISTS (SELECT 1 FROM dbo.roles r WHERE r.name = v.name)
ORDER BY v.orden;

INSERT INTO dbo.permissions (name)
SELECT v.name
FROM (VALUES
    (1, N'Ver Dashboard'),
    (2, N'Editar Registros'),
    (3, N'Gestionar Usuarios'),
    (4, N'Aprobar Riesgos'),
    (5, N'Exportar Datos'),
    (6, N'Ver Auditorías'),
    (7, N'Crear Auditorías'),
    (8, N'Eliminar Registros')
) AS v (orden, name)
WHERE NOT EXISTS (SELECT 1 FROM dbo.permissions p WHERE p.name = v.name)
ORDER BY v.orden;

INSERT INTO dbo.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM (VALUES
    (N'Administrador',     N'Ver Dashboard'),
    (N'Administrador',     N'Editar Registros'),
    (N'Administrador',     N'Gestionar Usuarios'),
    (N'Administrador',     N'Aprobar Riesgos'),
    (N'Administrador',     N'Exportar Datos'),
    (N'Administrador',     N'Ver Auditorías'),
    (N'Administrador',     N'Crear Auditorías'),
    (N'Administrador',     N'Eliminar Registros'),
    (N'Jefe de Auditoría', N'Ver Dashboard'),
    (N'Jefe de Auditoría', N'Editar Registros'),
    (N'Jefe de Auditoría', N'Aprobar Riesgos'),
    (N'Jefe de Auditoría', N'Exportar Datos'),
    (N'Jefe de Auditoría', N'Ver Auditorías'),
    (N'Jefe de Auditoría', N'Crear Auditorías'),
    (N'Auditor Senior',    N'Ver Dashboard'),
    (N'Auditor Senior',    N'Editar Registros'),
    (N'Auditor Senior',    N'Exportar Datos'),
    (N'Auditor Senior',    N'Ver Auditorías'),
    (N'Auditor',           N'Ver Dashboard'),
    (N'Auditor',           N'Ver Auditorías'),
    (N'Consultor',         N'Ver Dashboard'),
    (N'Consultor',         N'Ver Auditorías'),
    (N'Solo Lectura',      N'Ver Dashboard'),
    (N'Solo Lectura',      N'Ver Auditorías')
) AS v (role_name, permission_name)
JOIN dbo.roles r ON r.name = v.role_name
JOIN dbo.permissions p ON p.name = v.permission_name
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.role_permissions rp WHERE rp.role_id = r.id AND rp.permission_id = p.id
);

-- Evidence tests (archivos adjuntos)
INSERT INTO dbo.evidence
    (id, entity_id, entity_type, file_name, mime_type, file_size, file_hash, storage_path, uploaded_by, created_at, control_id, finding_id, audit_id)
SELECT v.*
FROM (VALUES
    (N'EVD-TEST-001', N'FND-TEST-001', N'hallazgo', N'evidencia_aprobacion.pdf', N'pdf', 1048576, N'hash1', N'uploads/evidencia_aprobacion.pdf', N'USR-001', CONVERT(DATETIME2(3), '2026-10-01T09:00:00'), NULL, N'FND-TEST-001', NULL),
    (N'EVD-TEST-002', N'CTR-001', N'control', N'matriz_riesgos.xlsx', N'xlsx', 2048576, N'hash2', N'uploads/matriz_riesgos.xlsx', N'USR-002', CONVERT(DATETIME2(3), '2026-10-02T10:00:00'), N'CTR-001', NULL, NULL)
) AS v (id, entity_id, entity_type, file_name, mime_type, file_size, file_hash, storage_path, uploaded_by, created_at, control_id, finding_id, audit_id)
WHERE NOT EXISTS (SELECT 1 FROM dbo.evidence e WHERE e.id = v.id);
