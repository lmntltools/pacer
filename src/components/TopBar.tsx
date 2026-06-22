import { APP_NAME } from "../config";
import type { MetaInfo } from "../engine/types";

function Mark() {
  return (
    <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true" className="shrink-0">
      <circle cx="16" cy="16" r="13" fill="none" stroke="#1A202A" strokeWidth="2" />
      {/* a gauge arc that stops ~70% around, with a needle to the live position */}
      <path d="M16 3 a13 13 0 0 1 11.3 19.4" fill="none" stroke="#3DF5C4" strokeWidth="2" strokeLinecap="round" />
      <line x1="16" y1="16" x2="24" y2="9.5" stroke="#3DF5C4" strokeWidth="2" strokeLinecap="round" />
      <circle cx="16" cy="16" r="2.1" fill="#E7ECF1" />
    </svg>
  );
}

interface TelemetryItem {
  label: string;
  value: string;
  /** Tailwind responsive class controlling when the item is visible. */
  show: string;
}

function buildItems(meta: MetaInfo | null, effectiveType: string | null): TelemetryItem[] {
  if (!meta) return [];
  const items: TelemetryItem[] = [];
  if (meta.colo) items.push({ label: "COLO", value: meta.colo, show: "flex" });
  if (meta.country) items.push({ label: "LOC", value: meta.country, show: "flex" });
  if (meta.asn) items.push({ label: "ASN", value: `AS${meta.asn}`, show: "hidden sm:flex" });
  if (meta.isp) items.push({ label: "ISP", value: meta.isp, show: "hidden md:flex" });
  if (effectiveType) items.push({ label: "NET", value: effectiveType.toUpperCase(), show: "hidden sm:flex" });
  if (meta.ip) items.push({ label: "IP", value: meta.ip, show: "hidden xl:flex" });
  return items;
}

export function TopBar({
  meta,
  effectiveType,
}: {
  meta: MetaInfo | null;
  effectiveType: string | null;
}) {
  const items = buildItems(meta, effectiveType);
  return (
    <header className="border-b border-white/[0.07]">
      <div className="mx-auto flex w-full max-w-[1200px] items-center justify-between gap-4 px-5 py-3.5 sm:px-8">
        <div className="flex items-center gap-2.5">
          <Mark />
          <span className="text-[15px] font-semibold tracking-[-0.01em] text-fg">{APP_NAME}</span>
          <span className="hidden h-3.5 w-px bg-white/10 sm:block" />
          <span className="hidden font-mono text-[10px] uppercase tracking-[0.22em] text-fg-faint sm:block">
            speed test
          </span>
        </div>

        <div className="flex min-w-0 items-center gap-3 overflow-hidden font-mono text-[11px]">
          {items.length === 0 ? (
            <span className="text-fg-faint">connecting…</span>
          ) : (
            items.map((it, i) => (
              <div key={it.label} className={`${it.show} min-w-0 items-baseline gap-1.5`}>
                {i > 0 && <span className="mr-3 hidden text-white/15 sm:inline">/</span>}
                <span className="text-fg-faint">{it.label}</span>
                <span className="truncate text-fg-dim">{it.value}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </header>
  );
}
