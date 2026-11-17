import { requireRole } from "@/lib/auth/guards";
import { createClass, setClassTeacher } from "@/features/campus-configuration/actions";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { EmptyState, Field, PageHeader, Panel } from "@/components/ui/primitives";

export default async function ClassesPage() {
  const ctx = await requireRole("institution_admin");
  const inst = ctx.institution!;
  const db = ctx.supabase;
  const [{ data: classes }, { data: teachers }, { data: students }] = await Promise.all([
    db.from("classes").select("id, name, teacher_id").eq("institution_id", inst.id).order("name"),
    db.from("memberships").select("user_id, profile:profiles(full_name)").eq("institution_id", inst.id).eq("role", "teacher"),
    db.from("students").select("class_id").eq("institution_id", inst.id).eq("active", true).range(0, 9999),
  ]);
  const teacherList = (teachers ?? []).map((t) => ({
    id: t.user_id,
    name: ((Array.isArray(t.profile) ? t.profile[0] : t.profile) as { full_name: string } | null)?.full_name ?? "Teacher",
  }));
  const count = (id: string) => (students ?? []).filter((s) => s.class_id === id).length;
  const teacherSelect = ({ value }: { value?: string | null }) => (
    <select name="teacher_id" defaultValue={value ?? ""} className="input">
      <option value="">No class teacher</option>
      {teacherList.map((t) => (
        <option key={t.id} value={t.id}>
          {t.name}
        </option>
      ))}
    </select>
  );
  return (
    <>
      <PageHeader eyebrow="Configuration" title="Classes" sub="Students are grouped into classes; each class teacher coordinates attendance and separate food for their class." />
      <div className="mt-5" />
      <div className="cols">
        <Panel title="Classes">
          {(classes ?? []).length === 0 ? (
            <EmptyState>No classes yet.</EmptyState>
          ) : (
            <div className="tablewrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Class</th>
                    <th className="num">Students</th>
                    <th>Class teacher</th>
                  </tr>
                </thead>
                <tbody>
                  {(classes ?? []).map((c) => (
                    <tr key={c.id}>
                      <td className="font-semibold">{c.name}</td>
                      <td className="num">{count(c.id)}</td>
                      <td>
                        <ActionForm action={setClassTeacher} inline>
                          <input type="hidden" name="class_id" value={c.id} />
                          {teacherSelect({ value: c.teacher_id })}
                          <SubmitButton size="sm" variant="ghost">
                            Save
                          </SubmitButton>
                        </ActionForm>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
        <Panel title="Add a class">
          <ActionForm action={createClass} resetOnSuccess>
            <Field label="Class name">
              <input name="name" required maxLength={80} placeholder="e.g. Engineering Year 3" />
            </Field>
            <Field label="Class teacher">
              {teacherSelect({})}
            </Field>
            <div>
              <SubmitButton>Add class</SubmitButton>
            </div>
          </ActionForm>
        </Panel>
      </div>
    </>
  );
}
