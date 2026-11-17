import { requireRole } from "@/lib/auth/guards";
import { getCampusStructure, getMealBreakdown, resolveMealSelection } from "@/features/meals/queries";
import { getMyClasses } from "@/features/attendance/queries";
import { clearAbsence, reportAbsences } from "@/features/attendance/actions";
import { recordLateException } from "@/features/cancellations/actions";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { MealPicker } from "@/components/shared/meal-picker";
import { EmptyState, Field, Notice, PageHeader, Panel, Pill } from "@/components/ui/primitives";
import { nowLocalIn } from "@/lib/utils";
import type { PageProps } from "@/types/page";

export default async function ClassAttendance({ searchParams }: PageProps) {
  const ctx = await requireRole("teacher");
  const inst = ctx.institution!;
  const db = ctx.supabase;
  const [{ date, today, meals, selected }, classes, structure] = await Promise.all([
    resolveMealSelection(db, inst, await searchParams),
    getMyClasses(db, inst.id, ctx.userId),
    getCampusStructure(db, inst),
  ]);
  const header = (
    <PageHeader
      eyebrow="Canteen attendance"
      title="Class-wise attendance"
      sub="Report students who won't eat at the canteen for a meal. This is canteen attendance only — it is separate from class attendance. Students who already cancelled are counted once."
    />
  );
  if (!selected)
    return (
      <>
        {header}
        <MealPicker basePath="/teacher/attendance" date={date} today={today} meals={meals} />
        <Panel>
          <EmptyState>No meals on this date.</EmptyState>
        </Panel>
      </>
    );
  const [b, abs] = await Promise.all([getMealBreakdown(db, inst, selected), db.from("meal_attendance").select("student_id, reason").eq("meal_id", selected.id).range(0, 9999)]);
  const state = new Map(b.byTable.flatMap((t) => t.students.map((s) => [s.id, s.state] as const)));
  const absentReason = new Map((abs.data ?? []).map((a) => [a.student_id, a.reason as string | null]));
  const deadlinePassed = nowLocalIn(inst.timezone) >= selected.deadline;
  return (
    <>
      {header}
      <MealPicker basePath="/teacher/attendance" date={date} today={today} meals={meals} selectedId={selected.id} />
      {selected.status === "cancelled" && <Notice tone="bad">This meal is cancelled — no attendance needed.</Notice>}
      {classes.length === 0 && (
        <Panel>
          <EmptyState>You are not a class teacher yet.</EmptyState>
        </Panel>
      )}
      {selected.status !== "cancelled" &&
        classes.map((c) => {
          const students = structure.students.filter((s) => s.class_id === c.id && s.active && state.has(s.id)).sort((a, z) => a.roll_no - z.roll_no);
          const attending = students.filter((s) => state.get(s.id) === "regular" || state.get(s.id) === "separate");
          const notAttending = students.filter((s) => state.get(s.id) === "cancelled" || state.get(s.id) === "absent");
          return (
            <Panel key={c.id} title={c.name} sub={`${attending.length} eating · ${notAttending.length} not attending`}>
              <div className="cols-2">
                <ActionForm action={reportAbsences}>
                  <input type="hidden" name="role" value="teacher" />
                  <input type="hidden" name="meal_id" value={selected.id} />
                  <div className="text-[12px] font-semibold text-dim">Tick students who will NOT eat at the canteen</div>
                  {attending.length === 0 ? (
                    <EmptyState>Everyone is already marked as not attending.</EmptyState>
                  ) : (
                    <div className="checkgrid">
                      {attending.map((s) => (
                        <label key={s.id}>
                          <input type="checkbox" name="student_ids[]" value={s.id} />
                          <span className="mono text-faint">{s.roll_no}</span> {s.full_name}
                        </label>
                      ))}
                    </div>
                  )}
                  <Field label="Reason (optional)">
                    <input name="reason" maxLength={200} placeholder="e.g. Field trip" />
                  </Field>
                  <div>
                    <SubmitButton disabled={attending.length === 0}>Report absent</SubmitButton>
                  </div>
                </ActionForm>
                <div>
                  <div className="mb-2 text-[12px] font-semibold text-dim">Not attending</div>
                  {notAttending.length === 0 ? (
                    <EmptyState>None.</EmptyState>
                  ) : (
                    notAttending.map((s) => (
                      <div key={s.id} className="list-row text-[13px]">
                        <span>
                          <span className="mono text-faint">{s.roll_no}</span> {s.full_name}
                        </span>
                        <span className="flex items-center gap-2">
                          {state.get(s.id) === "cancelled" ? (
                            <Pill tone="bad">Cancelled by student</Pill>
                          ) : (
                            <>
                              <Pill tone="warn">{absentReason.get(s.id) ?? "Absent"}</Pill>
                              <ActionForm action={clearAbsence} inline>
                                <input type="hidden" name="role" value="teacher" />
                                <input type="hidden" name="meal_id" value={selected.id} />
                                <input type="hidden" name="student_id" value={s.id} />
                                <SubmitButton size="sm" variant="ghost">
                                  Undo
                                </SubmitButton>
                              </ActionForm>
                            </>
                          )}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
              {deadlinePassed && attending.length > 0 && (
                <details className="disclosure mt-4">
                  <summary className="text-[12.5px] font-semibold text-amber">Authorise a late cancellation (student request after the deadline)</summary>
                  <ActionForm action={recordLateException} inline className="mt-2">
                    <input type="hidden" name="role" value="teacher" />
                    <input type="hidden" name="meal_id" value={selected.id} />
                    <select name="student_id" className="input w-64" required aria-label="Student">
                      {attending.map((s) => (
                        <option key={s.id} value={s.id}>
                          #{s.roll_no} {s.full_name}
                        </option>
                      ))}
                    </select>
                    <input name="note" className="input min-w-[180px] flex-1" placeholder="Note" maxLength={200} />
                    <SubmitButton size="sm" variant="ghost">
                      Record exception
                    </SubmitButton>
                  </ActionForm>
                </details>
              )}
            </Panel>
          );
        })}
    </>
  );
}
