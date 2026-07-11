import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import type { IngestionSource, Machine, MachineSuggestion, IngestRunResult } from "../api/types";
import { Badge, Card, EmptyState, Modal, PageHeader, Spinner } from "../components/ui";
import { useAuth } from "../context/AuthContext";

const TYPE_LABELS: Record<string, string> = {
  mixer: "Mixers",
  extruder: "Extruders",
  cooling_system: "Cooling Systems",
  crusher: "Crushers",
  grinding: "Grinding Machines",
  sieving: "Sieving Machines",
  packaging: "Packaging",
  laboratory: "Laboratory Equipment",
  other: "Other",
};

const TYPE_OPTIONS = Object.keys(TYPE_LABELS);

const emptyMachine = {
  name: "",
  machine_type: "extruder",
  manufacturer: "",
  country: "",
  capacity: "",
  estimated_price_usd: 0,
  energy_kw: 0,
  warranty_years: 1,
  specs: "{}",
};

export default function MachineryPage() {
  const { user } = useAuth();
  const canManage = !!user && ["administrator", "procurement_manager", "production_manager"].includes(user.role);
  const [tab, setTab] = useState<"catalog" | "discovery">("catalog");

  return (
    <div>
      <PageHeader
        title="Machinery Intelligence"
        subtitle="Production and laboratory equipment — managed manually and discovered automatically by AI"
        actions={
          canManage && (
            <div className="flex rounded-2xl border border-white/50 p-1 dark:border-white/10">
              {(["catalog", "discovery"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition ${
                    tab === t ? "bg-brand-600 text-white" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  }`}
                >
                  {t === "catalog" ? "📋 Catalog" : "🤖 AI Discovery"}
                </button>
              ))}
            </div>
          )
        }
      />

      {tab === "catalog" ? <Catalog canManage={canManage} /> : <Discovery />}
    </div>
  );
}

/* ---------------- Option A: catalog with CRUD ---------------- */
function Catalog({ canManage }: { canManage: boolean }) {
  const queryClient = useQueryClient();
  const [type, setType] = useState("");
  const [editing, setEditing] = useState<Machine | null>(null);
  const [creating, setCreating] = useState(false);

  const { data: types } = useQuery({
    queryKey: ["machine-types"],
    queryFn: () => api.get<string[]>("/machinery/types"),
  });
  const { data, isLoading } = useQuery({
    queryKey: ["machines", type],
    queryFn: () => api.get<Machine[]>(`/machinery${type ? `?machine_type=${type}` : ""}`),
  });

  const del = useMutation({
    mutationFn: (id: number) => api.delete(`/machinery/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["machines"] }),
  });

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <select className="input !w-56" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All equipment</option>
          {types?.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABELS[t] ?? t}
            </option>
          ))}
        </select>
        {canManage && (
          <button className="btn-primary" onClick={() => setCreating(true)}>
            + Add Machine
          </button>
        )}
      </div>

      {isLoading && <Spinner label="Loading machinery…" />}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data?.map((m) => {
          let specs: Record<string, unknown> = {};
          try {
            specs = JSON.parse(m.specs);
          } catch {
            /* ignore */
          }
          return (
            <Card key={m.id}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <Badge tone="violet">{TYPE_LABELS[m.machine_type] ?? m.machine_type}</Badge>
                  <h3 className="mt-2 font-bold">{m.name}</h3>
                  <p className="text-xs text-slate-400">
                    {m.manufacturer} · {m.country}
                  </p>
                </div>
                {canManage && (
                  <div className="flex gap-1">
                    <button
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-white/40 hover:text-brand-600 dark:hover:bg-white/10"
                      title="Edit"
                      onClick={() => setEditing(m)}
                    >
                      ✏️
                    </button>
                    <button
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-500 dark:hover:bg-rose-500/10"
                      title="Delete"
                      onClick={() => del.mutate(m.id)}
                    >
                      🗑️
                    </button>
                  </div>
                )}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <Info label="Capacity" value={m.capacity || "—"} />
                <Info label="Est. price" value={m.estimated_price_usd > 0 ? `$${m.estimated_price_usd.toLocaleString()}` : "on request"} />
                <Info label="Energy" value={m.energy_kw > 0 ? `${m.energy_kw} kW` : "—"} />
                <Info label="Warranty" value={`${m.warranty_years} yr`} />
              </div>
              {Object.keys(specs).length > 0 && (
                <div className="mt-3 border-t border-white/30 pt-2 text-[11px] text-slate-500 dark:border-white/10 dark:text-slate-400">
                  {Object.entries(specs).map(([k, v]) => (
                    <p key={k}>
                      <span className="font-semibold">{k.replace(/_/g, " ")}:</span> {String(v)}
                    </p>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {(creating || editing) && (
        <MachineModal
          machine={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function MachineModal({ machine, onClose }: { machine: Machine | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(machine ? { ...machine } : { ...emptyMachine });
  const [error, setError] = useState<string | null>(null);
  const isEdit = !!machine;

  const save = useMutation({
    mutationFn: () =>
      isEdit ? api.patch(`/machinery/${machine!.id}`, form) : api.post("/machinery", form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["machines"] });
      queryClient.invalidateQueries({ queryKey: ["machine-types"] });
      onClose();
    },
    onError: (e: Error) => setError(e.message),
  });

  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Modal open onClose={onClose} title={isEdit ? "Edit Machine" : "Add Machine"} wide>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="label">Name</label>
          <input className="input" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Twin-Screw Extruder ZSK-40" />
        </div>
        <div>
          <label className="label">Type</label>
          <select className="input" value={form.machine_type} onChange={(e) => set("machine_type", e.target.value)}>
            {TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Manufacturer</label>
          <input className="input" value={form.manufacturer} onChange={(e) => set("manufacturer", e.target.value)} />
        </div>
        <div>
          <label className="label">Country</label>
          <input className="input" value={form.country} onChange={(e) => set("country", e.target.value)} />
        </div>
        <div>
          <label className="label">Capacity</label>
          <input className="input" value={form.capacity} onChange={(e) => set("capacity", e.target.value)} placeholder="300 kg/h" />
        </div>
        <div>
          <label className="label">Est. price (USD)</label>
          <input type="number" className="input" value={form.estimated_price_usd} onChange={(e) => set("estimated_price_usd", Number(e.target.value))} />
        </div>
        <div>
          <label className="label">Energy (kW)</label>
          <input type="number" className="input" value={form.energy_kw} onChange={(e) => set("energy_kw", Number(e.target.value))} />
        </div>
        <div>
          <label className="label">Warranty (years)</label>
          <input type="number" className="input" value={form.warranty_years} onChange={(e) => set("warranty_years", Number(e.target.value))} />
        </div>
      </div>
      {error && <p className="mt-3 text-xs text-rose-500">{error}</p>}
      <div className="mt-5 flex justify-end gap-2">
        <button className="btn-secondary" onClick={onClose}>
          Cancel
        </button>
        <button className="btn-primary" disabled={!form.name || save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? "Saving…" : isEdit ? "Save Changes" : "Add Machine"}
        </button>
      </div>
    </Modal>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/40 px-2.5 py-1.5 dark:bg-white/5">
      <p className="text-[10px] uppercase tracking-wide text-slate-400">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}

/* ---------------- Option B: AI discovery ---------------- */
function Discovery() {
  const queryClient = useQueryClient();
  const [scanResult, setScanResult] = useState<IngestRunResult | null>(null);

  const { data: sources } = useQuery({
    queryKey: ["sources"],
    queryFn: () => api.get<IngestionSource[]>("/machinery/sources"),
  });
  const { data: suggestions } = useQuery({
    queryKey: ["suggestions"],
    queryFn: () => api.get<MachineSuggestion[]>("/machinery/suggestions"),
  });

  const scan = useMutation({
    mutationFn: () => api.post<IngestRunResult>("/machinery/ingest/run"),
    onSuccess: (r) => {
      setScanResult(r);
      queryClient.invalidateQueries({ queryKey: ["suggestions"] });
      queryClient.invalidateQueries({ queryKey: ["sources"] });
    },
  });
  const approve = useMutation({
    mutationFn: (id: number) => api.post(`/machinery/suggestions/${id}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suggestions"] });
      queryClient.invalidateQueries({ queryKey: ["machines"] });
    },
  });
  const reject = useMutation({
    mutationFn: (id: number) => api.post(`/machinery/suggestions/${id}/reject`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["suggestions"] }),
  });

  return (
    <div className="grid gap-6 xl:grid-cols-5">
      <div className="xl:col-span-2">
        <Card
          title="Scan Sources"
          subtitle="Pages the AI reads to discover new machines. It also runs automatically every day."
          actions={
            <button className="btn-primary !py-1.5 text-xs" disabled={scan.isPending} onClick={() => scan.mutate()}>
              {scan.isPending ? "Scanning…" : "🔍 Scan now"}
            </button>
          }
        >
          <SourceManager sources={sources} />
          {scanResult && (
            <div className="mt-4 rounded-xl border border-white/40 bg-white/40 p-3 text-xs dark:border-white/10 dark:bg-white/5">
              <p className="font-semibold">
                Scanned {scanResult.sources_scanned} source(s) → {scanResult.new_suggestions} new suggestion(s)
              </p>
              {scanResult.details.map((d, i) => (
                <p key={i} className="text-slate-500 dark:text-slate-400">
                  • {d}
                </p>
              ))}
            </div>
          )}
          <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
            💡 The scan reads readable text from each page and proposes machines for your approval — it never
            adds anything automatically. Quality depends on the source page. Add your favourite supplier
            news/product pages above.
          </p>
        </Card>
      </div>

      <div className="xl:col-span-3">
        <Card title="Pending Suggestions" subtitle="Review AI-discovered machines — approve to add them to the catalog">
          {!suggestions || suggestions.length === 0 ? (
            <EmptyState
              title="No pending suggestions"
              hint="Enable a source and click ‘Scan now’, or wait for the daily automatic scan."
            />
          ) : (
            <div className="space-y-3">
              {suggestions.map((s) => (
                <div key={s.id} className="rounded-2xl border border-white/40 p-3 dark:border-white/10">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-bold">{s.name}</h4>
                        <Badge tone="violet">{TYPE_LABELS[s.machine_type] ?? s.machine_type}</Badge>
                        <Badge tone={s.confidence >= 0.6 ? "green" : s.confidence >= 0.4 ? "amber" : "slate"}>
                          {Math.round(s.confidence * 100)}% confident
                        </Badge>
                        <Badge tone={s.method === "ai" ? "blue" : "slate"}>{s.method}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {[s.manufacturer, s.country, s.capacity, s.energy_kw ? `${s.energy_kw} kW` : "", s.estimated_price_usd ? `$${s.estimated_price_usd.toLocaleString()}` : ""]
                          .filter(Boolean)
                          .join(" · ") || "No extra details extracted"}
                      </p>
                      <p className="mt-1 line-clamp-2 text-[11px] italic text-slate-400">“{s.excerpt}”</p>
                      <a href={s.source_url} target="_blank" rel="noreferrer" className="text-[11px] font-semibold text-brand-600 hover:underline dark:text-brand-400">
                        source: {s.source_name} ↗
                      </a>
                    </div>
                    <div className="flex gap-2">
                      <button className="btn-primary !py-1.5 text-xs" onClick={() => approve.mutate(s.id)}>
                        ✓ Approve
                      </button>
                      <button className="btn-secondary !py-1.5 text-xs" onClick={() => reject.mutate(s.id)}>
                        ✕ Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function SourceManager({ sources }: { sources: IngestionSource[] | undefined }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");

  const add = useMutation({
    mutationFn: () => api.post("/machinery/sources", { name, url, active: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sources"] });
      setName("");
      setUrl("");
    },
  });
  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) =>
      api.patch(`/machinery/sources/${id}`, { active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sources"] }),
  });
  const del = useMutation({
    mutationFn: (id: number) => api.delete(`/machinery/sources/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sources"] }),
  });

  return (
    <div>
      <div className="space-y-2">
        {sources?.map((s) => (
          <div key={s.id} className="flex items-center gap-2 rounded-xl border border-white/40 p-2 text-xs dark:border-white/10">
            <button
              onClick={() => toggle.mutate({ id: s.id, active: !s.active })}
              className={`h-5 w-9 shrink-0 rounded-full transition ${s.active ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"}`}
              title={s.active ? "Active — click to pause" : "Paused — click to activate"}
            >
              <span className={`block h-4 w-4 rounded-full bg-white transition ${s.active ? "translate-x-4" : "translate-x-0.5"}`} />
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{s.name}</p>
              <p className="truncate text-[10px] text-slate-400">{s.url}</p>
              <p className="text-[10px] text-slate-400">last: {s.last_status}</p>
            </div>
            <button className="text-rose-400 hover:text-rose-600" onClick={() => del.mutate(s.id)}>
              🗑️
            </button>
          </div>
        ))}
        {(!sources || sources.length === 0) && <p className="text-xs text-slate-400">No sources yet.</p>}
      </div>
      <div className="mt-3 space-y-2 border-t border-white/30 pt-3 dark:border-white/10">
        <input className="input" placeholder="Source name (e.g. Gema news)" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="flex gap-2">
          <input className="input" placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} />
          <button className="btn-secondary" disabled={!name || !url || add.isPending} onClick={() => add.mutate()}>
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
