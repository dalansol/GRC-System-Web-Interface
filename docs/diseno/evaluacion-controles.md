# Evaluación de diseño y efectividad de controles

Historia #98, requisitos UF-05 y SF-07, módulo de Ejecución (M2).

## Qué hace

El auditor asignado a un control dentro de un plan responde cada criterio con la escala de madurez
de 1 a 5. El backend valida que estén todos los obligatorios, calcula la calificación y el estatus,
y marca deficiencia si la madurez es baja. Desde esa marca se puede generar un hallazgo.

## Valores por confirmar con FEMSA (TBD)

Ni las historias, ni el SRS, ni la Visión y Alcance definen el modelo de madurez. Estos son **datos de
prueba**:

| Qué | Valor de prueba | Dónde se cambia |
|---|---|---|
| Criterios | 4 de diseño y 4 de efectividad | Tabla `evaluation_criteria` (`sql/036_evaluacion_controles.sql`) y `evaluacionesMemoria.ts` |
| Obligatorios | Los 8 | Columna `required` |
| Calificación | Se promedia cada grupo y se toma el menor | `calcularEvaluacion` en `backend/src/domain/evaluaciones.ts` |
| Estatus | 4 o más: Efectivo. De 3 a menos de 4: Parcialmente efectivo. Menos de 3: Deficiente | `UMBRAL_EFECTIVO` y `UMBRAL_DEFICIENCIA` en el mismo archivo |
| Madurez baja | Calificación menor a 3 | `UMBRAL_DEFICIENCIA` |

Se toma el menor de los promedios porque un control bien diseñado que no opera no mitiga el riesgo: con
diseño 5 y efectividad 1, un promedio simple daría 3 y lo escondería.

## Reglas

- **Quién evalúa:** un auditor con el control asignado en ese plan (`audit_controls`), como pide SF-07.
- **Declaración de conflictos:** sin ella no se evalúa (historia #96); responde `DECLARACION_PENDIENTE`.
- **Cuándo se edita:** solo con la asignación `En Progreso`; después responde 409 `EVALUACION_CERRADA`.
- **Una evaluación por control y plan:** si hay varios auditores, volver a guardar la reemplaza y queda
  registrado quién evaluó al último.
- **Quién consulta:** los auditores asignados, quien asignó el control, Jefe de Auditoría, Supervisor y
  Administrador.
- **El estatus no se mezcla con el flujo de revisión:** `control_evaluations.result` es independiente de
  `audit_controls.status` (`En Progreso`, `En Revision`, `Completado`).
- **La calificación nunca viene del cliente:** siempre la calcula el backend.

## Datos

| Tabla | Para qué |
|---|---|
| `evaluation_criteria` | Catálogo de criterios: código, tipo, nombre, si es obligatorio, orden y si está activo |
| `control_evaluations` | Resultado, una fila por plan y control (`UNIQUE (audit_id, control_id)`) |
| `control_evaluation_answers` | Una respuesta de 1 a 5 por criterio; se borra junto con su evaluación |

Los promedios y la calificación se guardan para que un resultado no cambie si después cambian los
criterios o los umbrales. La evaluación y sus respuestas se guardan en una sola transacción.

## API

Ambas rutas exigen sesión y aceptan el id o el código del control.

| Ruta | Respuesta |
|---|---|
| `GET /api/planes/:planId/controles/:controlId/evaluacion` | `criterios`, `evaluacion` (o `null`), `puedeEvaluar`, `motivoBloqueo` |
| `PUT /api/planes/:planId/controles/:controlId/evaluacion` | La evaluación calculada. Cuerpo: `{ "respuestas": [{ "criterioId": 1, "valor": 4 }] }` |

| Error | Cuándo |
|---|---|
| 400 `CRITERIOS_FALTANTES` | Falta un criterio obligatorio; el mensaje lo nombra |
| 400 `DATOS_INVALIDOS` | Plan inválido, criterio inexistente o repetido, o valor fuera de 1 a 5 |
| 403 `ROL_NO_AUTORIZADO` | No tiene el control asignado (o no puede consultarlo) |
| 403 `DECLARACION_PENDIENTE` | No ha declarado sus conflictos en el plan |
| 404 `NO_ENCONTRADO` | El control no está asignado en ese plan |
| 409 `EVALUACION_CERRADA` | La asignación ya no está `En Progreso` |

`GET /api/controles` agrega `tiene_deficiencia`. Guardar registra el evento `control.evaluacion`.

## Frontend

- `EvaluacionControl.tsx`: tarjeta dentro del detalle del control. Si el usuario no puede consultar la
  evaluación, no se muestra.
- La lista de controles lleva la etiqueta "Con deficiencia".
- "Generar hallazgo" abre el formulario de hallazgos con el control ya elegido y vulnerabilidad `Alta`,
  para que el riesgo residual se calcule como un control que no mitiga. No crea el hallazgo solo.

## Limitaciones

- Enviar a revisión no exige que el control esté evaluado; no lo pide la historia y toca el flujo de
  aprobación de controles.
- El formulario de hallazgos sigue guardando `AUD-001` como auditoría, valor fijo que ya tenía.
- Si un control está en varios planes, `tiene_deficiencia` es verdadero con que uno tenga deficiencia.
