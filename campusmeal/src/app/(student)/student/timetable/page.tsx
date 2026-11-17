import { requireRole } from "@/lib/auth/guards";
import { getStudentMeals } from "@/features/cancellations/queries";
import { MyMealStatus } from "@/components/shared/student-meal-row";
import { EmptyState, PageHeader, Panel } from "@/components/ui/primitives";
import { fmtDate, fmtTime, todayIn } from "@/lib/utils";

export default async function WeeklyTimetable() {
  const ctx = await requireRole("student");
  const inst = ctx.institution!;
  const today = todayIn(inst.timezone);
  const { meals } = await getStudentMeals(ctx.supabase, inst, ctx.userId, today, 7);
  const days = [...new Set(meals.map((m) => m.meal_date))];
  return (
    <>
      <PageHeader eyebrow="Next 7 days" title="Weekly meal timetable" sub="Your institution's fixed timetable and published menus." />
      <div className="mt-5" />
      {days.length === 0 && (
        <Panel>
          <EmptyState>No meals scheduled this week.</EmptyState>
        </Panel>
      )}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {days.map((d) => (
          <Panel key={d} title={d === today ? "Today" : fmtDate(d, { weekday: "long", day: "numeric", month: "short" })}>
            {meals
              .filter((m) => m.meal_date === d)
              .map((m) => (
                <div key={m.id} className="list-row items-start">
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold">
                      {m.schedule.name} <span className="mono text-[11.5px] text-faint">{fmtTime(m.schedule.serve_time)}</span>
                    </div>
                    <div className="text-[12.5px] text-dim">{m.menu || "—"}</div>
                  </div>
                  <MyMealStatus m={m} />
                </div>
              ))}
          </Panel>
        ))}
      </div>
    </>
  );
}
