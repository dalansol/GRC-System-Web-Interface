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

## Contrato con el backend (pendiente de implementar en `backend/src/routes/evidencias.ts`)

| Método | Ruta | Cuerpo | Respuesta |
|---|---|---|---|
| GET | `/api/evidencias/:id/archivo` | — | Binario del `.xlsx` vigente |
| POST | `/api/evidencias/:id/versiones` | multipart: `file`, `comentario` | `{ version, file_hash, created_at, uploaded_by, comentario }` |
| GET | `/api/evidencias/:id/versiones` | — | Lista de lo anterior |

- Ambas rutas detrás de `autenticar`. Guardar valida el mismo permiso que subir evidencia (en controles, el Auditor asignado; en hallazgos, TBD #19).
- Guardar **no sobrescribe**: crea una versión nueva, recalcula el SHA-256 en el servidor, la guarda en el almacenamiento (R2) y registra `evidencia.version` en la bitácora (SF-15/SF-18).
- El hash que se muestra al descargar una copia se calcula en el navegador solo como referencia; el oficial es el del backend.

### Mientras el backend no exista

Si `GET …/archivo` falla (404, sin conexión o archivo no válido), el editor abre un **libro de ejemplo** con un aviso visible; "Guardar" se convierte en "Descargar copia". Lo mismo pasa con los documentos de auditoría mock de `App.tsx`, que no tienen id de evidencia.

## Permisos

`EvidenciasSection` abre el editor en **solo lectura** cuando el usuario no puede subir evidencia (`puedeSubirEvidencia`): se puede navegar, seleccionar, copiar y descargar, pero no editar ni guardar. El botón dice "Ver en Expedite".

## Decisiones pendientes

- Rutas del backend y evento de bitácora (contrato arriba).
- Quién puede editar una evidencia de hallazgo: TBD #19 de CLAUDE.md.
- Restaurar una versión anterior desde el historial: requiere una ruta de descarga por versión.
