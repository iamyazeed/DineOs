import { requireRole } from "@/lib/auth/guards";
import { getDayMeals, getMealBreakdown, getMealTotals } from "@/features/meals/queries";
import { ColumnChart, HBarChart } from "@/components/charts/bars";
import { BucketTable } from "@/components/shared/breakdown";
import { WasteNotAvailable } from "@/components/shared/waste-notice";
import { PageHeader, Panel, StatCard } from "@/components/ui/primitives";
import { addDays, fmtDate, pct, todayIn } from "@/lib/utils";

export default async function AdminAnalytics() {
  const ctx = await requireRole("institution_admin");
  const inst = ctx.institution!;
  const db = ctx.supabase;
  const today = todayIn(inst.timezone);
  const from = addDays(today, -13);
  const [totals, todayMeals, prep, missing, sfr] = await Promise.all([
    getMealTotals(db, from, today, inst.id),
    getDayMeals(db, inst, today),
    db.from("preparation_tasks").select("status, meal:meals!inner(meal_date)").eq("institution_id", inst.id).gte("meal.meal_date", from).lte("meal.meal_date", today),
    db.from("missing_meal_reports").select("portions_missing, created_at").eq("institution_id", inst.id).gte("created_at", `${from}T00:00:00Z`),
    db.from("separate_food_requests").select("status, portions, meal:meals!inner(meal_date)").eq("institution_id", inst.id).gte("meal.meal_date", from).lte("meal.meal_date", today),
  ]);
  const breakdowns = await Promise.all(todayMeals.map((m) => getMealBreakdown(db, inst, m)));
  const active = totals.filter((t) => t.meal_status !== "cancelled");
  const served = active.reduce((a, t) => a + t.regular + t.separate_portions, 0);
  const eligible = active.reduce((a, t) => a + t.eligible, 0);
  const cancelled = active.reduce((a, t) => a + t.cancelled, 0);
  const absent = active.reduce((a, t) => a + t.absent, 0);
  const avoided = active.reduce((a, t) => a + t.excluded, 0);
  const byDay = new Map<string, { a: number; b: number }>();
  for (const t of totals) {
    const d = byDay.get(t.meal_date) ?? { a: 0, b: 0 };
    d.a += t.regular + t.separate_portions;
    d.b += t.excluded;
    byDay.set(t.meal_date, d);
  }
  const byMeal = new Map<string, number>();
  for (const t of active) byMeal.set(t.meal_name, (byMeal.get(t.meal_name) ?? 0) + t.cancelled);
  const prepRows = prep.data ?? [];
  const delayed = prepRows.filter((p) => p.status === "delayed").length;
  const sfrRows = sfr.data ?? [];
  const lunchIdx = Math.max(0, todayMeals.findIndex((m) => m.status !== "cancelled"));
  return (
    <>
      <PageHeader eyebrow="Reports & analytics" title="Institution analytics" sub={`Last 14 days · ${fmtDate(from)} – ${fmtDate(today)}. Calculated from stored meal, cancellation and attendance records.`} />
      {inst.is_demo && <div className="notice notice-warn mt-4 text-[13px]">This institution contains demonstration (sample) data.</div>}
      <div className="grid-stat">
        <StatCard label="Portions planned" value={served.toLocaleString()} hint={`${active.length} meals served`} icon="check" />
        <StatCard label="Cancellation rate" value={`${pct(cancelled, eligible)}%`} hint={`${cancelled} student cancellations`} icon="x" tone="bad" />
        <StatCard label="Reported absences" value={absent} hint="Teacher-reported, not double-counted" icon="users" tone="teal" />
        <StatCard label="Preparation avoided" value={avoided.toLocaleString()} hint="Portions not cooked for absent students" icon="leaf" tone="good" />
      </div>
      <Panel title="Daily portions vs. not attending" sub="Amber: portions planned · Teal: students not attending">
        <ColumnChart rows={[...byDay.entries()].map(([d, v]) => ({ label: fmtDate(d, { day: "numeric", month: "short" }), a: v.a, b: v.b, title: `${d}: ${v.a} planned, ${v.b} not attending` }))} />
      </Panel>
      <div className="cols-2">
        <Panel title="Cancellations by meal" sub="Last 14 days">
          <HBarChart rows={[...byMeal.entries()].map(([label, value]) => ({ label, value }))} />
        </Panel>
        <Panel title="Operational performance" sub="Last 14 days">
          <div className="kv">
            <span>Meals with kitchen updates</span>
            <span>{prepRows.length}</span>
          </div>
          <div className="kv">
            <span>Delayed meals</span>
            <span>
              {delayed} ({pct(delayed, prepRows.length)}%)
            </span>
          </div>
          <div className="kv">
            <span>Missing-meal reports</span>
            <span>
              {(missing.data ?? []).length} ({(missing.data ?? []).reduce((a, m) => a + m.portions_missing, 0)} portions)
            </span>
          </div>
          <div className="kv">
            <span>Separate food requests</span>
            <span>
              {sfrRows.length} · {sfrRows.filter((r) => r.status === "approved").length} approved
            </span>
          </div>
          <div className="kv">
            <span>Separate portions approved</span>
            <span>{sfrRows.filter((r) => r.status === "approved").reduce((a, r) => a + r.portions, 0)}</span>
          </div>
        </Panel>
      </div>
      {breakdowns[lunchIdx] && (
        <div className="cols-2">
          <Panel title={`Class-wise — ${todayMeals[lunchIdx].schedule.name} today`}>
            <BucketTable rows={breakdowns[lunchIdx].byClass} labelHeader="Class" />
          </Panel>
          <Panel title={`Hall-wise — ${todayMeals[lunchIdx].schedule.name} today`}>
            <BucketTable rows={breakdowns[lunchIdx].byHall} labelHeader="Hall" />
          </Panel>
        </div>
      )}
      <Panel title="Food waste">
        <WasteNotAvailable />
      </Panel>
    </>
  );
}
