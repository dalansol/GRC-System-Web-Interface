import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorApi } from "../../api/cliente";
import * as apiEstructura from "../../api/estructura";
import type { DepartamentoAuditoria, PeriodoFiscal, Responsable, UnidadNegocio } from "../../api/estructura";
import { HierarchyView } from "./HierarchyView";

vi.mock("../../api/estructura", async (original) => ({
  ...(await original<typeof apiEstructura>()),
  obtenerPeriodoActivo: vi.fn(),
  listarPeriodos: vi.fn(),
  listarDepartamentos: vi.fn(),
  listarUnidades: vi.fn(),
  listarResponsables: vi.fn(),
  obtenerUnidadPorId: vi.fn(),
  crearUnidadNegocio: vi.fn(),
  editarUnidadNegocio: vi.fn(),
  eliminarUnidadNegocio: vi.fn(),
  crearNodo: vi.fn(),
  editarNodo: vi.fn(),
  eliminarNodo: vi.fn(),
}));

const ADMIN = {
  id: 1,
  nombre: "Sofía Ramírez",
  correo: "s.ramirez@expedite.com",
  rol: "Administrador",
  estado: "active" as const,
  ultimoAcceso: null,
  permisos: ["Ver Dashboard"],
};

const sesion = vi.hoisted(() => ({
  usuario: null as unknown as {
    id: number;
    nombre: string;
    correo: string;
    rol: string;
    estado: "active";
    ultimoAcceso: null;
    permisos: string[];
  },
  esAdministrador: true,
  recargar: vi.fn(async () => {}),
}));

vi.mock("../../auth/SesionContext", () => ({
  useSesion: () => sesion,
}));

const toast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));
vi.mock("sonner", () => ({ toast }));

const PERIODO_ACTIVO: PeriodoFiscal = {
  id: 2,
  nombre: "2026Q4",
  fechaInicio: "2026-10-01",
  fechaFin: "2026-12-31",
  activo: true,
};

const DEPARTAMENTOS: DepartamentoAuditoria[] = [
  { id: 1, nombre: "Retail & Spin" },
  { id: 2, nombre: "Beverage" },
];

const RESPONSABLES: Responsable[] = [
  { id: 2, nombre: "María García", correo: "m.garcia@expedite.com", rol: "Jefe de Auditoría" },
];

const UNIDAD: UnidadNegocio = {
  id: 10,
  nombre: "UDN-0001",
  nombreReal: null,
  responsableId: 2,
  responsableNombre: "María García",
  periodoFiscalId: 2,
  periodoFiscalNombre: "2026Q4",
  departamentoAuditoriaId: 1,
  departamentoAuditoriaNombre: "Retail & Spin",
  creadoPor: 1,
  creadoEn: "2026-10-01T10:00:00Z",
  divisiones: [
    {
      id: 100,
      nombre: "DIVISION-0001",
      nombreReal: null,
      unidadNegocioId: 10,
      subdivisiones: [
        {
          id: 200,
          nombre: "SUBDIVISION-0001",
          nombreReal: null,
          pais: "México",
          divisionId: 100,
          areas: [{ id: 300, nombre: "Nómina", subdivisionId: 200 }],
          riesgos: [
            {
              id: 900,
              nombre: "Pagos de nómina sin doble aprobación",
              nivel: "Alto",
              procedimientoControl: "Doble aprobación del layout",
            },
            { id: 901, nombre: "Altas de proveedores sin validación", nivel: "Bajo", procedimientoControl: null },
          ],
        },
      ],
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  sesion.usuario = { ...ADMIN };
  sesion.esAdministrador = true;

  vi.mocked(apiEstructura.obtenerPeriodoActivo).mockResolvedValue(PERIODO_ACTIVO);
  vi.mocked(apiEstructura.listarPeriodos).mockResolvedValue([PERIODO_ACTIVO]);
  vi.mocked(apiEstructura.listarDepartamentos).mockResolvedValue(DEPARTAMENTOS);
  vi.mocked(apiEstructura.listarUnidades).mockResolvedValue([UNIDAD]);
  vi.mocked(apiEstructura.listarResponsables).mockResolvedValue(RESPONSABLES);
});

describe("Catálogo de estructura organizacional (HierarchyView)", () => {
  it("CP-FE-01 (AC1): muestra la jerarquía completa, gerente, departamento y periodo activo", async () => {
    render(<HierarchyView />);

    await waitFor(() => expect(screen.getByText(/Periodo Activo: 2026Q4/i)).toBeInTheDocument());

    expect(screen.getByText("UDN-0001")).toBeInTheDocument();
    expect(screen.getByText("María García")).toBeInTheDocument();
    expect(screen.getByText("Retail & Spin")).toBeInTheDocument();
    expect(screen.getByText("DIVISION-0001")).toBeInTheDocument();
    expect(screen.getByText("SUBDIVISION-0001")).toBeInTheDocument();
    expect(screen.getByText("México")).toBeInTheDocument();
    expect(within(screen.getByTestId("nodo-area-300")).getByText("Nómina")).toBeInTheDocument();
    expect(within(screen.getByTestId("nodo-area-300")).getByText("Área (proceso)")).toBeInTheDocument();
  });

  it("CP-FE-02 (AC1): crea una unidad con gerente y departamento, sin proceso inicial", async () => {
    const usuario = userEvent.setup();
    vi.mocked(apiEstructura.crearUnidadNegocio).mockResolvedValue({
      ...UNIDAD,
      id: 20,
      nombre: "UDN-0003",
      departamentoAuditoriaId: 2,
      departamentoAuditoriaNombre: "Beverage",
      divisiones: [],
    });

    render(<HierarchyView />);
    await usuario.click(await screen.findByTestId("btn-nueva-unidad"));

    await usuario.type(screen.getByLabelText(/Nombre de la Unidad de Negocio/i), "UDN-0003");
    await usuario.selectOptions(screen.getByLabelText(/Gerente Responsable/i), "2");
    await usuario.selectOptions(screen.getByLabelText(/Departamento de Auditoría/i), "2");
    await usuario.click(screen.getByRole("button", { name: /Guardar Unidad/i }));

    await waitFor(() => {
      expect(apiEstructura.crearUnidadNegocio).toHaveBeenCalledWith({
        nombre: "UDN-0003",
        nombreReal: null,
        responsableId: 2,
        departamentoAuditoriaId: 2,
      });
      expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('"UDN-0003" creada exitosamente'));
    });
    expect(screen.getByText("UDN-0003")).toBeInTheDocument();
  });

  it("CP-FE-03 (AC2): con NOMBRE_DUPLICADO muestra el mensaje en el formulario y lo mantiene abierto", async () => {
    const usuario = userEvent.setup();
    const mensaje = 'Ya existe una unidad de negocio con el nombre "UDN-0001".';
    vi.mocked(apiEstructura.crearUnidadNegocio).mockRejectedValue(new ErrorApi(409, "NOMBRE_DUPLICADO", mensaje));

    render(<HierarchyView />);
    await usuario.click(await screen.findByTestId("btn-nueva-unidad"));

    await usuario.type(screen.getByLabelText(/Nombre de la Unidad de Negocio/i), "udn-0001");
    await usuario.selectOptions(screen.getByLabelText(/Gerente Responsable/i), "2");
    await usuario.click(screen.getByRole("button", { name: /Guardar Unidad/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(mensaje);
    expect(toast.error).toHaveBeenCalledWith(mensaje);
    expect(screen.getByRole("button", { name: /Guardar Unidad/i })).toBeInTheDocument();
  });

  it("CP-FE-04 (AC1): agrega una subdivisión con país dentro de una división y refresca la unidad", async () => {
    const usuario = userEvent.setup();
    vi.mocked(apiEstructura.crearNodo).mockResolvedValue({ id: 201, nombre: "SUBDIVISION-0002", nombreReal: null, padreId: 100 });
    const division = UNIDAD.divisiones[0]!;
    vi.mocked(apiEstructura.obtenerUnidadPorId).mockResolvedValue({
      ...UNIDAD,
      divisiones: [
        {
          ...division,
          subdivisiones: [
            ...division.subdivisiones,
            { id: 201, nombre: "SUBDIVISION-0002", nombreReal: null, pais: "KFS RTR", divisionId: 100, areas: [], riesgos: [] },
          ],
        },
      ],
    });

    render(<HierarchyView />);
    await usuario.click(await screen.findByTestId("btn-agregar-division-100"));

    expect(screen.getByText("Agregar Subdivisión")).toBeInTheDocument();
    await usuario.type(screen.getByLabelText(/^Nombre\s*\*/i), "SUBDIVISION-0002");
    await usuario.type(screen.getByLabelText(/País o región/i), "KFS RTR");
    await usuario.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => {
      expect(apiEstructura.crearNodo).toHaveBeenCalledWith("subdivision", {
        nombre: "SUBDIVISION-0002",
        nombreReal: null,
        pais: "KFS RTR",
        padreId: 100,
      });
      expect(apiEstructura.obtenerUnidadPorId).toHaveBeenCalledWith(10);
    });
    expect(await screen.findByText("SUBDIVISION-0002")).toBeInTheDocument();
  });

  it("CP-FE-05 (AC3): con auditorías activas muestra el bloqueo en el diálogo de eliminación", async () => {
    const usuario = userEvent.setup();
    const mensaje = "No se puede eliminar la unidad de negocio mientras existan auditorías activas asociadas.";
    vi.mocked(apiEstructura.eliminarUnidadNegocio).mockRejectedValue(new ErrorApi(409, "AUDITORIAS_ACTIVAS", mensaje));

    render(<HierarchyView />);
    await usuario.click(await screen.findByTestId("btn-eliminar-unidad-10"));
    await usuario.click(screen.getByTestId("btn-confirmar-eliminar"));

    expect(await screen.findByTestId("error-eliminacion")).toHaveTextContent(mensaje);
    expect(apiEstructura.eliminarUnidadNegocio).toHaveBeenCalledWith(10);
    expect(toast.error).toHaveBeenCalledWith(mensaje);
    // La unidad sigue en el catálogo.
    expect(screen.getAllByText("UDN-0001").length).toBeGreaterThan(0);
  });

  it("CP-FE-06 (AC3): elimina un área sin auditorías activas y la quita del árbol", async () => {
    const usuario = userEvent.setup();
    vi.mocked(apiEstructura.eliminarNodo).mockResolvedValue(undefined);
    const division = UNIDAD.divisiones[0]!;
    vi.mocked(apiEstructura.obtenerUnidadPorId).mockResolvedValue({
      ...UNIDAD,
      divisiones: [{ ...division, subdivisiones: [{ ...division.subdivisiones[0]!, areas: [] }] }],
    });

    render(<HierarchyView />);
    await usuario.click(await screen.findByTestId("btn-eliminar-area-300"));
    await usuario.click(screen.getByTestId("btn-confirmar-eliminar"));

    await waitFor(() => expect(apiEstructura.eliminarNodo).toHaveBeenCalledWith("area", 300));
    await waitFor(() => expect(screen.queryByTestId("nodo-area-300")).not.toBeInTheDocument());
  });

  it("CP-FE-07 (SNF-05): un Auditor Senior consulta el árbol pero no ve acciones de gestión", async () => {
    sesion.usuario = { ...ADMIN, id: 3, nombre: "Carlos Morales", rol: "Auditor Senior" };
    sesion.esAdministrador = false;

    render(<HierarchyView />);
    await screen.findByText("UDN-0001");

    expect(screen.getByText("Nómina")).toBeInTheDocument();
    expect(screen.queryByTestId("btn-nueva-unidad")).not.toBeInTheDocument();
    expect(screen.queryByTestId("btn-eliminar-unidad-10")).not.toBeInTheDocument();
    expect(screen.queryByTestId("btn-eliminar-area-300")).not.toBeInTheDocument();
    expect(apiEstructura.listarResponsables).not.toHaveBeenCalled();
  });

  it("CP-FE-08: muestra los riesgos de cada subdivisión y el resumen por rama, sin pestaña de explorador", async () => {
    render(<HierarchyView />);
    await screen.findByText("UDN-0001");

    expect(screen.queryByText(/Explorador de Riesgos/i)).not.toBeInTheDocument();
    expect(within(screen.getByTestId("riesgo-900")).getByText("Pagos de nómina sin doble aprobación")).toBeInTheDocument();
    expect(within(screen.getByTestId("riesgo-900")).getByText("Control: Doble aprobación del layout")).toBeInTheDocument();
    expect(within(screen.getByTestId("riesgo-901")).getByText("Bajo")).toBeInTheDocument();
    // La división y la unidad suman los riesgos de su rama y se colorean con el peor nivel.
    expect(screen.getByTestId("riesgos-division-100")).toHaveTextContent("2");
    expect(screen.getByTestId("riesgos-division-100")).toHaveAttribute("title", expect.stringContaining("Alto"));
    expect(screen.getByTestId("riesgos-unidad-10")).toHaveTextContent("2");
    expect(screen.queryByTestId("riesgos-area-300")).not.toBeInTheDocument();
  });

  it("CP-FE-09: el filtro por nivel oculta las ramas sin riesgos de ese nivel y la búsqueda encuentra riesgos", async () => {
    const usuario = userEvent.setup();
    render(<HierarchyView />);
    await screen.findByText("UDN-0001");

    await usuario.selectOptions(screen.getByLabelText(/Filtrar por nivel de riesgo/i), "Crítico");
    expect(screen.getByTestId("sin-coincidencias")).toBeInTheDocument();

    await usuario.selectOptions(screen.getByLabelText(/Filtrar por nivel de riesgo/i), "Alto");
    expect(screen.getByTestId("nodo-subdivision-200")).toBeInTheDocument();

    await usuario.selectOptions(screen.getByLabelText(/Filtrar por nivel de riesgo/i), "");
    await usuario.type(screen.getByLabelText(/Buscar en el catálogo/i), "proveedores");
    expect(screen.getByTestId("riesgo-901")).toBeInTheDocument();
    expect(screen.queryByTestId("riesgo-900")).not.toBeInTheDocument();
    expect(screen.queryByTestId("nodo-area-300")).not.toBeInTheDocument();
  });

  it("CP-FE-13: los formularios sugieren áreas, países y el siguiente código del Consolidado", async () => {
    const usuario = userEvent.setup();
    const valores = (id: string) =>
      Array.from(screen.getByTestId(id).querySelectorAll("option")).map((o) => o.getAttribute("value"));

    render(<HierarchyView />);

    // Área: catálogo de FEMSA sin las que ya tiene la subdivisión.
    await usuario.click(await screen.findByTestId("btn-agregar-subdivision-200"));
    expect(screen.getByLabelText(/^Nombre\s*\*/i)).toHaveAttribute("list", "nodo-nombre-sugerencias");
    const areas = valores("nodo-nombre-sugerencias");
    expect(areas[0]).toBe("Administración y Finanzas");
    expect(areas).toContain("Fletes");
    expect(areas).not.toContain("Nómina");
    await usuario.click(screen.getByRole("button", { name: "Cancelar" }));

    // Subdivisión: siguiente código y países del Consolidado.
    await usuario.click(screen.getByTestId("btn-agregar-division-100"));
    expect(valores("nodo-nombre-sugerencias")).toEqual(["SUBDIVISION-0002"]);
    expect(valores("nodo-pais-sugerencias")).toEqual(expect.arrayContaining(["México", "Brasil", "KFS RTR"]));
    await usuario.click(screen.getByRole("button", { name: "Cancelar" }));

    // Unidad: siguiente UDN libre.
    await usuario.click(screen.getByTestId("btn-nueva-unidad"));
    expect(valores("unidad-nombre-sugerencias")).toEqual(["UDN-0002"]);
  });

  describe("Nombre real junto al código", () => {
    const KOF: UnidadNegocio = {
      ...UNIDAD,
      nombre: "UDN-0003",
      nombreReal: "KOF",
      divisiones: [{ ...UNIDAD.divisiones[0]!, nombreReal: "Latam" }],
    };

    it("CP-FE-14: muestra el nombre real con el código aparte en el árbol, las tarjetas y las migas", async () => {
      const usuario = userEvent.setup();
      vi.mocked(apiEstructura.listarUnidades).mockResolvedValue([KOF]);
      render(<HierarchyView />);

      const titulo = await screen.findByRole("button", { name: /KOF/ });
      expect(titulo).toHaveTextContent("KOFUDN-0003");
      expect(within(screen.getByTestId("nodo-division-100")).getByText("Latam")).toBeInTheDocument();
      expect(within(screen.getByTestId("nodo-division-100")).getByText("DIVISION-0001")).toBeInTheDocument();
      // La subdivisión no tiene nombre real: se muestra solo su código.
      expect(within(screen.getByTestId("nodo-subdivision-200")).getAllByText("SUBDIVISION-0001")).toHaveLength(1);

      await usuario.click(screen.getByTestId("btn-ver-tarjetas-10"));
      expect(screen.getByRole("button", { name: "Abrir Latam" })).toBeInTheDocument();
      await usuario.click(screen.getByRole("button", { name: "Abrir Latam" }));
      const migas = screen.getByRole("navigation", { name: /Ruta en la jerarquía/i });
      expect(within(migas).getByRole("button", { name: "KOF" })).toBeInTheDocument();
      expect(within(migas).getByRole("button", { name: "Latam" })).toBeInTheDocument();
    });

    it("CP-FE-15: la búsqueda encuentra por nombre real y por código", async () => {
      const usuario = userEvent.setup();
      vi.mocked(apiEstructura.listarUnidades).mockResolvedValue([KOF, UNIDAD]);
      render(<HierarchyView />);
      await screen.findByText("KOF");

      await usuario.type(screen.getByLabelText(/Buscar en el catálogo/i), "kof");
      expect(screen.getAllByTestId(/^btn-ver-tarjetas-/)).toHaveLength(1);
      await usuario.clear(screen.getByLabelText(/Buscar en el catálogo/i));
      await usuario.type(screen.getByLabelText(/Buscar en el catálogo/i), "UDN-0003");
      expect(screen.getAllByTestId(/^btn-ver-tarjetas-/)).toHaveLength(1);
    });

    it("CP-FE-16: el alta de unidad y de división envía el nombre real; el área no lo pide", async () => {
      const usuario = userEvent.setup();
      vi.mocked(apiEstructura.crearUnidadNegocio).mockResolvedValue({ ...KOF, id: 30, divisiones: [] });
      render(<HierarchyView />);

      await usuario.click(await screen.findByTestId("btn-nueva-unidad"));
      await usuario.type(screen.getByLabelText(/Nombre de la Unidad de Negocio/i), "UDN-0003");
      await usuario.type(screen.getByLabelText(/Nombre real/i), " KOF ");
      await usuario.selectOptions(screen.getByLabelText(/Gerente Responsable/i), "2");
      await usuario.click(screen.getByRole("button", { name: /Guardar Unidad/i }));
      await waitFor(() =>
        expect(apiEstructura.crearUnidadNegocio).toHaveBeenCalledWith(
          expect.objectContaining({ nombre: "UDN-0003", nombreReal: "KOF" }),
        ),
      );

      await usuario.click(screen.getByTestId("btn-agregar-subdivision-200"));
      expect(screen.queryByLabelText(/Nombre real/i)).not.toBeInTheDocument();
    });
  });

  describe("Vista de tarjetas de una unidad", () => {
    it("CP-FE-10: recorre unidad › división › subdivisión y vuelve al catálogo por las migas", async () => {
      const usuario = userEvent.setup();
      render(<HierarchyView />);
      await usuario.click(await screen.findByTestId("btn-ver-tarjetas-10"));

      // Nivel unidad: encabezado con gerente y tarjeta de la división con conteos y riesgos.
      const detalle = screen.getByTestId("detalle-tarjetas");
      expect(within(detalle).getByRole("heading", { name: "UDN-0001" })).toBeInTheDocument();
      expect(within(detalle).getByText("María García")).toBeInTheDocument();
      const tarjetaDivision = screen.getByTestId("tarjeta-division-100");
      expect(tarjetaDivision).toHaveTextContent("1 subdivisión · 1 área");
      expect(tarjetaDivision).toHaveTextContent("2");
      expect(screen.queryByLabelText(/Buscar en el catálogo/i)).not.toBeInTheDocument();

      // Nivel división.
      await usuario.click(within(tarjetaDivision).getByRole("button", { name: "Abrir DIVISION-0001" }));
      expect(screen.getByTestId("tarjeta-subdivision-200")).toHaveTextContent("México");

      // Nivel subdivisión: áreas como tarjetas y la tabla de riesgos.
      await usuario.click(screen.getByRole("button", { name: "Abrir SUBDIVISION-0001" }));
      expect(screen.getByTestId("tarjeta-area-300")).toHaveTextContent("Nómina");
      const tabla = screen.getByTestId("tabla-riesgos");
      expect(within(tabla).getByText("Pagos de nómina sin doble aprobación")).toBeInTheDocument();
      expect(within(tabla).getByText("Doble aprobación del layout")).toBeInTheDocument();
      expect(within(tabla).getByText("Sin procedimiento")).toBeInTheDocument();

      // Migas: a la unidad y luego al catálogo (el árbol vuelve a verse).
      const migas = screen.getByRole("navigation", { name: /Ruta en la jerarquía/i });
      await usuario.click(within(migas).getByRole("button", { name: "UDN-0001" }));
      expect(screen.getByTestId("tarjeta-division-100")).toBeInTheDocument();
      await usuario.click(within(screen.getByRole("navigation", { name: /Ruta en la jerarquía/i })).getByRole("button", { name: /Catálogo/ }));
      expect(screen.getByTestId("nodo-area-300")).toBeInTheDocument();
      expect(screen.queryByTestId("detalle-tarjetas")).not.toBeInTheDocument();
    });

    it("CP-FE-11: agrega una subdivisión desde las tarjetas y la tarjeta nueva aparece", async () => {
      const usuario = userEvent.setup();
      vi.mocked(apiEstructura.crearNodo).mockResolvedValue({ id: 201, nombre: "SUBDIVISION-0002", nombreReal: null, padreId: 100 });
      const division = UNIDAD.divisiones[0]!;
      vi.mocked(apiEstructura.obtenerUnidadPorId).mockResolvedValue({
        ...UNIDAD,
        divisiones: [
          {
            ...division,
            subdivisiones: [
              ...division.subdivisiones,
              { id: 201, nombre: "SUBDIVISION-0002", nombreReal: null, pais: null, divisionId: 100, areas: [], riesgos: [] },
            ],
          },
        ],
      });

      render(<HierarchyView />);
      await usuario.click(await screen.findByTestId("btn-ver-tarjetas-10"));
      await usuario.click(screen.getByRole("button", { name: "Abrir DIVISION-0001" }));
      await usuario.click(screen.getByTestId("btn-agregar-tarjetas"));
      await usuario.type(screen.getByLabelText(/^Nombre\s*\*/i), "SUBDIVISION-0002");
      await usuario.click(screen.getByRole("button", { name: "Guardar" }));

      await waitFor(() =>
        expect(apiEstructura.crearNodo).toHaveBeenCalledWith("subdivision", {
          nombre: "SUBDIVISION-0002",
          nombreReal: null,
          pais: null,
          padreId: 100,
        }),
      );
      expect(await screen.findByTestId("tarjeta-subdivision-201")).toBeInTheDocument();
      // Sigue en la división, no regresa al catálogo.
      expect(screen.getByTestId("detalle-tarjetas")).toBeInTheDocument();
    });

    it("CP-FE-12: un Auditor Senior navega las tarjetas sin acciones de gestión", async () => {
      sesion.usuario = { ...ADMIN, id: 3, nombre: "Carlos Morales", rol: "Auditor Senior" };
      sesion.esAdministrador = false;
      const usuario = userEvent.setup();

      render(<HierarchyView />);
      await usuario.click(await screen.findByTestId("btn-ver-tarjetas-10"));

      expect(screen.queryByTestId("btn-agregar-tarjetas")).not.toBeInTheDocument();
      expect(screen.queryByTestId("btn-eliminar-encabezado")).not.toBeInTheDocument();
      expect(screen.queryByTestId("btn-eliminar-tarjeta-division-100")).not.toBeInTheDocument();
      await usuario.click(screen.getByRole("button", { name: "Abrir DIVISION-0001" }));
      expect(screen.getByTestId("tarjeta-subdivision-200")).toBeInTheDocument();
    });
  });

  it("permite a un Jefe de Auditoría gestionar la estructura", async () => {
    sesion.usuario = { ...ADMIN, id: 2, nombre: "María García", rol: "Jefe de Auditoría" };
    sesion.esAdministrador = false;

    render(<HierarchyView />);

    expect(await screen.findByTestId("btn-nueva-unidad")).toBeInTheDocument();
    expect(screen.getByTestId("btn-eliminar-unidad-10")).toBeInTheDocument();
    expect(screen.getByTestId("btn-agregar-subdivision-200")).toBeInTheDocument();
  });
});
