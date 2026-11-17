import { requireRole } from "@/lib/auth/guards";
import { getCampusStructure, getMealBreakdown, getSeparateRequests, resolveMealSelection } from "@/features/meals/queries";
import { BreakdownStats, HallClassPanels } from "@/components/shared/breakdown";
import { MealPicker } from "@/components/shared/meal-picker";
import { MealStatusPill, OnTimePill, PrepPill } from "@/components/shared/status";
import { EmptyState, KV, Notice, PageHeader, Panel } from "@/components/ui/primitives";
import { fmtTime } from "@/lib/utils";
import type { PageProps } from "@/types/page";

export default async function ChefMealPlan({ searchParams }: PageProps) {
  const ctx = await requireRole("chef");
  const inst = ctx.institution!;
  const db = ctx.supabase;
  const { date, today, meals, selected } = await resolveMealSelection(db, inst, await searchParams);
  const header = <PageHeader eyebrow="Kitchen" title="Today's meal plan" sub="The approved plan: what to cook, for how many, and any special instructions." />;
  if (!selected)
    return (
      <>
        {header}
        <MealPicker basePath="/chef/meal-plan" date={date} today={today} meals={meals} />
        <Panel>
          <EmptyState>No meals on this date.</EmptyState>
        </Panel>
      </>
    );
  const [b, reqs, structure] = await Promise.all([getMealBreakdown(db, inst, selected), getSeparateRequests(db, inst.id, [selected.id]), getCampusStructure(db, inst)]);
  const approved = reqs.filter((r) => r.status === "approved");
  const names = new Map(structure.students.map((s) => [s.id, s.full_name]));
  return (
    <>
      {header}
      <MealPicker basePath="/chef/meal-plan" date={date} today={today} meals={meals} selectedId={selected.id} />
      <div className="cols">
        <Panel title={`${selected.schedule.name} · ${fmtTime(selected.schedule.serve_time)}`} actions={<MealStatusPill status={selected.status} />}>
          <KV k="Menu" v={selected.menu || "—"} />
          <KV k="Preparation" v={<PrepPill prep={selected.prep} />} />
          <KV k="Timing" v={<OnTimePill prep={selected.prep} />} />
          {selected.status_reason && (
            <div className="mt-3">
              <Notice tone="warn">{selected.status_reason}</Notice>
            </div>
          )}
          {selected.prep?.delay_reason && (
            <div className="mt-3">
              <Notice tone="bad">Reported delay: {selected.prep.delay_reason}</Notice>
            </div>
          )}
        </Panel>
        <Panel title="Special instructions" sub="Approved separate food — prepare separately">
          {approved.length === 0 ? (
            <EmptyState>No separate food for this meal.</EmptyState>
          ) : (
            approved.map((r) => (
              <div key={r.id} className="list-row items-start text-[13px]">
                <div>
                  <div className="font-semibold">
                    {r.portions} × {r.requirement}
                  </div>
                  <div className="text-dim">
                    {r.class_name}
                    {r.dietary_info ? ` · ${r.dietary_info}` : ""}
                  </div>
                  <div className="text-[12px] text-faint">{r.student_ids.map((id) => names.get(id)).join(", ")}</div>
                </div>
              </div>
            ))
          )}
        </Panel>
      </div>
      <BreakdownStats b={b} />
      <HallClassPanels b={b} />
    </>
  );
}
