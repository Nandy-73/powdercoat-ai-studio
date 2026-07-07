import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { api } from "../api/client";
import type {
  Formulation,
  FormulationMetrics,
  Trial,
  ValidationReport,
} from "../api/types";
import { useMaterials, CATEGORY_LABELS, SYSTEM_LABELS } from "../api/hooks";
import { Badge, Card, ErrorState, PageHeader, ScoreBar, Spinner, statusTone } from "../components/ui";

const PIE_COLORS = ["#3380fc", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#f97316", "#84cc16"];

export default function FormulationDetailPage() {
  const { id } = useParams();
  const fid = Number(id);
  const queryClient = useQueryClient();

  const { data: f, isLoading, error } = useQuery({
    queryKey: ["formulation", fid],
    queryFn: () => api.get<Formulation>(`/formulations/${fid}`),
  });
  const { data: metrics } = useQuery({
    queryKey: ["metrics", fid, f?.updated_at],
    queryFn: () => api.get<FormulationMetrics>(`/formulations/${fid}/metrics`),
    enabled: !!f,
  });
  const { data: validation } = useQuery({
    queryKey: ["validation", fid, f?.updated_at],
    queryFn: () => api.get<ValidationReport>(`/formulations/${fid}/validate`),
    enabled: !!f && f.items.length > 0,
  });
  const { data: trials } = useQuery({
    queryKey: ["trials", fid],
    queryFn: () => api.get<Trial[]>(`/formulations/${fid}/trials`),
    enabled: !!f,
  });

  const [editOpen, setEditOpen] = useState(false);

  const setStatus = useMutation({
    mutationFn: (status: string) => api.patch(`/formulations/${fid}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["formulation", fid] }),
  });

  if (isLoading) return <Spinner label="Loading formulation…" />;
  if (error || !f) return <ErrorState message={(error as Error)?.message ?? "Not found"} />;

  return (
    <div>
      <PageHeader
        title={`${f.code} — ${f.name}`}
        subtitle={f.description || "No description"}
        actions={
          <>
            <select
              className="input !w-40"
              value={f.status}
              onChange={(e) => setStatus.mutate(e.target.value)}
            >
              {["draft", "trial", "approved", "production", "rejected", "archived"].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <button className="btn-primary" onClick={() => setEditOpen(!editOpen)}>
              {editOpen ? "Close Editor" : "Edit Composition"}
            </button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Badge tone="violet">{SYSTEM_LABELS[f.system]}</Badge>
        <Badge tone={statusTone(f.status)}>{f.status}</Badge>
        <Badge tone="blue">
          Cure {f.cure_time_min.toFixed(0)} min @ {f.cure_temp_c.toFixed(0)}°C
        </Badge>
        <Badge tone="slate">Target: {f.target_finish}, {f.target_gloss.toFixed(0)} GU</Badge>
      </div>

      {editOpen && <CompositionEditor formulation={f} onDone={() => setEditOpen(false)} />}

      <div className="grid gap-6 xl:grid-cols-3">
        <Card title="Composition" subtitle={`${f.items.length} raw materials`} className="xl:col-span-2">
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Material</th>
                  <th>Category</th>
                  <th className="text-right">Weight (kg)</th>
                  <th className="text-right">%</th>
                  <th className="text-right">Cost</th>
                </tr>
              </thead>
              <tbody>
                {metrics?.composition.map((c) => (
                  <tr key={c.name}>
                    <td className="font-medium">{c.name}</td>
                    <td>
                      <Badge tone="slate">{CATEGORY_LABELS[c.category] ?? c.category}</Badge>
                    </td>
                    <td className="text-right font-mono">{c.weight_kg.toFixed(2)}</td>
                    <td className="text-right font-mono">{c.pct.toFixed(2)}%</td>
                    <td className="text-right font-mono">${c.cost.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Formulation Mathematics" subtitle="Auto-calculated">
          {metrics ? (
            <div className="space-y-2.5 text-sm">
              <MetricRow label="Total weight" value={`${metrics.total_weight_kg} kg`} />
              <MetricRow label="Cost per kg" value={`$${metrics.cost_per_kg}`} highlight />
              <MetricRow label="Binder content" value={`${metrics.binder_content_pct}%`} />
              <MetricRow
                label="Resin : Hardener"
                value={metrics.resin_to_hardener_ratio ? `${metrics.resin_to_hardener_ratio} : 1` : "—"}
              />
              <MetricRow label="Pigment loading" value={`${metrics.pigment_loading_pct}%`} />
              <MetricRow label="Filler" value={`${metrics.filler_pct}%`} />
              <MetricRow label="Additives" value={`${metrics.additive_pct}%`} />
              <MetricRow label="PVC" value={`${metrics.pvc_pct}%`} highlight />
              <div className="pt-2">
                <ResponsiveContainer width="100%" height={170}>
                  <PieChart>
                    <Pie
                      data={metrics.composition.map((c) => ({ name: c.name, value: c.pct }))}
                      dataKey="value"
                      nameKey="name"
                      outerRadius={70}
                      innerRadius={40}
                    >
                      {metrics.composition.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => `${v.toFixed(1)}%`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <Spinner />
          )}
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card
          title="AI Formulation Validation"
          subtitle="Rule engine: stoichiometry, loadings, PVC, cure schedule, compatibility"
        >
          {validation ? (
            <div>
              <div className="mb-4 flex items-center gap-4">
                <div className="flex-1">
                  <ScoreBar score={validation.score} label={`Validation score (${validation.verdict})`} />
                </div>
              </div>
              <div className="space-y-3">
                {validation.issues.length === 0 && (
                  <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                    ✓ No issues detected — the formulation is within industrial practice on every rule.
                  </p>
                )}
                {validation.issues.map((issue, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-slate-200 p-3 dark:border-slate-700"
                  >
                    <div className="flex items-center gap-2">
                      <Badge tone={statusTone(issue.severity)}>{issue.severity}</Badge>
                      <p className="text-sm font-semibold">{issue.message}</p>
                    </div>
                    <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">{issue.explanation}</p>
                    <p className="mt-1 text-xs font-medium text-brand-600 dark:text-brand-400">
                      → {issue.correction}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : f.items.length === 0 ? (
            <p className="text-sm text-slate-400">Add materials to run validation.</p>
          ) : (
            <Spinner />
          )}
        </Card>

        <Card title="Trial History" subtitle="Laboratory trials with results">
          <TrialSection formulationId={fid} trials={trials ?? []} />
        </Card>
      </div>
    </div>
  );
}

function MetricRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
      <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
      <span className={`font-mono text-sm font-bold ${highlight ? "text-brand-600 dark:text-brand-400" : ""}`}>
        {value}
      </span>
    </div>
  );
}

function CompositionEditor({ formulation: f, onDone }: { formulation: Formulation; onDone: () => void }) {
  const queryClient = useQueryClient();
  const { data: materials } = useMaterials();
  const [items, setItems] = useState(
    f.items.map((it) => ({ material_id: it.material_id, weight_kg: it.weight_kg }))
  );
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const total = useMemo(() => items.reduce((s, i) => s + (i.weight_kg || 0), 0), [items]);

  const save = useMutation({
    mutationFn: () =>
      api.patch(`/formulations/${f.id}`, {
        items: items.filter((i) => i.material_id && i.weight_kg > 0),
        version_note: note || "Composition updated",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["formulation", f.id] });
      queryClient.invalidateQueries({ queryKey: ["metrics"] });
      queryClient.invalidateQueries({ queryKey: ["validation"] });
      onDone();
    },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <Card title="Composition Editor" subtitle="Changes create a new version snapshot" className="mb-6">
      <div className="space-y-2">
        {items.map((item, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <select
              className="input flex-1"
              value={item.material_id || ""}
              onChange={(e) => {
                const next = [...items];
                next[idx] = { ...item, material_id: Number(e.target.value) };
                setItems(next);
              }}
            >
              <option value="">Select material…</option>
              {materials?.map((m) => (
                <option key={m.id} value={m.id}>
                  [{CATEGORY_LABELS[m.category]}] {m.name}
                </option>
              ))}
            </select>
            <input
              type="number"
              step="0.1"
              min="0"
              className="input !w-28"
              value={item.weight_kg || ""}
              onChange={(e) => {
                const next = [...items];
                next[idx] = { ...item, weight_kg: Number(e.target.value) };
                setItems(next);
              }}
            />
            <span className="w-14 text-right text-xs text-slate-400">
              {total > 0 && item.weight_kg > 0 ? `${((item.weight_kg / total) * 100).toFixed(1)}%` : "—"}
            </span>
            <button
              className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10"
              onClick={() => setItems(items.filter((_, i) => i !== idx))}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          className="btn-secondary !py-1.5 text-xs"
          onClick={() => setItems([...items, { material_id: 0, weight_kg: 0 }])}
        >
          + Add material
        </button>
        <input
          className="input flex-1"
          placeholder="Version note (e.g. 'Increased TiO2 for opacity')"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <button className="btn-primary" disabled={save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? "Saving…" : `Save (${total.toFixed(1)} kg)`}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-rose-500">{error}</p>}
    </Card>
  );
}

function TrialSection({ formulationId, trials }: { formulationId: number; trials: Trial[] }) {
  const queryClient = useQueryClient();
  const [result, setResult] = useState("pass");
  const [gloss, setGloss] = useState<string>("");
  const [notes, setNotes] = useState("");

  const add = useMutation({
    mutationFn: () =>
      api.post(`/formulations/${formulationId}/trials`, {
        result,
        gloss_measured: gloss ? Number(gloss) : null,
        notes,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trials", formulationId] });
      setNotes("");
      setGloss("");
    },
  });

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select className="input !w-28" value={result} onChange={(e) => setResult(e.target.value)}>
          <option value="pass">pass</option>
          <option value="fail">fail</option>
          <option value="pending">pending</option>
        </select>
        <input
          className="input !w-28"
          type="number"
          placeholder="Gloss GU"
          value={gloss}
          onChange={(e) => setGloss(e.target.value)}
        />
        <input
          className="input flex-1"
          placeholder="Trial notes…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <button className="btn-primary !py-1.5" onClick={() => add.mutate()} disabled={add.isPending}>
          Log
        </button>
      </div>
      <div className="space-y-2">
        {trials.length === 0 && <p className="text-sm text-slate-400">No trials recorded yet.</p>}
        {trials.map((t) => (
          <div
            key={t.id}
            className="flex items-center gap-3 rounded-lg border border-slate-200 p-2.5 text-sm dark:border-slate-700"
          >
            <Badge tone={statusTone(t.result)}>{t.result}</Badge>
            {t.gloss_measured != null && (
              <span className="font-mono text-xs">{t.gloss_measured} GU</span>
            )}
            <span className="flex-1 text-xs text-slate-500 dark:text-slate-400">{t.notes}</span>
            <span className="text-[10px] text-slate-400">{new Date(t.created_at).toLocaleDateString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
