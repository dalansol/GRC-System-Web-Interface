import { aTexto } from "./formulas";
import { serialAFecha } from "./calculo";
import { ErrorHoja, type AlineacionH, type EstiloCelda, type ValorCelda } from "./tipos";

// Cómo se ve un valor en la celda, con la configuración regional es-MX de Excel.

function numeroGeneral(n: number): string {
  if (Number.isInteger(n) && Math.abs(n) < 1e11) return String(n);
  const abs = Math.abs(n);
  if (abs !== 0 && (abs >= 1e11 || abs < 1e-9)) return n.toExponential(5).replace(/\.?0+e/, "E").replace("e", "E");
  // Excel muestra hasta ~10 dígitos significativos en formato General.
  return String(Number(n.toPrecision(10)));
}

function conDecimales(n: number, decimales: number, miles: boolean): string {
  return n.toLocaleString("es-MX", {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
    useGrouping: miles,
  });
}

export function formatearValor(valor: ValorCelda, estilo: EstiloCelda | undefined): string {
  if (valor === null) return "";
  if (valor instanceof ErrorHoja) return valor.codigo;
  if (typeof valor === "boolean") return valor ? "VERDADERO" : "FALSO";
  if (typeof valor === "string") return valor;

  const formato = estilo?.formato ?? "general";
  const dec = estilo?.decimales;
  switch (formato) {
    case "numero":
      return conDecimales(valor, dec ?? 2, true);
    case "moneda": {
      const texto = conDecimales(Math.abs(valor), dec ?? 2, true);
      return valor < 0 ? `-$${texto}` : `$${texto}`;
    }
    case "porcentaje":
      return `${conDecimales(valor * 100, dec ?? 0, false)}%`;
    case "fecha": {
      const d = serialAFecha(valor);
      if (Number.isNaN(d.getTime())) return "#".repeat(8);
      const dd = String(d.getUTCDate()).padStart(2, "0");
      const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
      return `${dd}/${mm}/${d.getUTCFullYear()}`;
    }
    case "texto":
      return aTexto(valor);
    default:
      return dec !== undefined ? conDecimales(valor, dec, false) : numeroGeneral(valor);
  }
}

/** Sin alineación explícita Excel alinea números a la derecha, booleanos y errores al centro. */
export function alineacionEfectiva(valor: ValorCelda, estilo: EstiloCelda | undefined): AlineacionH {
  if (estilo?.alineacion) return estilo.alineacion;
  if (estilo?.formato === "texto") return "izquierda";
  if (typeof valor === "number") return "derecha";
  if (typeof valor === "boolean" || valor instanceof ErrorHoja) return "centro";
  return "izquierda";
}
