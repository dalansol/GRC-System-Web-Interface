-- Jerarquía organizacional: unidad de negocio → división → subdivisión → área (SF-03).
-- En el Consolidado: UdN-… → D-… → B-… → A-…. La tabla `business` es la subdivisión
-- (B-…) y lleva el país como texto libre ("KFS RTR", "Corporativo" también aparecen ahí).
-- El departamento de auditoría (Retail & Spin / Beverage) es un atributo de la unidad,
-- no un nivel. Las entidades auditables cuelgan de la subdivisión.
-- `processes` y `catalogs` ya no los usa esta historia; no se borran.
-- PostgreSQL (Supabase). Se puede ejecutar más de una vez sin efecto.
-- Requiere 008, 010 y 015.

ALTER TABLE division
    ADD COLUMN IF NOT EXISTS business_unit_id INT NULL
    CONSTRAINT fk_division_business_unit REFERENCES business_units (id);

ALTER TABLE business
    ADD COLUMN IF NOT EXISTS division_id INT NULL
    CONSTRAINT fk_business_division REFERENCES division (division_id);

ALTER TABLE business
    ADD COLUMN IF NOT EXISTS country VARCHAR(100) NULL;

ALTER TABLE area
    ADD COLUMN IF NOT EXISTS business_id INT NULL
    CONSTRAINT fk_area_business REFERENCES business (business_id);

ALTER TABLE business_units
    ADD COLUMN IF NOT EXISTS audit_department_id INT NULL
    CONSTRAINT fk_business_units_audit_department REFERENCES catalog_department (id);

-- Si se elimina la subdivisión, la entidad auditable y su historial se conservan.
ALTER TABLE audit_entity
    ADD COLUMN IF NOT EXISTS business_id INT NULL
    CONSTRAINT fk_audit_entity_business REFERENCES business (business_id) ON DELETE SET NULL;

-- Cada nivel debe tener padre. Solo se exige si no hay filas sueltas de antes.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM division WHERE business_unit_id IS NULL) THEN
        ALTER TABLE division ALTER COLUMN business_unit_id SET NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM business WHERE division_id IS NULL) THEN
        ALTER TABLE business ALTER COLUMN division_id SET NOT NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM area WHERE business_id IS NULL) THEN
        ALTER TABLE area ALTER COLUMN business_id SET NOT NULL;
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS ix_division_business_unit_id ON division (business_unit_id);
CREATE INDEX IF NOT EXISTS ix_business_division_id ON business (division_id);
CREATE INDEX IF NOT EXISTS ix_area_business_id ON area (business_id);
CREATE INDEX IF NOT EXISTS ix_business_units_audit_department_id ON business_units (audit_department_id);
CREATE INDEX IF NOT EXISTS ix_audit_entity_business_id ON audit_entity (business_id);

-- Departamentos de auditoría del Consolidado.
INSERT INTO catalog_department (name)
SELECT nombre FROM (VALUES ('Retail & Spin'), ('Beverage')) AS d (nombre)
WHERE NOT EXISTS (SELECT 1 FROM catalog_department c WHERE c.name = d.nombre);

-- El periodo de auditoría es el trimestre (2026Q1…); las unidades nuevas toman el activo.
-- 'Fiscal 2026' (015) deja de ser el activo; las unidades que ya lo tienen lo conservan.
INSERT INTO fiscal_periods (name, start_date, end_date, is_active)
VALUES ('2026Q1', '2026-01-01', '2026-03-31', FALSE),
       ('2026Q2', '2026-04-01', '2026-06-30', FALSE),
       ('2026Q3', '2026-07-01', '2026-09-30', FALSE),
       ('2026Q4', '2026-10-01', '2026-12-31', FALSE)
ON CONFLICT (name) DO NOTHING;

UPDATE fiscal_periods SET is_active = FALSE
WHERE name = 'Fiscal 2026' AND is_active;

UPDATE fiscal_periods SET is_active = TRUE
WHERE name = '2026Q4' AND NOT EXISTS (SELECT 1 FROM fiscal_periods WHERE is_active);
