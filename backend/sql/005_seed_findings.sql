-- Hallazgos de prueba para los criterios de aceptación (uno por cada estado).
-- Solo para bases de desarrollo o pruebas; no ejecutar en producción.
-- Se puede ejecutar más de una vez sin duplicar datos.

INSERT INTO findings
    (id, folio, title, description, type, severity, status, "auditId",
     "controlId", "failedControl", "residualRisk", "ownerId", created_at)
VALUES
    ('FND-TEST-001', 'HAL-2026-001',
     'Conciliaciones bancarias sin evidencia de aprobación',
     'La muestra revisada no contiene evidencia suficiente de aprobación dual.',
     'Deficiencia de control', 'Alto', 'Abierto', 'AUD-001',
     'CTR-001', 'Conciliación Bancaria Mensual', 'Alto', 'USR-001',
     '2026-10-01T09:00:00Z'),
    ('FND-TEST-002', 'HAL-2026-002',
     'Accesos privilegiados sin revisión trimestral',
     'Existen cuentas privilegiadas cuya revisión no fue documentada.',
     'Riesgo operativo', 'Crítico', 'En Proceso', 'AUD-001',
     'CTR-003', 'Revisión de Accesos Privilegiados', 'Crítico', 'USR-002',
     '2026-10-02T10:30:00Z'),
    ('FND-TEST-003', 'HAL-2026-003',
     'Calendario normativo pendiente de actualización',
     'El calendario de obligaciones regulatorias requiere validación de Legal.',
     'Incumplimiento normativo', 'Medio', 'En Revisión', 'AUD-003',
     'CTR-004', 'Monitoreo de Obligaciones Regulatorias', 'Medio', 'USR-003',
     '2026-10-03T11:15:00Z'),
    ('FND-TEST-004', 'HAL-2026-004',
     'Segregación de funciones pendiente de remediación',
     'La reasignación de roles continúa pendiente de validación.',
     'Deficiencia de control', 'Alto', 'Asignado', 'AUD-002',
     'CTR-002', 'Segregación de Funciones — Cierre Contable', 'Alto', 'USR-004',
     '2026-10-04T08:45:00Z'),
    ('FND-TEST-005', 'HAL-2026-005',
     'Procedimiento de nómina actualizado',
     'El hallazgo fue atendido y validado por el equipo de auditoría.',
     'Riesgo operativo', 'Bajo', 'Cerrado', 'AUD-004',
     'CTR-001', 'Conciliación Bancaria Mensual', 'Bajo', 'USR-005',
     '2026-10-05T14:20:00Z')
ON CONFLICT (id) DO NOTHING;
