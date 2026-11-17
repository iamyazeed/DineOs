import Link from "next/link";
import { isSupabaseConfigured } from "@/config/env";

export default function Setup() {
  const ok = isSupabaseConfigured();
  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="panel glass fu max-w-lg" style={{ padding: 28 }}>
        <div className="eyebrow mb-2">Configuration</div>
        <h1 className="font-d mb-3 text-[26px]">{ok ? "Supabase is configured" : "Connect Supabase to continue"}</h1>
        {ok ? (
          <Link href="/login" className="btn btn-primary">
            Go to sign in
          </Link>
        ) : (
          <ol className="list-decimal space-y-2 pl-5 text-[14px] text-dim">
            <li>Create a Supabase project.</li>
            <li>
              Apply <code className="mono">supabase/migrations</code> and (for the demo) <code className="mono">supabase/seed.sql</code>.
            </li>
            <li>
              Copy <code className="mono">.env.example</code> to <code className="mono">.env.local</code> and fill in the project URL and keys.
            </li>
            <li>Restart the dev server (or redeploy on Vercel with the same variables).</li>
          </ol>
        )}
      </div>
    </div>
  );
}
