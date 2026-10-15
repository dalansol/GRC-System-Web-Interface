ALTER TABLE controls
    ADD COLUMN IF NOT EXISTS status VARCHAR(30) NOT NULL DEFAULT 'En Progreso',
    ADD COLUMN IF NOT EXISTS hours_spent NUMERIC(10,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS feedback VARCHAR(2000) NULL;

ALTER TABLE controls
    DROP CONSTRAINT IF EXISTS ck_controls_status;

ALTER TABLE controls
    ADD CONSTRAINT ck_controls_status
    CHECK (status IN ('En Progreso', 'En Revision', 'Completado'));

CREATE TABLE IF NOT EXISTS control_horas (
    id INT GENERATED ALWAYS AS IDENTITY CONSTRAINT pk_control_horas PRIMARY KEY,
    control_id VARCHAR(100) NOT NULL REFERENCES controls (id),
    audit_id INT NOT NULL REFERENCES audit_plans (id),
    auditor_id INT NOT NULL REFERENCES users (id),
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    horas NUMERIC(6,2) NOT NULL CONSTRAINT ck_control_horas_horas CHECK (horas > 0 AND horas <= 24),
    created_at TIMESTAMPTZ(0) NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_control_horas_control_audit
    ON control_horas (control_id, audit_id);
