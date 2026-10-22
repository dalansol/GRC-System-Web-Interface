import { describe, expect, it } from "vitest";
import { CONTEXTO_MAX, contextoDetalle, contextoPorEtiqueta, contextoVista } from "./contextoVista";

describe("contextoVista", () => {
  it("arma el contexto de una vista con sus datos", () => {
    const contexto = contextoVista("controles");

    expect(contexto?.vista).toBe("Controles");
    expect(JSON.parse(contexto!.contexto).controles.length).toBeGreaterThan(0);
  });

  it("no da contexto en vistas sin datos para el asistente", () => {
    expect(contextoVista("editor")).toBeNull();
    expect(contextoVista("users")).toBeNull();
  });

  it("nunca pasa del límite del backend", () => {
    for (const vista of ["dashboard", "filter", "hierarchy", "plans", "findings", "controles", "bitacora"]) {
      expect(contextoVista(vista)!.contexto.length).toBeLessThanOrEqual(CONTEXTO_MAX);
    }
  });
});

describe("contextoDetalle", () => {
  it("incluye el registro y lo que lo menciona", () => {
    const contexto = contextoDetalle("control", "CTR-002");
    const datos = JSON.parse(contexto!.contexto);

    expect(contexto?.vista).toBe("Control CTR-002");
    expect(datos.registro.id).toBe("CTR-002");
    expect(JSON.stringify(datos.relacionados)).toContain("CTR-002");
  });

  it("devuelve null si el registro no existe", () => {
    expect(contextoDetalle("control", "CTR-999")).toBeNull();
  });

  it("traduce las etiquetas de la tarjeta de resumen", () => {
    expect(contextoPorEtiqueta("Control", "CTR-001")?.vista).toBe("Control CTR-001");
    expect(contextoPorEtiqueta("Otra cosa", "CTR-001")).toBeNull();
  });
});
