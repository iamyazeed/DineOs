import { requireRole } from "@/lib/auth/guards";
import { getMealBreakdown, resolveMealSelection } from "@/features/meals/queries";
import { getDistributionState } from "@/features/distribution/queries";
import { getSuppliers } from "@/features/suppliers/queries";
import { TableDistribution } from "@/components/shared/table-distribution";
import { MissingReportList } from "@/components/shared/missing-reports";
import { MealPicker } from "@/components/shared/meal-picker";
import { EmptyState, PageHeader, Panel } from "@/components/ui/primitives";
import type { PageProps } from "@/types/page";

export default async function ChefDistribution({ searchParams }: PageProps) {
  const ctx = await requireRole("chef");
  const inst = ctx.institution!;
  const db = ctx.supabase;
  const { date, today, meals, selected } = await resolveMealSelection(db, inst, await searchParams);
  const header = <PageHeader eyebrow="Logistics" title="Distribution status" sub="Teacher-confirmed collection and distribution per table, plus missing-meal reports to resolve." />;
  if (!selected)
    return (
      <>
        {header}
        <MealPicker basePath="/chef/distribution" date={date} today={today} meals={meals} />
        <Panel>
          <EmptyState>No meals on this date.</EmptyState>
        </Panel>
      </>
    );
  const [b, state, sup] = await Promise.all([getMealBreakdown(db, inst, selected), getDistributionState(db, selected.id), getSuppliers(db, inst.id, date, selected.id)]);
  const missingByTable = new Map<string, number>();
  for (const m of state.missing) if (m.table_id && m.status !== "resolved") missingByTable.set(m.table_id, (missingByTable.get(m.table_id) ?? 0) + m.portions_missing);
  return (
    <>
      {header}
      <MealPicker basePath="/chef/distribution" date={date} today={today} meals={meals} selectedId={selected.id} />
      <Panel title="Missing meal reports for this meal">
        <MissingReportList rows={state.missing} resolveAs="chef" />
      </Panel>
      <TableDistribution b={b} mealId={selected.id} records={state.records} deliveries={state.deliveries} suppliers={sup.byTable} missingByTable={missingByTable} mode="readonly" />
    </>
  );
}
