import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import FormulationPicker from "../components/FormulationPicker";
import { Badge, Card, PageHeader, Spinner } from "../components/ui";

const PRESETS = [
  { label: "Laboratory", kg: 2, icon: "🧪" },
  { label: "Pilot", kg: 50, icon: "⚗️" },
  { label: "Production", kg: 500, icon: "🏭" },
  { label: "Factory", kg: 2000, icon: "🏗️" },
];

interface ScaleResult {
  formulation: string;
  target_kg: number;
  metrics: { cost_per_kg: number; total_cost: number };
  items: { name: string; category: string; weight_kg: number; pct: number }[];
}

export default function BatchCalculatorPage() {
  const [fid, setFid] = useState<number | null>(null);
  const [targetKg, setTargetKg] = useState(500);

  const { data, isLoading } = useQuery({
    queryKey: ["scale", fid, targetKg],
    queryFn: () => api.get<ScaleResult>(`/formulations/${fid}/scale?target_kg=${targetKg}`),
    enabled: fid != null && targetKg > 0,
  });

  return (
    <div>
      <PageHeader
        title="Batch Calculator"
        subtitle="Scale any formulation from laboratory to factory while preserving percentages exactly"
      />

      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="Batch Size">
          <FormulationPicker value={fid} onChange={setFid} />
          <div className="mt-4 grid grid-cols-2 gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.label}
                onClick={() => setTargetKg(p.kg)}
                className={`rounded-xl border p-3 text-left transition ${
                  targetKg === p.kg
                    ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10"
                    : "border-slate-200 hover:border-brand-300 dark:border-slate-700"
                }`}
              >
                <p className="text-lg">{p.icon}</p>
                <p className="text-xs font-bold">{p.label}</p>
                <p className="text-[11px] text-slate-400">{p.kg} kg</p>
              </button>
            ))}
          </div>
          <div className="mt-4">
            <label className="label">Custom batch size (kg)</label>
            <input
              type="number"
              min="0.1"
              step="0.1"
              className="input"
              value={targetKg}
              onChange={(e) => setTargetKg(Number(e.target.value))}
            />
          </div>
        </Card>

        <Card
          title={data ? `${data.formulation} @ ${data.target_kg} kg` : "Scaled Recipe"}
          className="xl:col-span-2"
          actions={
            data && (
              <Badge tone="blue">
                ${data.metrics.cost_per_kg}/kg · total ${data.metrics.total_cost}
              </Badge>
            )
          }
        >
          {fid == null && (
            <p className="py-16 text-center text-sm text-slate-400">Select a formulation to scale.</p>
          )}
          {isLoading && <Spinner label="Scaling…" />}
          {data && (
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Material</th>
                    <th>Category</th>
                    <th className="text-right">Weigh-out (kg)</th>
                    <th className="text-right">%</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((i) => (
                    <tr key={i.name}>
                      <td className="font-medium">{i.name}</td>
                      <td className="text-xs text-slate-500">{i.category.replace("_", " ")}</td>
                      <td className="text-right font-mono font-bold">{i.weight_kg.toFixed(3)}</td>
                      <td className="text-right font-mono">{i.pct.toFixed(2)}%</td>
                    </tr>
                  ))}
                  <tr className="font-bold">
                    <td colSpan={2}>Total</td>
                    <td className="text-right font-mono">
                      {data.items.reduce((s, i) => s + i.weight_kg, 0).toFixed(2)}
                    </td>
                    <td className="text-right font-mono">100%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
