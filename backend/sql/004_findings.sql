-- Hallazgos (SF-09, SF-10). Tabla que usa src/routes/hallazgos.ts.
-- Azure SQL / SQL Server. Se puede ejecutar más de una vez sin efecto.
-- Las columnas conservan el camelCase que ya espera la ruta de hallazgos.

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;

IF OBJECT_ID('dbo.findings', 'U') IS NULL
CREATE TABLE dbo.findings (
    id            NVARCHAR(100) NOT NULL CONSTRAINT pk_findings PRIMARY KEY,
    folio         NVARCHAR(50)  NULL     CONSTRAINT uq_findings_folio UNIQUE,
    title         NVARCHAR(255) NOT NULL,
    description   NVARCHAR(MAX) NULL,
    type          NVARCHAR(100) NULL,
    severity      NVARCHAR(20)  NOT NULL CONSTRAINT ck_findings_severity
                                         CHECK (severity IN (N'Crítico', N'Alto', N'Medio', N'Bajo')),
    status        NVARCHAR(30)  NOT NULL CONSTRAINT df_findings_status DEFAULT N'Abierto'
                                         CONSTRAINT ck_findings_status
                                         CHECK (status IN (N'Abierto', N'En Proceso', N'En Revisión', N'Asignado', N'Cerrado')),
    auditId       NVARCHAR(100) NULL,
    controlId     NVARCHAR(100) NULL,
    failedControl NVARCHAR(255) NULL,
    residualRisk  NVARCHAR(20)  NULL,
    ownerId       NVARCHAR(100) NULL,
    created_at    DATETIME2(3)  NOT NULL CONSTRAINT df_findings_created_at DEFAULT SYSUTCDATETIME()
);
