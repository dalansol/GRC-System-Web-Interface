# Pruebas: gestión de usuarios y roles

Requisitos: SF-16, SF-17, SNF-05 · Diseño: [`docs/diseno/usuarios-roles.md`](../diseno/usuarios-roles.md)
Fecha de ejecución: 2026-10-01

## Alcance y ambiente

| Capa | Herramienta | Contra qué se ejecutó |
|---|---|---|
| API (backend) | Vitest + Supertest | Repositorio en memoria |
| Base de datos | Vitest + `mssql` | SQL Server 2022 en Docker (mismo motor que Azure SQL) |
| Vista (frontend) | Vitest + Testing Library | API simulada |
| Punta a punta | Chromium (Playwright), ejecución manual | Frontend + backend + SQL Server 2022 en Docker, autenticación en modo `dev` |

**No verificado todavía**, porque los recursos no existen: ejecución contra la base de
Azure SQL y el inicio de sesión contra un tenant real de Microsoft Entra ID. La
validación de tokens de Entra se probó con tokens firmados localmente (firma, emisor,
audiencia, expiración y tenant); el flujo interactivo de MSAL en el navegador no se ha
ejecutado. Ver "Pendiente" al final.

## Cómo ejecutar

```bash
# Backend (100 pruebas; las 18 de base de datos se omiten sin conexión)
cd backend && pnpm test

# Backend incluyendo la base de datos (118 pruebas). Usa una base exclusiva para
# pruebas: el contenido de la tabla users se borra.
SQL_TEST_SERVER=<servidor> SQL_TEST_DATABASE=<base> SQL_TEST_USER=<usuario> \
SQL_TEST_PASSWORD=<contraseña> pnpm test

# Frontend (29 pruebas)
npm test
```

## Resultado

| Suite | Pruebas | Resultado |
|---|---|---|
| Backend: API, dominio, tokens de Entra, configuración | 100 | 100 aprobadas |
| Backend: integración con SQL Server | 18 | 18 aprobadas |
| Frontend: vista, sesión, cliente de API | 29 | 29 aprobadas |
| Punta a punta en navegador | 10 comprobaciones | 10 aprobadas |

## Casos de prueba

Usuarios de prueba: Sofía Ramírez (Administrador), María García (Jefe de Auditoría),
Ana Rodríguez (Auditor), Pedro Sánchez (Consultor, inactivo). Dominio corporativo
configurado: `expedite.com`.

### CA1: despliegue de la tabla de usuarios

| ID | Caso | Pasos | Resultado esperado | Obtenido | Estado |
|---|---|---|---|---|---|
| CP-01 | Tabla con las cuatro columnas | Entrar como Administrador y abrir "Usuarios & Roles" | Tabla con nombre completo, correo corporativo, rol actual y estado de cuenta de cada usuario | Igual al esperado | Aprobado |
| CP-02 | Usuario inactivo | Igual que CP-01 | Pedro Sánchez aparece con estado "Inactivo" | Igual al esperado | Aprobado |
| CP-03 | La API no expone datos internos | `GET /api/usuarios` como Administrador | Cada usuario trae solo id, nombre, correo, rol, estado y último acceso | Igual al esperado | Aprobado |
| CP-04 | Fallo al cargar | Abrir la vista con el servidor caído | Mensaje de error y botón "Reintentar" que recupera la tabla | Igual al esperado | Aprobado |

### CA2: actualización inmediata de permisos al cambiar el rol

| ID | Caso | Pasos | Resultado esperado | Obtenido | Estado |
|---|---|---|---|---|---|
| CP-05 | Cambio de rol | Como Administrador, cambiar a Ana de Auditor a Jefe de Auditoría | La respuesta trae el rol y los permisos nuevos; la tabla muestra el rol nuevo | Igual al esperado | Aprobado |
| CP-06 | Efecto inmediato para el usuario afectado | Tras CP-05, Ana hace su siguiente petición sin volver a iniciar sesión | Ana ya tiene el permiso "Aprobar Riesgos" | Igual al esperado | Aprobado |
| CP-07 | Otorgar acceso de Administrador | Con Ana en sesión en otra ventana, cambiarla a Administrador; Ana vuelve a su ventana | A Ana le aparece "Usuarios & Roles" y puede abrir la tabla, sin cerrar sesión | Igual al esperado | Aprobado |
| CP-08 | Retirar acceso de Administrador | Con Ana en la tabla de usuarios, cambiarla a Auditor; Ana intenta cambiar un rol | La acción de Ana se rechaza (403), pierde la vista y el rol que intentó cambiar no se modifica | Igual al esperado | Aprobado |
| CP-09 | Persistencia | Recargar la página después de CP-05 | El rol nuevo sigue en la tabla | Igual al esperado | Aprobado |
| CP-10 | Último Administrador | El único Administrador activo intenta quitarse el rol | Se rechaza (409) con mensaje; el selector conserva "Administrador" | Igual al esperado | Aprobado |
| CP-11 | Rol inexistente | `PATCH /api/usuarios/:id/rol` con un rol que no existe | 400 `DATOS_INVALIDOS` | Igual al esperado | Aprobado |
| CP-12 | Usuario inexistente o identificador inválido | `PATCH` con id 9999, `abc`, `0`, `-1`, `1.5` | 404 para el inexistente; 400 para los inválidos | Igual al esperado | Aprobado |
| CP-13 | Registro en bitácora | Cambiar un rol | Se registra el evento con actor, usuario, rol anterior y rol nuevo | Igual al esperado | Aprobado |

### CA3: rechazo de correos fuera del dominio corporativo

| ID | Caso | Pasos | Resultado esperado | Obtenido | Estado |
|---|---|---|---|---|---|
| CP-14 | Dominio ajeno | Dar de alta a `l.pena@gmail.com` | Mensaje junto al campo: "El correo no pertenece al dominio corporativo autorizado (@expedite.com)."; el formulario conserva los datos; el usuario no se crea | Igual al esperado | Aprobado |
| CP-15 | Dominios parecidos | Alta con `@mail.expedite.com`, `@malexpedite.com` y `@expedite.com.evil.com` | Los tres se rechazan con 422 `DOMINIO_NO_AUTORIZADO` | Igual al esperado | Aprobado |
| CP-16 | Dominio corporativo | Dar de alta a `l.pena@expedite.com` | 201; el usuario aparece en la tabla con estado "Activo" | Igual al esperado | Aprobado |
| CP-17 | Mayúsculas y espacios | Alta con `  L.Pena@Expedite.COM ` | Se acepta y se guarda como `l.pena@expedite.com` | Igual al esperado | Aprobado |
| CP-18 | Correo duplicado | Alta con un correo ya registrado, cambiando mayúsculas | 409; mensaje "Ya existe un usuario con ese correo." junto al campo | Igual al esperado | Aprobado |
| CP-19 | Datos incompletos o inválidos | Alta sin nombre, sin correo, sin rol, correo mal formado, nombre de más de 150 caracteres | El formulario señala cada campo; la API responde 400 `DATOS_INVALIDOS` | Igual al esperado | Aprobado |
| CP-20 | El error se limpia | Tras CP-14, corregir el correo | El mensaje de error desaparece al editar el campo | Igual al esperado | Aprobado |

### Acceso solo para Administrador e inicio de sesión

| ID | Caso | Pasos | Resultado esperado | Obtenido | Estado |
|---|---|---|---|---|---|
| CP-21 | Sin identidad | Llamar a la API sin token | 401 `NO_AUTENTICADO` | Igual al esperado | Aprobado |
| CP-22 | Rol sin acceso | Como Jefe de Auditoría, llamar a listar, alta y cambio de rol | 403 `ROL_NO_AUTORIZADO` en los tres | Igual al esperado | Aprobado |
| CP-23 | Elevación de privilegios | Un Jefe de Auditoría intenta asignarse Administrador | Se rechaza y su rol no cambia | Igual al esperado | Aprobado |
| CP-24 | Menú y vista | Entrar con un rol distinto de Administrador | "Usuarios & Roles" no aparece en la barra lateral; la vista muestra "Acceso restringido" y no consulta usuarios | Igual al esperado | Aprobado |
| CP-25 | Cuenta no registrada o inactiva | Entrar con una cuenta que no existe o inactiva | 403; pantalla "Acceso no autorizado"; no se muestra la aplicación | Igual al esperado | Aprobado |
| CP-26 | Token de Entra válido | Token firmado por el tenant, con audiencia y emisor correctos | Se acepta y se obtiene la identidad | Igual al esperado | Aprobado (token local) |
| CP-27 | Token de Entra inválido | Otra audiencia, otro emisor, otro tenant, expirado, sin firma o firmado con otra llave | Se rechaza con 401 | Igual al esperado | Aprobado (token local) |
| CP-28 | Suplantación por correo | Tras el primer acceso de un usuario, otra identidad de Entra presenta el mismo correo | 403; el usuario original sigue entrando | Igual al esperado | Aprobado (token local) |
| CP-29 | Modo de desarrollo en producción | Arrancar el backend con `NODE_ENV=production` y `AUTH_MODE=dev` o `DATA_MODE=memoria` | El servidor se niega a arrancar | Igual al esperado | Aprobado |

### Base de datos

| ID | Caso | Pasos | Resultado esperado | Obtenido | Estado |
|---|---|---|---|---|---|
| CP-30 | Scripts repetibles | Ejecutar `001_schema.sql` y `002_seed.sql` dos veces, con las opciones de `sqlcmd` | 6 roles, 8 permisos, 24 asignaciones, sin duplicados; índices creados | Ver DEF-02 | Aprobado tras corrección |
| CP-31 | Restricciones | Estado desconocido, rol inexistente, identidad de Entra repetida | La base rechaza los tres | Igual al esperado | Aprobado |
| CP-32 | Texto con caracteres especiales | Nombre con comillas, `DROP TABLE`, ñ y otros alfabetos | Se guarda tal cual; la tabla sigue intacta | Igual al esperado | Aprobado |
| CP-33 | Primer Administrador | Ejecutar `003_primer_administrador.sql` sin editar y editado dos veces | Sin editar falla con aviso; editado crea un solo usuario | Igual al esperado | Aprobado |

## Defectos encontrados

| ID | Severidad | Descripción | Cómo se detectó | Estado |
|---|---|---|---|---|
| DEF-01 | Alta | En `master`, al abrir "Usuarios & Roles" la pantalla queda en blanco con el error `DEFAULT_PERMISSIONS is not defined`. `App.tsx` usaba `ROLES`, `DEFAULT_PERMISSIONS` y `UserRecord` sin importarlos tras separar los datos de prueba a `mock_data.tsx`. | Revisión de código y ejecución de `master` en el navegador | Corregido: la vista se reemplazó por `UsuariosRolesView.tsx`, que obtiene los datos de la API |
| DEF-02 | Alta | `001_schema.sql` fallaba al ejecutarse con `sqlcmd` (`CREATE INDEX failed ... QUOTED_IDENTIFIER`) y dejaba la tabla `users` creada sin sus índices; al repetir el script los índices nunca se creaban, por lo que dos usuarios podían compartir la misma identidad de Entra. | CP-30, al ejecutar los scripts con `sqlcmd` | Corregido: los scripts activan las opciones requeridas y crean cada índice solo si falta. Cubierto por prueba automatizada |
| DEF-03 | Baja | Si el puerto 5173 está ocupado, Vite arranca en el 5174 y el backend rechaza las peticiones por CORS; la aplicación muestra "No se pudo conectar con el servidor de Expedite." | Prueba de punta a punta con otro proyecto usando el 5173 | Corregido: el backend acepta ambos orígenes por omisión |

## Riesgos conocidos

- Dos Administradores que se quiten el rol mutuamente en el mismo instante podrían
  dejar al sistema sin Administrador: la verificación y el cambio no ocurren en una
  sola transacción. No se reprodujo; queda como mejora.
- La sesión abierta de un usuario refleja el rol nuevo en su siguiente petición al
  servidor o al volver a la pestaña. El servidor aplica el cambio de inmediato; lo que
  puede tardar es que la pantalla ya abierta oculte u ofrezca opciones.

## Pendiente

- Ejecutar los scripts y la suite de integración contra la base de Azure SQL.
- Probar el inicio de sesión interactivo con un registro de aplicación real en
  Microsoft Entra ID (redirección, token de acceso y cierre de sesión).
- Confirmar el dominio corporativo real; las pruebas usan `expedite.com`.
