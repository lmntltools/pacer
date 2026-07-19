import type { Theme } from "../hooks/useTheme";
import { MoonIcon, SunIcon } from "./icons";

/**
 * Light/dark switch styled as a machined toggle: sun and moon flank a track whose
 * cobalt thumb seats to the active side. Text label kept for screen readers.
 */
export function ThemeToggle({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  const dark = theme === "dark";
  return (
    <button
      type="button"
      onClick={onToggle}
      role="switch"
      aria-checked={dark}
      aria-label={`Switch to ${dark ? "light" : "dark"} theme`}
      title={`${dark ? "Light" : "Dark"} theme`}
      className="inline-flex items-center gap-2 rounded-full border border-line-ctl bg-chassis px-2 py-1 transition-colors duration-[120ms] ease-snap hover:border-ink-40"
    >
      <SunIcon className={dark ? "text-[13px] text-ink-40" : "text-[13px] text-signal"} />
      <span className="relative h-4 w-8 rounded-full bg-line">
        <span
          className="absolute left-0.5 top-0.5 h-3 w-3 rounded-full bg-signal transition-transform duration-[170ms] ease-snap"
          style={{ transform: dark ? "translateX(16px)" : "translateX(0)" }}
        />
      </span>
      <MoonIcon className={dark ? "text-[13px] text-signal" : "text-[13px] text-ink-40"} />
    </button>
  );
}
