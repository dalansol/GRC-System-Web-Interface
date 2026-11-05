# Diseño: flujo de aprobación de planes de acción

Fecha: 2026-11-05
Requisitos: SF-10, SF-11 (Seguimiento), SF-12 (Reporte y cierre), SF-16 (portal del auditado), SF-08 (evidencia) · UF-08, UF-09, UF-13
Módulos: Seguimiento, Reporte y cierre, Usuarios y accesos
Historia: "Flujo de aprobación de entregables". El entregable es la **evidencia documental de un plan de acción**.
Pruebas: [`docs/pruebas/aprobacion-planes-accion.md`](../pruebas/aprobacion-planes-accion.md)

## Origen de las reglas

| Regla | Fuente |
|---|---|
| El auditor define el plan y asigna responsables | SRS: UF-08, SF-10 |
| El auditado consulta lo suyo, sube evidencia y actualiza el avance | SRS: UF-13, SF-16 y SF-08 |
| El auditado no ve papeles de trabajo ni calificaciones internas | SRS: SF-16 |
| El auditado pide la prórroga y la jefatura decide | SRS: SF-11 |
| La jefatura aprueba o rechaza, con firma y motivo obligatorio | SRS: UF-09, SF-12 |
| Auditoría valida y aprueba o rechaza los planes durante la ejecución | Visión y Alcance, Ejecución de auditorías |
| Auditoría valida el cierre del plan | Proceso E2E de FEMSA, paso 11 |

Estas reglas son **provisionales** hasta que FEMSA las confirme. El SRS no dice qué es un entregable ni quién
envía a revisión: esas dos respuestas son decisiones del equipo.

## Criterios de aceptación

1. Al abrir un plan `Pendiente` para revisarlo, cambia a `En Revisión` y el cambio queda en la bitácora del flujo.
2. Al aprobar, se registra la firma digital y se notifica al equipo.
3. Rechazar sin motivo no está permitido: el sistema pide el motivo obligatorio.

## Decisiones

| Tema | Decisión |
|---|---|
| Revisiones | Dos: la definición del plan antes de empezar y su evidencia al cierre |
| Quién aprueba | Solo el Jefe de Auditoría. El Administrador es soporte técnico. El flujo multinivel sigue pendiente (TBD) |
| Quién crea y edita | Auditor y Auditor Senior |
| Quién envía a revisión | Cualquier Auditor o Auditor Senior que no participe en el plan |
| Qué se decide | Una sola decisión y una firma por revisión. Un rechazo del cierre puede señalar archivos |
| Qué ve el auditado | Folio y título del plan, folio y título del hallazgo, fecha, estado, pasos, evidencia, motivo de rechazo y archivos señalados. No ve causa raíz, severidad, historial ni firma |
| Qué pasos ve | El responsable, todos (los ajenos, en solo lectura); un asignado, solo los suyos. El rol de auditado no cambia esto |
| A quién se asigna | Solo a auditados en planes nuevos y reasignaciones. Los planes existentes conservan a sus participantes |
| Prórrogas | Las pide el responsable, sobre la fecha del plan; una abierta por plan; decide el Jefe de Auditoría |
| Planes existentes | Se tratan como ya validados y conservan su estado |
| Firma digital | Registro electrónico: firmante, rol, fecha y huella SHA-256 del contenido. No es una firma electrónica avanzada |
| Notificación | Campana dentro de la aplicación. El correo queda pendiente (TBD) |
| Hallazgos | Pasan a `Asignado` cuando se valida el plan. Aprobar el cierre no los cambia |
| Quién no puede revisar | El responsable, quien tenga un paso asignado y quien creó el plan |

## Estados

```
DEFINICIÓN (el auditado no ve el plan)
Borrador    --(el auditor envía)-------->  Pendiente  --(el revisor lo abre)-->  En Revisión
En Revisión --(el revisor aprueba)------>  Asignado, y la etapa pasa a cierre; se avisa a los auditados
En Revisión --(el revisor rechaza)------>  Rechazado; el auditor corrige y reenvía

CIERRE
Asignado / En Progreso / Completado: el auditado sube evidencia y completa sus pasos
Todos los pasos completos: se avisa al auditor, que revisa la evidencia y envía  -->  Pendiente
Pendiente   --(el revisor lo abre)------>  En Revisión   [criterio 1]
En Revisión --(el revisor aprueba)------>  Aprobado      [criterio 2, estado final]
En Revisión --(el revisor rechaza)------>  Rechazado     [criterio 3]; los pasos de los archivos señalados se reabren
Rechazado   --(el auditado corrige y vuelve a marcar; se avisa al auditor, que reenvía)-->  Pendiente
```

Un rechazo del cierre reabre, en la misma transacción, los pasos de los archivos señalados. El auditor no puede
reenviar hasta que se vuelvan a marcar, y al completarse el último recibe otra vez el aviso. Un rechazo sin archivos
señalados no reabre pasos: el auditor decide cuándo reenviar.

`action_plans.review_stage` guarda la etapa. Un plan nuevo empieza en `Borrador` y `definicion`, aunque SF-10 diga
`Asignado`: `Asignado` ahora significa que ya se validó (falta anotarlo en el SRS).

| Situación | Plan | Pasos | Evidencia |
|---|---|---|---|
| Definición: `Borrador` o `Rechazado` | El auditor edita todo | El auditor los reemplaza | Bloqueada |
| Cierre, en curso o `Rechazado` | Solo el responsable y el estado manual | El asignado los completa | El asignado sube y quien subió elimina |
| Cualquier etapa: `Pendiente` o `En Revisión`; `Aprobado` | Bloqueado | Bloqueados | Bloqueada |

Lo que el Jefe de Auditoría validó no cambia: el título, la causa y los pasos quedan fijos, y la fecha solo se
mueve con una prórroga aprobada.

## Modelo de datos

Script `backend/sql/044_flujo_aprobacion_planes.sql`: estados, `action_plan_approval_events` (inmutable) y
`notifications`.

Script `backend/sql/045_etapas_planes_accion.sql`:

- Agrega `Borrador` a `action_plans.status`.
- `action_plans.review_stage` y `action_plan_approval_events.stage`, con `cierre` por omisión: los planes y
  eventos existentes quedan como ya validados sin reescribir sus datos.
- `action_plan_event_evidence`: archivos señalados en un rechazo. Copia el nombre y el hash, sin llave a
  `evidence`, porque el archivo se puede reemplazar. Es inmutable.
- `action_plan_extension_requests`: solicitudes de prórroga. Un índice único parcial impide dos abiertas para un
  plan, y la base exige motivo para rechazar.

El script es compatible con el código ya desplegado, así que se puede aplicar antes de actualizarlo. La versión
nueva del backend necesita que 045 ya esté aplicado.

## Firma

Al aprobar se calcula `huellaContenidoPlan` (`backend/src/domain/flujoPlanAccion.ts`): SHA-256 del título, la
causa raíz, el responsable, la fecha de compromiso, los hallazgos, los pasos y los hashes de su evidencia, en un
orden fijo. No incluye el estado, que cambia al firmar. El firmante, el rol y la fecha quedan en el evento.

`GET /planes-accion/:id/flujo` vuelve a calcular la huella del plan `Aprobado` y responde `firmaIntegra`. La firma
de la validación se guarda, pero no se compara, porque el plan cambia legítimamente mientras se trabaja.

## Rutas

| Método y ruta | Acceso | Efecto |
|---|---|---|
| `GET /api/planes-accion` | Todos, salvo auditados | Lista completa |
| `GET /api/planes-accion/mios` | Usuario en sesión | Un auditado recibe la vista reducida de sus planes ya validados |
| `GET /api/planes-accion/responsables` | Todos, salvo auditados | Auditados activos |
| `GET /api/planes-accion/hallazgos/:id` | Todos, salvo auditados | Hallazgo para el formulario |
| `POST /api/planes-accion` | Auditor, Auditor Senior | Crea el plan en `Borrador` |
| `PATCH /api/planes-accion/:id` | Auditor, Auditor Senior | Edita según la tabla de estados |
| `GET /api/planes-accion/revision` | Jefe de Auditoría | Planes en revisión de ambas etapas |
| `GET /api/planes-accion/:id/flujo` | Equipo de auditoría | `{ eventos, firmaIntegra }` |
| `GET /api/planes-accion/:id/evidencias` | Jefe de Auditoría | Archivos para señalar al rechazar |
| `POST /api/planes-accion/:id/enviar-revision` | Auditor, Auditor Senior | Pasa a `Pendiente` y avisa a los revisores no impedidos |
| `POST /api/planes-accion/:id/abrir-revision` | Revisor no impedido | Pasa a `En Revisión`. Si ya lo está, responde 200 sin otro evento |
| `POST /api/planes-accion/:id/aprobar` | Revisor no impedido | Definición: `Asignado` y hallazgos `Asignado`. Cierre: `Aprobado` |
| `POST /api/planes-accion/:id/rechazar` | Revisor no impedido | `{ motivo, evidenciasObservadas? }` |
| `PATCH /api/planes-accion/:planId/pasos/:pasoId` | Asignado al paso | Al completarse el último, también tras un rechazo, avisa al auditor |
| `POST /api/planes-accion/:id/prorrogas` | Responsable del plan | `{ fechaPropuesta, justificacion }`; no cambia la fecha |
| `GET /api/planes-accion/prorrogas` | Jefe de Auditoría | Solicitudes abiertas |
| `POST /api/planes-accion/prorrogas/:id/aprobar` | Revisor no impedido | Mueve la fecha, si el plan no está en revisión ni aprobado |
| `POST /api/planes-accion/prorrogas/:id/rechazar` | Revisor no impedido | `{ motivo }`; conserva la fecha |
| `GET /api/hallazgos/:id/planes-accion` | Todos, salvo auditados | Planes del hallazgo |
| `GET /api/notificaciones` | Usuario en sesión | `{ noLeidas, items }`, las suyas (hasta 50) |
| `POST /api/notificaciones/:id/leida` | Usuario en sesión | 204, o 404 si no es suya |
| `POST /api/notificaciones/leidas` | Usuario en sesión | 204 |

El aviso de un cambio llega al responsable, a los asignados y a quien creó el plan, sin quien actuó. Un rechazo de
la definición solo le llega a quien creó el plan. Si un auditado creó un plan anterior, el aviso de pasos completos
llega a los Auditores Senior.

| Situación | HTTP | Código |
|---|---|---|
| Rol sin acceso | 403 | `ROL_NO_AUTORIZADO` |
| Auditor que participa en un plan anterior, al enviar | 403 | `ENVIO_IMPEDIDO` |
| Responsable, asignado o creador del plan, al revisar | 403 | `REVISOR_IMPEDIDO` |
| Responsable anterior con rol de Auditor, al editar | 403 | `RESPONSABLE_NO_EDITA` |
| Quien pide una prórroga no es el responsable | 403 | `NO_RESPONSABLE` |
| Plan sin pasos o pasos sin completar | 400 | `PASOS_PENDIENTES` |
| Un paso sin evidencia al enviar al cierre | 400 | `EVIDENCIA_PENDIENTE` |
| Motivo vacío, con solo espacios o de más de 2000 caracteres | 400 | `MOTIVO_OBLIGATORIO` |
| Responsable o asignado que no es auditado, archivo de otro plan, datos de prórroga | 400 | `DATOS_INVALIDOS` |
| Estado que no admite la acción, o acción simultánea | 409 | `ESTADO_INVALIDO` |
| Edición, paso, evidencia o prórroga con el plan bloqueado | 409 | `PLAN_BLOQUEADO` |
| Cambiar contenido de un plan ya validado | 409 | `PLAN_VALIDADO` |
| Prórroga abierta, al pedir otra o al enviar al cierre | 409 | `PRORROGA_PENDIENTE` |
| `PATCH` a un estado del flujo o desde uno | 409 | `ESTADO_CONTROLADO_POR_FLUJO` |

Bitácora general: `plan_accion.envio_revision`, `plan_accion.apertura_revision`, `plan_accion.aprobacion` (con la
huella), `plan_accion.rechazo`, `plan_accion.solicitud_prorroga` y `plan_accion.decision_prorroga`.

## Frontend

- `VistaPlanesAccion`: los auditados ven `PortalPlanesAuditado`. El equipo de auditoría ve la pestaña "Seguimiento",
  con la etapa, la edición y el envío para Auditor y Auditor Senior; el Jefe de Auditoría ve además "Bandeja de
  revisión" y "Prórrogas".
- `PortalPlanesAuditado`: la vista reducida, con el motivo de rechazo, los archivos observados en cada paso, la
  evidencia, el avance y la solicitud de prórroga. Marcar un paso lo tacha de inmediato, sin esperar al servidor, y se
  deshace con un error si este lo rechaza. Intentar marcar un paso ajeno o de un plan bloqueado muestra un error.
- `BandejaRevisionPlanes`: filtros por estado, etapa de cada plan, detalle y Aprobar o Rechazar. En el cierre, el
  rechazo lista los archivos con el nombre de su paso. Abrir el plan cambia su estado en el clic, no en un efecto.
  Cambiar de filtro cierra el plan abierto.
- `BandejaProrrogas`: solicitudes abiertas, con aprobar o rechazar.
- `HistorialFlujoPlan`: historial con etapa, firma, huella abreviada, archivos señalados y aviso de integridad.
- `FormularioPlanAccion`: en la definición edita todo, pasos incluidos; ya validado, solo el responsable y el estado.
- `VistaHallazgo` y `VistaHallazgoDetallado`: crean planes el Auditor y el Auditor Senior; los auditados no ven los planes ahí.
- `CampanaNotificaciones`: consulta al cargar, cada minuto y al volver a la ventana. Un clic marca el aviso como
  leído y lleva a su plan (`destinoDeNotificacion`): al Jefe de Auditoría, a la bandeja o a las prórrogas; al equipo
  de auditoría, a Seguimiento con el plan abierto; al auditado, a su plan resaltado. Un plan `Pendiente` solo se
  resalta, porque abrirlo lo pasa a `En Revisión` y eso le toca decidirlo al Jefe.

## Pendiente (TBD)

- Que FEMSA confirme estas reglas. El SRS debe anotar que un plan nuevo empieza en `Borrador`, no en `Asignado`.
- Flujo multinivel: UF-09 pide jefatura y gerencia, pero no existe el rol de Gerente.
- Revisión de papeles de trabajo (paso 8 del proceso E2E): los controles siguen con su revisión actual, sin firma ni bitácora del flujo.
- Filtrar por área, como dice SF-16: hoy el portal filtra por asignación porque los usuarios no tienen unidad confiable.
- La pantalla de hallazgos del auditado: no se revisó qué "calificaciones internas" muestra, y las rutas aún le permiten editar los de su unidad.
- Una prórroga no mueve las fechas de los pasos.
- El auditado puede volver a marcar un paso reabierto sin reemplazar el archivo señalado; el auditor lo revisa al reenviar.
- Notificación por correo y su proveedor.
- Validez legal de la firma electrónica.
- `PATCH` todavía permite fijar `Completado` a mano. Falta decidir si se retira.
- Completar un solo paso sin evidencia: solo lo impide la pantalla. El envío al cierre sí la exige en el backend.
- Agregar las tablas nuevas al diagrama de Miro.
