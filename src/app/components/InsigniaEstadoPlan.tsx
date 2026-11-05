const ESTILO_ESTADO: Record<string, string> = {
  Asignado: "bg-amber-50 text-amber-700 border border-amber-200",
  "En Progreso": "bg-blue-50 text-blue-700 border border-blue-200",
  "En Proceso": "bg-blue-50 text-blue-700 border border-blue-200",
  Completado: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  Cerrado: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  Pendiente: "bg-amber-50 text-amber-700 border border-amber-200",
  "En Revisión": "bg-purple-50 text-purple-700 border border-purple-200",
  Aprobado: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  Rechazado: "bg-red-50 text-red-700 border border-red-200",
};

const ESTILO_POR_OMISION = "bg-slate-50 text-slate-600 border border-slate-200";

/** Estado de un plan de acción, igual en "Mis planes" y en la bandeja de revisión. */
export default function InsigniaEstadoPlan({ estado }: { estado: string }) {
  return (
    <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium truncate max-w-full ${ESTILO_ESTADO[estado] ?? ESTILO_POR_OMISION}`}>
      {estado}
    </span>
  );
}
