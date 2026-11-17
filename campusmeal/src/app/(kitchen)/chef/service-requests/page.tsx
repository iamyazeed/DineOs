import { requireRole } from "@/lib/auth/guards";
import { createServiceRequest } from "@/features/kitchen/actions";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { ServiceRequestList } from "@/components/shared/service-requests";
import { Field, PageHeader, Panel } from "@/components/ui/primitives";
import { SERVICE_CATEGORIES } from "@/lib/constants";

export default async function ChefServiceRequests() {
  const ctx = await requireRole("chef");
  return (
    <>
      <PageHeader eyebrow="Kitchen" title="Kitchen service requests" sub="Raise maintenance, gas, equipment or ingredient needs. The institution admin reviews and updates the status." />
      <div className="mt-5" />
      <div className="cols">
        <Panel title="Your requests">
          <ServiceRequestList db={ctx.supabase} instId={ctx.institution!.id} />
        </Panel>
        <Panel title="New request">
          <ActionForm action={createServiceRequest} resetOnSuccess>
            <Field label="Category">
              <select name="category" required>
                {Object.entries(SERVICE_CATEGORIES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Title">
              <input name="title" required maxLength={120} />
            </Field>
            <Field label="Details">
              <textarea name="details" maxLength={600} />
            </Field>
            <Field label="Priority">
              <select name="priority" defaultValue="normal">
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="urgent">Urgent</option>
              </select>
            </Field>
            <div>
              <SubmitButton>Submit request</SubmitButton>
            </div>
          </ActionForm>
        </Panel>
      </div>
    </>
  );
}
