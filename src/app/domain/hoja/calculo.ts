import { ErrorSintaxis, evaluarEscalar, parsearFormula, type Nodo } from "./formulas";
import { claveCelda, ErrorHoja, type EstiloCelda, type Libro, type ValorCelda } from "./tipos";

// Recalcula el libro bajo demanda: cada celda se evalúa una vez por versión del libro
// (el libro es inmutable, así que una Calculadora nueva por cambio basta).

export interface EntradaInterpretada {
  valor: ValorCelda;
  /** Formato que Excel aplicaría al teclear el valor ("$1,200" → moneda). */
  sugerido?: EstiloCelda;
}

const FECHA = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
const EPOCA_EXCEL = Date.UTC(1899, 11, 30);
const MS_DIA = 86_400_000;

export function fechaASerial(anio: number, mes: number, dia: number): number {
  return Math.round((Date.UTC(anio, mes - 1, dia) - EPOCA_EXCEL) / MS_DIA);
}

export function serialAFecha(serial: number): Date {
  return new Date(EPOCA_EXCEL + Math.round(serial * MS_DIA));
}

/** Interpreta lo tecleado en una celda que no es fórmula, como lo haría Excel (es-MX). */
export function interpretarEntrada(entrada: string): EntradaInterpretada {
  if (entrada === "") return { valor: null };
  if (entrada.startsWith("'")) return { valor: entrada.slice(1) };
  const t = entrada.trim();
  if (t === "") return { valor: entrada };
  const mayus = t.toUpperCase();
  if (mayus === "VERDADERO" || mayus === "TRUE") return { valor: true };
  if (mayus === "FALSO" || mayus === "FALSE") return { valor: false };

  const fecha = FECHA.exec(t);
  if (fecha) {
    const [dia, mes, anio] = [Number(fecha[1]), Number(fecha[2]), Number(fecha[3])];
    if (mes >= 1 && mes <= 12 && dia >= 1 && dia <= 31) {
      return { valor: fechaASerial(anio, mes, dia), sugerido: { formato: "fecha" } };
    }
  }

  // -1,234.50  $1,200  -$15  12.5%  1e3
  const m = /^(-?)(\$?)(-?)(.+?)(%?)$/.exec(t);
  if (!m) return { valor: entrada }; // "-", "$" o "%" sueltos son texto
  const cuerpo = m[4];
  const conMiles = /^\d{1,3}(,\d{3})+(\.\d*)?$/.test(cuerpo);
  const simple = /^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(cuerpo);
  if (conMiles || simple) {
    const numero = Number(cuerpo.replace(/,/g, "")) * (m[1] === "-" || m[3] === "-" ? -1 : 1);
    const decimales = /\.(\d*)/.exec(cuerpo)?.[1].length ?? 0;
    if (m[5] === "%") return { valor: numero / 100, sugerido: { formato: "porcentaje", decimales } };
    if (m[2] === "$") return { valor: numero, sugerido: { formato: "moneda", decimales: Math.max(decimales, 2) } };
    if (conMiles) return { valor: numero, sugerido: { formato: "numero", decimales } };
    return { valor: numero };
  }
  return { valor: entrada };
}

export function esFormula(entrada: string): boolean {
  return entrada.length > 1 && entrada.startsWith("=");
}

const cacheAst = new Map<string, Nodo | ErrorSintaxis>();

export function astDe(entrada: string): Nodo | ErrorSintaxis {
  let ast = cacheAst.get(entrada);
  if (!ast) {
    try {
      ast = parsearFormula(entrada.slice(1));
    } catch (e) {
      ast = e instanceof ErrorSintaxis ? e : new ErrorSintaxis(String(e));
    }
    if (cacheAst.size > 5000) cacheAst.clear();
    cacheAst.set(entrada, ast);
  }
  return ast;
}

export class Calculadora {
  private readonly valores = new Map<string, ValorCelda>();
  private readonly enCurso = new Set<string>();
  private readonly indiceHojas: Map<string, number>;
  /** Celdas ("hoja!A1" en índices) que forman parte de una referencia circular. */
  readonly circulares = new Set<string>();

  constructor(
    private readonly libro: Libro,
    private readonly hoy: () => number = () => {
      const d = new Date();
      return fechaASerial(d.getFullYear(), d.getMonth() + 1, d.getDate());
    },
  ) {
    this.indiceHojas = new Map(libro.hojas.map((h, i) => [h.nombre.toLowerCase(), i]));
  }

  valor(hojaIdx: number, f: number, c: number): ValorCelda {
    const hoja = this.libro.hojas[hojaIdx];
    if (!hoja) return new ErrorHoja("#¡REF!");
    const clave = `${hojaIdx}:${f},${c}`;
    const enCache = this.valores.get(clave);
    if (enCache !== undefined) return enCache;

    const celda = hoja.celdas[claveCelda(f, c)];
    if (!celda || celda.entrada === "") return null;
    if (!esFormula(celda.entrada)) {
      const v = interpretarEntrada(celda.entrada).valor;
      this.valores.set(clave, v);
      return v;
    }

    if (this.enCurso.has(clave)) {
      this.circulares.add(clave);
      return new ErrorHoja("#¡REF!");
    }
    this.enCurso.add(clave);
    const ast = astDe(celda.entrada);
    let resultado: ValorCelda;
    if (ast instanceof ErrorSintaxis) {
      resultado = new ErrorHoja("#¿NOMBRE?");
    } else {
      resultado = evaluarEscalar(ast, {
        valor: (nombre, ff, cc) => {
          const idx = nombre === undefined ? hojaIdx : this.indiceHojas.get(nombre.toLowerCase());
          return idx === undefined ? new ErrorHoja("#¡REF!") : this.valor(idx, ff, cc);
        },
        existeHoja: (nombre) => this.indiceHojas.has(nombre.toLowerCase()),
        hoy: this.hoy,
      });
      if (typeof resultado === "number" && !Number.isFinite(resultado)) resultado = new ErrorHoja("#¡NUM!");
      // Una fórmula que apunta a una celda vacía muestra 0, como en Excel.
      if (resultado === null) resultado = 0;
    }
    this.enCurso.delete(clave);
    if (this.circulares.has(clave)) resultado = new ErrorHoja("#¡REF!");
    this.valores.set(clave, resultado);
    return resultado;
  }
}
