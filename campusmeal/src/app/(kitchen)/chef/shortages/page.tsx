import { requireRole } from "@/lib/auth/guards";
import { IngredientPage } from "@/components/shared/ingredient-page";

export default async function Shortages() {
  const ctx = await requireRole("chef");
  return <IngredientPage db={ctx.supabase} instId={ctx.institution!.id} kind="shortage" />;
}
