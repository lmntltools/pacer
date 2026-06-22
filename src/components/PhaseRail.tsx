import type { Phase } from "../engine/types";

const ORDER: Phase[] = ["meta", "ping", "download", "upload", "done"];
const rank = (p: Phase) => {
  const i = ORDER.indexOf(p);
  return i === -1 ? 0 : i;
};

const STEPS: { phase: Phase; label: string }[] = [
  { phase: "ping", label: "Ping" },
  { phase: "download", label: "Download" },
  { phase: "upload", label: "Upload" },
];

export function PhaseRail({ phase }: { phase: Phase }) {
  return (
    <div className="flex items-center gap-0 font-mono">
      {STEPS.map((step, i) => {
        const state =
          phase === step.phase ? "active" : rank(phase) > rank(step.phase) ? "done" : "pending";
        const color =
          state === "active" ? "text-accent" : state === "done" ? "text-fg-dim" : "text-fg-faint";
        return (
          <div key={step.phase} className="flex items-center">
            <div className="flex items-center gap-2">
              <span className={`text-[10px] tabular-nums ${state === "pending" ? "text-fg-faint" : "text-accent/70"}`}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <span
                className={`text-[11px] uppercase tracking-[0.18em] transition-colors duration-300 ${color}`}
              >
                {step.label}
              </span>
              {state === "active" && (
                <span className="h-1.5 w-1.5 animate-pulse-ring rounded-full bg-accent shadow-[0_0_8px_rgba(61,245,196,0.9)]" />
              )}
            </div>
            {i < STEPS.length - 1 && (
              <span
                className={`mx-3 h-px w-8 sm:w-14 transition-colors duration-500 ${
                  rank(phase) > rank(step.phase) ? "bg-accent/40" : "bg-white/10"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
