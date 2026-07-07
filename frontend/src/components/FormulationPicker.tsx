import { useFormulations, SYSTEM_LABELS } from "../api/hooks";

export default function FormulationPicker({
  value,
  onChange,
  label = "Formulation",
}: {
  value: number | null;
  onChange: (id: number | null) => void;
  label?: string;
}) {
  const { data } = useFormulations();
  return (
    <div>
      <label className="label">{label}</label>
      <select
        className="input"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      >
        <option value="">Select a formulation…</option>
        {data?.map((f) => (
          <option key={f.id} value={f.id}>
            {f.code} — {f.name} ({SYSTEM_LABELS[f.system] ?? f.system})
          </option>
        ))}
      </select>
    </div>
  );
}
