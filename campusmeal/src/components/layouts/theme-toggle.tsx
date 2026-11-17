"use client";

import { Icon } from "@/components/ui/icon";

export function ThemeToggle() {
  const toggle = () => {
    const root = document.documentElement;
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    try {
      localStorage.setItem("dineos-theme", next);
    } catch {
      /* storage unavailable */
    }
  };
  return (
    <button type="button" className="iconbtn" onClick={toggle} aria-label="Switch between light and dark theme" title="Switch theme">
      <Icon name="moon" />
    </button>
  );
}

/** Inline script run before paint to apply the saved theme. */
export const themeScript = `try{var t=localStorage.getItem('dineos-theme');if(t)document.documentElement.dataset.theme=t;}catch(e){}`;
