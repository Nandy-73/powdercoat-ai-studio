import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import type { ManufacturingPrediction } from "../api/types";
import FormulationPicker from "../components/FormulationPicker";
import { Card, PageHeader, ScoreBar, Spinner } from "../components/ui";

export default function ManufacturingPage() {
  const [fid, setFid] = useState<number | null>(null);
  const [batchKg, setBatchKg] = useState(500);

  const { data, isLoading } = useQuery({
    queryKey: ["mfg", fid, batchKg],
    queryFn: () =>
      api.get<ManufacturingPrediction>(`/ai/predict/manufacturing/${fid}?batch_kg=${batchKg}`),
    enabled: fid != null,
  });

  return (
    <div>
      <PageHeader
        title="Manufacturing Intelligence"
        subtitle="Extrusion, grinding, spray behavior, cure schedule and production risk prediction"
      />

      <div className="mb-6 grid max-w-2xl grid-cols-2 gap-3">
        <FormulationPicker value={fid} onChange={setFid} />
        <div>
          <label className="label">Batch size (kg)</label>
          <input type="number" className="input" value={batchKg} onChange={(e) => setBatchKg(Number(e.target.value))} />
        </div>
      </div>

      {fid == null && (
        <Card>
          <p className="py-16 text-center text-sm text-slate-400">
            Select a formulation to simulate its production behavior.
          </p>
        </Card>
      )}
      {isLoading && <Spinner label="Simulating production line…" />}

      {data && (
        <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
          <Card title="Extrusion" subtitle={data.extrusion_behavior.assessment}>
            <ScoreBar score={data.extrusion_behavior.load_pct} label="Extruder load" />
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
              Loads above 80% indicate torque spikes and dispersion risk — consider raising melt zone
              temperature or reducing solids.
            </p>
          </Card>
          <Card title="Cooling" subtitle={data.cooling_efficiency.note}>
            <ScoreBar score={data.cooling_efficiency.score} label="Cooling efficiency" />
          </Card>
          <Card title="Grinding" subtitle={data.grinding_efficiency.note}>
            <ScoreBar score={data.grinding_efficiency.score} label="Grinding efficiency" />
            <p className="mt-3 text-sm">
              Predicted particle size d₅₀: <b className="font-mono">{data.particle_size_d50_um} µm</b>
            </p>
          </Card>
          <Card title="Application" subtitle={data.sprayability.note}>
            <ScoreBar score={data.sprayability.score} label="Sprayability" />
            <div className="mt-3 space-y-1 text-sm">
              <p>
                Transfer efficiency: <b className="font-mono">{data.transfer_efficiency_pct}%</b>
              </p>
              <p>
                Recommended film build: <b className="font-mono">{data.recommended_film_thickness_um} µm</b>
              </p>
            </div>
          </Card>
          <Card title="Cure Schedule" subtitle="Oven recommendation">
            <p className="rounded-xl bg-brand-50 p-4 text-sm font-semibold text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
              🔥 {data.recommended_cure_schedule}
            </p>
          </Card>
          <Card title="Production Risks" subtitle="AI-flagged risks for this batch">
            <ul className="space-y-2">
              {data.production_risks.map((r, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <span>{r.startsWith("No significant") ? "✅" : "⚠️"}</span>
                  <span className="text-slate-600 dark:text-slate-300">{r}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}
    </div>
  );
}
