import { ChevronRight } from "lucide-react";
import type { Riesgo, UnidadNegocio } from "../../api/estructura";
import type { RutaCatalogo } from "../../domain/estructura/navegacion";
import { riesgosDeNodo } from "../../domain/estructura/riesgos";
import { nombreVisible, type ConNombre } from "../../domain/estructura/nombres";
import { NombreConCodigo, ResumenRiesgos } from "./piezasCatalogo";

// Árbol de navegación del catálogo (SF-03): solo unidad › división › subdivisión, una
// línea por nodo. Las áreas y los riesgos no se listan aquí sino en el panel de detalle,
// para que el árbol siga siendo legible con cientos de áreas.

interface ArbolCatalogoProps {
  unidades: UnidadNegocio[];
  ruta: RutaCatalogo | null;
  onNavegar: (ruta: RutaCatalogo) => void;
  estaAbierto: (clave: string) => boolean;
  onAlternar: (clave: string) => void;
}

function FilaArbol({
  clave,
  nodo,
  secundario,
  riesgos,
  profundidad,
  seleccionado,
  abierto,
  onAlternar,
  onSeleccionar,
}: {
  clave: string;
  nodo: ConNombre;
  secundario?: string | null;
  riesgos: Riesgo[];
  profundidad: number;
  seleccionado: boolean;
  /** undefined = hoja (sin flecha). */
  abierto?: boolean;
  onAlternar?: () => void;
  onSeleccionar: () => void;
}) {
  return (
    <div
      data-testid={`arbol-${clave}`}
      className={`flex items-center gap-1 rounded-md pr-2 transition-colors ${
        seleccionado ? "bg-primary/10 text-primary" : "text-slate-700 hover:bg-slate-100"
      }`}
      style={{ paddingLeft: `${4 + profundidad * 14}px` }}
    >
      {abierto === undefined ? (
        <span className="w-6 flex-shrink-0" />
      ) : (
        <button
          type="button"
          onClick={onAlternar}
          aria-expanded={abierto}
          aria-label={`${abierto ? "Contraer" : "Expandir"} ${nombreVisible(nodo)}`}
          className="w-6 h-6 flex items-center justify-center flex-shrink-0 rounded text-muted-foreground hover:text-foreground hover:bg-slate-200/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <ChevronRight size={13} className={`transition-transform ${abierto ? "rotate-90" : ""}`} />
        </button>
      )}
      <button
        type="button"
        onClick={onSeleccionar}
        aria-current={seleccionado ? "true" : undefined}
        className={`flex-1 min-w-0 text-left py-1.5 text-xs truncate rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
          seleccionado ? "font-semibold" : profundidad === 0 ? "font-semibold" : "font-medium"
        }`}
      >
        <NombreConCodigo nodo={nodo} />
        {secundario && <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">{secundario}</span>}
      </button>
      <ResumenRiesgos riesgos={riesgos} />
    </div>
  );
}

export function ArbolCatalogo({ unidades, ruta, onNavegar, estaAbierto, onAlternar }: ArbolCatalogoProps) {
  // Solo el nodo más profundo de la ruta se marca como seleccionado.
  const esActual = (u: number, d?: number, s?: number) =>
    ruta?.unidadId === u && ruta.divisionId === d && ruta.subdivisionId === s;

  return (
    <nav aria-label="Árbol de la estructura organizacional" className="space-y-0.5">
      {unidades.map((u) => {
        const claveU = `unidad-${u.id}`;
        const abiertaU = estaAbierto(claveU);
        return (
          <div key={u.id}>
            <FilaArbol
              clave={claveU}
              nodo={u}
              riesgos={riesgosDeNodo(u)}
              profundidad={0}
              seleccionado={esActual(u.id)}
              abierto={u.divisiones.length ? abiertaU : undefined}
              onAlternar={() => onAlternar(claveU)}
              onSeleccionar={() => onNavegar({ unidadId: u.id })}
            />
            {abiertaU &&
              u.divisiones.map((d) => {
                const claveD = `division-${d.id}`;
                const abiertaD = estaAbierto(claveD);
                return (
                  <div key={d.id}>
                    <FilaArbol
                      clave={claveD}
                      nodo={d}
                      riesgos={riesgosDeNodo(d)}
                      profundidad={1}
                      seleccionado={esActual(u.id, d.id)}
                      abierto={d.subdivisiones.length ? abiertaD : undefined}
                      onAlternar={() => onAlternar(claveD)}
                      onSeleccionar={() => onNavegar({ unidadId: u.id, divisionId: d.id })}
                    />
                    {abiertaD &&
                      d.subdivisiones.map((s) => (
                        <FilaArbol
                          key={s.id}
                          clave={`subdivision-${s.id}`}
                          nodo={s}
                          secundario={s.pais}
                          riesgos={s.riesgos}
                          profundidad={2}
                          seleccionado={esActual(u.id, d.id, s.id)}
                          onSeleccionar={() => onNavegar({ unidadId: u.id, divisionId: d.id, subdivisionId: s.id })}
                        />
                      ))}
                  </div>
                );
              })}
          </div>
        );
      })}
    </nav>
  );
}
