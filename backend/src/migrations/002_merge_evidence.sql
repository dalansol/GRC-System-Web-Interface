-- Migration: merge upload metadata into the specification's evidence table

ALTER TABLE evidence ADD
    entity_id NVARCHAR(50) NULL,
    entity_type NVARCHAR(20) NULL,
    mime_type NVARCHAR(10) NULL,
    file_size BIGINT NULL,
    file_hash NVARCHAR(128) NULL,
    storage_path NVARCHAR(500) NULL,
    uploaded_by NVARCHAR(100) NULL,
    created_at DATETIME2 NOT NULL CONSTRAINT DF_evidence_created_at DEFAULT GETDATE();
GO

UPDATE evidence
SET entity_id = COALESCE(CONVERT(NVARCHAR(50), control_id), CONVERT(NVARCHAR(50), finding_id)),
    entity_type = CASE WHEN control_id IS NOT NULL THEN 'control' ELSE 'hallazgo' END,
    mime_type = CASE WHEN LOWER(file_name) LIKE '%.xlsx' THEN 'xlsx' ELSE 'pdf' END,
    file_size = 0,
    file_hash = '',
    storage_path = file_name;
GO

ALTER TABLE evidence ALTER COLUMN entity_id NVARCHAR(50) NOT NULL;
ALTER TABLE evidence ALTER COLUMN entity_type NVARCHAR(20) NOT NULL;
ALTER TABLE evidence ALTER COLUMN mime_type NVARCHAR(10) NOT NULL;
ALTER TABLE evidence ALTER COLUMN file_size BIGINT NOT NULL;
ALTER TABLE evidence ALTER COLUMN file_hash NVARCHAR(128) NOT NULL;
ALTER TABLE evidence ALTER COLUMN storage_path NVARCHAR(500) NOT NULL;
GO

ALTER TABLE evidence ADD
    CONSTRAINT CK_evidence_entity_type CHECK (entity_type IN ('control', 'hallazgo')),
    CONSTRAINT CK_evidence_mime_type CHECK (mime_type IN ('pdf', 'xlsx'));
GO

CREATE NONCLUSTERED INDEX IX_evidence_entity
    ON evidence (entity_id, entity_type);