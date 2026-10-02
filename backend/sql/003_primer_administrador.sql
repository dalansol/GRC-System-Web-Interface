-- Primer Administrador del sistema. Sin él nadie puede dar de alta a los demás.
-- Cambia el nombre y el correo antes de ejecutar. El correo debe ser el de su
-- cuenta de Microsoft Entra ID.

DECLARE @nombre NVARCHAR(150) = N'CAMBIAR: nombre completo';
DECLARE @correo NVARCHAR(254) = N'cambiar@dominio-corporativo.com';

IF @correo LIKE N'cambiar@%'
    THROW 50000, 'Cambia @nombre y @correo antes de ejecutar este script.', 1;

IF NOT EXISTS (SELECT 1 FROM dbo.users WHERE email = LOWER(@correo))
    INSERT INTO dbo.users (name, email, role_id)
    SELECT @nombre, LOWER(@correo), r.id
    FROM dbo.roles r
    WHERE r.name = N'Administrador';
