-- Roles y permisos iniciales. Debe coincidir con src/repos/semilla.ts.
-- Se puede ejecutar más de una vez sin duplicar datos.

INSERT INTO roles (name)
VALUES
    ('Administrador'),
    ('Jefe de Auditoría'),
    ('Auditor Senior'),
    ('Auditor'),
    ('Consultor'),
    ('Solo Lectura')
ON CONFLICT (name) DO NOTHING;

INSERT INTO permissions (name)
VALUES
    ('Ver Dashboard'),
    ('Editar Registros'),
    ('Gestionar Usuarios'),
    ('Aprobar Riesgos'),
    ('Exportar Datos'),
    ('Ver Auditorías'),
    ('Crear Auditorías'),
    ('Eliminar Registros')
ON CONFLICT (name) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM (VALUES
    ('Administrador',     'Ver Dashboard'),
    ('Administrador',     'Editar Registros'),
    ('Administrador',     'Gestionar Usuarios'),
    ('Administrador',     'Aprobar Riesgos'),
    ('Administrador',     'Exportar Datos'),
    ('Administrador',     'Ver Auditorías'),
    ('Administrador',     'Crear Auditorías'),
    ('Administrador',     'Eliminar Registros'),
    ('Jefe de Auditoría', 'Ver Dashboard'),
    ('Jefe de Auditoría', 'Editar Registros'),
    ('Jefe de Auditoría', 'Aprobar Riesgos'),
    ('Jefe de Auditoría', 'Exportar Datos'),
    ('Jefe de Auditoría', 'Ver Auditorías'),
    ('Jefe de Auditoría', 'Crear Auditorías'),
    ('Auditor Senior',    'Ver Dashboard'),
    ('Auditor Senior',    'Editar Registros'),
    ('Auditor Senior',    'Exportar Datos'),
    ('Auditor Senior',    'Ver Auditorías'),
    ('Auditor',           'Ver Dashboard'),
    ('Auditor',           'Ver Auditorías'),
    ('Consultor',         'Ver Dashboard'),
    ('Consultor',         'Ver Auditorías'),
    ('Solo Lectura',      'Ver Dashboard'),
    ('Solo Lectura',      'Ver Auditorías')
) AS v (role_name, permission_name)
JOIN roles r ON r.name = v.role_name
JOIN permissions p ON p.name = v.permission_name
ON CONFLICT DO NOTHING;

-- Evidence tests (archivos adjuntos)
INSERT INTO evidence
    (id, entity_id, entity_type, file_name, mime_type, file_size, file_hash, storage_path, uploaded_by, created_at, control_id, finding_id, audit_id)
VALUES
    ('EVD-TEST-001', 'FND-TEST-001', 'hallazgo', 'evidencia_aprobacion.pdf', 'pdf', 1048576, 'hash1', 'uploads/evidencia_aprobacion.pdf', 'USR-001', '2026-10-01T09:00:00Z', NULL, 'FND-TEST-001', NULL),
    ('EVD-TEST-002', 'CTR-001', 'control', 'matriz_riesgos.xlsx', 'xlsx', 2048576, 'hash2', 'uploads/matriz_riesgos.xlsx', 'USR-002', '2026-10-02T10:00:00Z', 'CTR-001', NULL, NULL)
ON CONFLICT (id) DO NOTHING;
