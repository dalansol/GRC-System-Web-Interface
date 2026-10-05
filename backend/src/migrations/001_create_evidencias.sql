-- Migration: Create evidencias table for document attachments
-- Database: GRC_Database (SQL Server)

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'evidencias')
BEGIN
    CREATE TABLE evidencias (
        id              NVARCHAR(50)   NOT NULL PRIMARY KEY,
        entity_id       NVARCHAR(50)   NOT NULL,       -- Control or Finding ID
        entity_type     NVARCHAR(20)   NOT NULL,       -- 'control' or 'hallazgo'
        file_name       NVARCHAR(255)  NOT NULL,
        mime_type       NVARCHAR(10)   NOT NULL,       -- 'pdf' or 'xlsx'
        file_size       BIGINT         NOT NULL,       -- Size in bytes
        file_hash       NVARCHAR(128)  NOT NULL,       -- SHA-256 hex digest
        storage_path    NVARCHAR(500)  NOT NULL,       -- Relative path on disk
        uploaded_by     NVARCHAR(100)  NULL,
        created_at      DATETIME2      NOT NULL DEFAULT GETDATE(),

        CONSTRAINT CK_evidencias_entity_type CHECK (entity_type IN ('control', 'hallazgo')),
        CONSTRAINT CK_evidencias_mime_type   CHECK (mime_type IN ('pdf', 'xlsx'))
    );

    -- Index for fast lookups by entity
    CREATE NONCLUSTERED INDEX IX_evidencias_entity
        ON evidencias (entity_id, entity_type);

    PRINT 'Table [evidencias] created successfully.';
END
ELSE
BEGIN
    PRINT 'Table [evidencias] already exists — skipping.';
END
