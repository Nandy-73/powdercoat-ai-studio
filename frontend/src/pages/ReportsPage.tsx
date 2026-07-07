import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api, downloadCsv } from "../api/client";
import FormulationPicker from "../components/FormulationPicker";
import { Badge, Card, PageHeader, ScoreBar, statusTone } from "../components/ui";

const CSV_REPORTS = [
  { path: "/reports/materials.csv", file: "materials_report.csv", label: "Material Report", desc: "Full raw-material database with costs and suppliers", icon: "🧱" },
  { path: "/reports/formulations.csv", file: "formulations_report.csv", label: "Formulation Report", desc: "All formulations with systems, status and cost/kg", icon: "🧪" },
  { path: "/reports/production.csv", file: "production_report.csv", label: "Production Report", desc: "Batches with size, status, scale and cost", icon: "🏭" },
  { path: "/reports/suppliers.csv", file: "suppliers_report.csv", label: "Supplier Report", desc: "Supplier directory with ratings and lead times", icon: "🌐" },
];

export default function ReportsPage() {
  const [fid, setFid] = useState<number | null>(null);
  const [report, setReport] = useState<any>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  const generate = useMutation({
    mutationFn: () => api.get<any>(`/reports/formulation/${fid}`),
    onSuccess: setReport,
  });

  const download = async (path: string, file: string) => {
    setDownloading(path);
    try {
      await downloadCsv(path, file);
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Reports"
        subtitle="Excel-compatible CSV exports and full formulation dossiers (print to PDF)"
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {CSV_REPORTS.map((r) => (
          <Card key={r.path}>
            <p className="text-2xl">{r.icon}</p>
            <h3 className="mt-2 font-bold">{r.label}</h3>
            <p className="mt-1 min-h-[2.5rem] text-xs text-slate-400">{r.desc}</p>
            <button
              className="btn-secondary mt-3 w-full text-xs"
              disabled={downloading === r.path}
              onClick={() => download(r.path, r.file)}
            >
              {downloading === r.path ? "Downloading…" : "⬇ Download CSV (Excel)"}
            </button>
          </Card>
        ))}
      </div>

      <div className="mt-8">
        <Card
          title="Formulation Dossier"
          subtitle="Complete technical report: composition, cost, validation, predictions and trials. Use the browser's Print → PDF for a distributable document."
          actions={
            <div className="flex items-center gap-2">
              <div className="w-72">
                <FormulationPicker value={fid} onChange={setFid} label="" />
              </div>
              <button className="btn-primary" disabled={fid == null || generate.isPending} onClick={() => generate.mutate()}>
                {generate.isPending ? "Generating…" : "Generate"}
              </button>
              {report && (
                <button className="btn-secondary" onClick={() => window.print()}>
                  🖨 Print / PDF
                </button>
              )}
            </div>
          }
        >
          {!report && (
            <p className="py-10 text-center text-sm text-slate-400">
              Select a formulation and generate its full dossier.
            </p>
          )}
          {report && <Dossier report={report} />}
        </Card>
      </div>
    </div>
  );
}

function Dossier({ report }: { report: any }) {
  const f = report.formulation;
  return (
    <div className="space-y-6 print:text-black">
      <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-lg font-extrabold">
              {f.code} — {f.name}
            </h3>
            <p className="text-xs text-slate-400">{f.description}</p>
          </div>
          <div className="flex gap-2">
            <Badge tone="violet">{f.system}</Badge>
            <Badge tone={statusTone(f.status)}>{f.status}</Badge>
            <Badge tone="blue">{f.cure}</Badge>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h4 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">Cost breakdown</h4>
          <table className="table-base">
            <tbody>
              {report.cost.lines.map((l: any) => (
                <tr key={l.material}>
                  <td>{l.material}</td>
                  <td className="text-right font-mono">{l.pct}%</td>
                  <td className="text-right font-mono">${l.cost}</td>
                </tr>
              ))}
              <tr className="font-bold">
                <td>Material cost / kg</td>
                <td colSpan={2} className="text-right font-mono">
                  ${report.cost.material_cost_per_kg}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div>
          <h4 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">AI validation</h4>
          <ScoreBar score={report.validation.score} label={`Score (${report.validation.verdict})`} />
          <ul className="mt-3 space-y-1.5 text-xs">
            {report.validation.issues.map((i: any, idx: number) => (
              <li key={idx}>
                <Badge tone={statusTone(i.severity)}>{i.severity}</Badge> {i.message}
              </li>
            ))}
            {report.validation.issues.length === 0 && <li>✓ No issues detected.</li>}
          </ul>
        </div>

        <div>
          <h4 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">Predicted finish</h4>
          <p className="text-sm">
            <b>{report.finish_prediction.gloss_60deg} GU</b> ({report.finish_prediction.gloss_category}) —{" "}
            {report.finish_prediction.finish_type.replace("_", " ")}
          </p>
          <p className="mt-1 text-xs text-slate-400">{report.finish_prediction.film_appearance}</p>
          <h4 className="mb-2 mt-4 text-sm font-bold uppercase tracking-wide text-slate-500">
            Manufacturing
          </h4>
          <p className="text-xs">Cure: {report.manufacturing.recommended_cure_schedule}</p>
          <p className="text-xs">d₅₀: {report.manufacturing.particle_size_d50_um} µm · Film: {report.manufacturing.recommended_film_thickness_um} µm</p>
        </div>

        <div>
          <h4 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">
            Mechanical panel
          </h4>
          <div className="space-y-2">
            {Object.entries(report.mechanical_prediction).map(([k, v]: [string, any]) => (
              <ScoreBar key={k} score={v.score} label={k.replace(/_/g, " ")} />
            ))}
          </div>
        </div>
      </div>

      {report.trials.length > 0 && (
        <div>
          <h4 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">Trial history</h4>
          <table className="table-base">
            <thead>
              <tr>
                <th>Date</th>
                <th>Result</th>
                <th className="text-right">Gloss</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {report.trials.map((t: any, i: number) => (
                <tr key={i}>
                  <td className="text-xs">{new Date(t.date).toLocaleDateString()}</td>
                  <td>
                    <Badge tone={statusTone(t.result)}>{t.result}</Badge>
                  </td>
                  <td className="text-right font-mono">{t.gloss ?? "—"}</td>
                  <td className="text-xs">{t.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
