import { describe, expect, it } from "vitest";
import { nombreVisible, tieneNombreReal } from "./nombres";

describe("nombreVisible", () => {
  it("usa el nombre real si existe y si no el código", () => {
    expect(nombreVisible({ nombre: "UDN-0003", nombreReal: "KOF" })).toBe("KOF");
    expect(nombreVisible({ nombre: "UDN-0003", nombreReal: null })).toBe("UDN-0003");
    expect(nombreVisible({ nombre: "UDN-0003", nombreReal: "   " })).toBe("UDN-0003");
    expect(nombreVisible({ nombre: "Nómina" })).toBe("Nómina");
  });

  it("solo marca nombre real cuando es distinto del código", () => {
    expect(tieneNombreReal({ nombre: "UDN-0003", nombreReal: "KOF" })).toBe(true);
    expect(tieneNombreReal({ nombre: "UDN-0003", nombreReal: "UDN-0003" })).toBe(false);
    expect(tieneNombreReal({ nombre: "UDN-0003", nombreReal: null })).toBe(false);
  });
});
