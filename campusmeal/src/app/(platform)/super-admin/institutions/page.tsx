import { requireRole } from "@/lib/auth/guards";
import { getUniversitySummary } from "@/features/institutions/queries";
import { createInstitution, setInstitutionActive } from "@/features/institutions/actions";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { EmptyState, Field, PageHeader, Panel, Pill } from "@/components/ui/primitives";
import { pct, todayIn } from "@/lib/utils";

export default async function Institutions() {
  const ctx = await requireRole("super_admin");
  const { rows } = await getUniversitySummary(ctx.supabase, todayIn("UTC"));
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
            <Field label="Timezone"><input name="timezone" required defaultValue="Australia/Sydney" /></Field>
          </div>
          <div className="form-grid">
            <Field label="Admin name (optional)"><input name="admin_name" maxLength={120} /></Field>
            <Field label="Admin email (optional)"><input name="admin_email" type="email" /></Field>
            <Field label="Admin temporary password"><input name="admin_password" type="password" autoComplete="new-password" /></Field>
          </div>
          <div><SubmitButton>Register</SubmitButton></div>
        </ActionForm>
      </Panel>
    </>
  );
}
