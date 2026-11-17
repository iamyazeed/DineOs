import Link from "next/link";
import { requireRole } from "@/lib/auth/guards";
import { Conversation } from "@/components/shared/conversation";
import { EmptyState, PageHeader, Panel } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import type { PageProps } from "@/types/page";

export default async function SuperCommunication({ searchParams }: PageProps) {
  const ctx = await requireRole("super_admin");
  const sp = await searchParams;
  const { data: insts } = await ctx.supabase.from("institutions").select("id, name").order("name");
  const id = typeof sp.inst === "string" ? sp.inst : insts?.[0]?.id;
  return (
    <>
      <PageHeader eyebrow="Communication" title="Institutional communication" sub="Messages and documents exchanged with institution administrators." />
      <div className="seg my-5">
        {(insts ?? []).map((i) => (
          <Link key={i.id} href={`/super-admin/communication?inst=${i.id}`} className={cn(i.id === id && "on")}>{i.name}</Link>
        ))}
      </div>
      <Panel>{id ? <Conversation db={ctx.supabase} instId={id} as="super_admin" /> : <EmptyState>No institutions.</EmptyState>}</Panel>
    </>
  );
}
