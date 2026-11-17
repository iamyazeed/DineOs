import { requireRole } from "@/lib/auth/guards";
import { getMealBreakdown, resolveMealSelection } from "@/features/meals/queries";
import { getMyClasses } from "@/features/attendance/queries";
import { MealPicker } from "@/components/shared/meal-picker";
import { EmptyState, PageHeader, Panel, Pill } from "@/components/ui/primitives";
import type { PageProps } from "@/types/page";

const TONE = { regular: "good", separate: "teal", cancelled: "bad", absent: "warn" } as const;

export default async function StudentMealStatus({ searchParams }: PageProps) {
  const ctx = await requireRole("teacher");
  const inst = ctx.institution!;
  const db = ctx.supabase;
  const [{ date, today, meals, selected }, classes] = await Promise.all([resolveMealSelection(db, inst, await searchParams), getMyClasses(db, inst.id, ctx.userId)]);
  const b = selected ? await getMealBreakdown(db, inst, selected) : null;
  const names = new Set(classes.map((c) => c.name));
  const students = (b?.byTable ?? []).flatMap((t) => t.students.map((s) => ({ ...s, table: t.label, hall: t.hall_name }))).filter((s) => names.has(s.class_name));
  return (
    <>
      <PageHeader eyebrow="My classes" title="Student meal status" sub="Each student's status for the selected meal, based on cancellations, reported absences and approved separate food." />
      <MealPicker basePath="/teacher/meal-status" date={date} today={today} meals={meals} selectedId={selected?.id} />
      {classes.length === 0 ? (
        <Panel>
          <EmptyState>You are not a class teacher yet.</EmptyState>
        </Panel>
      ) : (
        classes.map((c) => {
          const rows = students.filter((s) => s.class_name === c.name).sort((a, z) => a.roll_no - z.roll_no);
          return (
            <Panel key={c.id} title={c.name} sub={`${rows.filter((r) => r.state === "regular").length} regular · ${rows.filter((r) => r.state === "separate").length} separate · ${rows.filter((r) => r.state === "cancelled" || r.state === "absent").length} not attending`}>
              {rows.length === 0 ? (
                <EmptyState>No seated students in this class.</EmptyState>
              ) : (
                <div className="tablewrap">
                  <table className="data">
                    <thead>
                      <tr>
                        <th className="num">Roll</th>
                        <th>Student</th>
                        <th>Table</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((s) => (
                        <tr key={s.id}>
                          <td className="num">{s.roll_no}</td>
                          <td className="font-semibold">{s.full_name}</td>
                          <td>
                            <span className="mono">{s.table}</span> <span className="text-[11.5px] text-faint">{s.hall}</span>
                          </td>
                          <td>
                            <Pill tone={TONE[s.state]}>{s.state}</Pill>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          );
        })
      )}
    </>
  );
}
