import type { SupabaseClient } from "@supabase/supabase-js";
import { recordIngredient } from "@/features/kitchen/actions";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { EmptyState, Field, PageHeader, Panel } from "@/components/ui/primitives";
import { fmtDateTime } from "@/lib/utils";

/** Shared body of the chef's Ingredient Usage and Stock Shortages pages. */
export async function IngredientPage({ db, instId, kind }: { db: SupabaseClient; instId: string; kind: "usage" | "shortage" }) {
  const [{ data: items }, { data: tx }] = await Promise.all([
    db.from("ingredient_items").select("name, unit").eq("institution_id", instId).order("name"),
    db
      .from("ingredient_transactions")
      .select("id, quantity, note, created_at, item:ingredient_items(name, unit)")
      .eq("institution_id", instId)
      .eq("kind", kind)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  const usage = kind === "usage";
  return (
    <>
      <PageHeader
        eyebrow="Kitchen"
        title={usage ? "Ingredient usage" : "Stock shortages"}
        sub={usage ? "Record ingredients consumed for meal preparation." : "Report ingredients running short. The institution admin sees these on Kitchen Monitoring."}
      />
      <div className="mt-5" />
      <div className="cols">
        <Panel title={usage ? "Recent usage" : "Reported shortages"}>
          {(tx ?? []).length === 0 ? (
            <EmptyState>Nothing recorded yet.</EmptyState>
          ) : (
            <div className="tablewrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th className="num">Quantity</th>
                    <th>Note</th>
                    <th>When</th>
                  </tr>
                </thead>
                <tbody>
                  {(tx ?? []).map((t) => {
                    const item = (Array.isArray(t.item) ? t.item[0] : t.item) as { name: string; unit: string } | null;
                    return (
                      <tr key={t.id}>
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
        <Panel title={usage ? "Record usage" : "Report a shortage"}>
          <ActionForm action={recordIngredient} resetOnSuccess>
            <input type="hidden" name="kind" value={kind} />
            <Field label="Ingredient">
              <input name="item_name" list="ingredient-items" required maxLength={80} />
              <datalist id="ingredient-items">
                {(items ?? []).map((i) => (
                  <option key={i.name} value={i.name} />
                ))}
              </datalist>
            </Field>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Field label={usage ? "Quantity used" : "Quantity needed"}>
                <input name="quantity" type="number" min={0.01} step={0.01} required />
              </Field>
              <Field label="Unit (new items)">
                <input name="unit" placeholder="kg" maxLength={12} />
              </Field>
            </div>
            <Field label="Note">
              <input name="note" maxLength={300} />
            </Field>
            <div>
              <SubmitButton variant={usage ? "primary" : "danger"}>{usage ? "Record usage" : "Report shortage"}</SubmitButton>
            </div>
          </ActionForm>
        </Panel>
      </div>
    </>
  );
}
