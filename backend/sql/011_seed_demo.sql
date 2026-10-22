-- Datos de prueba del modo en memoria (src/repos/semilla.ts y mock_data.tsx), para que
-- una base de desarrollo tenga los mismos usuarios, planes, hallazgos y plan de acción.
-- Los usuarios son los de "Usar un rol de prueba" de la pantalla de acceso.
-- Solo para bases de desarrollo o pruebas; no ejecutar en producción.
-- Se puede ejecutar más de una vez sin duplicar datos.
-- Requiere 006_auditorias.sql (AUD-001 a AUD-004) y 009_seed_controles.sql (CTR-001 a CTR-004).

INSERT INTO users (name, email, role_id, status)
SELECT u.name, u.email, r.id, u.status
FROM (VALUES
    ('Sofía Ramírez',   's.ramirez@expedite.com',   'Administrador',     'active'),
    ('María García',    'm.garcia@expedite.com',    'Jefe de Auditoría', 'active'),
    ('Carlos Morales',  'c.morales@expedite.com',   'Auditor Senior',    'active'),
    ('Ana Rodríguez',   'a.rodriguez@expedite.com', 'Auditor',           'active'),
    ('Pedro Sánchez',   'p.sanchez@expedite.com',   'Consultor',         'inactive'),
    ('Laura Fernández', 'l.fernandez@expedite.com', 'Auditor',           'active'),
    ('Diego Torres',    'd.torres@expedite.com',    'Solo Lectura',      'active')
) AS u (name, email, role, status)
JOIN roles r ON r.name = u.role
ON CONFLICT (email) DO NOTHING;

INSERT INTO audit_plans
    (code, name, type, period, start_date, end_date, status, estimated_hours,
     responsible_id, scope, created_by)
SELECT p.code, p.name, p.type, p.period, p.start_date::date, p.end_date::date, p.status,
       p.estimated_hours, responsable.id, p.scope, creador.id
FROM (VALUES
    ('PAI-2025-001', 'Plan Auditoría Financiera LATAM', 'Anual', 'Q1–Q2 2025',
     '2025-01-15', '2025-06-30', 'Aprobado', 320, 'm.garcia@expedite.com',
     'Cierre contable, conciliaciones bancarias y reportes a casa matriz en MX, BR, CO'),
    ('PAI-2025-002', 'Plan Auditoría TI & Ciberseguridad', 'Anual', 'Q2–Q3 2025',
     '2025-04-01', '2025-09-30', 'En Ejecución', 240, 'c.morales@expedite.com',
     'Accesos privilegiados, seguridad perimetral, revisión de vulnerabilidades'),
    ('PAI-2025-003', 'Plan Auditoría Cumplimiento Regulatorio', 'Trimestral', 'Q3–Q4 2025',
     '2025-07-01', '2025-12-31', 'Borrador', 180, 'a.rodriguez@expedite.com',
     'Obligaciones regulatorias GDPR, SUNAT, Superintendencia Financiera Colombia'),
    ('PAI-2024-012', 'Plan Auditoría Operacional LATAM', 'Trimestral', 'Q4 2024',
     '2024-10-01', '2024-12-31', 'Cerrado', 290, 'm.garcia@expedite.com',
     'Cadena de suministro, logística y distribución en toda la región')
) AS p (code, name, type, period, start_date, end_date, status, estimated_hours, responsible, scope)
JOIN users responsable ON responsable.email = p.responsible
JOIN users creador ON creador.email = 's.ramirez@expedite.com'
ON CONFLICT (code) DO NOTHING;

-- HAL-2025-001 queda 'Asignado' porque trae plan de acción (al crearlo, el backend
-- pasa el hallazgo a ese estado).
INSERT INTO findings
    (id, folio, title, severity, status, "auditId", "controlId", "failedControl",
     "residualRisk", created_at)
VALUES
    ('HAL-2025-001', 'HAL-2025-001',
     'Segregación de funciones insuficiente en cierre contable',
     'Crítico', 'Asignado', 'AUD-001', 'CTR-002',
     'Segregación de Funciones — Cierre Contable', 'Alto', '2025-07-10T00:00:00Z'),
    ('HAL-2025-002', 'HAL-2025-002',
     'Cuentas privilegiadas de ex-empleados activas en producción',
     'Alto', 'En Revisión', 'AUD-001', 'CTR-003',
     'Revisión de Accesos Privilegiados', 'Alto', '2025-07-14T00:00:00Z'),
    ('HAL-2025-003', 'HAL-2025-003',
     'Calendario normativo desactualizado — SFC Colombia',
     'Medio', 'Abierto', 'AUD-003', 'CTR-004',
     'Monitoreo de Obligaciones Regulatorias', 'Medio', '2025-07-18T00:00:00Z'),
    ('HAL-2025-004', 'HAL-2025-004',
     'Firewall con configuración obsoleta — Oficina Colombia',
     'Alto', 'Abierto', 'AUD-002', 'CTR-003',
     'Revisión de Accesos Privilegiados', 'Alto', '2025-07-20T00:00:00Z'),
    ('HAL-2024-018', 'HAL-2024-018',
     'Proceso de nómina sin doble aprobación — Operaciones',
     'Bajo', 'Cerrado', 'AUD-004', 'CTR-001',
     'Conciliación Bancaria Mensual', 'Bajo', '2024-11-05T00:00:00Z')
ON CONFLICT DO NOTHING;

INSERT INTO action_plans (finding_id, description, responsible_id, due_date, created_by)
SELECT 'HAL-2025-001',
       'Revisar y reasignar roles en SAP para eliminar conflictos de acceso. Implementar aprobación dual en todas las conciliaciones.',
       responsable.id, DATE '2025-09-15', creador.id
FROM users responsable
JOIN users creador ON creador.email = 's.ramirez@expedite.com'
WHERE responsable.email = 'c.morales@expedite.com'
  AND EXISTS (SELECT 1 FROM findings WHERE id = 'HAL-2025-001')
ON CONFLICT (finding_id) DO NOTHING;
