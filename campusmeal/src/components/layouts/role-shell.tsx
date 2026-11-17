import type { ReactNode } from "react";
import { NAVIGATION } from "@/config/navigation";
import { ROLE_LABEL } from "@/lib/constants";
import { initials } from "@/lib/utils";
import { Utensils } from "lucide-react";
import { Icon } from "@/components/ui/icon";
import { SidebarNav } from "@/components/layouts/sidebar-nav";
import { ThemeToggle } from "@/components/layouts/theme-toggle";
import { signOut } from "@/features/authentication/actions";
import type { RoleContext } from "@/lib/auth/guards";

export function Brand({ sub }: { sub?: string }) {
  return (
    <div className="brand">
      <span className="mark" aria-hidden>
        <Utensils size={18} strokeWidth={2.2} />
      </span>
      <div>
        DineOS
        <small>{sub ?? "Campus dining"}</small>
      </div>
    </div>
  );
}

export function RoleShell({ ctx, children }: { ctx: RoleContext; children: ReactNode }) {
  const groups = NAVIGATION[ctx.role];
  const scope = ctx.institution?.name ?? "All institutions";
  return (
    <>
      <input type="checkbox" id="nav-open" className="hidden" aria-hidden />
      <div className="shell">
        <aside className="side glass" aria-label="Sidebar">
          <Brand sub={ROLE_LABEL[ctx.role]} />
          <SidebarNav groups={groups} />
          <div className="side-foot glass mt-4">
            <div className="av">{initials(ctx.fullName)}</div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-semibold">{ctx.fullName}</div>
              <div className="truncate text-[11px] text-dim">{ROLE_LABEL[ctx.role]}</div>
            </div>
            <form action={signOut}>
              <button className="iconbtn" aria-label="Sign out" title="Sign out">
                <Icon name="logout" size={17} />
              </button>
            </form>
          </div>
        </aside>
        <main className="min-w-0">
          <header className="topbar glass">
            <label htmlFor="nav-open" className="iconbtn menu-toggle" aria-label="Open navigation">
              <Icon name="menu" />
            </label>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13.5px] font-semibold">{scope}</div>
              <div className="text-[11px] text-dim">{ROLE_LABEL[ctx.role]} workspace</div>
            </div>
            {ctx.institution?.is_demo && (
              <span className="pill pill-warn" title="This institution contains demonstration data, not live production metrics.">
                Sample data
              </span>
            )}
            <ThemeToggle />
          </header>
          <div className="pagewrap">{children}</div>
        </main>
      </div>
      <label htmlFor="nav-open" className="scrim" aria-hidden />
    </>
  );
}
