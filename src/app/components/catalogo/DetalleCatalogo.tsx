import { useState, type ReactNode } from "react";
import { ChevronRight, Landmark, MapPin, Plus, ShieldAlert, User } from "lucide-react";
import {
  ETIQUETA_NIVEL,
  NIVEL_HIJO,
  type NivelNodo,
  type Riesgo,
  type Subdivision,
  type UnidadNegocio,
} from "../../api/estructura";
import { conteosRama, resumenHijos, type RutaCatalogo, type RutaResuelta } from "../../domain/estructura/navegacion";
import { ORDEN_NIVEL, riesgosDeNodo } from "../../domain/estructura/riesgos";
import type { NodoSeleccionado } from "../../domain/estructura/useEstructuraViewModel";
import { Card } from "../SharedComponents";
import { nombreVisible, type ConNombre } from "../../domain/estructura/nombres";
import {
  BarraRiesgos,
  BotonesGestion,
  ChipNivelRiesgo,
  COLOR_NIVEL,
  NombreConCodigo,
  ResumenRiesgos,
  type AccionesGestion,
} from "./piezasCatalogo";

// Panel de detalle del catálogo (SF-03). Sin selección muestra el resumen de las unidades;
// con una unidad o división, sus indicadores y la lista de hijos; con una subdivisión, sus
// riesgos y sus áreas. Se navega desde aquí o desde el árbol (ArbolCatalogo).

type NodoBase = { id: number; codigo?: string | null; nombre?: string | null; pais?: string | null };
type Gestion = { onEditar: () => void; onEliminar: () => void };

/** Anillo de foco para los controles propios (navegación con teclado). */
const FOCO = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40";

// ── Piezas ─────────────────────────────────────────────────────────────────────

function Migas({ resuelta, onNavegar }: { resuelta: RutaResuelta; onNavegar: (ruta: RutaCatalogo | null) => void }) {
  const { unidad, division, subdivision } = resuelta;
  const migas: Array<{ etiqueta: string; ruta: RutaCatalogo | null }> = [
    { etiqueta: "Todas las unidades", ruta: null },
    { etiqueta: nombreVisible(unidad), ruta: { unidadId: unidad.id } },
  ];
  if (division) migas.push({ etiqueta: nombreVisible(division), ruta: { unidadId: unidad.id, divisionId: division.id } });
  if (division && subdivision) {
    migas.push({
      etiqueta: nombreVisible(subdivision),
      ruta: { unidadId: unidad.id, divisionId: division.id, subdivisionId: subdivision.id },
    });
  }

  return (
    <nav aria-label="Ruta en la jerarquía" className="flex items-center gap-0.5 flex-wrap text-xs">
      {migas.map((miga, i) => {
        const actual = i === migas.length - 1;
        return (
          <span key={`${i}-${miga.etiqueta}`} className="flex items-center gap-0.5">
            {i > 0 && <ChevronRight size={12} className="text-muted-foreground/50" />}
            <button
              type="button"
              onClick={() => onNavegar(miga.ruta)}
              disabled={actual}
              aria-current={actual ? "page" : undefined}
              className={`px-1.5 py-0.5 rounded ${
                actual ? "font-semibold text-foreground" : "text-muted-foreground hover:text-primary hover:bg-primary/5"
              }`}
            >
              {miga.etiqueta}
            </button>
          </span>
        );
      })}
    </nav>
  );
}

function Indicador({ valor, etiqueta }: { valor: number; etiqueta: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xl font-bold text-foreground tabular-nums leading-none">{valor}</p>
      <p className="text-[11px] text-muted-foreground mt-1 truncate">{etiqueta}</p>
    </div>
  );
}

function BotonAgregar({ etiqueta, onClick }: { etiqueta: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid="btn-agregar-hijo"
      className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-semibold text-primary hover:bg-primary/5 transition-colors"
    >
      <Plus size={13} />
      Agregar {etiqueta.toLowerCase()}
    </button>
  );
}

function Seccion({ titulo, accion, children }: { titulo: ReactNode; accion?: ReactNode; children: ReactNode }) {
  return (
    <Card className="bg-white border border-border rounded-xl shadow-sm overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border/70 min-h-[46px]">
        <div className="text-xs font-semibold text-foreground">{titulo}</div>
        {accion}
      </div>
      {children}
    </Card>
  );
}

function Vacio({ children }: { children: ReactNode }) {
  return <p className="px-4 py-8 text-center text-xs text-muted-foreground">{children}</p>;
}

/** Fila de la lista de hijos de una unidad o división: se abre al hacer clic. */
function FilaHijo({
  nivel,
  id,
  nodo,
  secundario,
  riesgos,
  onAbrir,
  gestion,
}: {
  nivel: NivelNodo;
  id: number;
  nodo: ConNombre;
  secundario: ReactNode;
  riesgos: Riesgo[];
  onAbrir: () => void;
  gestion?: Gestion;
}) {
  return (
    <li data-testid={`fila-${nivel}-${id}`} className="group flex items-center gap-3 px-2 hover:bg-slate-50 transition-colors">
      <button
        type="button"
        onClick={onAbrir}
        aria-label={`Abrir ${nombreVisible(nodo)}`}
        className={`flex-1 min-w-0 flex items-center gap-4 py-3 pl-2 text-left rounded-md ${FOCO}`}
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
            <NombreConCodigo nodo={nodo} />
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1 truncate">{secundario}</p>
        </div>
        <div className="hidden @xl:block w-36 flex-shrink-0">
          <BarraRiesgos riesgos={riesgos} />
        </div>
        <span className="w-14 flex justify-end flex-shrink-0">
          <ResumenRiesgos riesgos={riesgos} testId={`riesgos-${nivel}-${id}`} />
        </span>
        <ChevronRight size={15} className="flex-shrink-0 text-muted-foreground/60 group-hover:translate-x-0.5 group-hover:text-primary transition-all" />
      </button>
      {gestion && (
        <BotonesGestion
          etiqueta={ETIQUETA_NIVEL[nivel].toLowerCase()}
          onEditar={gestion.onEditar}
          onEliminar={gestion.onEliminar}
          testId={`${nivel}-${id}`}
          tamano={12}
        />
      )}
    </li>
  );
}

function TablaRiesgos({ riesgos }: { riesgos: Riesgo[] }) {
  // Del peor al mejor nivel; los riesgos sin nivel al final.
  const ordenados = [...riesgos].sort(
    (a, b) => (a.nivel ? ORDEN_NIVEL[a.nivel] : 99) - (b.nivel ? ORDEN_NIVEL[b.nivel] : 99),
  );
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs text-left" data-testid="tabla-riesgos">
        <thead className="bg-slate-50 text-muted-foreground text-[10px] uppercase tracking-wide font-semibold">
          <tr>
            <th className="py-2 px-4 w-24">Nivel</th>
            <th className="py-2 px-4">Riesgo</th>
            <th className="py-2 px-4">Procedimiento de control</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/70">
          {ordenados.map((r) => (
            <tr key={r.id} data-testid={`riesgo-${r.id}`} className="align-top hover:bg-slate-50/60 transition-colors">
              <td className="py-2.5 px-4">
                <ChipNivelRiesgo riesgo={r} />
              </td>
              <td className="py-2.5 px-4 font-medium text-foreground leading-relaxed">{r.nombre}</td>
              <td className="py-2.5 px-4 text-muted-foreground leading-relaxed">
                {r.procedimientoControl ?? <span className="italic">Sin procedimiento</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Resumen de todas las unidades (sin selección) ─────────────────────────────

export function ResumenUnidades({
  unidades,
  onNavegar,
}: {
  unidades: UnidadNegocio[];
  onNavegar: (ruta: RutaCatalogo) => void;
}) {
  return (
    <div className="grid grid-cols-1 @3xl:grid-cols-2 gap-4" data-testid="lista-unidades">
      {unidades.map((u) => {
        const conteos = conteosRama(u);
        const riesgos = riesgosDeNodo(u);
        return (
          <button
            key={u.id}
            type="button"
            data-testid={`tarjeta-unidad-${u.id}`}
            onClick={() => onNavegar({ unidadId: u.id })}
            aria-label={`Abrir ${nombreVisible(u)}`}
            className={`group min-w-0 text-left bg-white border border-border rounded-xl p-5 shadow-sm hover:border-primary/40 hover:shadow-md transition-all flex flex-col gap-4 ${FOCO}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-base font-bold text-foreground truncate group-hover:text-primary transition-colors">
                  <NombreConCodigo nodo={u} />
                </h3>
                <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1.5 min-w-0">
                  <User size={12} className="flex-shrink-0" aria-hidden />
                  <span className="truncate">{u.responsableNombre}</span>
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5 min-w-0">
                  <Landmark size={12} className="flex-shrink-0" aria-hidden />
                  <span className="truncate">{u.departamentoAuditoriaNombre ?? "Sin departamento"}</span>
                </p>
              </div>
              <ChevronRight size={16} className="flex-shrink-0 text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-0.5 transition-all mt-1" />
            </div>
            {/* Estructura en tres columnas fijas; los riesgos aparte, con su desglose por nivel. */}
            <div className="grid grid-cols-3 gap-3">
              <Indicador valor={conteos.divisiones} etiqueta={conteos.divisiones === 1 ? "División" : "Divisiones"} />
              <Indicador valor={conteos.subdivisiones} etiqueta={conteos.subdivisiones === 1 ? "Subdivisión" : "Subdivisiones"} />
              <Indicador valor={conteos.areas} etiqueta={conteos.areas === 1 ? "Área" : "Áreas"} />
            </div>
            <div className="pt-3 border-t border-border/60">
              <p className="text-xs text-muted-foreground mb-2">
                <span className="text-sm font-bold text-foreground tabular-nums">{riesgos.length}</span>{" "}
                {riesgos.length === 1 ? "riesgo registrado" : "riesgos registrados"}
              </p>
              <BarraRiesgos riesgos={riesgos} leyenda testId={`riesgos-unidad-${u.id}`} />
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ── Detalle de un nodo ────────────────────────────────────────────────────────

interface DetalleCatalogoProps {
  resuelta: RutaResuelta;
  onNavegar: (ruta: RutaCatalogo | null) => void;
  acciones: AccionesGestion;
  onEditarUnidad: (unidad: UnidadNegocio) => void;
  onEliminarUnidad: (unidad: UnidadNegocio) => void;
}

export function DetalleCatalogo({ resuelta, onNavegar, acciones, onEditarUnidad, onEliminarUnidad }: DetalleCatalogoProps) {
  const { unidad, division, subdivision } = resuelta;
  const { puedeGestionar } = acciones;

  const seleccion = (nivel: NivelNodo, nodo: NodoBase): NodoSeleccionado => ({
    nivel,
    id: nodo.id,
    codigo: nodo.codigo,
    nombre: nodo.nombre,
    pais: nodo.pais,
    unidadId: unidad.id,
  });
  const gestionDe = (nivel: NivelNodo, nodo: NodoBase): Gestion | undefined =>
    puedeGestionar
      ? { onEditar: () => acciones.onEditar(seleccion(nivel, nodo)), onEliminar: () => acciones.onEliminar(seleccion(nivel, nodo)) }
      : undefined;

  // Nodo actual: el más profundo de la ruta.
  const nivel: NivelNodo | "unidad" = subdivision ? "subdivision" : division ? "division" : "unidad";
  const nodo: NodoBase = subdivision ?? division ?? unidad;
  const riesgos = subdivision ? subdivision.riesgos : riesgosDeNodo(division ?? unidad);
  const conteos = subdivision ? null : conteosRama(division ?? unidad);
  const hijo = NIVEL_HIJO[nivel];
  const agregarHijo = () =>
    hijo && acciones.onAgregar({ nivel: hijo, padreId: nodo.id, padreNombre: nombreVisible(nodo), unidadId: unidad.id });

  return (
    <div className="space-y-4" data-testid="detalle-catalogo">
      <Migas resuelta={resuelta} onNavegar={onNavegar} />

      {/* Encabezado del nodo actual: identidad, indicadores y distribución de riesgos */}
      <Card className="p-5 bg-white border border-border rounded-xl shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                  nivel === "unidad" ? "bg-blue-100 text-blue-700" : COLOR_NIVEL[nivel]
                }`}
              >
                {ETIQUETA_NIVEL[nivel]}
              </span>
              {nivel === "unidad" && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {unidad.periodoFiscalNombre}
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold text-foreground tracking-tight truncate">
              <NombreConCodigo nodo={nodo} />
            </h2>
            {nivel === "unidad" && (
              <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground mt-2">
                <span className="flex items-center gap-1.5">
                  <User size={13} className="text-slate-400" />
                  Gerente responsable: <span className="font-semibold text-foreground">{unidad.responsableNombre}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <Landmark size={13} className="text-slate-400" />
                  Departamento de auditoría:{" "}
                  <span className="font-semibold text-foreground">{unidad.departamentoAuditoriaNombre ?? "Sin asignar"}</span>
                </span>
              </div>
            )}
            {subdivision?.pais && (
              <p className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                <MapPin size={12} />
                {subdivision.pais}
              </p>
            )}
          </div>
          {puedeGestionar && (
            <BotonesGestion
              etiqueta={ETIQUETA_NIVEL[nivel].toLowerCase()}
              onEditar={() => (nivel === "unidad" ? onEditarUnidad(unidad) : acciones.onEditar(seleccion(nivel, nodo)))}
              onEliminar={() => (nivel === "unidad" ? onEliminarUnidad(unidad) : acciones.onEliminar(seleccion(nivel, nodo)))}
              testId="encabezado"
            />
          )}
        </div>

        <div className="flex flex-col lg:flex-row lg:items-end gap-5 mt-5 pt-4 border-t border-border/60">
          <div className="flex flex-wrap gap-x-8 gap-y-3">
            {conteos && nivel === "unidad" && <Indicador valor={conteos.divisiones} etiqueta="Divisiones" />}
            {conteos && <Indicador valor={conteos.subdivisiones} etiqueta="Subdivisiones" />}
            <Indicador valor={conteos ? conteos.areas : subdivision!.areas.length} etiqueta="Áreas" />
            <Indicador valor={riesgos.length} etiqueta="Riesgos" />
          </div>
          <div className="flex-1 min-w-0 lg:max-w-md lg:ml-auto">
            <BarraRiesgos riesgos={riesgos} leyenda testId="riesgos-encabezado" />
          </div>
        </div>
      </Card>

      {/* Contenido del nodo actual */}
      {subdivision ? (
        <ContenidoSubdivision subdivision={subdivision} puedeGestionar={puedeGestionar} onAgregarArea={agregarHijo} gestionDe={gestionDe} />
      ) : division ? (
        <Seccion
          titulo={`Subdivisiones (${division.subdivisiones.length})`}
          accion={puedeGestionar && <BotonAgregar etiqueta={ETIQUETA_NIVEL.subdivision} onClick={agregarHijo} />}
        >
          {division.subdivisiones.length === 0 ? (
            <Vacio>Sin subdivisiones registradas.</Vacio>
          ) : (
            <ul className="divide-y divide-border/60">
              {division.subdivisiones.map((s) => (
                <FilaHijo
                  key={s.id}
                  nivel="subdivision"
                  id={s.id}
                  nodo={s}
                  secundario={
                    <>
                      {s.pais && (
                        <>
                          <MapPin size={11} className="flex-shrink-0" />
                          {s.pais}
                          <span className="text-muted-foreground/40 mx-0.5">·</span>
                        </>
                      )}
                      {resumenHijos(s)}
                    </>
                  }
                  riesgos={s.riesgos}
                  onAbrir={() => onNavegar({ unidadId: unidad.id, divisionId: division.id, subdivisionId: s.id })}
                  gestion={gestionDe("subdivision", s)}
                />
              ))}
            </ul>
          )}
        </Seccion>
      ) : (
        <Seccion
          titulo={`Divisiones (${unidad.divisiones.length})`}
          accion={puedeGestionar && <BotonAgregar etiqueta={ETIQUETA_NIVEL.division} onClick={agregarHijo} />}
        >
          {unidad.divisiones.length === 0 ? (
            <Vacio>Sin divisiones registradas.</Vacio>
          ) : (
            <ul className="divide-y divide-border/60">
              {unidad.divisiones.map((d) => (
                <FilaHijo
                  key={d.id}
                  nivel="division"
                  id={d.id}
                  nodo={d}
                  secundario={resumenHijos(d)}
                  riesgos={riesgosDeNodo(d)}
                  onAbrir={() => onNavegar({ unidadId: unidad.id, divisionId: d.id })}
                  gestion={gestionDe("division", d)}
                />
              ))}
            </ul>
          )}
        </Seccion>
      )}
    </div>
  );
}

/** Último nivel: los riesgos (en tabla) y las áreas, en pestañas para no alargar la página. */
function ContenidoSubdivision({
  subdivision,
  puedeGestionar,
  onAgregarArea,
  gestionDe,
}: {
  subdivision: Subdivision;
  puedeGestionar: boolean;
  onAgregarArea: () => void;
  gestionDe: (nivel: NivelNodo, nodo: NodoBase) => Gestion | undefined;
}) {
  const [pestana, setPestana] = useState<"riesgos" | "areas">("riesgos");
  const pestanas = [
    { valor: "riesgos" as const, etiqueta: "Riesgos", cantidad: subdivision.riesgos.length },
    { valor: "areas" as const, etiqueta: "Áreas (proceso)", cantidad: subdivision.areas.length },
  ];

  return (
    <Seccion
      titulo={
        <div role="tablist" aria-label="Contenido de la subdivisión" className="flex items-center gap-1 -my-1">
          {pestanas.map((p) => (
            <button
              key={p.valor}
              type="button"
              role="tab"
              aria-selected={pestana === p.valor}
              onClick={() => setPestana(p.valor)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${FOCO} ${
                pestana === p.valor ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-slate-100"
              }`}
            >
              {p.etiqueta}
              <span className="ml-1.5 tabular-nums font-normal opacity-80">{p.cantidad}</span>
            </button>
          ))}
        </div>
      }
      accion={pestana === "areas" && puedeGestionar && <BotonAgregar etiqueta="Área" onClick={onAgregarArea} />}
    >
      {pestana === "riesgos" ? (
        subdivision.riesgos.length === 0 ? (
          <Vacio>Sin riesgos registrados en esta subdivisión.</Vacio>
        ) : (
          <>
            <TablaRiesgos riesgos={subdivision.riesgos} />
            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground px-4 py-2.5 border-t border-border/60 bg-slate-50/50">
              <ShieldAlert size={12} />
              Los riesgos se registran por subdivisión; las áreas no tienen riesgos propios.
            </p>
          </>
        )
      ) : subdivision.areas.length === 0 ? (
        <Vacio>Sin áreas registradas.</Vacio>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-px bg-border/60">
          {subdivision.areas.map((a) => {
            const gestion = gestionDe("area", a);
            return (
              <li
                key={a.id}
                data-testid={`fila-area-${a.id}`}
                className="group flex items-center justify-between gap-2 bg-white px-4 py-2 min-h-[42px] hover:bg-slate-50 transition-colors"
              >
                <span className="text-xs font-medium text-foreground truncate">{a.nombre}</span>
                {gestion && (
                  <BotonesGestion
                    etiqueta="área"
                    onEditar={gestion.onEditar}
                    onEliminar={gestion.onEliminar}
                    testId={`area-${a.id}`}
                    tamano={12}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Seccion>
  );
}
