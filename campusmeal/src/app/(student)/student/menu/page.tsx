import { requireRole } from "@/lib/auth/guards";
import { getDayMeals } from "@/features/meals/queries";
import { MealStatusPill } from "@/components/shared/status";
import { EmptyState, PageHeader, Panel } from "@/components/ui/primitives";
import { fmtDate, fmtTime, todayIn } from "@/lib/utils";

export default async function TodaysMenu() {
  const ctx = await requireRole("student");
  const inst = ctx.institution!;
  const today = todayIn(inst.timezone);
  const meals = await getDayMeals(ctx.supabase, inst, today);
  return (
    <>
      <PageHeader eyebrow={fmtDate(today, { weekday: "long", day: "numeric", month: "long" })} title="Today's menu" sub="Published by your institution." />
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {meals.length === 0 && (
          <Panel>
            <EmptyState>No meals today.</EmptyState>
          </Panel>
        )}
        {meals.map((m) => (
          <Panel key={m.id} title={m.schedule.name} sub={fmtTime(m.schedule.serve_time)} actions={m.status !== "scheduled" ? <MealStatusPill status={m.status} /> : undefined}>
            <p className="font-d text-[20px] leading-snug" style={{ fontWeight: 600 }}>
              {m.status === "cancelled" ? <s className="text-faint">{m.menu}</s> : m.menu || "Menu not published yet"}
            </p>
            {m.status_reason && <p className="mt-3 text-[13px] text-amber">{m.status_reason}</p>}
          </Panel>
        ))}
      </div>
    </>
  );
}
