import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as controles from "../api/controles";
import * as planes from "../api/planes";
import VistaControlDetallado from "./VistaControlDetallado";

vi.mock("../api/controles", async (original) => ({ ...(await original<typeof controles>()), listarControles: vi.fn() }));
vi.mock("../api/planes", () => ({ obtenerPlanAuditoria: vi.fn() }));
vi.mock("../api/auditControls", () => ({
  actualizarAsignacionStatus: vi.fn(),
  consultarRevisionControl: vi.fn().mockResolvedValue({ puede_revisar: false, plan_id: 7, status: "En Progreso", feedback: null }),
  consultarMiAsignacionControl: vi.fn().mockResolvedValue({ asignado: true, status: "En Progreso" }),
}));
vi.mock("./ConflictosPlan", () => ({ useDeclaracionesPendientes: () => ({ pendientes: [] }), AvisoDeclaracionesPendientes: () => null }));
vi.mock("./EvidenciasSection", () => ({ default: () => <div>Evidencias</div> }));

beforeEach(() => {
  vi.mocked(controles.listarControles).mockResolvedValue([
    {
      id: "CTR-002",
      auditEntityId: "",
      specificRiskIds: [],
      controlProcedureName: "Segregación de Funciones",
      validityStatus: "Vigente",
      businessControlNumber: "CTR-002",
      controlActivity: "Verificación semestral de accesos en el ERP.",
      currentVulnerability: "Baja",
      controlType: "Detectivo",
      frequency: "Semestral",
      sampleSize: "25",
      rotation: "",
      controlStatus: "Activo",
      status: "En Revision",
      horasInvertidas: 4,
      feedback: null,
      auditIds: [7],
    },
  ]);
  vi.mocked(planes.obtenerPlanAuditoria).mockResolvedValue({
    id: 7,
    codigo: "PAA-2026-001",
    nombre: "Plan anual de Tecnología 2026",
    tipo: "Anual",
    periodo: null,
    fechaInicio: "2026-07-01",
    fechaFin: "2026-12-31",
    estado: "En Ejecución",
    horasEstimadas: 120,
    responsable: { id: 2, nombre: "Carlos Senior" },
    alcance: "Accesos a sistemas financieros.",
  });
});

describe("VistaControlDetallado", () => {
  it("muestra los datos reales del control y su plan, sin datos inventados", async () => {
    render(<VistaControlDetallado id="CTR-002" auditId="7" crumbs={null} />);

    expect(await screen.findByText("Segregación de Funciones")).toBeInTheDocument();
    expect(screen.getByText("25")).toBeInTheDocument();
    expect(screen.getByText("No definido")).toBeInTheDocument();
    expect(screen.getByText("En Revision")).toBeInTheDocument();
    expect(await screen.findByText("PAA-2026-001")).toBeInTheDocument();
    expect(screen.getByText("Accesos a sistemas financieros.")).toBeInTheDocument();
    expect(screen.queryByText("FEMSA Departamento de Auditorias")).not.toBeInTheDocument();
    expect(screen.queryByText("Semanal")).not.toBeInTheDocument();
    expect(screen.queryByText("Seguimiento de Procedimientos")).not.toBeInTheDocument();
    expect(planes.obtenerPlanAuditoria).toHaveBeenCalledWith("7");
  });
});
