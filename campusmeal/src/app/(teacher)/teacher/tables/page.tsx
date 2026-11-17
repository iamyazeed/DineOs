import { requireRole } from "@/lib/auth/guards";
import { getMealBreakdown, resolveMealSelection } from "@/features/meals/queries";
import { getDistributionState } from "@/features/distribution/queries";
import { getSuppliers } from "@/features/suppliers/queries";
import { TableDistribution } from "@/components/shared/table-distribution";
import { MealPicker } from "@/components/shared/meal-picker";
import { EmptyState, PageHeader, Panel } from "@/components/ui/primitives";
import type { PageProps } from "@/types/page";

export default async function AllCampusTables({ searchParams }: PageProps) {
  const ctx = await requireRole("teacher");
  const inst = ctx.institution!;
  const db = ctx.supabase;
  const { date, today, meals, selected } = await resolveMealSelection(db, inst, await searchParams);
  const header = <PageHeader eyebrow="Dining" title="All campus tables" sub="Every table in every hall. Open a table to inspect its students, roll numbers and meal status." />;
  if (!selected)
    return (
      <>
        {header}
        <MealPicker basePath="/teacher/tables" date={date} today={today} meals={meals} />
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
      <MealPicker basePath="/teacher/tables" date={date} today={today} meals={meals} selectedId={selected.id} />
      <TableDistribution b={b} mealId={selected.id} records={state.records} deliveries={state.deliveries} suppliers={sup.byTable} missingByTable={missingByTable} mode="readonly" showStudents />
    </>
  );
}
