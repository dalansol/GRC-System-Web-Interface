-- Catálogos, estructura organizacional, riesgos y ejecución de auditoría
-- (SF-03, SF-05, SF-06, SF-07): las tablas del modelo de datos de Miro que faltaban.
-- PostgreSQL (Supabase). Se puede ejecutar más de una vez sin efecto.
-- Requiere 001_schema.sql (users, audit_plans) y 008_estructura_y_controles.sql (business_units).
--
-- Tablas y columnas siguen el diagrama de Miro. Las columnas que ahí van en camelCase
-- (riskLibrary_id, controlProcedures_id, riskRegister_id) aquí van en snake_case, para
-- no tener que escribirlas entre comillas dobles. El diagrama no marca qué llaves
-- foráneas son obligatorias: solo lo son las que atan un renglón a su padre directo.

-- Catálogo base: negocio y país.
CREATE TABLE IF NOT EXISTS catalogs (
    catalog_id INT GENERATED ALWAYS AS IDENTITY CONSTRAINT pk_catalogs PRIMARY KEY,
    business   VARCHAR(150) NOT NULL,
    country    VARCHAR(100) NOT NULL
);
ALTER TABLE catalogs ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS catalog_department (
    id   INT GENERATED ALWAYS AS IDENTITY CONSTRAINT pk_catalog_department PRIMARY KEY,
    name VARCHAR(150) NOT NULL
);
ALTER TABLE catalog_department ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS catalog_domain (
    id   INT GENERATED ALWAYS AS IDENTITY CONSTRAINT pk_catalog_domain PRIMARY KEY,
    name VARCHAR(150) NOT NULL
);
ALTER TABLE catalog_domain ENABLE ROW LEVEL SECURITY;

-- Estructura organizacional.
CREATE TABLE IF NOT EXISTS division (
    division_id INT GENERATED ALWAYS AS IDENTITY CONSTRAINT pk_division PRIMARY KEY,
    name        VARCHAR(150) NOT NULL,
    catalog_id  INT          NULL CONSTRAINT fk_division_catalog REFERENCES catalogs (catalog_id)
);
ALTER TABLE division ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS ix_division_catalog_id ON division (catalog_id);

CREATE TABLE IF NOT EXISTS business (
    business_id   INT GENERATED ALWAYS AS IDENTITY CONSTRAINT pk_business PRIMARY KEY,
    business_name VARCHAR(150) NOT NULL,
    catalog_id    INT          NULL CONSTRAINT fk_business_catalog REFERENCES catalogs (catalog_id)
);
ALTER TABLE business ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS ix_business_catalog_id ON business (catalog_id);

CREATE TABLE IF NOT EXISTS area (
    area_id    INT GENERATED ALWAYS AS IDENTITY CONSTRAINT pk_area PRIMARY KEY,
    area_name  VARCHAR(150) NOT NULL,
    catalog_id INT          NULL CONSTRAINT fk_area_catalog REFERENCES catalogs (catalog_id)
);
ALTER TABLE area ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS ix_area_catalog_id ON area (catalog_id);

-- business_unit del diagrama es business_units (008); le faltaba su catálogo.
ALTER TABLE business_units
    ADD COLUMN IF NOT EXISTS catalog_id INT NULL CONSTRAINT fk_business_units_catalog REFERENCES catalogs (catalog_id);

CREATE INDEX IF NOT EXISTS ix_business_units_catalog_id ON business_units (catalog_id);

-- Entidades auditables.
CREATE TABLE IF NOT EXISTS audit_entity (
    id            INT GENERATED ALWAYS AS IDENTITY CONSTRAINT pk_audit_entity PRIMARY KEY,
    name          VARCHAR(200) NOT NULL,
    department_id INT          NULL CONSTRAINT fk_audit_entity_department REFERENCES catalog_department (id),
    domain_id     INT          NULL CONSTRAINT fk_audit_entity_domain REFERENCES catalog_domain (id)
);
ALTER TABLE audit_entity ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS ix_audit_entity_department_id ON audit_entity (department_id);
CREATE INDEX IF NOT EXISTS ix_audit_entity_domain_id ON audit_entity (domain_id);

-- Riesgos.
CREATE TABLE IF NOT EXISTS risk_library (
    risk_library_id INT GENERATED ALWAYS AS IDENTITY CONSTRAINT pk_risk_library PRIMARY KEY,
    name            VARCHAR(255) NOT NULL
);
ALTER TABLE risk_library ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS control_procedure (
    control_procedure_id INT GENERATED ALWAYS AS IDENTITY CONSTRAINT pk_control_procedure PRIMARY KEY,
    description          VARCHAR(2000) NOT NULL,
    catalog_id           INT           NULL CONSTRAINT fk_control_procedure_catalog REFERENCES catalogs (catalog_id)
);
ALTER TABLE control_procedure ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS ix_control_procedure_catalog_id ON control_procedure (catalog_id);

-- Registro de riesgos: un riesgo de la biblioteca con su procedimiento de control en un catálogo.
CREATE TABLE IF NOT EXISTS risk_register (
    risk_register_id     INT GENERATED ALWAYS AS IDENTITY CONSTRAINT pk_risk_register PRIMARY KEY,
    catalog_id           INT NULL CONSTRAINT fk_risk_register_catalog REFERENCES catalogs (catalog_id),
    risk_library_id      INT NOT NULL CONSTRAINT fk_risk_register_risk_library REFERENCES risk_library (risk_library_id),
    control_procedure_id INT NULL CONSTRAINT fk_risk_register_control_procedure
                             REFERENCES control_procedure (control_procedure_id)
);
ALTER TABLE risk_register ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS ix_risk_register_catalog_id ON risk_register (catalog_id);
CREATE INDEX IF NOT EXISTS ix_risk_register_risk_library_id ON risk_register (risk_library_id);
CREATE INDEX IF NOT EXISTS ix_risk_register_control_procedure_id ON risk_register (control_procedure_id);

-- Catálogos de la ejecución.
CREATE TABLE IF NOT EXISTS audit_status (
    id   INT GENERATED ALWAYS AS IDENTITY CONSTRAINT pk_audit_status PRIMARY KEY,
    name VARCHAR(50) NOT NULL
);
ALTER TABLE audit_status ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS audit_procedure_type (
    id   INT GENERATED ALWAYS AS IDENTITY CONSTRAINT pk_audit_procedure_type PRIMARY KEY,
    name VARCHAR(100) NOT NULL
);
ALTER TABLE audit_procedure_type ENABLE ROW LEVEL SECURITY;

-- Trabajo de auditoría: una entidad auditada dentro de un plan.
CREATE TABLE IF NOT EXISTS audit_engagement (
    id              INT GENERATED ALWAYS AS IDENTITY CONSTRAINT pk_audit_engagement PRIMARY KEY,
    code            VARCHAR(30) NOT NULL,
    audit_plan_id   INT         NOT NULL CONSTRAINT fk_audit_engagement_audit_plan REFERENCES audit_plans (id),
    audit_entity_id INT         NULL CONSTRAINT fk_audit_engagement_audit_entity REFERENCES audit_entity (id),
    department_id   INT         NULL CONSTRAINT fk_audit_engagement_department REFERENCES catalog_department (id),
    domain_id       INT         NULL CONSTRAINT fk_audit_engagement_domain REFERENCES catalog_domain (id),
    lead_auditor_id INT         NULL CONSTRAINT fk_audit_engagement_lead_auditor REFERENCES users (id),
    status_id       INT         NULL CONSTRAINT fk_audit_engagement_status REFERENCES audit_status (id)
);
ALTER TABLE audit_engagement ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS ix_audit_engagement_audit_plan_id ON audit_engagement (audit_plan_id);
CREATE INDEX IF NOT EXISTS ix_audit_engagement_audit_entity_id ON audit_engagement (audit_entity_id);
CREATE INDEX IF NOT EXISTS ix_audit_engagement_department_id ON audit_engagement (department_id);
CREATE INDEX IF NOT EXISTS ix_audit_engagement_domain_id ON audit_engagement (domain_id);
CREATE INDEX IF NOT EXISTS ix_audit_engagement_lead_auditor_id ON audit_engagement (lead_auditor_id);
CREATE INDEX IF NOT EXISTS ix_audit_engagement_status_id ON audit_engagement (status_id);

-- Equipo de un trabajo de auditoría.
CREATE TABLE IF NOT EXISTS audit_engagement_team (
    id                  INT GENERATED ALWAYS AS IDENTITY CONSTRAINT pk_audit_engagement_team PRIMARY KEY,
    audit_engagement_id INT         NOT NULL CONSTRAINT fk_audit_engagement_team_engagement REFERENCES audit_engagement (id),
    auditor_id          INT         NOT NULL CONSTRAINT fk_audit_engagement_team_auditor REFERENCES users (id),
    role_in_engagement  VARCHAR(50) NULL
);
ALTER TABLE audit_engagement_team ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS ix_audit_engagement_team_engagement_id ON audit_engagement_team (audit_engagement_id);
CREATE INDEX IF NOT EXISTS ix_audit_engagement_team_auditor_id ON audit_engagement_team (auditor_id);

-- Procedimientos de un trabajo de auditoría.
CREATE TABLE IF NOT EXISTS audit_procedures (
    id                  INT GENERATED ALWAYS AS IDENTITY CONSTRAINT pk_audit_procedures PRIMARY KEY,
    code                VARCHAR(30) NOT NULL,
    audit_engagement_id INT         NOT NULL CONSTRAINT fk_audit_procedures_engagement REFERENCES audit_engagement (id),
    procedure_type_id   INT         NULL CONSTRAINT fk_audit_procedures_type REFERENCES audit_procedure_type (id),
    department_id       INT         NULL CONSTRAINT fk_audit_procedures_department REFERENCES catalog_department (id),
    domain_id           INT         NULL CONSTRAINT fk_audit_procedures_domain REFERENCES catalog_domain (id),
    assigned_to         INT         NULL CONSTRAINT fk_audit_procedures_assigned_to REFERENCES users (id),
    status_id           INT         NULL CONSTRAINT fk_audit_procedures_status REFERENCES audit_status (id)
);
ALTER TABLE audit_procedures ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS ix_audit_procedures_engagement_id ON audit_procedures (audit_engagement_id);
CREATE INDEX IF NOT EXISTS ix_audit_procedures_procedure_type_id ON audit_procedures (procedure_type_id);
CREATE INDEX IF NOT EXISTS ix_audit_procedures_department_id ON audit_procedures (department_id);
CREATE INDEX IF NOT EXISTS ix_audit_procedures_domain_id ON audit_procedures (domain_id);
CREATE INDEX IF NOT EXISTS ix_audit_procedures_assigned_to ON audit_procedures (assigned_to);
CREATE INDEX IF NOT EXISTS ix_audit_procedures_status_id ON audit_procedures (status_id);
