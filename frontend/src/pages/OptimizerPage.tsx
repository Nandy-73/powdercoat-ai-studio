import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "../api/client";
import type { OptimizationResult } from "../api/types";
import FormulationPicker from "../components/FormulationPicker";
import { Badge, Card, PageHeader, Spinner } from "../components/ui";

export default function OptimizerPage() {
  const [fid, setFid] = useState<number | null>(null);
  const [targets, setTargets] = useState({
    target_gloss: "",
    target_hardness: "",
    target_flexibility: "",
    target_texture: "",
    target_weather_resistance: "",
    max_cost_per_kg: "",
  });

  const optimize = useMutation({
    mutationFn: () =>
      api.post<OptimizationResult>("/ai/optimize", {
        formulation_id: fid,
        target_gloss: targets.target_gloss ? Number(targets.target_gloss) : null,
        target_hardness: targets.target_hardness ? Number(targets.target_hardness) : null,
        target_flexibility: targets.target_flexibility ? Number(targets.target_flexibility) : null,
        target_texture: targets.target_texture || null,
        target_weather_resistance: targets.target_weather_resistance
          ? Number(targets.target_weather_resistance)
          : null,
        max_cost_per_kg: targets.max_cost_per_kg ? Number(targets.max_cost_per_kg) : null,
      }),
  });

  const set = (k: string, v: string) => setTargets((t) => ({ ...t, [k]: v }));
  const r = optimize.data;

  return (
    <div>
      <PageHeader
        title="AI Optimization Engine"
        subtitle="Set property and cost targets — the engine searches composition space and returns a rebalanced formulation"
      />

      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="Targets" subtitle="Leave fields empty to ignore them">
          <div className="space-y-3">
            <FormulationPicker value={fid} onChange={setFid} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Target gloss (GU)" value={targets.target_gloss} onChange={(v) => set("target_gloss", v)} placeholder="95" />
              <Field label="Target hardness" value={targets.target_hardness} onChange={(v) => set("target_hardness", v)} placeholder="80" />
              <Field label="Target flexibility" value={targets.target_flexibility} onChange={(v) => set("target_flexibility", v)} placeholder="85" />
              <Field label="Weather resistance ≥" value={targets.target_weather_resistance} onChange={(v) => set("target_weather_resistance", v)} placeholder="75" />
              <Field label="Max cost ($/kg)" value={targets.max_cost_per_kg} onChange={(v) => set("max_cost_per_kg", v)} placeholder="2.20" />
              <div>
                <label className="label">Target texture</label>
                <select className="input" value={targets.target_texture} onChange={(e) => set("target_texture", e.target.value)}>
                  <option value="">Any</option>
                  <option value="smooth">Smooth</option>
                  <option value="fine_texture">Fine texture</option>
                  <option value="sand_texture">Sand texture</option>
                  <option value="wrinkle">Wrinkle</option>
                </select>
              </div>
            </div>
            <button
              className="btn-primary w-full"
              disabled={fid == null || optimize.isPending}
              onClick={() => optimize.mutate()}
            >
              {optimize.isPending ? "Optimizing…" : "⚙️ Run Optimization"}
            </button>
            {optimize.error && (
              <p className="text-xs text-rose-500">{(optimize.error as Error).message}</p>
            )}
          </div>
        </Card>

        <div className="space-y-6 xl:col-span-2">
          {optimize.isPending && (
            <Card>
              <Spinner label="Searching composition space (250 iterations)…" />
            </Card>
          )}
          {!r && !optimize.isPending && (
            <Card>
              <p className="py-16 text-center text-sm text-slate-400">
                Select a formulation, set at least one target and run the optimizer.
              </p>
            </Card>
          )}
          {r && !r.error && (
            <>
              <Card title="Baseline vs Optimized" subtitle={`${r.iterations} search iterations`}>
                <div className="overflow-x-auto">
                  <table className="table-base">
                    <thead>
                      <tr>
                        <th>Property</th>
                        <th className="text-right">Baseline</th>
                        <th className="text-right">Optimized</th>
                        <th className="text-right">Δ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(["gloss", "hardness", "flexibility", "weather", "cost_per_kg"] as const).map((k) => {
                        const base = r.baseline[k] as number;
                        const opt = r.optimized[k] as number;
                        const delta = Number((opt - base).toFixed(2));
                        return (
                          <tr key={k}>
                            <td className="font-medium capitalize">{k.replace(/_/g, " ")}</td>
                            <td className="text-right font-mono">{base}</td>
                            <td className="text-right font-mono font-bold">{opt}</td>
                            <td
                              className={`text-right font-mono ${
                                delta === 0 ? "text-slate-400" : delta > 0 ? "text-emerald-500" : "text-rose-500"
                              }`}
                            >
                              {delta > 0 ? "+" : ""}
                              {delta}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="mt-3 flex gap-2">
                  <Badge tone="violet">Finish: {String(r.optimized.finish_type ?? "—")}</Badge>
                  <Badge tone="blue">Validation score: {String(r.optimized.validation_score)}</Badge>
                </div>
              </Card>

              <Card title="Recommended Composition Changes">
                {r.changes.length === 0 ? (
                  <p className="text-sm text-slate-400">
                    The baseline already satisfies the targets — no changes recommended.
                  </p>
                ) : (
                  <table className="table-base">
                    <thead>
                      <tr>
                        <th>Material</th>
                        <th>Direction</th>
                        <th className="text-right">From</th>
                        <th className="text-right">To</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.changes.map((c) => (
                        <tr key={c.material}>
                          <td className="font-medium">{c.material}</td>
                          <td>
                            <Badge tone={c.direction === "increase" ? "green" : "red"}>{c.direction}</Badge>
                          </td>
                          <td className="text-right font-mono">{c.from_pct}%</td>
                          <td className="text-right font-mono font-bold">{c.to_pct}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Card>

              <Card title="Optimized Formulation" subtitle="Full rebalanced recipe">
                <table className="table-base">
                  <thead>
                    <tr>
                      <th>Material</th>
                      <th className="text-right">Weight (kg)</th>
                      <th className="text-right">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.optimized_items.map((i) => (
                      <tr key={i.name}>
                        <td>{i.name}</td>
                        <td className="text-right font-mono">{i.weight_kg}</td>
                        <td className="text-right font-mono">{i.pct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <input
        type="number"
        className="input"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
