// Catálogo de funciones para el autocompletado y la ayuda de firma, en español (como
// las ve el usuario) con su nombre en inglés para quien lo prefiera.

export interface FuncionCatalogo {
  nombre: string;
  ingles: string;
  firma: string;
  descripcion: string;
}

export const CATALOGO_FUNCIONES: FuncionCatalogo[] = [
  { nombre: "SUMA", ingles: "SUM", firma: "SUMA(número1; [número2]; …)", descripcion: "Suma todos los números de un rango de celdas." },
  { nombre: "PROMEDIO", ingles: "AVERAGE", firma: "PROMEDIO(número1; [número2]; …)", descripcion: "Devuelve el promedio (media aritmética) de los argumentos." },
  { nombre: "MIN", ingles: "MIN", firma: "MIN(número1; [número2]; …)", descripcion: "Devuelve el valor mínimo de una lista de valores." },
  { nombre: "MAX", ingles: "MAX", firma: "MAX(número1; [número2]; …)", descripcion: "Devuelve el valor máximo de una lista de valores." },
  { nombre: "CONTAR", ingles: "COUNT", firma: "CONTAR(valor1; [valor2]; …)", descripcion: "Cuenta el número de celdas de un rango que contienen números." },
  { nombre: "CONTARA", ingles: "COUNTA", firma: "CONTARA(valor1; [valor2]; …)", descripcion: "Cuenta el número de celdas no vacías de un rango." },
  { nombre: "CONTAR.BLANCO", ingles: "COUNTBLANK", firma: "CONTAR.BLANCO(rango)", descripcion: "Cuenta el número de celdas en blanco dentro de un rango." },
  { nombre: "CONTAR.SI", ingles: "COUNTIF", firma: "CONTAR.SI(rango; criterio)", descripcion: "Cuenta las celdas en el rango que coinciden con la condición dada." },
  { nombre: "SUMAR.SI", ingles: "SUMIF", firma: "SUMAR.SI(rango; criterio; [rango_suma])", descripcion: "Suma las celdas que cumplen un determinado criterio o condición." },
  { nombre: "SI", ingles: "IF", firma: "SI(prueba_lógica; [valor_si_verdadero]; [valor_si_falso])", descripcion: "Comprueba si se cumple una condición y devuelve un valor si es verdadera y otro si es falsa." },
  { nombre: "SI.ERROR", ingles: "IFERROR", firma: "SI.ERROR(valor; valor_si_error)", descripcion: "Devuelve valor_si_error si la expresión es un error y, si no, el valor de la expresión." },
  { nombre: "Y", ingles: "AND", firma: "Y(valor_lógico1; [valor_lógico2]; …)", descripcion: "Comprueba si todos los argumentos son VERDADERO." },
  { nombre: "O", ingles: "OR", firma: "O(valor_lógico1; [valor_lógico2]; …)", descripcion: "Comprueba si alguno de los argumentos es VERDADERO." },
  { nombre: "NO", ingles: "NOT", firma: "NO(valor_lógico)", descripcion: "Cambia FALSO por VERDADERO y VERDADERO por FALSO." },
  { nombre: "REDONDEAR", ingles: "ROUND", firma: "REDONDEAR(número; núm_decimales)", descripcion: "Redondea un número al número de decimales especificado." },
  { nombre: "REDONDEAR.MAS", ingles: "ROUNDUP", firma: "REDONDEAR.MAS(número; núm_decimales)", descripcion: "Redondea un número hacia arriba, en dirección contraria a cero." },
  { nombre: "REDONDEAR.MENOS", ingles: "ROUNDDOWN", firma: "REDONDEAR.MENOS(número; núm_decimales)", descripcion: "Redondea un número hacia abajo, hacia cero." },
  { nombre: "ABS", ingles: "ABS", firma: "ABS(número)", descripcion: "Devuelve el valor absoluto de un número, sin signo." },
  { nombre: "PRODUCTO", ingles: "PRODUCT", firma: "PRODUCTO(número1; [número2]; …)", descripcion: "Multiplica todos los números dados como argumentos." },
  { nombre: "HOY", ingles: "TODAY", firma: "HOY()", descripcion: "Devuelve la fecha actual con formato de fecha." },
  { nombre: "CONCATENAR", ingles: "CONCATENATE", firma: "CONCATENAR(texto1; [texto2]; …)", descripcion: "Une varios elementos de texto en uno solo." },
  { nombre: "CONCAT", ingles: "CONCAT", firma: "CONCAT(texto1; [texto2]; …)", descripcion: "Une varios textos o rangos en uno solo." },
  { nombre: "LARGO", ingles: "LEN", firma: "LARGO(texto)", descripcion: "Devuelve el número de caracteres de una cadena de texto." },
  { nombre: "MAYUSC", ingles: "UPPER", firma: "MAYUSC(texto)", descripcion: "Convierte una cadena de texto en mayúsculas." },
  { nombre: "MINUSC", ingles: "LOWER", firma: "MINUSC(texto)", descripcion: "Convierte una cadena de texto en minúsculas." },
  { nombre: "ESPACIOS", ingles: "TRIM", firma: "ESPACIOS(texto)", descripcion: "Quita los espacios del texto, salvo los espacios individuales entre palabras." },
];

export interface SugerenciaFunciones {
  tipo: "funciones";
  /** Posición donde empieza el nombre que se está escribiendo (para reemplazarlo). */
  inicio: number;
  prefijo: string;
  lista: FuncionCatalogo[];
}

export interface SugerenciaFirma {
  tipo: "firma";
  funcion: FuncionCatalogo;
  /** Índice (base 0) del argumento donde está el cursor. */
  argumento: number;
}

export type Sugerencia = SugerenciaFunciones | SugerenciaFirma;

const CARACTER_NOMBRE = /[A-Za-z._À-ɏ]/;

/** Posición de la comilla que abre el texto en el que está el cursor, o -1 si no está en uno. */
function inicioTexto(formula: string, hasta: number): number {
  let abre = -1;
  for (let i = 0; i < hasta; i++) if (formula[i] === '"') abre = abre === -1 ? i : -1;
  return abre;
}

/**
 * Qué mostrar mientras se escribe una fórmula: la lista de funciones que empiezan con lo
 * tecleado o, si el cursor está dentro de los paréntesis de una función, su firma.
 */
export function sugerirFormula(texto: string, cursor: number): Sugerencia | null {
  if (!texto.startsWith("=") || cursor < 1) return null;
  const comilla = inicioTexto(texto, cursor);

  let i = cursor;
  while (i > 1 && CARACTER_NOMBRE.test(texto[i - 1])) i--;
  const prefijo = texto.slice(i, cursor);
  const anterior = texto[i - 1];
  const sigue = texto[cursor];
  const puedeNombre = comilla === -1 && prefijo.length > 0 && !/\d/.test(prefijo) && (sigue === undefined || !CARACTER_NOMBRE.test(sigue)) && !/[A-Za-z0-9_)$]/.test(anterior ?? "");
  if (puedeNombre) {
    const mayus = prefijo.toUpperCase();
    const lista = CATALOGO_FUNCIONES.filter((f) => f.nombre.startsWith(mayus) || f.ingles.startsWith(mayus));
    // "A1" o "SUM" exactos ya escritos no necesitan lista.
    if (lista.length && !(lista.length === 1 && (lista[0].nombre === mayus || lista[0].ingles === mayus))) {
      return { tipo: "funciones", inicio: i, prefijo, lista };
    }
  }

  // Firma: el paréntesis abierto más cercano hacia atrás sin cerrar.
  let nivel = 0;
  let argumento = 0;
  for (let k = (comilla === -1 ? cursor : comilla) - 1; k >= 1; k--) {
    const ch = texto[k];
    if (ch === '"') {
      // Salta el texto entrecomillado completo.
      k--;
      while (k >= 1 && texto[k] !== '"') k--;
      continue;
    }
    if (ch === ")") nivel++;
    else if ((ch === "," || ch === ";") && nivel === 0) argumento++;
    else if (ch === "(") {
      if (nivel > 0) {
        nivel--;
        continue;
      }
      let j = k;
      while (j > 1 && CARACTER_NOMBRE.test(texto[j - 1])) j--;
      const nombre = texto.slice(j, k).toUpperCase();
      const funcion = CATALOGO_FUNCIONES.find((f) => f.nombre === nombre || f.ingles === nombre);
      return funcion ? { tipo: "firma", funcion, argumento } : null;
    }
  }
  return null;
}

/** Inserta la función elegida en el texto y devuelve el texto y la posición del cursor. */
export function aplicarSugerencia(texto: string, sugerencia: SugerenciaFunciones, funcion: FuncionCatalogo, cursor: number): { texto: string; cursor: number } {
  const nuevo = texto.slice(0, sugerencia.inicio) + funcion.nombre + "(" + texto.slice(cursor);
  return { texto: nuevo, cursor: sugerencia.inicio + funcion.nombre.length + 1 };
}

/** Separa la firma en sus argumentos para resaltar el actual. */
export function partesFirma(firma: string): { nombre: string; argumentos: string[] } {
  const abre = firma.indexOf("(");
  const nombre = firma.slice(0, abre);
  const dentro = firma.slice(abre + 1, firma.lastIndexOf(")"));
  return { nombre, argumentos: dentro ? dentro.split(";").map((a) => a.trim()) : [] };
}
