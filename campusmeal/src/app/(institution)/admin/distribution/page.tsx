import { requireRole } from "@/lib/auth/guards";
import { getMealBreakdown, resolveMealSelection } from "@/features/meals/queries";
import { getDistributionState } from "@/features/distribution/queries";
import { getSuppliers } from "@/features/suppliers/queries";
import { TableDistribution } from "@/components/shared/table-distribution";
import { MissingReportList } from "@/components/shared/missing-reports";
import { MealPicker } from "@/components/shared/meal-picker";
import { EmptyState, PageHeader, Panel, StatCard } from "@/components/ui/primitives";
import type { PageProps } from "@/types/page";

export default async function AdminDistribution({ searchParams }: PageProps) {
  const ctx = await requireRole("institution_admin");
  const inst = ctx.institution!;
  const db = ctx.supabase;
  const { date, today, meals, selected } = await resolveMealSelection(db, inst, await searchParams);
  const header = <PageHeader eyebrow="Distribution" title="Distribution monitoring" sub="Kitchen delivery per hall and teacher-confirmed distribution per table." />;
  if (!selected)
    return (
      <>
        {header}
        <MealPicker basePath="/admin/distribution" date={date} today={today} meals={meals} />
        <Panel>
          <EmptyState>No meals on this date.</EmptyState>
        </Panel>
      </>
    );
  const [b, state, sup] = await Promise.all([getMealBreakdown(db, inst, selected), getDistributionState(db, selected.id), getSuppliers(db, inst.id, date, selected.id)]);
  const missingByTable = new Map<string, number>();
  for (const m of state.missing) if (m.table_id && m.status !== "resolved") missingByTable.set(m.table_id, (missingByTable.get(m.table_id) ?? 0) + m.portions_missing);
  const completed = b.byTable.filter((t) => state.records.get(t.key)?.completed_at).length;
  const collected = b.byTable.filter((t) => state.records.get(t.key)?.collected_at).length;
  return (
    <>
      {header}
      <MealPicker basePath="/admin/distribution" date={date} today={today} meals={meals} selectedId={selected.id} />
      <div className="grid-stat">
        <StatCard label="Halls delivered" value={`${[...state.deliveries.values()].filter((d) => d.delivery_status === "delivered").length}/${b.byHall.length}`} icon="truck" tone="teal" />
        <StatCard label="Tables collected" value={`${collected}/${b.byTable.length}`} icon="check" />
        <StatCard label="Tables distributed" value={`${completed}/${b.byTable.length}`} icon="grid" tone="good" />
        <StatCard label="Open missing reports" value={state.missing.filter((m) => m.status !== "resolved").length} icon="alert" tone="bad" />
      </div>
      <Panel title="Missing meal reports">
        <MissingReportList rows={state.missing} resolveAs="institution_admin" />
      </Panel>
      <TableDistribution b={b} mealId={selected.id} records={state.records} deliveries={state.deliveries} suppliers={sup.byTable} missingByTable={missingByTable} mode="readonly" showStudents />
    </>
  );
}
