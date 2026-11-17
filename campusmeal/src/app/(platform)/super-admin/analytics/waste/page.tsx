import { requireRole } from "@/lib/auth/guards";
import { getUniversitySummary } from "@/features/institutions/queries";
import { HBarChart } from "@/components/charts/bars";
import { WasteNotAvailable } from "@/components/shared/waste-notice";
import { PageHeader, Panel } from "@/components/ui/primitives";
import { todayIn } from "@/lib/utils";

export default async function WasteAnalytics() {
  const ctx = await requireRole("super_admin");
  const { rows } = await getUniversitySummary(ctx.supabase, todayIn("UTC"));
  return (
    <>
      <PageHeader eyebrow="Sustainability" title="Food waste analytics" />
      <div className="mt-5" />
      <WasteNotAvailable />
      <div className="mt-4" />
      <Panel title="Avoided preparation by institution (14 days)" sub="Real figure: portions not cooked due to cancellations/absences">
        <HBarChart rows={rows.map((r) => ({ label: r.name, value: r.avoided }))} />
      </Panel>
    </>
  );
}
