import { esFormula, interpretarEntrada } from "./calculo";

// Serie del controlador de relleno: con dos o más números continúa la progresión,
// como Excel. El resto de los casos copia las celdas (ver operaciones.rellenar).

function formatoComo(origen: string, n: number): string {
  // Conserva los decimales visibles del origen ("1.50" → "2.00").
  const dec = /\.(\d+)$/.exec(origen.trim())?.[1].length ?? 0;
  return dec ? n.toFixed(dec) : String(Math.round(n * 1e10) / 1e10);
}

/**
 * Si `origen` es una progresión numérica (2+ números), los `cantidad` valores que la
 * continúan en la dirección del arrastre; si no, null (el relleno copia las celdas).
 */
export function serieRelleno(origen: string[], cantidad: number, direccion: 1 | -1 = 1): string[] | null {
  if (origen.length < 2) return null;
  const numericos = origen.every(
    (e) => e !== "" && !esFormula(e) && typeof interpretarEntrada(e).valor === "number" && !/[$%,/]/.test(e),
  );
  if (!numericos) return null;
  const nums = origen.map((e) => interpretarEntrada(e).valor as number);
  const paso = (nums[nums.length - 1] - nums[0]) / (nums.length - 1);
  const salida: string[] = [];
  for (let k = 1; k <= cantidad; k++) {
    const n = direccion === 1 ? nums[nums.length - 1] + paso * k : nums[0] - paso * k;
    salida.push(formatoComo(origen[direccion === 1 ? origen.length - 1 : 0], n));
  }
  return salida;
}
