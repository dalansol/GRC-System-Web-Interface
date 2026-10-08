import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorApi } from "../api/cliente";
import * as api from "../api/usuarios";
import type { UsuarioConPermisos } from "../api/usuarios";
import { crearProveedorDev, type ProveedorAuth } from "./proveedores";
import { PuertaSesion } from "./PuertaSesion";
import { ProveedorSesion, useSesion } from "./SesionContext";

vi.mock("../api/usuarios", async (original) => ({
  ...(await original<typeof api>()),
  obtenerSesion: vi.fn(),
}));

const ADMIN: UsuarioConPermisos = {
  id: 1,
  nombre: "Sofía Ramírez",
  correo: "s.ramirez@expedite.com",
  rol: "Administrador",
  estado: "active",
  ultimoAcceso: null,
  permisos: ["Gestionar Usuarios"],
};

function proveedorFalso(modo: ProveedorAuth["modo"], conIdentidad: boolean) {
  let identidad = conIdentidad;
  return {
    modo,
    iniciar: vi.fn(async () => identidad),
    credenciales: vi.fn(async () => ({})),
    iniciarSesion: vi.fn(async () => {
      identidad = true;
    }),
    cerrarSesion: vi.fn(async () => {
      identidad = false;
    }),
  } satisfies ProveedorAuth;
}

function Aplicacion() {
  const { usuario, esAdministrador } = useSesion();
  return (
    <p>
      Dentro: {usuario?.nombre} ({usuario?.rol}) {esAdministrador ? "con gestión de usuarios" : "sin gestión de usuarios"}
    </p>
  );
}

function montar(proveedor: ProveedorAuth) {
  render(
    <ProveedorSesion proveedor={proveedor}>
      <PuertaSesion>
        <Aplicacion />
      </PuertaSesion>
    </ProveedorSesion>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.obtenerSesion).mockResolvedValue(ADMIN);
});

describe("inicio de sesión", () => {
  it("con una sesión válida muestra la aplicación", async () => {
    montar(proveedorFalso("entra", true));

    expect(await screen.findByText(/Dentro: Sofía Ramírez \(Administrador\) con gestión de usuarios/)).toBeInTheDocument();
  });

  it("sin sesión pide iniciar con Microsoft y no muestra la aplicación", async () => {
    const proveedor = proveedorFalso("entra", false);
    montar(proveedor);
    const usuario = userEvent.setup();

    await usuario.click(await screen.findByRole("button", { name: "Iniciar sesión con Microsoft" }));

    expect(proveedor.iniciarSesion).toHaveBeenCalled();
    expect(api.obtenerSesion).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(/Dentro: Sofía Ramírez/)).toBeInTheDocument();
  });

  it("en modo de desarrollo entra con el correo de un usuario de prueba", async () => {
    const proveedor = proveedorFalso("dev", false);
    montar(proveedor);
    const usuario = userEvent.setup();

    await usuario.type(await screen.findByLabelText("Correo electrónico"), "s.ramirez@expedite.com");
    await usuario.click(screen.getByRole("button", { name: "Entrar" }));

    expect(proveedor.iniciarSesion).toHaveBeenCalledWith("s.ramirez@expedite.com");
    expect(await screen.findByText(/Dentro: Sofía Ramírez/)).toBeInTheDocument();
  });

  it("en modo de desarrollo el acceso de demostración llena el correo del rol elegido", async () => {
    // Radix mide el popover con ResizeObserver, que jsdom no trae.
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    montar(proveedorFalso("dev", false));
    const usuario = userEvent.setup();

    await usuario.click(await screen.findByRole("button", { name: /Usar un rol de prueba/ }));
    await usuario.click(await screen.findByRole("button", { name: /Auditor Senior/ }));

    const campo = screen.getByLabelText("Correo electrónico");
    expect(campo).toHaveValue("c.morales@expedite.com");
    await waitFor(() => expect(campo).toHaveFocus());
    vi.unstubAllGlobals();
  });

  it("mientras se inicia la sesión el botón queda deshabilitado", async () => {
    const proveedor = proveedorFalso("entra", false);
    let terminar = () => {};
    proveedor.iniciarSesion.mockImplementation(() => new Promise<void>((resolver) => (terminar = resolver)));
    montar(proveedor);
    const usuario = userEvent.setup();

    const boton = await screen.findByRole("button", { name: "Iniciar sesión con Microsoft" });
    await usuario.click(boton);

    expect(boton).toBeDisabled();
    expect(boton).toHaveAttribute("aria-busy", "true");
    await act(async () => terminar());
    await waitFor(() => expect(boton).toBeEnabled());
  });

  it("el panel presenta las fases una por una y al final las convierte en el logo grande de Expedite", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      montar(proveedorFalso("entra", false));
      await screen.findByRole("button", { name: "Iniciar sesión con Microsoft" });

      const fila = screen.getByText("Planeación").closest("ol");
      expect(fila).not.toHaveAttribute("aria-hidden");
      expect(screen.queryByRole("img", { name: "Logotipo de Expedite" })).not.toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(6000);
      });

      expect(screen.getByRole("img", { name: "Logotipo de Expedite" })).toBeInTheDocument();
      // La fila sigue montada para conservar la altura del panel, pero queda fuera del árbol accesible.
      expect(fila).toHaveAttribute("aria-hidden", "true");
    } finally {
      vi.useRealTimers();
    }
  });

  it("si la cuenta no está registrada o está inactiva, explica el motivo y no deja entrar", async () => {
    vi.mocked(api.obtenerSesion).mockRejectedValue(
      new ErrorApi(403, "USUARIO_NO_AUTORIZADO", "Tu cuenta no está registrada o está inactiva en Expedite. Contacta a un Administrador."),
    );
    montar(proveedorFalso("entra", true));

    expect(await screen.findByRole("alert")).toHaveTextContent("Tu cuenta no está registrada o está inactiva en Expedite.");
    expect(screen.queryByText(/Dentro:/)).not.toBeInTheDocument();
  });

  it("si el token ya no es válido, vuelve a pedir el inicio de sesión", async () => {
    vi.mocked(api.obtenerSesion).mockRejectedValue(new ErrorApi(401, "NO_AUTENTICADO", "Inicia sesión para continuar."));
    montar(proveedorFalso("entra", true));

    expect(await screen.findByRole("button", { name: "Iniciar sesión con Microsoft" })).toBeInTheDocument();
  });

  it("si el servidor no responde, avisa y permite reintentar", async () => {
    vi.mocked(api.obtenerSesion).mockRejectedValueOnce(new ErrorApi(0, "SIN_CONEXION", "No se pudo conectar con el servidor de Expedite."));
    montar(proveedorFalso("entra", true));
    const usuario = userEvent.setup();

    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo conectar con el servidor de Expedite.");

    await usuario.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(await screen.findByText(/Dentro: Sofía Ramírez/)).toBeInTheDocument();
  });
});

describe("actualización inmediata de permisos en la sesión", () => {
  it("al volver a la pestaña refleja el rol que un Administrador cambió", async () => {
    montar(proveedorFalso("entra", true));
    await screen.findByText(/con gestión de usuarios/);

    vi.mocked(api.obtenerSesion).mockResolvedValue({ ...ADMIN, rol: "Auditor", permisos: ["Ver Dashboard"] });
    act(() => {
      window.dispatchEvent(new Event("focus"));
    });

    expect(await screen.findByText(/\(Auditor\) sin gestión de usuarios/)).toBeInTheDocument();
  });

  it("si la cuenta fue desactivada, la saca de la aplicación", async () => {
    montar(proveedorFalso("entra", true));
    await screen.findByText(/Dentro:/);

    vi.mocked(api.obtenerSesion).mockRejectedValue(new ErrorApi(403, "USUARIO_NO_AUTORIZADO", "Tu cuenta no está registrada o está inactiva en Expedite."));
    act(() => {
      window.dispatchEvent(new Event("focus"));
    });

    expect(await screen.findByRole("alert")).toHaveTextContent("Acceso no autorizado");
    expect(screen.queryByText(/Dentro:/)).not.toBeInTheDocument();
  });

  it("un fallo de red al revalidar no cierra la sesión", async () => {
    montar(proveedorFalso("entra", true));
    await screen.findByText(/Dentro:/);

    vi.mocked(api.obtenerSesion).mockRejectedValue(new ErrorApi(0, "SIN_CONEXION", "No se pudo conectar con el servidor de Expedite."));
    act(() => {
      window.dispatchEvent(new Event("focus"));
    });

    await waitFor(() => expect(api.obtenerSesion).toHaveBeenCalledTimes(2));
    expect(screen.getByText(/Dentro: Sofía Ramírez/)).toBeInTheDocument();
  });
});

describe("proveedor de desarrollo", () => {
  it("guarda el correo normalizado y lo envía como credencial hasta cerrar sesión", async () => {
    window.sessionStorage.clear();
    const proveedor = crearProveedorDev();

    expect(await proveedor.iniciar()).toBe(false);
    expect(await proveedor.credenciales()).toEqual({});

    await proveedor.iniciarSesion("  S.Ramirez@Expedite.com ");
    expect(await proveedor.iniciar()).toBe(true);
    expect(await proveedor.credenciales()).toEqual({ "X-Dev-Usuario": "s.ramirez@expedite.com" });

    await proveedor.cerrarSesion();
    expect(await proveedor.iniciar()).toBe(false);
  });
});
