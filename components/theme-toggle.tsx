"use client";

import { useEffect, useState } from "react";
import { useTracker } from "@/lib/store";
import type { ThemePreference } from "@/lib/types";

type EffectiveTheme = "light" | "dark";

function systemTheme(): EffectiveTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function resolveTheme(preference: ThemePreference): EffectiveTheme {
  return preference === "system" ? systemTheme() : preference;
}

function applyTheme(preference: ThemePreference) {
  const effective = resolveTheme(preference);
  document.documentElement.dataset.theme = effective;
  if (preference === "system") window.localStorage.removeItem("trackbetter-theme");
  else window.localStorage.setItem("trackbetter-theme", preference);
  return effective;
}

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { state, updatePreferences } = useTracker();
  const [theme, setTheme] = useState<EffectiveTheme>("light");

  useEffect(() => {
    setTheme(applyTheme(state.preferences.theme));
  }, [state.preferences.theme]);

  function toggle() {
    const next: EffectiveTheme = theme === "dark" ? "light" : "dark";
    setTheme(applyTheme(next));
    updatePreferences({ ...state.preferences, theme: next });
  }

  return (
    <button className={compact ? "icon-button" : "theme-button"} onClick={toggle} type="button" aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}>
      <span aria-hidden="true">{theme === "dark" ? "☀" : "☾"}</span>
      {!compact && <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>}
    </button>
  );
}
