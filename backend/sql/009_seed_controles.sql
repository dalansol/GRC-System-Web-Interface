-- Controles de prueba (los mismos que CONTROLS en mock_data.tsx y que usan los
-- hallazgos de 005_seed_findings.sql).
-- Solo para bases de desarrollo o pruebas; no ejecutar en producción.
-- Se puede ejecutar más de una vez sin duplicar datos.

INSERT INTO controls (id, code, name, description, type, frequency)
VALUES
    ('CTR-001', 'BC-0041', 'Conciliación Bancaria Mensual',
     'Revisión y aprobación formal de conciliaciones bancarias al cierre de cada mes por el Director Financiero y el Controller.',
     'Preventivo', 'Mensual'),
    ('CTR-002', 'BC-0042', 'Segregación de Funciones — Cierre Contable',
     'Verificación semestral de que ningún usuario tiene acceso simultáneo a funciones de registro y autorización en el sistema ERP.',
     'Detectivo', 'Semestral'),
    ('CTR-003', 'BC-0055', 'Revisión de Accesos Privilegiados',
     'Revisión trimestral de cuentas con privilegios administrativos en sistemas de producción y depuración de accesos inactivos.',
     'Detectivo', 'Trimestral'),
    ('CTR-004', 'BC-0071', 'Monitoreo de Obligaciones Regulatorias',
     'Seguimiento mensual del calendario de obligaciones regulatorias y generación de alertas ante vencimientos próximos.',
     'Preventivo', 'Mensual')
ON CONFLICT (id) DO NOTHING;
