import { requireRole } from "@/lib/auth/guards";
import { getMissingReports } from "@/features/distribution/queries";
import { getCampusStructure, resolveMealSelection } from "@/features/meals/queries";
import { MissingReportList } from "@/components/shared/missing-reports";
import { MissingMealForm } from "@/components/shared/missing-form";
import { MealPicker } from "@/components/shared/meal-picker";
import { PageHeader, Panel } from "@/components/ui/primitives";
import type { PageProps } from "@/types/page";

export default async function MissingMealReports({ searchParams }: PageProps) {
  const ctx = await requireRole("teacher");
  const inst = ctx.institution!;
  const db = ctx.supabase;
  const [sel, reports, structure] = await Promise.all([resolveMealSelection(db, inst, await searchParams), getMissingReports(db, inst.id, 60), getCampusStructure(db, inst)]);
  const tables = [...new Map(structure.seats.map((s) => [s.table_id, { key: s.table_id, label: s.table_code }])).values()].sort((a, b) => a.label.localeCompare(b.label));
  return (
    <>
      <PageHeader eyebrow="Dining" title="Missing meal reports" sub="Report missing portions or distribution problems to the kitchen and follow their resolution." />
      <MealPicker basePath="/teacher/reports" date={sel.date} today={sel.today} meals={sel.meals} selectedId={sel.selected?.id} />
      <div className="cols">
        <Panel title="All reports">
          <MissingReportList rows={reports} />
        </Panel>
        {sel.selected && (
          <Panel title={`New report — ${sel.selected.schedule.name}`}>
            <MissingMealForm mealId={sel.selected.id} tables={tables} />
          </Panel>
        )}
      </div>
    </>
  );
}
