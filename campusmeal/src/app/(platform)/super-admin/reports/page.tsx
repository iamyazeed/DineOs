import { requireRole } from "@/lib/auth/guards";
import { getUniversitySummary } from "@/features/institutions/queries";
import { EmptyState, PageHeader, Panel } from "@/components/ui/primitives";
import { MealStatusPill } from "@/components/shared/status";
import { fmtDate, todayIn } from "@/lib/utils";

export default async function ConsumptionReports() {
  const ctx = await requireRole("super_admin");
  const { totals, rows } = await getUniversitySummary(ctx.supabase, todayIn("UTC"));
  const name = new Map(rows.map((r) => [r.id, r.name]));
  const list = [...totals].reverse().slice(0, 200);
  return (
    <>
      <PageHeader eyebrow="Last 14 days" title="Meal consumption reports" sub="Meal-by-meal figures for every institution." />
      <div className="mt-5" />
      <Panel>
        {list.length === 0 ? <EmptyState>No meals recorded.</EmptyState> : (
          <div className="tablewrap">
            <table className="data">
              <thead><tr><th>Institution</th><th>Date</th><th>Meal</th><th>Status</th><th className="num">Eligible</th><th className="num">Cancelled</th><th className="num">Absent</th><th className="num">Regular</th><th className="num">Separate</th></tr></thead>
              <tbody>
                {list.map((t) => (
                  <tr key={t.meal_id}>
                    <td>{name.get(t.institution_id)}</td><td>{fmtDate(t.meal_date)}</td><td>{t.meal_name}</td>
                    <td><MealStatusPill status={t.meal_status} /></td>
                    <td className="num">{t.eligible}</td><td className="num">{t.cancelled}</td><td className="num">{t.absent}</td>
                    <td className="num font-bold">{t.regular}</td><td className="num">{t.separate_portions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
