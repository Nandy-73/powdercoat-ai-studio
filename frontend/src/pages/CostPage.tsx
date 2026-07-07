import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../api/client";
import type { CostBreakdown } from "../api/types";
import FormulationPicker from "../components/FormulationPicker";
import { Badge, Card, PageHeader, Spinner, StatCard } from "../components/ui";

const COLORS = ["#3380fc", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#f97316"];

export default function CostPage() {
  const [fid, setFid] = useState<number | null>(null);
  const [batchKg, setBatchKg] = useState(1000);
  const [sellPrice, setSellPrice] = useState("");
  const [overhead, setOverhead] = useState(18);

  const run = useMutation({
    mutationFn: () =>
      api.post<CostBreakdown>("/ai/cost", {
        formulation_id: fid,
        batch_kg: batchKg,
        selling_price_per_kg: sellPrice ? Number(sellPrice) : null,
        overhead_pct: overhead,
      }),
  });

  const d = run.data;

  return (
    <div>
      <PageHeader
        title="Cost Intelligence"
        subtitle="Batch costing, margins and AI-suggested lower-cost material alternatives"
      />

      <div className="grid gap-6 xl:grid-cols-4">
        <Card title="Inputs" className="h-fit">
          <div className="space-y-3">
            <FormulationPicker value={fid} onChange={setFid} />
            <div>
              <label className="label">Batch size (kg)</label>
              <input type="number" className="input" value={batchKg} onChange={(e) => setBatchKg(Number(e.target.value))} />
            </div>
            <div>
              <label className="label">Selling price ($/kg, optional)</label>
              <input type="number" step="0.01" className="input" value={sellPrice} onChange={(e) => setSellPrice(e.target.value)} placeholder="4.50" />
            </div>
            <div>
              <label className="label">Overhead (%)</label>
              <input type="number" className="input" value={overhead} onChange={(e) => setOverhead(Number(e.target.value))} />
            </div>
            <button className="btn-primary w-full" disabled={fid == null || run.isPending} onClick={() => run.mutate()}>
              {run.isPending ? "Calculating…" : "💰 Calculate"}
            </button>
          </div>
        </Card>

        <div className="space-y-6 xl:col-span-3">
          {run.isPending && (
            <Card>
              <Spinner label="Computing cost breakdown…" />
            </Card>
          )}
          {!d && !run.isPending && (
            <Card>
              <p className="py-16 text-center text-sm text-slate-400">
                Select a formulation and calculate to see full batch economics.
              </p>
            </Card>
          )}
          {d && (
            <>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <StatCard label="Material Cost" value={`$${d.material_cost}`} hint={`$${d.material_cost_per_kg}/kg`} tone="blue" />
                <StatCard label="Production Cost" value={`$${d.production_cost}`} hint={`$${d.production_cost_per_kg}/kg incl. ${d.overhead_pct}% OH`} tone="violet" />
                {d.profit != null ? (
                  <>
                    <StatCard label="Profit" value={`$${d.profit}`} hint={`on $${d.revenue} revenue`} tone={d.profit > 0 ? "green" : "red"} />
                    <StatCard label="Margin" value={`${d.margin_pct}%`} tone={(d.margin_pct ?? 0) > 20 ? "green" : "amber"} />
                  </>
                ) : (
                  <StatCard label="Batch Size" value={`${d.batch_kg} kg`} tone="amber" />
                )}
              </div>

              <Card title="Cost Drivers" subtitle="Material cost contribution per component">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={d.lines}>
                    <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.15} />
                    <XAxis dataKey="material" tick={{ fontSize: 10 }} interval={0} angle={-18} textAnchor="end" height={70} />
                    <YAxis tick={{ fontSize: 11 }} unit="$" />
                    <Tooltip formatter={(v: number) => [`$${v}`, "Cost"]} />
                    <Bar dataKey="cost" radius={[6, 6, 0, 0]}>
                      {d.lines.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              <Card
                title="Lower-Cost Alternatives"
                subtitle="Same-category swaps ranked by saving; same-family swaps are lowest risk"
              >
                {!d.alternatives || d.alternatives.length === 0 ? (
                  <p className="text-sm text-slate-400">
                    No cheaper alternatives found in the material database.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="table-base">
                      <thead>
                        <tr>
                          <th>Replace</th>
                          <th>With</th>
                          <th className="text-right">Now</th>
                          <th className="text-right">Alt</th>
                          <th className="text-right">Saving/kg formulation</th>
                          <th>Risk</th>
                        </tr>
                      </thead>
                      <tbody>
                        {d.alternatives.map((a, i) => (
                          <tr key={i}>
                            <td>{a.replace}</td>
                            <td className="font-medium">{a.with}</td>
                            <td className="text-right font-mono">${a.current_cost_per_kg}</td>
                            <td className="text-right font-mono">${a.alternative_cost_per_kg}</td>
                            <td className="text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                              ${a.estimated_formulation_saving_per_kg}
                            </td>
                            <td>
                              <Badge tone={a.same_chemical_family ? "green" : "amber"}>
                                {a.same_chemical_family ? "low" : "medium"}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
