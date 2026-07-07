import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import type { Batch } from "../api/types";
import FormulationPicker from "../components/FormulationPicker";
import { Badge, Card, Modal, PageHeader, Spinner, statusTone } from "../components/ui";
import { useAuth } from "../context/AuthContext";

export default function BatchesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["batches"],
    queryFn: () => api.get<Batch[]>("/batches"),
  });
  const [createOpen, setCreateOpen] = useState(false);
  const [qcBatch, setQcBatch] = useState<Batch | null>(null);

  const canManage =
    user && ["administrator", "senior_rd_manager", "production_manager"].includes(user.role);
  const canQC = canManage || user?.role === "qc_engineer";

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      api.patch(`/batches/${id}`, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["batches"] }),
  });

  return (
    <div>
      <PageHeader
        title="Production & Quality Control"
        subtitle="Batch tracking with QC test records"
        actions={
          canManage && (
            <button className="btn-primary" onClick={() => setCreateOpen(true)}>
              + New Batch
            </button>
          )
        }
      />

      {isLoading && <Spinner label="Loading batches…" />}

      <div className="space-y-4">
        {data?.map((b) => (
          <Card key={b.id}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-mono text-sm font-bold text-brand-600 dark:text-brand-400">
                  {b.batch_number}
                </p>
                <p className="text-xs text-slate-400">
                  {new Date(b.created_at).toLocaleDateString()} · {b.scale} · {b.size_kg} kg · $
                  {b.cost_total.toFixed(0)} material cost
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={statusTone(b.status)}>{b.status}</Badge>
                {canManage && (
                  <select
                    className="input !w-36 !py-1 text-xs"
                    value={b.status}
                    onChange={(e) => setStatus.mutate({ id: b.id, status: e.target.value })}
                  >
                    {["planned", "in_progress", "completed", "on_hold", "failed"].map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                )}
                {canQC && (
                  <button className="btn-secondary !py-1 text-xs" onClick={() => setQcBatch(b)}>
                    + QC Test
                  </button>
                )}
              </div>
            </div>
            {b.qc_records.length > 0 && (
              <div className="mt-3 overflow-x-auto">
                <table className="table-base">
                  <thead>
                    <tr>
                      <th>Test</th>
                      <th className="text-right">Value</th>
                      <th>Result</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {b.qc_records.map((q) => (
                      <tr key={q.id}>
                        <td>{q.test_name}</td>
                        <td className="text-right font-mono">
                          {q.value != null ? `${q.value} ${q.unit}` : "—"}
                        </td>
                        <td>
                          <Badge tone={statusTone(q.result)}>{q.result}</Badge>
                        </td>
                        <td className="text-xs text-slate-500">{q.notes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        ))}
      </div>

      <CreateBatchModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <QCModal batch={qcBatch} onClose={() => setQcBatch(null)} />
    </div>
  );
}

function CreateBatchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [fid, setFid] = useState<number | null>(null);
  const [sizeKg, setSizeKg] = useState(500);
  const [scale, setScale] = useState("production");

  const create = useMutation({
    mutationFn: () => api.post("/batches", { formulation_id: fid, size_kg: sizeKg, scale }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["batches"] });
      onClose();
    },
  });

  return (
    <Modal open={open} onClose={onClose} title="New Production Batch">
      <div className="space-y-3">
        <FormulationPicker value={fid} onChange={setFid} />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Size (kg)</label>
            <input type="number" className="input" value={sizeKg} onChange={(e) => setSizeKg(Number(e.target.value))} />
          </div>
          <div>
            <label className="label">Scale</label>
            <select className="input" value={scale} onChange={(e) => setScale(e.target.value)}>
              {["laboratory", "pilot", "production", "factory"].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>
        {create.error && <p className="text-xs text-rose-500">{(create.error as Error).message}</p>}
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" disabled={fid == null || create.isPending} onClick={() => create.mutate()}>
            Create Batch
          </button>
        </div>
      </div>
    </Modal>
  );
}

function QCModal({ batch, onClose }: { batch: Batch | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ test_name: "", value: "", unit: "", result: "pass", notes: "" });

  const add = useMutation({
    mutationFn: () =>
      api.post(`/batches/${batch!.id}/qc`, {
        ...form,
        value: form.value ? Number(form.value) : null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["batches"] });
      setForm({ test_name: "", value: "", unit: "", result: "pass", notes: "" });
      onClose();
    },
  });

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Modal open={!!batch} onClose={onClose} title={`QC Record — ${batch?.batch_number ?? ""}`}>
      <div className="space-y-3">
        <div>
          <label className="label">Test name</label>
          <input className="input" value={form.test_name} onChange={(e) => set("test_name", e.target.value)} placeholder="Gloss 60° / Gel time / Impact…" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label">Value</label>
            <input type="number" className="input" value={form.value} onChange={(e) => set("value", e.target.value)} />
          </div>
          <div>
            <label className="label">Unit</label>
            <input className="input" value={form.unit} onChange={(e) => set("unit", e.target.value)} placeholder="GU, s, µm…" />
          </div>
          <div>
            <label className="label">Result</label>
            <select className="input" value={form.result} onChange={(e) => set("result", e.target.value)}>
              <option value="pass">pass</option>
              <option value="fail">fail</option>
            </select>
          </div>
        </div>
        <div>
          <label className="label">Notes</label>
          <input className="input" value={form.notes} onChange={(e) => set("notes", e.target.value)} />
        </div>
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" disabled={!form.test_name || add.isPending} onClick={() => add.mutate()}>
            Save Record
          </button>
        </div>
      </div>
    </Modal>
  );
}
