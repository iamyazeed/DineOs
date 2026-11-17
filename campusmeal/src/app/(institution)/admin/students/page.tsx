import Link from "next/link";
import { requireRole } from "@/lib/auth/guards";
import { getCampusStructure } from "@/features/meals/queries";
import { createAccount, createStudent, setStudentActive } from "@/features/campus-configuration/actions";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { EmptyState, Field, PageHeader, Panel, Pill } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import type { PageProps } from "@/types/page";

export default async function StudentsPage({ searchParams }: PageProps) {
  const ctx = await requireRole("institution_admin");
  const inst = ctx.institution!;
  const sp = await searchParams;
  const db = ctx.supabase;
  const structure = await getCampusStructure(db, inst);
  const classFilter = typeof sp.class === "string" ? sp.class : structure.classes[0]?.id;
  const q = typeof sp.q === "string" ? sp.q.trim().toLowerCase() : "";
  const [{ data: rows }, { data: tables }, { data: linked }] = await Promise.all([
    db.from("students").select("id, full_name, roll_no, class_id, dietary_notes, active, profile_id").eq("institution_id", inst.id).range(0, 9999),
    db.from("dining_tables").select("id, code").eq("institution_id", inst.id).eq("active", true).order("code"),
    db.from("students").select("id").eq("institution_id", inst.id).not("profile_id", "is", null),
  ]);
  const seatOf = new Map(structure.seats.map((s) => [s.student_id, s.table_code]));
  const list = (rows ?? [])
    .filter((s) => (q ? s.full_name.toLowerCase().includes(q) : s.class_id === classFilter))
    .sort((a, b) => a.roll_no - b.roll_no);
  const studentsWithoutLogin = (rows ?? []).filter((s) => !s.profile_id).sort((a, b) => a.full_name.localeCompare(b.full_name));

  return (
    <>
      <PageHeader
        eyebrow="People"
        title="Students & teachers"
        sub={`${(rows ?? []).filter((s) => s.active).length} active students · ${(linked ?? []).length} with student logins`}
        actions={<Link href="/admin/teachers" className="btn btn-ghost">Teachers & staff →</Link>}
      />
      <div className="my-5 flex flex-wrap items-center gap-3">
        <div className="seg">
          {structure.classes.map((c) => (
            <Link key={c.id} href={`/admin/students?class=${c.id}`} className={cn(!q && c.id === classFilter && "on")}>
              {c.name}
            </Link>
          ))}
        </div>
        <form className="flex gap-2">
          <input className="input w-56" name="q" placeholder="Search all students…" defaultValue={q} />
          <button className="btn btn-ghost btn-sm">Search</button>
        </form>
      </div>
      <Panel title={q ? `Search: “${q}”` : structure.classes.find((c) => c.id === classFilter)?.name ?? "Students"} sub={`${list.length} students`}>
        {list.length === 0 ? (
          <EmptyState>No students here yet.</EmptyState>
        ) : (
          <div className="tablewrap">
            <table className="data">
              <thead>
                <tr>
                  <th className="num">Roll</th>
                  <th>Name</th>
                  <th>Table</th>
                  <th>Dietary notes</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.map((s) => (
                  <tr key={s.id}>
                    <td className="num">{s.roll_no}</td>
                    <td className="font-semibold">
                      {s.full_name} {s.profile_id && <Pill tone="teal">login</Pill>}
                    </td>
                    <td className="mono">{seatOf.get(s.id) ?? <span className="text-bad">Unseated</span>}</td>
                    <td className="text-[12.5px] text-dim">{s.dietary_notes ?? "—"}</td>
                    <td>{s.active ? <Pill tone="good">Active</Pill> : <Pill tone="bad">Inactive</Pill>}</td>
                    <td>
                      <ActionForm action={setStudentActive} inline>
                        <input type="hidden" name="student_id" value={s.id} />
                        <input type="hidden" name="active" value={String(!s.active)} />
                        <SubmitButton size="sm" variant="ghost">
                          {s.active ? "Deactivate" : "Activate"}
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
      <div className="cols-2">
        <Panel title="Register a student" sub="Students don't need a login to be counted for meals">
          <ActionForm action={createStudent} resetOnSuccess>
            <div className="form-grid">
              <Field label="Full name">
                <input name="full_name" required maxLength={120} />
              </Field>
              <Field label="Class">
                <select name="class_id" required defaultValue={classFilter}>
                  {structure.classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Roll number">
                <input name="roll_no" type="number" min={1} required />
              </Field>
              <Field label="Table (optional)">
                <select name="table_id" defaultValue="">
                  <option value="">Assign later</option>
                  {(tables ?? []).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.code}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <Field label="Dietary notes (optional)">
              <input name="dietary_notes" maxLength={200} />
            </Field>
            <div>
              <SubmitButton>Register student</SubmitButton>
            </div>
          </ActionForm>
        </Panel>
        <Panel title="Create a student login" sub="Lets the student view menus, cancel meals and see their table">
          <ActionForm action={createAccount} resetOnSuccess>
            <input type="hidden" name="role" value="student" />
            <Field label="Student record">
              <select name="student_id" required>
                {studentsWithoutLogin.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name} (roll {s.roll_no})
                  </option>
                ))}
              </select>
            </Field>
            <div className="form-grid">
              <Field label="Display name">
                <input name="full_name" required maxLength={120} />
              </Field>
              <Field label="Email">
                <input name="email" type="email" required />
              </Field>
              <Field label="Temporary password">
                <input name="password" type="password" minLength={8} required autoComplete="new-password" />
              </Field>
            </div>
            <div>
              <SubmitButton variant="ghost">Create login</SubmitButton>
            </div>
          </ActionForm>
        </Panel>
      </div>
    </>
  );
}
