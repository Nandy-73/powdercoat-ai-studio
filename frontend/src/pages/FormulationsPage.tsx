import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import type { ChemistrySystem, Formulation } from "../api/types";
import { useFormulations, useMaterials, CATEGORY_LABELS, SYSTEM_LABELS } from "../api/hooks";
import { Badge, Card, EmptyState, ErrorState, Modal, PageHeader, Spinner, statusTone } from "../components/ui";

interface DraftItem {
  material_id: number;
  weight_kg: number;
}

export default function FormulationsPage() {
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const { data, isLoading, error } = useFormulations(search || undefined);

  return (
    <div>
      <PageHeader
        title="Smart Formulation Builder"
        subtitle="Epoxy, polyester, hybrid, polyurethane, acrylic and custom systems with automatic formulation mathematics"
        actions={
          <>
            <input
              className="input !w-64"
              placeholder="Search by name or code…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button className="btn-primary" onClick={() => setCreateOpen(true)}>
              + New Formulation
            </button>
          </>
        }
      />

      {isLoading && <Spinner label="Loading formulations…" />}
      {error && <ErrorState message={(error as Error).message} />}

      {data && data.length === 0 && (
        <EmptyState title="No formulations found" hint="Create your first formulation to get started." />
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {data?.map((f) => (
          <FormulationCard key={f.id} formulation={f} />
        ))}
      </div>

      <CreateFormulationModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

function FormulationCard({ formulation: f }: { formulation: Formulation }) {
  return (
    <Link to={`/formulations/${f.id}`}>
      <Card hover className="h-full">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-mono font-semibold text-brand-600 dark:text-brand-400">{f.code}</p>
            <h3 className="mt-0.5 font-bold text-slate-900 dark:text-white">{f.name}</h3>
          </div>
          <Badge tone={statusTone(f.status)}>{f.status}</Badge>
        </div>
        <p className="mt-2 line-clamp-2 min-h-[2rem] text-xs text-slate-500 dark:text-slate-400">
          {f.description || "No description"}
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <Badge tone="violet">{SYSTEM_LABELS[f.system]}</Badge>
          <Badge tone="slate">{f.items.length} components</Badge>
          <Badge tone="blue">
            {f.cure_time_min.toFixed(0)}′ @ {f.cure_temp_c.toFixed(0)}°C
          </Badge>
        </div>
      </Card>
    </Link>
  );
}

function CreateFormulationModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: materials } = useMaterials();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [system, setSystem] = useState<ChemistrySystem>("polyester");
  const [description, setDescription] = useState("");
  const [cureTemp, setCureTemp] = useState(180);
  const [cureTime, setCureTime] = useState(10);
  const [items, setItems] = useState<DraftItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const materialById = useMemo(() => {
    const map = new Map<number, { name: string; category: string; cost: number }>();
    materials?.forEach((m) => map.set(m.id, { name: m.name, category: m.category, cost: m.cost_per_kg }));
    return map;
  }, [materials]);

  const total = items.reduce((s, i) => s + (i.weight_kg || 0), 0);

  const create = useMutation({
    mutationFn: () =>
      api.post<Formulation>("/formulations", {
        name,
        code,
        system,
        description,
        cure_temp_c: cureTemp,
        cure_time_min: cureTime,
        items: items.filter((i) => i.material_id && i.weight_kg > 0),
      }),
    onSuccess: (f) => {
      queryClient.invalidateQueries({ queryKey: ["formulations"] });
      onClose();
      navigate(`/formulations/${f.id}`);
    },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <Modal open={open} onClose={onClose} title="New Formulation" wide>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="label">Name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="RAL 9016 Architectural White" />
        </div>
        <div>
          <label className="label">Code</label>
          <input className="input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="PC-PE-9016" />
        </div>
        <div>
          <label className="label">Chemistry System</label>
          <select className="input" value={system} onChange={(e) => setSystem(e.target.value as ChemistrySystem)}>
            {Object.entries(SYSTEM_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Cure Temp (°C)</label>
            <input type="number" className="input" value={cureTemp} onChange={(e) => setCureTemp(Number(e.target.value))} />
          </div>
          <div>
            <label className="label">Cure Time (min)</label>
            <input type="number" className="input" value={cureTime} onChange={(e) => setCureTime(Number(e.target.value))} />
          </div>
        </div>
        <div className="md:col-span-2">
          <label className="label">Description</label>
          <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Application, substrate, standard…" />
        </div>
      </div>

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between">
          <label className="label !mb-0">Raw Materials — total {total.toFixed(2)} kg</label>
          <button
            className="btn-secondary !px-2.5 !py-1 text-xs"
            onClick={() => setItems([...items, { material_id: 0, weight_kg: 0 }])}
          >
            + Add material
          </button>
        </div>
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
                    [{CATEGORY_LABELS[m.category]}] {m.name} — ${m.cost_per_kg}/kg
                  </option>
                ))}
              </select>
              <input
                type="number"
                step="0.1"
                min="0"
                className="input !w-28"
                placeholder="kg"
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
                aria-label="Remove"
              >
                ✕
              </button>
            </div>
          ))}
          {items.length === 0 && (
            <p className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-xs text-slate-400 dark:border-slate-700">
              Add resin, hardener, pigments, fillers and additives. You can also create the formulation empty
              and build it on the detail page.
            </p>
          )}
        </div>
      </div>

      {error && <p className="mt-3 text-xs font-medium text-rose-500">{error}</p>}

      <div className="mt-5 flex justify-end gap-2">
        <button className="btn-secondary" onClick={onClose}>
          Cancel
        </button>
        <button
          className="btn-primary"
          disabled={!name || !code || create.isPending}
          onClick={() => create.mutate()}
        >
          {create.isPending ? "Creating…" : "Create Formulation"}
        </button>
      </div>
    </Modal>
  );
}
