import { requireRole } from "@/lib/auth/guards";
import { getDayMeals, getMealBreakdown } from "@/features/meals/queries";
import { PrepCard } from "@/components/shared/prep-form";
import { EmptyState, PageHeader, Panel } from "@/components/ui/primitives";
import { addDays, fmtDate, todayIn } from "@/lib/utils";

export default async function Preparation() {
  const ctx = await requireRole("chef");
  const inst = ctx.institution!;
  const db = ctx.supabase;
  const today = todayIn(inst.timezone);
  const days = [today, addDays(today, 1)];
  const sets = await Promise.all(days.map((d) => getDayMeals(db, inst, d)));
  const counts = await Promise.all(sets.map((ms) => Promise.all(ms.map((m) => getMealBreakdown(db, inst, m)))));
  return (
    <>
      <PageHeader eyebrow="Kitchen" title="Preparation progress" sub="Not Started → In Progress → Completed. Report Delayed only when a real delay occurs. The institution admin sees these updates live." />
      <div className="mt-5" />
      {days.map((d, di) => (
        <Panel key={d} title={di === 0 ? "Today" : fmtDate(d, { weekday: "long", day: "numeric", month: "short" })}>
          {sets[di].length === 0 ? (
            <EmptyState>No meals.</EmptyState>
          ) : (
            <div className="grid gap-3 md:grid-cols-3">
              {sets[di].map((m, i) => (
                <PrepCard key={m.id} meal={m} regular={counts[di][i].regular} separate={counts[di][i].separatePortions} />
              ))}
            </div>
          )}
        </Panel>
      ))}
    </>
  );
}
