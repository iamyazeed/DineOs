import type { SupabaseClient } from "@supabase/supabase-js";
import { sendInstitutionalMessage } from "@/features/communication/actions";
import { ActionForm, SubmitButton } from "@/components/forms/action-form";
import { EmptyState, Field } from "@/components/ui/primitives";
import { fmtDateTime } from "@/lib/utils";

/** Message thread between one institution and university administration. */
export async function Conversation({ db, instId, as }: { db: SupabaseClient; instId: string; as: "institution_admin" | "super_admin" }) {
  const [{ data: msgs }, { data: docs }] = await Promise.all([
    db.from("institutional_messages").select("id, direction, subject, body, created_at, sender:profiles(full_name)").eq("institution_id", instId).order("created_at", { ascending: true }).limit(200),
    db.from("documents").select("id, message_id, storage_path, file_name, size_bytes").eq("institution_id", instId),
  ]);
  const paths = (docs ?? []).map((d) => d.storage_path);
  const signed = paths.length ? (await db.storage.from("documents").createSignedUrls(paths, 3600)).data ?? [] : [];
  const urlOf = new Map(signed.map((s) => [s.path, s.signedUrl]));
  const docsByMsg = new Map<string, typeof docs>();
  for (const d of docs ?? []) if (d.message_id) docsByMsg.set(d.message_id, [...(docsByMsg.get(d.message_id) ?? []), d]);
  const mine = as === "institution_admin" ? "to_university" : "to_institution";
  return (
    <>
      <div className="mb-4 grid max-h-[520px] gap-3 overflow-auto pr-1">
        {(msgs ?? []).length === 0 && <EmptyState>No messages yet.</EmptyState>}
        {(msgs ?? []).map((m) => {
          const own = m.direction === mine;
          const sender = (Array.isArray(m.sender) ? m.sender[0] : m.sender) as { full_name: string } | null;
          return (
            <div
              key={m.id}
              className="max-w-[85%] rounded-[14px] p-3 text-[13.5px]"
              style={{
                marginLeft: own ? "auto" : 0,
                background: own ? "color-mix(in srgb, var(--amber) 13%, transparent)" : "var(--glass2)",
                border: "1px solid var(--line)",
              }}
            >
              <div className="mb-1 text-[11.5px] text-dim">
                {sender?.full_name ?? (m.direction === "to_university" ? "Institution" : "University")} · {fmtDateTime(m.created_at)}
              </div>
              {m.subject && <div className="font-semibold">{m.subject}</div>}
              <p className="whitespace-pre-line">{m.body}</p>
              {(docsByMsg.get(m.id) ?? []).map((d) => (
                <a key={d.id} href={urlOf.get(d.storage_path) ?? "#"} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm mt-2">
                  📎 {d.file_name} {d.size_bytes ? `(${Math.ceil(d.size_bytes / 1024)} KB)` : ""}
                </a>
              ))}
            </div>
          );
        })}
      </div>
      <ActionForm action={sendInstitutionalMessage} resetOnSuccess>
        <input type="hidden" name="role" value={as} />
        <input type="hidden" name="institution_id" value={instId} />
        <Field label="Subject (optional)">
          <input name="subject" maxLength={140} />
        </Field>
        <Field label="Message">
          <textarea name="body" required maxLength={4000} />
        </Field>
        <Field label="Attach a document (optional, max 10 MB)">
          <input name="file" type="file" />
        </Field>
        <div>
          <SubmitButton>{as === "institution_admin" ? "Send to university" : "Reply"}</SubmitButton>
        </div>
      </ActionForm>
    </>
  );
}
