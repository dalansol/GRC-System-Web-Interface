# Pruebas de la evaluación de controles

Historia #98, SF-07. Corridas el 2 de noviembre de 2026 en la rama `Andre`, sobre `master` en `3fccc67`.

## Resultado

| Tipo | Archivo | Pruebas | Contra qué | Resultado |
|---|---|---|---|---|
| Reglas | `backend/test/evaluacionesDominio.test.ts` | 20 | Funciones puras | Aprobadas |
| API | `backend/test/evaluaciones.test.ts` | 26 | Repositorio en memoria | Aprobadas |
| Base de datos | `backend/test/evaluaciones.integracion.test.ts` | 9 | PostgreSQL local (`expedite_test`) | Aprobadas |
| Vista | `src/app/components/EvaluacionControl.test.tsx` | 11 | API simulada | Aprobadas |
| Formulario de hallazgos | `src/app/components/FormularioHallazgo.test.tsx` | 5 | Componente | Aprobadas |
| Lista de controles | `src/app/api/controles.test.ts` | 1 | API simulada | Aprobada |
| Punta a punta | Manual con Playwright | 1 recorrido | Navegador, backend y PostgreSQL local | Aprobado |

## Casos por criterio de aceptación

### Criterio 1: cálculo automático de la calificación y el estatus

| ID | Dado | Cuando | Entonces |
|---|---|---|---|
| EV-01 | Auditora asignada, con declaración | Responde diseño 5 y efectividad 4 | Calificación 4, Efectivo, sin deficiencia; queda quién evaluó y el evento en bitácora |
| EV-02 | Respuestas de 3 | Guarda | Calificación 3, Parcialmente efectivo |
| EV-03 | Respuestas de 1 y el cliente envía `calificacion: 5` | Guarda | Se ignora: calificación 1 |
| EV-04 | Evaluación guardada | Vuelve a guardar | Se reemplaza; siguen 8 respuestas y una sola evaluación |
| EV-05 | Evaluación guardada | La Jefa de Auditoría la consulta | La ve, sin poder evaluar |

### Criterio 2: bloqueo al faltar un criterio obligatorio

| ID | Dado | Cuando | Entonces |
|---|---|---|---|
| EV-06 | Falta un criterio | Guarda por la API | 400 `CRITERIOS_FALTANTES` con el nombre del criterio; no guarda ni registra evento |
| EV-07 | Falta un criterio | Guarda en la vista | No llama a la API, marca el criterio en rojo y muestra "Este criterio es obligatorio." |
| EV-08 | Criterio marcado en rojo | Lo responde | Desaparece la marca |
| EV-09 | Valor 0, 6, 2.5 o texto | Guarda | 400 con el mensaje de la escala |
| EV-10 | Falla al guardar una respuesta | Se revierte la transacción | No queda una evaluación a medias |

### Criterio 3: marca de deficiencia con nivel de madurez bajo

| ID | Dado | Cuando | Entonces |
|---|---|---|---|
| EV-11 | Diseño 5 y efectividad 2 | Guarda | Calificación 2, Deficiente, con deficiencia |
| EV-12 | Respuestas de 3 | Guarda | Sin deficiencia (el límite no cuenta como bajo) |
| EV-13 | Control con deficiencia | Sube la calificación | Se quita la marca, también en la lista de controles |
| EV-14 | Control con deficiencia | Abre el detalle | Aviso y botón "Generar hallazgo" |
| EV-15 | Control sin deficiencia | Abre el detalle | No hay botón |
| EV-16 | Control con deficiencia | Presiona "Generar hallazgo" | Abre el formulario con el control elegido y riesgo residual calculado con vulnerabilidad alta |

### Acceso

| ID | Dado | Cuando | Entonces |
|---|---|---|---|
| EV-17 | Sin sesión | Consulta | 401 |
| EV-18 | Jefa, Administradora, Auditor Senior sin el control, Solo Lectura | Intenta guardar | 403 |
| EV-19 | Solo Lectura | Consulta | 403 |
| EV-20 | Auditora sin declaración de conflictos | Guarda | 403 `DECLARACION_PENDIENTE`; la vista explica el motivo y bloquea |
| EV-21 | Control `En Revision` o `Completado` | Guarda | 409 `EVALUACION_CERRADA` |
| EV-22 | Control que no está en el plan | Consulta | 404 |

## Defectos encontrados

| ID | Severidad | Defecto | Estado |
|---|---|---|---|
| DEF-EV-01 | Alta | Un control Deficiente que también estaba en la lista de prueba del formulario calculaba riesgo residual Bajo, porque conservaba su vulnerabilidad de la lista. Se vio en la prueba punta a punta | Corregido (`controlesConDeficiencia`) |

## Cómo correrlas

```bash
cd backend && corepack pnpm test   # sin SQL_TEST_* se omiten las de base de datos
npm test                           # frontend, desde la raíz
```

Las de base de datos necesitan las variables `SQL_TEST_*` apuntando a `expedite_test`, nunca a
`expedite` ni a Supabase.

## No probado

- La migración sobre la base compartida de Supabase.
- El inicio de sesión real con Microsoft: se usó el modo de desarrollo.
- Registrar el hallazgo hasta el final desde el botón: el recorrido llegó al formulario precargado.
