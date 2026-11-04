import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Check, ListChecks, Loader2, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  crearOpcion,
  eliminarOpcion,
  ETIQUETA_CATALOGO,
  listarOpciones,
  renombrarOpcion,
  type OpcionCatalogo,
  type TipoCatalogo,
} from "../api/catalogos";
import { filtrarSugerencias } from "../domain/estructura/sugerencias";

// Catálogos de la estructura organizacional (SF-03) en Ajustes, solo para el Administrador
// (SF-16, SF-17): las opciones de nombre de área y de país o región que aceptan los formularios
// del Catálogo. Renombrar cambia también los registros que la usan; una opción en uso no se
// elimina. Cada cambio queda en bitácora (SF-15) desde el backend.

const TIPOS: TipoCatalogo[] = ["area", "pais"];
const MAX_VALOR: Record<TipoCatalogo, number> = { area: 150, pais: 100 };

const CLASE_INPUT =
  "w-full px-3 py-2 rounded-md border border-border bg-white text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition";

function mensajeDe(err: unknown, porDefecto: string): string {
  return (err as { message?: string })?.message ?? porDefecto;
}

export function CatalogosEstructuraSection() {
  const [tipo, setTipo] = useState<TipoCatalogo>("area");
  const [opciones, setOpciones] = useState<Record<TipoCatalogo, OpcionCatalogo[]>>({ area: [], pais: [] });
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const [busqueda, setBusqueda] = useState("");
  const [nueva, setNueva] = useState("");
  const [editando, setEditando] = useState<{ id: number; valor: string } | null>(null);
  const [porEliminar, setPorEliminar] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [area, pais] = await Promise.all([listarOpciones("area"), listarOpciones("pais")]);
      setOpciones({ area, pais });
      setErrorCarga(null);
    } catch (err) {
      setErrorCarga(mensajeDe(err, "No se pudieron cargar los catálogos."));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const cambiarTipo = (siguiente: TipoCatalogo) => {
    setTipo(siguiente);
    setBusqueda("");
    setNueva("");
    setEditando(null);
    setPorEliminar(null);
    setError(null);
  };

  const etiqueta = ETIQUETA_CATALOGO[tipo];
  const lista = opciones[tipo];
  const visibles = useMemo(() => {
    const valores = filtrarSugerencias(
      lista.map((o) => o.valor),
      busqueda,
    );
    return lista.filter((o) => valores.includes(o.valor));
  }, [lista, busqueda]);

  /** Ejecuta un cambio y vuelve a leer el catálogo (los usos cambian al renombrar). */
  const ejecutar = async (trabajo: () => Promise<unknown>, exito: string): Promise<boolean> => {
    setGuardando(true);
    setError(null);
    try {
      await trabajo();
      toast.success(exito);
      await cargar();
      return true;
    } catch (err) {
      const mensaje = mensajeDe(err, "No se pudo guardar el cambio.");
      setError(mensaje);
      toast.error(mensaje);
      return false;
    } finally {
      setGuardando(false);
    }
  };

  const agregar = async (e: React.FormEvent) => {
    e.preventDefault();
    const valor = nueva.trim();
    if (!valor) return;
    if (await ejecutar(() => crearOpcion(tipo, valor), `Se agregó "${valor}" al catálogo.`)) setNueva("");
  };

  const guardarEdicion = async (opcion: OpcionCatalogo) => {
    const valor = editando?.valor.trim() ?? "";
    if (!valor || valor === opcion.valor) {
      setEditando(null);
      return;
    }
    const aviso =
      opcion.usos > 0
        ? `Se renombró "${opcion.valor}" a "${valor}" y se actualizaron ${opcion.usos} registro${opcion.usos === 1 ? "" : "s"}.`
        : `Se renombró "${opcion.valor}" a "${valor}".`;
    if (await ejecutar(() => renombrarOpcion(tipo, opcion.id, valor), aviso)) setEditando(null);
  };

  const eliminar = async (opcion: OpcionCatalogo) => {
    if (await ejecutar(() => eliminarOpcion(tipo, opcion.id), `Se eliminó "${opcion.valor}" del catálogo.`)) {
      setPorEliminar(null);
    }
  };

  return (
    <section className="bg-white rounded-xl border border-border p-6 space-y-5" data-testid="catalogos-estructura">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <ListChecks size={16} className="text-primary" />
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Catálogos de la estructura</h3>
        </div>
        <p className="text-sm text-muted-foreground mt-2">
          Opciones que se pueden elegir al registrar áreas y subdivisiones en el Catálogo organizacional. Renombrar una
          opción también actualiza los registros que la usan; una opción en uso no se puede eliminar.
        </p>
      </div>

      <div role="tablist" aria-label="Catálogos" className="flex gap-1 border-b border-border">
        {TIPOS.map((t) => (
          <button
            key={t}
            role="tab"
            type="button"
            aria-selected={tipo === t}
            onClick={() => cambiarTipo(t)}
            className={`px-3 py-2 text-xs font-semibold -mb-px border-b-2 transition-colors ${
              tipo === t ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {ETIQUETA_CATALOGO[t].plural}
            <span className="ml-1.5 rounded-full bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
              {opciones[t].length}
            </span>
          </button>
        ))}
      </div>

      {errorCarga ? (
        <div role="alert" className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5 text-red-600" />
          <span className="flex-1">{errorCarga}</span>
          <button type="button" onClick={cargar} className="font-semibold underline">
            Reintentar
          </button>
        </div>
      ) : (
        <div role="tabpanel" className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder={`Buscar ${etiqueta.singular}…`}
                aria-label={`Buscar ${etiqueta.singular}`}
                className={`${CLASE_INPUT} pl-8`}
              />
            </div>
            <form onSubmit={agregar} className="flex gap-2">
              <input
                type="text"
                value={nueva}
                onChange={(e) => setNueva(e.target.value)}
                placeholder={`Nueva ${etiqueta.singular === "área" ? "área" : "opción"}…`}
                aria-label={`Nueva opción de ${etiqueta.singular}`}
                maxLength={MAX_VALOR[tipo]}
                disabled={guardando}
                className={CLASE_INPUT}
              />
              <button
                type="submit"
                disabled={guardando || !nueva.trim()}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-primary text-white text-xs font-semibold rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 flex-shrink-0"
              >
                <Plus size={14} />
                Agregar
              </button>
            </form>
          </div>

          {error && (
            <div role="alert" className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          {cargando && lista.length === 0 ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-6 justify-center">
              <Loader2 size={14} className="animate-spin" />
              Cargando catálogo…
            </div>
          ) : visibles.length === 0 ? (
            <p className="text-xs text-muted-foreground py-6 text-center">
              {busqueda.trim() ? "Ninguna opción coincide con la búsqueda." : "El catálogo está vacío."}
            </p>
          ) : (
            <ul className="max-h-96 overflow-y-auto rounded-lg border border-border divide-y divide-border">
              {visibles.map((opcion) => (
                <li
                  key={opcion.id}
                  data-testid={`opcion-${tipo}-${opcion.id}`}
                  className="flex items-center gap-3 px-3 py-2 text-sm"
                >
                  {editando?.id === opcion.id ? (
                    <form
                      className="flex flex-1 items-center gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        guardarEdicion(opcion);
                      }}
                    >
                      <input
                        autoFocus
                        type="text"
                        value={editando.valor}
                        onChange={(e) => setEditando({ id: opcion.id, valor: e.target.value })}
                        onKeyDown={(e) => e.key === "Escape" && setEditando(null)}
                        aria-label={`Nuevo valor para ${opcion.valor}`}
                        maxLength={MAX_VALOR[tipo]}
                        disabled={guardando}
                        className={`${CLASE_INPUT} py-1`}
                      />
                      <button
                        type="submit"
                        disabled={guardando}
                        aria-label="Guardar cambio"
                        className="p-1.5 rounded-md text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                      >
                        <Check size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditando(null)}
                        aria-label="Cancelar cambio"
                        className="p-1.5 rounded-md text-muted-foreground hover:bg-secondary"
                      >
                        <X size={15} />
                      </button>
                    </form>
                  ) : porEliminar === opcion.id ? (
                    <div className="flex flex-1 items-center gap-2">
                      <span className="flex-1 text-xs text-foreground">
                        ¿Eliminar <span className="font-semibold">{opcion.valor}</span>?
                      </span>
                      <button
                        type="button"
                        onClick={() => eliminar(opcion)}
                        disabled={guardando}
                        className="px-2.5 py-1 rounded-md bg-red-600 text-white text-xs font-semibold hover:bg-red-700 disabled:opacity-50"
                      >
                        Eliminar
                      </button>
                      <button
                        type="button"
                        onClick={() => setPorEliminar(null)}
                        className="px-2.5 py-1 rounded-md border border-border text-xs font-semibold text-muted-foreground hover:bg-secondary"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="flex-1 min-w-0 truncate text-foreground">{opcion.valor}</span>
                      <span
                        className={`text-[11px] whitespace-nowrap ${opcion.usos > 0 ? "text-muted-foreground" : "text-muted-foreground/60"}`}
                      >
                        {opcion.usos > 0 ? `En uso por ${opcion.usos}` : "Sin uso"}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setPorEliminar(null);
                          setError(null);
                          setEditando({ id: opcion.id, valor: opcion.valor });
                        }}
                        disabled={guardando}
                        aria-label={`Renombrar ${opcion.valor}`}
                        title="Renombrar"
                        className="p-1.5 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground disabled:opacity-50"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditando(null);
                          setError(null);
                          setPorEliminar(opcion.id);
                        }}
                        disabled={guardando || opcion.usos > 0}
                        aria-label={`Eliminar ${opcion.valor}`}
                        title={
                          opcion.usos > 0
                            ? `No se puede eliminar: la usan ${opcion.usos} registro${opcion.usos === 1 ? "" : "s"}.`
                            : "Eliminar"
                        }
                        className="p-1.5 rounded-md text-muted-foreground hover:bg-red-50 hover:text-red-600 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
