"use client";

import { Icon } from "@/components/ui/icon";

export function ThemeToggle() {
  const toggle = () => {
    const root = document.documentElement;
    const next = root.dataset.theme === "light" ? "dark" : "light";
    root.dataset.theme = next;
    try {
      localStorage.setItem("cm-theme", next);
    } catch {
      /* storage unavailable */
    }
  };
  return (
    <button type="button" className="iconbtn" onClick={toggle} aria-label="Toggle light and dark theme" title="Toggle theme">
      <Icon name="sun" />
    </button>
  );
}

/** Inline script run before paint to apply the saved theme. */
export const themeScript = `try{var t=localStorage.getItem('cm-theme');if(t)document.documentElement.dataset.theme=t;}catch(e){}`;
