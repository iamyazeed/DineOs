"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import type { NavGroup } from "@/config/navigation";
import { cn } from "@/lib/utils";

export function SidebarNav({ groups }: { groups: NavGroup[] }) {
  const path = usePathname();
  const all = groups.flatMap((g) => g.items.map((i) => i.href));
  // Longest matching prefix wins so nested routes highlight correctly.
  const active = all.filter((h) => path === h || path.startsWith(h + "/")).sort((a, b) => b.length - a.length)[0];
  const close = () => {
    const box = document.getElementById("nav-open") as HTMLInputElement | null;
    if (box) box.checked = false;
  };
  return (
    <nav aria-label="Main">
      {groups.map((g) => (
        <div key={g.label}>
          <div className="navlbl">{g.label}</div>
          {g.items.map((item) => (
            <Link key={item.href} href={item.href} onClick={close} className={cn("nav", active === item.href && "on")} aria-current={active === item.href ? "page" : undefined}>
              <Icon name={item.icon} className="ico" />
              {item.label}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );
}
