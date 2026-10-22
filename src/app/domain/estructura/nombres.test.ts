import { describe, expect, it } from "vitest";
import { nombreVisible, tieneNombre } from "./nombres";

describe("nombreVisible", () => {
  it("usa el nombre si existe y si no el código", () => {
    expect(nombreVisible({ codigo: "UDN-0003", nombre: "KOF" })).toBe("KOF");
    expect(nombreVisible({ codigo: "UDN-0003", nombre: null })).toBe("UDN-0003");
    expect(nombreVisible({ codigo: "UDN-0003", nombre: "   " })).toBe("UDN-0003");
    expect(nombreVisible({ nombre: "Nómina" })).toBe("Nómina");
  });

  it("solo marca nombre propio cuando hay código y es distinto de él", () => {
    expect(tieneNombre({ codigo: "UDN-0003", nombre: "KOF" })).toBe(true);
    expect(tieneNombre({ codigo: "UDN-0003", nombre: "UDN-0003" })).toBe(false);
    expect(tieneNombre({ codigo: "UDN-0003", nombre: null })).toBe(false);
    // El área no tiene código.
    expect(tieneNombre({ nombre: "Nómina" })).toBe(false);
  });
});
