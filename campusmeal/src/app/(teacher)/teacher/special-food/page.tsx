import { requireRole } from "@/lib/auth/guards";
import { getRecentSeparateRequests } from "@/features/special-food/queries";
import { getMyClasses } from "@/features/attendance/queries";
import { createSeparateFoodRequest } from "@/features/special-food/actions";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { SeparateRequestList } from "@/components/shared/separate-requests";
import { EmptyState, Field, PageHeader, Panel } from "@/components/ui/primitives";
import { fmtDate, fmtTime, todayIn } from "@/lib/utils";
import type { PageProps } from "@/types/page";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default async function TeacherSpecialFood({ searchParams }: PageProps) {
  const ctx = await requireRole("teacher");
  const inst = ctx.institution!;
  const db = ctx.supabase;
  const sp = await searchParams;
  const [classes, data] = await Promise.all([getMyClasses(db, inst.id, ctx.userId), getRecentSeparateRequests(db, inst)]);
  const classId = typeof sp.class === "string" && classes.some((c) => c.id === sp.class) ? sp.class : classes[0]?.id;
  const today = todayIn(inst.timezone);
  const upcoming = data.meals.filter((m) => m.meal_date >= today && m.status !== "cancelled");
  const students = data.structure.students.filter((s) => s.class_id === classId && s.active).sort((a, b) => a.roll_no - b.roll_no);
  const mine = data.rows.filter((r) => classes.some((c) => c.id === r.class_id));
  return (
    <>
      <PageHeader eyebrow="Separate food" title="Special food requests" sub="Notify the institution admin when students in your class need separate food instead of the standard meal." />
      <div className="mt-5" />
      {classes.length === 0 ? (
        <Panel>
          <EmptyState>Only class teachers can submit separate food requests.</EmptyState>
        </Panel>
      ) : (
        <div className="cols">
          <Panel title="My class requests">
            <SeparateRequestList rows={mine} mealLabel={data.mealLabel} studentName={data.studentName} />
          </Panel>
          <Panel title="New request">
            {classes.length > 1 && (
              <div className="seg mb-3">
                {classes.map((c) => (
                  <Link key={c.id} href={`/teacher/special-food?class=${c.id}`} className={cn(c.id === classId && "on")}>
                    {c.name}
                  </Link>
                ))}
              </div>
            )}
            <ActionForm action={createSeparateFoodRequest} resetOnSuccess>
              <input type="hidden" name="class_id" value={classId} />
              <Field label="Meal">
                <select name="meal_id" required>
                  {upcoming.map((m) => (
                    <option key={m.id} value={m.id}>
                      {fmtDate(m.meal_date)} · {m.schedule.name} ({fmtTime(m.schedule.serve_time)})
                    </option>
                  ))}
                </select>
              </Field>
              <div className="text-[12px] font-semibold text-dim">Students concerned</div>
              <div className="checkgrid">
                {students.map((s) => (
                  <label key={s.id}>
                    <input type="checkbox" name="student_ids[]" value={s.id} />
                    <span className="mono text-faint">{s.roll_no}</span> {s.full_name}
                  </label>
                ))}
              </div>
              <div className="grid grid-cols-[110px_1fr] gap-2">
                <Field label="Portions">
                  <input name="portions" type="number" min={1} max={500} required defaultValue={1} />
                </Field>
                <Field label="Food requirement">
                  <input name="requirement" required maxLength={300} placeholder="e.g. Plain rice and steamed vegetables" />
                </Field>
              </div>
              <Field label="Dietary information">
                <input name="dietary_info" maxLength={300} placeholder="e.g. Gluten-free, no nuts" />
              </Field>
              <Field label="Reason / instructions">
                <textarea name="reason" maxLength={300} />
              </Field>
              <div>
                <SubmitButton>Send to admin</SubmitButton>
              </div>
            </ActionForm>
          </Panel>
        </div>
      )}
    </>
  );
}
