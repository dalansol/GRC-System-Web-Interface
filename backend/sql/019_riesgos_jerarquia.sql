-- Riesgos en la jerarquía organizacional (SF-03). En el Consolidado, el Risk Register
-- cuelga de la subdivisión (B-…, tabla `business`). El nivel del riesgo es opcional
-- mientras FEMSA no confirme la escala (TBD).
-- PostgreSQL (Supabase). Se puede ejecutar más de una vez sin efecto.
-- Requiere 010 y 017.

-- Nulo: una fila del Consolidado no tiene subdivisión.
ALTER TABLE risk_register
    ADD COLUMN IF NOT EXISTS business_id INT NULL
    CONSTRAINT fk_risk_register_business REFERENCES business (business_id);

CREATE INDEX IF NOT EXISTS ix_risk_register_business_id ON risk_register (business_id);

ALTER TABLE risk_library
    ADD COLUMN IF NOT EXISTS level VARCHAR(10) NULL
    CONSTRAINT ck_risk_library_level CHECK (level IN ('Crítico', 'Alto', 'Medio', 'Bajo'));
