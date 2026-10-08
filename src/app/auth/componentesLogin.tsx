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
// La fase nueva aparece en el centro, por encima de la fila, para no pisar los títulos de las ya colocadas.
const ALTURA_ENTRADA = 84;
const TAMANO_ICONO = 26;
const SOMBRA_CUADRO = "0 1px 2px rgba(15,27,45,0.35), 0 12px 28px -12px rgba(15,79,255,0.55)";
const SIN_SOMBRA = "0 0 0 rgba(15,27,45,0), 0 0 0 rgba(15,79,255,0)";
// Los cuadros llegan al logo uno tras otro, de izquierda a derecha, y cada chevrón se enciende al llegar el suyo.
const RETRASO_CHEVRON = 0.08;
// Recortes con el mismo número de vértices (64) para poder interpolar uno en otro, generados a partir del contorno
// real del primer chevrón de src/imports/logo.svg (muestreo uniforme por longitud de arco, coordenadas relativas a su
// caja, empezando arriba a la izquierda y en sentido horario). El del cuadro es la proyección de cada vértice al borde
// más cercano de la caja, con las cuatro esquinas conservadas: cada punto viaja en línea recta desde el borde hasta su
// sitio en la silueta, así el cuadro se "talla" en chevrón sin formas intermedias abultadas y termina exactamente con
// la figura del logo, puntas redondeadas incluidas.
const RECORTE_CUADRO =
  "polygon(4.906% 0%, 10.629% 0%, 17.744% 0%, 25.442% 0%, 32.852% 0%, 39.131% 0%, 43.983% 0%, 48.688% 0%, 53.392% 0%, 58.096% 0%, 62.801% 0%, 67.505% 0%, 100% 0%, 100% 29.777%, 100% 33.058%, 100% 36.338%, 100% 39.618%, 100% 42.902%, 100% 46.598%, 100% 50.681%, 100% 54.686%, 100% 58.184%, 100% 61.464%, 100% 64.745%, 100% 68.025%, 100% 100%, 70.66% 100%, 65.955% 100%, 61.251% 100%, 56.547% 100%, 51.842% 100%, 47.138% 100%, 42.434% 100%, 37.234% 100%, 30.495% 100%, 22.893% 100%, 15.291% 100%, 0% 100%, 0% 94.235%, 0% 90.429%, 0% 86.325%, 0% 82.389%, 0% 78.984%, 0% 75.703%, 0% 72.423%, 0% 69.143%, 0% 65.862%, 0% 62.582%, 0% 59.301%, 0% 56.021%, 0% 52.741%, 0% 49.46%, 0% 46.18%, 0% 42.899%, 0% 39.619%, 0% 36.339%, 0% 33.058%, 0% 29.778%, 0% 26.497%, 0% 23.217%, 0% 19.937%, 0% 16.362%, 0% 12.319%, 0% 0%)";
const RECORTE_CHEVRON =
  "polygon(4.906% 4.652%, 10.629% 1.898%, 17.744% 0.313%, 25.442% 0.076%, 32.852% 1.215%, 39.131% 3.6%, 43.983% 6.814%, 48.688% 10.095%, 53.392% 13.375%, 58.096% 16.655%, 62.801% 19.936%, 67.505% 23.216%, 72.21% 26.497%, 76.914% 29.777%, 81.618% 33.058%, 86.323% 36.338%, 91.027% 39.618%, 95.723% 42.902%, 99.091% 46.598%, 99.964% 50.681%, 98.243% 54.686%, 94.182% 58.184%, 89.477% 61.464%, 84.773% 64.745%, 80.069% 68.025%, 75.364% 71.306%, 70.66% 74.586%, 65.955% 77.867%, 61.251% 81.147%, 56.547% 84.427%, 51.842% 87.708%, 47.138% 90.988%, 42.434% 94.269%, 37.234% 97.311%, 30.495% 99.309%, 22.893% 100%, 15.291% 99.309%, 8.552% 97.312%, 3.441% 94.235%, 0.536% 90.429%, 0.169% 86.325%, 2.381% 82.389%, 6.734% 78.984%, 11.439% 75.703%, 16.143% 72.423%, 20.848% 69.143%, 25.552% 65.862%, 30.257% 62.582%, 34.961% 59.301%, 39.666% 56.021%, 44.37% 52.741%, 47.523% 49.46%, 42.818% 46.18%, 38.114% 42.899%, 33.409% 39.619%, 28.705% 36.339%, 24% 33.058%, 19.296% 29.778%, 14.591% 26.497%, 9.887% 23.217%, 5.183% 19.937%, 1.377% 16.362%, 0.002% 12.319%, 1.225% 8.262%)";
// Cada cuadro se convierte en un chevrón; como hay cuatro fases y tres chevrones, la última se funde con el tercero.
const chevronDe = (fase: number) => Math.min(fase, CHEVRONES - 1);

// Pasos: 2i la fase i aparece en el centro, 2i+1 se desliza a la fila; luego la fusión. El encendido de cada chevrón
// no va por temporizador: lo dispara la llegada real de su cuadro (onAnimationComplete), para que ambos cambien en el
// mismo cuadro de animación. PASO_FIN es solo un cierre de seguridad: la fila se oculta y el logo queda completo.
const PASO_FUSION = FASES.length * 2;
const PASO_FIN = PASO_FUSION + 1;
const T_FUSION = (FASES.length - 1) * MS_POR_FASE + MS_SOSTENER + MS_DESLIZAR + MS_PAUSA_FILA;
const T_FIN = T_FUSION + MS_FUSION + (CHEVRONES - 1) * RETRASO_CHEVRON * 1000 + 200;

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
  // Se avisa cuando el último chevrón se encendió: la palabra "Expedite" puede viajar junto al logo.
  onLogoCompleto: () => void;
}

function EscenarioCiclo({ paso, reducir, onMedido, onLogoCompleto }: PropsEscenario) {
  const refEscenario = useRef<HTMLDivElement>(null);
  const fases = useRef<(HTMLLIElement | null)[]>([]);
  const cuadros = useRef<(HTMLSpanElement | null)[]>([]);
  const chevrones = useRef<(SVGPathElement | null)[]>([]);
  // Desplazamiento horizontal de cada fase desde su lugar en la fila hasta el centro del escenario.
  const [alCentro, setAlCentro] = useState<number[] | null>(null);
  // Desplazamiento y escala de cada cuadro hasta ocupar exactamente su chevrón del logo.
  const [alChevron, setAlChevron] = useState<Destino[] | null>(null);
  // Qué cuadros ya llegaron a su chevrón. Con movimiento reducido todos "llegaron" desde el principio.
  const [llegados, setLlegados] = useState<boolean[]>(() => FASES.map(() => reducir));

  const fusion = paso >= PASO_FUSION;
  const oculto = paso >= PASO_FIN;
  const llego = (i: number) => llegados[i] || oculto;
  // Un chevrón se enciende en cuanto llega el primer cuadro que se convierte en él.
  const chevronEncendido = (c: number) => FASES.some((_, i) => chevronDe(i) === c && llego(i));
  const terminado = FASES.every((_, i) => llego(i));

  useEffect(() => {
    if (terminado) onLogoCompleto();
  }, [terminado, onLogoCompleto]);

  const marcarLlegada = useCallback((i: number) => {
    setLlegados((previos) => (previos[i] ? previos : previos.map((v, j) => v || j === i)));
  }, []);

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
        // Escala a partir del tamaño medido del cuadro (no de una constante), así es exacta con cualquier zoom.
        return { dx: meta.x - origen.x, dy: meta.y - origen.y, sx: chevron.width / cuadro.width, sy: chevron.height / cuadro.height };
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
          // Las dos últimas fases viajan juntas al tercer chevrón, así llegan y se relevan en el mismo instante.
          const retraso = chevronDe(i) * RETRASO_CHEVRON;
          return (
            <motion.li
              key={nombre}
              ref={(el) => {
                fases.current[i] = el;
              }}
              className="flex min-w-0 flex-1 flex-col items-center gap-3"
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
              {/* El cuadro es blanco desde el inicio, como el logo en el que termina: en la fusión vuela hasta su
                  chevrón, se estira a su tamaño y se recorta con la silueta exacta del chevrón. Icono y sombra se
                  apagan justo al despegar (mismo retraso que el vuelo). Al terminar el vuelo, onAnimationComplete marca
                  la llegada: en ese mismo render el cuadro se oculta y el chevrón real aparece, sin fundido, porque
                  ambos son blancos y tienen la misma forma y un fundido cruzado solo produciría un parpadeo. */}
              <motion.span
                ref={(el) => {
                  cuadros.current[i] = el;
                }}
                className={`flex size-14 items-center justify-center rounded-xl bg-white text-sidebar ${llego(i) ? "invisible" : ""}`}
                initial={false}
                animate={{
                  transform: fusion ? `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` : "translate(0px, 0px) scale(1, 1)",
                  clipPath: fusion ? RECORTE_CHEVRON : RECORTE_CUADRO,
                  boxShadow: fusion ? SIN_SOMBRA : SOMBRA_CUADRO,
                }}
                transition={{
                  transform: { duration: MS_FUSION / 1000, ease: MOVER, delay: fusion ? retraso : 0 },
                  clipPath: { duration: MS_FUSION / 1000, ease: MOVER, delay: fusion ? retraso : 0 },
                  boxShadow: { duration: 0.2, ease: SUAVE, delay: fusion ? retraso : 0 },
                }}
                // Solo cuenta la llegada del vuelo real: en el primer render de la fusión el destino aún no está medido.
                onAnimationComplete={() => {
                  if (fusion && alChevron) marcarLlegada(i);
                }}
              >
                <motion.span
                  className="flex"
                  initial={false}
                  animate={{ opacity: fusion ? 0 : 1 }}
                  transition={{ duration: 0.15, ease: SUAVE, delay: fusion ? retraso : 0 }}
                >
                  <Icono size={TAMANO_ICONO} strokeWidth={2} aria-hidden />
                </motion.span>
              </motion.span>
              <span
                className={`text-center text-base leading-tight font-semibold tracking-tight text-white transition-opacity duration-300 ${fusion ? "opacity-0" : "opacity-100"}`}
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
          chevrones={Array.from({ length: CHEVRONES }, (_, c) => ({ visible: chevronEncendido(c) }))}
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
  // La palabra de la cabecera se retira en el mismo render en que aparece junto al logo (comparten layoutId).
  const [terminado, setTerminado] = useState(reducir);
  const marcarTerminado = useCallback(() => setTerminado(true), []);
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
        <EscenarioCiclo paso={paso} reducir={reducir} onMedido={marcarMedido} onLogoCompleto={marcarTerminado} />
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
