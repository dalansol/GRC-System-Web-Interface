# Edición de Excel en la plataforma (UF-17, SF-08)

Historia: "Edición de Excel en la plataforma", parte de frontend. Módulo: Documentos y evidencia.

## Objetivo

Que el auditor abra una evidencia `.xlsx` dentro de Expedite y la edite con la misma sensación que en Excel: cinta de opciones, cuadro de nombres, barra de fórmulas, selección de rangos, fórmulas, copiar y pegar compatible con Excel, deshacer, controlador de relleno y barra de estado. Al guardar se crea una **versión nueva** de la evidencia con su propio hash de integridad.

## Arquitectura (MVVM)

| Capa | Ubicación | Responsabilidad |
|---|---|---|
| Dominio puro | `src/app/domain/hoja/` | Modelo del libro, fórmulas, formato, portapapeles, operaciones inmutables, lectura/escritura `.xlsx` |
| ViewModel | `domain/hoja/estadoHoja.ts` (reducer) y `useHojaCalculo.ts` | Selección, edición, modo Señalar, deshacer/rehacer (100 pasos), recálculo |
| Vista | `src/app/components/hoja/` | Cuadrícula virtualizada, cinta, barra de fórmulas, pestañas, barra de estado, menú contextual |
| API | `src/app/api/evidencias.ts` | Descargar el archivo, guardar versión, listar versiones |
| Backend | `backend/src/routes/evidencias.ts`, `backend/sql/048_versiones_evidencia.sql` | Entregar el archivo vigente, guardar versiones con hash en servidor, historial |

`components/SpreadsheetEditor.tsx` quedó como punto de entrada (lo usan `EvidenciasSection` y `App.tsx`).

### Modelo

- `Libro { hojas }`; `Hoja` dispersa: solo guarda celdas con contenido o formato (`"fila,columna"`), anchos, altos y paneles inmovilizados.
- `Celda { entrada, estilo? }`: `entrada` es lo que se tecleó (`"1,500.25"`, `"=SUMA(A1:A3)"`). El valor se calcula al mostrarla.
- Operaciones inmutables: cada cambio produce un libro nuevo; deshacer guarda referencias a libros anteriores.

### Fórmulas

- Tokenizador + parser descendente con la precedencia de Excel (`-2^2 = 4`), `%`, `&`, comparaciones, referencias `A1`, `$A$1`, rangos y otras hojas (`Hoja2!A1`, `'Mi hoja'!A1`).
- Funciones en español o inglés: SUMA, PROMEDIO, MIN, MAX, PRODUCTO, CONTAR, CONTARA, CONTAR.BLANCO, CONTAR.SI, SUMAR.SI, SI, SI.ERROR, Y, O, NO, REDONDEAR(.MAS/.MENOS), ABS, HOY, CONCATENAR/CONCAT, LARGO, MAYUSC, MINUSC, ESPACIOS. Separador `,` o `;`.
- Errores de Excel: `#¡DIV/0!`, `#¡REF!`, `#¿NOMBRE?`, `#¡VALOR!`, `#¡NUM!`; referencias circulares se marcan en la barra de estado.
- En pantalla se ven en español; en el `.xlsx` se guardan en inglés con su resultado calculado, para que Excel las abra sin recalcular.
- Al confirmar se normaliza como Excel (`=suma(a1:a3` → `=SUMA(A1:A3)`).
- Copiar, rellenar, insertar/eliminar filas o columnas y renombrar hojas reescriben las referencias.

### Interacción tipo Excel

- Teclado: escribir reemplaza, F2 edita, Enter/Tab (y con Mayús), flechas, Ctrl+flechas al borde de los datos, Mayús para extender, Inicio/Ctrl+Inicio/Ctrl+Fin, RePág/AvPág, Supr, Retroceso, Esc, Ctrl+Z/Y, Ctrl+B/I/U (también Ctrl+N/K), Ctrl+C/X/V, Ctrl+A, Ctrl+D/R, Ctrl+Enter (llenar rango), Alt+Enter (salto de línea), Alt+= (Autosuma), Ctrl+; (fecha de hoy), Ctrl+Espacio / Mayús+Espacio, Mayús+F11 (hoja nueva), Ctrl+S/G (guardar). En macOS, Cmd equivale a Ctrl.
- Modo **Señalar**: al escribir una fórmula, flechas o ratón insertan referencias (también en otra hoja); las referencias se colorean en la cuadrícula.
- Ratón: arrastrar para seleccionar, Mayús+clic, encabezados de fila/columna, esquina para todo, doble clic para editar, controlador de relleno (copia o continúa series), arrastrar bordes de encabezado para redimensionar y doble clic para autoajustar, clic derecho para el menú contextual.
- Portapapeles: se escribe TSV y tabla HTML, así que se pega en Excel o Google Sheets y viceversa. Dentro de Expedite se conservan fórmulas (desplazadas) y formato.
- La cuadrícula está virtualizada (solo pinta lo visible) y crece al desplazarse, hasta los límites de Excel (1 048 576 × 16 384). Operaciones sobre filas o columnas completas se acotan a la zona con datos.

### Ayudas al usuario

- **Autocompletado de fórmulas** (`domain/hoja/funciones.ts`, `components/hoja/AutocompletadoFormula.tsx`): al escribir `=` y letras aparece la lista de funciones que coinciden (español o inglés) con su descripción; Tab o Enter la insertan con el paréntesis. Dentro de una función se muestra la firma con el argumento actual resaltado.
- **Buscar** (`domain/hoja/buscar.ts`, `components/hoja/BarraBuscar.tsx`): Ctrl+F o Inicio › Buscar. Compara con lo que se ve y con lo escrito (encuentra fórmulas por su texto), sin mayúsculas ni acentos, empezando por la hoja activa. Enter / Mayús+Enter recorren; las coincidencias se resaltan en ámbar.
- **Atajos de teclado**: botón en la barra de estado (`AyudaAtajos.tsx`).
- **Cuadrícula**: los encabezados se resaltan al pasar el ratón; al redimensionar se ve el ancho o alto en píxeles; las celdas con error muestran una explicación al pasar el ratón; doble clic en el cuadro de relleno rellena hasta donde llegan los datos de la columna vecina.
- Seleccionar una fila o columna completa (o todo) no desplaza la vista: la selección llega al límite de Excel pero la cuadrícula se queda donde está el usuario.
- Un error inesperado del editor se contiene en una barrera (`BarreraEditor`) con la opción de cerrar, sin dejar en blanco la plataforma.

### Lectura y escritura `.xlsx`

`exceljs` se carga bajo demanda (chunk aparte, no infla la carga inicial). Se conservan valores, fórmulas, negrita/cursiva/subrayado, alineación, relleno, color de fuente, bordes, formatos numéricos (número, moneda, porcentaje, fecha, texto), anchos, altos y paneles inmovilizados.

**No se conserva** (se avisa al abrir, no se descarta en silencio): celdas combinadas, imágenes, validaciones de datos, formato condicional, fórmulas de matriz (se convierten en valor). Gráficos, tablas dinámicas y macros tampoco se conservan; `exceljs` no los lee.

### Macros (.xlsm)

Un libro con macros es un `.xlsx` que además trae `xl/vbaProject.bin` dentro del ZIP. Se acepta como evidencia (`upload.ts` y `ck_evidence_mime_type`, 034) y el editor lo abre igual que un `.xlsx`: `contieneMacros` busca esa entrada en los bytes del archivo y `leerXlsx` añade el aviso "El archivo contiene macros, que no son compatibles…" mostrando el resto del contenido. Al guardar, la versión nueva sale siempre como `.xlsx` (el nombre cambia de extensión y `mime_type` pasa a `xlsx`); el backend también rechaza cualquier otra cosa que no sea un `.xlsx`.

## Rutas del backend (`backend/src/routes/evidencias.ts`, solo con `DATA_MODE=sql`)

| Método | Ruta | Cuerpo | Respuesta |
|---|---|---|---|
| GET | `/api/evidencias/:id/archivo` | — | Binario del libro vigente (`Content-Type` de xlsx, cabecera `X-Evidencia-Version`); 415 si la evidencia no es un libro |
| POST | `/api/evidencias/:id/versiones` | multipart: `file` (`.xlsx`), `comentario` (hasta 500) | 201 `{ version, file_hash, file_size, created_at, uploaded_by (nombre), comentario }` |
| GET | `/api/evidencias/:id/versiones` | — | Historial de la más nueva a la más vieja; antes del primer guardado solo el original (versión 1) |

- Las tres detrás de `autenticar`. Ver el archivo o el historial sigue la regla del listado (quien la subió; en controles también el Auditor Senior que asignó el control y la Jefatura dueña del plan); quien no puede verla recibe 404. Guardar sigue la regla de subir y eliminar: en controles el Auditor asignado, en hallazgos quien la subió (TBD #19); si no, 403.
- Guardar **no sobrescribe**: dentro de una transacción (`SELECT … FOR UPDATE` para que dos guardados simultáneos no repitan versión) el original pasa a `evidence_versions` como versión 1 si el historial estaba vacío, se guarda el archivo nuevo con la clave `EV-…-vN.xlsx` en el almacenamiento (R2 o local), se inserta la versión N con el SHA-256 calculado en el servidor y la fila de `evidence` pasa a reflejarla (`version`, `file_hash`, `file_size`, `storage_path`, `file_name`). Si algo falla se deshace y se borra el archivo.
- El archivo recibido debe empezar por `PK` (un libro es un ZIP) y llamarse `.xlsx`; si no, 400.
- Al eliminar una evidencia se borran también los archivos de todas sus versiones (`ON DELETE CASCADE` en la tabla).
- El hash que se muestra al descargar una copia se calcula en el navegador solo como referencia; el oficial es el del backend.

### Sin backend o en modo memoria

Si `GET …/archivo` falla (404, sin conexión o archivo no válido), el editor abre un **libro de ejemplo** con un aviso visible; "Guardar" se convierte en "Descargar copia". Lo mismo pasa con los documentos de auditoría mock de `App.tsx`, que no tienen id de evidencia, y con `DATA_MODE=memoria`, donde las rutas de evidencias no existen.

## Permisos

`EvidenciasSection` abre el editor en **solo lectura** cuando el usuario no puede subir evidencia (`puedeSubirEvidencia`): se puede navegar, seleccionar, copiar y descargar, pero no editar ni guardar. El botón dice "Ver en Expedite". El backend repite la comprobación al guardar.

## Decisiones pendientes

- Evento `evidencia.version` en la bitácora (SF-15/SF-18): `rutasEvidencias` todavía no recibe `registrarEvento`.
- Quién puede editar una evidencia de hallazgo: TBD #19 de CLAUDE.md.
- Restaurar una versión anterior desde el historial: requiere una ruta de descarga por versión.
