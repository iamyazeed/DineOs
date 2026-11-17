import { requireRole } from "@/lib/auth/guards";
import { getDayMeals, getMealBreakdown } from "@/features/meals/queries";
import { EmptyState, PageHeader, Panel, ProgressBar } from "@/components/ui/primitives";
import { OnTimePill, PrepPill, StatusPill } from "@/components/shared/status";
import { fmtDateTime, fmtTime, todayIn } from "@/lib/utils";

export default async function KitchenMonitoring() {
  const ctx = await requireRole("institution_admin");
  const inst = ctx.institution!;
  const db = ctx.supabase;
  const today = todayIn(inst.timezone);
  const meals = await getDayMeals(db, inst, today);
  const [breakdowns, tx] = await Promise.all([
    Promise.all(meals.map((m) => getMealBreakdown(db, inst, m))),
    db
      .from("ingredient_transactions")
      .select("id, kind, quantity, note, created_at, item:ingredient_items(name, unit)")
      .eq("institution_id", inst.id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  return (
    <>
      <PageHeader eyebrow="Kitchen" title="Kitchen monitoring" sub="Read-only view of the chef's live preparation updates, delays and stock reports." />
      <div className="mt-5" />
      <Panel title="Preparation progress — today">
        {meals.length === 0 ? (
          <EmptyState>No meals today.</EmptyState>
        ) : (
          <div className="grid gap-3 md:grid-cols-3">
            {meals.map((m, i) => (
              <div key={m.id} className="glass rounded-[14px] p-4">
                <div className="flex items-center justify-between">
                  <div className="font-semibold">{m.schedule.name}</div>
                  <span className="mono text-[12px] text-dim">{fmtTime(m.schedule.serve_time)}</span>
                </div>
                <div className="my-3 flex flex-wrap gap-2">
                  <PrepPill prep={m.prep} />
                  {m.status !== "cancelled" ? <OnTimePill prep={m.prep} /> : <StatusPill status="rejected" />}
                </div>
                <ProgressBar value={m.prep?.progress ?? 0} bad={m.prep?.status === "delayed"} />
                <div className="mt-3 text-[12.5px] text-dim">
                  <span className="mono">{breakdowns[i].regular}</span> regular · <span className="mono">{breakdowns[i].separatePortions}</span> separate
                </div>
                {m.prep?.delay_reason && <div className="notice notice-bad mt-2 text-[12px]">{m.prep.delay_reason}</div>}
                {m.prep && <div className="mt-2 text-[11px] text-faint">Updated {fmtDateTime(m.prep.updated_at)}</div>}
              </div>
            ))}
          </div>
        )}
      </Panel>
      <Panel title="Ingredient usage & shortages" sub="Recorded by the chef">
        {(tx.data ?? []).length === 0 ? (
          <EmptyState>Nothing recorded yet.</EmptyState>
        ) : (
          <div className="tablewrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Item</th>
                  <th className="num">Qty</th>
                  <th>Note</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {(tx.data ?? []).map((t) => {
                  const item = (Array.isArray(t.item) ? t.item[0] : t.item) as { name: string; unit: string } | null;
                  return (
                    <tr key={t.id}>
                      <td>{t.kind === "shortage" ? <span className="pill pill-bad">Shortage</span> : <span className="pill pill-teal">Usage</span>}</td>
                      <td className="font-semibold">{item?.name}</td>
                      <td className="num">
                        {t.quantity} {item?.unit}
                      </td>
                      <td className="text-[12.5px] text-dim">{t.note}</td>
                      <td className="text-[12px] text-faint">{fmtDateTime(t.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
