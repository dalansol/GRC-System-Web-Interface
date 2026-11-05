# Pruebas: flujo de aprobación de planes de acción

Requisitos: SF-12, SF-10, SF-11, SF-15, SF-18, SF-16, SF-17, SNF-05 · Diseño: [`docs/diseno/aprobacion-planes-accion.md`](../diseno/aprobacion-planes-accion.md)
Fecha de ejecución: 2026-11-04

## Alcance y ambiente

| Capa | Herramienta | Contra qué se ejecutó |
|---|---|---|
| API (backend) | Vitest + Supertest | Repositorio en memoria |
| Base de datos | Vitest + `pg` | PostgreSQL 18 local con TLS, base exclusiva de pruebas |
| Vista (frontend) | Vitest + Testing Library | API simulada |
| Punta a punta | Microsoft Edge sin ventana, con un guion de Playwright fuera del repositorio | Frontend + backend + PostgreSQL 18 local, autenticación en modo `dev` y archivos en disco |

**No verificado todavía:** el script 044 contra Supabase y el flujo con un tenant real de Microsoft Entra ID.

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
| Backend con base de datos | 495 | 485 aprobadas, 10 fallidas |
| Backend sin base de datos | 495 | 374 aprobadas, 10 fallidas, 111 omitidas |
| Frontend | 200 | 200 aprobadas |
| Revisión de tipos del backend (`corepack pnpm typecheck`) | n/a | Sin errores |
| Compilación del frontend (`npm run build`) | n/a | Correcta |
| Punta a punta | 21 verificaciones | 21 correctas |

Las 10 fallas están todas en `backend/test/planes.test.ts` y ya existían (pendiente 22 de `CLAUDE.md`).
Antes de este trabajo, el backend tenía 380 aprobadas y las mismas 10 fallidas, y el frontend 154 aprobadas.

## Casos de prueba por criterio

### Criterio 1: abrir un plan pendiente

| Caso | Resultado esperado | Dónde | Resultado |
|---|---|---|---|
| El revisor abre un plan `Pendiente` | Pasa a `En Revisión`, con un evento `apertura` con actor y estados | `planesAccionFlujo.test.ts`, punta a punta | Correcto |
| Se abre otra vez | Responde 200 sin otro evento | `planesAccionFlujo.test.ts` | Correcto |
| Dos revisores lo abren a la vez | Ambos reciben 200 y queda un solo evento | `planesAccionFlujo.test.ts` | Correcto |
| Se abre un plan sin enviar | 409 `ESTADO_INVALIDO` | `planesAccionFlujo.test.ts` | Correcto |
| Clic en un plan pendiente de la bandeja | Llama a la API una sola vez | `BandejaRevisionPlanes.test.tsx` | Correcto |

### Criterio 2: aprobar con firma y notificación

| Caso | Resultado esperado | Dónde | Resultado |
|---|---|---|---|
| El revisor aprueba | `Aprobado`, con firmante, rol, fecha y huella de 64 caracteres | `planesAccionFlujo.test.ts`, punta a punta | Correcto |
| Notificación | Una para el responsable, los asignados y quien creó el plan; ninguna para quien aprobó | `planesAccionFlujo.test.ts`, punta a punta | Correcto |
| Aprobar sin abrir, o dos veces | 409 | `planesAccionFlujo.test.ts` | Correcto |
| Dos aprobaciones a la vez | Un 200 y un 409, con un solo evento y un solo aviso | `planesAccionFlujo.test.ts`, `sql.integracion.test.ts` | Correcto |
| Cambia el contenido o el hash de una evidencia después de firmar | `firmaIntegra` es falso y la pantalla avisa | `planesAccionFlujo.test.ts`, `evidencias.integracion.test.ts`, `HistorialFlujoPlan.test.tsx` | Correcto |
| Doble clic en "Confirmar y firmar" | Una sola llamada | `BandejaRevisionPlanes.test.tsx` | Correcto |

### Criterio 3: rechazo con motivo obligatorio

| Caso | Resultado esperado | Dónde | Resultado |
|---|---|---|---|
| Sin motivo, vacío, con solo espacios o que no es texto | 400 `MOTIVO_OBLIGATORIO`; no cambia el estado, ni hay evento ni aviso | `planesAccionFlujo.test.ts` | Correcto |
| Más de 2000 caracteres | 400 `MOTIVO_OBLIGATORIO` | `planesAccionFlujo.test.ts` | Correcto |
| Confirmar en pantalla sin texto o con espacios | No llama a la API y muestra "Escribe el motivo del rechazo." | `BandejaRevisionPlanes.test.tsx`, punta a punta | Correcto |
| Con motivo | `Rechazado`, y el evento y el aviso llevan el motivo | `planesAccionFlujo.test.ts`, punta a punta | Correcto |
| Corregir y reenviar | Vuelve a `Pendiente` y conserva todo el historial en orden | `planesAccionFlujo.test.ts`, punta a punta | Correcto |
| La base recibe un rechazo sin motivo o una aprobación sin huella | La base lo impide y no cambia nada | `sql.integracion.test.ts` | Correcto |

### Roles, bloqueos y bitácora

| Caso | Resultado esperado | Dónde | Resultado |
|---|---|---|---|
| Un Auditor o Auditor Senior intenta revisar | 403; un Auditor tampoco ve la bandeja | `planesAccionFlujo.test.ts`, `VistaPlanesAccion.test.tsx`, punta a punta | Correcto |
| El responsable o un asignado con rol de revisor | 403 `REVISOR_IMPEDIDO`, solo lectura, y el plan sigue igual | `planesAccionFlujo.test.ts`, `BandejaRevisionPlanes.test.tsx`, punta a punta | Correcto |
| Alguien que no es el responsable envía el plan | 403 `NO_RESPONSABLE` | `planesAccionFlujo.test.ts` | Correcto |
| `PATCH` a un estado del flujo | 409 `ESTADO_CONTROLADO_POR_FLUJO` | `planesAccionFlujo.test.ts` | Correcto |
| Editar, cambiar un paso o tocar evidencia de un plan bloqueado | 409 `PLAN_BLOQUEADO`, sin guardar el archivo | `planesAccionFlujo.test.ts`, `evidencias.integracion.test.ts`, punta a punta | Correcto |
| Una edición que llega justo después de la aprobación | 409 `PLAN_BLOQUEADO`, y el plan no cambia | `planesAccionFlujo.test.ts`, `sql.integracion.test.ts` | Correcto |
| Modificar o borrar un evento en la base | La base lo impide | `sql.integracion.test.ts` | Correcto |
| Falla una notificación | Se revierten el estado y el evento | `sql.integracion.test.ts` | Correcto |
| El script 044 sobre planes `En Revisión` | Los que no tienen eventos pasan a `Pendiente`; los demás no cambian | `sql.integracion.test.ts` | Correcto |
| Notificaciones de otro usuario | No se consultan ni se marcan | `notificaciones.test.ts`, `sql.integracion.test.ts` | Correcto |

## Bitácora de defectos

| Defecto | Dónde se encontró | Estado |
|---|---|---|
| El botón "Asistente IA" tapaba "Aprobar" al final de la página | Captura de pantalla de la prueba punta a punta | Corregido con espacio inferior en `VistaPlanesAccion` |
| Los usuarios de prueba `j.ejemplo` y `c.ejemplo` no están en `030_seed_demo.sql`, aunque la pantalla de acceso los ofrece | Preparación de la prueba punta a punta | Abierto. Ya existía; en la base local se agregaron a mano |
