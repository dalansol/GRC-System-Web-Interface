-- Usuarios, roles y permisos (SF-16, SF-17, SNF-05).
-- PostgreSQL (Supabase). Se puede ejecutar más de una vez sin efecto.
--
-- Supabase publica por su API las tablas del esquema public. Por eso todas llevan
-- activada la seguridad por filas y ninguna política: solo entra el backend, con su
-- conexión directa a la base.

-- Correos, códigos y nombres únicos se comparan sin distinguir mayúsculas.
CREATE COLLATION IF NOT EXISTS sin_mayusculas (provider = icu, locale = 'und-u-ks-level2', deterministic = false);

CREATE TABLE IF NOT EXISTS roles (
    id   INT GENERATED ALWAYS AS IDENTITY CONSTRAINT pk_roles PRIMARY KEY,
    name VARCHAR(100) COLLATE sin_mayusculas NOT NULL CONSTRAINT uq_roles_name UNIQUE
);
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS permissions (
    id   INT GENERATED ALWAYS AS IDENTITY CONSTRAINT pk_permissions PRIMARY KEY,
    name VARCHAR(100) COLLATE sin_mayusculas NOT NULL CONSTRAINT uq_permissions_name UNIQUE
);
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS role_permissions (
    role_id       INT NOT NULL CONSTRAINT fk_role_permissions_role REFERENCES roles (id),
    permission_id INT NOT NULL CONSTRAINT fk_role_permissions_permission REFERENCES permissions (id),
    CONSTRAINT pk_role_permissions PRIMARY KEY (role_id, permission_id)
);
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS users (
    id         INT GENERATED ALWAYS AS IDENTITY CONSTRAINT pk_users PRIMARY KEY,
    name       VARCHAR(150)   NOT NULL,
    email      VARCHAR(254)   COLLATE sin_mayusculas NOT NULL CONSTRAINT uq_users_email UNIQUE,
    role_id    INT            NOT NULL CONSTRAINT fk_users_role REFERENCES roles (id),
    status     VARCHAR(10)    NOT NULL DEFAULT 'active'
                              CONSTRAINT ck_users_status CHECK (status IN ('active', 'inactive')),
    entra_oid  VARCHAR(64)    NULL,
    last_login TIMESTAMPTZ(0) NULL,
    created_at TIMESTAMPTZ(0) NOT NULL DEFAULT now()
);
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Una identidad de Entra ID corresponde a un solo usuario.
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_entra_oid ON users (entra_oid) WHERE entra_oid IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_users_role_id ON users (role_id);

-- Planes de auditoría (SF-01, SF-02).
CREATE TABLE IF NOT EXISTS audit_plans (
    id              INT GENERATED ALWAYS AS IDENTITY CONSTRAINT pk_audit_plans PRIMARY KEY,
    code            VARCHAR(30)    COLLATE sin_mayusculas NOT NULL CONSTRAINT uq_audit_plans_code UNIQUE,
    name            VARCHAR(200)   NOT NULL,
    type            VARCHAR(10)    NOT NULL CONSTRAINT ck_audit_plans_type CHECK (type IN ('Anual', 'Trimestral')),
    period          VARCHAR(50)    NULL,
    start_date      DATE           NOT NULL,
    end_date        DATE           NOT NULL,
    status          VARCHAR(20)    NOT NULL DEFAULT 'Borrador'
                                   CONSTRAINT ck_audit_plans_status
                                   CHECK (status IN ('Borrador', 'Aprobado', 'En Ejecución', 'Cerrado')),
    estimated_hours INT            NOT NULL CONSTRAINT ck_audit_plans_hours CHECK (estimated_hours > 0),
    responsible_id  INT            NOT NULL CONSTRAINT fk_audit_plans_responsible REFERENCES users (id),
    scope           VARCHAR(2000)  NULL,
    created_by      INT            NOT NULL CONSTRAINT fk_audit_plans_created_by REFERENCES users (id),
    created_at      TIMESTAMPTZ(0) NOT NULL DEFAULT now(),
    CONSTRAINT ck_audit_plans_dates CHECK (end_date > start_date)
);
ALTER TABLE audit_plans ENABLE ROW LEVEL SECURITY;

-- Evidence (Archivos y adjuntos para controles y hallazgos)
CREATE TABLE IF NOT EXISTS evidence (
    id            VARCHAR(50)    NOT NULL CONSTRAINT pk_evidence PRIMARY KEY,
    entity_id     VARCHAR(50)    NULL,
    entity_type   VARCHAR(20)    NOT NULL CONSTRAINT ck_evidence_entity_type CHECK (entity_type IN ('control', 'hallazgo')),
    file_name     VARCHAR(255)   NOT NULL,
    mime_type     VARCHAR(10)    NOT NULL CONSTRAINT ck_evidence_mime_type CHECK (mime_type IN ('pdf', 'xlsx')),
    file_size     BIGINT         NOT NULL,
    file_hash     VARCHAR(128)   NOT NULL,
    storage_path  VARCHAR(500)   NOT NULL,
    uploaded_by   VARCHAR(100)   NULL,
    created_at    TIMESTAMPTZ(0) NOT NULL DEFAULT now(),
    control_id    VARCHAR(50)    NULL,
    finding_id    VARCHAR(50)    NULL,
    audit_id      VARCHAR(50)    NULL
);
ALTER TABLE evidence ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS ix_evidence_entity ON evidence (entity_id, entity_type);
