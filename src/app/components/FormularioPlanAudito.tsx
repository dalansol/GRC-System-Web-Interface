import { useEffect, useState } from "react";
import { BookOpen, Save, Loader2, X } from "lucide-react";
import { Card, PrimaryBtn } from "./SharedComponents";
import type { AuditPlan } from "./SharedComponents";

interface Empleado {
    id: string;
    name: string;
}

export interface DatosFormularioPlanAudito {
    code: string;
    name: string;
    type: AuditPlan["type"];
    period: string; // Auto-generated now!
    startDate: string; // Auto-generated now!
    endDate: string; // Auto-generated now!
    estimatedHours: number;
    responsible: string;
    scope: string;
}

interface FormularioPlanAuditoProps {
    isCreating: boolean;
    empleadosAsignados: Empleado[];
    responsableInicial: string;
    onSubmit: (data: DatosFormularioPlanAudito) => Promise<boolean>;
    onCancel: () => void;
}

export default function FormularioPlanAudito({
    isCreating,
    empleadosAsignados,
    responsableInicial,
    onSubmit,
    onCancel,
}: FormularioPlanAuditoProps) {
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
    const [selectedQuarter, setSelectedQuarter] = useState("Q1");
    
    const [form, setForm] = useState({
        code: "",
        name: "",
        type: "Anual" as AuditPlan["type"],
        estimatedHours: "",
        responsible: responsableInicial,
        scope: "",
    });

    const [formErr, setFormErr] = useState<Record<string, string>>({});

    // Efecto para inicializar el responsable
    useEffect(() => {
        setForm((previous) =>
            previous.responsible ? previous : { ...previous, responsible: responsableInicial }
        );
    }, [responsableInicial]);

    // El backend asigna el consecutivo; aquí solo mostramos una referencia del formato.
    useEffect(() => {
        const prefix = form.type === "Anual" ? "PAA" : "PAT";
        const periodCode = form.type === "Anual" ? selectedYear : `${selectedYear}-${selectedQuarter}`;
        
        setForm((f) => ({
            ...f,
            code: `${prefix}-${periodCode}-XXX`,
        }));
    }, [form.type, selectedYear, selectedQuarter]);

    const getCalculatedDates = () => {
        let startDate = `${selectedYear}-01-01`;
        let endDate = `${selectedYear}-12-31`;
        let period = selectedYear;

        if (form.type === "Trimestral") {
            period = `${selectedQuarter} ${selectedYear}`;
            switch (selectedQuarter) {
                case "Q1": startDate = `${selectedYear}-01-01`; endDate = `${selectedYear}-03-31`; break;
                case "Q2": startDate = `${selectedYear}-04-01`; endDate = `${selectedYear}-06-30`; break;
                case "Q3": startDate = `${selectedYear}-07-01`; endDate = `${selectedYear}-09-30`; break;
                case "Q4": startDate = `${selectedYear}-10-01`; endDate = `${selectedYear}-12-31`; break;
            }
        }
        return { startDate, endDate, period };
    };

    const validate = () => {
        const errs: Record<string, string> = {};
        if (!form.code.trim()) errs.code = "Requerido";
        if (!form.name.trim()) errs.name = "Requerido";
        if (!form.type) errs.type = "Selecciona anual o trimestral";
        const h = Number(form.estimatedHours);
        if (!form.estimatedHours || h <= 0 || !Number.isFinite(h)) errs.estimatedHours = "Debe ser mayor a 0";
        return errs;
    };

    const handleSubmit = async () => {
        const errs = validate();
        if (Object.keys(errs).length) {
            setFormErr(errs);
            return;
        }

        const { startDate, endDate, period } = getCalculatedDates();

        const success = await onSubmit({
            ...form,
            type: form.type,
            period,
            startDate,
            endDate,
            estimatedHours: Number(form.estimatedHours),
        });

        if (success) {
            setFormErr({});
        }
    };

    const formatDisplayDate = (dateStr: string) => {
        const [year, month, day] = dateStr.split("-");
        const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
        return `${day} ${months[parseInt(month, 10) - 1]} ${year}`;
    };

    const currentCalculations = getCalculatedDates();

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
            <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 bg-white shadow-2xl relative">
                <button
                    onClick={onCancel}
                    className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    title="Cerrar"
                >
                    <X size={18} />
                </button>

                <div className="flex items-center gap-2 mb-6 border-b border-border pb-4">
                    <BookOpen size={18} className="text-primary" />
                    <h2 className="text-lg font-semibold text-foreground">Nuevo Plan de Auditoría (FEMSA)</h2>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">
                            Código del plan (Auto)
                        </label>
                        <input
                            type="text" 
                            value={form.code} 
                            readOnly
                            className="w-full text-sm px-3 py-2 rounded-md border border-border bg-slate-50 text-slate-500 cursor-not-allowed focus:outline-none"
                        />
                        {formErr.code && <div className="text-xs text-red-600 mt-0.5">{formErr.code}</div>}
                    </div>

                    <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Nombre del plan</label>
                        <input
                            type="text" value={form.name} placeholder="Plan de Auditoría…"
                            onChange={(e) => { setForm((f) => ({ ...f, name: e.target.value })); setFormErr((f) => ({ ...f, name: "" })); }}
                            className={`w-full text-sm px-3 py-2 rounded-md border bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 ${formErr.name ? "border-red-400" : "border-border"}`}
                        />
                        {formErr.name && <div className="text-xs text-red-600 mt-0.5">{formErr.name}</div>}
                    </div>

                    <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Año</label>
                        <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(e.target.value)}
                            className="w-full text-sm px-3 py-2 rounded-md border border-border bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
                        >
                            <option value="2025">2025</option>
                            <option value="2026">2026</option>
                            <option value="2027">2027</option>
                        </select>
                    </div>

                    <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Tipo de plan</label>
                        <select
                            value={form.type}
                            onChange={(e) => {
                                setForm((f) => ({ ...f, type: e.target.value as AuditPlan["type"] }));
                                setFormErr((f) => ({ ...f, type: "" }));
                            }}
                            className={`w-full text-sm px-3 py-2 rounded-md border bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 ${formErr.type ? "border-red-400" : "border-border"}`}
                        >
                            <option value="Anual">Anual</option>
                            <option value="Trimestral">Trimestral</option>
                        </select>
                    </div>

                    {form.type === "Trimestral" && (
                        <div>
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Trimestre</label>
                            <select
                                value={selectedQuarter}
                                onChange={(e) => setSelectedQuarter(e.target.value)}
                                className="w-full text-sm px-3 py-2 rounded-md border border-border bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
                            >
                                <option value="Q1">Q1 (Ene - Mar)</option>
                                <option value="Q2">Q2 (Abr - Jun)</option>
                                <option value="Q3">Q3 (Jul - Sep)</option>
                                <option value="Q4">Q4 (Oct - Dic)</option>
                            </select>
                        </div>
                    )}

                    <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Responsable</label>
                        <select
                            value={form.responsible}
                            onChange={(e) => setForm((f) => ({ ...f, responsible: e.target.value }))}
                            className="w-full text-sm px-3 py-2 rounded-md border border-border bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
                        >
                            <option value="">— Seleccionar responsable —</option>
                            {empleadosAsignados.map((empleado) => (
                                <option key={empleado.id} value={empleado.name}>{empleado.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Horas estimadas</label>
                        <input
                            type="number" value={form.estimatedHours} placeholder="120"
                            onChange={(e) => { setForm((f) => ({ ...f, estimatedHours: e.target.value })); setFormErr((f) => ({ ...f, estimatedHours: "" })); }}
                            className={`w-full text-sm px-3 py-2 rounded-md border bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 ${formErr.estimatedHours ? "border-red-400" : "border-border"}`}
                        />
                        {formErr.estimatedHours && <div className="text-xs text-red-600 mt-0.5">{formErr.estimatedHours}</div>}
                    </div>
                </div>

                <div className="mb-4 px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-xs text-slate-600 flex items-center justify-between">
                    <span className="font-semibold">Fechas programadas (Automático)</span>
                    <span className="font-medium">
                        {formatDisplayDate(currentCalculations.startDate)} — {formatDisplayDate(currentCalculations.endDate)}
                    </span>
                </div>

                <div className="mb-6">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Alcance</label>
                    <textarea
                        value={form.scope} rows={3} placeholder="Descripción del alcance del plan…"
                        onChange={(e) => setForm((f) => ({ ...f, scope: e.target.value }))}
                        className="w-full text-sm px-3 py-2 rounded-md border border-border bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                    />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-border">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200 transition-colors"
                    >
                        Cancelar
                    </button>
                    <PrimaryBtn
                        icon={isCreating ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                        onClick={handleSubmit}
                    >
                        {isCreating ? "Guardando..." : "Guardar plan"}
                    </PrimaryBtn>
                </div>
            </Card>
        </div>
    );
}