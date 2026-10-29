import { useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, Building2, Calendar, ChevronRight, Pencil, Plus, RefreshCw, Search } from "lucide-react";
import { ETIQUETA_NIVEL, NIVELES_RIESGO, type AltaUnidadInput, type NivelRiesgo, type UnidadNegocio } from "../../api/estructura";
import { clavesAncestros, dependientesDe, resolverRuta, type RutaCatalogo } from "../../domain/estructura/navegacion";
import { filtrarUnidades, riesgosDeNodo } from "../../domain/estructura/riesgos";
import { sugerenciasArea, sugerenciasPais } from "../../domain/estructura/sugerencias";
import { useEstructuraViewModel, type NodoSeleccionado } from "../../domain/estructura/useEstructuraViewModel";
import { Card } from "../SharedComponents";
import { ArbolCatalogo } from "./ArbolCatalogo";
import { DetalleCatalogo, ResumenUnidades } from "./DetalleCatalogo";
import { nombreVisible } from "../../domain/estructura/nombres";
import type { AccionesGestion } from "./piezasCatalogo";
import { ModalEditarEntidad } from "./ModalEditarEntidad";
import { ModalPeriodos } from "./ModalPeriodos";
import { ModalRegistrarNodo } from "./ModalRegistrarNodo";
import { ModalRegistrarUnidad } from "./ModalRegistrarUnidad";

// Catálogo organizacional (SF-03): la jerarquía unidad → división → subdivisión → área,
// con los riesgos registrados en cada subdivisión. Explorador de dos paneles: a la izquierda
// el árbol de navegación (sin áreas ni riesgos) y a la derecha el detalle del nodo elegido.
// Las divisiones y unidades muestran la suma de su rama (lógica en domain/estructura/riesgos.ts).

const OPCIONES_NIVEL: Array<{ valor: NivelRiesgo | ""; etiqueta: string }> = [
  { valor: "", etiqueta: "Todos los niveles" },
  ...NIVELES_RIESGO.map((nivel) => ({ valor: nivel, etiqueta: nivel })),
];

export function HierarchyView() {
  const {
    unidades,
    periodoActivo,
    periodos,
    departamentos,
    responsables,
    cargando,
    errorCarga,
    guardando,
    puedeGestionar,
    modalPeriodosAbierto,
    errorModalPeriodos,
    abrirModalPeriodos,
    cerrarModalPeriodos,
    guardarPeriodo,
    activarPeriodo,
    codigoProximo,
    modalAltaAbierto,
    errorModalAlta,
    abrirModalAlta,
    cerrarModalAlta,
    guardarNuevaUnidad,
    altaNodo,
    errorModalNodo,
    abrirAltaNodo,
    cerrarAltaNodo,
    guardarNuevoNodo,
    unidadEditando,
    nodoEditando,
    errorModalEdicion,
    abrirEditarUnidad,
    abrirEditarNodo,
    cerrarEdicion,
    guardarEdicionUnidad,
    guardarEdicionNodo,
    eliminarUnidad,
    eliminarNodo,
    recargar,
  } = useEstructuraViewModel();

  // Sugerencias de los formularios (catálogo de FEMSA + lo ya registrado).
  const paisesSugeridos = useMemo(() => sugerenciasPais(unidades), [unidades]);
  const areasSugeridas = useMemo(
    () => (altaNodo?.nivel === "area" ? sugerenciasArea(unidades, altaNodo.padreId) : []),
    [altaNodo, unidades],
  );

  // Búsqueda y filtro por nivel de riesgo.
  const [texto, setTexto] = useState("");
  const [nivel, setNivel] = useState<NivelRiesgo | null>(null);
  const filtroActivo = texto.trim() !== "" || nivel !== null;
  const unidadesVisibles = useMemo(() => filtrarUnidades(unidades, { texto, nivel }), [unidades, texto, nivel]);
  const totalRiesgos = useMemo(() => unidades.flatMap(riesgosDeNodo).length, [unidades]);
  const limpiarFiltros = () => {
    setTexto("");
    setNivel(null);
  };

  // Nodo elegido en el explorador: la ruta guarda ids y se resuelve contra los datos (ya
  // filtrados) frescos. Si el nodo se elimina o el filtro lo oculta, cae a su ancestro o al resumen.
  const [ruta, setRuta] = useState<RutaCatalogo | null>(null);
  const resuelta = useMemo(() => resolverRuta(unidadesVisibles, ruta), [unidadesVisibles, ruta]);

  // Nodos expandidos en el árbol (por defecto todo contraído). Al navegar se abren los
  // ancestros del destino; con un filtro activo todo se muestra expandido.
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
  const navegar = (destino: RutaCatalogo | null) => {
    setRuta(destino);
    setExpandidos((prev) => new Set([...prev, ...clavesAncestros(destino)]));
  };
  const alternar = (clave: string) =>
    setExpandidos((prev) => {
      const next = new Set(prev);
      next.has(clave) ? next.delete(clave) : next.add(clave);
      return next;
    });

  // AC1: tras dar de alta una unidad se abre su detalle para seguir con su jerarquía (hasta el
  // área, el "proceso"). Se limpian los filtros porque la unidad nueva podría no coincidir.
  const registrarUnidad = async (datos: AltaUnidadInput) => {
    const nueva = await guardarNuevaUnidad(datos);
    if (nueva) {
      limpiarFiltros();
      navegar({ unidadId: nueva.id });
    }
    return nueva;
  };

  // Estado de confirmación de eliminación; el error del servidor (AC3) se muestra en el diálogo.
  const [entidadAEliminar, setEntidadAEliminar] = useState<
    { tipo: "unidad"; item: UnidadNegocio } | { tipo: "nodo"; item: NodoSeleccionado } | null
  >(null);
  const [errorEliminacion, setErrorEliminacion] = useState<string | null>(null);
  const [eliminando, setEliminando] = useState(false);

  const pedirEliminacion = (entidad: NonNullable<typeof entidadAEliminar>) => {
    setErrorEliminacion(null);
    setEntidadAEliminar(entidad);
  };

  const cancelarEliminacion = () => {
    setEntidadAEliminar(null);
    setErrorEliminacion(null);
  };

  const accionesNodo: AccionesGestion = {
    puedeGestionar,
    onAgregar: abrirAltaNodo,
    onEditar: abrirEditarNodo,
    onEliminar: (item) => pedirEliminacion({ tipo: "nodo", item }),
  };

  // Lo que impide borrar y ya se sabe en la vista (hijos o riesgos); las auditorías activas
  // solo las conoce el servidor.
  const dependientes = entidadAEliminar
    ? dependientesDe(
        unidades,
        entidadAEliminar.tipo === "unidad"
          ? { nivel: "unidad", id: entidadAEliminar.item.id, unidadId: entidadAEliminar.item.id }
          : entidadAEliminar.item,
      )
    : null;

  const ejecutarEliminacion = async () => {
    if (!entidadAEliminar) return;
    setEliminando(true);
    const error =
      entidadAEliminar.tipo === "unidad"
        ? await eliminarUnidad(entidadAEliminar.item)
        : await eliminarNodo(entidadAEliminar.item);
    setEliminando(false);
    if (error) {
      setErrorEliminacion(error);
    } else {
      cancelarEliminacion();
    }
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-slate-50/50" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {/* ── Encabezado de la Página ── */}
      <div className="px-6 pt-5 pb-0 flex-shrink-0 bg-white border-b border-border">
        <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
          <span className="hover:text-foreground cursor-pointer transition-colors">Inicio</span>
          <ChevronRight size={12} className="text-muted-foreground/40" />
          <span className="text-foreground font-semibold">Catálogo Organizacional</span>
        </nav>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground tracking-tight">Catálogo Organizacional</h1>
              {/* Periodo activo; quien gestiona la estructura lo abre para registrar o activar periodos. */}
              {periodoActivo ? (
                <BadgePeriodo
                  onClick={puedeGestionar ? abrirModalPeriodos : undefined}
                  className="bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold"
                  title={
                    puedeGestionar
                      ? "Gestionar periodos de auditoría"
                      : "Periodo de Auditoría activo para la parametrización de nuevas entidades"
                  }
                  testId="badge-periodo-activo"
                >
                  <Calendar size={13} className="text-emerald-600" />
                  <span>Periodo Activo: {periodoActivo.nombre}</span>
                  {puedeGestionar && <Pencil size={12} className="text-emerald-600" aria-hidden />}
                </BadgePeriodo>
              ) : (
                <BadgePeriodo
                  onClick={puedeGestionar ? abrirModalPeriodos : undefined}
                  className="bg-amber-50 text-amber-700 border-amber-200 font-medium"
                  title={puedeGestionar ? "Configurar un periodo de auditoría activo" : undefined}
                  testId="badge-sin-periodo"
                >
                  <AlertTriangle size={13} className="text-amber-600" />
                  <span>Sin Periodo Activo{puedeGestionar && " · Configurar periodo"}</span>
                </BadgePeriodo>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Unidades de negocio con su jerarquía (división, subdivisión y área) y los riesgos registrados en cada rama.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => recargar()}
              disabled={cargando}
              className="p-2 rounded-lg border border-border text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors disabled:opacity-50"
              title="Recargar catálogo"
            >
              <RefreshCw size={15} className={cargando ? "animate-spin" : ""} />
            </button>

            {/* Alta de Unidad de Negocio (AC1: solo Administrador y Jefe de Auditoría) */}
            {puedeGestionar && (
              <button
                id="btn-nueva-unidad"
                data-testid="btn-nueva-unidad"
                onClick={abrirModalAlta}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-all shadow-sm"
              >
                <Plus size={15} />
                Nueva Unidad de Negocio
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Barra de búsqueda y filtro por nivel de riesgo ── */}
      <div className="px-6 py-3 flex flex-col md:flex-row md:items-center gap-3 bg-white border-b border-border flex-shrink-0">
        <div className="relative flex-1 max-w-lg">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Buscar unidad, división, subdivisión, área o riesgo…"
            aria-label="Buscar en el catálogo"
            className="w-full bg-white border border-border rounded-lg pl-9 pr-4 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <select
          value={nivel ?? ""}
          onChange={(e) => setNivel((e.target.value || null) as NivelRiesgo | null)}
          aria-label="Filtrar por nivel de riesgo"
          className="bg-white border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          {OPCIONES_NIVEL.map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.etiqueta}
            </option>
          ))}
        </select>
        {filtroActivo && (
          <button type="button" onClick={limpiarFiltros} className="text-xs font-semibold text-primary hover:underline self-start md:self-auto">
            Limpiar filtros
          </button>
        )}
        <span className="text-xs text-muted-foreground md:ml-auto">
          <span className="font-bold text-foreground">{unidades.length}</span> unidades ·{" "}
          <span className="font-bold text-foreground">{totalRiesgos}</span> riesgos registrados
        </span>
      </div>

      {/* ── Explorador: árbol de navegación + detalle ── */}
      <div className="flex-1 min-h-0 flex">
        {!cargando && unidadesVisibles.length > 0 && (
          <aside className="hidden lg:flex flex-col w-80 flex-shrink-0 bg-white border-r border-border">
            <div className="px-4 pt-4 pb-2 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Estructura</span>
              <button
                type="button"
                onClick={() => navegar(null)}
                className={`text-[11px] font-semibold px-2 py-1 rounded-md transition-colors ${
                  resuelta === null ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-slate-100"
                }`}
              >
                Ver todas
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-2 pb-4">
              <ArbolCatalogo
                unidades={unidadesVisibles}
                ruta={resuelta ? ruta : null}
                onNavegar={navegar}
                estaAbierto={(clave) => filtroActivo || expandidos.has(clave)}
                onAlternar={alternar}
              />
            </div>
          </aside>
        )}

        <main className="flex-1 min-w-0 overflow-y-auto p-6">
          {/* @container: las columnas dependen del ancho del panel, no de la ventana (el árbol ocupa 320px). */}
          <div className="@container max-w-6xl mx-auto">
            {cargando ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-44 rounded-xl bg-white border border-border/70 p-5 animate-pulse shadow-sm" />
                ))}
              </div>
            ) : errorCarga ? (
              <div
                role="alert"
                data-testid="error-carga"
                className="text-center py-16 bg-white rounded-xl border border-red-200 p-8 shadow-sm"
              >
                <AlertTriangle size={36} className="mx-auto text-red-500/70 mb-3" />
                <h3 className="text-base font-bold text-foreground">No se pudo cargar el catálogo</h3>
                <p className="text-xs text-muted-foreground max-w-md mx-auto mt-1 mb-4">{errorCarga}</p>
                <button
                  onClick={() => recargar()}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-all shadow-sm"
                >
                  <RefreshCw size={14} />
                  Reintentar
                </button>
              </div>
            ) : unidades.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-xl border border-dashed border-border p-8 shadow-sm">
                <Building2 size={40} className="mx-auto text-muted-foreground/40 mb-3" />
                <h3 className="text-base font-bold text-foreground">No hay unidades de negocio registradas</h3>
                <p className="text-xs text-muted-foreground max-w-md mx-auto mt-1 mb-4">
                  Registra la primera unidad de negocio y su jerarquía para establecer el marco de referencia de
                  auditoría.
                </p>
                {puedeGestionar && (
                  <button
                    onClick={abrirModalAlta}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-all shadow-sm"
                  >
                    <Plus size={14} />
                    Registrar Unidad de Negocio
                  </button>
                )}
              </div>
            ) : unidadesVisibles.length === 0 ? (
              <div
                data-testid="sin-coincidencias"
                className="text-center py-12 bg-white rounded-xl border border-dashed border-border p-8 shadow-sm"
              >
                <Search size={32} className="mx-auto text-muted-foreground/40 mb-3" />
                <h3 className="text-sm font-bold text-foreground">Ninguna rama coincide con el filtro</h3>
                <button onClick={limpiarFiltros} className="text-xs font-semibold text-primary hover:underline mt-2">
                  Limpiar filtros
                </button>
              </div>
            ) : resuelta ? (
              <DetalleCatalogo
                resuelta={resuelta}
                onNavegar={navegar}
                acciones={accionesNodo}
                onEditarUnidad={abrirEditarUnidad}
                onEliminarUnidad={(u) => pedirEliminacion({ tipo: "unidad", item: u })}
              />
            ) : (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-foreground">
                  {filtroActivo ? "Unidades con coincidencias" : "Unidades de negocio"}
                  <span className="ml-1.5 font-normal text-muted-foreground">({unidadesVisibles.length})</span>
                </h2>
                <ResumenUnidades unidades={unidadesVisibles} onNavegar={navegar} />
              </div>
            )}
          </div>
        </main>
      </div>

      {/* ── Modal de Alta de Unidad de Negocio (AC1 & AC2) ── */}
      <ModalRegistrarUnidad
        abierto={modalAltaAbierto}
        periodoActivo={periodoActivo}
        responsables={responsables}
        departamentos={departamentos}
        guardando={guardando}
        errorServidor={errorModalAlta}
        onGuardar={registrarUnidad}
        onCerrar={cerrarModalAlta}
        codigoProximo={codigoProximo}
      />

      {/* ── Modal de Periodos de Auditoría ── */}
      <ModalPeriodos
        abierto={modalPeriodosAbierto}
        periodos={periodos}
        periodoActivo={periodoActivo}
        guardando={guardando}
        errorServidor={errorModalPeriodos}
        onGuardar={guardarPeriodo}
        onActivar={activarPeriodo}
        onCerrar={cerrarModalPeriodos}
      />

      {/* ── Modal de Alta de División, Subdivisión o Área ── */}
      <ModalRegistrarNodo
        contexto={altaNodo}
        guardando={guardando}
        errorServidor={errorModalNodo}
        onGuardar={guardarNuevoNodo}
        onCerrar={cerrarAltaNodo}
        codigoProximo={codigoProximo}
        sugerencias={areasSugeridas}
        sugerenciasPais={paisesSugeridos}
      />

      {/* ── Modal de Edición de Entidad ── */}
      <ModalEditarEntidad
        unidad={unidadEditando}
        nodo={nodoEditando}
        responsables={responsables}
        departamentos={departamentos}
        guardando={guardando}
        errorServidor={errorModalEdicion}
        onGuardarUnidad={guardarEdicionUnidad}
        onGuardarNodo={guardarEdicionNodo}
        onCerrar={cerrarEdicion}
        sugerenciasPais={paisesSugeridos}
      />

      {/* ── Modal de Confirmación de Eliminación (AC3) ── */}
      {entidadAEliminar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <Card className="w-full max-w-md p-6 bg-white shadow-2xl relative rounded-xl border border-border">
            <div className="flex items-center gap-3 mb-4 text-red-600">
              <div className="p-2 rounded-full bg-red-100">
                <AlertTriangle size={20} />
              </div>
              <h3 className="text-base font-bold text-foreground">Confirmar Eliminación</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              {/* Si ya se sabe que no se puede borrar, no se pregunta si se está seguro. */}
              {dependientes ? "Eliminar" : "¿Estás seguro de que deseas eliminar"}{" "}
              {entidadAEliminar.tipo === "unidad"
                ? "la unidad de negocio"
                : `${entidadAEliminar.item.nivel === "area" ? "el" : "la"} ${ETIQUETA_NIVEL[entidadAEliminar.item.nivel].toLowerCase()}`}{" "}
              <span className="font-bold text-foreground">"{nombreVisible(entidadAEliminar.item)}"</span>
              {!dependientes && "?"}
            </p>
            {errorEliminacion || dependientes ? (
              <div
                role="alert"
                data-testid="error-eliminacion"
                className="text-[11px] text-red-700 bg-red-50 border border-red-200 p-2.5 rounded-lg mb-5 flex items-start gap-2"
              >
                <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                <span>
                  {errorEliminacion ?? `No se puede eliminar porque tiene ${dependientes}. Elimínalos primero.`}
                </span>
              </div>
            ) : (
              <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 p-2.5 rounded-lg mb-5">
                No se puede eliminar mientras existan auditorías activas (planes aprobados o en ejecución) en su rama, ni
                si tiene elementos dependientes (niveles inferiores o riesgos registrados): elimínalos primero.
              </p>
            )}
            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={cancelarEliminacion}
                className="px-4 py-2 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              >
                {errorEliminacion || dependientes ? "Cerrar" : "Cancelar"}
              </button>
              {!errorEliminacion && !dependientes && (
                <button
                  type="button"
                  data-testid="btn-confirmar-eliminar"
                  onClick={ejecutarEliminacion}
                  disabled={eliminando}
                  className="px-4 py-2 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition-colors shadow-sm disabled:opacity-50"
                >
                  Eliminar
                </button>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

/** Insignia del periodo activo: botón si quien la ve puede gestionar periodos. */
function BadgePeriodo({
  onClick,
  className,
  title,
  testId,
  children,
}: {
  onClick?: () => void;
  className: string;
  title?: string;
  testId: string;
  children: ReactNode;
}) {
  const base = `flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs ${className}`;
  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      title={title}
      data-testid={testId}
      className={`${base} hover:brightness-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40`}
    >
      {children}
    </button>
  ) : (
    <div className={base} title={title} data-testid={testId}>
      {children}
    </div>
  );
}
