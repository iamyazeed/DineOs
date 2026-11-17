import type { SupabaseClient } from "@supabase/supabase-js";
import { EmptyState, Pill } from "@/components/ui/primitives";
import { fmtDateTime } from "@/lib/utils";

const KIND_TONE = { emergency: "bad", cancellation: "bad", sponsored: "warn", menu_change: "teal", general: "dim" } as const;

/** Announcements visible to the current user (RLS filters by audience). */
export async function AnnouncementsFeed({ db, instId, limit = 20 }: { db: SupabaseClient; instId: string; limit?: number }) {
  const { data } = await db
    .from("announcements")
    .select("id, title, body, kind, audience, created_at")
    .eq("institution_id", instId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (!data?.length) return <EmptyState>No announcements yet.</EmptyState>;
  return (
    <div>
      {data.map((a) => (
        <article key={a.id} className="list-row items-start">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone={KIND_TONE[a.kind as keyof typeof KIND_TONE] ?? "dim"}>{a.kind.replace("_", " ")}</Pill>
              <h4 className="text-[14px] font-semibold">{a.title}</h4>
            </div>
            {a.body && <p className="mt-1 whitespace-pre-line text-[13px] text-dim">{a.body}</p>}
          </div>
          <span className="shrink-0 text-[11.5px] text-faint">{fmtDateTime(a.created_at)}</span>
        </article>
      ))}
    </div>
  );
}
