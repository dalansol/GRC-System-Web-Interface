import { parsearRef, type RefCelda } from "./referencias";

// Tokenizador de fórmulas. Cada token conserva su texto original para poder
// reconstruir la fórmula al desplazarla, traducirla o insertar filas.

export type Token =
  | { tipo: "numero"; texto: string; valor: number }
  | { tipo: "texto"; texto: string; valor: string }
  | { tipo: "ref"; texto: string; hoja?: string; ref: RefCelda }
  | { tipo: "funcion"; texto: string; nombre: string }
  | { tipo: "nombre"; texto: string; nombre: string }
  | { tipo: "error"; texto: string }
  | { tipo: "op"; texto: string }
  | { tipo: "abre"; texto: "(" }
  | { tipo: "cierra"; texto: ")" }
  | { tipo: "sep"; texto: "," | ";" }
  | { tipo: "espacio"; texto: string };

const LETRA = /[A-Za-z_À-ɏ]/;
const CARACTER_NOMBRE = /[A-Za-z0-9_.$À-ɏ]/;
const OPERADORES = ["<>", "<=", ">=", "+", "-", "*", "/", "^", "&", "%", "=", "<", ">", ":"];

export class ErrorSintaxis extends Error {}

/** Recibe la fórmula sin el "=" inicial. */
export function tokenizar(formula: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const n = formula.length;

  const leerHojaCitada = (): string | null => {
    // 'Mi hoja'!A1
    let j = i + 1;
    let nombre = "";
    while (j < n) {
      if (formula[j] === "'") {
        if (formula[j + 1] === "'") {
          nombre += "'";
          j += 2;
          continue;
        }
        break;
      }
      nombre += formula[j++];
    }
    if (formula[j] !== "'" || formula[j + 1] !== "!") return null;
    i = j + 2;
    return nombre;
  };

  while (i < n) {
    const ch = formula[i];

    if (/\s/.test(ch)) {
      let j = i;
      while (j < n && /\s/.test(formula[j])) j++;
      tokens.push({ tipo: "espacio", texto: formula.slice(i, j) });
      i = j;
      continue;
    }

    if (ch === '"') {
      let j = i + 1;
      let valor = "";
      while (j < n) {
        if (formula[j] === '"') {
          if (formula[j + 1] === '"') {
            valor += '"';
            j += 2;
            continue;
          }
          break;
        }
        valor += formula[j++];
      }
      if (j >= n) throw new ErrorSintaxis("Texto sin cerrar");
      tokens.push({ tipo: "texto", texto: formula.slice(i, j + 1), valor });
      i = j + 1;
      continue;
    }

    if (/[0-9.]/.test(ch)) {
      const m = /^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(formula.slice(i));
      if (!m) throw new ErrorSintaxis(`Número no válido en la posición ${i + 1}`);
      tokens.push({ tipo: "numero", texto: m[0], valor: Number(m[0]) });
      i += m[0].length;
      continue;
    }

    if (ch === "#") {
      const m = /^#[^\s,;()]+/.exec(formula.slice(i));
      const texto = m ? m[0] : "#";
      tokens.push({ tipo: "error", texto });
      i += texto.length;
      continue;
    }

    if (ch === "'") {
      const inicio = i;
      const hoja = leerHojaCitada();
      if (hoja === null) throw new ErrorSintaxis("Nombre de hoja sin cerrar");
      const m = /^\$?[A-Za-z]{1,3}\$?\d+/.exec(formula.slice(i));
      const ref = m ? parsearRef(m[0]) : null;
      if (!m || !ref) throw new ErrorSintaxis("Referencia no válida");
      i += m[0].length;
      tokens.push({ tipo: "ref", texto: formula.slice(inicio, i), hoja, ref });
      continue;
    }

    if (LETRA.test(ch) || ch === "$") {
      let j = i;
      while (j < n && CARACTER_NOMBRE.test(formula[j])) j++;
      const palabra = formula.slice(i, j);
      if (formula[j] === "!") {
        // Hoja2!B3
        const m = /^\$?[A-Za-z]{1,3}\$?\d+/.exec(formula.slice(j + 1));
        const ref = m ? parsearRef(m[0]) : null;
        if (!m || !ref) throw new ErrorSintaxis("Referencia no válida");
        const fin = j + 1 + m[0].length;
        tokens.push({ tipo: "ref", texto: formula.slice(i, fin), hoja: palabra, ref });
        i = fin;
        continue;
      }
      let k = j;
      while (k < n && formula[k] === " ") k++;
      if (formula[k] === "(") {
        tokens.push({ tipo: "funcion", texto: palabra, nombre: palabra.toUpperCase() });
        i = j;
        continue;
      }
      const ref = parsearRef(palabra);
      if (ref) tokens.push({ tipo: "ref", texto: palabra, ref });
      else tokens.push({ tipo: "nombre", texto: palabra, nombre: palabra.toUpperCase() });
      i = j;
      continue;
    }

    if (ch === "(") {
      tokens.push({ tipo: "abre", texto: "(" });
      i++;
      continue;
    }
    if (ch === ")") {
      tokens.push({ tipo: "cierra", texto: ")" });
      i++;
      continue;
    }
    if (ch === "," || ch === ";") {
      tokens.push({ tipo: "sep", texto: ch });
      i++;
      continue;
    }

    const op = OPERADORES.find((o) => formula.startsWith(o, i));
    if (op) {
      tokens.push({ tipo: "op", texto: op });
      i += op.length;
      continue;
    }

    throw new ErrorSintaxis(`Carácter inesperado "${ch}"`);
  }
  return tokens;
}

export function unirTokens(tokens: Token[]): string {
  return tokens.map((t) => t.texto).join("");
}

/** Prefijo de hoja como lo escribe Excel: comillas si el nombre no es un identificador simple. */
export function prefijoHoja(nombre: string): string {
  return /^[A-Za-z_À-ɏ][A-Za-z0-9_.À-ɏ]*$/.test(nombre) ? `${nombre}!` : `'${nombre.replace(/'/g, "''")}'!`;
}
