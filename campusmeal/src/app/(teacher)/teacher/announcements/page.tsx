import { requireRole } from "@/lib/auth/guards";
import { AnnouncementsFeed } from "@/components/shared/announcements-feed";
import { PageHeader, Panel } from "@/components/ui/primitives";

export default async function TeacherAnnouncements() {
  const ctx = await requireRole("teacher");
  return (
    <>
      <PageHeader eyebrow="Communication" title="Announcements" sub="Notices from the institution administration." />
      <div className="mt-5" />
      <Panel>
        <AnnouncementsFeed db={ctx.supabase} instId={ctx.institution!.id} limit={40} />
      </Panel>
    </>
  );
}
