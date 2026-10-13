-- Primer Administrador del sistema. Sin él nadie puede dar de alta a los demás.
-- Cambia el nombre y el correo antes de ejecutar. El correo debe ser el de su
-- cuenta de Microsoft Entra ID.

DO $$
DECLARE
    nombre VARCHAR(150) := 'CAMBIAR: nombre completo';
    correo VARCHAR(254) := 'cambiar@dominio-corporativo.com';
BEGIN
    IF correo LIKE 'cambiar@%' THEN
        RAISE EXCEPTION 'Cambia nombre y correo antes de ejecutar este script.';
    END IF;

    INSERT INTO users (name, email, role_id)
    SELECT nombre, LOWER(correo), r.id
    FROM roles r
    WHERE r.name = 'Administrador'
    ON CONFLICT (email) DO NOTHING;
END $$;
