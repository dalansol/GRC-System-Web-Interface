import type { ReactNode } from "react";
import { ArrowLeft, ChevronRight, Edit2, Landmark, MapPin, Plus, ShieldAlert, Trash2, User } from "lucide-react";
import {
  ETIQUETA_NIVEL,
  type Division,
  type NivelNodo,
  type Riesgo,
  type Subdivision,
  type UnidadNegocio,
} from "../../api/estructura";
import { resumenHijos, type RutaCatalogo, type RutaResuelta } from "../../domain/estructura/navegacion";
import { COLOR_NIVEL_RIESGO, nivelMaximo, riesgosDeNodo } from "../../domain/estructura/riesgos";
import type { NodoSeleccionado } from "../../domain/estructura/useEstructuraViewModel";
import { Card } from "../SharedComponents";
import { ChipNivelRiesgo, COLOR_NIVEL, ResumenRiesgos, type AccionesGestion } from "./piezasCatalogo";

// Vista de tarjetas de una unidad de negocio (SF-03): se recorre la jerarquía un nivel a
// la vez (unidad › división › subdivisión). En la subdivisión se muestran sus áreas y la
// tabla de riesgos. Complementa la vista de árbol de HierarchyView, no la sustituye.

interface DetalleUnidadTarjetasProps {
  /** Ruta ya resuelta contra los datos frescos (ver domain/estructura/navegacion.ts). */
  resuelta: RutaResuelta;
  /** Navega a otra ruta; null vuelve al catálogo. */
  onNavegar: (ruta: RutaCatalogo | null) => void;
  acciones: AccionesGestion;
  onEditarUnidad: (unidad: UnidadNegocio) => void;
  onEliminarUnidad: (unidad: UnidadNegocio) => void;
}

// ── Piezas ─────────────────────────────────────────────────────────────────────

function Migas({ resuelta, onNavegar }: Pick<DetalleUnidadTarjetasProps, "resuelta" | "onNavegar">) {
  const { unidad, division, subdivision } = resuelta;
  const migas: Array<{ etiqueta: string; ruta: RutaCatalogo | null }> = [
    { etiqueta: "Catálogo", ruta: null },
    { etiqueta: unidad.nombre, ruta: { unidadId: unidad.id } },
  ];
  if (division) migas.push({ etiqueta: division.nombre, ruta: { unidadId: unidad.id, divisionId: division.id } });
  if (division && subdivision) {
    migas.push({
      etiqueta: subdivision.nombre,
      ruta: { unidadId: unidad.id, divisionId: division.id, subdivisionId: subdivision.id },
    });
  }

  return (
    <nav aria-label="Ruta en la jerarquía" className="flex items-center gap-1 flex-wrap text-xs bg-white p-2.5 rounded-lg border border-border">
      {migas.map((miga, i) => {
        const actual = i === migas.length - 1;
        return (
          <span key={`${i}-${miga.etiqueta}`} className="flex items-center gap-1">
            {i > 0 && <ChevronRight size={12} className="text-muted-foreground/50" />}
            <button
              type="button"
              onClick={() => onNavegar(miga.ruta)}
              disabled={actual}
              aria-current={actual ? "page" : undefined}
              className={`px-2 py-0.5 rounded font-medium flex items-center gap-1 ${
                actual ? "font-bold text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {i === 0 && <ArrowLeft size={12} />}
              {miga.etiqueta}
            </button>
          </span>
        );
      })}
    </nav>
  );
}

function BotonesGestion({
  etiqueta,
  onEditar,
  onEliminar,
  testId,
}: {
  etiqueta: string;
  onEditar: () => void;
  onEliminar: () => void;
  testId: string;
}) {
  return (
    <div className="flex items-center gap-0.5 flex-shrink-0">
      <button
        type="button"
        onClick={onEditar}
        title={`Editar ${etiqueta}`}
        className="p-1.5 rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
      >
        <Edit2 size={13} />
      </button>
      <button
        type="button"
        onClick={onEliminar}
        title={`Eliminar ${etiqueta}`}
        data-testid={`btn-eliminar-${testId}`}
        className="p-1.5 rounded-md hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors"
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}

/** Tarjeta de un nodo hijo. Si recibe `onAbrir`, el nombre y el pie llevan al siguiente nivel. */
function TarjetaNodo({
  nivel,
  id,
  nombre,
  pais,
  riesgos,
  resumen,
  onAbrir,
  gestion,
}: {
  nivel: NivelNodo;
  id: number;
  nombre: string;
  pais?: string | null;
  riesgos: Riesgo[];
  resumen?: string;
  onAbrir?: () => void;
  gestion?: { onEditar: () => void; onEliminar: () => void };
}) {
  const franja = COLOR_NIVEL_RIESGO[nivelMaximo(riesgos) ?? "sin"].franja;
  const contenido = (
    <>
      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded inline-block mb-1.5 ${COLOR_NIVEL[nivel]}`}>
        {ETIQUETA_NIVEL[nivel]}
      </span>
      <h4 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors truncate">{nombre}</h4>
      {pais && (
        <p className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
          <MapPin size={11} />
          {pais}
        </p>
      )}
    </>
  );

  return (
    <div
      data-testid={`tarjeta-${nivel}-${id}`}
      className="bg-white border border-border rounded-xl overflow-hidden hover:border-primary/50 hover:shadow-md transition-all group flex flex-col justify-between"
    >
      <div className={`h-1.5 w-full ${franja}`} />
      <div className="p-4 flex-1 flex items-start gap-2">
        {onAbrir ? (
          <button type="button" onClick={onAbrir} aria-label={`Abrir ${nombre}`} className="text-left flex-1 min-w-0">
            {contenido}
          </button>
        ) : (
          <div className="flex-1 min-w-0">{contenido}</div>
        )}
        {gestion && (
          <BotonesGestion
            etiqueta={ETIQUETA_NIVEL[nivel].toLowerCase()}
            onEditar={gestion.onEditar}
            onEliminar={gestion.onEliminar}
            testId={`tarjeta-${nivel}-${id}`}
          />
        )}
      </div>
      {(resumen !== undefined || riesgos.length > 0) && (
        <button
          type="button"
          onClick={onAbrir}
          disabled={!onAbrir}
          tabIndex={-1}
          className="px-4 pb-3 pt-2 flex items-center justify-between gap-2 text-[11px] text-muted-foreground border-t border-border/40 text-left disabled:cursor-default"
        >
          <span className="truncate">{resumen}</span>
          <span className="flex items-center gap-1.5">
            <ResumenRiesgos riesgos={riesgos} />
            {onAbrir && <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />}
          </span>
        </button>
      )}
    </div>
  );
}

function Seccion({
  titulo,
  cantidad,
  boton,
  vacio,
  children,
}: {
  titulo: string;
  cantidad: number;
  boton?: ReactNode;
  vacio: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-foreground uppercase tracking-wide">
          {titulo} ({cantidad})
        </h3>
        {boton}
      </div>
      {cantidad === 0 ? <p className="text-xs text-muted-foreground italic">{vacio}</p> : children}
    </section>
  );
}

function BotonAgregar({ etiqueta, onClick, testId }: { etiqueta: string; onClick: () => void; testId: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      className="text-[11px] font-bold text-primary hover:underline flex items-center gap-1"
    >
      <Plus size={12} />
      Agregar {etiqueta.toLowerCase()}
    </button>
  );
}

function TablaRiesgos({ riesgos }: { riesgos: Riesgo[] }) {
  return (
    <Card className="bg-white border border-border rounded-xl shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left" data-testid="tabla-riesgos">
          <thead className="bg-slate-50 border-b border-border text-muted-foreground uppercase text-[10px] font-semibold">
            <tr>
              <th className="py-2.5 px-4">Nivel</th>
              <th className="py-2.5 px-4">Riesgo</th>
              <th className="py-2.5 px-4">Procedimiento de control</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {riesgos.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                <td className="py-2.5 px-4">
                  <ChipNivelRiesgo riesgo={r} />
                </td>
                <td className="py-2.5 px-4 font-medium text-foreground">{r.nombre}</td>
                <td className="py-2.5 px-4 text-muted-foreground">{r.procedimientoControl ?? "Sin procedimiento"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ── Vista ──────────────────────────────────────────────────────────────────────

export function DetalleUnidadTarjetas({
  resuelta,
  onNavegar,
  acciones,
  onEditarUnidad,
  onEliminarUnidad,
}: DetalleUnidadTarjetasProps) {
  const { unidad, division, subdivision } = resuelta;
  const { puedeGestionar } = acciones;

  const seleccion = (nivel: NivelNodo, nodo: { id: number; nombre: string; pais?: string | null }): NodoSeleccionado => ({
    nivel,
    id: nodo.id,
    nombre: nodo.nombre,
    pais: nodo.pais,
    unidadId: unidad.id,
  });
  const gestionDe = (nivel: NivelNodo, nodo: { id: number; nombre: string; pais?: string | null }) =>
    puedeGestionar
      ? { onEditar: () => acciones.onEditar(seleccion(nivel, nodo)), onEliminar: () => acciones.onEliminar(seleccion(nivel, nodo)) }
      : undefined;

  // Nodo actual: el más profundo de la ruta.
  const actual: { nivel: NivelNodo | "unidad"; nombre: string; riesgos: Riesgo[] } = subdivision
    ? { nivel: "subdivision", nombre: subdivision.nombre, riesgos: subdivision.riesgos }
    : division
      ? { nivel: "division", nombre: division.nombre, riesgos: riesgosDeNodo(division) }
      : { nivel: "unidad", nombre: unidad.nombre, riesgos: riesgosDeNodo(unidad) };

  return (
    <div className="space-y-5" data-testid="detalle-tarjetas">
      <Migas resuelta={resuelta} onNavegar={onNavegar} />

      {/* Encabezado del nodo actual */}
      <Card className="p-5 bg-white border border-border rounded-xl shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                  actual.nivel === "unidad" ? "bg-blue-100 text-blue-700" : COLOR_NIVEL[actual.nivel]
                }`}
              >
                {ETIQUETA_NIVEL[actual.nivel]}
              </span>
              {actual.nivel === "unidad" && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {unidad.periodoFiscalNombre}
                </span>
              )}
              <ResumenRiesgos riesgos={actual.riesgos} testId="riesgos-encabezado" />
            </div>
            <h2 className="text-lg font-bold text-foreground truncate">{actual.nombre}</h2>
            {actual.nivel === "unidad" && (
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
          {puedeGestionar &&
            (actual.nivel === "unidad" ? (
              <BotonesGestion
                etiqueta="unidad"
                onEditar={() => onEditarUnidad(unidad)}
                onEliminar={() => onEliminarUnidad(unidad)}
                testId="encabezado"
              />
            ) : (
              <BotonesGestion
                etiqueta={ETIQUETA_NIVEL[actual.nivel].toLowerCase()}
                onEditar={() => acciones.onEditar(seleccion(actual.nivel as NivelNodo, (subdivision ?? division)!))}
                onEliminar={() => acciones.onEliminar(seleccion(actual.nivel as NivelNodo, (subdivision ?? division)!))}
                testId="encabezado"
              />
            ))}
        </div>
      </Card>

      {/* Hijos del nodo actual */}
      {subdivision ? (
        <ContenidoSubdivision subdivision={subdivision} unidadId={unidad.id} acciones={acciones} gestionDe={gestionDe} />
      ) : division ? (
        <Seccion
          titulo="Subdivisiones"
          cantidad={division.subdivisiones.length}
          vacio="Sin subdivisiones registradas."
          boton={
            puedeGestionar && (
              <BotonAgregar
                etiqueta={ETIQUETA_NIVEL.subdivision}
                testId="btn-agregar-tarjetas"
                onClick={() =>
                  acciones.onAgregar({ nivel: "subdivision", padreId: division.id, padreNombre: division.nombre, unidadId: unidad.id })
                }
              />
            )
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {division.subdivisiones.map((s) => (
              <TarjetaNodo
                key={s.id}
                nivel="subdivision"
                id={s.id}
                nombre={s.nombre}
                pais={s.pais}
                riesgos={s.riesgos}
                resumen={resumenHijos(s)}
                onAbrir={() => onNavegar({ unidadId: unidad.id, divisionId: division.id, subdivisionId: s.id })}
                gestion={gestionDe("subdivision", s)}
              />
            ))}
          </div>
        </Seccion>
      ) : (
        <Seccion
          titulo="Divisiones"
          cantidad={unidad.divisiones.length}
          vacio="Sin divisiones registradas."
          boton={
            puedeGestionar && (
              <BotonAgregar
                etiqueta={ETIQUETA_NIVEL.division}
                testId="btn-agregar-tarjetas"
                onClick={() => acciones.onAgregar({ nivel: "division", padreId: unidad.id, padreNombre: unidad.nombre, unidadId: unidad.id })}
              />
            )
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {unidad.divisiones.map((d: Division) => (
              <TarjetaNodo
                key={d.id}
                nivel="division"
                id={d.id}
                nombre={d.nombre}
                riesgos={riesgosDeNodo(d)}
                resumen={resumenHijos(d)}
                onAbrir={() => onNavegar({ unidadId: unidad.id, divisionId: d.id })}
                gestion={gestionDe("division", d)}
              />
            ))}
          </div>
        </Seccion>
      )}
    </div>
  );
}

/** Último nivel navegable: las áreas como tarjetas y los riesgos como tabla. */
function ContenidoSubdivision({
  subdivision,
  unidadId,
  acciones,
  gestionDe,
}: {
  subdivision: Subdivision;
  unidadId: number;
  acciones: AccionesGestion;
  gestionDe: (nivel: NivelNodo, nodo: { id: number; nombre: string }) => { onEditar: () => void; onEliminar: () => void } | undefined;
}) {
  return (
    <>
      <Seccion
        titulo="Áreas (proceso)"
        cantidad={subdivision.areas.length}
        vacio="Sin áreas registradas."
        boton={
          acciones.puedeGestionar && (
            <BotonAgregar
              etiqueta="Área"
              testId="btn-agregar-tarjetas"
              onClick={() =>
                acciones.onAgregar({ nivel: "area", padreId: subdivision.id, padreNombre: subdivision.nombre, unidadId })
              }
            />
          )
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {subdivision.areas.map((a) => (
            <TarjetaNodo key={a.id} nivel="area" id={a.id} nombre={a.nombre} riesgos={[]} gestion={gestionDe("area", a)} />
          ))}
        </div>
      </Seccion>

      <Seccion titulo="Riesgos" cantidad={subdivision.riesgos.length} vacio="Sin riesgos registrados en esta subdivisión.">
        <TablaRiesgos riesgos={subdivision.riesgos} />
      </Seccion>

      <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <ShieldAlert size={12} />
        Los riesgos se registran por subdivisión; las áreas no tienen riesgos propios.
      </p>
    </>
  );
}
