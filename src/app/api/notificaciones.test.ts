import { describe, expect, it } from "vitest";
import { destinoDeNotificacion, type Notificacion } from "./notificaciones";

const aviso = (cambios: Partial<Notificacion> = {}): Notificacion => ({
  id: 1,
  tipo: "plan_accion.aprobacion",
  mensaje: "Aviso",
  entidadTipo: "action_plan",
  entidadId: "7",
  leida: false,
  fecha: "2026-11-04T10:00:00.000Z",
  ...cambios,
});

describe("destinoDeNotificacion", () => {
  it("un plan por revisar lleva al Jefe de Auditoría a la bandeja", () => {
    expect(destinoDeNotificacion(aviso({ tipo: "plan_accion.envio" }), "Jefe de Auditoría")).toEqual({ planId: 7, pestana: "revision" });
  });

  it("una prórroga por decidir lo lleva a las prórrogas", () => {
    expect(destinoDeNotificacion(aviso({ tipo: "plan_accion.solicitud_prorroga" }), "Jefe de Auditoría")).toEqual({ planId: 7, pestana: "prorrogas" });
  });

  it.each(["plan_accion.aprobacion", "plan_accion.rechazo", "plan_accion.pasos_completos", "plan_accion.decision_prorroga"])(
    "%s lleva al seguimiento del plan",
    (tipo) => {
      expect(destinoDeNotificacion(aviso({ tipo }), "Auditor")).toEqual({ planId: 7, pestana: "seguimiento" });
    },
  );

  it("quien no revisa nunca llega a la bandeja ni a las prórrogas", () => {
    expect(destinoDeNotificacion(aviso({ tipo: "plan_accion.envio" }), "Auditor")).toEqual({ planId: 7, pestana: "seguimiento" });
    expect(destinoDeNotificacion(aviso({ tipo: "plan_accion.solicitud_prorroga" }), "Jefe Auditado")).toEqual({ planId: 7, pestana: "seguimiento" });
  });

  it("sin un plan válido no hay destino", () => {
    expect(destinoDeNotificacion(aviso({ entidadTipo: "control" }), "Auditor")).toBeNull();
    expect(destinoDeNotificacion(aviso({ entidadId: "abc" }), "Auditor")).toBeNull();
  });
});
