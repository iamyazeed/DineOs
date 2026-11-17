import { requireRole } from "@/lib/auth/guards";
import { getUniversitySummary } from "@/features/institutions/queries";
import { HBarChart } from "@/components/charts/bars";
import { PageHeader, Panel } from "@/components/ui/primitives";
import { pct, todayIn } from "@/lib/utils";

export default async function InstitutionalAnalytics() {
  const ctx = await requireRole("super_admin");
  const { rows } = await getUniversitySummary(ctx.supabase, todayIn("UTC"));
  return (
    <>
      <PageHeader eyebrow="Last 14 days" title="Institutional analytics" sub="Compare meal demand and operational performance across institutions." />
      <div className="mt-5" />
      <div className="cols-2">
        <Panel title="Portions per meal served"><HBarChart rows={rows.map((r) => ({ label: r.name, value: r.meals ? Math.round(r.portions / r.meals) : 0 }))} /></Panel>
        <Panel title="Cancellation rate"><HBarChart unit="%" rows={rows.map((r) => ({ label: r.name, value: pct(r.cancelled, r.eligible) }))} /></Panel>
        <Panel title="Teacher-reported absences"><HBarChart rows={rows.map((r) => ({ label: r.name, value: r.absent }))} /></Panel>
        <Panel title="Preparation avoided (portions)"><HBarChart rows={rows.map((r) => ({ label: r.name, value: r.avoided }))} /></Panel>
      </div>
    </>
  );
}
