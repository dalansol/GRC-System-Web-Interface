import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { CalendarRange, ClipboardCheck, FileCheck2, Loader2, Repeat } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import logo from "@/imports/logo.svg";
import { CHEVRONES, LogoExpedite } from "./LogoExpedite";

const SUAVE = [0.23, 1, 0.32, 1] as const;
const MOVER = [0.77, 0, 0.175, 1] as const;

export function Marca({ claro = false }: { claro?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      {/* Sobre el panel oscuro el logo va en blanco: el azul no alcanza el contraste mínimo. */}
      <img src={logo} alt="" className={`size-10 ${claro ? "brightness-0 invert" : ""}`} />
      <span className={`text-2xl font-semibold tracking-tight ${claro ? "text-white" : "text-foreground"}`}>Expedite</span>
    </div>
  );
}

// Fases del ciclo de auditoría, en el orden en que avanza una auditoría.
const FASES = [
  { icono: CalendarRange, nombre: "Planeación" },
  { icono: ClipboardCheck, nombre: "Ejecución" },
  { icono: FileCheck2, nombre: "Reporte y cierre" },
  { icono: Repeat, nombre: "Seguimiento" },
];

// Tiempos de la secuencia. Cada fase aparece en el centro, se sostiene y se desliza a su lugar en la fila;
// la siguiente aparece cuando la anterior casi ha llegado. Al final los cuadros convergen en el logo
// y la palabra "Expedite" viaja desde la cabecera hasta quedar junto a él.
const MS_POR_FASE = 900;
const MS_SOSTENER = 450;
const MS_DESLIZAR = 600;
const MS_PAUSA_FILA = 150;
const MS_FUSION = 600;
const MS_FUNDIDO = 200;
// La fase nueva aparece en el centro, por encima de la fila, para no pisar los títulos de las ya colocadas.
const ALTURA_ENTRADA = 72;
const LADO_CUADRO = 40;
// Los cuadros llegan al logo uno tras otro, de izquierda a derecha, y cada chevrón se enciende al llegar el suyo.
const RETRASO_CHEVRON = 0.08;
// Recorte del cuadro con seis vértices, para poder deformarlo hasta la silueta de un chevrón ">".
const RECORTE_CUADRO = "polygon(0% 0%, 100% 0%, 100% 50%, 100% 100%, 0% 100%, 0% 50%)";
const RECORTE_CHEVRON = "polygon(0% 0%, 50% 0%, 100% 50%, 50% 100%, 0% 100%, 50% 50%)";
// Cada cuadro se convierte en un chevrón; como hay cuatro fases y tres chevrones, la última se funde con el tercero.
const chevronDe = (fase: number) => Math.min(fase, CHEVRONES - 1);

// Pasos: 2i la fase i aparece en el centro, 2i+1 se desliza a la fila; luego fusión y logo.
const PASO_FUSION = FASES.length * 2;
const PASO_LOGO = PASO_FUSION + 1;
const PASO_FIN = PASO_LOGO + 1; // ya terminaron los fundidos: la fila puede ocultarse del todo
const T_FUSION = (FASES.length - 1) * MS_POR_FASE + MS_SOSTENER + MS_DESLIZAR + MS_PAUSA_FILA;
const T_LOGO = T_FUSION + MS_FUSION;
const T_FIN = T_LOGO + MS_FUNDIDO + (FASES.length - 1) * RETRASO_CHEVRON * 1000 + 100;

// Avanza el paso de la secuencia con temporizadores. Empieza en -1 (nada visible) hasta que el escenario
// terminó de medir sus posiciones; con movimiento reducido arranca en el estado final.
function usePasoSecuencia(reducir: boolean, medido: boolean) {
  const [paso, setPaso] = useState(reducir ? PASO_FIN : -1);

  useEffect(() => {
    if (reducir || !medido) return;
    const ids: number[] = [];
    const programar = (ms: number, accion: () => void) => ids.push(window.setTimeout(accion, ms));
    FASES.forEach((_, i) => {
      programar(i * MS_POR_FASE, () => setPaso(2 * i));
      programar(i * MS_POR_FASE + MS_SOSTENER, () => setPaso(2 * i + 1));
    });
    programar(T_FUSION, () => setPaso(PASO_FUSION));
    programar(T_LOGO, () => setPaso(PASO_LOGO));
    programar(T_FIN, () => setPaso(PASO_FIN));
    return () => ids.forEach((id) => window.clearTimeout(id));
  }, [reducir, medido]);

  return paso;
}

interface Destino {
  dx: number;
  dy: number;
  sx: number;
  sy: number;
}

const SIN_MOVER: Destino = { dx: 0, dy: 0, sx: 1, sy: 1 };

const centroDe = (r: DOMRect) => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });

// Escenario central: la fila de fases y, debajo de ella en el árbol, el logo grande con la palabra "Expedite".
interface PropsEscenario {
  paso: number;
  reducir: boolean;
  onMedido: () => void;
}

function EscenarioCiclo({ paso, reducir, onMedido }: PropsEscenario) {
  const refEscenario = useRef<HTMLDivElement>(null);
  const fases = useRef<(HTMLLIElement | null)[]>([]);
  const cuadros = useRef<(HTMLSpanElement | null)[]>([]);
  const chevrones = useRef<(SVGPathElement | null)[]>([]);
  // Desplazamiento horizontal de cada fase desde su lugar en la fila hasta el centro del escenario.
  const [alCentro, setAlCentro] = useState<number[] | null>(null);
  // Desplazamiento y escala de cada cuadro hasta ocupar exactamente su chevrón del logo.
  const [alChevron, setAlChevron] = useState<Destino[] | null>(null);

  const fusion = paso >= PASO_FUSION;
  const terminado = paso >= PASO_LOGO;
  const oculto = paso >= PASO_FIN;

  // La fila se mide una vez, antes de pintar y aún sin desplazar: sus posiciones no dependen de la tipografía.
  useLayoutEffect(() => {
    if (reducir) return;
    const escenario = refEscenario.current?.getBoundingClientRect();
    if (!escenario) return;
    const centroEscenario = centroDe(escenario);
    setAlCentro(
      FASES.map((_, i) => {
        const fase = fases.current[i]?.getBoundingClientRect();
        return fase ? centroEscenario.x - centroDe(fase).x : 0;
      }),
    );
    onMedido();
  }, [reducir, onMedido]);

  // El destino se mide al empezar la fusión, con la fuente ya cargada: así el logo se forma justo donde termina.
  useLayoutEffect(() => {
    if (reducir || !fusion || alChevron) return;
    setAlChevron(
      FASES.map((_, i) => {
        const cuadro = cuadros.current[i]?.getBoundingClientRect();
        const chevron = chevrones.current[chevronDe(i)]?.getBoundingClientRect();
        if (!cuadro || !chevron || chevron.width === 0) return SIN_MOVER;
        const origen = centroDe(cuadro);
        const meta = centroDe(chevron);
        return { dx: meta.x - origen.x, dy: meta.y - origen.y, sx: chevron.width / LADO_CUADRO, sy: chevron.height / LADO_CUADRO };
      }),
    );
  }, [reducir, fusion, alChevron]);

  return (
    <div ref={refEscenario} className="relative h-44">
      <ol className={`absolute inset-0 flex items-center gap-3 ${oculto ? "invisible" : ""}`} aria-hidden={oculto || undefined}>
        {FASES.map(({ icono: Icono, nombre }, i) => {
          const visible = paso >= 2 * i;
          const enFila = paso >= 2 * i + 1;
          const haciaCentro = alCentro?.[i] ?? 0;
          const { dx, dy, sx, sy } = alChevron?.[i] ?? SIN_MOVER;
          const retraso = i * RETRASO_CHEVRON;
          return (
            <motion.li
              key={nombre}
              ref={(el) => {
                fases.current[i] = el;
              }}
              className="flex min-w-0 flex-1 flex-col items-center gap-2.5"
              initial={false}
              animate={{
                opacity: visible ? 1 : 0,
                transform: enFila ? "translate(0px, 0px)" : `translate(${haciaCentro}px, ${-ALTURA_ENTRADA + (visible ? 0 : 8)}px)`,
              }}
              transition={{
                opacity: { duration: 0.3, ease: SUAVE },
                // Mientras no se ve, salta directo a su posición de salida (el centro) sin animar.
                transform: enFila ? { duration: MS_DESLIZAR / 1000, ease: MOVER } : visible ? { duration: 0.3, ease: SUAVE } : { duration: 0 },
              }}
            >
              {/* En la fusión el cuadro vuela hasta su chevrón, se estira a su tamaño, se recorta en forma de ">" y se
                  vuelve blanco; al llegar se apaga mientras el chevrón real se enciende en el mismo lugar. */}
              <motion.span
                ref={(el) => {
                  cuadros.current[i] = el;
                }}
                className={`flex size-10 items-center justify-center rounded-lg ring-1 transition-colors duration-300 ${
                  fusion ? "bg-white ring-white" : "bg-primary text-white ring-primary"
                }`}
                initial={false}
                animate={{
                  transform: fusion ? `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` : "translate(0px, 0px) scale(1, 1)",
                  clipPath: fusion ? RECORTE_CHEVRON : RECORTE_CUADRO,
                  opacity: terminado ? 0 : 1,
                }}
                transition={{
                  transform: { duration: MS_FUSION / 1000, ease: MOVER, delay: fusion ? retraso : 0 },
                  clipPath: { duration: MS_FUSION / 1000, ease: MOVER, delay: fusion ? retraso : 0 },
                  opacity: { duration: MS_FUNDIDO / 1000, ease: SUAVE, delay: terminado ? retraso : 0 },
                }}
              >
                <Icono size={18} aria-hidden className={`transition-opacity duration-150 ${fusion ? "opacity-0" : "opacity-100"}`} />
              </motion.span>
              <span
                className={`text-center text-sm leading-tight font-semibold text-white transition-opacity duration-300 ${fusion ? "opacity-0" : "opacity-100"}`}
              >
                {nombre}
              </span>
            </motion.li>
          );
        })}
      </ol>
      <div className="absolute inset-0 flex items-center justify-center gap-5">
        <LogoExpedite
          className="size-24 text-white"
          titulo={terminado ? "Logotipo de Expedite" : undefined}
          chevrones={Array.from({ length: CHEVRONES }, (_, c) => ({ visible: terminado, retraso: c * RETRASO_CHEVRON }))}
          refChevron={(c, el) => {
            chevrones.current[c] = el;
          }}
        />
        {/* El hueco del texto siempre ocupa su lugar para que el logo no se mueva cuando la palabra llega. */}
        {terminado ? (
          <motion.span
            layoutId="expedite-texto"
            className="text-5xl font-semibold tracking-tight text-white"
            transition={{ layout: { duration: MS_FUSION / 1000, ease: MOVER } }}
          >
            Expedite
          </motion.span>
        ) : (
          <span aria-hidden className="invisible text-5xl font-semibold tracking-tight">
            Expedite
          </span>
        )}
      </div>
    </div>
  );
}

function PanelMarca() {
  const reducir = useReducedMotion() ?? false;
  const [medido, setMedido] = useState(false);
  const marcarMedido = useCallback(() => setMedido(true), []);
  const paso = usePasoSecuencia(reducir, medido);
  const terminado = paso >= PASO_LOGO;
  return (
    <aside className="relative hidden overflow-hidden bg-sidebar lg:flex lg:w-[45%] lg:flex-col lg:justify-between lg:p-12 xl:p-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(circle at 15% 110%, color-mix(in srgb, var(--primary) 45%, transparent), transparent 55%), radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px)",
          backgroundSize: "100% 100%, 22px 22px",
        }}
      />
      {/* La cabecera conserva su altura cuando la palabra ya viajó al centro. */}
      <div className="relative flex h-10 items-center">
        {!terminado && (
          <motion.span
            layoutId="expedite-texto"
            className="text-2xl font-semibold tracking-tight text-white"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, ease: SUAVE }}
          >
            Expedite
          </motion.span>
        )}
      </div>
      <div className="relative py-12">
        <EscenarioCiclo paso={paso} reducir={reducir} onMedido={marcarMedido} />
      </div>
      <p className="relative text-sm text-sidebar-foreground/70">Dirección de Auditoría Interna</p>
    </aside>
  );
}

const FUENTE = { fontFamily: "'Plus Jakarta Sans', Inter, sans-serif" };

// Contenido de cada fase: sus bloques entran escalonados cada vez que cambia la fase.
function ContenidoAnimado({ fase, children }: { fase: string; children: React.ReactNode }) {
  const reducir = useReducedMotion();
  const raiz = React.isValidElement<{ children?: React.ReactNode }>(children) && children.type === React.Fragment;
  const bloques = React.Children.toArray(raiz ? children.props.children : children);
  return (
    <motion.div key={fase} initial={reducir ? false : "oculto"} animate="visible" transition={{ staggerChildren: 0.04 }}>
      {bloques.map((bloque, i) => (
        <motion.div
          key={i}
          variants={{ oculto: { opacity: 0, transform: "translateY(6px)" }, visible: { opacity: 1, transform: "translateY(0px)" } }}
          transition={{ duration: 0.28, ease: SUAVE }}
        >
          {bloque}
        </motion.div>
      ))}
    </motion.div>
  );
}

interface PropsPantalla {
  fase: string;
  children: React.ReactNode;
}

// Pantalla de acceso: marca y secuencia a la izquierda, contenido a la derecha.
export function PantallaAcceso({ fase, children }: PropsPantalla) {
  return (
    <div className="flex min-h-dvh w-full bg-card" style={FUENTE}>
      <PanelMarca />
      <main className="flex flex-1 items-center justify-center px-6 py-12 sm:px-12">
        <div className="w-full max-w-sm">
          <div className="mb-10 lg:hidden">
            <Marca />
          </div>
          <ContenidoAnimado fase={fase}>{children}</ContenidoAnimado>
        </div>
      </main>
    </div>
  );
}

// Logo de Microsoft según su guía de marca para botones de inicio de sesión.
function LogoMicrosoft() {
  return (
    <svg aria-hidden width="18" height="18" viewBox="0 0 21 21">
      <rect x="1" y="1" width="9" height="9" fill="#F25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
      <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
      <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
    </svg>
  );
}

const BASE_BOTON =
  "group inline-flex h-11 w-full cursor-pointer items-center justify-center gap-2.5 rounded-lg px-4 text-sm font-semibold transition-[background-color,box-shadow,transform] duration-160 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100";

export const BOTON_PRIMARIO = `${BASE_BOTON} bg-primary text-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_1px_2px_rgba(15,79,255,0.3),0_4px_12px_-4px_rgba(15,79,255,0.45)] hover:bg-primary/92`;
export const BOTON_SECUNDARIO = `${BASE_BOTON} border border-foreground/12 bg-card text-foreground shadow-[0_1px_2px_rgba(15,27,45,0.06)] hover:border-foreground/20 hover:bg-input-background`;

export function BotonMicrosoft({ enviando, onClick }: { enviando: boolean; onClick: () => void }) {
  return (
    <button type="button" className={BOTON_SECUNDARIO} onClick={onClick} disabled={enviando} aria-busy={enviando}>
      {enviando ? <Spinner /> : <LogoMicrosoft />}
      Iniciar sesión con Microsoft
    </button>
  );
}

export function Spinner() {
  return <Loader2 aria-hidden size={16} className="animate-spin" />;
}
