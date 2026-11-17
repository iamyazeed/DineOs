import { requireRole } from "@/lib/auth/guards";
import { AnnouncementsFeed } from "@/components/shared/announcements-feed";
import { PageHeader, Panel } from "@/components/ui/primitives";

export default async function StudentAnnouncements() {
  const ctx = await requireRole("student");
  return (
    <>
      <PageHeader eyebrow="Notices" title="Announcements" sub="Emergency notices, sponsored meals and menu changes." />
      <div className="mt-5" />
      <Panel>
        <AnnouncementsFeed db={ctx.supabase} instId={ctx.institution!.id} limit={40} />
      </Panel>
    </>
  );
}
