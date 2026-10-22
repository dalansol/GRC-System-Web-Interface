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
  crearPeriodo: vi.fn(),
  editarPeriodo: vi.fn(),
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
  nombre: "2026 Q4",
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
  codigo: "UDN-0001",
  nombre: null,
  responsableId: 2,
  responsableNombre: "María García",
  periodoFiscalId: 2,
  periodoFiscalNombre: "2026 Q4",
  departamentoAuditoriaId: 1,
  departamentoAuditoriaNombre: "Retail & Spin",
  creadoPor: 1,
  creadoEn: "2026-10-01T10:00:00Z",
  divisiones: [
    {
      id: 100,
      codigo: "DIVISION-0001",
      nombre: null,
      unidadNegocioId: 10,
      subdivisiones: [
        {
          id: 200,
          codigo: "SUBDIVISION-0001",
          nombre: null,
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

type Usuario = ReturnType<typeof userEvent.setup>;

/** Abre en el panel de detalle la unidad 10, luego la división 100 y la subdivisión 200. */
async function abrirDivision(usuario: Usuario) {
  await usuario.click(await screen.findByTestId("tarjeta-unidad-10"));
  await usuario.click(within(screen.getByTestId("fila-division-100")).getByRole("button", { name: /^Abrir/ }));
}

async function abrirSubdivision(usuario: Usuario, pestana?: "Áreas") {
  await abrirDivision(usuario);
  await usuario.click(within(screen.getByTestId("fila-subdivision-200")).getByRole("button", { name: /^Abrir/ }));
  if (pestana) await usuario.click(screen.getByRole("tab", { name: /Áreas/ }));
}

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
  it("CP-FE-01 (AC1): muestra el resumen de unidades y la jerarquía completa al navegarla", async () => {
    const usuario = userEvent.setup();
    render(<HierarchyView />);

    await waitFor(() => expect(screen.getByText(/Periodo Activo: 2026 Q4/i)).toBeInTheDocument());

    const tarjeta = screen.getByTestId("tarjeta-unidad-10");
    expect(within(tarjeta).getByText("UDN-0001")).toBeInTheDocument();
    expect(within(tarjeta).getByText(/María García/)).toBeInTheDocument();
    expect(within(tarjeta).getByText(/Retail & Spin/)).toBeInTheDocument();

    await abrirSubdivision(usuario, "Áreas");
    const detalle = screen.getByTestId("detalle-catalogo");
    expect(within(detalle).getByRole("heading", { name: "SUBDIVISION-0001" })).toBeInTheDocument();
    expect(within(detalle).getByText("México")).toBeInTheDocument();
    expect(within(screen.getByTestId("fila-area-300")).getByText("Nómina")).toBeInTheDocument();
  });

  it("CP-FE-02 (AC1): crea una unidad con gerente y departamento, sin proceso inicial", async () => {
    const usuario = userEvent.setup();
    vi.mocked(apiEstructura.crearUnidadNegocio).mockResolvedValue({
      ...UNIDAD,
      id: 20,
      codigo: "UDN-0003",
      departamentoAuditoriaId: 2,
      departamentoAuditoriaNombre: "Beverage",
      divisiones: [],
    });

    render(<HierarchyView />);
    await usuario.click(await screen.findByTestId("btn-nueva-unidad"));

    // El código no se escribe: se muestra el próximo y lo asigna el backend.
    expect(screen.getByTestId("campo-codigo")).toHaveTextContent("UDN-0002");
    // En el alta solo el candado (con su descripción accesible), sin texto que se desborde.
    expect(within(screen.getByTestId("campo-codigo")).getByRole("img", { name: "Se asigna al guardar" })).toBeInTheDocument();
    expect(screen.getByTestId("campo-codigo")).not.toHaveTextContent("Se asigna al guardar");
    expect(screen.queryByText(/El sistema asigna el código al guardar/)).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: /Código/i })).not.toBeInTheDocument();
    await usuario.selectOptions(screen.getByLabelText(/Gerente Responsable/i), "2");
    await usuario.selectOptions(screen.getByLabelText(/Departamento de Auditoría/i), "2");
    await usuario.click(screen.getByRole("button", { name: /Guardar Unidad/i }));

    await waitFor(() => {
      expect(apiEstructura.crearUnidadNegocio).toHaveBeenCalledWith({
        nombre: null,
        responsableId: 2,
        departamentoAuditoriaId: 2,
      });
      expect(toast.success).toHaveBeenCalledWith(expect.stringContaining('"UDN-0003" creada exitosamente'));
    });
    // Se abre el detalle de la unidad nueva para seguir con su jerarquía.
    const detalle = await screen.findByTestId("detalle-catalogo");
    expect(within(detalle).getByRole("heading", { name: "UDN-0003" })).toBeInTheDocument();
    expect(screen.getByTestId("btn-agregar-primera-division")).toBeInTheDocument();
    expect(screen.getByTestId("arbol-unidad-20")).toBeInTheDocument();
  });

  it("CP-FE-03: con un error del servidor muestra el mensaje en el formulario y lo mantiene abierto", async () => {
    const usuario = userEvent.setup();
    const mensaje = "No hay un periodo de auditoría activo configurado. Activa uno antes de dar de alta unidades.";
    vi.mocked(apiEstructura.crearUnidadNegocio).mockRejectedValue(new ErrorApi(409, "PERIODO_ACTIVO_NO_CONFIGURADO", mensaje));

    render(<HierarchyView />);
    await usuario.click(await screen.findByTestId("btn-nueva-unidad"));

    await usuario.selectOptions(screen.getByLabelText(/Gerente Responsable/i), "2");
    await usuario.click(screen.getByRole("button", { name: /Guardar Unidad/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(mensaje);
    expect(toast.error).toHaveBeenCalledWith(mensaje);
    expect(screen.getByRole("button", { name: /Guardar Unidad/i })).toBeInTheDocument();
  });

  it("CP-FE-04 (AC1): agrega una subdivisión con país dentro de una división y refresca la unidad", async () => {
    const usuario = userEvent.setup();
    vi.mocked(apiEstructura.crearNodo).mockResolvedValue({ id: 201, codigo: "SUBDIVISION-0002", nombre: null, padreId: 100 });
    const division = UNIDAD.divisiones[0]!;
    vi.mocked(apiEstructura.obtenerUnidadPorId).mockResolvedValue({
      ...UNIDAD,
      divisiones: [
        {
          ...division,
          subdivisiones: [
            ...division.subdivisiones,
            { id: 201, codigo: "SUBDIVISION-0002", nombre: null, pais: "KFS RTR", divisionId: 100, areas: [], riesgos: [] },
          ],
        },
      ],
    });

    render(<HierarchyView />);
    await abrirDivision(usuario);
    await usuario.click(screen.getByTestId("btn-agregar-hijo"));

    expect(screen.getByText("Agregar Subdivisión")).toBeInTheDocument();
    expect(screen.getByTestId("campo-codigo")).toHaveTextContent("SUBDIVISION-0002");
    await usuario.type(screen.getByLabelText(/País o región/i), "KFS RTR");
    await usuario.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => {
      expect(apiEstructura.crearNodo).toHaveBeenCalledWith("subdivision", {
        nombre: null,
        pais: "KFS RTR",
        padreId: 100,
      });
      expect(apiEstructura.obtenerUnidadPorId).toHaveBeenCalledWith(10);
    });
    // Aparece en la lista de la división y en el árbol (ya expandido hasta la división).
    expect(await screen.findByTestId("fila-subdivision-201")).toHaveTextContent("KFS RTR");
    expect(screen.getByTestId("arbol-subdivision-201")).toBeInTheDocument();
  });

  it("CP-FE-05 (AC3): con auditorías activas muestra el bloqueo en el diálogo de eliminación", async () => {
    const usuario = userEvent.setup();
    const mensaje = "No se puede eliminar la unidad de negocio mientras existan auditorías activas asociadas.";
    vi.mocked(apiEstructura.eliminarUnidadNegocio).mockRejectedValue(new ErrorApi(409, "AUDITORIAS_ACTIVAS", mensaje));
    vi.mocked(apiEstructura.listarUnidades).mockResolvedValue([{ ...UNIDAD, divisiones: [] }]);

    render(<HierarchyView />);
    await usuario.click(await screen.findByTestId("tarjeta-unidad-10"));
    await usuario.click(screen.getByTestId("btn-eliminar-encabezado"));
    await usuario.click(screen.getByTestId("btn-confirmar-eliminar"));

    expect(await screen.findByTestId("error-eliminacion")).toHaveTextContent(mensaje);
    expect(apiEstructura.eliminarUnidadNegocio).toHaveBeenCalledWith(10);
    // El mensaje se muestra una sola vez: en el diálogo, no en un aviso.
    expect(toast.error).not.toHaveBeenCalled();
    // La unidad sigue abierta en el detalle.
    expect(within(screen.getByTestId("detalle-catalogo")).getByRole("heading", { name: "UDN-0001" })).toBeInTheDocument();
  });

  it("CP-FE-06 (AC3): elimina un área sin auditorías activas y la quita de la subdivisión", async () => {
    const usuario = userEvent.setup();
    vi.mocked(apiEstructura.eliminarNodo).mockResolvedValue(undefined);
    const division = UNIDAD.divisiones[0]!;
    vi.mocked(apiEstructura.obtenerUnidadPorId).mockResolvedValue({
      ...UNIDAD,
      divisiones: [{ ...division, subdivisiones: [{ ...division.subdivisiones[0]!, areas: [] }] }],
    });

    render(<HierarchyView />);
    await abrirSubdivision(usuario, "Áreas");
    await usuario.click(screen.getByTestId("btn-eliminar-area-300"));
    await usuario.click(screen.getByTestId("btn-confirmar-eliminar"));

    await waitFor(() => expect(apiEstructura.eliminarNodo).toHaveBeenCalledWith("area", 300));
    await waitFor(() => expect(screen.queryByTestId("fila-area-300")).not.toBeInTheDocument());
    expect(screen.getByText("Sin áreas registradas.")).toBeInTheDocument();
  });

  it("CP-FE-07 (SNF-05): un Auditor Senior consulta la estructura pero no ve acciones de gestión", async () => {
    sesion.usuario = { ...ADMIN, id: 3, nombre: "Carlos Morales", rol: "Auditor Senior" };
    sesion.esAdministrador = false;
    const usuario = userEvent.setup();

    render(<HierarchyView />);
    expect(screen.queryByTestId("btn-nueva-unidad")).not.toBeInTheDocument();

    await usuario.click(await screen.findByTestId("tarjeta-unidad-10"));
    expect(screen.queryByTestId("btn-eliminar-encabezado")).not.toBeInTheDocument();
    expect(screen.queryByTestId("btn-agregar-hijo")).not.toBeInTheDocument();
    expect(screen.queryByTestId("btn-eliminar-division-100")).not.toBeInTheDocument();

    await usuario.click(within(screen.getByTestId("fila-division-100")).getByRole("button", { name: /^Abrir/ }));
    await usuario.click(within(screen.getByTestId("fila-subdivision-200")).getByRole("button", { name: /^Abrir/ }));
    await usuario.click(screen.getByRole("tab", { name: /Áreas/ }));
    expect(screen.getByText("Nómina")).toBeInTheDocument();
    expect(screen.queryByTestId("btn-eliminar-area-300")).not.toBeInTheDocument();
    expect(apiEstructura.listarResponsables).not.toHaveBeenCalled();
  });

  it("CP-FE-08: muestra los riesgos de la subdivisión y el resumen por rama, sin pestaña de explorador", async () => {
    const usuario = userEvent.setup();
    render(<HierarchyView />);
    await screen.findByTestId("tarjeta-unidad-10");

    expect(screen.queryByText(/Explorador de Riesgos/i)).not.toBeInTheDocument();
    // La unidad suma los riesgos de su rama, por nivel.
    expect(screen.getByTestId("riesgos-unidad-10")).toHaveTextContent(/1\s*Alto/);
    expect(screen.getByTestId("riesgos-unidad-10")).toHaveTextContent(/1\s*Bajo/);

    // La división se colorea con el peor nivel de su rama.
    await usuario.click(screen.getByTestId("tarjeta-unidad-10"));
    expect(screen.getByTestId("riesgos-division-100")).toHaveTextContent("2");
    expect(screen.getByTestId("riesgos-division-100")).toHaveAttribute("title", expect.stringContaining("Alto"));

    await usuario.click(within(screen.getByTestId("fila-division-100")).getByRole("button", { name: /^Abrir/ }));
    await usuario.click(within(screen.getByTestId("fila-subdivision-200")).getByRole("button", { name: /^Abrir/ }));
    expect(within(screen.getByTestId("riesgo-900")).getByText("Pagos de nómina sin doble aprobación")).toBeInTheDocument();
    expect(within(screen.getByTestId("riesgo-900")).getByText("Doble aprobación del layout")).toBeInTheDocument();
    expect(within(screen.getByTestId("riesgo-901")).getByText("Bajo")).toBeInTheDocument();
    expect(within(screen.getByTestId("riesgo-901")).getByText("Sin procedimiento")).toBeInTheDocument();
    // Ordenados del peor al mejor nivel.
    const filas = within(screen.getByTestId("tabla-riesgos")).getAllByRole("row").slice(1);
    expect(filas.map((f) => f.getAttribute("data-testid"))).toEqual(["riesgo-900", "riesgo-901"]);
  });

  it("CP-FE-09: el filtro por nivel oculta las ramas sin riesgos de ese nivel y la búsqueda encuentra riesgos", async () => {
    const usuario = userEvent.setup();
    render(<HierarchyView />);
    await screen.findByTestId("tarjeta-unidad-10");

    await usuario.selectOptions(screen.getByLabelText(/Filtrar por nivel de riesgo/i), "Crítico");
    expect(screen.getByTestId("sin-coincidencias")).toBeInTheDocument();

    // Con filtro el árbol se expande para mostrar las coincidencias.
    await usuario.selectOptions(screen.getByLabelText(/Filtrar por nivel de riesgo/i), "Alto");
    expect(screen.getByTestId("arbol-subdivision-200")).toBeInTheDocument();

    await usuario.selectOptions(screen.getByLabelText(/Filtrar por nivel de riesgo/i), "");
    await usuario.type(screen.getByLabelText(/Buscar en el catálogo/i), "proveedores");
    await usuario.click(within(screen.getByTestId("arbol-subdivision-200")).getByText("SUBDIVISION-0001"));
    expect(screen.getByTestId("riesgo-901")).toBeInTheDocument();
    expect(screen.queryByTestId("riesgo-900")).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Áreas/ })).toHaveTextContent("0");

    // Al limpiar, la selección se conserva y vuelven todos los riesgos.
    await usuario.click(screen.getAllByRole("button", { name: "Limpiar filtros" })[0]!);
    expect(screen.getByTestId("riesgo-900")).toBeInTheDocument();
  });

  it("CP-FE-13: los formularios sugieren áreas y países y muestran el próximo código", async () => {
    const usuario = userEvent.setup();
    const sugerencias = () => within(screen.getByRole("listbox")).getAllByRole("option").map((o) => o.textContent);

    render(<HierarchyView />);

    // Área: al enfocar el campo vacío se ven todas las del catálogo de FEMSA, sin las que ya tiene.
    await abrirSubdivision(usuario, "Áreas");
    await usuario.click(screen.getByTestId("btn-agregar-hijo"));
    const area = screen.getByRole("combobox", { name: /^Nombre/i });
    await usuario.click(area);
    const areas = sugerencias();
    expect(areas[0]).toBe("Administración y Finanzas");
    expect(areas).toContain("Fletes");
    expect(areas).not.toContain("Nómina");
    // Al escribir se filtra sin importar acentos; se elige con un clic.
    await usuario.type(area, "flet");
    expect(sugerencias()).toEqual(["Fletes"]);
    await usuario.click(screen.getByRole("option", { name: "Fletes" }));
    expect(area).toHaveValue("Fletes");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    await usuario.click(screen.getByRole("button", { name: "Cancelar" }));

    // Subdivisión: siguiente código y todos los países del Consolidado con el campo vacío.
    const migas = screen.getByRole("navigation", { name: /Ruta en la jerarquía/i });
    await usuario.click(within(migas).getByRole("button", { name: "DIVISION-0001" }));
    await usuario.click(screen.getByTestId("btn-agregar-hijo"));
    expect(screen.getByTestId("campo-codigo")).toHaveTextContent("SUBDIVISION-0002");
    const pais = screen.getByRole("combobox", { name: /País o región/i });
    await usuario.click(pais);
    expect(sugerencias()).toEqual(expect.arrayContaining(["México", "Brasil", "KFS RTR"]));
    // También con el teclado: flecha abajo y Enter eligen la primera sin enviar el formulario.
    const primero = sugerencias()[0]!;
    await usuario.keyboard("{ArrowDown}{Enter}");
    expect(pais).toHaveValue(primero);
    expect(apiEstructura.crearNodo).not.toHaveBeenCalled();
    await usuario.click(screen.getByRole("button", { name: "Cancelar" }));

    // Unidad: siguiente UDN.
    await usuario.click(screen.getByTestId("btn-nueva-unidad"));
    expect(screen.getByTestId("campo-codigo")).toHaveTextContent("UDN-0002");
  });

  describe("Código y nombre", () => {
    const KOF: UnidadNegocio = {
      ...UNIDAD,
      codigo: "UDN-0003",
      nombre: "KOF",
      divisiones: [{ ...UNIDAD.divisiones[0]!, nombre: "Latam" }],
    };

    it("CP-FE-14: muestra el nombre con el código aparte en el resumen, el árbol, el detalle y las migas", async () => {
      const usuario = userEvent.setup();
      vi.mocked(apiEstructura.listarUnidades).mockResolvedValue([KOF]);
      render(<HierarchyView />);

      const tarjeta = await screen.findByRole("button", { name: "Abrir KOF" });
      expect(within(tarjeta).getByRole("heading")).toHaveTextContent("KOFUDN-0003");
      expect(screen.getByTestId("arbol-unidad-10")).toHaveTextContent("KOFUDN-0003");

      await usuario.click(tarjeta);
      expect(within(screen.getByTestId("fila-division-100")).getByText("Latam")).toBeInTheDocument();
      expect(within(screen.getByTestId("fila-division-100")).getByText("DIVISION-0001")).toBeInTheDocument();

      await usuario.click(screen.getByRole("button", { name: "Abrir Latam" }));
      // La subdivisión no tiene nombre: se muestra solo su código.
      expect(within(screen.getByTestId("fila-subdivision-200")).getAllByText("SUBDIVISION-0001")).toHaveLength(1);
      const migas = screen.getByRole("navigation", { name: /Ruta en la jerarquía/i });
      expect(within(migas).getByRole("button", { name: "KOF" })).toBeInTheDocument();
      expect(within(migas).getByRole("button", { name: "Latam" })).toBeInTheDocument();
    });

    it("CP-FE-15: la búsqueda encuentra por nombre y por código", async () => {
      const usuario = userEvent.setup();
      vi.mocked(apiEstructura.listarUnidades).mockResolvedValue([KOF, { ...UNIDAD, id: 11 }]);
      render(<HierarchyView />);
      await screen.findByTestId("tarjeta-unidad-10");

      await usuario.type(screen.getByLabelText(/Buscar en el catálogo/i), "kof");
      expect(screen.getAllByTestId(/^tarjeta-unidad-/)).toHaveLength(1);
      await usuario.clear(screen.getByLabelText(/Buscar en el catálogo/i));
      await usuario.type(screen.getByLabelText(/Buscar en el catálogo/i), "UDN-0003");
      expect(screen.getAllByTestId(/^tarjeta-unidad-/)).toHaveLength(1);
    });

    it("CP-FE-16: el alta de unidad envía solo el nombre y confirma el código asignado; el área no tiene código", async () => {
      const usuario = userEvent.setup();
      vi.mocked(apiEstructura.crearUnidadNegocio).mockResolvedValue({ ...KOF, id: 30, divisiones: [] });
      render(<HierarchyView />);

      await usuario.click(await screen.findByTestId("btn-nueva-unidad"));
      await usuario.type(screen.getByLabelText(/^Nombre$/i), " KOF ");
      await usuario.selectOptions(screen.getByLabelText(/Gerente Responsable/i), "2");
      await usuario.click(screen.getByRole("button", { name: /Guardar Unidad/i }));
      await waitFor(() => expect(apiEstructura.crearUnidadNegocio).toHaveBeenCalled());
      const enviado = vi.mocked(apiEstructura.crearUnidadNegocio).mock.calls[0]![0];
      expect(enviado).toMatchObject({ nombre: "KOF" });
      expect(enviado).not.toHaveProperty("codigo");
      expect(toast.success).toHaveBeenCalledWith('Unidad de negocio "KOF" (UDN-0003) creada exitosamente.');

      await usuario.click(screen.getByRole("button", { name: "Ver todas" }));
      await abrirSubdivision(usuario, "Áreas");
      await usuario.click(screen.getByTestId("btn-agregar-hijo"));
      expect(screen.queryByTestId("campo-codigo")).not.toBeInTheDocument();
      expect(screen.getByLabelText(/^Nombre\s*\*/i)).toBeInTheDocument();
    });

    it("CP-FE-18: al editar, el código se muestra fijo y solo se envía el nombre", async () => {
      const usuario = userEvent.setup();
      vi.mocked(apiEstructura.editarUnidadNegocio).mockResolvedValue({ ...UNIDAD, nombre: "Deportes" });
      render(<HierarchyView />);

      await usuario.click(await screen.findByTestId("tarjeta-unidad-10"));
      await usuario.click(within(screen.getByTestId("detalle-catalogo")).getByRole("button", { name: "Editar unidad de negocio" }));

      expect(screen.getByTestId("campo-codigo")).toHaveTextContent("UDN-0001");
      expect(screen.getByTestId("campo-codigo")).toHaveTextContent("No se puede cambiar");
      expect(screen.queryByRole("textbox", { name: /Código/i })).not.toBeInTheDocument();

      await usuario.type(screen.getByLabelText(/^Nombre/i), "Deportes");
      await usuario.click(screen.getByRole("button", { name: "Guardar Cambios" }));

      await waitFor(() => expect(apiEstructura.editarUnidadNegocio).toHaveBeenCalled());
      const [id, cambios] = vi.mocked(apiEstructura.editarUnidadNegocio).mock.calls[0]!;
      expect(id).toBe(10);
      expect(cambios).toMatchObject({ nombre: "Deportes" });
      expect(cambios).not.toHaveProperty("codigo");
    });
  });

  describe("Explorador: árbol y detalle", () => {
    it("CP-FE-10: recorre unidad › división › subdivisión desde el detalle y vuelve al resumen por las migas", async () => {
      const usuario = userEvent.setup();
      render(<HierarchyView />);
      await usuario.click(await screen.findByTestId("tarjeta-unidad-10"));

      // Nivel unidad: encabezado con gerente y fila de la división con conteos y riesgos.
      const detalle = screen.getByTestId("detalle-catalogo");
      expect(within(detalle).getByRole("heading", { name: "UDN-0001" })).toBeInTheDocument();
      expect(within(detalle).getByText("María García")).toBeInTheDocument();
      expect(screen.getByTestId("fila-division-100")).toHaveTextContent("1 subdivisión · 1 área");

      // Nivel división.
      await usuario.click(screen.getByRole("button", { name: "Abrir DIVISION-0001" }));
      expect(screen.getByTestId("fila-subdivision-200")).toHaveTextContent("México");

      // Nivel subdivisión: riesgos por defecto y áreas en su pestaña.
      await usuario.click(screen.getByRole("button", { name: "Abrir SUBDIVISION-0001" }));
      expect(screen.getByTestId("tabla-riesgos")).toBeInTheDocument();
      await usuario.click(screen.getByRole("tab", { name: /Áreas/ }));
      expect(screen.getByTestId("fila-area-300")).toHaveTextContent("Nómina");

      // Migas: a la unidad y luego al resumen.
      const migas = screen.getByRole("navigation", { name: /Ruta en la jerarquía/i });
      await usuario.click(within(migas).getByRole("button", { name: "UDN-0001" }));
      expect(screen.getByTestId("fila-division-100")).toBeInTheDocument();
      await usuario.click(
        within(screen.getByRole("navigation", { name: /Ruta en la jerarquía/i })).getByRole("button", {
          name: "Todas las unidades",
        }),
      );
      expect(screen.getByTestId("lista-unidades")).toBeInTheDocument();
      expect(screen.queryByTestId("detalle-catalogo")).not.toBeInTheDocument();
    });

    it("CP-FE-17: el árbol empieza contraído, se expande y selecciona nodos sin listar áreas ni riesgos", async () => {
      const usuario = userEvent.setup();
      render(<HierarchyView />);
      await screen.findByTestId("arbol-unidad-10");

      expect(screen.queryByTestId("arbol-division-100")).not.toBeInTheDocument();
      await usuario.click(screen.getByRole("button", { name: "Expandir UDN-0001" }));
      await usuario.click(screen.getByRole("button", { name: "Expandir DIVISION-0001" }));
      const subdivision = screen.getByTestId("arbol-subdivision-200");
      expect(subdivision).toHaveTextContent("México");

      await usuario.click(within(subdivision).getByText("SUBDIVISION-0001"));
      expect(within(screen.getByTestId("detalle-catalogo")).getByRole("heading", { name: "SUBDIVISION-0001" })).toBeInTheDocument();
      expect(within(subdivision).getByRole("button", { current: true })).toBeInTheDocument();
      // El árbol no repite las áreas ni los riesgos.
      expect(screen.queryByTestId("arbol-area-300")).not.toBeInTheDocument();
      expect(within(screen.getByRole("navigation", { name: /Árbol/ })).queryByText("Nómina")).not.toBeInTheDocument();
    });

    it("CP-FE-11: agrega una subdivisión desde el detalle y la fila nueva aparece", async () => {
      const usuario = userEvent.setup();
      vi.mocked(apiEstructura.crearNodo).mockResolvedValue({ id: 201, codigo: "SUBDIVISION-0002", nombre: null, padreId: 100 });
      const division = UNIDAD.divisiones[0]!;
      vi.mocked(apiEstructura.obtenerUnidadPorId).mockResolvedValue({
        ...UNIDAD,
        divisiones: [
          {
            ...division,
            subdivisiones: [
              ...division.subdivisiones,
              { id: 201, codigo: "SUBDIVISION-0002", nombre: null, pais: null, divisionId: 100, areas: [], riesgos: [] },
            ],
          },
        ],
      });

      render(<HierarchyView />);
      await abrirDivision(usuario);
      await usuario.click(screen.getByTestId("btn-agregar-hijo"));
      await usuario.click(screen.getByRole("button", { name: "Guardar" }));

      await waitFor(() =>
        expect(apiEstructura.crearNodo).toHaveBeenCalledWith("subdivision", {
          nombre: null,
          pais: null,
          padreId: 100,
        }),
      );
      expect(await screen.findByTestId("fila-subdivision-201")).toBeInTheDocument();
      // Sigue en la división, no regresa al resumen.
      expect(within(screen.getByTestId("detalle-catalogo")).getByRole("heading", { name: "DIVISION-0001" })).toBeInTheDocument();
    });
  });

  describe("AC2: nombres duplicados", () => {
    it("CP-FE-19: el nombre de unidad repetido muestra el mensaje en el formulario, que sigue abierto", async () => {
      const usuario = userEvent.setup();
      const mensaje = 'Ya existe una unidad de negocio con el nombre "kof".';
      vi.mocked(apiEstructura.crearUnidadNegocio).mockRejectedValue(new ErrorApi(409, "NOMBRE_DUPLICADO", mensaje));

      render(<HierarchyView />);
      await usuario.click(await screen.findByTestId("btn-nueva-unidad"));
      await usuario.type(screen.getByLabelText(/^Nombre$/i), "kof");
      await usuario.selectOptions(screen.getByLabelText(/Gerente Responsable/i), "2");
      await usuario.click(screen.getByRole("button", { name: /Guardar Unidad/i }));

      expect(await screen.findByRole("alert")).toHaveTextContent(mensaje);
      expect(screen.getByRole("button", { name: /Guardar Unidad/i })).toBeInTheDocument();
      expect(screen.queryByTestId("detalle-catalogo")).not.toBeInTheDocument();
    });

    it("CP-FE-20: el área repetida en la subdivisión muestra el mensaje en el formulario", async () => {
      const usuario = userEvent.setup();
      const mensaje = 'Ya existe un área en esta subdivisión con el nombre "nómina".';
      vi.mocked(apiEstructura.crearNodo).mockRejectedValue(new ErrorApi(409, "NOMBRE_DUPLICADO", mensaje));

      render(<HierarchyView />);
      await abrirSubdivision(usuario, "Áreas");
      await usuario.click(screen.getByTestId("btn-agregar-hijo"));
      await usuario.type(screen.getByLabelText(/^Nombre\s*\*/i), "nómina");
      await usuario.click(screen.getByRole("button", { name: "Guardar" }));

      expect(await screen.findByRole("alert")).toHaveTextContent(mensaje);
      expect(screen.getByRole("button", { name: "Guardar" })).toBeInTheDocument();
    });
  });

  describe("Periodos de auditoría", () => {
    const PERIODO_NUEVO: PeriodoFiscal = {
      id: 3,
      nombre: "2027 Q1",
      fechaInicio: "2027-01-01",
      fechaFin: "2027-03-31",
      activo: false,
    };

    it("CP-FE-21: agrega un trimestre con un botón y activa otro periodo; el encabezado muestra el nuevo activo", async () => {
      const usuario = userEvent.setup();
      vi.mocked(apiEstructura.crearPeriodo).mockResolvedValue(PERIODO_NUEVO);
      vi.mocked(apiEstructura.editarPeriodo).mockResolvedValue({ ...PERIODO_NUEVO, activo: true });

      render(<HierarchyView />);
      await usuario.click(await screen.findByTestId("badge-periodo-activo"));
      const modal = screen.getByTestId("modal-periodos");
      expect(within(modal).getByTestId("periodo-2")).toHaveTextContent("Activo");
      // Abre en el año del periodo activo; su Q4 ya está registrado (por fechas).
      expect(within(modal).getByTestId("anio-periodos")).toHaveTextContent("2026");
      expect(within(modal).getByRole("button", { name: "2026 Q4 (ya registrado)" })).toBeDisabled();
      expect(within(modal).getByRole("button", { name: "Agregar 2026 Fiscal" })).toBeEnabled();
      // Sin captura de nombre ni fechas.
      expect(within(modal).queryByRole("textbox")).not.toBeInTheDocument();

      vi.mocked(apiEstructura.listarPeriodos).mockResolvedValue([PERIODO_ACTIVO, PERIODO_NUEVO]);
      await usuario.click(within(modal).getByRole("button", { name: "Año siguiente" }));
      await usuario.click(within(modal).getByRole("button", { name: "Agregar 2027 Q1" }));

      await waitFor(() =>
        expect(apiEstructura.crearPeriodo).toHaveBeenCalledWith({
          nombre: "2027 Q1",
          fechaInicio: "2027-01-01",
          fechaFin: "2027-03-31",
          activo: false,
        }),
      );
      expect(await within(modal).findByTestId("periodo-3")).toBeInTheDocument();
      expect(within(modal).getByRole("button", { name: "2027 Q1 (ya registrado)" })).toBeDisabled();

      vi.mocked(apiEstructura.listarPeriodos).mockResolvedValue([
        { ...PERIODO_ACTIVO, activo: false },
        { ...PERIODO_NUEVO, activo: true },
      ]);
      await usuario.click(within(modal).getByRole("button", { name: "Activar 2027 Q1" }));

      await waitFor(() => expect(apiEstructura.editarPeriodo).toHaveBeenCalledWith(3, { activo: true }));
      expect(await screen.findByText(/Periodo Activo: 2027 Q1/)).toBeInTheDocument();
    });

    it("CP-FE-22: agrega el año fiscal activándolo, lista en orden y muestra el error del servidor", async () => {
      const usuario = userEvent.setup();
      const FISCAL: PeriodoFiscal = { id: 4, nombre: "2026 Fiscal", fechaInicio: "2026-01-01", fechaFin: "2026-12-31", activo: false };
      vi.mocked(apiEstructura.listarPeriodos).mockResolvedValue([
        FISCAL,
        PERIODO_ACTIVO,
        { id: 1, nombre: "2026 Q3", fechaInicio: "2026-07-01", fechaFin: "2026-09-30", activo: false },
      ]);
      const mensaje = "No se pudo registrar el periodo.";
      vi.mocked(apiEstructura.crearPeriodo).mockRejectedValue(new ErrorApi(500, "ERROR_INTERNO", mensaje));

      render(<HierarchyView />);
      await usuario.click(await screen.findByTestId("badge-periodo-activo"));
      const modal = screen.getByTestId("modal-periodos");

      // Orden: trimestres del año y al final su año fiscal.
      const filas = within(within(modal).getByTestId("lista-periodos")).getAllByRole("listitem");
      expect(filas.map((f) => f.getAttribute("data-testid"))).toEqual(["periodo-1", "periodo-2", "periodo-4"]);

      await usuario.click(within(modal).getByRole("button", { name: "Año siguiente" }));
      await usuario.click(within(modal).getByLabelText(/Activar el periodo al agregarlo/i));
      await usuario.click(within(modal).getByRole("button", { name: "Agregar 2027 Fiscal" }));
      expect(apiEstructura.crearPeriodo).toHaveBeenCalledWith({
        nombre: "2027 Fiscal",
        fechaInicio: "2027-01-01",
        fechaFin: "2027-12-31",
        activo: true,
      });
      expect(await within(modal).findByRole("alert")).toHaveTextContent(mensaje);
    });

    it("CP-FE-23: sin periodo activo, quien gestiona puede configurarlo desde el encabezado", async () => {
      const usuario = userEvent.setup();
      vi.mocked(apiEstructura.obtenerPeriodoActivo).mockRejectedValue(new ErrorApi(404, "NO_ENCONTRADO", "Sin periodo"));
      vi.mocked(apiEstructura.listarPeriodos).mockResolvedValue([{ ...PERIODO_ACTIVO, activo: false }]);

      render(<HierarchyView />);
      const insignia = await screen.findByTestId("badge-sin-periodo");
      expect(insignia).toHaveTextContent("Configurar periodo");
      await usuario.click(insignia);
      expect(within(screen.getByTestId("modal-periodos")).getByRole("button", { name: "Activar 2026 Q4" })).toBeInTheDocument();
    });

    it("CP-FE-24 (SNF-05): un Auditor ve el periodo activo, pero no puede abrir la gestión de periodos", async () => {
      sesion.usuario = { ...ADMIN, id: 4, nombre: "Ana Rodríguez", rol: "Auditor" };
      sesion.esAdministrador = false;
      const usuario = userEvent.setup();

      render(<HierarchyView />);
      const insignia = await screen.findByTestId("badge-periodo-activo");
      expect(insignia.tagName).not.toBe("BUTTON");
      await usuario.click(insignia);
      expect(screen.queryByTestId("modal-periodos")).not.toBeInTheDocument();
    });

    it("CP-FE-25: el detalle de la unidad muestra su periodo de alta", async () => {
      const usuario = userEvent.setup();
      vi.mocked(apiEstructura.listarUnidades).mockResolvedValue([{ ...UNIDAD, periodoFiscalNombre: "2026 Q1" }]);
      render(<HierarchyView />);
      await usuario.click(await screen.findByTestId("tarjeta-unidad-10"));
      expect(screen.getByTestId("periodo-alta")).toHaveTextContent("Periodo de alta: 2026 Q1");
      expect(screen.getByText(/Periodo Activo: 2026 Q4/)).toBeInTheDocument();
    });
  });

  describe("Carga y eliminación", () => {
    it("CP-FE-26: si no se puede leer el catálogo muestra el error y permite reintentar", async () => {
      const usuario = userEvent.setup();
      vi.mocked(apiEstructura.listarUnidades).mockRejectedValueOnce(new ErrorApi(0, "SIN_CONEXION", "No hay conexión con el servidor."));

      render(<HierarchyView />);
      expect(await screen.findByTestId("error-carga")).toHaveTextContent("No hay conexión con el servidor.");
      expect(screen.queryByText("No hay unidades de negocio registradas")).not.toBeInTheDocument();

      await usuario.click(screen.getByRole("button", { name: /Reintentar/ }));
      expect(await screen.findByTestId("tarjeta-unidad-10")).toBeInTheDocument();
      expect(screen.queryByTestId("error-carga")).not.toBeInTheDocument();
    });

    it("CP-FE-27 (AC3): avisa antes de eliminar un elemento con dependientes y no deja confirmar", async () => {
      const usuario = userEvent.setup();
      render(<HierarchyView />);

      await usuario.click(await screen.findByTestId("tarjeta-unidad-10"));
      await usuario.click(screen.getByTestId("btn-eliminar-encabezado"));
      expect(screen.getByTestId("error-eliminacion")).toHaveTextContent("tiene 1 división");
      expect(screen.queryByTestId("btn-confirmar-eliminar")).not.toBeInTheDocument();
      await usuario.click(screen.getByRole("button", { name: "Cerrar" }));

      // Sigue en la unidad: baja a su subdivisión.
      await usuario.click(within(screen.getByTestId("fila-division-100")).getByRole("button", { name: /^Abrir/ }));
      await usuario.click(within(screen.getByTestId("fila-subdivision-200")).getByRole("button", { name: /^Abrir/ }));
      await usuario.click(screen.getByTestId("btn-eliminar-encabezado"));
      expect(screen.getByTestId("error-eliminacion")).toHaveTextContent("tiene 1 área y 2 riesgos registrados");
      expect(apiEstructura.eliminarNodo).not.toHaveBeenCalled();
    });

    it("CP-FE-28: al editar una unidad cuyo gerente ya no está activo, lo conserva sin reenviarlo", async () => {
      const usuario = userEvent.setup();
      vi.mocked(apiEstructura.listarUnidades).mockResolvedValue([
        { ...UNIDAD, responsableId: 7, responsableNombre: "Pedro Sánchez (inactivo)" },
      ]);
      vi.mocked(apiEstructura.editarUnidadNegocio).mockResolvedValue({ ...UNIDAD, nombre: "Deportes" });
      render(<HierarchyView />);

      await usuario.click(await screen.findByTestId("tarjeta-unidad-10"));
      await usuario.click(within(screen.getByTestId("detalle-catalogo")).getByRole("button", { name: "Editar unidad de negocio" }));
      const selector = screen.getByLabelText(/Gerente Responsable/i) as HTMLSelectElement;
      expect(selector.value).toBe("7");
      expect(within(selector).getByRole("option", { name: /Pedro Sánchez/ })).toBeInTheDocument();

      await usuario.type(screen.getByLabelText(/^Nombre/i), "Deportes");
      await usuario.click(screen.getByRole("button", { name: "Guardar Cambios" }));
      await waitFor(() => expect(apiEstructura.editarUnidadNegocio).toHaveBeenCalled());
      expect(vi.mocked(apiEstructura.editarUnidadNegocio).mock.calls[0]![1]).not.toHaveProperty("responsableId");
    });
  });

  it("permite a un Jefe de Auditoría gestionar la estructura", async () => {
    sesion.usuario = { ...ADMIN, id: 2, nombre: "María García", rol: "Jefe de Auditoría" };
    sesion.esAdministrador = false;
    const usuario = userEvent.setup();

    render(<HierarchyView />);

    expect(await screen.findByTestId("btn-nueva-unidad")).toBeInTheDocument();
    await abrirDivision(usuario);
    expect(screen.getByTestId("btn-eliminar-encabezado")).toBeInTheDocument();
    expect(screen.getByTestId("btn-agregar-hijo")).toBeInTheDocument();
    expect(screen.getByTestId("btn-eliminar-subdivision-200")).toBeInTheDocument();
  });
});
