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

type StepState = "active" | "done" | "pending";

// LED fill per state — amber = working, green = complete, neutral = standby.
const LED_FILL: Record<StepState, string> = {
  active: "var(--meter-amber)",
  done: "var(--meter-green)",
  pending: "var(--ink-30)",
};

export function PhaseRail({ phase }: { phase: Phase }) {
  return (
    <div className="flex items-center gap-0">
      {STEPS.map((step, i) => {
        const state: StepState =
          phase === step.phase ? "active" : rank(phase) > rank(step.phase) ? "done" : "pending";
        const labelColor =
          state === "active" ? "!text-ink" : state === "done" ? "!text-ink-60" : "";
        return (
          <div key={step.phase} className="flex items-center">
            <div className="flex items-center gap-2.5">
              <span
                className={`led ${state === "active" ? "animate-flick" : ""}`}
                style={{ backgroundColor: LED_FILL[state], borderColor: LED_FILL[state] }}
                aria-hidden="true"
              />
              <span className="mono text-[10px] text-ink-40 tnum">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className={`eng ${labelColor}`}>{step.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <span
                className="mx-3 h-px w-8 transition-colors duration-[300ms] sm:w-14"
                style={{
                  background: rank(phase) > rank(step.phase) ? "var(--signal-line)" : "var(--line)",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
