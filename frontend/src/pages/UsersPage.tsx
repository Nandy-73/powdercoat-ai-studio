import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import type { Role, User } from "../api/types";
import { Badge, Card, ErrorState, Modal, PageHeader, Spinner } from "../components/ui";
import { useAuth } from "../context/AuthContext";

const ROLES: { value: Role; label: string }[] = [
  { value: "administrator", label: "Administrator" },
  { value: "senior_rd_manager", label: "Senior R&D Manager" },
  { value: "rd_engineer", label: "R&D Engineer" },
  { value: "color_matching_engineer", label: "Color Matching Engineer" },
  { value: "production_manager", label: "Production Manager" },
  { value: "qc_engineer", label: "QC Engineer" },
  { value: "procurement_manager", label: "Procurement Manager" },
  { value: "sales_manager", label: "Sales Manager" },
  { value: "viewer", label: "Viewer" },
];

export default function UsersPage() {
  const { user: me } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = me?.role === "administrator";
  const canView = isAdmin || me?.role === "senior_rd_manager";

  const { data, isLoading, error } = useQuery({
    queryKey: ["users"],
    queryFn: () => api.get<User[]>("/users"),
    enabled: !!canView,
  });
  const [createOpen, setCreateOpen] = useState(false);

  const update = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Record<string, unknown> }) =>
      api.patch(`/users/${id}`, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });

  if (!canView) {
    return (
      <div>
        <PageHeader title="Users & Roles" />
        <ErrorState message="Only administrators and senior R&D managers can view user management." />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Users & Roles"
        subtitle="Role-based access: 9 industrial roles from Administrator to Viewer"
        actions={
          isAdmin && (
            <button className="btn-primary" onClick={() => setCreateOpen(true)}>
              + New User
            </button>
          )
        }
      />

      {isLoading && <Spinner label="Loading users…" />}
      {error && <ErrorState message={(error as Error).message} />}

      {data && (
        <Card>
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  {isAdmin && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {data.map((u) => (
                  <tr key={u.id}>
                    <td className="font-medium">{u.full_name}</td>
                    <td className="text-xs text-slate-500">{u.email}</td>
                    <td>
                      {isAdmin ? (
                        <select
                          className="input !w-52 !py-1 text-xs"
                          value={u.role}
                          onChange={(e) => update.mutate({ id: u.id, body: { role: e.target.value } })}
                        >
                          {ROLES.map((r) => (
                            <option key={r.value} value={r.value}>
                              {r.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <Badge tone="blue">{ROLES.find((r) => r.value === u.role)?.label}</Badge>
                      )}
                    </td>
                    <td>
                      <Badge tone={u.is_active ? "green" : "red"}>
                        {u.is_active ? "active" : "disabled"}
                      </Badge>
                    </td>
                    {isAdmin && (
                      <td>
                        <button
                          className="text-xs font-semibold text-brand-600 hover:underline dark:text-brand-400"
                          onClick={() => update.mutate({ id: u.id, body: { is_active: !u.is_active } })}
                        >
                          {u.is_active ? "Disable" : "Enable"}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <CreateUserModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

function CreateUserModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ email: "", full_name: "", password: "", role: "viewer" as Role });
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: () => api.post("/users", form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      onClose();
    },
    onError: (e: Error) => setError(e.message),
  });

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Modal open={open} onClose={onClose} title="New User">
      <div className="space-y-3">
        <div>
          <label className="label">Full name</label>
          <input className="input" value={form.full_name} onChange={(e) => set("full_name", e.target.value)} />
        </div>
        <div>
          <label className="label">Email</label>
          <input type="email" className="input" value={form.email} onChange={(e) => set("email", e.target.value)} />
        </div>
        <div>
          <label className="label">Password</label>
          <input type="password" className="input" value={form.password} onChange={(e) => set("password", e.target.value)} />
        </div>
        <div>
          <label className="label">Role</label>
          <select className="input" value={form.role} onChange={(e) => set("role", e.target.value)}>
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        {error && <p className="text-xs text-rose-500">{error}</p>}
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-primary"
            disabled={!form.email || !form.password || !form.full_name || create.isPending}
            onClick={() => create.mutate()}
          >
            Create User
          </button>
        </div>
      </div>
    </Modal>
  );
}
