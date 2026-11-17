import Link from "next/link";
import { requireRole } from "@/lib/auth/guards";
import { getDayMeals, getMealBreakdown } from "@/features/meals/queries";
import { EmptyState, PageHeader, Panel, ProgressBar, StatCard } from "@/components/ui/primitives";
import { MealStatusPill, OnTimePill, PrepPill } from "@/components/shared/status";
import { addDays, fmtDate, fmtTime, todayIn } from "@/lib/utils";

export default async function AdminOverview() {
  const ctx = await requireRole("institution_admin");
  const inst = ctx.institution!;
  const db = ctx.supabase;
  const today = todayIn(inst.timezone);
  const meals = await getDayMeals(db, inst, today);
  const breakdowns = await Promise.all(meals.map((m) => getMealBreakdown(db, inst, m)));
  const [pendingSfr, openKsr, openMissing, shortages, structure] = await Promise.all([
    db.from("separate_food_requests").select("id", { count: "exact", head: true }).eq("institution_id", inst.id).eq("status", "pending"),
    db.from("kitchen_service_requests").select("id", { count: "exact", head: true }).eq("institution_id", inst.id).in("status", ["open", "approved", "in_progress"]),
    db.from("missing_meal_reports").select("id", { count: "exact", head: true }).eq("institution_id", inst.id).eq("status", "open"),
    db.from("ingredient_transactions").select("id", { count: "exact", head: true }).eq("institution_id", inst.id).eq("kind", "shortage").gte("created_at", `${addDays(today, -2)}T00:00:00Z`),
    db.from("dining_halls").select("id, active").eq("institution_id", inst.id),
  ]);
  const regularToday = breakdowns.reduce((a, b) => a + b.regular, 0);
  const separateToday = breakdowns.reduce((a, b) => a + b.separatePortions, 0);
  const activeHalls = (structure.data ?? []).filter((h) => h.active).length;

  return (
    <>
      <PageHeader eyebrow={fmtDate(today, { weekday: "long", day: "numeric", month: "long" })} title="Campus overview" sub="Today runs on your standing configuration. Only exceptions need action." />
      <div className="grid-stat">
        <StatCard label="Regular portions today" value={regularToday} hint={`Across ${meals.filter((m) => m.status !== "cancelled").length} active meals`} icon="check" />
        <StatCard label="Separate portions today" value={separateToday} hint="Approved requests" icon="star" tone="good" />
        <StatCard label="Expected students" value={breakdowns[0]?.eligible ?? 0} hint={`${activeHalls} dining hall(s) in service`} icon="users" tone="teal" />
        <StatCard
          label="Needs attention"
          value={(pendingSfr.count ?? 0) + (openMissing.count ?? 0)}
          hint={`${pendingSfr.count ?? 0} food requests · ${openMissing.count ?? 0} missing-meal reports`}
          icon="alert"
          tone="bad"
        />
      </div>

      <Panel title="Today's meals & kitchen progress" sub="Live from the chef's updates — no need to call the kitchen" actions={<Link className="btn btn-ghost btn-sm" href="/admin/kitchen">Kitchen monitoring</Link>}>
        {meals.length === 0 ? (
          <EmptyState>
            No meals scheduled today. <Link className="underline" href="/admin/meals/timetable">Configure the timetable</Link>.
          </EmptyState>
        ) : (
          <div className="tablewrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Meal</th>
                  <th>Menu</th>
                  <th className="num">Regular</th>
                  <th className="num">Separate</th>
                  <th>Preparation</th>
                  <th>Timing</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {meals.map((m, i) => (
                  <tr key={m.id}>
                    <td>
                      <div className="font-semibold">{m.schedule.name}</div>
                      <div className="mono text-[11.5px] text-faint">{fmtTime(m.schedule.serve_time)}</div>
                    </td>
                    <td className="max-w-[260px] text-[12.5px] text-dim">
                      {m.status !== "scheduled" && <MealStatusPill status={m.status} />} {m.menu || <em>No menu published</em>}
                    </td>
                    <td className="num font-bold">{breakdowns[i].regular}</td>
                    <td className="num">{breakdowns[i].separatePortions}</td>
                    <td className="min-w-[150px]">
                      <PrepPill prep={m.prep} />
                      <div className="mt-2">
                        <ProgressBar value={m.prep?.progress ?? 0} bad={m.prep?.status === "delayed"} />
                      </div>
                    </td>
                    <td>{m.status === "cancelled" ? "—" : <OnTimePill prep={m.prep} />}</td>
                    <td>
                      <Link className="btn btn-ghost btn-sm" href={`/admin/attendance?date=${today}&meal=${m.id}`}>
                        Details
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {meals.some((m) => m.prep?.status === "delayed") && (
          <div className="notice notice-bad mt-3 text-[13px]">
            {meals
              .filter((m) => m.prep?.status === "delayed")
              .map((m) => `${m.schedule.name}: ${m.prep?.delay_reason}`)
              .join(" · ")}
          </div>
        )}
      </Panel>

      <div className="cols-2">
        <Panel title="Exceptions & requests">
          <div className="list-row">
            <span>Separate food requests awaiting review</span>
            <Link className="btn btn-ghost btn-sm" href="/admin/special-food">{pendingSfr.count ?? 0} pending</Link>
          </div>
          <div className="list-row">
            <span>Open missing-meal reports</span>
            <Link className="btn btn-ghost btn-sm" href="/admin/distribution">{openMissing.count ?? 0} open</Link>
          </div>
          <div className="list-row">
            <span>Kitchen service requests in progress</span>
            <Link className="btn btn-ghost btn-sm" href="/admin/service-requests">{openKsr.count ?? 0} active</Link>
          </div>
          <div className="list-row">
            <span>Stock shortages reported (48h)</span>
            <Link className="btn btn-ghost btn-sm" href="/admin/kitchen">{shortages.count ?? 0} reported</Link>
          </div>
        </Panel>
        <Panel title="Quick actions" sub="Daily exceptions only — your configuration carries over automatically">
          <div className="flex flex-wrap gap-2">
            <Link className="btn btn-primary" href="/admin/meals">Sponsor / cancel a meal</Link>
            <Link className="btn btn-ghost" href="/admin/announcements">Emergency announcement</Link>
            <Link className="btn btn-ghost" href="/admin/meals/menu">Change a menu</Link>
            <Link className="btn btn-ghost" href="/admin/dining/halls">Close a hall</Link>
            <Link className="btn btn-ghost" href="/admin/dining/tables">Move a student&apos;s table</Link>
          </div>
        </Panel>
      </div>
    </>
  );
}
