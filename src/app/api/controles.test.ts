import { beforeEach, describe, expect, it, vi } from "vitest";
import { pedir } from "./cliente";
import { listarControles } from "./controles";

vi.mock("./cliente", () => ({ pedir: vi.fn() }));

const CONTROL = { id: "CTR-001", code: "CP-001", name: "Conciliación" };

describe("listarControles", () => {
  beforeEach(() => vi.clearAllMocks());

  it("indica qué controles tienen deficiencia", async () => {
    vi.mocked(pedir).mockResolvedValue([
      { ...CONTROL, tiene_deficiencia: true },
      { ...CONTROL, id: "CTR-002", tiene_deficiencia: false },
    ]);

    const controles = await listarControles();

    expect(controles.map((c) => c.tieneDeficiencia)).toEqual([true, false]);
  });
});
