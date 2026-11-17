import { requireRole } from "@/lib/auth/guards";
import { EmptyState, PageHeader, Panel } from "@/components/ui/primitives";
import { fmtDateTime } from "@/lib/utils";

export default async function Documents() {
  const ctx = await requireRole("super_admin");
  const { data: docs } = await ctx.supabase
    .from("documents")
    .select("id, file_name, storage_path, size_bytes, created_at, institution:institutions(name)")
    .order("created_at", { ascending: false })
    .limit(200);
  const paths = (docs ?? []).map((d) => d.storage_path);
  const signed = paths.length ? (await ctx.supabase.storage.from("documents").createSignedUrls(paths, 3600)).data ?? [] : [];
  const url = new Map(signed.map((s) => [s.path, s.signedUrl]));
  return (
    <>
      <PageHeader eyebrow="Documents" title="Document exchange" sub="Files shared by institutions (private storage, signed links valid for 1 hour)." />
      <div className="mt-5" />
      <Panel>
        {(docs ?? []).length === 0 ? <EmptyState>No documents shared yet.</EmptyState> : (
          <div className="tablewrap">
            <table className="data">
              <thead><tr><th>File</th><th>Institution</th><th>Size</th><th>Uploaded</th><th /></tr></thead>
              <tbody>
                {(docs ?? []).map((d) => (
                  <tr key={d.id}>
                    <td className="font-semibold">{d.file_name}</td>
                    <td>{(Array.isArray(d.institution) ? d.institution[0] : (d.institution as { name: string } | null))?.name}</td>
                    <td className="mono">{d.size_bytes ? `${Math.ceil(d.size_bytes / 1024)} KB` : "—"}</td>
                    <td className="text-[12px] text-faint">{fmtDateTime(d.created_at)}</td>
                    <td><a className="btn btn-ghost btn-sm" href={url.get(d.storage_path) ?? "#"} target="_blank" rel="noopener noreferrer">Download</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
