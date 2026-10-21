# Pruebas: parametrización de la estructura organizacional

Requisitos: SF-03, SF-05 (parcial) · Módulo: Planeación · Historia: `ParametrizacionHU.md`
Diseño: [`docs/diseno/base-de-datos.md`](../diseno/base-de-datos.md) (`017_jerarquia_organizacional.sql`)
Fecha de ejecución: 2026-10-20

## Alcance y ambiente

| Capa | Herramienta | Contra qué se ejecutó |
|---|---|---|
| API (backend) | Vitest + Supertest | Repositorio en memoria |
| Base de datos | Vitest + `pg` | PostgreSQL con `SQL_TEST_*` (esquema propio `prueba_estructura`) |
| Vista (frontend) | Vitest + Testing Library | API simulada |

**No verificado todavía:** las 9 pruebas de base de datos (`estructura.integracion.test.ts`)
no se han corrido porque no había conexión `SQL_TEST_*` configurada; tampoco la
migración 017 contra la base compartida de Supabase ni una prueba punta a punta en el
navegador.

## Cómo ejecutar

```bash
# Backend (26 pruebas de estructura; las 9 de base de datos se omiten sin conexión)
cd backend && corepack pnpm test

# Incluyendo la base de datos: aplica los scripts dos veces en el esquema prueba_estructura
SQL_TEST_SERVER=<servidor> SQL_TEST_DATABASE=<base> SQL_TEST_USER=<usuario> \
SQL_TEST_PASSWORD=<contraseña> corepack pnpm test

# Frontend (13 de la vista, 6 de la lógica de riesgos y 4 de la navegación por tarjetas)
npm test
```

## Resultado

| Suite | Pruebas | Resultado |
|---|---|---|
| Backend: `test/estructura.test.ts` | 26 | 26 aprobadas |
| Base de datos: `test/estructura.integracion.test.ts` | 9 | Omitidas (sin conexión) |
| Frontend: `HierarchyView.test.tsx` | 13 | 13 aprobadas |
| Frontend: `domain/estructura/riesgos.test.ts` | 6 | 6 aprobadas |
| Frontend: `domain/estructura/navegacion.test.ts` | 4 | 4 aprobadas |

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
| CP-EST-05 | AC2 | Dos áreas "Recursos Humanos" en subdivisiones distintas | Ambas `201` (los nombres de división, subdivisión y área no son únicos) | API, BD |
| CP-EST-06 | AC3 | Engagement en plan `Aprobado` o `En Ejecución` en la rama | Unidad, división, subdivisión y área responden `409 AUDITORIAS_ACTIVAS`; el diálogo muestra el mensaje | API, BD, vista |
| CP-EST-06 | AC3 | Engagement en plan `Borrador` o `Cerrado` | Se eliminan de la hoja a la raíz; 4 eventos `estructura.baja` | API, BD |
| CP-EST-06 | AC3 | Nodo con hijos y sin auditorías activas | `409 HIJOS_EXISTENTES` (no se borra en cascada) | API |
| — | Bitácora | Alta, edición y baja | Eventos `estructura.alta`, `estructura.edicion`, `estructura.baja`, `periodo.alta` | API |
| — | Periodos | Activar un periodo nuevo; fechas invertidas; nombre repetido | Queda un solo activo; `400`; `409` | API, BD |
| CP-EST-07 | Catálogo | Riesgos registrados en una subdivisión | Aparecen bajo su subdivisión con nivel y control; la división y la unidad muestran el total y el color del peor nivel | API, BD, vista |
| CP-EST-07 | Catálogo | Filtro por nivel y búsqueda | Solo quedan las ramas con un riesgo de ese nivel o peor; la búsqueda encuentra unidades, nodos y riesgos sin importar acentos | Vista |
| CP-EST-07 | AC3 | Eliminar una subdivisión con riesgos registrados | `409 HIJOS_EXISTENTES` | API, BD |
| CP-EST-08 | Catálogo | "Ver en tarjetas" de una unidad | Se recorre unidad › división › subdivisión con tarjetas (franja por peor nivel, conteos, riesgos); en la subdivisión, áreas y tabla de riesgos; las migas regresan al catálogo | Vista |
| CP-EST-08 | AC1 | Alta de un nodo desde las tarjetas | Se crea en el nivel abierto y la tarjeta aparece sin salir de la vista | Vista |
| CP-EST-08 | SNF-05 | Usuario sin rol de gestión en las tarjetas | Navega, pero no ve agregar, editar ni eliminar | Vista |
| — | Navegación | Ruta con un nodo eliminado | Cae al ancestro más profundo que existe; si se elimina la unidad, vuelve al catálogo | Vista |
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
