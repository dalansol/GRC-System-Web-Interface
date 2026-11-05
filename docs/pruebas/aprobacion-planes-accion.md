# Pruebas: flujo de aprobación de planes de acción

Requisitos: SF-10, SF-11, SF-12, SF-16, SF-08 · Diseño: [`docs/diseno/aprobacion-planes-accion.md`](../diseno/aprobacion-planes-accion.md)
Fecha de ejecución: 2026-11-05

## Alcance y ambiente

| Capa | Herramienta | Contra qué se ejecutó |
|---|---|---|
| API (backend) | Vitest + Supertest | Repositorio en memoria |
| Base de datos | Vitest + `pg` | PostgreSQL 18 local con TLS, base exclusiva de pruebas |
| Vista (frontend) | Vitest + Testing Library | API simulada |
| Punta a punta | Microsoft Edge sin ventana, con un guion de Playwright fuera del repositorio | Frontend + backend + PostgreSQL 18 local con `--datos-prueba`, autenticación en modo `dev` y archivos en disco |

**No verificado todavía:** el script 045 contra Supabase y el flujo con un tenant real de Microsoft Entra ID. La
versión anterior del flujo sí se probó a mano contra la base compartida, con 044 aplicado (2026-11-05).

## Cómo ejecutar

```bash
# Backend (las pruebas de base de datos se omiten sin conexión)
cd backend && corepack pnpm test

# Backend incluyendo la base de datos. Usa una base exclusiva: las pruebas borran tablas.
SQL_TEST_SERVER=<servidor> SQL_TEST_PORT=<puerto> SQL_TEST_DATABASE=<base> SQL_TEST_USER=<usuario> \
SQL_TEST_PASSWORD=<contraseña> SQL_TEST_TRUST_CERT=true corepack pnpm test

# Frontend
npm test
```

## Resultado

| Suite | Pruebas | Resultado |
|---|---|---|
| Backend con base de datos | 669 | 659 aprobadas, 10 fallidas |
| Backend sin base de datos | 669 | 519 aprobadas, 10 fallidas, 140 omitidas |
| Frontend | 302 | 302 aprobadas |
| Revisión de tipos del backend (`corepack pnpm typecheck`) | n/a | Sin errores |
| Compilación del frontend (`npm run build`) | n/a | Correcta |
| Punta a punta | 88 verificaciones | 88 correctas |

Las 10 fallas están todas en `backend/test/planes.test.ts` y ya existían (pendiente 22 de `CLAUDE.md`).

## Casos de prueba

### Criterio 1: abrir un plan pendiente

| Caso | Resultado esperado | Dónde | Resultado |
|---|---|---|---|
| El Jefe de Auditoría abre un plan `Pendiente`, en cualquier etapa | Pasa a `En Revisión`, con un evento `apertura` con actor y estados | `planesAccionFlujo.test.ts`, punta a punta | Correcto |
| Se abre otra vez, o dos veces a la vez | Responde 200 con un solo evento | `planesAccionFlujo.test.ts` | Correcto |
| Se abre un plan sin enviar | 409 `ESTADO_INVALIDO` | `planesAccionFlujo.test.ts` | Correcto |
| Clic en un plan pendiente de la bandeja | Llama a la API una sola vez | `BandejaRevisionPlanes.test.tsx` | Correcto |

### Criterio 2: aprobar con firma y notificación

| Caso | Resultado esperado | Dónde | Resultado |
|---|---|---|---|
| Aprobar la definición | `Asignado`, etapa `cierre`, hallazgos `Asignado`, firma con huella y aviso a los auditados | `planesAccionFlujo.test.ts`, `sql.integracion.test.ts`, punta a punta | Correcto |
| Aprobar el cierre | `Aprobado`, con firmante, rol, fecha, huella e integridad verificada | `planesAccionFlujo.test.ts`, punta a punta | Correcto |
| Notificación | Una para el responsable, los asignados y quien creó el plan; ninguna para quien aprobó | `planesAccionFlujo.test.ts`, punta a punta | Correcto |
| Aprobar sin abrir, dos veces o a la vez | 409, con un solo evento | `planesAccionFlujo.test.ts`, `sql.integracion.test.ts` | Correcto |
| Cambia una evidencia después de firmar | `firmaIntegra` es falso y la pantalla avisa | `planesAccionFlujo.test.ts`, `evidencias.integracion.test.ts`, `HistorialFlujoPlan.test.tsx` | Correcto |
| La firma de la validación | No muestra la integridad del cierre | `HistorialFlujoPlan.test.tsx`, punta a punta | Correcto |
| Doble clic en "Confirmar y firmar" | Una sola llamada | `BandejaRevisionPlanes.test.tsx` | Correcto |

### Criterio 3: rechazo con motivo obligatorio

| Caso | Resultado esperado | Dónde | Resultado |
|---|---|---|---|
| Sin motivo, vacío, con solo espacios o que no es texto | 400 `MOTIVO_OBLIGATORIO`; no cambia el estado, ni hay evento ni aviso | `planesAccionFlujo.test.ts` | Correcto |
| Confirmar en pantalla sin texto | No llama a la API y muestra "Escribe el motivo del rechazo." | `BandejaRevisionPlanes.test.tsx`, punta a punta | Correcto |
| Rechazo de la definición | Solo avisa a quien creó el plan; el auditor corrige pasos y reenvía | `flujoPlanAccion.test.ts`, `planesAccionFlujo.test.ts`, punta a punta | Correcto |
| Rechazo del cierre con archivos señalados | Se guardan con el evento y siguen ahí tras reemplazar el archivo | `sql.integracion.test.ts`, punta a punta | Correcto |
| Archivo de otro plan | 400 y el plan no cambia | `planesAccionFlujo.test.ts` | Correcto |
| Archivo señalado | Reabre su paso en la misma transacción, los demás no cambian y el auditor no reenvía hasta que se vuelva a marcar | `planesAccionFlujo.test.ts`, `sql.integracion.test.ts`, punta a punta | Correcto |
| Volver a marcar el paso reabierto | Avisa otra vez al auditor | `planesAccionFlujo.test.ts`, punta a punta | Correcto |
| Rechazo sin archivos señalados | No reabre pasos | `planesAccionFlujo.test.ts` | Correcto |
| Dos archivos con el mismo nombre | Se distinguen por su paso | `BandejaRevisionPlanes.test.tsx`, punta a punta | Correcto |
| Modificar o borrar un archivo señalado en la base | La base lo impide | `sql.integracion.test.ts` | Correcto |
| La base recibe un rechazo sin motivo o una aprobación sin huella | La base lo impide y no cambia nada | `sql.integracion.test.ts` | Correcto |

### Roles

| Caso | Resultado esperado | Dónde | Resultado |
|---|---|---|---|
| Crear un plan | Solo Auditor y Auditor Senior; Jefe, Administrador y auditados reciben 403 | `planesAccionFlujo.test.ts`, punta a punta | Correcto |
| Responsable o asignado que no es auditado | 400 | `planesAccionFlujo.test.ts` | Correcto |
| Editar un plan | Solo Auditor y Auditor Senior | `planesAccionFlujo.test.ts` | Correcto |
| Enviar a revisión | Solo Auditor y Auditor Senior que no participan; el auditado recibe 403 | `planesAccionFlujo.test.ts`, punta a punta | Correcto |
| Revisar | Solo el Jefe de Auditoría; el Administrador recibe 403 y no ve la bandeja | `planesAccionFlujo.test.ts`, `VistaPlanesAccion.test.tsx`, punta a punta | Correcto |
| Jefe responsable, asignado o creador de un plan anterior | 403 `REVISOR_IMPEDIDO`, solo lectura, y el plan sigue igual | `planesAccionFlujo.test.ts`, `BandejaRevisionPlanes.test.tsx` | Correcto |

### Portal del auditado

| Caso | Resultado esperado | Dónde | Resultado |
|---|---|---|---|
| Plan en definición | No lo ve, no cambia sus pasos ni sube evidencia, ni por la API | `planesAccionFlujo.test.ts`, `evidencias.integracion.test.ts`, punta a punta | Correcto |
| Datos que recibe | Solo la lista exacta de campos, sin causa raíz, severidad, historial ni firma | `flujoPlanAccion.test.ts`, `planesAccionFlujo.test.ts`, punta a punta | Correcto |
| Pasos que ve | El responsable, todos; un asignado, solo los suyos | `flujoPlanAccion.test.ts`, `planesAccionFlujo.test.ts`, punta a punta | Correcto |
| Lista completa, responsables, historial y planes del hallazgo | 403 | `planesAccionFlujo.test.ts`, `hallazgos.integracion.test.ts`, punta a punta | Correcto |
| Paso ajeno | Se ve, pero no cambia ni recibe evidencia; intentar marcarlo muestra un error | `PortalPlanesAuditado.test.tsx`, `planesAccionFlujo.test.ts`, punta a punta | Correcto |
| Marcar un paso | Se tacha de inmediato; si el servidor lo rechaza, se deshace con un error; un doble clic manda un solo cambio | `PortalPlanesAuditado.test.tsx`, `VistaPlanesAccion.test.tsx`, punta a punta | Correcto |
| Plan rechazado | Ve el motivo y sus archivos observados, y reemplaza el archivo | `PortalPlanesAuditado.test.tsx`, punta a punta | Correcto |
| Consultor y Solo Lectura | Conservan la consulta de planes | `planesAccionFlujo.test.ts` | Correcto |

### Edición y bloqueos

| Caso | Resultado esperado | Dónde | Resultado |
|---|---|---|---|
| Tras validarse, cambiar título, causa, fecha o pasos | 409 `PLAN_VALIDADO` | `planesAccionFlujo.test.ts`, punta a punta | Correcto |
| Tras validarse, reasignar el responsable | Se guarda, también en un plan anterior sin título | `planesAccionFlujo.test.ts`, `FormularioPlanAccion.test.tsx` | Correcto |
| Enviar al cierre con pasos incompletos o sin evidencia | 400 `PASOS_PENDIENTES` o `EVIDENCIA_PENDIENTE` | `planesAccionFlujo.test.ts` | Correcto |
| Plan existente tras el script 045 | Queda en cierre y va directo a esa revisión | `sql.integracion.test.ts`, `planesAccionFlujo.test.ts`, punta a punta | Correcto |
| `PATCH` a un estado del flujo | 409 `ESTADO_CONTROLADO_POR_FLUJO` | `planesAccionFlujo.test.ts` | Correcto |
| Editar, cambiar un paso o tocar evidencia de un plan bloqueado | 409 `PLAN_BLOQUEADO`, sin guardar el archivo | `planesAccionFlujo.test.ts`, `evidencias.integracion.test.ts`, punta a punta | Correcto |
| Modificar o borrar un evento en la base | La base lo impide | `sql.integracion.test.ts` | Correcto |
| Falla una notificación | Se revierten el estado y el evento | `sql.integracion.test.ts` | Correcto |

### Prórrogas

| Caso | Resultado esperado | Dónde | Resultado |
|---|---|---|---|
| El responsable la pide | Queda abierta, la fecha no cambia y avisa al Jefe | `planesAccionFlujo.test.ts`, `sql.integracion.test.ts`, punta a punta | Correcto |
| La pide otro usuario | 403 `NO_RESPONSABLE` | `planesAccionFlujo.test.ts` | Correcto |
| Sin justificación o con una fecha no válida | 400 | `flujoPlanAccion.test.ts`, `planesAccionFlujo.test.ts`, `PortalPlanesAuditado.test.tsx` | Correcto |
| Segunda solicitud abierta, también a la vez | Solo una queda registrada | `planesAccionFlujo.test.ts`, `sql.integracion.test.ts` | Correcto |
| Solicitud abierta al enviar al cierre | 409 `PRORROGA_PENDIENTE` | `planesAccionFlujo.test.ts`, punta a punta | Correcto |
| Aprobarla | Mueve la fecha y avisa | `planesAccionFlujo.test.ts`, `sql.integracion.test.ts`, punta a punta | Correcto |
| Aprobarla con el plan en revisión | 409 `PLAN_BLOQUEADO` y la fecha no cambia | `planesAccionFlujo.test.ts` | Correcto |
| Rechazarla | Exige motivo y conserva la fecha | `planesAccionFlujo.test.ts`, `BandejaProrrogas.test.tsx`, punta a punta | Correcto |
| Dos decisiones a la vez | Solo una se aplica | `planesAccionFlujo.test.ts`, `sql.integracion.test.ts` | Correcto |

### Navegación

| Caso | Resultado esperado | Dónde | Resultado |
|---|---|---|---|
| Clic en una notificación | Marca como leída, cierra la lista y lleva a su plan | `CampanaNotificaciones.test.tsx`, `notificaciones.test.ts`, punta a punta | Correcto |
| Plan por revisar, para el Jefe | Llega a la bandeja; uno `Pendiente` solo se resalta y no cambia de estado | `BandejaRevisionPlanes.test.tsx`, punta a punta | Correcto |
| Prórroga por decidir, para el Jefe | Llega a las prórrogas con la solicitud resaltada | `BandejaProrrogas.test.tsx`, punta a punta | Correcto |
| Aviso para el equipo de auditoría | Llega a Seguimiento con el plan abierto | `VistaPlanesAccion.test.tsx`, punta a punta | Correcto |
| Aviso para el auditado | Llega a su plan resaltado | `PortalPlanesAuditado.test.tsx`, punta a punta | Correcto |
| El plan ya no está disponible | Muestra un error | `BandejaRevisionPlanes.test.tsx`, `BandejaProrrogas.test.tsx`, `PortalPlanesAuditado.test.tsx`, `VistaPlanesAccion.test.tsx` | Correcto |
| Cambiar de pestaña después de llegar | La notificación no vuelve a abrir el plan | `VistaPlanesAccion.test.tsx` | Correcto |
| Cambiar de filtro en la bandeja | Cierra el plan abierto | `BandejaRevisionPlanes.test.tsx`, punta a punta | Correcto |

## Bitácora de defectos

| Defecto | Dónde se encontró | Estado |
|---|---|---|
| El botón "Asistente IA" tapaba "Aprobar" al final de la página | Captura de pantalla de la prueba punta a punta | Corregido con espacio inferior en `VistaPlanesAccion` |
| Los usuarios de prueba `j.ejemplo` y `c.ejemplo` no estaban en los datos de prueba de SQL | Preparación de la prueba punta a punta | Corregido con `046_seed_auditados.sql` |
| Dos archivos con el mismo nombre eran indistinguibles al rechazar | Captura de pantalla de la prueba punta a punta | Corregido: cada archivo muestra su paso |
| El botón de eliminar evidencia no tenía nombre para lectores de pantalla | Prueba punta a punta | Corregido en `EvidenciasSection` |
| Un plan anterior sin título no se podía reasignar | Revisión del código | Corregido en `FormularioPlanAccion` |
| Aprobar una prórroga con el plan en revisión cambiaba una fecha que se firma | Revisión del código | Corregido en la ruta de decisión |
| Marcar un paso ajeno no daba ninguna respuesta | Prueba manual del equipo | Corregido: muestra un error |
| Marcar un paso tardaba porque esperaba al servidor y recargaba la lista | Prueba manual del equipo | Corregido: cambia de inmediato y se deshace si falla |
| Una notificación no llevaba al plan | Prueba manual del equipo | Corregido |
| El plan abierto seguía visible al cambiar de filtro en la bandeja | Prueba manual del equipo | Corregido: el filtro lo cierra |
| Un archivo rechazado dejaba su paso como completado | Prueba manual del equipo | Corregido: el rechazo reabre el paso |
