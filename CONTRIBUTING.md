# Cómo trabajamos en el proyecto

Aquí juntamos las reglas que acordamos como equipo para que el código quede ordenado y no nos
pisemos entre nosotros. Aplica para lo que hagamos a partir del Sprint 3. Lo que ya existe lo
vamos acomodando poco a poco, sin mover archivos que alguien más esté usando en su rama.

Historia de usuario #143, tarea #157.

## Carpetas

### Frontend (raíz del repo)

```
src/
  main.tsx              entrada de la app
  app/
    App.tsx             navegación principal (las vistas nuevas ya no van aquí)
    api/                llamadas al backend, un archivo por módulo
    auth/               inicio de sesión
    components/         pantallas, formularios y modales
      hallazgos/        si un módulo tiene 3 archivos o más, va en su propia carpeta
      controles/        (también catalogo/, planes-auditoria/, planes-accion/, asistente/, hoja/)
      ui/               componentes de shadcn, no se tocan
    domain/             lógica y ViewModels, sin nada de interfaz
    data/               datos de prueba mientras un módulo no se conecte al backend
  styles/               estilos
```

Los componentes no llaman al backend directo, lo hacen a través de `api/`. La lógica que no
es de interfaz va en `domain/`.

### Backend (`backend/`)

```
backend/
  src/
    routes/             recibe la petición y responde
    domain/             reglas de negocio y validaciones
    repos/              acceso a datos (versión Sql y versión Memoria)
    middleware/         autenticación, permisos y subida de archivos
    asistente/          todo lo de la IA
  sql/                  scripts de la base de datos, numerados
  test/                 pruebas
```

El orden es routes, luego domain, luego repos. Las rutas no consultan la base de datos directo.

### Documentación

Cada módulo tiene su archivo en `docs/diseno/` (cómo funciona) y en `docs/pruebas/` (qué se
probó).

## Nombres

Todo va en español, menos la base de datos, que ya estaba en inglés y la dejamos así.

| Qué | Cómo | Ejemplo |
|---|---|---|
| Pantalla | Vista + nombre | `VistaHallazgo.tsx` |
| Formulario | Formulario + nombre | `FormularioPlanAccion.tsx` |
| Modal | Modal + acción + nombre | `ModalRegistrarUnidad.tsx` |
| ViewModel | use + nombre + ViewModel | `useHallazgosViewModel.ts` |
| Archivos de api, domain y repos | camelCase | `planesAccion.ts` |
| Repos | nombre + Sql o Memoria | `conflictosSql.ts` |
| Pruebas | mismo nombre + .test | `periodos.test.ts` |
| Carpetas | minúsculas, sin acentos | `catalogo/` |
| Rutas de la API | minúsculas con guiones | `/api/controles/:controlId/mi-asignacion` |
| Tablas | inglés, en plural, con guion bajo | `action_plans` |
| Scripts SQL | número de 3 dígitos + descripción | `034_catalogo_entregables.sql` |
| Variables y funciones | camelCase | `obtenerHallazgos` |
| Tipos | PascalCase | `PlanAccion` |

En la tarea #159 se renombraron los archivos que no seguían esto: `mock_data` ahora es
`datosPrueba`, `HierarchyView` es `VistaCatalogo`, `SharedComponents` es `ComponentesCompartidos`
y `UsuariosRolesView` es `VistaUsuariosRoles`.

## Ramas

- Nadie trabaja directo en `master`.
- Cada quien crea su rama desde `master` actualizado, con un nombre que diga de qué trata, en
  minúsculas y con guiones. Por ejemplo: `estandar-proyecto`, `plan-accion`, `conflictos-interes`.
- Antes de pedir que se junte tu rama, haz `git pull origin master` y arregla tú los conflictos.
- Cuando tu rama ya está en `master`, bórrala.

## Commits

- En español y que diga qué cambió. Por ejemplo: `Agrega filtro por estado en hallazgos (SF-10)`.
- Evitar mensajes como `cambios`, `fix` o `prueba`.
- Si el cambio cubre un requisito, ponerlo al final entre paréntesis: `(SF-08)`.
- Si mueves archivos de carpeta, hazlo en un commit aparte, sin cambiarles nada más.

## Pull requests

- En el título va el número de la tarea de Azure DevOps, por ejemplo `#157`.
- En la descripción explica qué cambiaste y cómo se prueba.
- Antes de abrirlo, corre las pruebas: `npm test` en el frontend y `corepack pnpm test` en el
  backend.
- Otra persona del equipo lo revisa antes de juntarlo.
- Si cambiaste cómo funciona un módulo, actualiza su archivo en `docs/`.

## Otras reglas

- No subir archivos `.env` ni contraseñas.
- El frontend usa npm y el backend usa pnpm, no los mezclen.
- No editar scripts SQL que ya se corrieron. Si hace falta un cambio, se crea uno nuevo con el
  siguiente número.
