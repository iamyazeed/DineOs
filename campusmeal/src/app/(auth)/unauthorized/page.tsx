import Link from "next/link";
import { getSessionContext } from "@/lib/auth/guards";
import { ROLE_HOME, ROLE_LABEL } from "@/lib/constants";
import { isSupabaseConfigured } from "@/config/env";

export default async function Unauthorized() {
  const session = isSupabaseConfigured() ? await getSessionContext() : null;
  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="panel glass fu max-w-md text-center" style={{ padding: 30 }}>
        <div className="eyebrow mb-2">Access denied</div>
        <h1 className="font-d mb-2 text-[26px]">You don&apos;t have access to that area</h1>
        <p className="sub mb-5">Each DineOS workspace is limited to its role and institution.</p>
        <div className="flex flex-wrap justify-center gap-2">
          {session?.memberships.map((m) => (
            <Link key={m.role} href={ROLE_HOME[m.role]} className="btn btn-primary">
              Go to {ROLE_LABEL[m.role]}
            </Link>
          ))}
          <Link href="/login" className="btn btn-ghost">
            Sign in as someone else
          </Link>
        </div>
      </div>
    </div>
  );
}
