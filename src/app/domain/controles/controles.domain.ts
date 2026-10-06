/**
 * controles.domain.ts — Capa de Dominio
 *
 * Contiene reglas de negocio puras para la entidad Control.
 * No importa React, UI ni datos externos.
 * Todo es una función determinista: misma entrada → misma salida.
 *
 * Requisitos cubiertos: SF-06 (evaluación diseño/efectividad), SF-07 (asignación dinámica)
 */

import type { ControlRecord, Finding } from "../../components/SharedComponents";

// ─── Tipos de dominio ─────────────────────────────────────────────────────────

/** Nivel de riesgo efectivo de un control, calculado a partir de sus hallazgos y vulnerabilidad. */
export type NivelRiesgoControl = "Fallido" | "Vulnerable" | "Activo";

// ─── Reglas de negocio ────────────────────────────────────────────────────────

/**
 * Determina si un control tiene al menos un hallazgo no cerrado asociado.
 * Un hallazgo activo indica que el control ha fallado en su propósito de mitigación.
 */
export function controlTieneHallazgoActivo(
  control: ControlRecord,
  findings: Finding[]
): boolean {
  return findings.some(
    (f) => f.failedControlId === control.id && f.status !== "Cerrado"
  );
}

/**
 * Calcula el nivel de riesgo efectivo de un control.
 *
 * Prioridad (mayor a menor):
 *   1. Fallido  → tiene hallazgos activos abiertos
 *   2. Vulnerable → tiene vulnerabilidad media o alta pero sin hallazgo activo
 *   3. Activo   → sin hallazgos y vulnerabilidad baja
 */
export function nivelRiesgoControl(
  control: ControlRecord,
  findings: Finding[]
): NivelRiesgoControl {
  if (controlTieneHallazgoActivo(control, findings)) return "Fallido";
  if (control.currentVulnerability !== "Baja") return "Vulnerable";
  return "Activo";
}

/**
 * Calcula los KPIs de resumen para un conjunto de controles con su nivel de riesgo.
 * Se expone como función pura para que pueda ser testeada independientemente.
 */
export function calcularKPIsControles(
  controles: ControlRecord[],
  findings: Finding[]
): {
  total: number;
  activos: number;
  fallidos: number;
  vulnerables: number;
  tasaEfectividad: number;
} {
  let activos = 0;
  let fallidos = 0;
  let vulnerables = 0;

  for (const c of controles) {
    const nivel = nivelRiesgoControl(c, findings);
    if (nivel === "Fallido") fallidos++;
    else if (nivel === "Vulnerable") vulnerables++;
    else activos++;
  }

  const total = controles.length;
  const tasaEfectividad =
    total === 0 ? 0 : Math.round((activos / total) * 100);

  return { total, activos, fallidos, vulnerables, tasaEfectividad };
}
