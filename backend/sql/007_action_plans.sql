-- Planes de acción correctivos de un hallazgo (SF-10, SF-11; historia #91).
-- Un hallazgo tiene a lo más un plan. El responsable es un usuario registrado.
-- Azure SQL / SQL Server. Se puede ejecutar más de una vez sin efecto.

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;

IF OBJECT_ID('dbo.action_plans', 'U') IS NULL
CREATE TABLE dbo.action_plans (
    id             INT IDENTITY(1,1) NOT NULL CONSTRAINT pk_action_plans PRIMARY KEY,
    finding_id     NVARCHAR(100)     NOT NULL CONSTRAINT fk_action_plans_finding REFERENCES dbo.findings (id)
                                     CONSTRAINT uq_action_plans_finding UNIQUE,
    description    NVARCHAR(2000)    NOT NULL,
    responsible_id INT               NOT NULL CONSTRAINT fk_action_plans_responsible REFERENCES dbo.users (id),
    due_date       DATE              NOT NULL,
    status         NVARCHAR(20)      NOT NULL CONSTRAINT df_action_plans_status DEFAULT N'Asignado'
                                     CONSTRAINT ck_action_plans_status
                                     CHECK (status IN (N'Asignado', N'En Progreso', N'Completado')),
    created_by     INT               NOT NULL CONSTRAINT fk_action_plans_created_by REFERENCES dbo.users (id),
    created_at     DATETIME2(0)      NOT NULL CONSTRAINT df_action_plans_created_at DEFAULT SYSUTCDATETIME()
);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.action_plans') AND name = 'ix_action_plans_responsible_id')
CREATE INDEX ix_action_plans_responsible_id ON dbo.action_plans (responsible_id);
