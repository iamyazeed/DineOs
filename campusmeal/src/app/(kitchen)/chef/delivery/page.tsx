import { requireRole } from "@/lib/auth/guards";
import { getMealBreakdown, resolveMealSelection } from "@/features/meals/queries";
import { getDistributionState } from "@/features/distribution/queries";
import { updateDelivery } from "@/features/kitchen/actions";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { MealPicker } from "@/components/shared/meal-picker";
import { EmptyState, Field, Notice, PageHeader, Panel } from "@/components/ui/primitives";
import { fmtDateTime } from "@/lib/utils";
import type { PageProps } from "@/types/page";

export default async function ChefDelivery({ searchParams }: PageProps) {
  const ctx = await requireRole("chef");
  const inst = ctx.institution!;
  const db = ctx.supabase;
  const { date, today, meals, selected } = await resolveMealSelection(db, inst, await searchParams);
  const header = <PageHeader eyebrow="Logistics" title="Delivery status" sub="Record when food leaves the kitchen and reaches each hall, and the kitchen-side serving status." />;
  if (!selected)
    return (
      <>
        {header}
        <MealPicker basePath="/chef/delivery" date={date} today={today} meals={meals} />
        <Panel>
          <EmptyState>No meals on this date.</EmptyState>
        </Panel>
      </>
    );
  const [b, state] = await Promise.all([getMealBreakdown(db, inst, selected), getDistributionState(db, selected.id)]);
  return (
    <>
      {header}
      <MealPicker basePath="/chef/delivery" date={date} today={today} meals={meals} selectedId={selected.id} />
      {selected.status === "cancelled" ? (
        <Notice tone="bad">This meal is cancelled — nothing to deliver.</Notice>
      ) : b.byHall.length === 0 ? (
        <Panel>
          <EmptyState>No halls are serving this meal.</EmptyState>
        </Panel>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {b.byHall.map((h) => {
            const d = state.deliveries.get(h.key);
            return (
              <Panel key={h.key} title={h.label} sub={`${h.regular} regular + ${h.separate} separate portions`}>
                <ActionForm action={updateDelivery}>
                  <input type="hidden" name="meal_id" value={selected.id} />
                  <input type="hidden" name="hall_id" value={h.key} />
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Food delivery">
                      <select name="delivery_status" defaultValue={d?.delivery_status ?? "pending"}>
                        <option value="pending">Pending</option>
                        <option value="dispatched">Dispatched</option>
                        <option value="delivered">Delivered to hall</option>
                      </select>
                    </Field>
                    <Field label="Kitchen-side distribution">
                      <select name="kitchen_distribution_status" defaultValue={d?.kitchen_distribution_status ?? "pending"}>
                        <option value="pending">Pending</option>
                        <option value="serving">Serving</option>
                        <option value="completed">Completed</option>
                      </select>
                    </Field>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <SubmitButton size="sm">Save</SubmitButton>
                    {d && <span className="text-[11.5px] text-faint">Updated {fmtDateTime(d.updated_at)}</span>}
                  </div>
                </ActionForm>
              </Panel>
            );
          })}
        </div>
      )}
    </>
  );
}
