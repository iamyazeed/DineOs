import type { MealBreakdown, TableBucket } from "@/features/meals/calc";
import type { DistributionRecord, DeliveryRecord } from "@/features/distribution/queries";
import { markTableDistribution } from "@/features/distribution/actions";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { EmptyState, Panel, Pill } from "@/components/ui/primitives";
import { StatusPill } from "@/components/shared/status";
import { fmtDateTime } from "@/lib/utils";

export interface SupplierInfo {
  supplier?: string;
  substitute?: string;
}

function TableStatus({ rec }: { rec?: DistributionRecord }) {
  if (rec?.completed_at) return <Pill tone="good">Distributed</Pill>;
  if (rec?.collected_at) return <Pill tone="teal">Collected</Pill>;
  return <Pill tone="dim">Awaiting</Pill>;
}

/**
 * Hall-by-hall table checklist. `mode="teacher"` adds the teacher-only
 * actions (collected / completed). Other roles see it read-only.
 */
export function TableDistribution({
  b,
  mealId,
  records,
  deliveries,
  suppliers,
  missingByTable,
  mode,
  showStudents,
}: {
  b: MealBreakdown;
  mealId: string;
  records: Map<string, DistributionRecord>;
  deliveries?: Map<string, DeliveryRecord>;
  suppliers?: Map<string, SupplierInfo>;
  missingByTable?: Map<string, number>;
  mode: "teacher" | "readonly";
  showStudents?: boolean;
}) {
  if (b.byTable.length === 0) return <EmptyState>No tables with seated students. Configure halls and seat assignments first.</EmptyState>;
  const halls = new Map<string, TableBucket[]>();
  for (const t of b.byTable) halls.set(t.hall_id, [...(halls.get(t.hall_id) ?? []), t]);
  return (
    <>
      {[...halls.entries()].map(([hallId, tables]) => {
        const done = tables.filter((t) => records.get(t.key)?.completed_at).length;
        const del = deliveries?.get(hallId);
        return (
          <Panel
            key={hallId}
            title={tables[0].hall_name}
            sub={`${tables.length} tables · ${tables.reduce((a, t) => a + t.regular, 0)} regular · ${tables.reduce((a, t) => a + t.separate, 0)} separate · ${done}/${tables.length} distributed`}
            actions={
              del ? (
                <div className="flex flex-wrap gap-2">
                  <span className="text-[12px] text-dim">Kitchen:</span>
                  <StatusPill status={del.delivery_status === "pending" ? "pending_delivery" : del.delivery_status} />
                  <StatusPill status={del.kitchen_distribution_status} />
                </div>
              ) : (
                <Pill tone="dim">Kitchen delivery pending</Pill>
              )
            }
          >
            <div className="tablewrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Table</th>
                    <th className="num">Seated</th>
                    <th className="num">Regular</th>
                    <th className="num">Separate</th>
                    <th>Supplier</th>
                    <th>Status</th>
                    {missingByTable && <th className="num">Missing</th>}
                    {mode === "teacher" && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {tables.map((t) => {
                    const rec = records.get(t.key);
                    const sup = suppliers?.get(t.key);
                    return (
                      <tr key={t.key}>
                        <td>
                          {showStudents ? (
                            <details className="disclosure">
                              <summary className="mono font-bold">
                                {t.label} <span className="text-[11px] font-normal text-dim">▾</span>
                              </summary>
                              <ul className="mt-2 space-y-1 text-[12px]">
                                {t.students.map((s) => (
                                  <li key={s.id} className="flex items-center gap-2">
                                    <span className="mono w-6 text-faint">{s.roll_no}</span>
                                    <span className="flex-1">{s.full_name}</span>
                                    <span className="text-faint">{s.class_name}</span>
                                    {s.state !== "regular" && <Pill tone={s.state === "separate" ? "good" : "bad"}>{s.state}</Pill>}
                                  </li>
                                ))}
                              </ul>
                            </details>
                          ) : (
                            <span className="mono font-bold">{t.label}</span>
                          )}
                        </td>
                        <td className="num">
                          {t.assigned}/{t.capacity}
                        </td>
                        <td className="num font-bold">{t.regular}</td>
                        <td className="num">{t.separate || "–"}</td>
                        <td className="text-[12.5px]">
                          {sup?.substitute ? (
                            <>
                              <s className="text-faint">{sup.supplier}</s> → {sup.substitute}
                            </>
                          ) : (
                            sup?.supplier ?? <span className="text-faint">—</span>
                          )}
                        </td>
                        <td>
                          <TableStatus rec={rec} />
                          {rec?.completed_at && <div className="text-[11px] text-faint">{fmtDateTime(rec.completed_at)}</div>}
                        </td>
                        {missingByTable && <td className="num">{missingByTable.get(t.key) ? <Pill tone="bad">{missingByTable.get(t.key)}</Pill> : "–"}</td>}
                        {mode === "teacher" && (
                          <td>
                            <ActionForm action={markTableDistribution} inline>
                              <input type="hidden" name="meal_id" value={mealId} />
                              <input type="hidden" name="table_id" value={t.key} />
                              {!rec?.collected_at && (
                                <SubmitButton size="sm" variant="teal" name="step" value="collected">
                                  Food collected
                                </SubmitButton>
                              )}
                              {!rec?.completed_at && (
                                <SubmitButton size="sm" name="step" value="completed">
                                  Distribution done
                                </SubmitButton>
                              )}
                              {(rec?.collected_at || rec?.completed_at) && (
                                <SubmitButton size="sm" variant="ghost" name="step" value="undo">
                                  Undo
                                </SubmitButton>
                              )}
                            </ActionForm>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>
        );
      })}
    </>
  );
}
