-- Limpieza de los datos de prueba de la estructura (SF-03) en bases que ya los cargaron:
-- quita la subdivisión "SIN NOMBRE (B-923765)" de 018, que no sigue el formato de código,
-- con sus áreas y riesgos. Una base nueva ya no la recibe (018 y 020 ya no la traen): aquí
-- no hace nada.
-- Solo con --datos-prueba. Requiere 018 y 020. Se puede ejecutar más de una vez sin efecto.

-- Primero sus riesgos y áreas (no hay borrado en cascada). Su entidad auditable, si tuviera,
-- se conserva sin vínculo (ON DELETE SET NULL de 017).
DELETE FROM risk_register WHERE business_id IN (SELECT business_id FROM business WHERE business_name = 'SIN NOMBRE (B-923765)');
DELETE FROM area WHERE business_id IN (SELECT business_id FROM business WHERE business_name = 'SIN NOMBRE (B-923765)');
DELETE FROM business WHERE business_name = 'SIN NOMBRE (B-923765)';
