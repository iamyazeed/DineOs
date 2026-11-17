import { requireRole } from "@/lib/auth/guards";
import { Conversation } from "@/components/shared/conversation";
import { PageHeader, Panel } from "@/components/ui/primitives";

export default async function AdminCommunication() {
  const ctx = await requireRole("institution_admin");
  return (
    <>
      <PageHeader eyebrow="Communication" title="University communication" sub="Messages and documents shared with university administration. Files are private to your institution and the university." />
      <div className="mt-5" />
      <Panel>
        <Conversation db={ctx.supabase} instId={ctx.institution!.id} as="institution_admin" />
      </Panel>
    </>
  );
}
