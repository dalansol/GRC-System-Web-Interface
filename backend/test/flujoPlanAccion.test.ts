import { describe, expect, it } from "vitest";
import {
  abiertoParaAuditado,
  destinatariosCambio,
  esAuditado,
  estadosEnviables,
  huellaContenidoPlan,
  impedimentoEnvio,
  impedimentoRevision,
  validarMotivoRechazo,
  validarSolicitudProrroga,
  vistaAuditadoPlan,
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
  etapa: "cierre",
  hallazgosRelacionados: [hallazgo("HAL-1"), hallazgo("HAL-2")],
  pasos: [paso(1, 20), paso(2, 21)],
  ...cambios,
});

describe("impedimentoRevision", () => {
  it("permite revisar a un Jefe de Auditoría ajeno al plan", () => {
    expect(impedimentoRevision(plan(), { id: 99, rol: "Jefe de Auditoría" })).toBeNull();
  });

  it("no permite revisar a un Administrador: el SRS lo define como soporte técnico", () => {
    expect(impedimentoRevision(plan(), { id: 99, rol: "Administrador" })).toEqual(expect.any(String));
  });

  it("no permite revisar a un Auditor", () => {
    expect(impedimentoRevision(plan(), { id: 99, rol: "Auditor" })).toEqual(expect.any(String));
  });

  it("no permite revisar al responsable del plan aunque tenga el rol", () => {
    expect(impedimentoRevision(plan(), { id: 10, rol: "Jefe de Auditoría" })).toEqual(expect.any(String));
  });

  it("no permite revisar a quien tiene un paso asignado aunque tenga el rol", () => {
    expect(impedimentoRevision(plan(), { id: 21, rol: "Jefe de Auditoría" })).toEqual(expect.any(String));
  });

  it("no permite revisar a quien creó el plan", () => {
    expect(impedimentoRevision(plan(), { id: 30, rol: "Jefe de Auditoría" })).toEqual(expect.any(String));
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

  it("un rechazo en la definición solo avisa a quien creó el plan: el auditado aún no lo ve", () => {
    expect(destinatariosCambio(plan({ etapa: "definicion" }), 99, "rechazo")).toEqual([30]);
  });

  it("una aprobación en la definición sí avisa a los auditados", () => {
    expect(destinatariosCambio(plan({ etapa: "definicion" }), 99, "aprobacion").sort((a, b) => a - b)).toEqual([10, 20, 21, 30]);
  });

  it("un rechazo en el cierre avisa a todo el equipo del plan", () => {
    expect(destinatariosCambio(plan(), 99, "rechazo").sort((a, b) => a - b)).toEqual([10, 20, 21, 30]);
  });
});

describe("esAuditado", () => {
  it.each(["Jefe Auditado", "Empleado Auditado"])("reconoce a %s", (rol) => {
    expect(esAuditado(rol)).toBe(true);
  });

  it.each(["Auditor", "Auditor Senior", "Jefe de Auditoría", "Administrador", "Consultor"])("no incluye a %s", (rol) => {
    expect(esAuditado(rol)).toBe(false);
  });
});

describe("impedimentoEnvio", () => {
  it.each(["Auditor", "Auditor Senior"])("permite enviar a un %s ajeno al plan", (rol) => {
    expect(impedimentoEnvio(plan(), { id: 99, rol })).toBeNull();
  });

  it.each(["Jefe de Auditoría", "Administrador", "Jefe Auditado", "Empleado Auditado"])("no permite enviar a %s", (rol) => {
    expect(impedimentoEnvio(plan(), { id: 99, rol })).toEqual(expect.any(String));
  });

  it("no permite enviar al auditor que es responsable de un plan anterior", () => {
    expect(impedimentoEnvio(plan(), { id: 10, rol: "Auditor Senior" })).toEqual(expect.any(String));
  });

  it("no permite enviar al auditor que tiene un paso asignado", () => {
    expect(impedimentoEnvio(plan(), { id: 20, rol: "Auditor" })).toEqual(expect.any(String));
  });
});

describe("estadosEnviables", () => {
  it("en la definición se envía un borrador o un plan rechazado", () => {
    expect(estadosEnviables("definicion")).toEqual(["Borrador", "Rechazado"]);
  });

  it("en el cierre se envía un plan en curso o rechazado", () => {
    expect(estadosEnviables("cierre")).toEqual(["Asignado", "En Progreso", "Completado", "Rechazado"]);
  });
});

describe("abiertoParaAuditado", () => {
  it.each(["Asignado", "En Progreso", "Completado", "Rechazado"] as const)("en el cierre permite trabajar en %s", (estado) => {
    expect(abiertoParaAuditado(plan({ estado, status: estado }))).toBe(true);
  });

  it.each(["Pendiente", "En Revisión", "Aprobado"] as const)("en el cierre no permite trabajar en %s", (estado) => {
    expect(abiertoParaAuditado(plan({ estado, status: estado }))).toBe(false);
  });

  it.each(["Borrador", "Rechazado", "Pendiente"] as const)("en la definición nunca permite trabajar (%s)", (estado) => {
    expect(abiertoParaAuditado(plan({ etapa: "definicion", estado, status: estado }))).toBe(false);
  });
});

describe("vistaAuditadoPlan", () => {
  const rechazo = {
    motivo: "Falta el soporte de marzo",
    fecha: "2026-02-10T00:00:00.000Z",
    evidenciasObservadas: [
      { evidenciaId: "EV-1", pasoId: 1, nombre: "conciliacion.pdf" },
      { evidenciaId: "EV-2", pasoId: 2, nombre: "otro.pdf" },
    ],
  };
  const rechazado = plan({ estado: "Rechazado", status: "Rechazado" });

  it("expone solo los campos acordados", () => {
    expect(Object.keys(vistaAuditadoPlan(plan(), 10, null, null)).sort()).toEqual(
      ["esResponsable", "estado", "fechaCompromiso", "hallazgo", "id", "pasos", "prorroga", "publicId", "rechazo", "titulo"].sort(),
    );
  });

  it("del hallazgo expone solo el folio y el título", () => {
    expect(vistaAuditadoPlan(plan(), 10, null, null).hallazgo).toEqual({ folio: "HAL-1", titulo: "Hallazgo HAL-1" });
  });

  it("no filtra la causa raíz, la severidad ni quién creó el plan", () => {
    const texto = JSON.stringify(vistaAuditadoPlan(plan(), 10, null, null));
    expect(texto).not.toContain("Falta de revisión");
    expect(texto).not.toContain("Alto");
    expect(texto).not.toContain("creadoPorId");
  });

  it("de cada paso expone solo lo que el auditado necesita", () => {
    expect(Object.keys(vistaAuditadoPlan(plan(), 10, null, null).pasos[0]!).sort()).toEqual(
      ["completado", "descripcion", "esMio", "evidenciasCount", "fechaCompromiso", "id", "usuarioAsignado"].sort(),
    );
  });

  it("el responsable ve todos los pasos y sabe cuáles no son suyos", () => {
    const vista = vistaAuditadoPlan(plan(), 10, null, null);
    expect(vista.esResponsable).toBe(true);
    expect(vista.pasos.map((p) => p.id)).toEqual([1, 2]);
    expect(vista.pasos.map((p) => p.esMio)).toEqual([false, false]);
  });

  it("un asignado ve solo sus pasos", () => {
    const vista = vistaAuditadoPlan(plan(), 21, null, null);
    expect(vista.esResponsable).toBe(false);
    expect(vista.pasos.map((p) => p.id)).toEqual([2]);
    expect(vista.pasos[0]!.esMio).toBe(true);
  });

  it("el responsable que también tiene un paso lo ve como suyo", () => {
    const vista = vistaAuditadoPlan(plan({ pasos: [paso(1, 10), paso(2, 21)] }), 10, null, null);
    expect(vista.pasos.map((p) => p.esMio)).toEqual([true, false]);
  });

  it("muestra el rechazo mientras el plan está rechazado", () => {
    expect(vistaAuditadoPlan(rechazado, 10, rechazo, null).rechazo?.motivo).toBe("Falta el soporte de marzo");
  });

  it("no muestra un rechazo anterior si el plan ya no está rechazado", () => {
    expect(vistaAuditadoPlan(plan({ estado: "En Progreso", status: "En Progreso" }), 10, rechazo, null).rechazo).toBeNull();
  });

  it("un asignado solo ve los archivos observados de sus pasos", () => {
    expect(vistaAuditadoPlan(rechazado, 21, rechazo, null).rechazo?.evidenciasObservadas.map((e) => e.evidenciaId)).toEqual(["EV-2"]);
  });

  it("el responsable ve todos los archivos observados", () => {
    expect(vistaAuditadoPlan(rechazado, 10, rechazo, null).rechazo?.evidenciasObservadas).toHaveLength(2);
  });

  it("del rechazo no expone quién lo decidió", () => {
    expect(Object.keys(vistaAuditadoPlan(rechazado, 10, rechazo, null).rechazo!).sort()).toEqual(["evidenciasObservadas", "fecha", "motivo"]);
  });

  it("solo el responsable ve su solicitud de prórroga", () => {
    const prorroga = {
      id: 1,
      planAccionId: 7,
      folioPlan: "PACC-2026-007",
      solicitadaPor: { id: 10, nombre: "Responsable" },
      fechaActual: "2026-03-01",
      fechaPropuesta: "2026-04-01",
      justificacion: "Depende de un proveedor",
      estado: "Pendiente" as const,
      motivoDecision: null,
      creadaEn: "2026-02-01T00:00:00.000Z",
    };
    expect(vistaAuditadoPlan(plan(), 10, null, prorroga).prorroga?.fechaPropuesta).toBe("2026-04-01");
    expect(vistaAuditadoPlan(plan(), 21, null, prorroga).prorroga).toBeNull();
  });
});

describe("validarSolicitudProrroga", () => {
  const validar = (cambios: Record<string, unknown> = {}, cierre: string | null = "2026-01-31") =>
    validarSolicitudProrroga({ fechaPropuesta: "2026-04-01", justificacion: "Depende de un proveedor", ...cambios }, "2026-03-01", cierre);

  it("acepta una fecha posterior con justificación", () => {
    expect(validar()).toBeNull();
  });

  it.each([["sin fecha", undefined], ["con formato inválido", "01/04/2026"]])("rechaza una fecha %s", (_caso, fechaPropuesta) => {
    expect(validar({ fechaPropuesta })).toEqual(expect.any(String));
  });

  it("rechaza una fecha igual a la actual", () => {
    expect(validar({ fechaPropuesta: "2026-03-01" })).toEqual(expect.any(String));
  });

  it("rechaza una fecha anterior a la actual", () => {
    expect(validar({ fechaPropuesta: "2026-02-15" })).toEqual(expect.any(String));
  });

  it("rechaza una fecha anterior al cierre de la auditoría", () => {
    expect(validar({ fechaPropuesta: "2026-04-01" }, "2026-05-01")).toEqual(expect.any(String));
  });

  it.each([["vacía", "   "], ["ausente", undefined], ["de 2001 caracteres", "a".repeat(2001)]])("rechaza una justificación %s", (_caso, justificacion) => {
    expect(validar({ justificacion })).toEqual(expect.any(String));
  });
});
