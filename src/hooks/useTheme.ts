import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark";
type Setting = Theme | "system";

const KEY = "pacer-theme";

/** Resolve the effective palette given the stored setting and the OS preference. */
function systemTheme(): Theme {
  return typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function storedSetting(): Setting {
  if (typeof window === "undefined") return "system";
  const v = window.localStorage.getItem(KEY);
  return v === "light" || v === "dark" ? v : "system";
}

/**
 * Light/dark control for the rack. Defaults to following the OS ("system"); an
 * explicit choice writes `data-theme` on <html> — which our token layer keys off
 * — and is remembered. Left unset, prefers-color-scheme drives the palette.
 */
export function useTheme() {
  const [setting, setSetting] = useState<Setting>(storedSetting);
  const [theme, setTheme] = useState<Theme>(() =>
    setting === "system" ? systemTheme() : setting,
  );

  // Reflect the setting onto the document + storage, and track the OS when following it.
  useEffect(() => {
    const root = document.documentElement;
    if (setting === "system") {
      root.removeAttribute("data-theme");
      window.localStorage.removeItem(KEY);
    } else {
      root.setAttribute("data-theme", setting);
      window.localStorage.setItem(KEY, setting);
    }
    setTheme(setting === "system" ? systemTheme() : setting);
  }, [setting]);

  useEffect(() => {
    if (setting !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setTheme(mq.matches ? "dark" : "light");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [setting]);

  const toggle = useCallback(() => {
    setSetting(theme === "dark" ? "light" : "dark");
  }, [theme]);

  return { theme, toggle };
}
