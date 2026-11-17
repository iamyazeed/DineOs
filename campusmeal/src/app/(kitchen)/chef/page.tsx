import Link from "next/link";
import { requireRole } from "@/lib/auth/guards";
import { getDayMeals, getMealBreakdown } from "@/features/meals/queries";
import { getMissingReports } from "@/features/distribution/queries";
import { PrepCard } from "@/components/shared/prep-form";
import { MissingReportList } from "@/components/shared/missing-reports";
import { AnnouncementsFeed } from "@/components/shared/announcements-feed";
import { EmptyState, PageHeader, Panel, StatCard } from "@/components/ui/primitives";
import { fmtDate, todayIn } from "@/lib/utils";

export default async function ChefOverview() {
  const ctx = await requireRole("chef");
  const inst = ctx.institution!;
  const db = ctx.supabase;
  const today = todayIn(inst.timezone);
  const meals = await getDayMeals(db, inst, today);
  const [breakdowns, missing, ksr] = await Promise.all([
    Promise.all(meals.map((m) => getMealBreakdown(db, inst, m))),
    getMissingReports(db, inst.id, 10),
    db.from("kitchen_service_requests").select("id", { count: "exact", head: true }).eq("institution_id", inst.id).in("status", ["open", "approved", "in_progress"]),
  ]);
  const openMissing = missing.filter((m) => m.status !== "resolved");
  return (
    <>
      <PageHeader eyebrow={fmtDate(today, { weekday: "long", day: "numeric", month: "long" })} title="Kitchen overview" sub="Approved counts update automatically as students cancel and teachers report absences." />
      <div className="grid-stat">
        <StatCard label="Regular portions today" value={breakdowns.reduce((a, b) => a + b.regular, 0)} icon="check" />
        <StatCard label="Separate portions today" value={breakdowns.reduce((a, b) => a + b.separatePortions, 0)} hint="Approved by admin" icon="star" tone="good" />
        <StatCard label="Missing-meal reports" value={openMissing.length} hint="From teachers, unresolved" icon="alert" tone="bad" />
        <StatCard label="Service requests active" value={ksr.count ?? 0} icon="wrench" tone="teal" />
      </div>
      <Panel title="Preparation" sub="Every meal starts On Time. Update progress as you go; report a delay only if one actually happens." actions={<Link href="/chef/meal-plan" className="btn btn-ghost btn-sm">Full meal plan</Link>}>
        {meals.length === 0 ? (
          <EmptyState>No meals today.</EmptyState>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {meals.map((m, i) => (
              <PrepCard key={m.id} meal={m} regular={breakdowns[i].regular} separate={breakdowns[i].separatePortions} />
            ))}
          </div>
        )}
      </Panel>
      <div className="cols-2">
        <Panel title="Missing meal reports" sub="Reported by teachers">
          <MissingReportList rows={openMissing} resolveAs="chef" />
        </Panel>
        <Panel title="Announcements">
          <AnnouncementsFeed db={db} instId={inst.id} limit={5} />
        </Panel>
      </div>
    </>
  );
}
