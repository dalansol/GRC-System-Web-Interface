-- Usuarios, roles y permisos (SF-16, SF-17, SNF-05).
-- Azure SQL / SQL Server. Se puede ejecutar más de una vez sin efecto.

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
BEGIN
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
    CREATE UNIQUE INDEX uq_users_entra_oid ON dbo.users (entra_oid) WHERE entra_oid IS NOT NULL;
    CREATE INDEX ix_users_role_id ON dbo.users (role_id);
END;
