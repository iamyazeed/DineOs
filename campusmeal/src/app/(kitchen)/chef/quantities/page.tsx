import { requireRole } from "@/lib/auth/guards";
import { getMealBreakdown, resolveMealSelection } from "@/features/meals/queries";
import { BucketTable } from "@/components/shared/breakdown";
import { MealPicker } from "@/components/shared/meal-picker";
import { EmptyState, PageHeader, Panel } from "@/components/ui/primitives";
import type { PageProps } from "@/types/page";

export default async function TableQuantities({ searchParams }: PageProps) {
  const ctx = await requireRole("chef");
  const inst = ctx.institution!;
  const { date, today, meals, selected } = await resolveMealSelection(ctx.supabase, inst, await searchParams);
  const b = selected ? await getMealBreakdown(ctx.supabase, inst, selected) : null;
  const halls = new Map<string, NonNullable<typeof b>["byTable"]>();
  for (const t of b?.byTable ?? []) halls.set(t.hall_name, [...(halls.get(t.hall_name) ?? []), t]);
  return (
    <>
      <PageHeader eyebrow="Kitchen" title="Table-wise quantities" sub="Portions to send to each table, grouped by dining hall." />
      <MealPicker basePath="/chef/quantities" date={date} today={today} meals={meals} selectedId={selected?.id} />
      {!b ? (
        <Panel>
          <EmptyState>No meals on this date.</EmptyState>
        </Panel>
      ) : (
        <>
          <Panel title="Hall totals">
            <BucketTable rows={b.byHall} labelHeader="Hall" />
          </Panel>
          {[...halls.entries()].map(([hall, tables]) => (
            <Panel key={hall} title={hall}>
              <BucketTable rows={tables} labelHeader="Table" />
            </Panel>
          ))}
        </>
      )}
    </>
  );
}
