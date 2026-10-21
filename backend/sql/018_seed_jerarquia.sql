-- Datos de prueba de la jerarquía organizacional (SF-03): una unidad por departamento
-- de auditoría, con una rama división → subdivisión → áreas. Nombres anonimizados como
-- en el Consolidado. Solo con --datos-prueba. Requiere 017 y un Jefe de Auditoría activo.
-- Se puede ejecutar más de una vez sin efecto.

INSERT INTO business_units (name, manager_id, fiscal_period_id, created_by, audit_department_id)
SELECT v.nombre, jefe.id, periodo.id, jefe.id, dep.id
FROM (VALUES ('UDN-0001', 'Retail & Spin'), ('UDN-0003', 'Beverage')) AS v (nombre, departamento)
JOIN catalog_department dep ON dep.name = v.departamento
CROSS JOIN (
    SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id
    WHERE r.name = 'Jefe de Auditoría' AND u.status = 'active'
    ORDER BY u.id LIMIT 1
) AS jefe
CROSS JOIN (SELECT id FROM fiscal_periods WHERE is_active) AS periodo
ON CONFLICT (name) DO NOTHING;

INSERT INTO division (name, business_unit_id)
SELECT v.division, bu.id
FROM (VALUES ('UDN-0001', 'DIVISION-0001'), ('UDN-0003', 'DIVISION-0005')) AS v (unidad, division)
JOIN business_units bu ON bu.name = v.unidad
WHERE NOT EXISTS (SELECT 1 FROM division d WHERE d.business_unit_id = bu.id AND d.name = v.division);

INSERT INTO business (business_name, division_id, country)
SELECT v.subdivision, d.division_id, v.pais
FROM (VALUES ('DIVISION-0001', 'SUBDIVISION-0001', 'México'),
             ('DIVISION-0005', 'SUBDIVISION-0002', 'Centroamérica Sur')) AS v (division, subdivision, pais)
JOIN division d ON d.name = v.division
WHERE NOT EXISTS (SELECT 1 FROM business b WHERE b.division_id = d.division_id AND b.business_name = v.subdivision);

-- "Recursos Humanos" se repite a propósito: los nombres de área no son únicos.
INSERT INTO area (area_name, business_id)
SELECT v.area, b.business_id
FROM (VALUES ('SUBDIVISION-0001', 'Nómina'),
             ('SUBDIVISION-0001', 'Recursos Humanos'),
             ('SUBDIVISION-0002', 'Inventarios'),
             ('SUBDIVISION-0002', 'Recursos Humanos')) AS v (subdivision, area)
JOIN business b ON b.business_name = v.subdivision
WHERE NOT EXISTS (SELECT 1 FROM area a WHERE a.business_id = b.business_id AND a.area_name = v.area);
