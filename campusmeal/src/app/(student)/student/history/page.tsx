import { requireRole } from "@/lib/auth/guards";
import { getStudentMeals } from "@/features/cancellations/queries";
import { MyMealStatus } from "@/components/shared/student-meal-row";
import { EmptyState, PageHeader, Panel, StatCard } from "@/components/ui/primitives";
import { addDays, fmtDate, fmtTime, todayIn } from "@/lib/utils";

export default async function MealHistory() {
  const ctx = await requireRole("student");
  const inst = ctx.institution!;
  const today = todayIn(inst.timezone);
  const { meals } = await getStudentMeals(ctx.supabase, inst, ctx.userId, addDays(today, -13), 14);
  const past = [...meals].reverse();
  const cancelled = meals.filter((m) => m.cancelled).length;
  return (
    <>
      <PageHeader eyebrow="Last 14 days" title="My meal history" sub="Your meals and the cancellations you made." />
      <div className="grid-stat">
        <StatCard label="Meals scheduled" value={meals.filter((m) => m.status !== "cancelled").length} icon="calendar" tone="teal" />
        <StatCard label="You cancelled" value={cancelled} icon="x" tone="bad" />
        <StatCard label="Institution cancelled / sponsored" value={meals.filter((m) => m.status === "cancelled" || m.status === "sponsored").length} icon="star" />
      </div>
      <Panel>
        {past.length === 0 ? (
          <EmptyState>No history yet.</EmptyState>
        ) : (
          <div className="tablewrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Meal</th>
                  <th>Menu</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {past.map((m) => (
                  <tr key={m.id}>
                    <td>{fmtDate(m.meal_date)}</td>
                    <td className="font-semibold">
                      {m.schedule.name} <span className="mono text-[11.5px] text-faint">{fmtTime(m.schedule.serve_time)}</span>
                    </td>
                    <td className="max-w-[300px] text-[12.5px] text-dim">{m.menu}</td>
                    <td>
                      <MyMealStatus m={m} />
                    </td>
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
