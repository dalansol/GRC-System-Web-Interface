import { describe, expect, it } from "vitest";
import { correoValido, dominioPermitido, normalizarCorreo } from "../src/domain/dominio.js";

const DOMINIOS = ["expedite.com"];

describe("correoValido", () => {
  it.each(["a.lopez@expedite.com", "A.Lopez@Expedite.COM", "x+y@sub.dominio.mx"])(
    "acepta %s",
    (correo) => expect(correoValido(correo)).toBe(true),
  );

  it.each(["", "sin-arroba", "@expedite.com", "a@", "a@@expedite.com", "a b@expedite.com", "a@expedite", "a@.com"])(
    "rechaza %j",
    (correo) => expect(correoValido(correo)).toBe(false),
  );
});

describe("dominioPermitido", () => {
  it("acepta el dominio corporativo", () => {
    expect(dominioPermitido("a.lopez@expedite.com", DOMINIOS)).toBe(true);
  });

  it("no distingue mayúsculas en el dominio", () => {
    expect(dominioPermitido("a.lopez@Expedite.COM", DOMINIOS)).toBe(true);
  });

  it("rechaza un dominio ajeno", () => {
    expect(dominioPermitido("a.lopez@gmail.com", DOMINIOS)).toBe(false);
  });

  it("rechaza un subdominio del dominio corporativo", () => {
    expect(dominioPermitido("a.lopez@mail.expedite.com", DOMINIOS)).toBe(false);
  });

  it("rechaza dominios que solo terminan igual", () => {
    expect(dominioPermitido("a.lopez@malexpedite.com", DOMINIOS)).toBe(false);
  });

  it("rechaza dominios que solo empiezan igual", () => {
    expect(dominioPermitido("a.lopez@expedite.com.evil.com", DOMINIOS)).toBe(false);
  });

  it("acepta cualquiera de varios dominios autorizados", () => {
    expect(dominioPermitido("a@femsa.com", ["expedite.com", "femsa.com"])).toBe(true);
  });

  it("rechaza todo si no hay dominios configurados", () => {
    expect(dominioPermitido("a@expedite.com", [])).toBe(false);
  });
});

describe("normalizarCorreo", () => {
  it("quita espacios y pasa a minúsculas", () => {
    expect(normalizarCorreo("  A.Lopez@Expedite.COM ")).toBe("a.lopez@expedite.com");
  });
});
