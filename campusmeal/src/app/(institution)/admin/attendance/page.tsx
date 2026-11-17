import { requireRole } from "@/lib/auth/guards";
import { getCampusStructure, getMealBreakdown, resolveMealSelection } from "@/features/meals/queries";
import { recordLateException } from "@/features/cancellations/actions";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { BreakdownStats, HallClassPanels } from "@/components/shared/breakdown";
import { MealPicker } from "@/components/shared/meal-picker";
import { EmptyState, Field, PageHeader, Panel, Pill } from "@/components/ui/primitives";
import { fmtDateTime } from "@/lib/utils";
import type { PageProps } from "@/types/page";

export default async function AdminAttendance({ searchParams }: PageProps) {
  const ctx = await requireRole("institution_admin");
  const inst = ctx.institution!;
  const db = ctx.supabase;
  const { date, today, meals, selected } = await resolveMealSelection(db, inst, await searchParams);
  if (!selected) {
    return (
      <>
        <PageHeader eyebrow="Meal attendance" title="Meal attendance" />
        <MealPicker basePath="/admin/attendance" date={date} today={today} meals={meals} />
        <Panel>
          <EmptyState>No meals on this date.</EmptyState>
        </Panel>
      </>
    );
  }
  const [b, structure, canc, abs] = await Promise.all([
    getMealBreakdown(db, inst, selected),
    getCampusStructure(db, inst),
    db.from("meal_cancellations").select("student_id, source, note, cancelled_at").eq("meal_id", selected.id).order("cancelled_at", { ascending: false }).range(0, 9999),
    db.from("meal_attendance").select("student_id, reason, reported_at").eq("meal_id", selected.id).order("reported_at", { ascending: false }).range(0, 9999),
  ]);
  const st = new Map(structure.students.map((s) => [s.id, s]));
  const cancelledIds = new Set((canc.data ?? []).map((c) => c.student_id));
  return (
    <>
      <PageHeader eyebrow="Meal attendance" title="Meal attendance & approved quantities" sub="Student cancellations and teacher-reported canteen absences, reconciled by student ID. Campus attendance is not used here." />
      <MealPicker basePath="/admin/attendance" date={date} today={today} meals={meals} selectedId={selected.id} />
      <BreakdownStats b={b} />
      <HallClassPanels b={b} />
      <div className="cols-2">
        <Panel title="Student cancellations" sub={`${(canc.data ?? []).length} records`}>
          {(canc.data ?? []).length === 0 ? (
            <EmptyState>No cancellations.</EmptyState>
          ) : (
            <div className="max-h-[360px] overflow-auto">
              {(canc.data ?? []).map((c) => (
                <div key={c.student_id} className="list-row text-[13px]">
                  <span>
                    {st.get(c.student_id)?.full_name} <span className="text-faint">· {st.get(c.student_id)?.class_name}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    {c.source === "exception" && <Pill tone="warn">Late exception</Pill>}
                    <span className="text-[11.5px] text-faint">{fmtDateTime(c.cancelled_at)}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </Panel>
        <Panel title="Teacher-reported absences" sub={`${(abs.data ?? []).length} records`}>
          {(abs.data ?? []).length === 0 ? (
            <EmptyState>No absences reported.</EmptyState>
          ) : (
            <div className="max-h-[360px] overflow-auto">
              {(abs.data ?? []).map((a) => (
                <div key={a.student_id} className="list-row text-[13px]">
                  <span>
                    {st.get(a.student_id)?.full_name} <span className="text-faint">· {st.get(a.student_id)?.class_name}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    {cancelledIds.has(a.student_id) && <Pill tone="dim">also cancelled · counted once</Pill>}
                    <span className="text-[11.5px] text-faint">{a.reason}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
      <Panel title="Authorised late cancellation" sub="After the deadline, students cannot cancel themselves. Record an exception here.">
        <ActionForm action={recordLateException} inline resetOnSuccess>
          <input type="hidden" name="role" value="institution_admin" />
          <input type="hidden" name="meal_id" value={selected.id} />
          <Field label="Student" className="min-w-[260px] flex-1">
            <select name="student_id" required>
              {structure.students
                .filter((s) => s.active && !cancelledIds.has(s.id))
                .sort((a, z) => a.class_name.localeCompare(z.class_name) || a.roll_no - z.roll_no)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.class_name} #{s.roll_no} — {s.full_name}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Note" className="min-w-[200px] flex-1">
            <input name="note" maxLength={200} placeholder="Reason" />
          </Field>
          <SubmitButton variant="ghost">Record exception</SubmitButton>
        </ActionForm>
      </Panel>
    </>
  );
}
