import { requireRole } from "@/lib/auth/guards";
import { publishAnnouncement } from "@/features/announcements/actions";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { AnnouncementsFeed } from "@/components/shared/announcements-feed";
import { Field, PageHeader, Panel } from "@/components/ui/primitives";

export default async function AdminAnnouncements() {
  const ctx = await requireRole("institution_admin");
  return (
    <>
      <PageHeader eyebrow="Communication" title="Announcements" sub="Publish general or emergency notices to students, teachers and kitchen staff." />
      <div className="mt-5" />
      <div className="cols">
        <Panel title="Published">
          <AnnouncementsFeed db={ctx.supabase} instId={ctx.institution!.id} limit={40} />
        </Panel>
        <Panel title="New announcement">
          <ActionForm action={publishAnnouncement} resetOnSuccess>
            <Field label="Title">
              <input name="title" required maxLength={140} />
            </Field>
            <Field label="Message">
              <textarea name="body" maxLength={2000} />
            </Field>
            <Field label="Type">
              <select name="kind" defaultValue="general">
                <option value="general">General</option>
                <option value="emergency">Emergency</option>
                <option value="sponsored">Sponsored meal</option>
                <option value="menu_change">Menu change</option>
              </select>
            </Field>
            <div>
              <div className="mb-1 text-[12px] font-semibold text-dim">Audience</div>
              <div className="flex flex-wrap gap-4 text-[13px]">
                {(["student", "teacher", "chef"] as const).map((a) => (
                  <label key={a} className="flex items-center gap-1.5">
                    <input type="checkbox" name="audience[]" value={a} defaultChecked /> {a === "chef" ? "Kitchen" : `${a[0].toUpperCase()}${a.slice(1)}s`}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <SubmitButton>Publish</SubmitButton>
            </div>
          </ActionForm>
        </Panel>
      </div>
    </>
  );
}
