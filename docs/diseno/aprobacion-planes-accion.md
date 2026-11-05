# Diseño: flujo de aprobación de planes de acción

Fecha: 2026-11-04
Requisitos: SF-12 (aprobación y rechazo), SF-10 y SF-11 (seguimiento), SF-15 y SF-18 (bitácora), SF-16, SF-17 y SNF-05 (roles)
Módulos: Reporte y cierre, Seguimiento
Historia: "Flujo de aprobación de entregables". En esta entrega, el entregable es el **plan de acción**.
Pruebas: [`docs/pruebas/aprobacion-planes-accion.md`](../pruebas/aprobacion-planes-accion.md)

## Criterios de aceptación

1. Al abrir un plan `Pendiente` para revisarlo, cambia a `En Revisión` y el cambio queda en la bitácora del flujo.
2. Al aprobar, cambia a `Aprobado`, se registra la firma digital y se notifica al equipo.
3. Rechazar sin motivo no está permitido: el sistema pide el motivo obligatorio.

## Decisiones

| Tema | Decisión |
|---|---|
| Qué se revisa | El plan terminado: con todos sus pasos completos, el responsable lo envía a revisión |
| Niveles | Uno: Jefe de Auditoría o Administrador. El flujo multinivel queda pendiente (TBD) |
| Firma digital | Registro electrónico: firmante, rol, fecha y huella SHA-256 del contenido. No es una firma electrónica avanzada |
| Notificación | Campana dentro de la aplicación. El correo queda pendiente (TBD) |
| Rechazo | El plan queda `Rechazado` con su motivo visible; se corrige y se reenvía, y vuelve a `Pendiente` |
| Hallazgos | Aprobar un plan no cambia sus hallazgos |
| Quién no puede revisar | El responsable del plan y quien tenga un paso asignado |

## Estados

```
Asignado / En Progreso / Completado --(responsable, pasos completos)--> Pendiente
Rechazado                           --(responsable, pasos completos)--> Pendiente
Pendiente   --(el revisor lo abre)-->    En Revisión   [criterio 1]
En Revisión --(el revisor aprueba)-->    Aprobado      [criterio 2, estado final]
En Revisión --(el revisor rechaza)-->    Rechazado     [criterio 3, con motivo]
```

En `Pendiente`, `En Revisión` y `Aprobado` el plan está bloqueado: no se edita, no se cambian sus pasos
y no se sube ni se elimina su evidencia. En `Rechazado` sí se permite, salvo cambiar el estado a mano.

`PATCH /planes-accion/:id` solo cambia entre `Asignado`, `En Progreso` y `Completado`. Los demás estados
solo los fija el flujo.

## Modelo de datos

Script `backend/sql/044_flujo_aprobacion_planes.sql`:

- Agrega `Pendiente`, `Aprobado` y `Rechazado` a `action_plans.status`.
- `action_plan_approval_events`: bitácora del flujo (acción, estados de origen y destino, actor, motivo,
  huella y fecha). Guarda una copia del nombre y el rol para que el historial no cambie después. La base
  exige motivo en un rechazo y huella en una aprobación, y un disparador impide modificar o borrar filas.
- `notifications`: avisos por usuario, con la entidad a la que se refieren y su fecha de lectura.
- Pasa a `Pendiente` los planes en `En Revisión` que no tienen eventos: con el flujo anterior, ese estado
  solo significaba "enviado". Su historial empieza en la apertura porque no hay evento de envío.

El estado, el evento y las notificaciones se guardan en una sola transacción (`transicionar`). La fila del
plan se bloquea, así que de dos revisores simultáneos solo uno actúa; el otro recibe `409`.

## Firma

Al aprobar se calcula `huellaContenidoPlan` (`backend/src/domain/flujoPlanAccion.ts`): SHA-256 del título, la
causa raíz, el responsable, la fecha de compromiso, los hallazgos, los pasos y los hashes de su evidencia,
en un orden fijo. No incluye el estado, que cambia al firmar. El firmante, el rol y la fecha quedan en el
evento.

`GET /planes-accion/:id/flujo` vuelve a calcular la huella y responde `firmaIntegra`: `true` si coincide,
`false` si el contenido cambió después de la firma y `null` si el plan no está aprobado.

## Rutas

| Método y ruta | Acceso | Efecto |
|---|---|---|
| `GET /api/planes-accion/revision` | Jefe de Auditoría, Administrador | Planes en `Pendiente`, `En Revisión`, `Aprobado` y `Rechazado` |
| `GET /api/planes-accion/:id/flujo` | Equipo de auditoría, responsable y asignados | `{ eventos, firmaIntegra }` |
| `POST /api/planes-accion/:id/enviar-revision` | Responsable | Pasa a `Pendiente` y avisa a los revisores que no están impedidos |
| `POST /api/planes-accion/:id/abrir-revision` | Revisor no impedido | Pasa a `En Revisión`. Si ya lo está, responde 200 sin otro evento |
| `POST /api/planes-accion/:id/aprobar` | Revisor no impedido | Pasa a `Aprobado`, firma y avisa al equipo |
| `POST /api/planes-accion/:id/rechazar` | Revisor no impedido | Con `{ motivo }`, pasa a `Rechazado` y avisa al equipo con el motivo |
| `GET /api/notificaciones` | Usuario en sesión | `{ noLeidas, items }`, las suyas (hasta 50) |
| `POST /api/notificaciones/:id/leida` | Usuario en sesión | 204, o 404 si no es suya |
| `POST /api/notificaciones/leidas` | Usuario en sesión | 204 |

`/aprobar` cambió de significado: antes era el envío a revisión, sin control de rol.

El equipo que recibe el aviso es el responsable, los asignados y quien creó el plan, sin quien actuó.

| Situación | HTTP | Código |
|---|---|---|
| No es el responsable al enviar | 403 | `NO_RESPONSABLE` |
| Pasos sin completar o plan sin pasos | 400 | `PASOS_PENDIENTES` |
| Rol sin acceso | 403 | `ROL_NO_AUTORIZADO` |
| Responsable o asignado del plan al revisar | 403 | `REVISOR_IMPEDIDO` |
| Estado que no admite la acción, o revisión simultánea | 409 | `ESTADO_INVALIDO` |
| Motivo vacío, con solo espacios o de más de 2000 caracteres | 400 | `MOTIVO_OBLIGATORIO` |
| Edición, paso o evidencia de un plan bloqueado | 409 | `PLAN_BLOQUEADO` |
| `PATCH` a un estado del flujo o desde uno | 409 | `ESTADO_CONTROLADO_POR_FLUJO` |

Bitácora general: `plan_accion.envio_revision`, `plan_accion.apertura_revision`, `plan_accion.aprobacion`
(con la huella) y `plan_accion.rechazo`.

## Frontend

- `VistaPlanesAccion`: pestañas "Mis planes" y "Bandeja de revisión" (esta, solo para los revisores), botón
  "Enviar a revisión" o "Reenviar a revisión" para el responsable, y aviso con el motivo de rechazo.
- `BandejaRevisionPlanes`: filtros por estado con conteos, detalle con hallazgos, pasos y evidencia de solo
  lectura, y botones Aprobar y Rechazar. Abrir el plan cambia su estado en el clic, no en un efecto, para
  que no se llame dos veces.
- `HistorialFlujoPlan`: historial con firma, huella abreviada y aviso de integridad.
- `CampanaNotificaciones`: consulta al cargar, cada minuto y al volver a la ventana. Si falla, no interrumpe
  la barra superior.
- `planFinalizado` hace que un plan aprobado no cuente como atrasado en el Dashboard ni en el hallazgo.

## Pendiente (TBD)

- Flujo multinivel. Visión y Alcance pide jefatura, gerencia y dirección, y el Consolidado trae Audit Chief y
  Audit Manager, pero no existen esos roles ni una regla para asignarlos. Falta confirmarlo con FEMSA.
- Notificación por correo y su proveedor.
- Validez legal de la firma electrónica.
- `PATCH` todavía permite fijar `Completado` a mano, fuera del flujo. Falta decidir si se retira.
- El backend no exige evidencia para completar un paso; solo lo hace la pantalla.
- Agregar las tablas nuevas al diagrama de Miro.
