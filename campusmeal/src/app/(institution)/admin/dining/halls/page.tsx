import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { requireRole } from "@/lib/auth/guards";
import { createHall, createTables, setHallActive, updateTable } from "@/features/campus-configuration/actions";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { EmptyState, Field, PageHeader, Panel, Pill } from "@/components/ui/primitives";

export default async function HallsPage() {
  const ctx = await requireRole("institution_admin");
  const inst = ctx.institution!;
  const db = ctx.supabase;
  const [{ data: halls }, { data: tables }, { data: seats }] = await Promise.all([
    db.from("dining_halls").select("id, name, code, active").eq("institution_id", inst.id).order("sort_order"),
    db.from("dining_tables").select("id, hall_id, code, capacity, active").eq("institution_id", inst.id).order("code"),
    db.from("table_assignments").select("table_id").eq("institution_id", inst.id).is("end_date", null).range(0, 9999),
  ]);
  const seated = new Map<string, number>();
  for (const s of seats ?? []) seated.set(s.table_id, (seated.get(s.table_id) ?? 0) + 1);
  return (
    <>
      <PageHeader
        eyebrow="Configuration"
        title="Dining halls & tables"
        sub={`Any number of halls and tables. Default capacity is ${inst.default_table_capacity}; override per table where needed.`}
        actions={<Link href="/admin/dining/tables" className="btn btn-ghost">Seat assignments <ArrowRight size={16} aria-hidden /></Link>}
      />
      <div className="mt-5" />
      {(halls ?? []).length === 0 && (
        <Panel>
          <EmptyState>No dining halls yet — add your first hall below.</EmptyState>
        </Panel>
      )}
      {(halls ?? []).map((h) => {
        const ts = (tables ?? []).filter((t) => t.hall_id === h.id);
        const cap = ts.filter((t) => t.active).reduce((a, t) => a + (t.capacity ?? inst.default_table_capacity), 0);
        const used = ts.reduce((a, t) => a + (seated.get(t.id) ?? 0), 0);
        return (
          <Panel
            key={h.id}
            title={
              <span className="flex items-center gap-2">
                {h.name} <span className="mono text-[12px] text-dim">{h.code}</span> {h.active ? <Pill tone="good">Open</Pill> : <Pill tone="bad">Closed</Pill>}
              </span>
            }
            sub={`${ts.length} tables · ${used}/${cap} seats assigned`}
            actions={
              <ActionForm action={setHallActive} inline confirm={h.active ? "Close this hall? Its students will be excluded from meal counts until it reopens." : undefined}>
                <input type="hidden" name="hall_id" value={h.id} />
                <input type="hidden" name="active" value={String(!h.active)} />
                <SubmitButton size="sm" variant={h.active ? "danger" : "teal"}>
                  {h.active ? "Close hall" : "Reopen hall"}
                </SubmitButton>
              </ActionForm>
            }
          >
            {ts.length === 0 ? (
              <EmptyState>No tables in this hall yet.</EmptyState>
            ) : (
              <div className="tile-grid">
                {ts.map((t) => (
                  <div key={t.id} className="tile" style={{ opacity: t.active ? 1 : 0.55 }}>
                    <div className="flex items-center justify-between">
                      <span className="code">{t.code}</span>
                      <span className="mono text-[12px] text-dim">
                        {seated.get(t.id) ?? 0}/{t.capacity ?? inst.default_table_capacity}
                      </span>
                    </div>
                    <details className="disclosure mt-1">
                      <summary className="text-[11.5px] text-amber">Edit</summary>
                      <ActionForm action={updateTable} className="mt-2">
                        <input type="hidden" name="table_id" value={t.id} />
                        <Field label="Custom capacity">
                          <input name="capacity" type="number" min={1} max={100} defaultValue={t.capacity ?? ""} placeholder={`Default ${inst.default_table_capacity}`} />
                        </Field>
                        <Field label="Status">
                          <select name="active" defaultValue={String(t.active)}>
                            <option value="true">In use</option>
                            <option value="false">Out of service</option>
                          </select>
                        </Field>
                        <SubmitButton size="sm">Save</SubmitButton>
                      </ActionForm>
                    </details>
                  </div>
                ))}
              </div>
            )}
            <ActionForm action={createTables} inline className="mt-4">
              <input type="hidden" name="hall_id" value={h.id} />
              <span className="text-[12.5px] text-dim">Add</span>
              <input className="input w-20" name="count" type="number" min={1} max={100} defaultValue={1} aria-label="Number of tables" />
              <span className="text-[12.5px] text-dim">table(s), capacity</span>
              <input className="input w-28" name="capacity" type="number" min={1} max={100} placeholder={`default ${inst.default_table_capacity}`} aria-label="Capacity" />
              <SubmitButton size="sm" variant="ghost">
                Add tables
              </SubmitButton>
            </ActionForm>
          </Panel>
        );
      })}
      <Panel title="Add a dining hall">
        <ActionForm action={createHall} resetOnSuccess inline>
          <input className="input w-60" name="name" required placeholder="Hall name" maxLength={80} />
          <input className="input w-28" name="code" required placeholder="Code (e.g. C)" maxLength={6} />
          <SubmitButton>Add hall</SubmitButton>
        </ActionForm>
      </Panel>
    </>
  );
}
