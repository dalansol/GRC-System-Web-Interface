-- Usuarios auditados de "Usar un rol de prueba". Hacen falta para asignar planes de acción en una base de pruebas.
-- Solo para --datos-prueba. Se puede ejecutar más de una vez sin duplicar datos.

INSERT INTO users (name, email, role_id, status)
SELECT u.name, u.email, r.id, 'active'
FROM (VALUES
    ('Javier Ejemplo',  'j.ejemplo@expedite.com', 'Jefe Auditado'),
    ('Charlie Ejemplo', 'c.ejemplo@expedite.com', 'Empleado Auditado')
) AS u (name, email, role)
JOIN roles r ON r.name = u.role
ON CONFLICT (email) DO NOTHING;
