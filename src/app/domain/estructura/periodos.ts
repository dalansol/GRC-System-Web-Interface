// Periodos de auditoría (SF-03): cada año se divide en cuatro trimestres más el año fiscal
// completo (enero a diciembre). El Catálogo los crea con un botón, sin capturar fechas.
// Formato del nombre: "2027 Q1" … "2027 Q4" y "2027 Fiscal". Funciones puras.

import type { AltaPeriodoInput, PeriodoFiscal } from "../../api/estructura";

/** Periodo que se puede crear con un botón. */
export interface PeriodoPropuesto {
  /** "Q1" … "Q4" o "Fiscal": la etiqueta del botón. */
  clave: string;
  nombre: string;
  fechaInicio: string;
  fechaFin: string;
}

const TRIMESTRES: Array<[string, string, string]> = [
  ["Q1", "01-01", "03-31"],
  ["Q2", "04-01", "06-30"],
  ["Q3", "07-01", "09-30"],
  ["Q4", "10-01", "12-31"],
];

/** Los cuatro trimestres y el año fiscal de un año, en ese orden. */
export function periodosDelAnio(anio: number): PeriodoPropuesto[] {
  return [
    ...TRIMESTRES.map(([clave, inicio, fin]) => ({
      clave,
      nombre: `${anio} ${clave}`,
      fechaInicio: `${anio}-${inicio}`,
      fechaFin: `${anio}-${fin}`,
    })),
    { clave: "Fiscal", nombre: `${anio} Fiscal`, fechaInicio: `${anio}-01-01`, fechaFin: `${anio}-12-31` },
  ];
}

/** El periodo ya registrado con esas fechas (aunque tenga otro nombre), o undefined. */
export function periodoRegistrado(periodos: PeriodoFiscal[], propuesto: PeriodoPropuesto): PeriodoFiscal | undefined {
  return periodos.find((p) => p.fechaInicio === propuesto.fechaInicio && p.fechaFin === propuesto.fechaFin);
}

/** Datos para dar de alta el periodo propuesto. */
export function altaDePeriodo(propuesto: PeriodoPropuesto, activo: boolean): AltaPeriodoInput {
  return { nombre: propuesto.nombre, fechaInicio: propuesto.fechaInicio, fechaFin: propuesto.fechaFin, activo };
}

/** Año que el selector muestra al abrir: el del periodo activo, o el actual si no hay. */
export function anioInicial(periodoActivo: PeriodoFiscal | null, hoy = new Date()): number {
  return periodoActivo ? Number(periodoActivo.fechaInicio.slice(0, 4)) : hoy.getFullYear();
}

/**
 * Orden de la lista: por año; dentro del año, por fecha de fin, y si dos terminan el mismo día
 * (Q4 y el año fiscal) primero el más corto, así el año fiscal cierra su año.
 */
export function compararPeriodos(a: PeriodoFiscal, b: PeriodoFiscal): number {
  return (
    a.fechaInicio.slice(0, 4).localeCompare(b.fechaInicio.slice(0, 4)) ||
    a.fechaFin.localeCompare(b.fechaFin) ||
    b.fechaInicio.localeCompare(a.fechaInicio)
  );
}
