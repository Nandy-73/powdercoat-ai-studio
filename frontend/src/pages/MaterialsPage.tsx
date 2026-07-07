import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import type { Material, MaterialCategory } from "../api/types";
import { useMaterials, CATEGORY_LABELS } from "../api/hooks";
import { Badge, Card, EmptyState, ErrorState, Modal, PageHeader, Spinner } from "../components/ui";
import { useAuth } from "../context/AuthContext";

const CATEGORY_TONES: Record<string, string> = {
  resin: "blue",
  hardener: "violet",
  pigment: "amber",
  filler: "slate",
  flow_agent: "green",
  benzoin: "green",
  degassing_agent: "green",
  texture_additive: "red",
  special_additive: "violet",
  wax: "slate",
};

export default function MaterialsPage() {
  const { user } = useAuth();
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Material | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const { data, isLoading, error } = useMaterials(category || undefined, search || undefined);

  const canEdit =
    user &&
    ["administrator", "senior_rd_manager", "rd_engineer", "procurement_manager"].includes(user.role);

  return (
    <div>
      <PageHeader
        title="Material Database"
        subtitle="Resins, hardeners, pigments, fillers and additives with full technical, cost and safety data"
        actions={
          <>
            <select className="input !w-44" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">All categories</option>
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <input
              className="input !w-56"
              placeholder="Search name, code, family…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {canEdit && (
              <button className="btn-primary" onClick={() => setCreateOpen(true)}>
                + New Material
              </button>
            )}
          </>
        }
      />

      {isLoading && <Spinner label="Loading materials…" />}
      {error && <ErrorState message={(error as Error).message} />}
      {data && data.length === 0 && <EmptyState title="No materials match your filter" />}

      {data && data.length > 0 && (
        <Card>
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Material</th>
                  <th>Category</th>
                  <th>Chemical Family</th>
                  <th className="text-right">Density</th>
                  <th className="text-right">Cost/kg</th>
                  <th>Supplier</th>
                  <th>Country</th>
                </tr>
              </thead>
              <tbody>
                {data.map((m) => (
                  <tr key={m.id} className="cursor-pointer" onClick={() => setSelected(m)}>
                    <td className="font-mono text-xs">{m.code}</td>
                    <td className="font-medium">{m.name}</td>
                    <td>
                      <Badge tone={CATEGORY_TONES[m.category]}>{CATEGORY_LABELS[m.category]}</Badge>
                    </td>
                    <td className="text-xs text-slate-500">{m.chemical_family}</td>
                    <td className="text-right font-mono text-xs">{m.density_g_cm3.toFixed(2)}</td>
                    <td className="text-right font-mono">
                      ${m.cost_per_kg.toFixed(2)}
                    </td>
                    <td className="text-xs">{m.supplier_name}</td>
                    <td className="text-xs">{m.country}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.name ?? ""} wide>
        {selected && (
          <div className="grid gap-4 md:grid-cols-2">
            <Detail label="Code" value={selected.code} mono />
            <Detail label="Category" value={CATEGORY_LABELS[selected.category]} />
            <Detail label="Chemical family" value={selected.chemical_family} />
            <Detail label="Density" value={`${selected.density_g_cm3} g/cm³`} mono />
            <Detail label="Cost" value={`${selected.cost_per_kg} ${selected.currency}/kg`} mono />
            <Detail label="Supplier" value={`${selected.supplier_name} (${selected.country})`} />
            <div className="md:col-span-2">
              <Detail label="Function" value={selected.function} />
            </div>
            <div className="md:col-span-2">
              <Detail label="Safety information" value={selected.safety_info} />
            </div>
            <div className="flex gap-3 md:col-span-2">
              <a className="btn-secondary text-xs" href={selected.tds_url} target="_blank" rel="noreferrer">
                📄 Technical Data Sheet
              </a>
              <a className="btn-secondary text-xs" href={selected.sds_url} target="_blank" rel="noreferrer">
                ⚠️ Safety Data Sheet
              </a>
            </div>
          </div>
        )}
      </Modal>

      <CreateMaterialModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="label">{label}</p>
      <p className={`text-sm ${mono ? "font-mono" : ""}`}>{value || "—"}</p>
    </div>
  );
}

function CreateMaterialModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: "",
    code: "",
    category: "resin" as MaterialCategory,
    chemical_family: "",
    function: "",
    density_g_cm3: 1.0,
    cost_per_kg: 0,
    supplier_name: "",
    country: "",
    safety_info: "",
  });
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () => api.post("/materials", form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["materials"] });
      onClose();
    },
    onError: (e: Error) => setError(e.message),
  });

  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Modal open={open} onClose={onClose} title="New Material" wide>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="label">Name</label>
          <input className="input" value={form.name} onChange={(e) => set("name", e.target.value)} />
        </div>
        <div>
          <label className="label">Code</label>
          <input className="input" value={form.code} onChange={(e) => set("code", e.target.value)} />
        </div>
        <div>
          <label className="label">Category</label>
          <select className="input" value={form.category} onChange={(e) => set("category", e.target.value)}>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Chemical family</label>
          <input className="input" value={form.chemical_family} onChange={(e) => set("chemical_family", e.target.value)} />
        </div>
        <div>
          <label className="label">Density (g/cm³)</label>
          <input type="number" step="0.01" className="input" value={form.density_g_cm3} onChange={(e) => set("density_g_cm3", Number(e.target.value))} />
        </div>
        <div>
          <label className="label">Cost per kg (USD)</label>
          <input type="number" step="0.01" className="input" value={form.cost_per_kg} onChange={(e) => set("cost_per_kg", Number(e.target.value))} />
        </div>
        <div>
          <label className="label">Supplier</label>
          <input className="input" value={form.supplier_name} onChange={(e) => set("supplier_name", e.target.value)} />
        </div>
        <div>
          <label className="label">Country</label>
          <input className="input" value={form.country} onChange={(e) => set("country", e.target.value)} />
        </div>
        <div className="md:col-span-2">
          <label className="label">Function</label>
          <input className="input" value={form.function} onChange={(e) => set("function", e.target.value)} />
        </div>
        <div className="md:col-span-2">
          <label className="label">Safety information</label>
          <input className="input" value={form.safety_info} onChange={(e) => set("safety_info", e.target.value)} />
        </div>
      </div>
      {error && <p className="mt-3 text-xs text-rose-500">{error}</p>}
      <div className="mt-5 flex justify-end gap-2">
        <button className="btn-secondary" onClick={onClose}>
          Cancel
        </button>
        <button
          className="btn-primary"
          disabled={!form.name || !form.code || create.isPending}
          onClick={() => create.mutate()}
        >
          {create.isPending ? "Creating…" : "Create Material"}
        </button>
      </div>
    </Modal>
  );
}
