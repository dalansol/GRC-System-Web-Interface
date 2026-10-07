-- Migration: Fix evidence IDs to support NVARCHAR and add audit_id

-- 1. Drop constraints and indexes that might depend on entity_id or others
IF EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_evidence_entity' AND object_id = OBJECT_ID('evidence'))
BEGIN
    DROP INDEX IX_evidence_entity ON evidence;
END

-- 2. Make entity_id nullable because an evidence might only be attached to a control/finding
--    and not explicitly an entity (or we want to allow it to be optional)
ALTER TABLE evidence ALTER COLUMN entity_id NVARCHAR(50) NULL;

-- 3. Drop foreign keys on control_id and finding_id if they exist
DECLARE @fkName NVARCHAR(200);

-- Drop FK for control_id
SELECT @fkName = obj.name
FROM sys.foreign_key_columns fkc
JOIN sys.objects obj ON obj.object_id = fkc.constraint_object_id
JOIN sys.columns col ON col.column_id = fkc.parent_column_id AND col.object_id = fkc.parent_object_id
WHERE fkc.parent_object_id = OBJECT_ID('evidence') AND col.name = 'control_id';

IF @fkName IS NOT NULL
BEGIN
    EXEC('ALTER TABLE evidence DROP CONSTRAINT ' + @fkName);
END

-- Drop FK for finding_id
SET @fkName = NULL;
SELECT @fkName = obj.name
FROM sys.foreign_key_columns fkc
JOIN sys.objects obj ON obj.object_id = fkc.constraint_object_id
JOIN sys.columns col ON col.column_id = fkc.parent_column_id AND col.object_id = fkc.parent_object_id
WHERE fkc.parent_object_id = OBJECT_ID('evidence') AND col.name = 'finding_id';

IF @fkName IS NOT NULL
BEGIN
    EXEC('ALTER TABLE evidence DROP CONSTRAINT ' + @fkName);
END

-- Drop FK for audit_id
SET @fkName = NULL;
SELECT @fkName = obj.name
FROM sys.foreign_key_columns fkc
JOIN sys.objects obj ON obj.object_id = fkc.constraint_object_id
JOIN sys.columns col ON col.column_id = fkc.parent_column_id AND col.object_id = fkc.parent_object_id
WHERE fkc.parent_object_id = OBJECT_ID('evidence') AND col.name = 'audit_id';

IF @fkName IS NOT NULL
BEGIN
    EXEC('ALTER TABLE evidence DROP CONSTRAINT ' + @fkName);
END

-- 4. Alter control_id, finding_id, and audit_id to NVARCHAR(50)
ALTER TABLE evidence ALTER COLUMN control_id NVARCHAR(50) NULL;
ALTER TABLE evidence ALTER COLUMN finding_id NVARCHAR(50) NULL;

IF EXISTS(SELECT * FROM sys.columns WHERE Name = N'audit_id' AND Object_ID = Object_ID(N'evidence'))
BEGIN
    ALTER TABLE evidence ALTER COLUMN audit_id NVARCHAR(50) NULL;
END
ELSE
BEGIN
    ALTER TABLE evidence ADD audit_id NVARCHAR(50) NULL;
END
GO

-- 5. Re-create the index
CREATE NONCLUSTERED INDEX IX_evidence_entity
    ON evidence (entity_id, entity_type);
GO
