import Link from "next/link";
import { requireRole } from "@/lib/auth/guards";
import { getDayMeals, getMealBreakdown } from "@/features/meals/queries";
import { getMyClasses } from "@/features/attendance/queries";
import { AnnouncementsFeed } from "@/components/shared/announcements-feed";
import { MealStatusPill, PrepPill } from "@/components/shared/status";
import { EmptyState, Notice, PageHeader, Panel, StatCard } from "@/components/ui/primitives";
import { fmtDate, fmtTime, todayIn } from "@/lib/utils";

export default async function TeacherOverview() {
  const ctx = await requireRole("teacher");
  const inst = ctx.institution!;
  const db = ctx.supabase;
  const today = todayIn(inst.timezone);
  const [classes, meals] = await Promise.all([getMyClasses(db, inst.id, ctx.userId), getDayMeals(db, inst, today)]);
  const breakdowns = await Promise.all(meals.map((m) => getMealBreakdown(db, inst, m)));
  const mine = new Set(classes.map((c) => c.id));
  const classRows = (i: number) => breakdowns[i].byClass.filter((c) => mine.has(c.key));
  const { count: pending } = await db
    .from("separate_food_requests")
    .select("id", { count: "exact", head: true })
    .eq("institution_id", inst.id)
    .eq("requested_by", ctx.userId)
    .eq("status", "pending");
  return (
    <>
      <PageHeader eyebrow={fmtDate(today, { weekday: "long", day: "numeric", month: "long" })} title={`Hello, ${ctx.fullName.split(" ").slice(-1)[0]}`} sub={classes.length ? `Class teacher of ${classes.map((c) => c.name).join(", ")}` : "You are not assigned as a class teacher yet."} />
      {classes.length === 0 && (
        <div className="mt-4">
          <Notice tone="warn">Ask the institution admin to assign you to a class. You can still inspect all campus tables and record distribution.</Notice>
        </div>
      )}
      <div className="grid-stat">
        <StatCard label="My students" value={breakdowns[0] ? classRows(0).reduce((a, c) => a + c.assigned, 0) : 0} icon="users" tone="teal" />
        <StatCard label="Pending food requests" value={pending ?? 0} hint="Awaiting admin review" icon="star" />
        <StatCard label="Meals today" value={meals.filter((m) => m.status !== "cancelled").length} icon="calendar" tone="good" />
      </div>
      <Panel title="Today — my classes">
        {meals.length === 0 ? (
          <EmptyState>No meals today.</EmptyState>
        ) : (
          <div className="tablewrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Meal</th>
                  <th>Kitchen</th>
                  <th className="num">Eating (regular)</th>
                  <th className="num">Separate</th>
                  <th className="num">Not attending</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {meals.map((m, i) => {
                  const rows = classRows(i);
                  return (
                    <tr key={m.id}>
                      <td>
                        <span className="font-semibold">{m.schedule.name}</span> <span className="mono text-[11.5px] text-faint">{fmtTime(m.schedule.serve_time)}</span>{" "}
                        {m.status !== "scheduled" && <MealStatusPill status={m.status} />}
                      </td>
                      <td>
                        <PrepPill prep={m.prep} />
                      </td>
                      <td className="num font-bold">{rows.reduce((a, c) => a + c.regular, 0)}</td>
                      <td className="num">{rows.reduce((a, c) => a + c.separate, 0)}</td>
                      <td className="num">{rows.reduce((a, c) => a + c.excluded, 0)}</td>
                      <td>
                        <Link href={`/teacher/attendance?date=${today}&meal=${m.id}`} className="btn btn-ghost btn-sm">
                          Attendance
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <div className="cols-2">
        <Panel title="Quick actions">
          <div className="flex flex-wrap gap-2">
            <Link className="btn btn-primary" href="/teacher/attendance">Report absences</Link>
            <Link className="btn btn-ghost" href="/teacher/special-food">Request separate food</Link>
            <Link className="btn btn-ghost" href="/teacher/distribution">Table distribution</Link>
            <Link className="btn btn-ghost" href="/teacher/suppliers/substitute">Substitute supplier</Link>
          </div>
        </Panel>
        <Panel title="Announcements">
          <AnnouncementsFeed db={db} instId={inst.id} limit={4} />
        </Panel>
      </div>
    </>
  );
}
