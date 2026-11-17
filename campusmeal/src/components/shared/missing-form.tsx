import { reportMissingMeal } from "@/features/distribution/actions";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { Field } from "@/components/ui/primitives";

export function MissingMealForm({ mealId, tables }: { mealId: string; tables: Array<{ key: string; label: string }> }) {
  return (
    <ActionForm action={reportMissingMeal} resetOnSuccess>
      <input type="hidden" name="meal_id" value={mealId} />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Field label="Table">
          <select name="table_id" defaultValue="">
            <option value="">General / whole hall</option>
            {tables.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Portions missing">
          <input name="portions_missing" type="number" min={0} max={100} defaultValue={1} required />
        </Field>
      </div>
      <Field label="What happened?">
        <textarea name="note" required maxLength={400} placeholder="e.g. Two portions short at collection" />
      </Field>
      <div>
        <SubmitButton variant="danger">Report to kitchen</SubmitButton>
      </div>
    </ActionForm>
  );
}
