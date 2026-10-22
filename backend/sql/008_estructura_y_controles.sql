-- Estructura organizacional, periodos, controles, asignaciones y conflictos de interés
-- (SF-03, SF-04, SF-06, SF-07).
-- PostgreSQL (Supabase). Se puede ejecutar más de una vez sin efecto.
-- Requiere 001_schema.sql (users) y 006_auditorias.sql (audits).

-- Periodos fiscales de auditoría.
CREATE TABLE IF NOT EXISTS fiscal_periods (
    id         INT GENERATED ALWAYS AS IDENTITY CONSTRAINT pk_fiscal_periods PRIMARY KEY,
    name       VARCHAR(50)    COLLATE sin_mayusculas NOT NULL CONSTRAINT uq_fiscal_periods_name UNIQUE,
    start_date DATE           NOT NULL,
    end_date   DATE           NOT NULL,
    is_active  BOOLEAN        NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ(0) NOT NULL DEFAULT now(),
    CONSTRAINT ck_fiscal_periods_dates CHECK (end_date > start_date)
);
ALTER TABLE fiscal_periods ENABLE ROW LEVEL SECURITY;

-- Solo un periodo puede estar activo a la vez.
CREATE UNIQUE INDEX IF NOT EXISTS uq_fiscal_periods_active ON fiscal_periods (is_active) WHERE is_active;

-- Unidades de negocio. El nombre no se repite en el catálogo.
CREATE TABLE IF NOT EXISTS business_units (
    id               INT GENERATED ALWAYS AS IDENTITY CONSTRAINT pk_business_units PRIMARY KEY,
    name             VARCHAR(150)   COLLATE sin_mayusculas NOT NULL CONSTRAINT uq_business_units_name UNIQUE,
    manager_id       INT            NOT NULL CONSTRAINT fk_business_units_manager REFERENCES users (id),
    fiscal_period_id INT            NOT NULL CONSTRAINT fk_business_units_fiscal_period REFERENCES fiscal_periods (id),
    created_by       INT            NOT NULL CONSTRAINT fk_business_units_created_by REFERENCES users (id),
    created_at       TIMESTAMPTZ(0) NOT NULL DEFAULT now()
);
ALTER TABLE business_units ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS ix_business_units_fiscal_period_id ON business_units (fiscal_period_id);

-- Procesos de una unidad de negocio. El nombre no se repite dentro de la unidad.
CREATE TABLE IF NOT EXISTS processes (
    id               INT GENERATED ALWAYS AS IDENTITY CONSTRAINT pk_processes PRIMARY KEY,
    business_unit_id INT            NOT NULL CONSTRAINT fk_processes_business_unit REFERENCES business_units (id),
    name             VARCHAR(150)   COLLATE sin_mayusculas NOT NULL,
    created_at       TIMESTAMPTZ(0) NOT NULL DEFAULT now(),
    CONSTRAINT uq_processes_unit_name UNIQUE (business_unit_id, name)
);
ALTER TABLE processes ENABLE ROW LEVEL SECURITY;

-- Controles. El id es de texto (CTR-001) porque así lo guardan ya findings."controlId"
-- y evidence.control_id.
CREATE TABLE IF NOT EXISTS controls (
    id          VARCHAR(100)   NOT NULL CONSTRAINT pk_controls PRIMARY KEY,
    code        VARCHAR(30)    COLLATE sin_mayusculas NOT NULL CONSTRAINT uq_controls_code UNIQUE,
    name        VARCHAR(255)   NOT NULL,
    description VARCHAR(2000)  NULL,
    type        VARCHAR(30)    NULL,
    frequency   VARCHAR(30)    NULL,
    size        VARCHAR(100)   NULL,
    rotation    VARCHAR(100)   NULL,
    process_id  INT          NULL CONSTRAINT fk_controls_process REFERENCES processes (id) ON DELETE SET NULL,
    owner_id    INT            NULL CONSTRAINT fk_controls_owner REFERENCES users (id),
    created_at  TIMESTAMPTZ(0) NOT NULL DEFAULT now()
);
ALTER TABLE controls ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS ix_controls_process_id ON controls (process_id);

-- Asignación de controles a auditores dentro de una auditoría.
CREATE TABLE IF NOT EXISTS audit_controls (
    id          INT GENERATED ALWAYS AS IDENTITY CONSTRAINT pk_audit_controls PRIMARY KEY,
    audit_id    VARCHAR(100)   NOT NULL CONSTRAINT fk_audit_controls_audit REFERENCES audits (id),
    control_id  VARCHAR(100)   NOT NULL CONSTRAINT fk_audit_controls_control REFERENCES controls (id),
    auditor_id  INT            NOT NULL CONSTRAINT fk_audit_controls_auditor REFERENCES users (id),
    is_lead     BOOLEAN        NOT NULL DEFAULT FALSE,
    assigned_by INT            NOT NULL CONSTRAINT fk_audit_controls_assigned_by REFERENCES users (id),
    created_at  TIMESTAMPTZ(0) NOT NULL DEFAULT now(),
    CONSTRAINT uq_audit_controls_asignacion UNIQUE (audit_id, control_id, auditor_id)
);
ALTER TABLE audit_controls ENABLE ROW LEVEL SECURITY;

-- Un control tiene a lo más un auditor líder por auditoría.
CREATE UNIQUE INDEX IF NOT EXISTS uq_audit_controls_lead ON audit_controls (audit_id, control_id) WHERE is_lead;

CREATE INDEX IF NOT EXISTS ix_audit_controls_auditor_id ON audit_controls (auditor_id);

-- Declaración de conflicto de interés de un auditor en una auditoría (una por auditor).
-- Si hay conflicto, la justificación es obligatoria.
CREATE TABLE IF NOT EXISTS conflict_declarations (
    id            INT GENERATED ALWAYS AS IDENTITY CONSTRAINT pk_conflict_declarations PRIMARY KEY,
    audit_id      VARCHAR(100)   NOT NULL CONSTRAINT fk_conflict_declarations_audit REFERENCES audits (id),
    auditor_id    INT            NOT NULL CONSTRAINT fk_conflict_declarations_auditor REFERENCES users (id),
    has_conflict  BOOLEAN        NOT NULL,
    justification VARCHAR(2000)  NULL,
    declared_at   TIMESTAMPTZ(0) NOT NULL DEFAULT now(),
    CONSTRAINT uq_conflict_declarations_auditor UNIQUE (audit_id, auditor_id),
    CONSTRAINT ck_conflict_declarations_justification
        CHECK (NOT has_conflict OR LENGTH(BTRIM(COALESCE(justification, ''))) > 0)
);
ALTER TABLE conflict_declarations ENABLE ROW LEVEL SECURITY;
