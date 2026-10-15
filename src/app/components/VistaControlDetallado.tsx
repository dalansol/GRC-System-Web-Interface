import { useEffect, useState } from "react";
import { ClipboardCheck, ClipboardList, Loader2 } from "lucide-react";

import {
  AISummaryCard,
  Card,
  DetailField,
  ValidityBadge,
} from "./SharedComponents";
import type { ControlRecord } from "./SharedComponents";
import EvidenciasSection from "./EvidenciasSection";
import { listarControles } from "../api/controles";
import { consultarMiAsignacionControl } from "../api/auditControls";
import { AUDIT_ENTITIES, CONTROLS, PROCEDURE_TRACKING } from "../data/mock_data";

export default function VistaControlDetallado({
  id,
  crumbs,
}: {
  id: string;
  crumbs: React.ReactNode;
}) {
  const [backendControl, setBackendControl] = useState<ControlRecord | null>(null);
  const [puedeSubirEvidencia, setPuedeSubirEvidencia] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(null);
    listarControles()
      .then((controls) => {
        if (!active) return;
        const control = controls.find((item) => String(item.id) === String(id));
        if (control) setBackendControl(control);
        else setLoadError("No se encontró el control seleccionado.");
      })
      .catch((error: unknown) => {
        if (!active) return;
        setLoadError(error instanceof Error ? error.message : "No se pudo cargar el control.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    let active = true;
    setPuedeSubirEvidencia(false);
    consultarMiAsignacionControl(id)
      .then((resultado) => {
        if (active) setPuedeSubirEvidencia(resultado.asignado);
      })
      .catch(() => {
        if (active) setPuedeSubirEvidencia(false);
      });
    return () => {
      active = false;
    };
  }, [id]);

  const ctrl = backendControl ?? CONTROLS.find((control) => control.id === id);
  if (loading) {
    return (
      <div className="flex-1 overflow-auto p-6">
        {crumbs}
        <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
          <Loader2 className="mr-2 animate-spin" size={18} />
          Cargando control...
        </div>
      </div>
    );
  }

  if (!ctrl) {
    return (
      <div className="flex-1 overflow-auto p-6">
        {crumbs}
        <Card className="p-6 text-sm text-muted-foreground">
          {loadError ?? "No se encontró el control seleccionado."}
        </Card>
      </div>
    );
  }

  const auditEntity = AUDIT_ENTITIES.find(
    (entity) => entity.id === ctrl.auditEntityId,
  ) ?? { id: "—", name: "No disponible" };
  const procedures = PROCEDURE_TRACKING.filter(
    (procedure) => procedure.controlId === id,
  );

  return (
    <div
      className="flex-1 overflow-auto p-6"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      {crumbs}
      <Card className="mb-5 p-5">
        <div className="flex items-start gap-3 mb-3">
          <div className="p-2 bg-emerald-100 rounded-lg flex-shrink-0">
            <ClipboardCheck size={18} className="text-emerald-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs font-bold text-primary bg-primary/8 px-2.5 py-1 rounded-md">
                {ctrl.id}
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground bg-muted px-2 py-0.5 rounded">
                Procedimiento de Control
              </span>
              <ValidityBadge status={ctrl.validityStatus} />
            </div>
            <h1 className="text-xl font-bold text-foreground leading-tight">
              {ctrl.controlProcedureName}
            </h1>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 pt-3 border-t border-border mb-4">
          <DetailField label="ID Control" value={ctrl.id} />
          <DetailField label="Entidad Auditora" value={auditEntity.name} />
          <DetailField label="ID Entidad Auditora" value={auditEntity.id} />
        </div>
        <div className="pt-3 border-t border-border">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
            Actividad de Control
          </div>
          <p className="text-sm text-foreground leading-relaxed">
            {ctrl.controlActivity}
          </p>
        </div>
      </Card>

      <Card className="mb-5 p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="text-sm font-bold text-foreground">
            Procedimientos de Control Transversal
          </div>
          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-semibold">
            {ctrl.controlType}
          </span>
        </div>
        <div className="grid grid-cols-5 gap-4">
          {[
            { label: "Tipo de Control", value: ctrl.controlType },
            { label: "Frecuencia de Operación", value: ctrl.frequency },
            { label: "Tamaño de Muestra", value: ctrl.sampleSize },
            { label: "Rotación", value: ctrl.rotation },
            { label: "Estatus", value: ctrl.controlStatus },
          ].map((field) => (
            <div key={field.label} className="bg-muted/40 rounded-lg p-3">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                {field.label}
              </div>
              <div className="text-sm font-bold text-foreground">
                {field.value}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div className="px-4 pt-4 pb-3 border-b border-border flex items-center gap-2">
          <ClipboardList size={15} className="text-primary" />
          <div className="text-sm font-semibold text-foreground">
            Seguimiento de Procedimientos
          </div>
          <span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full font-semibold">
            {procedures.length}
          </span>
        </div>
        {procedures.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Sin procedimientos de seguimiento registrados
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {[
                    "ID Seguimiento",
                    "Nombre Procedimiento",
                    "Identificador",
                    "Depto. Negocio",
                    "Negocio",
                    "División",
                    "Área",
                    "País",
                  ].map((heading) => (
                    <th
                      key={heading}
                      className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {procedures.map((procedure) => (
                  <tr key={procedure.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs font-bold text-primary">{procedure.id}</td>
                    <td className="px-4 py-3 text-xs font-medium text-foreground">{procedure.procedureName}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{procedure.identificator}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{procedure.businessDeptName}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{procedure.businessName}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{procedure.divisionName}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{procedure.area}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{procedure.country}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <EvidenciasSection
        entityId={ctrl.id}
        entityType="control"
        controlId={ctrl.id}
        businessEntityId={ctrl.auditEntityId}
        puedeSubir={puedeSubirEvidencia}
      />
      <AISummaryCard entityId={ctrl.id} entityType="Control" />
    </div>
  );
}
