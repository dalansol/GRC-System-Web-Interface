-- Nombres únicos de la estructura organizacional (SF-03, AC2 de la historia de parametrización).
-- - Unidad de negocio: su nombre (`display_name`), cuando lo tiene, no se repite en el catálogo.
--   Varias unidades pueden quedar sin nombre (se muestran por su código).
-- - Área (el "proceso" de la historia): su nombre no se repite dentro de la misma subdivisión;
--   entre subdivisiones distintas sí ("Recursos Humanos" aparece en muchas).
-- La comparación usa la intercalación `sin_mayusculas` (001): ignora mayúsculas pero distingue
-- acentos ("Salud" y "Sálud" son distintos; pendiente de decidir con el equipo).
-- El backend traduce la violación de estos índices a 409 NOMBRE_DUPLICADO por su nombre.
-- PostgreSQL (Supabase). Se puede ejecutar más de una vez sin efecto. Requiere 017 y 021.
-- Falla si la base ya tiene nombres repetidos: corrígelos antes de aplicarlo.

CREATE UNIQUE INDEX IF NOT EXISTS uq_business_units_display_name
    ON business_units ((display_name COLLATE sin_mayusculas))
    WHERE display_name IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_area_business_name
    ON area (business_id, (area_name COLLATE sin_mayusculas));
