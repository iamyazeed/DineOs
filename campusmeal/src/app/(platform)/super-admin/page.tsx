import { requireRole } from "@/lib/auth/guards";
import { getUniversitySummary } from "@/features/institutions/queries";
import { ColumnChart, HBarChart } from "@/components/charts/bars";
import { PageHeader, Panel, StatCard } from "@/components/ui/primitives";
import { fmtDate, todayIn } from "@/lib/utils";

export default async function UniversityOverview() {
  const ctx = await requireRole("super_admin");
  const today = todayIn("UTC");
  const { from, totals, rows } = await getUniversitySummary(ctx.supabase, today);
  const byDay = new Map<string, number>();
  for (const t of totals) if (t.meal_status !== "cancelled") byDay.set(t.meal_date, (byDay.get(t.meal_date) ?? 0) + t.regular + t.separate_portions);
  return (
    <>
      <PageHeader eyebrow={`${fmtDate(from)} – ${fmtDate(today)}`} title="University overview" sub="All registered institutions. Figures are calculated from each institution's stored records." />
      {rows.some((r) => r.is_demo) && <div className="notice notice-warn mt-4 text-[13px]">Institutions marked (Demo) contain sample data.</div>}
      <div className="grid-stat">
        <StatCard label="Institutions" value={rows.length} hint={`${rows.filter((r) => r.active).length} active`} icon="building" tone="teal" />
        <StatCard label="Portions planned (14d)" value={rows.reduce((a, r) => a + r.portions, 0).toLocaleString()} icon="check" />
        <StatCard label="Cancellations (14d)" value={rows.reduce((a, r) => a + r.cancelled, 0)} icon="x" tone="bad" />
        <StatCard label="Preparation avoided" value={rows.reduce((a, r) => a + r.avoided, 0)} icon="leaf" tone="good" />
      </div>
      <div className="cols">
        <Panel title="Daily meal demand — all institutions">
          <ColumnChart rows={[...byDay.entries()].sort().map(([d, a]) => ({ label: fmtDate(d, { day: "numeric", month: "short" }), a }))} />
        </Panel>
        <Panel title="Consumption by institution">
          <HBarChart rows={rows.map((r) => ({ label: r.name, value: r.portions }))} />
        </Panel>
      </div>
    </>
  );
}
