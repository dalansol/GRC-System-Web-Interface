-- Usuarios, roles y permisos (SF-16, SF-17, SNF-05).
-- Azure SQL / SQL Server. Se puede ejecutar más de una vez sin efecto.

-- Los índices filtrados exigen estas opciones; sqlcmd no las activa por omisión.
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;

IF OBJECT_ID('dbo.roles', 'U') IS NULL
CREATE TABLE dbo.roles (
    id   INT IDENTITY(1,1) NOT NULL CONSTRAINT pk_roles PRIMARY KEY,
    name NVARCHAR(100)     NOT NULL CONSTRAINT uq_roles_name UNIQUE
);

IF OBJECT_ID('dbo.permissions', 'U') IS NULL
CREATE TABLE dbo.permissions (
    id   INT IDENTITY(1,1) NOT NULL CONSTRAINT pk_permissions PRIMARY KEY,
    name NVARCHAR(100)     NOT NULL CONSTRAINT uq_permissions_name UNIQUE
);

IF OBJECT_ID('dbo.role_permissions', 'U') IS NULL
CREATE TABLE dbo.role_permissions (
    role_id       INT NOT NULL CONSTRAINT fk_role_permissions_role REFERENCES dbo.roles (id),
    permission_id INT NOT NULL CONSTRAINT fk_role_permissions_permission REFERENCES dbo.permissions (id),
    CONSTRAINT pk_role_permissions PRIMARY KEY (role_id, permission_id)
);

IF OBJECT_ID('dbo.users', 'U') IS NULL
CREATE TABLE dbo.users (
    id         INT IDENTITY(1,1) NOT NULL CONSTRAINT pk_users PRIMARY KEY,
    name       NVARCHAR(150)     NOT NULL,
    email      NVARCHAR(254)     NOT NULL CONSTRAINT uq_users_email UNIQUE,
    role_id    INT               NOT NULL CONSTRAINT fk_users_role REFERENCES dbo.roles (id),
    status     VARCHAR(10)       NOT NULL CONSTRAINT df_users_status DEFAULT 'active'
                                 CONSTRAINT ck_users_status CHECK (status IN ('active', 'inactive')),
    entra_oid  NVARCHAR(64)      NULL,
    last_login DATETIME2(0)      NULL,
    created_at DATETIME2(0)      NOT NULL CONSTRAINT df_users_created_at DEFAULT SYSUTCDATETIME()
);

-- Una identidad de Entra ID corresponde a un solo usuario.
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.users') AND name = 'uq_users_entra_oid')
CREATE UNIQUE INDEX uq_users_entra_oid ON dbo.users (entra_oid) WHERE entra_oid IS NOT NULL;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.users') AND name = 'ix_users_role_id')
CREATE INDEX ix_users_role_id ON dbo.users (role_id);

-- Planes de auditoría (SF-01, SF-02).
IF OBJECT_ID('dbo.audit_plans', 'U') IS NULL
CREATE TABLE dbo.audit_plans (
    id              INT IDENTITY(1,1) NOT NULL CONSTRAINT pk_audit_plans PRIMARY KEY,
    code            NVARCHAR(30)      NOT NULL CONSTRAINT uq_audit_plans_code UNIQUE,
    name            NVARCHAR(200)     NOT NULL,
    type            NVARCHAR(10)      NOT NULL CONSTRAINT ck_audit_plans_type CHECK (type IN (N'Anual', N'Trimestral')),
    period          NVARCHAR(50)      NULL,
    start_date      DATE              NOT NULL,
    end_date        DATE              NOT NULL,
    status          NVARCHAR(20)      NOT NULL CONSTRAINT df_audit_plans_status DEFAULT N'Borrador'
                                      CONSTRAINT ck_audit_plans_status
                                      CHECK (status IN (N'Borrador', N'Aprobado', N'En Ejecución', N'Cerrado')),
    estimated_hours INT               NOT NULL CONSTRAINT ck_audit_plans_hours CHECK (estimated_hours > 0),
    responsible_id  INT               NOT NULL CONSTRAINT fk_audit_plans_responsible REFERENCES dbo.users (id),
    scope           NVARCHAR(2000)    NULL,
    created_by      INT               NOT NULL CONSTRAINT fk_audit_plans_created_by REFERENCES dbo.users (id),
    created_at      DATETIME2(0)      NOT NULL CONSTRAINT df_audit_plans_created_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT ck_audit_plans_dates CHECK (end_date > start_date)
);
