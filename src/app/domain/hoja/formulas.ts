import { ErrorHoja, type ValorCelda } from "./tipos";
import { ErrorSintaxis, tokenizar, type Token } from "./tokens";

// Parser y evaluador de fórmulas al estilo Excel. Los nombres de función se aceptan en
// español o inglés; internamente se trabaja con el nombre en inglés (como en el .xlsx).

export type Nodo =
  | { t: "num"; v: number }
  | { t: "str"; v: string }
  | { t: "bool"; v: boolean }
  | { t: "err"; v: ErrorHoja }
  | { t: "ref"; hoja?: string; f: number; c: number }
  | { t: "rango"; hoja?: string; f1: number; c1: number; f2: number; c2: number }
  | { t: "un"; op: "-" | "+"; a: Nodo }
  | { t: "pct"; a: Nodo }
  | { t: "bin"; op: string; a: Nodo; b: Nodo }
  | { t: "fn"; nombre: string; args: Nodo[] };

/** Español → inglés. Los que se escriben igual (MIN, MAX, ABS, CONCAT) no necesitan entrada. */
export const FUNCIONES_ES: Record<string, string> = {
  SUMA: "SUM",
  PROMEDIO: "AVERAGE",
  CONTAR: "COUNT",
  CONTARA: "COUNTA",
  "CONTAR.BLANCO": "COUNTBLANK",
  SI: "IF",
  Y: "AND",
  O: "OR",
  NO: "NOT",
  REDONDEAR: "ROUND",
  "REDONDEAR.MAS": "ROUNDUP",
  "REDONDEAR.MENOS": "ROUNDDOWN",
  HOY: "TODAY",
  CONCATENAR: "CONCATENATE",
  "SI.ERROR": "IFERROR",
  PRODUCTO: "PRODUCT",
  LARGO: "LEN",
  MAYUSC: "UPPER",
  MINUSC: "LOWER",
  ESPACIOS: "TRIM",
  "SUMAR.SI": "SUMIF",
  "CONTAR.SI": "COUNTIF",
};

export const FUNCIONES_EN: Record<string, string> = Object.fromEntries(
  Object.entries(FUNCIONES_ES).map(([es, en]) => [en, es]),
);

export const ERRORES_EN: Record<string, string> = {
  "#¡DIV/0!": "#DIV/0!",
  "#¡REF!": "#REF!",
  "#¿NOMBRE?": "#NAME?",
  "#¡VALOR!": "#VALUE!",
  "#¡NUM!": "#NUM!",
  "#N/D": "#N/A",
};
export const ERRORES_ES: Record<string, string> = Object.fromEntries(
  Object.entries(ERRORES_EN).map(([es, en]) => [en, es]),
);

const VERDADEROS = new Set(["TRUE", "VERDADERO"]);
const FALSOS = new Set(["FALSE", "FALSO"]);

export function nombreFuncionCanonico(nombre: string): string {
  const mayus = nombre.toUpperCase();
  return FUNCIONES_ES[mayus] ?? mayus.replace(/^_XLFN\./, "");
}

// ─── Parser ──────────────────────────────────────────────────────────────────

const PRECEDENCIA: Record<string, number> = {
  "=": 1, "<>": 1, "<": 1, ">": 1, "<=": 1, ">=": 1,
  "&": 2,
  "+": 3, "-": 3,
  "*": 4, "/": 4,
  "^": 5,
};

export function parsearFormula(formula: string): Nodo {
  const tokens = tokenizar(formula).filter((t) => t.tipo !== "espacio");
  let i = 0;
  const ver = (): Token | undefined => tokens[i];
  const tomar = (): Token => {
    const t = tokens[i++];
    if (!t) throw new ErrorSintaxis("La fórmula está incompleta");
    return t;
  };

  const expresion = (minPrec: number): Nodo => {
    let izquierda = unario();
    for (;;) {
      const t = ver();
      if (!t || t.tipo !== "op" || !(t.texto in PRECEDENCIA)) break;
      const prec = PRECEDENCIA[t.texto];
      if (prec < minPrec) break;
      i++;
      // ^ es asociativo por la izquierda en Excel.
      const derecha = expresion(prec + 1);
      izquierda = { t: "bin", op: t.texto, a: izquierda, b: derecha };
    }
    return izquierda;
  };

  const unario = (): Nodo => {
    const t = ver();
    if (t?.tipo === "op" && (t.texto === "-" || t.texto === "+")) {
      i++;
      return { t: "un", op: t.texto, a: unario() };
    }
    let nodo = primario();
    while (ver()?.tipo === "op" && ver()!.texto === "%") {
      i++;
      nodo = { t: "pct", a: nodo };
    }
    return nodo;
  };

  const primario = (): Nodo => {
    const t = tomar();
    switch (t.tipo) {
      case "numero":
        return { t: "num", v: t.valor };
      case "texto":
        return { t: "str", v: t.valor };
      case "error":
        return { t: "err", v: new ErrorHoja((ERRORES_ES[t.texto] ?? t.texto) as never) };
      case "ref": {
        const sig = ver();
        if (sig?.tipo === "op" && sig.texto === ":") {
          i++;
          const fin = tomar();
          if (fin.tipo !== "ref") throw new ErrorSintaxis("Rango no válido");
          return {
            t: "rango",
            hoja: t.hoja,
            f1: Math.min(t.ref.f, fin.ref.f),
            c1: Math.min(t.ref.c, fin.ref.c),
            f2: Math.max(t.ref.f, fin.ref.f),
            c2: Math.max(t.ref.c, fin.ref.c),
          };
        }
        return { t: "ref", hoja: t.hoja, f: t.ref.f, c: t.ref.c };
      }
      case "nombre":
        if (VERDADEROS.has(t.nombre)) return { t: "bool", v: true };
        if (FALSOS.has(t.nombre)) return { t: "bool", v: false };
        return { t: "err", v: new ErrorHoja("#¿NOMBRE?") };
      case "funcion": {
        if (tomar().tipo !== "abre") throw new ErrorSintaxis("Falta paréntesis");
        const args: Nodo[] = [];
        if (ver()?.tipo === "cierra") {
          i++;
        } else {
          for (;;) {
            // Argumento omitido: SI(A1,,2)
            if (ver()?.tipo === "sep" || ver()?.tipo === "cierra") args.push({ t: "str", v: "" });
            else args.push(expresion(1));
            const s = tomar();
            if (s.tipo === "cierra") break;
            if (s.tipo !== "sep") throw new ErrorSintaxis("Se esperaba una coma");
          }
        }
        return { t: "fn", nombre: nombreFuncionCanonico(t.nombre), args };
      }
      case "abre": {
        const dentro = expresion(1);
        if (tomar().tipo !== "cierra") throw new ErrorSintaxis("Falta cerrar un paréntesis");
        return dentro;
      }
      default:
        throw new ErrorSintaxis(`No se esperaba "${t.texto}"`);
    }
  };

  const raiz = expresion(1);
  if (i < tokens.length) throw new ErrorSintaxis(`No se esperaba "${tokens[i].texto}"`);
  return raiz;
}

// ─── Evaluador ───────────────────────────────────────────────────────────────

export interface ContextoEvaluacion {
  /** Valor ya calculado de una celda; `hoja` undefined = la hoja de la fórmula. */
  valor(hoja: string | undefined, f: number, c: number): ValorCelda;
  /** false si la hoja nombrada no existe. */
  existeHoja(hoja: string): boolean;
  hoy(): number;
}

type Resultado = ValorCelda | ValorCelda[][];

const esError = (v: unknown): v is ErrorHoja => v instanceof ErrorHoja;
const error = (codigo: ConstructorParameters<typeof ErrorHoja>[0]) => new ErrorHoja(codigo);

export function aNumero(v: ValorCelda): number | ErrorHoja {
  if (esError(v)) return v;
  if (v === null || v === "") return 0;
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  const n = Number(v.replace(/,/g, "").trim());
  return v.trim() !== "" && !Number.isNaN(n) ? n : error("#¡VALOR!");
}

export function aTexto(v: ValorCelda): string {
  if (v === null) return "";
  if (typeof v === "boolean") return v ? "VERDADERO" : "FALSO";
  if (typeof v === "number") return String(Math.round(v * 1e10) / 1e10);
  return String(v);
}

function aBooleano(v: ValorCelda): boolean | ErrorHoja {
  if (esError(v)) return v;
  if (typeof v === "boolean") return v;
  if (v === null || v === "") return false;
  if (typeof v === "number") return v !== 0;
  const mayus = v.toUpperCase();
  if (VERDADEROS.has(mayus)) return true;
  if (FALSOS.has(mayus)) return false;
  return error("#¡VALOR!");
}

function escalar(r: Resultado): ValorCelda {
  if (!Array.isArray(r)) return r;
  if (r.length === 1 && r[0].length === 1) return r[0][0];
  return error("#¡VALOR!");
}

function aplanar(args: Resultado[]): { valor: ValorCelda; deRango: boolean }[] {
  const lista: { valor: ValorCelda; deRango: boolean }[] = [];
  for (const a of args) {
    if (Array.isArray(a)) for (const fila of a) for (const v of fila) lista.push({ valor: v, deRango: true });
    else lista.push({ valor: a, deRango: false });
  }
  return lista;
}

/** Números para SUMA/PROMEDIO/MIN/MAX: en rangos se ignora texto y vacíos, como en Excel. */
function numeros(args: Resultado[]): number[] | ErrorHoja {
  const lista: number[] = [];
  for (const { valor, deRango } of aplanar(args)) {
    if (esError(valor)) return valor;
    if (deRango) {
      if (typeof valor === "number") lista.push(valor);
      continue;
    }
    const n = aNumero(valor);
    if (esError(n)) return n;
    lista.push(n);
  }
  return lista;
}

function comparar(a: ValorCelda, b: ValorCelda): number {
  const rango = (v: ValorCelda) => (typeof v === "boolean" ? 2 : typeof v === "string" ? 1 : 0);
  const va = a === null ? (typeof b === "string" ? "" : typeof b === "boolean" ? false : 0) : a;
  const vb = b === null ? (typeof a === "string" ? "" : typeof a === "boolean" ? false : 0) : b;
  if (rango(va) !== rango(vb)) return rango(va) - rango(vb);
  if (typeof va === "string" && typeof vb === "string") return va.localeCompare(vb, "es", { sensitivity: "base" });
  return Number(va) - Number(vb);
}

/** Criterio de SUMAR.SI / CONTAR.SI: ">10", "<>Pago", "Activo", 5. */
function cumpleCriterio(v: ValorCelda, criterio: ValorCelda): boolean {
  if (typeof criterio === "number" || typeof criterio === "boolean") return comparar(v, criterio) === 0;
  const texto = aTexto(criterio);
  const m = /^(<>|<=|>=|<|>|=)?(.*)$/.exec(texto)!;
  const op = m[1] ?? "=";
  const objetivoTexto = m[2];
  const num = Number(objetivoTexto);
  const objetivo: ValorCelda = objetivoTexto !== "" && !Number.isNaN(num) ? num : objetivoTexto;
  if (typeof objetivo === "number" && typeof v !== "number") return op === "<>";
  const cmp = comparar(v ?? "", objetivo);
  switch (op) {
    case "<>": return cmp !== 0;
    case "<": return cmp < 0;
    case ">": return cmp > 0;
    case "<=": return cmp <= 0;
    case ">=": return cmp >= 0;
    default: return cmp === 0;
  }
}

function redondear(n: number, decimales: number, modo: "normal" | "arriba" | "abajo"): number {
  const factor = 10 ** decimales;
  const x = Math.abs(n) * factor;
  const r = modo === "arriba" ? Math.ceil(x - 1e-9) : modo === "abajo" ? Math.floor(x + 1e-9) : Math.round(x + 1e-9);
  return (Math.sign(n) * r) / factor;
}

type Funcion = (args: Resultado[], ctx: ContextoEvaluacion) => Resultado;

const FUNCIONES: Record<string, Funcion> = {
  SUM: (args) => {
    const ns = numeros(args);
    return esError(ns) ? ns : ns.reduce((s, n) => s + n, 0);
  },
  AVERAGE: (args) => {
    const ns = numeros(args);
    if (esError(ns)) return ns;
    return ns.length ? ns.reduce((s, n) => s + n, 0) / ns.length : error("#¡DIV/0!");
  },
  MIN: (args) => {
    const ns = numeros(args);
    return esError(ns) ? ns : ns.length ? Math.min(...ns) : 0;
  },
  MAX: (args) => {
    const ns = numeros(args);
    return esError(ns) ? ns : ns.length ? Math.max(...ns) : 0;
  },
  PRODUCT: (args) => {
    const ns = numeros(args);
    return esError(ns) ? ns : ns.length ? ns.reduce((p, n) => p * n, 1) : 0;
  },
  COUNT: (args) =>
    aplanar(args).filter(({ valor, deRango }) => typeof valor === "number" || (!deRango && !esError(aNumero(valor)) && valor !== null)).length,
  COUNTA: (args) => aplanar(args).filter(({ valor }) => valor !== null && valor !== "").length,
  COUNTBLANK: (args) => aplanar(args).filter(({ valor }) => valor === null || valor === "").length,
  IF: (args) => {
    if (args.length < 2 || args.length > 3) return error("#¡VALOR!");
    const cond = aBooleano(escalar(args[0]));
    if (esError(cond)) return cond;
    return cond ? args[1] : args.length === 3 ? args[2] : false;
  },
  IFERROR: (args) => {
    if (args.length !== 2) return error("#¡VALOR!");
    const v = escalar(args[0]);
    return esError(v) ? args[1] : args[0];
  },
  AND: (args) => {
    let r = true;
    for (const { valor } of aplanar(args)) {
      const b = aBooleano(valor);
      if (esError(b)) return b;
      r = r && b;
    }
    return r;
  },
  OR: (args) => {
    let r = false;
    for (const { valor } of aplanar(args)) {
      const b = aBooleano(valor);
      if (esError(b)) return b;
      r = r || b;
    }
    return r;
  },
  NOT: (args) => {
    if (args.length !== 1) return error("#¡VALOR!");
    const b = aBooleano(escalar(args[0]));
    return esError(b) ? b : !b;
  },
  ROUND: (args) => redondeo(args, "normal"),
  ROUNDUP: (args) => redondeo(args, "arriba"),
  ROUNDDOWN: (args) => redondeo(args, "abajo"),
  ABS: (args) => {
    if (args.length !== 1) return error("#¡VALOR!");
    const n = aNumero(escalar(args[0]));
    return esError(n) ? n : Math.abs(n);
  },
  TODAY: (_args, ctx) => ctx.hoy(),
  CONCATENATE: (args) => concatenar(args),
  CONCAT: (args) => concatenar(args),
  LEN: (args) => texto1(args, (s) => s.length),
  UPPER: (args) => texto1(args, (s) => s.toUpperCase()),
  LOWER: (args) => texto1(args, (s) => s.toLowerCase()),
  TRIM: (args) => texto1(args, (s) => s.trim().replace(/\s+/g, " ")),
  SUMIF: (args) => {
    if (args.length < 2 || args.length > 3) return error("#¡VALOR!");
    const rango = Array.isArray(args[0]) ? args[0] : [[args[0]]];
    const sumar = args[2] === undefined ? rango : Array.isArray(args[2]) ? args[2] : [[args[2]]];
    const criterio = escalar(args[1]);
    let suma = 0;
    rango.forEach((fila, i) =>
      fila.forEach((v, j) => {
        const s = sumar[i]?.[j];
        if (cumpleCriterio(v, criterio) && typeof s === "number") suma += s;
      }),
    );
    return suma;
  },
  COUNTIF: (args) => {
    if (args.length !== 2) return error("#¡VALOR!");
    const rango = Array.isArray(args[0]) ? args[0] : [[args[0]]];
    const criterio = escalar(args[1]);
    return rango.flat().filter((v) => cumpleCriterio(v, criterio)).length;
  },
};

function redondeo(args: Resultado[], modo: "normal" | "arriba" | "abajo"): Resultado {
  if (args.length < 1 || args.length > 2) return error("#¡VALOR!");
  const n = aNumero(escalar(args[0]));
  if (esError(n)) return n;
  const d = args.length === 2 ? aNumero(escalar(args[1])) : 0;
  if (esError(d)) return d;
  return redondear(n, Math.trunc(d), modo);
}

function concatenar(args: Resultado[]): Resultado {
  let s = "";
  for (const { valor } of aplanar(args)) {
    if (esError(valor)) return valor;
    s += aTexto(valor);
  }
  return s;
}

function texto1(args: Resultado[], fn: (s: string) => ValorCelda): Resultado {
  if (args.length !== 1) return error("#¡VALOR!");
  const v = escalar(args[0]);
  return esError(v) ? v : fn(aTexto(v));
}

export function funcionSoportada(nombre: string): boolean {
  return nombreFuncionCanonico(nombre) in FUNCIONES;
}

export function evaluar(nodo: Nodo, ctx: ContextoEvaluacion): Resultado {
  switch (nodo.t) {
    case "num":
    case "str":
    case "bool":
    case "err":
      return nodo.v;
    case "ref":
      if (nodo.hoja !== undefined && !ctx.existeHoja(nodo.hoja)) return error("#¡REF!");
      return ctx.valor(nodo.hoja, nodo.f, nodo.c);
    case "rango": {
      if (nodo.hoja !== undefined && !ctx.existeHoja(nodo.hoja)) return error("#¡REF!");
      const filas: ValorCelda[][] = [];
      for (let f = nodo.f1; f <= nodo.f2; f++) {
        const fila: ValorCelda[] = [];
        for (let c = nodo.c1; c <= nodo.c2; c++) fila.push(ctx.valor(nodo.hoja, f, c));
        filas.push(fila);
      }
      return filas;
    }
    case "un": {
      const n = aNumero(escalar(evaluar(nodo.a, ctx)));
      if (esError(n)) return n;
      return nodo.op === "-" ? -n : n;
    }
    case "pct": {
      const n = aNumero(escalar(evaluar(nodo.a, ctx)));
      return esError(n) ? n : n / 100;
    }
    case "bin": {
      const a = escalar(evaluar(nodo.a, ctx));
      const b = escalar(evaluar(nodo.b, ctx));
      if (esError(a)) return a;
      if (esError(b)) return b;
      if (nodo.op === "&") return aTexto(a) + aTexto(b);
      if (["=", "<>", "<", ">", "<=", ">="].includes(nodo.op)) {
        const cmp = comparar(a, b);
        switch (nodo.op) {
          case "=": return cmp === 0;
          case "<>": return cmp !== 0;
          case "<": return cmp < 0;
          case ">": return cmp > 0;
          case "<=": return cmp <= 0;
          default: return cmp >= 0;
        }
      }
      const x = aNumero(a);
      const y = aNumero(b);
      if (esError(x)) return x;
      if (esError(y)) return y;
      switch (nodo.op) {
        case "+": return x + y;
        case "-": return x - y;
        case "*": return x * y;
        case "/": return y === 0 ? error("#¡DIV/0!") : x / y;
        case "^": {
          const r = x ** y;
          return Number.isFinite(r) ? r : error("#¡NUM!");
        }
      }
      return error("#¡VALOR!");
    }
    case "fn": {
      const fn = FUNCIONES[nodo.nombre];
      if (!fn) return error("#¿NOMBRE?");
      // SI y SI.ERROR evalúan solo la rama necesaria (evita errores y ciclos innecesarios).
      if (nodo.nombre === "IF" && nodo.args.length >= 2) {
        const cond = aBooleano(escalar(evaluar(nodo.args[0], ctx)));
        if (esError(cond)) return cond;
        if (cond) return evaluar(nodo.args[1], ctx);
        return nodo.args[2] ? evaluar(nodo.args[2], ctx) : false;
      }
      return fn(nodo.args.map((a) => evaluar(a, ctx)), ctx);
    }
  }
}

export function evaluarEscalar(nodo: Nodo, ctx: ContextoEvaluacion): ValorCelda {
  return escalar(evaluar(nodo, ctx));
}

export { ErrorSintaxis };
