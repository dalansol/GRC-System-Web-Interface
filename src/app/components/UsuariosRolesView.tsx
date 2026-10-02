import React, { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Loader2, Lock, ShieldAlert, UserPlus, Users, X } from "lucide-react";
import { ErrorApi } from "../api/cliente";
import { cambiarRol, crearUsuario, listarRoles, listarUsuarios, type Rol, type Usuario } from "../api/usuarios";
import { useSesion } from "../auth/SesionContext";

// Gestión de usuarios y roles (SF-16, SF-17). Solo para el rol Administrador (SNF-05).

type Carga = { fase: "cargando" } | { fase: "error"; mensaje: string } | { fase: "lista" };

const mensajeDe = (error: unknown) => (error instanceof Error ? error.message : "Ocurrió un error inesperado.");

const CAMPO =
  "w-full text-sm border rounded-md px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30";

function fechaCorta(iso: string | null): string {
  if (!iso) return "Nunca";
  return new Date(iso).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

// ─── Formulario de alta ──────────────────────────────────────────────────────
type ErroresAlta = Partial<Record<"nombre" | "correo" | "rol" | "general", string>>;

function FormularioAlta({
  roles,
  onCreado,
  onCancelar,
  onSinAcceso,
}: {
  roles: Rol[];
  onCreado: (usuario: Usuario) => void;
  onCancelar: () => void;
  onSinAcceso: () => void;
}) {
  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [rol, setRol] = useState("");
  const [errores, setErrores] = useState<ErroresAlta>({});
  const [enviando, setEnviando] = useState(false);

  const quitarError = (campo: keyof ErroresAlta) =>
    setErrores((previos) => ({ ...previos, [campo]: undefined, general: undefined }));

  const enviar = async (evento: React.FormEvent) => {
    evento.preventDefault();

    const faltantes: ErroresAlta = {};
    if (!nombre.trim()) faltantes.nombre = "Escribe el nombre completo.";
    if (!correo.trim()) faltantes.correo = "Escribe el correo corporativo.";
    if (!rol) faltantes.rol = "Selecciona un rol.";
    setErrores(faltantes);
    if (Object.keys(faltantes).length > 0) return;

    setEnviando(true);
    try {
      onCreado(await crearUsuario({ nombre: nombre.trim(), correo: correo.trim(), rol }));
    } catch (error) {
      const codigo = error instanceof ErrorApi ? error.codigo : "";
      // El dominio corporativo lo valida el servidor; aquí se muestra su mensaje junto al campo.
      if (codigo === "DOMINIO_NO_AUTORIZADO" || codigo === "CORREO_DUPLICADO") {
        setErrores({ correo: mensajeDe(error) });
      } else {
        setErrores({ general: mensajeDe(error) });
        if (codigo === "ROL_NO_AUTORIZADO") onSinAcceso();
      }
    } finally {
      setEnviando(false);
    }
  };

  const borde = (error?: string) => (error ? "border-red-400" : "border-border");
  const textoError = (id: string, error?: string) =>
    error && (
      <p id={id} role="alert" className="text-xs font-medium text-red-600">
        {error}
      </p>
    );

  return (
    <form onSubmit={enviar} noValidate className="px-6 py-5 border-b border-border bg-secondary/20 space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <label htmlFor="alta-nombre" className="block text-xs font-semibold text-foreground">
            Nombre completo
          </label>
          <input
            id="alta-nombre"
            value={nombre}
            maxLength={150}
            onChange={(e) => { setNombre(e.target.value); quitarError("nombre"); }}
            aria-invalid={Boolean(errores.nombre)}
            aria-describedby={errores.nombre ? "alta-nombre-error" : undefined}
            className={`${CAMPO} ${borde(errores.nombre)}`}
          />
          {textoError("alta-nombre-error", errores.nombre)}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="alta-correo" className="block text-xs font-semibold text-foreground">
            Correo corporativo
          </label>
          <input
            id="alta-correo"
            type="email"
            value={correo}
            maxLength={254}
            onChange={(e) => { setCorreo(e.target.value); quitarError("correo"); }}
            aria-invalid={Boolean(errores.correo)}
            aria-describedby={errores.correo ? "alta-correo-error" : undefined}
            className={`${CAMPO} ${borde(errores.correo)}`}
          />
          {textoError("alta-correo-error", errores.correo)}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="alta-rol" className="block text-xs font-semibold text-foreground">
            Rol
          </label>
          <select
            id="alta-rol"
            value={rol}
            onChange={(e) => { setRol(e.target.value); quitarError("rol"); }}
            aria-invalid={Boolean(errores.rol)}
            aria-describedby={errores.rol ? "alta-rol-error" : undefined}
            className={`${CAMPO} ${borde(errores.rol)}`}
          >
            <option value="">Selecciona un rol</option>
            {roles.map((r) => (
              <option key={r.id} value={r.nombre}>{r.nombre}</option>
            ))}
          </select>
          {textoError("alta-rol-error", errores.rol)}
        </div>
      </div>

      {textoError("alta-error", errores.general)}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={enviando}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-md hover:bg-primary/90 transition-colors disabled:opacity-60"
        >
          {enviando ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          Dar de alta
        </button>
        <button
          type="button"
          onClick={onCancelar}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-md border border-border text-foreground hover:bg-secondary transition-colors"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

// ─── Vista ───────────────────────────────────────────────────────────────────
export default function UsuariosRolesView() {
  const { usuario: enSesion, esAdministrador, recargar } = useSesion();
  const [carga, setCarga] = useState<Carga>({ fase: "cargando" });
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [roles, setRoles] = useState<Rol[]>([]);
  const [rolVisible, setRolVisible] = useState<string | null>(null);
  const [guardandoId, setGuardandoId] = useState<number | null>(null);
  const [altaAbierta, setAltaAbierta] = useState(false);

  const cargar = useCallback(async () => {
    setCarga({ fase: "cargando" });
    try {
      const [listaUsuarios, listaRoles] = await Promise.all([listarUsuarios(), listarRoles()]);
      setUsuarios(listaUsuarios);
      setRoles(listaRoles);
      setCarga({ fase: "lista" });
    } catch (error) {
      setCarga({ fase: "error", mensaje: mensajeDe(error) });
    }
  }, []);

  useEffect(() => {
    if (esAdministrador) void cargar();
  }, [esAdministrador, cargar]);

  if (!esAdministrador) {
    return (
      <div className="flex-1 overflow-y-auto p-8">
        <div role="alert" className="bg-white rounded-xl border border-border p-8 text-center space-y-2">
          <ShieldAlert size={22} className="mx-auto text-amber-600" />
          <h2 className="text-sm font-bold text-foreground">Acceso restringido</h2>
          <p className="text-sm text-muted-foreground">Solo un Administrador puede gestionar usuarios y roles.</p>
        </div>
      </div>
    );
  }

  const editarRol = async (objetivo: Usuario, rolNuevo: string) => {
    setGuardandoId(objetivo.id);
    try {
      const actualizado = await cambiarRol(objetivo.id, rolNuevo);
      setUsuarios((previos) => previos.map((u) => (u.id === objetivo.id ? { ...u, rol: actualizado.rol } : u)));
      toast.success(`${objetivo.nombre} ahora tiene el rol ${actualizado.rol}. Sus permisos ya están vigentes.`);
      // Si el Administrador cambió su propio rol, sus permisos en pantalla se actualizan ya.
      if (objetivo.id === enSesion?.id) await recargar();
    } catch (error) {
      toast.error(mensajeDe(error));
      if (error instanceof ErrorApi && error.codigo === "ROL_NO_AUTORIZADO") await recargar();
    } finally {
      setGuardandoId(null);
    }
  };

  const rolMostrado = roles.find((r) => r.nombre === rolVisible) ?? roles[0];
  const todosLosPermisos = [...new Set(roles.flatMap((r) => r.permisos))];

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-8">
      <div>
        <h2 className="text-xl font-bold text-foreground">Usuarios & Roles</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Administra los usuarios del sistema y consulta los permisos de cada rol.
        </p>
      </div>

      {carga.fase === "cargando" && (
        <div role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={16} className="animate-spin" />
          Cargando usuarios…
        </div>
      )}

      {carga.fase === "error" && (
        <div role="alert" className="bg-white rounded-xl border border-red-200 p-6 space-y-3">
          <p className="text-sm font-medium text-red-700">{carga.mensaje}</p>
          <button
            onClick={() => void cargar()}
            className="px-4 py-2 bg-primary text-white text-sm font-semibold rounded-md hover:bg-primary/90 transition-colors"
          >
            Reintentar
          </button>
        </div>
      )}

      {carga.fase === "lista" && (
        <>
          {/* Roles y permisos (solo lectura) */}
          <section className="bg-white rounded-xl border border-border p-6 space-y-5">
            <div className="flex items-center gap-2">
              <Lock size={16} className="text-primary" />
              <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Roles & Permisos</h3>
            </div>

            <div className="flex gap-2 flex-wrap">
              {roles.map((rol) => (
                <button
                  key={rol.id}
                  onClick={() => setRolVisible(rol.nombre)}
                  aria-pressed={rolMostrado?.id === rol.id}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${rolMostrado?.id === rol.id
                    ? "bg-primary text-white shadow-sm"
                    : "bg-secondary text-foreground hover:bg-secondary/70"
                    }`}
                >
                  {rol.nombre}
                </button>
              ))}
            </div>

            {rolMostrado && (
              <ul
                aria-label={`Permisos del rol ${rolMostrado.nombre}`}
                className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1"
              >
                {todosLosPermisos.map((permiso) => {
                  const activo = rolMostrado.permisos.includes(permiso);
                  return (
                    <li
                      key={permiso}
                      data-activo={activo}
                      className={`flex items-center justify-between px-3 py-2.5 rounded-lg border text-xs font-medium ${activo
                        ? "border-primary/30 bg-primary/5 text-primary"
                        : "border-border bg-background text-muted-foreground"
                        }`}
                    >
                      {permiso}
                      <span className="sr-only">{activo ? ": permitido" : ": no permitido"}</span>
                      <span
                        aria-hidden="true"
                        className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 ml-2 ${activo ? "bg-primary" : "bg-muted"}`}
                      >
                        {activo ? <Check size={10} className="text-white" /> : <X size={10} className="text-muted-foreground" />}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Tabla de usuarios */}
          <section className="bg-white rounded-xl border border-border overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Users size={16} className="text-primary" />
                <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Usuarios del Sistema</h3>
                <span className="text-xs text-muted-foreground ml-2">
                  {usuarios.length} {usuarios.length === 1 ? "usuario" : "usuarios"}
                </span>
              </div>
              {!altaAbierta && (
                <button
                  onClick={() => setAltaAbierta(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-semibold rounded-md hover:bg-primary/90 transition-colors"
                >
                  <UserPlus size={14} />
                  Nuevo usuario
                </button>
              )}
            </div>

            {altaAbierta && (
              <FormularioAlta
                roles={roles}
                onCancelar={() => setAltaAbierta(false)}
                onSinAcceso={() => void recargar()}
                onCreado={(nuevo) => {
                  setUsuarios((previos) => [...previos, nuevo]);
                  setAltaAbierta(false);
                  toast.success(`${nuevo.nombre} fue dado de alta con el rol ${nuevo.rol}.`);
                }}
              />
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    {["Nombre completo", "Correo corporativo", "Rol actual", "Estado de cuenta", "Último acceso"].map((columna, i) => (
                      <th
                        key={columna}
                        scope="col"
                        className={`text-left ${i === 0 ? "px-6" : "px-4"} py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide`}
                      >
                        {columna}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {usuarios.map((u) => {
                    const iniciales = u.nombre.split(" ").map((parte) => parte[0]).join("").slice(0, 2);
                    const activo = u.estado === "active";
                    return (
                      <tr key={u.id} className="hover:bg-secondary/20 transition-colors">
                        <td className="px-6 py-3.5">
                          <div className="flex items-center gap-3">
                            <div
                              aria-hidden="true"
                              className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold flex-shrink-0"
                            >
                              {iniciales}
                            </div>
                            <div className="font-semibold text-foreground text-sm">{u.nombre}</div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-xs text-muted-foreground">{u.correo}</td>
                        <td className="px-4 py-3.5">
                          <select
                            aria-label={`Rol de ${u.nombre}`}
                            value={u.rol}
                            disabled={guardandoId === u.id}
                            onChange={(e) => void editarRol(u, e.target.value)}
                            className="text-xs border border-border rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 font-medium text-foreground disabled:opacity-60"
                          >
                            {roles.map((r) => (
                              <option key={r.id} value={r.nombre}>{r.nombre}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3.5">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${activo
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : "bg-slate-50 text-slate-600 border border-slate-200"
                              }`}
                          >
                            <span aria-hidden="true" className={`w-1.5 h-1.5 rounded-full ${activo ? "bg-emerald-500" : "bg-slate-400"}`} />
                            {activo ? "Activo" : "Inactivo"}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-xs text-muted-foreground font-mono">{fechaCorta(u.ultimoAcceso)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
