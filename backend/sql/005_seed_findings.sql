-- Hallazgos de prueba para los criterios de aceptación (uno por cada estado).
-- Solo para bases de desarrollo o pruebas; no ejecutar en producción.
-- Se puede ejecutar más de una vez sin duplicar datos.

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;

INSERT INTO dbo.findings
    (id, folio, title, description, type, severity, status, auditId,
     controlId, failedControl, residualRisk, ownerId, created_at)
SELECT v.*
FROM (VALUES
    (N'FND-TEST-001', N'HAL-2026-001',
     N'Conciliaciones bancarias sin evidencia de aprobación',
     N'La muestra revisada no contiene evidencia suficiente de aprobación dual.',
     N'Deficiencia de control', N'Alto', N'Abierto', N'AUD-001',
     N'CTR-001', N'Conciliación Bancaria Mensual', N'Alto', N'USR-001',
     CONVERT(DATETIME2(3), '2026-10-01T09:00:00')),
    (N'FND-TEST-002', N'HAL-2026-002',
     N'Accesos privilegiados sin revisión trimestral',
     N'Existen cuentas privilegiadas cuya revisión no fue documentada.',
     N'Riesgo operativo', N'Crítico', N'En Proceso', N'AUD-001',
     N'CTR-003', N'Revisión de Accesos Privilegiados', N'Crítico', N'USR-002',
     CONVERT(DATETIME2(3), '2026-10-02T10:30:00')),
    (N'FND-TEST-003', N'HAL-2026-003',
     N'Calendario normativo pendiente de actualización',
     N'El calendario de obligaciones regulatorias requiere validación de Legal.',
     N'Incumplimiento normativo', N'Medio', N'En Revisión', N'AUD-003',
     N'CTR-004', N'Monitoreo de Obligaciones Regulatorias', N'Medio', N'USR-003',
     CONVERT(DATETIME2(3), '2026-10-03T11:15:00')),
    (N'FND-TEST-004', N'HAL-2026-004',
     N'Segregación de funciones pendiente de remediación',
     N'La reasignación de roles continúa pendiente de validación.',
     N'Deficiencia de control', N'Alto', N'Asignado', N'AUD-002',
     N'CTR-002', N'Segregación de Funciones — Cierre Contable', N'Alto', N'USR-004',
     CONVERT(DATETIME2(3), '2026-10-04T08:45:00')),
    (N'FND-TEST-005', N'HAL-2026-005',
     N'Procedimiento de nómina actualizado',
     N'El hallazgo fue atendido y validado por el equipo de auditoría.',
     N'Riesgo operativo', N'Bajo', N'Cerrado', N'AUD-004',
     N'CTR-001', N'Conciliación Bancaria Mensual', N'Bajo', N'USR-005',
     CONVERT(DATETIME2(3), '2026-10-05T14:20:00'))
) AS v (id, folio, title, description, type, severity, status, auditId,
        controlId, failedControl, residualRisk, ownerId, created_at)
WHERE NOT EXISTS (SELECT 1 FROM dbo.findings f WHERE f.id = v.id);
