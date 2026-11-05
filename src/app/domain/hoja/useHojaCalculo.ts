import { useCallback, useMemo, useReducer } from "react";

import { Calculadora } from "./calculo";
import { combinadaEn } from "./combinadas";
import { estadoInicial, rangoSeleccion, reducirHoja, type Seleccion } from "./estadoHoja";
import { formatearValor } from "./formato";
import { aplicarEstilo, ultimaCeldaUsada } from "./operaciones";
import { claveCelda, type EstiloCelda, type Libro, type Rango } from "./tipos";

// ViewModel del editor de hojas de cálculo: estado (reducer), recálculo y acciones de
// alto nivel que usan la cinta, el teclado y los menús.

export interface ResumenSeleccion {
  recuento: number;
  numericos: number;
  suma: number;
  promedio: number | null;
}

export function useHojaCalculo(libroInicial: Libro, soloLectura: boolean) {
  const [estado, despachar] = useReducer(reducirHoja, undefined, () => estadoInicial(libroInicial, soloLectura));
  const calc = useMemo(() => new Calculadora(estado.libro), [estado.libro]);
  const hoja = estado.libro.hojas[estado.hojaActiva];
  const rango = rangoSeleccion(estado.sel);
  const usada = useMemo(() => ultimaCeldaUsada(hoja), [hoja]);

  /**
   * Rango acotado a la zona con datos: seleccionar columnas o filas completas abarca
   * más de un millón de celdas, pero solo tiene sentido operar donde hay contenido.
   */
  const rangoUtil: Rango = {
    ...rango,
    f2: Math.max(rango.f1, Math.min(rango.f2, Math.max(usada.f, hoja.filas - 1, estado.sel.activa.f))),
    c2: Math.max(rango.c1, Math.min(rango.c2, Math.max(usada.c, hoja.columnas - 1, estado.sel.activa.c))),
  };

  /** Aplica una operación sobre el libro (queda en el historial de deshacer). */
  const aplicar = useCallback(
    (fn: (libro: Libro, idx: number, rango: Rango) => Libro, sel?: Seleccion, hojaActiva?: number) => {
      despachar({ tipo: "aplicar", libro: fn(estado.libro, estado.hojaActiva, rangoUtil), sel, hojaActiva });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [estado.libro, estado.hojaActiva, rangoUtil.f1, rangoUtil.f2, rangoUtil.c1, rangoUtil.c2],
  );

  const estiloActivo: EstiloCelda = hoja.celdas[claveCelda(estado.sel.activa.f, estado.sel.activa.c)]?.estilo ?? {};
  /** Rango combinado al que pertenece la celda activa (la cinta marca "Combinar y centrar"). */
  const combinadaActiva = combinadaEn(hoja, estado.sel.activa.f, estado.sel.activa.c);

  /** Cambia el estilo del rango; los interruptores (negrita…) siguen a la celda activa, como Excel. */
  const cambiarEstilo = useCallback(
    (cambio: (e: EstiloCelda) => EstiloCelda) => aplicar((libro, idx, r) => aplicarEstilo(libro, idx, r, cambio)),
    [aplicar],
  );

  const alternar = useCallback(
    (clave: "negrita" | "cursiva" | "subrayado" | "bordes") => {
      const nuevo = !estiloActivo[clave];
      cambiarEstilo((e) => ({ ...e, [clave]: nuevo }));
    },
    [cambiarEstilo, estiloActivo],
  );

  const resumen = useMemo<ResumenSeleccion | null>(() => {
    if (rango.f1 === rango.f2 && rango.c1 === rango.c2) return null;
    let recuento = 0;
    let numericos = 0;
    let suma = 0;
    for (const k of Object.keys(hoja.celdas)) {
      const [f, c] = k.split(",").map(Number);
      if (f < rango.f1 || f > rango.f2 || c < rango.c1 || c > rango.c2) continue;
      const v = calc.valor(estado.hojaActiva, f, c);
      if (v === null || v === "") continue;
      recuento++;
      if (typeof v === "number") {
        numericos++;
        suma += v;
      }
    }
    if (!recuento) return null;
    return { recuento, numericos, suma, promedio: numericos ? suma / numericos : null };
  }, [calc, hoja.celdas, rango.f1, rango.f2, rango.c1, rango.c2, estado.hojaActiva]);

  /** Texto que se muestra en una celda. */
  const textoCelda = useCallback(
    (idx: number, f: number, c: number) => {
      const celda = estado.libro.hojas[idx].celdas[claveCelda(f, c)];
      if (!celda) return "";
      // Como Excel, se copia lo que se ve (con formato), no la fórmula.
      return formatearValor(calc.valor(idx, f, c), celda.estilo);
    },
    [calc, estado.libro],
  );

  return { estado, despachar, calc, hoja, rango, rangoUtil, usada, aplicar, estiloActivo, combinadaActiva, cambiarEstilo, alternar, resumen, textoCelda };
}

export type VistaModeloHoja = ReturnType<typeof useHojaCalculo>;
