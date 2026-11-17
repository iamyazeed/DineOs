import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/auth/guards";
import { createAccount } from "@/features/campus-configuration/actions";
import { bulkCreateStaff } from "@/features/people/actions";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { BulkImport } from "@/components/forms/bulk-import";
import { EmptyState, Field, PageHeader, Panel, Pill } from "@/components/ui/primitives";
import { ROLE_LABEL } from "@/lib/constants";
import type { Role } from "@/types/domain";

export default async function TeachersPage() {
  const ctx = await requireRole("institution_admin");
  const inst = ctx.institution!;
  const [{ data: members }, { data: classes }] = await Promise.all([
    ctx.supabase.from("memberships").select("user_id, role, profile:profiles(full_name, email)").eq("institution_id", inst.id).in("role", ["teacher", "chef", "institution_admin"]),
    ctx.supabase.from("classes").select("name, teacher_id").eq("institution_id", inst.id),
  ]);
  const classesOf = (uid: string) => (classes ?? []).filter((c) => c.teacher_id === uid).map((c) => c.name);
  return (
    <>
      <PageHeader eyebrow="People" title="Teachers & staff" sub="Staff with DineOS logins at this institution" actions={<Link href="/admin/students" className="btn btn-ghost"><ArrowLeft size={16} aria-hidden /> Students</Link>} />
      <div className="mt-5" />
      <div className="cols">
        <Panel title="Staff">
          {(members ?? []).length === 0 ? (
            <EmptyState>No staff yet.</EmptyState>
          ) : (
            <div className="tablewrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Role</th>
                    <th>Class teacher of</th>
                  </tr>
                </thead>
                <tbody>
                  {(members ?? []).map((m) => {
                    const p = (Array.isArray(m.profile) ? m.profile[0] : m.profile) as { full_name: string; email: string } | null;
                    return (
                      <tr key={`${m.user_id}-${m.role}`}>
                        <td>
                          <div className="font-semibold">{p?.full_name}</div>
                          <div className="text-[11.5px] text-faint">{p?.email}</div>
                        </td>
                        <td>
                          <Pill tone={m.role === "teacher" ? "teal" : m.role === "chef" ? "warn" : "dim"}>{ROLE_LABEL[m.role as Role]}</Pill>
                        </td>
                        <td className="text-[12.5px]">{classesOf(m.user_id).join(", ") || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-3 text-[12px] text-faint">
            Assign class teachers on the <Link href="/admin/classes" className="underline">Classes</Link> page.
          </p>
        </Panel>
        <Panel title="Add a teacher or chef" sub="Creates a login with a starting password">
          <ActionForm action={createAccount} resetOnSuccess>
            <Field label="Role">
              <select name="role" defaultValue="teacher">
                <option value="teacher">Teacher</option>
                <option value="chef">Chef</option>
              </select>
            </Field>
            <Field label="Full name">
              <input name="full_name" required maxLength={120} />
            </Field>
            <Field label="Email">
              <input name="email" type="text" inputMode="email" autoCapitalize="none" required />
            </Field>
            <Field label="Temporary password">
              <input name="password" type="password" minLength={6} required autoComplete="new-password" />
            </Field>
            <div>
              <SubmitButton>Create login</SubmitButton>
            </div>
          </ActionForm>
        </Panel>
      </div>
      <Panel title="Add teachers and chefs in bulk" sub="Paste rows or upload a CSV">
        <BulkImport
          action={bulkCreateStaff}
          fileName="staff.csv"
          submitLabel="Add staff"
          sample={"name,email,role,password\nUsman,usman@kmoia.edu,teacher,\nBilal,bilal@kmoia.edu,chef,"}
          columns={[
            { key: "name", label: "Name", required: true, aliases: ["full name"] },
            { key: "email", label: "Email", required: true },
            { key: "role", label: "Role (teacher / chef)", required: true, aliases: ["role", "type"] },
            { key: "password", label: "Password" },
          ]}
        >
          <Field label="Password for rows that leave it blank">
            <input name="default_password" type="password" minLength={6} autoComplete="new-password" />
          </Field>
        </BulkImport>
      </Panel>
    </>
  );
}
