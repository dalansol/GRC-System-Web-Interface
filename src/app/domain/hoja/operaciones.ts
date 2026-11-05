import { Calculadora, esFormula, interpretarEntrada } from "./calculo";
import { ajustarPorEstructura, desplazarFormula, renombrarHojaEnFormula, type CambioEstructura } from "./reescritura";
import { serieRelleno } from "./relleno";
import { prefijoHoja } from "./tokens";
import {
  claveCelda,
  ErrorHoja,
  hojaVacia,
  type Celda,
  type EstiloCelda,
  type Hoja,
  type Libro,
  type Rango,
  type ValorCelda,
} from "./tipos";

// Operaciones inmutables sobre el libro: cada una devuelve un libro nuevo, lo que
// permite deshacer/rehacer guardando referencias a libros anteriores.

function conHoja(libro: Libro, idx: number, fn: (h: Hoja) => Hoja): Libro {
  return { hojas: libro.hojas.map((h, i) => (i === idx ? fn(h) : h)) };
}

function ponerCelda(celdas: Record<string, Celda>, f: number, c: number, celda: Celda | undefined): void {
  const k = claveCelda(f, c);
  if (!celda || (celda.entrada === "" && !celda.estilo)) delete celdas[k];
  else celdas[k] = celda;
}

/** Hace crecer la hoja si se escribe más allá de sus límites (sensación de hoja infinita). */
function asegurarTamano(h: Hoja, f: number, c: number): Hoja {
  if (f < h.filas && c < h.columnas) return h;
  return { ...h, filas: Math.max(h.filas, f + 1), columnas: Math.max(h.columnas, c + 1) };
}

/** Escribe lo tecleado; si es un valor reconocible aplica el formato que Excel sugeriría. */
export function escribir(libro: Libro, idx: number, f: number, c: number, entrada: string): Libro {
  return conHoja(libro, idx, (h) => {
    const celdas = { ...h.celdas };
    const previa = celdas[claveCelda(f, c)];
    let estilo = previa?.estilo;
    if (!esFormula(entrada) && !estilo?.formato) {
      const sugerido = interpretarEntrada(entrada).sugerido;
      if (sugerido) estilo = { ...estilo, ...sugerido };
    }
    ponerCelda(celdas, f, c, { entrada, estilo });
    return asegurarTamano({ ...h, celdas }, f, c);
  });
}

export function limpiarRango(libro: Libro, idx: number, r: Rango, tambienFormato = false): Libro {
  return conHoja(libro, idx, (h) => {
    const celdas = { ...h.celdas };
    for (const k of Object.keys(celdas)) {
      const [f, c] = k.split(",").map(Number);
      if (f < r.f1 || f > r.f2 || c < r.c1 || c > r.c2) continue;
      if (tambienFormato) delete celdas[k];
      else ponerCelda(celdas, f, c, { ...celdas[k], entrada: "" });
    }
    return { ...h, celdas };
  });
}

export function aplicarEstilo(libro: Libro, idx: number, r: Rango, cambio: (e: EstiloCelda) => EstiloCelda): Libro {
  return conHoja(libro, idx, (h) => {
    const celdas = { ...h.celdas };
    for (let f = r.f1; f <= r.f2; f++) {
      for (let c = r.c1; c <= r.c2; c++) {
        const previa = celdas[claveCelda(f, c)];
        const estilo = limpiarEstilo(cambio({ ...previa?.estilo }));
        ponerCelda(celdas, f, c, { entrada: previa?.entrada ?? "", estilo });
      }
    }
    return { ...h, celdas };
  });
}

function limpiarEstilo(e: EstiloCelda): EstiloCelda | undefined {
  const limpio = Object.fromEntries(Object.entries(e).filter(([, v]) => v !== undefined && v !== false)) as EstiloCelda;
  return Object.keys(limpio).length ? limpio : undefined;
}

/** Bloque copiado: entradas y estilos relativos a la esquina superior izquierda. */
export interface Bloque {
  celdas: (Celda | undefined)[][];
  /** Posición de origen para desplazar fórmulas al pegar. */
  origen: { f: number; c: number };
}

export function copiarBloque(hoja: Hoja, r: Rango): Bloque {
  const celdas: (Celda | undefined)[][] = [];
  for (let f = r.f1; f <= r.f2; f++) {
    const fila: (Celda | undefined)[] = [];
    for (let c = r.c1; c <= r.c2; c++) fila.push(hoja.celdas[claveCelda(f, c)]);
    celdas.push(fila);
  }
  return { celdas, origen: { f: r.f1, c: r.c1 } };
}

/**
 * Pega un bloque en (f, c). Si el destino seleccionado es múltiplo del bloque, lo repite
 * como Excel. Devuelve el libro y el rango pegado.
 */
export function pegarBloque(libro: Libro, idx: number, destino: Rango, bloque: Bloque): { libro: Libro; rango: Rango } {
  const alto = bloque.celdas.length;
  const ancho = bloque.celdas[0]?.length ?? 0;
  const selAlto = destino.f2 - destino.f1 + 1;
  const selAncho = destino.c2 - destino.c1 + 1;
  const repF = selAlto % alto === 0 ? selAlto / alto : 1;
  const repC = selAncho % ancho === 0 ? selAncho / ancho : 1;
  const rango: Rango = { f1: destino.f1, c1: destino.c1, f2: destino.f1 + alto * repF - 1, c2: destino.c1 + ancho * repC - 1 };

  const nuevo = conHoja(libro, idx, (h) => {
    const celdas = { ...h.celdas };
    for (let f = rango.f1; f <= rango.f2; f++) {
      for (let c = rango.c1; c <= rango.c2; c++) {
        const fuente = bloque.celdas[(f - rango.f1) % alto][(c - rango.c1) % ancho];
        const fOrigen = bloque.origen.f + ((f - rango.f1) % alto);
        const cOrigen = bloque.origen.c + ((c - rango.c1) % ancho);
        const entrada = fuente?.entrada ? desplazarFormula(fuente.entrada, f - fOrigen, c - cOrigen) : "";
        ponerCelda(celdas, f, c, fuente ? { entrada, estilo: fuente.estilo } : undefined);
      }
    }
    return asegurarTamano({ ...h, celdas }, rango.f2, rango.c2);
  });
  return { libro: nuevo, rango };
}

/** Pega texto plano (TSV de Excel u otra app): solo valores, sin desplazar nada. */
export function pegarTexto(libro: Libro, idx: number, f: number, c: number, matriz: string[][]): { libro: Libro; rango: Rango } {
  let actual = libro;
  matriz.forEach((fila, i) => fila.forEach((v, j) => (actual = escribir(actual, idx, f + i, c + j, v))));
  const ancho = Math.max(1, ...matriz.map((fila) => fila.length));
  return { libro: actual, rango: { f1: f, c1: c, f2: f + matriz.length - 1, c2: c + ancho - 1 } };
}

/**
 * Controlador de relleno: extiende `origen` hasta cubrir `destino` (que lo contiene).
 * Números en progresión continúan la serie; lo demás se copia y las fórmulas se desplazan.
 */
export function rellenar(libro: Libro, idx: number, origen: Rango, destino: Rango): Libro {
  const hoja = libro.hojas[idx];
  const vertical = destino.f1 !== origen.f1 || destino.f2 !== origen.f2;
  let celdas = { ...hoja.celdas };

  const lineas = vertical ? [origen.c1, origen.c2] : [origen.f1, origen.f2];
  for (let linea = lineas[0]; linea <= lineas[1]; linea++) {
    const pos = (k: number) => (vertical ? { f: k, c: linea } : { f: linea, c: k });
    const desde = vertical ? origen.f1 : origen.c1;
    const hasta = vertical ? origen.f2 : origen.c2;
    const fuente: (Celda | undefined)[] = [];
    for (let k = desde; k <= hasta; k++) {
      const p = pos(k);
      fuente.push(celdas[claveCelda(p.f, p.c)]);
    }
    const n = fuente.length;
    const tramos: { inicio: number; fin: number; dir: 1 | -1 }[] = [];
    const dInicio = vertical ? destino.f1 : destino.c1;
    const dFin = vertical ? destino.f2 : destino.c2;
    if (dFin > hasta) tramos.push({ inicio: hasta + 1, fin: dFin, dir: 1 });
    if (dInicio < desde) tramos.push({ inicio: desde - 1, fin: dInicio, dir: -1 });

    for (const { inicio, fin, dir } of tramos) {
      const cantidad = Math.abs(fin - inicio) + 1;
      const serie = serieRelleno(fuente.map((x) => x?.entrada ?? ""), cantidad, dir);
      for (let k = 0; k < cantidad; k++) {
        const destinoK = inicio + k * dir;
        const p = pos(destinoK);
        const iFuente = dir === 1 ? k % n : n - 1 - (k % n);
        const base = fuente[iFuente];
        const desplazamiento = destinoK - (desde + iFuente);
        const entrada = serie
          ? serie[k]
          : base?.entrada
            ? desplazarFormula(base.entrada, vertical ? desplazamiento : 0, vertical ? 0 : desplazamiento)
            : "";
        celdas = { ...celdas };
        ponerCelda(celdas, p.f, p.c, base || entrada ? { entrada, estilo: base?.estilo } : undefined);
      }
    }
  }
  return conHoja(libro, idx, (h) => asegurarTamano({ ...h, celdas }, destino.f2, destino.c2));
}

// ─── Filas y columnas ────────────────────────────────────────────────────────

function reescribirFormulas(libro: Libro, cambio: CambioEstructura): Libro {
  return {
    hojas: libro.hojas.map((h) => {
      let cambiada = false;
      const celdas = { ...h.celdas };
      for (const [k, celda] of Object.entries(celdas)) {
        if (!esFormula(celda.entrada)) continue;
        const entrada = ajustarPorEstructura(celda.entrada, h.nombre, cambio);
        if (entrada !== celda.entrada) {
          celdas[k] = { ...celda, entrada };
          cambiada = true;
        }
      }
      return cambiada ? { ...h, celdas } : h;
    }),
  };
}

function moverIndices<T>(mapa: Record<number, T>, en: number, cantidad: number): Record<number, T> {
  const nuevo: Record<number, T> = {};
  for (const [k, v] of Object.entries(mapa)) {
    const i = Number(k);
    if (i < en) nuevo[i] = v;
    else if (cantidad > 0) nuevo[i + cantidad] = v;
    else if (i >= en - cantidad) nuevo[i + cantidad] = v;
  }
  return nuevo;
}

export function cambiarEstructura(libro: Libro, idx: number, eje: "fila" | "columna", en: number, cantidad: number): Libro {
  const hoja = libro.hojas[idx];
  const cambio: CambioEstructura = { hoja: hoja.nombre, eje, en, cantidad };
  const conFormulas = reescribirFormulas(libro, cambio);
  return conHoja(conFormulas, idx, (h) => {
    const celdas: Record<string, Celda> = {};
    for (const [k, celda] of Object.entries(h.celdas)) {
      const [f, c] = k.split(",").map(Number);
      const i = eje === "fila" ? f : c;
      let ni = i;
      if (i >= en) {
        if (cantidad < 0 && i < en - cantidad) continue;
        ni = i + cantidad;
      }
      celdas[eje === "fila" ? claveCelda(ni, c) : claveCelda(f, ni)] = celda;
    }
    const total = eje === "fila" ? h.filas : h.columnas;
    const nuevoTotal = Math.max(1, total + cantidad);
    return eje === "fila"
      ? { ...h, celdas, filas: nuevoTotal, altos: moverIndices(h.altos, en, cantidad) }
      : { ...h, celdas, columnas: nuevoTotal, anchos: moverIndices(h.anchos, en, cantidad) };
  });
}

export function cambiarTamano(libro: Libro, idx: number, eje: "fila" | "columna", indices: number[], px: number): Libro {
  return conHoja(libro, idx, (h) => {
    const mapa = { ...(eje === "fila" ? h.altos : h.anchos) };
    for (const i of indices) mapa[i] = Math.max(eje === "fila" ? 8 : 12, Math.round(px));
    return eje === "fila" ? { ...h, altos: mapa } : { ...h, anchos: mapa };
  });
}

export function inmovilizar(libro: Libro, idx: number, filas: number, columnas: number): Libro {
  return conHoja(libro, idx, (h) => ({ ...h, inmovilizar: { filas, columnas } }));
}

// ─── Hojas ───────────────────────────────────────────────────────────────────

export function nombreHojaLibre(libro: Libro, base = "Hoja"): string {
  const usados = new Set(libro.hojas.map((h) => h.nombre.toLowerCase()));
  let n = libro.hojas.length + 1;
  while (usados.has(`${base}${n}`.toLowerCase())) n++;
  return `${base}${n}`;
}

export function agregarHoja(libro: Libro, despuesDe: number): Libro {
  const hojas = [...libro.hojas];
  hojas.splice(despuesDe + 1, 0, hojaVacia(nombreHojaLibre(libro)));
  return { hojas };
}

/** Error de validación del nombre, o null si es válido (mismas reglas que Excel). */
export function validarNombreHoja(libro: Libro, idx: number, nombre: string): string | null {
  const limpio = nombre.trim();
  if (!limpio) return "El nombre de la hoja no puede quedar vacío.";
  if (limpio.length > 31) return "El nombre de la hoja no puede tener más de 31 caracteres.";
  if (/[\\/?*[\]:]/.test(limpio)) return "El nombre no puede contener \\ / ? * [ ] :";
  if (limpio.startsWith("'") || limpio.endsWith("'")) return "El nombre no puede empezar ni terminar con apóstrofo.";
  if (libro.hojas.some((h, i) => i !== idx && h.nombre.toLowerCase() === limpio.toLowerCase())) {
    return "Ya existe una hoja con ese nombre.";
  }
  return null;
}

export function renombrarHoja(libro: Libro, idx: number, nombre: string): Libro {
  const anterior = libro.hojas[idx].nombre;
  const nuevo = nombre.trim();
  const pref = prefijoHoja(nuevo);
  return {
    hojas: libro.hojas.map((h, i) => {
      const celdas = { ...h.celdas };
      for (const [k, celda] of Object.entries(celdas)) {
        if (esFormula(celda.entrada)) celdas[k] = { ...celda, entrada: renombrarHojaEnFormula(celda.entrada, anterior, nuevo, pref) };
      }
      return { ...h, celdas, nombre: i === idx ? nuevo : h.nombre };
    }),
  };
}

export function eliminarHoja(libro: Libro, idx: number): Libro {
  if (libro.hojas.length <= 1) return libro;
  return { hojas: libro.hojas.filter((_, i) => i !== idx) };
}

export function moverHoja(libro: Libro, desde: number, hasta: number): Libro {
  const hojas = [...libro.hojas];
  const [h] = hojas.splice(desde, 1);
  hojas.splice(hasta, 0, h);
  return { hojas };
}

// ─── Datos ───────────────────────────────────────────────────────────────────

function claveOrden(v: ValorCelda): [number, number | string] {
  if (v === null || v === "") return [4, 0];
  if (typeof v === "number") return [0, v];
  if (typeof v === "string") return [1, v.toLocaleLowerCase("es")];
  if (typeof v === "boolean") return [2, v ? 1 : 0];
  return [3, (v as ErrorHoja).codigo];
}

/**
 * Ordena las filas del rango por la columna `columna`. Como en Excel, los vacíos van
 * siempre al final y las fórmulas se mueven con su fila (con referencias desplazadas).
 */
export function ordenarRango(libro: Libro, idx: number, r: Rango, columna: number, ascendente: boolean): Libro {
  const calc = new Calculadora(libro);
  const hoja = libro.hojas[idx];
  const filas: { f: number; clave: [number, number | string] }[] = [];
  for (let f = r.f1; f <= r.f2; f++) filas.push({ f, clave: claveOrden(calc.valor(idx, f, columna)) });
  filas.sort((a, b) => {
    if (a.clave[0] === 4 || b.clave[0] === 4) return a.clave[0] - b.clave[0];
    const signo = ascendente ? 1 : -1;
    if (a.clave[0] !== b.clave[0]) return (a.clave[0] - b.clave[0]) * signo;
    const x = a.clave[1];
    const y = b.clave[1];
    const cmp = typeof x === "string" ? x.localeCompare(y as string, "es") : (x as number) - (y as number);
    return cmp * signo;
  });

  return conHoja(libro, idx, (h) => {
    const celdas = { ...h.celdas };
    filas.forEach(({ f: origen }, i) => {
      const destino = r.f1 + i;
      for (let c = r.c1; c <= r.c2; c++) {
        const celda = hoja.celdas[claveCelda(origen, c)];
        const entrada = celda ? desplazarFormula(celda.entrada, destino - origen, 0) : "";
        ponerCelda(celdas, destino, c, celda ? { ...celda, entrada } : undefined);
      }
    });
    return { ...h, celdas };
  });
}

/** Última fila/columna con contenido (Ctrl+Fin). */
export function ultimaCeldaUsada(hoja: Hoja): { f: number; c: number } {
  let f = 0;
  let c = 0;
  for (const k of Object.keys(hoja.celdas)) {
    const [ff, cc] = k.split(",").map(Number);
    if (ff > f) f = ff;
    if (cc > c) c = cc;
  }
  return { f, c };
}

export function tieneValor(hoja: Hoja, f: number, c: number): boolean {
  return !!hoja.celdas[claveCelda(f, c)]?.entrada;
}

/**
 * Ctrl+flecha: salta al borde del bloque de datos. Si la siguiente celda está vacía,
 * avanza hasta la próxima con datos (o al límite de la hoja).
 */
export function saltoCtrl(hoja: Hoja, f: number, c: number, df: number, dc: number): { f: number; c: number } {
  const maxF = hoja.filas - 1;
  const maxC = hoja.columnas - 1;
  const dentro = (ff: number, cc: number) => ff >= 0 && cc >= 0 && ff <= maxF && cc <= maxC;
  let ff = f;
  let cc = c;
  const sigLlena = dentro(f + df, c + dc) && tieneValor(hoja, f + df, c + dc);
  if (tieneValor(hoja, f, c) && sigLlena) {
    while (dentro(ff + df, cc + dc) && tieneValor(hoja, ff + df, cc + dc)) {
      ff += df;
      cc += dc;
    }
    return { f: ff, c: cc };
  }
  do {
    ff += df;
    cc += dc;
  } while (dentro(ff, cc) && !tieneValor(hoja, ff, cc));
  if (!dentro(ff, cc)) return { f: Math.max(0, Math.min(maxF, ff)), c: Math.max(0, Math.min(maxC, cc)) };
  return { f: ff, c: cc };
}
