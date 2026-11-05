import { describe, expect, it } from "vitest";
import {
  destinatariosCambio,
  huellaContenidoPlan,
  impedimentoRevision,
  validarMotivoRechazo,
} from "../src/domain/flujoPlanAccion.js";
import type { HallazgoResumen, PasoPlanAccion, PlanAccion } from "../src/domain/planesAccion.js";

const hallazgo = (id: string): HallazgoResumen => ({
  id,
  folio: id,
  titulo: `Hallazgo ${id}`,
  severidad: "Alto",
  auditoriaId: "AUD-001",
  controlId: "CTR-001",
  fechaCierreAuditoria: "2026-01-31",
});

const paso = (id: number, usuarioId: number, cambios: Partial<PasoPlanAccion> = {}): PasoPlanAccion => ({
  id,
  action_plan_id: 7,
  planAccionId: 7,
  usuarioAsignado: { id: usuarioId, nombre: `Usuario ${usuarioId}` },
  descripcion: `Paso ${id}`,
  fechaCompromiso: "2026-02-01",
  completado: true,
  creadoEn: "2026-01-01T00:00:00.000Z",
  evidenciasCount: 1,
  ...cambios,
});

const plan = (cambios: Partial<PlanAccion> = {}): PlanAccion => ({
  id: 7,
  publicId: "PACC-2026-007",
  hallazgo: hallazgo("HAL-1"),
  titulo: "Corregir conciliaciones",
  causaRaiz: "Falta de revisión",
  descripcion: "Falta de revisión",
  responsable: { id: 10, nombre: "Responsable" },
  fechaCompromiso: "2026-03-01",
  status: "Pendiente",
  estado: "Pendiente",
  creadoEn: "2026-01-01T00:00:00.000Z",
  creadoPorId: 30,
  hallazgosRelacionados: [hallazgo("HAL-1"), hallazgo("HAL-2")],
  pasos: [paso(1, 20), paso(2, 21)],
  ...cambios,
});

describe("impedimentoRevision", () => {
  it("permite revisar a un Jefe de Auditoría ajeno al plan", () => {
    expect(impedimentoRevision(plan(), { id: 99, rol: "Jefe de Auditoría" })).toBeNull();
  });

  it("permite revisar a un Administrador ajeno al plan", () => {
    expect(impedimentoRevision(plan(), { id: 99, rol: "Administrador" })).toBeNull();
  });

  it("no permite revisar a un Auditor", () => {
    expect(impedimentoRevision(plan(), { id: 99, rol: "Auditor" })).toEqual(expect.any(String));
  });

  it("no permite revisar al responsable del plan aunque tenga el rol", () => {
    expect(impedimentoRevision(plan(), { id: 10, rol: "Jefe de Auditoría" })).toEqual(expect.any(String));
  });

  it("no permite revisar a quien tiene un paso asignado aunque tenga el rol", () => {
    expect(impedimentoRevision(plan(), { id: 21, rol: "Administrador" })).toEqual(expect.any(String));
  });

  it("permite revisar a quien creó el plan si no es responsable ni asignado", () => {
    expect(impedimentoRevision(plan(), { id: 30, rol: "Jefe de Auditoría" })).toBeNull();
  });
});

describe("validarMotivoRechazo", () => {
  it.each([
    ["sin motivo", undefined],
    ["solo con espacios", "   "],
    ["que no es texto", 123],
    ["de 2001 caracteres", "a".repeat(2001)],
  ])("rechaza un motivo %s", (_caso, motivo) => {
    expect(validarMotivoRechazo(motivo)).toEqual(expect.any(String));
  });

  it("acepta un motivo con texto", () => {
    expect(validarMotivoRechazo("Falta evidencia")).toBeNull();
  });

  it("acepta un motivo de 2000 caracteres", () => {
    expect(validarMotivoRechazo("a".repeat(2000))).toBeNull();
  });
});

describe("huellaContenidoPlan", () => {
  const evidencias = { 1: ["aaa", "bbb"], 2: ["ccc"] };

  it("es un SHA-256 en hexadecimal", () => {
    expect(huellaContenidoPlan(plan(), evidencias)).toMatch(/^[0-9a-f]{64}$/);
  });

  it("no depende del orden de los pasos, los hallazgos ni las evidencias", () => {
    const base = plan();
    const desordenado = plan({
      pasos: [...base.pasos].reverse(),
      hallazgosRelacionados: [...base.hallazgosRelacionados].reverse(),
    });
    expect(huellaContenidoPlan(desordenado, { 1: ["bbb", "aaa"], 2: ["ccc"] })).toBe(huellaContenidoPlan(base, evidencias));
  });

  it("cambia si cambia la descripción de un paso", () => {
    const cambiado = plan({ pasos: [paso(1, 20, { descripcion: "Otro texto" }), paso(2, 21)] });
    expect(huellaContenidoPlan(cambiado, evidencias)).not.toBe(huellaContenidoPlan(plan(), evidencias));
  });

  it("cambia si cambia el hash de una evidencia", () => {
    expect(huellaContenidoPlan(plan(), { 1: ["aaa", "zzz"], 2: ["ccc"] })).not.toBe(huellaContenidoPlan(plan(), evidencias));
  });

  it("cambia si se agrega una evidencia", () => {
    expect(huellaContenidoPlan(plan(), { 1: ["aaa", "bbb", "ddd"], 2: ["ccc"] })).not.toBe(huellaContenidoPlan(plan(), evidencias));
  });

  it("no cambia si solo cambia el estado", () => {
    const aprobado = plan({ estado: "Aprobado", status: "Aprobado" });
    expect(huellaContenidoPlan(aprobado, evidencias)).toBe(huellaContenidoPlan(plan(), evidencias));
  });
});

describe("destinatariosCambio", () => {
  it("incluye al responsable, a los asignados y a quien creó el plan", () => {
    expect(destinatariosCambio(plan(), 99).sort((a, b) => a - b)).toEqual([10, 20, 21, 30]);
  });

  it("no repite usuarios", () => {
    const repetido = plan({ creadoPorId: 10, pasos: [paso(1, 10), paso(2, 20), paso(3, 20)] });
    expect(destinatariosCambio(repetido, 99).sort((a, b) => a - b)).toEqual([10, 20]);
  });

  it("no incluye a quien hizo el cambio", () => {
    expect(destinatariosCambio(plan(), 30)).not.toContain(30);
  });

  it("omite pasos sin usuario asignado", () => {
    const sinAsignar = plan({ pasos: [paso(1, 20, { usuarioAsignado: null })] });
    expect(destinatariosCambio(sinAsignar, 99).sort((a, b) => a - b)).toEqual([10, 30]);
  });
});
