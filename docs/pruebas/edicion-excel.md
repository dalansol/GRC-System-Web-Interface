# Pruebas: edición de Excel en la plataforma (UF-17, SF-08)

## Automáticas (`npm test`)

| Archivo | Qué cubre |
|---|---|
| `src/app/domain/hoja/formulas.test.ts` | Referencias (columnas > Z, `$`, rangos), interpretación de lo tecleado (miles, moneda, %, fechas, apóstrofo), precedencia, funciones en español/inglés, errores, ciclos, otras hojas |
| `src/app/domain/hoja/operaciones.test.ts` | Desplazar y traducir fórmulas, insertar/eliminar filas, pegar bloques, relleno, renombrar hojas, ordenar, Ctrl+flecha, TSV, formato es-MX |
| `src/app/domain/hoja/xlsx.test.ts` | Ida y vuelta `.xlsx` (valores, fórmulas, estilos, fechas, paneles, anchos, celdas combinadas), fórmula guardada en inglés con resultado, avisos, formatos numéricos, libro con macros (aviso y resto del contenido) |
| `src/app/domain/hoja/combinadas.test.ts` | Combinar (y centrar, horizontalmente, celdas) conserva solo la celda superior izquierda, separar, Borrar todo separa, la selección abarca la combinación y las flechas/Enter la saltan, reubicación al insertar o eliminar filas y columnas |
| `src/app/domain/hoja/estadoHoja.test.ts` | Enter/Escape, deshacer/rehacer, modo Señalar (también en otra hoja), Ctrl+Enter, recorrido dentro del rango, solo lectura |
| `src/app/domain/hoja/funciones.test.ts` | Sugerencias de funciones por prefijo, firma y argumento actual, búsqueda en el libro sin acentos y por hojas |
| `src/app/components/hoja/EditorHojaCalculo.test.tsx` | Flujo en la interfaz: escribir y recalcular, Combinar y centrar desde la cinta (aviso de pérdida de datos, salto con flechas, Separar celdas desde el menú), Ctrl+Z, barra de estado, señalar con flechas, solo lectura, abrir el archivo del servidor y guardar con Ctrl+S, respaldo de ejemplo, diálogo de cambios sin guardar, autocompletado con Tab, Ctrl+F y recorrido de coincidencias |

## Backend (`corepack pnpm test`, requiere `SQL_TEST_*`)

| Archivo | Qué cubre |
|---|---|
| `backend/test/evidenciasVersiones.integracion.test.ts` | `GET …/archivo` entrega el binario vigente solo a quien puede ver la evidencia (401/404/415), guardar crea la versión 2 con hash del servidor sin tocar el original y actualiza la evidencia, numeración 2 y 3, historial con el original, 403 sin permiso, 400 si no es `.xlsx`, `.xlsm` se abre y la versión guardada queda como `.xlsx` |
| `backend/test/esquema.integracion.test.ts` | La tabla `evidence_versions` existe, con RLS y sin políticas |

Sin PostgreSQL de pruebas esas pruebas se omiten; corre `corepack pnpm typecheck` al menos.

## Manuales

Con `npm run dev` y el backend con `DATA_MODE=sql` (tras `corepack pnpm db:migrar`, que aplica 048), abrir un control con una evidencia `.xlsx` y pulsar "Editar en Expedite".

1. **Apertura**: se ven las hojas, valores, fórmulas y formato del archivo real. Si el archivo no está disponible (o en modo memoria), aparece el aviso amarillo y el libro de ejemplo.
2. **Escritura**: teclear en una celda reemplaza; F2 o doble clic edita; Enter baja, Tab va a la derecha, Esc cancela.
3. **Fórmulas**: `=SUMA(` y luego arrastrar un rango con el ratón inserta la referencia; Enter calcula. Cambiar un valor recalcula.
4. **Excel → Expedite**: copiar un rango en Excel y pegarlo con Ctrl+V; los números se reconocen.
5. **Expedite → Excel**: copiar un rango y pegarlo en Excel; queda en celdas separadas.
6. **Relleno**: escribir 1 y 2, seleccionarlos y arrastrar el cuadro verde; continúa 3, 4, 5…
7. **Columnas**: arrastrar el borde de un encabezado cambia el ancho; doble clic lo autoajusta.
8. **Vista**: Vista → Inmovilizar fila superior y desplazarse; la fila 1 se queda fija.
9. **Deshacer**: Ctrl+Z y Ctrl+Y sobre los pasos anteriores.
10. **Guardar**: Ctrl+S crea una versión nueva: el aviso muestra "Versión 2 guardada" con su hash, la lista de evidencias cambia de hash y versión, y en Historial aparecen la 1 (original) y la 2. Volver a abrir muestra los cambios. Descargar una copia y abrirla en Excel: valores, fórmulas y formato se conservan y las fórmulas recalculan.
11. **Solo lectura**: con un usuario que no puede subir evidencia el botón dice "Ver en Expedite" y no se puede editar.
12. **Columna completa**: clic en el encabezado de una columna o fila; la vista no debe moverse.
13. **Fórmulas asistidas**: escribir `=pro` muestra PROMEDIO y PRODUCTO; Tab inserta `=PROMEDIO(` y aparece la firma con el argumento resaltado.
14. **Buscar**: Ctrl+F, escribir "cobro", Enter recorre las coincidencias resaltadas; Esc cierra.
15. **Relleno rápido**: con datos en la columna vecina, doble clic en el cuadro de relleno llena hasta la última fila con datos.
16. **Cerrar con cambios**: aparece "¿Desea guardar los cambios…?"; recargar la página muestra el aviso del navegador.
17. **Macros**: subir un `.xlsm` con una macro como evidencia (se acepta) y abrirlo: aparece el aviso "El archivo contiene macros, que no son compatibles…" y se ven las hojas y fórmulas. Guardar crea la versión como `.xlsx`; al abrirla en Excel no tiene macros.
18. **Combinar celdas**: escribir "Título" en A2 y algo en B2, seleccionar A2:C2 e Inicio › Combinar y centrar: aparece el aviso de que solo se conserva A2, el texto queda centrado en una celda ancha y las flechas la saltan. Con la flecha del botón, "Combinar horizontalmente" sobre A3:C4 crea dos combinaciones (una por fila) y "Separar celdas" las deshace. Insertar una columna en B parte la combinación más ancha; eliminarla la recorta. Guardar, descargar la copia y abrirla en Excel: las celdas siguen combinadas.
19. **Permisos en servidor**: con un usuario que no es el auditor asignado al control, pedir `POST /api/evidencias/:id/versiones` responde 403 y la versión no cambia.
