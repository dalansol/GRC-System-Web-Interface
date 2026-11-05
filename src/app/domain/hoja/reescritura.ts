import { ERRORES_EN, ERRORES_ES, FUNCIONES_EN, nombreFuncionCanonico } from "./formulas";
import { escribirRef } from "./referencias";
import { tokenizar, unirTokens, type Token } from "./tokens";

// Reescrituras de fórmulas sobre sus tokens: desplazar al copiar/rellenar, ajustar al
// insertar o eliminar filas/columnas y traducir entre español (UI) e inglés (.xlsx).

const REF_INVALIDA = "#¡REF!";

function prefijo(t: Extract<Token, { tipo: "ref" }>): string {
  const i = t.texto.lastIndexOf("!");
  return i >= 0 ? t.texto.slice(0, i + 1) : "";
}

function conTokens(entrada: string, fn: (tokens: Token[]) => Token[]): string {
  if (!entrada.startsWith("=")) return entrada;
  try {
    return "=" + unirTokens(fn(tokenizar(entrada.slice(1))));
  } catch {
    // Una fórmula con error de sintaxis se deja tal cual (mostrará #¿NOMBRE?).
    return entrada;
  }
}

/** Ajusta las referencias relativas al copiar una fórmula df filas y dc columnas. */
export function desplazarFormula(entrada: string, df: number, dc: number): string {
  if (df === 0 && dc === 0) return entrada;
  return conTokens(entrada, (tokens) =>
    tokens.map((t) => {
      if (t.tipo !== "ref") return t;
      const f = t.ref.filaAbs ? t.ref.f : t.ref.f + df;
      const c = t.ref.colAbs ? t.ref.c : t.ref.c + dc;
      if (f < 0 || c < 0) return { tipo: "error", texto: REF_INVALIDA };
      return { ...t, texto: prefijo(t) + escribirRef({ ...t.ref, f, c }), ref: { ...t.ref, f, c } };
    }),
  );
}

export interface CambioEstructura {
  /** Hoja que cambió (nombre). */
  hoja: string;
  eje: "fila" | "columna";
  /** Índice donde se inserta o desde donde se elimina. */
  en: number;
  /** Positivo = insertar, negativo = eliminar. */
  cantidad: number;
}

/**
 * Reescribe las referencias de una fórmula escrita en `hojaFormula` tras insertar o
 * eliminar filas/columnas en `cambio.hoja`. Los rangos se estrechan; lo eliminado → #¡REF!.
 */
export function ajustarPorEstructura(entrada: string, hojaFormula: string, cambio: CambioEstructura): string {
  return conTokens(entrada, (tokens) => {
    const afecta = (t: Extract<Token, { tipo: "ref" }>) =>
      (t.hoja ?? hojaFormula).toLowerCase() === cambio.hoja.toLowerCase();
    const leer = (t: Extract<Token, { tipo: "ref" }>) => (cambio.eje === "fila" ? t.ref.f : t.ref.c);
    const conIndice = (t: Extract<Token, { tipo: "ref" }>, i: number): Token => {
      const ref = cambio.eje === "fila" ? { ...t.ref, f: i } : { ...t.ref, c: i };
      return { ...t, ref, texto: prefijo(t) + escribirRef(ref) };
    };
    const { en, cantidad } = cambio;
    const finEliminado = en - cantidad - 1; // solo si cantidad < 0

    const mover = (i: number): number | null => {
      if (cantidad > 0) return i >= en ? i + cantidad : i;
      if (i < en) return i;
      if (i <= finEliminado) return null;
      return i + cantidad;
    };

    const salida: Token[] = [];
    for (let k = 0; k < tokens.length; k++) {
      const t = tokens[k];
      if (t.tipo !== "ref" || !afecta(t)) {
        salida.push(t);
        continue;
      }
      const dos = tokens[k + 1]?.tipo === "op" && tokens[k + 1].texto === ":" ? tokens[k + 2] : undefined;
      if (dos && dos.tipo === "ref") {
        // Rango: el inicio avanza al primer índice sobreviviente y el fin retrocede.
        let a = leer(t);
        let b = leer(dos);
        if (a > b) [a, b] = [b, a];
        let na: number | null;
        let nb: number | null;
        if (cantidad > 0) {
          na = mover(a);
          nb = mover(b);
        } else {
          na = a < en ? a : a <= finEliminado ? en : a + cantidad;
          nb = b < en ? b : b <= finEliminado ? en - 1 : b + cantidad;
          if (nb! < na!) na = nb = null;
        }
        if (na === null || nb === null) {
          salida.push({ tipo: "error", texto: REF_INVALIDA });
        } else {
          salida.push(conIndice(t, na), tokens[k + 1], conIndice(dos, nb));
        }
        k += 2;
        continue;
      }
      const ni = mover(leer(t));
      salida.push(ni === null ? { tipo: "error", texto: REF_INVALIDA } : conIndice(t, ni));
    }
    return salida;
  });
}

/** Renombra el prefijo de hoja en las referencias ("Hoja1!A1" → "Datos!A1"). */
export function renombrarHojaEnFormula(entrada: string, anterior: string, nuevo: string, prefijoNuevo: string): string {
  return conTokens(entrada, (tokens) =>
    tokens.map((t) => {
      if (t.tipo !== "ref" || t.hoja?.toLowerCase() !== anterior.toLowerCase()) return t;
      return { ...t, hoja: nuevo, texto: prefijoNuevo + escribirRef(t.ref) };
    }),
  );
}

/** Fórmula de la UI (español) → como se guarda en el .xlsx (inglés, sin "="). */
export function formulaAIngles(entrada: string): string {
  const traducida = conTokens(entrada, (tokens) =>
    tokens.map((t) => {
      if (t.tipo === "funcion") return { ...t, texto: nombreFuncionCanonico(t.nombre) };
      if (t.tipo === "sep") return { ...t, texto: "," };
      if (t.tipo === "error") return { ...t, texto: ERRORES_EN[t.texto] ?? t.texto };
      if (t.tipo === "nombre" && (t.nombre === "VERDADERO" || t.nombre === "FALSO")) {
        return { ...t, texto: t.nombre === "VERDADERO" ? "TRUE" : "FALSE" };
      }
      return t;
    }),
  );
  return traducida.slice(1);
}

/** Fórmula del .xlsx (inglés, sin "=") → como la ve el usuario en Expedite. */
export function formulaAEspanol(formula: string): string {
  return conTokens("=" + formula, (tokens) =>
    tokens.map((t) => {
      if (t.tipo === "funcion") {
        const limpio = t.nombre.replace(/^_XLFN\./, "");
        return { ...t, texto: FUNCIONES_EN[limpio] ?? limpio };
      }
      if (t.tipo === "error") return { ...t, texto: ERRORES_ES[t.texto] ?? t.texto };
      if (t.tipo === "nombre" && (t.nombre === "TRUE" || t.nombre === "FALSE")) {
        return { ...t, texto: t.nombre === "TRUE" ? "VERDADERO" : "FALSO" };
      }
      return t;
    }),
  );
}

/** Referencias de una fórmula, en orden, para colorearlas mientras se edita. */
export function referenciasDe(entrada: string): { texto: string; hoja?: string; f1: number; c1: number; f2: number; c2: number }[] {
  if (!entrada.startsWith("=")) return [];
  let tokens: Token[];
  try {
    tokens = tokenizar(entrada.slice(1));
  } catch {
    return [];
  }
  const lista: { texto: string; hoja?: string; f1: number; c1: number; f2: number; c2: number }[] = [];
  for (let k = 0; k < tokens.length; k++) {
    const t = tokens[k];
    if (t.tipo !== "ref") continue;
    const dos = tokens[k + 1]?.texto === ":" ? tokens[k + 2] : undefined;
    if (dos?.tipo === "ref") {
      lista.push({
        texto: `${t.texto}:${dos.texto}`,
        hoja: t.hoja,
        f1: Math.min(t.ref.f, dos.ref.f),
        c1: Math.min(t.ref.c, dos.ref.c),
        f2: Math.max(t.ref.f, dos.ref.f),
        c2: Math.max(t.ref.c, dos.ref.c),
      });
      k += 2;
    } else {
      lista.push({ texto: t.texto, hoja: t.hoja, f1: t.ref.f, c1: t.ref.c, f2: t.ref.f, c2: t.ref.c });
    }
  }
  return lista;
}

/**
 * Como Excel al confirmar: pone en mayúsculas funciones y referencias y cierra los
 * paréntesis que falten ("=suma(a1:a3" → "=SUMA(A1:A3)").
 */
export function normalizarFormula(entrada: string): string {
  if (!entrada.startsWith("=") || entrada.length < 2) return entrada;
  let abiertos = 0;
  const normalizada = conTokens(entrada, (tokens) =>
    tokens.map((t) => {
      if (t.tipo === "abre") abiertos++;
      if (t.tipo === "cierra") abiertos--;
      if (t.tipo === "funcion") return { ...t, texto: t.texto.toUpperCase() };
      if (t.tipo === "ref") {
        const i = t.texto.lastIndexOf("!");
        return { ...t, texto: t.texto.slice(0, i + 1) + t.texto.slice(i + 1).toUpperCase() };
      }
      if (t.tipo === "nombre" && ["VERDADERO", "FALSO", "TRUE", "FALSE"].includes(t.nombre)) return { ...t, texto: t.nombre };
      return t;
    }),
  );
  return abiertos > 0 ? normalizada + ")".repeat(abiertos) : normalizada;
}
