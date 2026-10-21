-- Riesgos de prueba sobre las subdivisiones de 018_seed_jerarquia.sql (SF-03).
-- Solo con --datos-prueba. Se puede ejecutar más de una vez sin efecto.

INSERT INTO risk_library (name, level)
SELECT v.nombre, v.nivel
FROM (VALUES ('Diferencias de inventario en CEDIS', 'Crítico'),
             ('Pagos de nómina sin doble aprobación', 'Alto'),
             ('Ruptura de cadena de frío', 'Medio'),
             ('Altas de proveedores sin validación', 'Bajo')) AS v (nombre, nivel)
WHERE NOT EXISTS (SELECT 1 FROM risk_library rl WHERE rl.name = v.nombre);

INSERT INTO control_procedure (description)
SELECT v.descripcion
FROM (VALUES ('Conteo cíclico mensual conciliado contra el sistema'),
             ('Doble aprobación del layout de nómina antes de dispersar')) AS v (descripcion)
WHERE NOT EXISTS (SELECT 1 FROM control_procedure cp WHERE cp.description = v.descripcion);

INSERT INTO risk_register (business_id, risk_library_id, control_procedure_id)
SELECT b.business_id, rl.risk_library_id, cp.control_procedure_id
FROM (VALUES ('SUBDIVISION-0001', 'Pagos de nómina sin doble aprobación',
              'Doble aprobación del layout de nómina antes de dispersar'),
             ('SUBDIVISION-0001', 'Altas de proveedores sin validación', NULL),
             ('SUBDIVISION-0002', 'Diferencias de inventario en CEDIS',
              'Conteo cíclico mensual conciliado contra el sistema'),
             ('SUBDIVISION-0002', 'Ruptura de cadena de frío', NULL)) AS v (subdivision, riesgo, procedimiento)
JOIN business b ON b.business_name = v.subdivision
JOIN risk_library rl ON rl.name = v.riesgo
LEFT JOIN control_procedure cp ON cp.description = v.procedimiento
WHERE NOT EXISTS (
    SELECT 1 FROM risk_register rr
    WHERE rr.business_id = b.business_id AND rr.risk_library_id = rl.risk_library_id
);
