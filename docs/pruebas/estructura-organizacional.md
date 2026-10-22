# Pruebas: parametrización de la estructura organizacional

Requisitos: SF-03, SF-05 (parcial) · Módulo: Planeación · Historia: `ParametrizacionHU.md`
Diseño: [`docs/diseno/base-de-datos.md`](../diseno/base-de-datos.md) (`017_jerarquia_organizacional.sql`)
Fecha de ejecución: 2026-10-21

## Alcance y ambiente

| Capa | Herramienta | Contra qué se ejecutó |
|---|---|---|
| API (backend) | Vitest + Supertest | Repositorio en memoria |
| Base de datos | Vitest + `pg` | PostgreSQL con `SQL_TEST_*` (esquema propio `prueba_estructura`) |
| Vista (frontend) | Vitest + Testing Library | API simulada |

**No verificado todavía:** las 16 pruebas de base de datos (`estructura.integracion.test.ts`)
no se han corrido porque no había conexión `SQL_TEST_*` configurada; tampoco la
migración 017 contra la base compartida de Supabase ni una prueba punta a punta en el
navegador.

## Cómo ejecutar

```bash
# Backend (37 pruebas de estructura; las 16 de base de datos se omiten sin conexión)
cd backend && corepack pnpm test

# Incluyendo la base de datos: aplica los scripts dos veces en el esquema prueba_estructura
SQL_TEST_SERVER=<servidor> SQL_TEST_DATABASE=<base> SQL_TEST_USER=<usuario> \
SQL_TEST_PASSWORD=<contraseña> corepack pnpm test

# Frontend (28 de la vista, 7 de riesgos, 8 de navegación, 6 de sugerencias, 5 de periodos y 2 de nombres)
npm test
```

## Resultado

| Suite | Pruebas | Resultado |
|---|---|---|
| Backend: `test/estructura.test.ts` | 37 | 37 aprobadas |
| Base de datos: `test/estructura.integracion.test.ts` | 16 | Omitidas (sin conexión) |
| Frontend: `HierarchyView.test.tsx` | 28 | 28 aprobadas |
| Frontend: `domain/estructura/nombres.test.ts` | 2 | 2 aprobadas |
| Frontend: `domain/estructura/riesgos.test.ts` | 7 | 7 aprobadas |
| Frontend: `domain/estructura/navegacion.test.ts` | 8 | 8 aprobadas |
| Frontend: `domain/estructura/sugerencias.test.ts` | 6 | 6 aprobadas |
| Frontend: `domain/estructura/periodos.test.ts` | 5 | 5 aprobadas |

## Casos de prueba

| ID | Criterio | Caso | Esperado | Capa |
|---|---|---|---|---|
| CP-EST-01 | AC1 | Jefe de Auditoría o Administrador crea una unidad con gerente y departamento | `201`; periodo activo `2026Q4` asignado; evento `estructura.alta` | API, vista |
| CP-EST-01 | AC1 | Se agrega división → subdivisión (con país) → área | La rama completa aparece en `GET /unidades-negocio` y en el árbol del catálogo | API, vista |
| CP-EST-01 | AC1 | Alta de un nodo con padre inexistente | `404` | API |
| CP-EST-02 | SNF-05 | Auditor o Auditor Senior intenta crear o eliminar | `403 ROL_NO_AUTORIZADO`; la vista oculta las acciones de gestión | API, vista |
| CP-EST-03 | AC1 | Gerente inexistente, inactivo o sin rol Jefe de Auditoría | `400 DATOS_INVALIDOS`; el selector solo ofrece Jefes de Auditoría activos | API |
| CP-EST-04 | AC1 | Alta sin periodo activo | `409 PERIODO_ACTIVO_NO_CONFIGURADO` | API |
| CP-EST-05 | AC2 | Nombre de unidad repetido con otras mayúsculas (alta y renombre) | `409 NOMBRE_DUPLICADO`; el mensaje se muestra en el formulario, que sigue abierto | API, BD, vista |
| CP-EST-05 | AC2 | Varias unidades sin nombre; renombrar una unidad con su propio nombre | `201` / `200` | API, BD |
| CP-EST-05 | AC2 | Área repetida en la **misma** subdivisión, con otras mayúsculas (alta y renombre) | `409 NOMBRE_DUPLICADO`; el mensaje se muestra en el formulario | API, BD, vista |
| CP-EST-05 | AC2 | Dos áreas "Recursos Humanos" en subdivisiones distintas | Ambas `201` (división y subdivisión tampoco validan nombre) | API, BD |
| CP-EST-06 | AC3 | Engagement en plan `Aprobado` o `En Ejecución` en la rama | Unidad, división, subdivisión y área responden `409 AUDITORIAS_ACTIVAS`; el diálogo muestra el mensaje | API, BD, vista |
| CP-EST-06 | AC3 | Engagement en plan `Borrador` o `Cerrado` | Se eliminan de la hoja a la raíz; 4 eventos `estructura.baja` | API, BD |
| CP-EST-06 | AC3 | Nodo con hijos y sin auditorías activas | `409 HIJOS_EXISTENTES` (no se borra en cascada) | API |
| CP-EST-06 | AC3 | Abrir la eliminación de una unidad con divisiones o de una subdivisión con áreas y riesgos | El diálogo avisa qué tiene ("1 área y 2 riesgos registrados") y no ofrece confirmar | Vista |
| CP-EST-06 | AC3 | El servidor rechaza la eliminación | El mensaje aparece una sola vez, en el diálogo (sin aviso repetido) | Vista |
| — | Bitácora | Alta, edición y baja | Eventos `estructura.alta`, `estructura.edicion`, `estructura.baja`, `periodo.alta` | API |
| — | Periodos | Activar un periodo nuevo; fechas invertidas; nombre repetido | Queda un solo activo; `400`; `409` | API, BD |
| CP-EST-11 | Periodos | Desde la insignia del encabezado: elegir el año y agregar un trimestre o el año fiscal con su botón; activar otro periodo | Se crea "2027 Q1" (01-01 a 03-31) o "2027 Fiscal" (01-01 a 12-31) sin capturar fechas, opcionalmente ya activo; los ya registrados (por fechas) quedan deshabilitados; la lista ordena por año con el fiscal al final; el encabezado muestra el nuevo activo; el error del servidor se muestra en el modal; sin periodo activo la insignia ofrece "Configurar periodo" | Vista |
| CP-EST-11 | BD | Base con periodos de formato anterior ("2031Q2", "Fiscal 2031") | 026 los renombra ("2031 Q2", "2031 Fiscal"); repetir 015 y 017 no duplica los de 2026 (5 periodos: 4 trimestres y el fiscal) ni cambia el periodo activo elegido en el Catálogo | BD |
| CP-EST-11 | SNF-05 | Auditor en el encabezado | Ve el periodo activo, pero no abre la gestión de periodos | Vista |
| CP-EST-11 | Periodos | Unidad registrada en un periodo anterior | El detalle muestra "Periodo de alta" con su periodo, distinto del activo | Vista |
| CP-EST-07 | Catálogo | Riesgos registrados en una subdivisión | Aparecen bajo su subdivisión con nivel y control; la división y la unidad muestran el total y el color del peor nivel | API, BD, vista |
| CP-EST-07 | Catálogo | Filtro por nivel y búsqueda | Solo quedan las subdivisiones con riesgos de ese nivel exacto, y solo esos riesgos; la búsqueda encuentra unidades, nodos y riesgos sin importar acentos | Vista |
| CP-EST-07 | AC3 | Eliminar una subdivisión con riesgos registrados | `409 HIJOS_EXISTENTES` | API, BD |
| CP-EST-08 | Catálogo | Navegar el explorador desde el resumen y desde el árbol | El árbol empieza contraído y solo lista unidad › división › subdivisión; el detalle muestra indicadores, barra de riesgos por nivel y lista de hijos; en la subdivisión, pestañas de riesgos y áreas; las migas regresan al resumen | Vista |
| CP-EST-08 | AC1 | Alta de un nodo desde las tarjetas | Se crea en el nivel abierto y la tarjeta aparece sin salir de la vista | Vista |
| CP-EST-08 | AC1 | Alta de una unidad | Se abre su detalle, con "Agregar la primera división", y aparece en el árbol | Vista |
| CP-EST-12 | Catálogo | No se pueden leer las unidades (backend caído) | Error "No se pudo cargar el catálogo" con Reintentar, no el estado de catálogo vacío | Vista |
| CP-EST-12 | Catálogo | Editar una unidad cuyo gerente ya no está activo | El selector lo conserva y la edición no lo reenvía | Vista |
| CP-EST-08 | SNF-05 | Usuario sin rol de gestión en las tarjetas | Navega, pero no ve agregar, editar ni eliminar | Vista |
| — | Navegación | Ruta con un nodo eliminado | Cae al ancestro más profundo que existe; si se elimina la unidad, vuelve al catálogo | Vista |
| CP-EST-09 | Catálogo | Alta de unidad, nodo o país | Los campos sugieren el siguiente código libre (UDN-, DIVISION-, SUBDIVISION-), las áreas y los países del Consolidado: al enfocar el campo vacío se ven todos, al escribir se filtran sin importar acentos y se eligen con clic o con flechas y Enter (sin enviar el formulario); se puede escribir otro valor | Vista |
| CP-EST-10 | Catálogo | Código asignado por el sistema y nombre editable en unidad, división y subdivisión | El backend asigna el siguiente código del nivel (después del mayor del Consolidado), no reutiliza el de un elemento borrado y dos altas simultáneas reciben códigos distintos; enviar o editar el código responde 400. El formulario de alta muestra el próximo código con un candado (descripción "Se asigna al guardar", sin texto) y el de edición el actual ("No se puede cambiar"); el aviso de alta confirma el código. El nombre es opcional, se edita, vacío lo quita y se muestra en lugar del código con el código aparte; la búsqueda encuentra por ambos. El área solo pide nombre | API, BD, vista |
| — | Datos de prueba | Semilla del Consolidado en memoria y en la base | 6 unidades, 39 subdivisiones, 338 áreas y 249 riesgos; todos los códigos con el formato del nivel y los nombres inferidos de 022; 024 quita la subdivisión sin código de una base con los datos anteriores sin tocar los nombres | API, BD |
| — | BD | Nivel de riesgo fuera de la escala | La base lo rechaza (`ck_risk_library_level`) | BD |
| — | BD | Migraciones repetidas | 017 y 018 se aplican dos veces sin duplicar datos; cada nivel exige su padre | BD |

## Diferencias con el borrador de implementación

- **Acentos:** el borrador pedía rechazar el duplicado también con distinto acento. La
  intercalación `sin_mayusculas` es ICU nivel 2: ignora mayúsculas pero **distingue
  acentos**, así que "Salud" y "Sálud" se aceptan como distintos. Cambiarlo afectaría
  todas las columnas que usan esa intercalación. TBD con el equipo.
- **Códigos de error:** se conservaron los de la versión anterior: `AUDITORIAS_ACTIVAS`
  (el borrador decía `AUDITORIA_ACTIVA`) y `PERIODO_ACTIVO_NO_CONFIGURADO`, que ahora
  responde `409` en vez de `400`.
- **Rutas:** siguen bajo `/api` como en la versión anterior (`/unidades-negocio`,
  `/periodos`) y se agregan `/divisiones`, `/subdivisiones`, `/areas` y
  `/departamentos-auditoria`, en lugar de agruparlas bajo `/api/estructura`.

## Pendiente

- Correr las pruebas de base de datos con `SQL_TEST_*` y aplicar 017 a Supabase.
- La pestaña "Explorador de Riesgos Corporativos" (datos de prueba fijos) se eliminó: los
  riesgos reales se muestran en el árbol del catálogo.
- Mapeo de `UDN-0001…0006` a nombres reales; futuro de `processes` y
  `controls.process_id`; catálogo de riesgos de la historia original (fuera de esta
  entrega). Todos TBD.
