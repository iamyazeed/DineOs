import { requireRole } from "@/lib/auth/guards";
import { getUniversitySummary } from "@/features/institutions/queries";
import { createInstitution, setInstitutionActive } from "@/features/institutions/actions";
import { bulkCreateInstitutionAdmins, createInstitutionAdmin } from "@/features/people/actions";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { BulkImport } from "@/components/forms/bulk-import";
import { EmptyState, Field, PageHeader, Panel, Pill } from "@/components/ui/primitives";
import { pct, todayIn } from "@/lib/utils";

export default async function Institutions() {
  const ctx = await requireRole("super_admin");
  const [{ rows }, { data: admins }] = await Promise.all([
    getUniversitySummary(ctx.supabase, todayIn("UTC")),
    ctx.supabase.from("memberships").select("institution_id, profile:profiles(full_name, email)").eq("role", "institution_admin"),
  ]);
  const adminsOf = (id: string) =>
    (admins ?? [])
      .filter((a) => a.institution_id === id)
      .map((a) => (Array.isArray(a.profile) ? a.profile[0] : a.profile) as { full_name: string; email: string } | null)
      .filter((p): p is { full_name: string; email: string } => !!p);
  return (
    <>
      <PageHeader eyebrow="Tenants" title="Institutions" sub="Each institution operates independently; its data is isolated by Row Level Security." />
      <div className="mt-5" />
      <Panel title="Registered institutions" sub="Last 14 days">
        {rows.length === 0 ? (
          <EmptyState>No institutions yet.</EmptyState>
        ) : (
          <div className="tablewrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Institution</th>
                  <th className="num">Meals</th>
                  <th className="num">Portions</th>
                  <th className="num">Cancel rate</th>
                  <th>Admins</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div className="font-semibold">{r.name}</div>
                      <div className="mono text-[11.5px] text-faint">{r.code} · {r.timezone}</div>
                    </td>
                    <td className="num">{r.meals}</td>
                    <td className="num">{r.portions}</td>
                    <td className="num">{pct(r.cancelled, r.eligible)}%</td>
                    <td className="text-[12.5px]">
                      {adminsOf(r.id).length === 0 ? (
                        <span className="text-bad">None yet</span>
                      ) : (
                        adminsOf(r.id).map((a) => (
                          <div key={a.email}>
                            {a.full_name} <span className="text-faint">· {a.email}</span>
                          </div>
                        ))
                      )}
                    </td>
                    <td>{r.active ? <Pill tone="good">Active</Pill> : <Pill tone="bad">Suspended</Pill>}</td>
                    <td>
                      <ActionForm action={setInstitutionActive} inline>
                        <input type="hidden" name="id" value={r.id} />
                        <input type="hidden" name="active" value={String(!r.active)} />
                        <SubmitButton size="sm" variant="ghost">{r.active ? "Suspend" : "Activate"}</SubmitButton>
                      </ActionForm>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <Panel title="Register an institution">
        <ActionForm action={createInstitution} resetOnSuccess>
          <div className="form-grid">
            <Field label="Name"><input name="name" required maxLength={120} /></Field>
            <Field label="Code"><input name="code" required placeholder="e.g. EAST" maxLength={16} /></Field>
            <Field label="Timezone"><input name="timezone" required defaultValue="Asia/Kolkata" /></Field>
          </div>
          <div className="form-grid">
            <Field label="Admin name (optional)"><input name="admin_name" maxLength={120} /></Field>
            <Field label="Admin email (optional)"><input name="admin_email" type="email" /></Field>
            <Field label="Admin starting password"><input name="admin_password" type="password" autoComplete="new-password" minLength={6} /></Field>
          </div>
          <div><SubmitButton>Register</SubmitButton></div>
        </ActionForm>
      </Panel>
      <div className="cols-2">
        <Panel title="Add an institution admin" sub="Gives someone admin access to one institution">
          <ActionForm action={createInstitutionAdmin} resetOnSuccess>
            <Field label="Institution">
              <select name="institution_id" required>
                {rows.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.code})
                  </option>
                ))}
              </select>
            </Field>
            <div className="form-grid">
              <Field label="Full name"><input name="full_name" required maxLength={120} /></Field>
              <Field label="Email"><input name="email" type="text" inputMode="email" required autoCapitalize="none" /></Field>
              <Field label="Starting password"><input name="password" type="password" required minLength={6} autoComplete="new-password" /></Field>
            </div>
            <div><SubmitButton>Add admin</SubmitButton></div>
          </ActionForm>
        </Panel>
        <Panel title="Add admins in bulk" sub="Paste rows or upload a CSV">
          <BulkImport
            action={bulkCreateInstitutionAdmins}
            fileName="institution-admins.csv"
            submitLabel="Add admins"
            sample={"name,email,institution,password\nYusuf,yusuf@kmoia.edu,KMOIA,changeme1\nHamza,hamza@kmoia.edu,KMOIA,"}
            columns={[
              { key: "name", label: "Name", required: true, aliases: ["full name"] },
              { key: "email", label: "Email", required: true },
              { key: "institution", label: "Institution code", required: true, aliases: ["code", "institution code", "college"] },
              { key: "password", label: "Password" },
            ]}
          >
            <Field label="Password for rows that leave it blank">
              <input name="default_password" type="password" minLength={6} autoComplete="new-password" />
            </Field>
          </BulkImport>
        </Panel>
      </div>
    </>
  );
}
