import { requireRole } from "@/lib/auth/guards";
import { getMealsInRange, getMealBreakdown } from "@/features/meals/queries";
import { MealStatusPill } from "@/components/shared/status";
import { EmptyState, PageHeader, Panel } from "@/components/ui/primitives";
import { fmtDate, fmtTime, nowLocalIn, todayIn } from "@/lib/utils";

export default async function ApprovedCounts() {
  const ctx = await requireRole("chef");
  const inst = ctx.institution!;
  const db = ctx.supabase;
  const today = todayIn(inst.timezone);
  const meals = await getMealsInRange(db, inst, today, 3);
  const breakdowns = await Promise.all(meals.map((m) => getMealBreakdown(db, inst, m)));
  return (
    <>
      <PageHeader eyebrow="Kitchen" title="Approved meal counts" sub="Today and the next two days. Future counts change until each meal's cancellation deadline passes." />
      <div className="mt-5" />
      <Panel>
        {meals.length === 0 ? (
          <EmptyState>No meals scheduled.</EmptyState>
        ) : (
          <div className="tablewrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Meal</th>
                  <th>Status</th>
                  <th className="num">Expected</th>
                  <th className="num">Not attending</th>
                  <th className="num">Regular</th>
                  <th className="num">Separate</th>
                  <th>Counts final?</th>
                </tr>
              </thead>
              <tbody>
                {meals.map((m, i) => {
                  const b = breakdowns[i];
                  const final = nowLocalIn(inst.timezone) >= m.deadline;
                  return (
                    <tr key={m.id}>
                      <td>{fmtDate(m.meal_date)}</td>
                      <td className="font-semibold">
                        {m.schedule.name} <span className="mono text-[11.5px] text-faint">{fmtTime(m.schedule.serve_time)}</span>
                      </td>
                      <td>
                        <MealStatusPill status={m.status} />
                      </td>
                      <td className="num">{b.eligible}</td>
                      <td className="num">{b.excluded}</td>
                      <td className="num text-[15px] font-bold">{b.regular}</td>
                      <td className="num">{b.separatePortions}</td>
                      <td className="text-[12px]">{final ? <span className="pill pill-good">Deadline passed</span> : <span className="pill pill-warn">Open until {m.deadline.replace("T", " ")}</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
