import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Building2,
  Calendar,
  ChevronDown,
  ChevronRight,
  Circle,
  LayoutGrid,
  Edit2,
  GitBranch,
  Landmark,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  User,
} from "lucide-react";
import {
  ETIQUETA_NIVEL,
  NIVEL_HIJO,
  NIVELES_RIESGO,
  type NivelNodo,
  type NivelRiesgo,
  type Riesgo,
  type UnidadNegocio,
} from "../../api/estructura";
import { resolverRuta, type RutaCatalogo } from "../../domain/estructura/navegacion";
import { filtrarUnidades, riesgosDeNodo } from "../../domain/estructura/riesgos";
import { sugerenciasNodo, sugerenciasPais, sugerenciasUnidad } from "../../domain/estructura/sugerencias";
import { useEstructuraViewModel, type NodoSeleccionado } from "../../domain/estructura/useEstructuraViewModel";
import { Card } from "../SharedComponents";
import { DetalleUnidadTarjetas } from "./DetalleUnidadTarjetas";
import { nombreVisible } from "../../domain/estructura/nombres";
import { COLOR_NIVEL, FilaRiesgo, NombreConCodigo, ResumenRiesgos, type AccionesGestion } from "./piezasCatalogo";
import { ModalEditarEntidad } from "./ModalEditarEntidad";
import { ModalRegistrarNodo } from "./ModalRegistrarNodo";
import { ModalRegistrarUnidad } from "./ModalRegistrarUnidad";

// Catálogo organizacional (SF-03): la jerarquía unidad → división → subdivisión → área,
// con los riesgos registrados en cada subdivisión. Las divisiones y unidades muestran la
// suma de su rama y se colorean con el peor nivel (lógica en domain/estructura/riesgos.ts).

// ── Jerarquía organizacional de una unidad (vista de árbol) ────────────────────

/** Nodo de la jerarquía con sus hijos y los riesgos de su rama, ya armados para pintarlo. */
interface NodoVista {
  nivel: NivelNodo;
  id: number;
  nombre: string;
  nombreReal?: string | null;
  pais?: string | null;
  hijos: NodoVista[];
  /** Riesgos de toda la rama (en la subdivisión, los suyos; en el área, ninguno). */
  riesgos: Riesgo[];
}

function nodosDeUnidad(unidad: UnidadNegocio): NodoVista[] {
  return unidad.divisiones.map((d) => ({
    nivel: "division",
    id: d.id,
    nombre: d.nombre,
    nombreReal: d.nombreReal,
    riesgos: riesgosDeNodo(d),
    hijos: d.subdivisiones.map((s) => ({
      nivel: "subdivision",
      id: s.id,
      nombre: s.nombre,
      nombreReal: s.nombreReal,
      pais: s.pais,
      riesgos: s.riesgos,
      hijos: s.areas.map((a) => ({ nivel: "area", id: a.id, nombre: a.nombre, hijos: [], riesgos: [] })),
    })),
  }));
}

interface AccionesNodo extends AccionesGestion {
  /** Con un filtro activo todo se muestra expandido para que se vean las coincidencias. */
  estaAbierto: (clave: string) => boolean;
  onAlternar: (clave: string) => void;
}

function NodoFila({
  nodo,
  unidadId,
  profundidad,
  acciones,
}: {
  nodo: NodoVista;
  unidadId: number;
  profundidad: number;
  acciones: AccionesNodo;
}) {
  const clave = `${nodo.nivel}-${nodo.id}`;
  const abierto = acciones.estaAbierto(clave);
  const hijo = NIVEL_HIJO[nodo.nivel];
  const seleccionado: NodoSeleccionado = {
    nivel: nodo.nivel,
    id: nodo.id,
    nombre: nodo.nombre,
    nombreReal: nodo.nombreReal,
    pais: nodo.pais,
    unidadId,
  };
  const visible = nombreVisible(nodo);
  // Solo la subdivisión lista sus riesgos; los niveles superiores muestran el resumen.
  const riesgosPropios = nodo.nivel === "subdivision" ? nodo.riesgos : [];
  const tieneContenido = nodo.hijos.length > 0 || riesgosPropios.length > 0;

  return (
    <div data-testid={`nodo-${clave}`}>
      <div
        className="flex items-center gap-1.5 py-1 pr-1 rounded-md hover:bg-slate-50 group/nodo"
        style={{ paddingLeft: `${profundidad * 16}px` }}
      >
        <button
          type="button"
          onClick={() => acciones.onAlternar(clave)}
          disabled={!tieneContenido}
          aria-label={abierto ? `Contraer ${visible}` : `Expandir ${visible}`}
          className="w-4 h-4 flex items-center justify-center flex-shrink-0 text-muted-foreground disabled:cursor-default"
        >
          {!tieneContenido ? (
            <Circle size={4} className="text-muted-foreground/50" />
          ) : abierto ? (
            <ChevronDown size={13} />
          ) : (
            <ChevronRight size={13} />
          )}
        </button>
        <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold flex-shrink-0 ${COLOR_NIVEL[nodo.nivel]}`}>
          {ETIQUETA_NIVEL[nodo.nivel]}
        </span>
        <span className="text-xs font-medium text-slate-800 truncate flex-1">
          <NombreConCodigo nodo={nodo} />
        </span>
        {nodo.pais && (
          <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground flex-shrink-0">
            <MapPin size={10} />
            {nodo.pais}
          </span>
        )}
        <ResumenRiesgos riesgos={nodo.riesgos} testId={`riesgos-${clave}`} />
        {acciones.puedeGestionar && (
          <div className="flex items-center gap-0.5 flex-shrink-0 opacity-60 group-hover/nodo:opacity-100 transition-opacity">
            {hijo && (
              <button
                type="button"
                onClick={() => acciones.onAgregar({ nivel: hijo, padreId: nodo.id, padreNombre: visible, unidadId })}
                title={`Agregar ${ETIQUETA_NIVEL[hijo].toLowerCase()}`}
                data-testid={`btn-agregar-${clave}`}
                className="p-1 text-slate-400 hover:text-primary transition-colors"
              >
                <Plus size={11} />
              </button>
            )}
            <button
              type="button"
              onClick={() => acciones.onEditar(seleccionado)}
              title={`Editar ${ETIQUETA_NIVEL[nodo.nivel].toLowerCase()}`}
              className="p-1 text-slate-400 hover:text-slate-700 transition-colors"
            >
              <Edit2 size={11} />
            </button>
            <button
              type="button"
              onClick={() => acciones.onEliminar(seleccionado)}
              title={`Eliminar ${ETIQUETA_NIVEL[nodo.nivel].toLowerCase()}`}
              data-testid={`btn-eliminar-${clave}`}
              className="p-1 text-slate-400 hover:text-red-600 transition-colors"
            >
              <Trash2 size={11} />
            </button>
          </div>
        )}
      </div>
      {abierto && (
        <>
          {nodo.hijos.map((h) => (
            <NodoFila key={`${h.nivel}-${h.id}`} nodo={h} unidadId={unidadId} profundidad={profundidad + 1} acciones={acciones} />
          ))}
          {riesgosPropios.map((r) => (
            <FilaRiesgo key={r.id} riesgo={r} profundidad={profundidad + 1} />
          ))}
        </>
      )}
    </div>
  );
}

// ── Componente Principal: HierarchyView ────────────────────────────────────────

const OPCIONES_NIVEL: Array<{ valor: NivelRiesgo | ""; etiqueta: string }> = [
  { valor: "", etiqueta: "Todos los niveles" },
  ...NIVELES_RIESGO.map((nivel) => ({ valor: nivel, etiqueta: nivel === "Crítico" ? "Crítico" : `${nivel} o superior` })),
];

export function HierarchyView() {
  const {
    unidades,
    periodoActivo,
    departamentos,
    responsables,
    cargando,
    guardando,
    puedeGestionar,
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

  // Vista de tarjetas de una unidad: la ruta guarda ids y se resuelve contra los datos frescos.
  // Si la unidad abierta se elimina, resolverRuta devuelve null y se vuelve al catálogo.
  const [ruta, setRuta] = useState<RutaCatalogo | null>(null);
  const resuelta = useMemo(() => resolverRuta(unidades, ruta), [unidades, ruta]);

  // Sugerencias de los formularios (catálogo de FEMSA + lo ya registrado).
  const paisesSugeridos = useMemo(() => sugerenciasPais(unidades), [unidades]);
  const nombresUnidadSugeridos = useMemo(() => sugerenciasUnidad(unidades), [unidades]);
  const nombresNodoSugeridos = useMemo(
    () => (altaNodo ? sugerenciasNodo(altaNodo.nivel, unidades, altaNodo.padreId) : []),
    [altaNodo, unidades],
  );

  // Búsqueda y filtro por nivel de riesgo.
  const [texto, setTexto] = useState("");
  const [nivel, setNivel] = useState<NivelRiesgo | null>(null);
  const filtroActivo = texto.trim() !== "" || nivel !== null;
  const unidadesVisibles = useMemo(() => filtrarUnidades(unidades, { texto, nivel }), [unidades, texto, nivel]);
  const totalRiesgos = useMemo(() => unidades.flatMap(riesgosDeNodo).length, [unidades]);

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

  // Nodos contraídos en el árbol (por defecto todo expandido).
  const [colapsados, setColapsados] = useState<Set<string>>(new Set());
  const accionesNodo: AccionesNodo = {
    puedeGestionar,
    estaAbierto: (clave) => filtroActivo || !colapsados.has(clave),
    onAlternar: (clave) =>
      setColapsados((prev) => {
        const next = new Set(prev);
        next.has(clave) ? next.delete(clave) : next.add(clave);
        return next;
      }),
    onAgregar: abrirAltaNodo,
    onEditar: abrirEditarNodo,
    onEliminar: (item) => pedirEliminacion({ tipo: "nodo", item }),
  };

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
    <div className="flex-1 overflow-auto flex flex-col bg-slate-50/50" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
      {/* ── Encabezado de la Página ── */}
      <div className="px-6 pt-5 pb-0 flex-shrink-0 bg-white border-b border-border shadow-sm">
        <nav className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
          <span className="hover:text-foreground cursor-pointer transition-colors">Inicio</span>
          <ChevronRight size={12} className="text-muted-foreground/40" />
          <span className="text-foreground font-semibold">Catálogo Organizacional</span>
        </nav>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground tracking-tight">Catálogo Organizacional</h1>
              {periodoActivo ? (
                <div
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold"
                  title="Periodo de Auditoría activo para la parametrización de nuevas entidades"
                  data-testid="badge-periodo-activo"
                >
                  <Calendar size={13} className="text-emerald-600" />
                  <span>Periodo Activo: {periodoActivo.nombre}</span>
                </div>
              ) : (
                <div
                  className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs font-medium"
                  data-testid="badge-sin-periodo"
                >
                  <AlertTriangle size={13} className="text-amber-600" />
                  <span>Sin Periodo Activo</span>
                </div>
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

      {/* ── Contenido Principal ── */}
      <div className="flex-1 overflow-auto p-6">
        {resuelta ? (
          <div className="max-w-7xl mx-auto">
            <DetalleUnidadTarjetas
              resuelta={resuelta}
              onNavegar={setRuta}
              acciones={accionesNodo}
              onEditarUnidad={abrirEditarUnidad}
              onEliminarUnidad={(u) => pedirEliminacion({ tipo: "unidad", item: u })}
            />
          </div>
        ) : (
          <div className="space-y-5 max-w-7xl mx-auto">
            {/* Barra de búsqueda y filtro por nivel de riesgo */}
            <div className="flex flex-col md:flex-row md:items-center gap-3">
              <div className="relative flex-1 max-w-lg">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  placeholder="Buscar unidad, división, subdivisión, área o riesgo…"
                  aria-label="Buscar en el catálogo"
                  className="w-full bg-white border border-border rounded-lg pl-9 pr-4 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm"
                />
              </div>
              <select
                value={nivel ?? ""}
                onChange={(e) => setNivel((e.target.value || null) as NivelRiesgo | null)}
                aria-label="Filtrar por nivel de riesgo"
                className="bg-white border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm"
              >
                {OPCIONES_NIVEL.map((o) => (
                  <option key={o.valor} value={o.valor}>
                    {o.etiqueta}
                  </option>
                ))}
              </select>
              <span className="text-xs font-medium text-muted-foreground bg-white px-2.5 py-1.5 rounded-md border border-border md:ml-auto">
                <span className="font-bold text-foreground">{unidades.length}</span> unidades ·{" "}
                <span className="font-bold text-foreground">{totalRiesgos}</span> riesgos registrados
              </span>
            </div>

            {cargando ? (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {[1, 2].map((i) => (
                  <div key={i} className="h-44 rounded-xl bg-white border border-border/70 p-5 animate-pulse shadow-sm" />
                ))}
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
                <button
                  onClick={() => {
                    setTexto("");
                    setNivel(null);
                  }}
                  className="text-xs font-semibold text-primary hover:underline mt-2"
                >
                  Limpiar filtros
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-5" data-testid="lista-unidades">
                {unidadesVisibles.map((u) => (
                  <Card
                    key={u.id}
                    className="p-5 bg-white border border-border hover:border-primary/40 transition-all rounded-xl shadow-sm flex flex-col justify-between group"
                  >
                    <div>
                      {/* Cabecera de la tarjeta */}
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                              Unidad de Negocio
                            </span>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                              {u.periodoFiscalNombre}
                            </span>
                            <ResumenRiesgos riesgos={riesgosDeNodo(u)} testId={`riesgos-unidad-${u.id}`} />
                          </div>
                          <h3 className="text-base font-bold text-foreground truncate">
                            <button
                              type="button"
                              onClick={() => setRuta({ unidadId: u.id })}
                              title="Ver la jerarquía en tarjetas"
                              className="hover:text-primary hover:underline transition-colors text-left"
                            >
                              <NombreConCodigo nodo={u} />
                            </button>
                          </h3>
                        </div>

                        {/* Acciones de gestión para la unidad */}
                        {puedeGestionar && (
                          <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => abrirEditarUnidad(u)}
                              title="Editar unidad"
                              className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              onClick={() => pedirEliminacion({ tipo: "unidad", item: u })}
                              title="Eliminar unidad"
                              data-testid={`btn-eliminar-unidad-${u.id}`}
                              className="p-1.5 rounded-md hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Responsable y departamento de auditoría */}
                      <div className="flex flex-col gap-1.5 text-xs text-muted-foreground mb-4 pb-3 border-b border-border/60">
                        <div className="flex items-center gap-2">
                          <User size={13} className="text-slate-400 flex-shrink-0" />
                          <span className="truncate">
                            Gerente responsable: <span className="font-semibold text-foreground">{u.responsableNombre}</span>
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Landmark size={13} className="text-slate-400 flex-shrink-0" />
                          <span className="truncate">
                            Departamento de auditoría:{" "}
                            <span className="font-semibold text-foreground">
                              {u.departamentoAuditoriaNombre ?? "Sin asignar"}
                            </span>
                          </span>
                        </div>
                      </div>

                      {/* Jerarquía: división → subdivisión → área, con riesgos por subdivisión */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-foreground uppercase tracking-wide flex items-center gap-1.5">
                            <GitBranch size={13} className="text-muted-foreground" />
                            Divisiones ({u.divisiones.length})
                          </span>
                          {puedeGestionar && (
                            <button
                              onClick={() =>
                                abrirAltaNodo({ nivel: "division", padreId: u.id, padreNombre: nombreVisible(u), unidadId: u.id })
                              }
                              title="Agregar división a la unidad"
                              data-testid={`btn-agregar-division-unidad-${u.id}`}
                              className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1"
                            >
                              <Plus size={12} />
                              Agregar
                            </button>
                          )}
                        </div>

                        {u.divisiones.length === 0 ? (
                          <p className="text-[11px] text-muted-foreground italic">Sin divisiones registradas.</p>
                        ) : (
                          <div className="rounded-lg border border-slate-100 bg-white p-1.5">
                            {nodosDeUnidad(u).map((n) => (
                              <NodoFila key={`${n.nivel}-${n.id}`} nodo={n} unidadId={u.id} profundidad={0} acciones={accionesNodo} />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground/70 mt-4 pt-2 border-t border-border/40">
                      <span>
                        ID: #{u.id} • Creada en {new Date(u.creadoEn).toLocaleDateString()}
                      </span>
                      <button
                        type="button"
                        onClick={() => setRuta({ unidadId: u.id })}
                        data-testid={`btn-ver-tarjetas-${u.id}`}
                        className="flex items-center gap-1 font-semibold text-primary hover:underline"
                      >
                        <LayoutGrid size={12} />
                        Ver en tarjetas
                        <ChevronRight size={12} />
                      </button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Modal de Alta de Unidad de Negocio (AC1 & AC2) ── */}
      <ModalRegistrarUnidad
        abierto={modalAltaAbierto}
        periodoActivo={periodoActivo}
        responsables={responsables}
        departamentos={departamentos}
        guardando={guardando}
        errorServidor={errorModalAlta}
        onGuardar={guardarNuevaUnidad}
        onCerrar={cerrarModalAlta}
        sugerenciasNombre={nombresUnidadSugeridos}
      />

      {/* ── Modal de Alta de División, Subdivisión o Área ── */}
      <ModalRegistrarNodo
        contexto={altaNodo}
        guardando={guardando}
        errorServidor={errorModalNodo}
        onGuardar={guardarNuevoNodo}
        onCerrar={cerrarAltaNodo}
        sugerenciasNombre={nombresNodoSugeridos}
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
              ¿Estás seguro de que deseas eliminar{" "}
              {entidadAEliminar.tipo === "unidad"
                ? "la unidad de negocio"
                : `${entidadAEliminar.item.nivel === "area" ? "el" : "la"} ${ETIQUETA_NIVEL[entidadAEliminar.item.nivel].toLowerCase()}`}{" "}
              <span className="font-bold text-foreground">"{nombreVisible(entidadAEliminar.item)}"</span>?
            </p>
            {errorEliminacion ? (
              <div
                role="alert"
                data-testid="error-eliminacion"
                className="text-[11px] text-red-700 bg-red-50 border border-red-200 p-2.5 rounded-lg mb-5 flex items-start gap-2"
              >
                <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                <span>{errorEliminacion}</span>
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
                {errorEliminacion ? "Cerrar" : "Cancelar"}
              </button>
              {!errorEliminacion && (
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
