import { APP_MODEL, APP_NAME } from "../config";
import type { Theme } from "../hooks/useTheme";
import type { MetaInfo } from "../engine/types";
import { ipFamily } from "../lib/format";
import { ThemeToggle } from "./ThemeToggle";

interface TelemetryItem {
  label: string;
  value: string;
  /** Tailwind responsive class controlling when the item is visible. */
  show: string;
}

function buildItems(
  meta: MetaInfo | null,
  ipv4: string | null,
  effectiveType: string | null,
): TelemetryItem[] {
  const items: TelemetryItem[] = [];
  if (meta?.colo) items.push({ label: "COLO", value: meta.colo, show: "flex" });
  if (meta?.country) items.push({ label: "LOC", value: meta.country, show: "flex" });
  if (meta?.asn) items.push({ label: "ASN", value: `AS${meta.asn}`, show: "hidden sm:flex" });
  if (meta?.isp) items.push({ label: "ISP", value: meta.isp, show: "hidden lg:flex" });
  if (effectiveType) items.push({ label: "NET", value: effectiveType.toUpperCase(), show: "hidden sm:flex" });
  // Prefer the familiar IPv4 dotted-quad; label by family.
  const ip = ipv4 ?? meta?.ip ?? "";
  if (ip) items.push({ label: ipFamily(ip) || "IP", value: ip, show: "hidden xl:flex" });
  return items;
}

export function TopBar({
  meta,
  ipv4,
  effectiveType,
  theme,
  onToggleTheme,
}: {
  meta: MetaInfo | null;
  ipv4: string | null;
  effectiveType: string | null;
  theme: Theme;
  onToggleTheme: () => void;
}) {
  const items = buildItems(meta, ipv4, effectiveType);
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-chassis/90 backdrop-blur-[2px]">
      <div className="mx-auto flex h-[60px] w-full max-w-[1120px] items-center justify-between gap-4 px-5 sm:px-10">
        <div className="flex items-baseline gap-2.5">
          <span className="rec-dot self-center" aria-hidden="true" />
          <span className="wordmark text-[22px] text-ink">{APP_NAME}</span>
          <span className="mono hidden text-[12px] text-ink-60 sm:inline">{APP_MODEL}</span>
        </div>

        <div className="flex min-w-0 items-center gap-4">
          <div className="hidden min-w-0 items-center gap-3 sm:flex">
            {items.length === 0 ? (
              <span className="mono text-[11px] text-ink-40">connecting…</span>
            ) : (
              items.map((it, i) => (
                <div key={it.label} className={`${it.show} min-w-0 items-baseline gap-2`}>
                  {i > 0 && <span className="mr-1 hidden text-line-ctl sm:inline">/</span>}
                  <span className="eng">{it.label}</span>
                  <span className="mono truncate text-[11px] text-ink-60">{it.value}</span>
                </div>
              ))
            )}
          </div>
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        </div>
      </div>
    </header>
  );
}
