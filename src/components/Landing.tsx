import { useEffect } from "react";
import { APP_MODEL, APP_NAME } from "../config";
import { LmntlFooter } from "./LmntlFooter";
import { PlayIcon } from "./icons";
import shotIdle from "../assets/landing/shot-idle.webp";
import shotDownload from "../assets/landing/shot-download.webp";
import shotResults from "../assets/landing/shot-results.webp";

// Product landing for the LMNTL-hosted copy (pacer.lmntltools.com). Shown once
// per session before the instrument itself; GitHub Pages and workers.dev serve
// the bare app. Pacer's own identity throughout — machined faceplate, engraved
// labels, one cobalt signal — with the constant LMNTL footer signing it back
// to the studio.

const SPECS = [
  "5 parallel streams",
  "slow-start discarded",
  "p90 bandwidth",
  "TTFB ping",
  "bufferbloat grade",
  "zero third-party measurement",
];

const RACK = [
  { img: shotIdle, unit: "U1", label: "STANDBY / CONNECTION DETECTED", alt: "Pacer idle, showing the detected connection" },
  { img: shotDownload, unit: "U2", label: "MEASURING / DOWNLOAD", alt: "Pacer mid-test with the live throughput oscilloscope" },
  { img: shotResults, unit: "U3", label: "RESULTS / SIGNED OFF", alt: "Pacer results with ping, jitter, loaded latency, and bufferbloat grade" },
];

const LIES = [
  {
    k: "01",
    lie: "One connection",
    fix: "A single stream can't saturate a fast link, so the number reads low. Pacer runs five parallel streams and sums them.",
  },
  {
    k: "02",
    lie: "Counting the warm-up",
    fix: "TCP starts slow on purpose; averaging from the first byte drags the result down. Pacer discards the first 1.2 seconds.",
  },
  {
    k: "03",
    lie: "Wall-clock latency",
    fix: "Date.now() isn't a network instrument. Pacer times ping as time-to-first-byte from the browser's performance clock.",
  },
  {
    k: "04",
    lie: "Uploading zeros",
    fix: "Networks compress a buffer of zeros into a fake-fast upload. Pacer sends incompressible random bytes.",
  },
];

export default function Landing({ onEnter }: { onEnter: () => void }) {
  // scroll-activated reveals — mechanical, not bouncy
  useEffect(() => {
    const els = Array.from(document.querySelectorAll(".lp-reveal"));
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      els.forEach((el) => el.classList.add("in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.16 },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div className="min-h-[100dvh]">
      {/* top plate */}
      <header className="sticky top-0 z-20 border-b border-line bg-chassis/90 backdrop-blur-[2px]">
        <div className="mx-auto flex h-[60px] w-full max-w-[1120px] items-center justify-between gap-4 px-5 sm:px-10">
          <div className="flex items-baseline gap-2.5">
            <span className="rec-dot self-center" aria-hidden="true" />
            <span className="wordmark text-[22px] text-ink">{APP_NAME}</span>
            <span className="mono hidden text-[12px] text-ink-60 sm:inline">{APP_MODEL}</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="eng hidden md:inline">element 002 · by LMNTL</span>
            <button
              onClick={onEnter}
              className="eng rounded-ctrl border border-line-ctl px-4 py-2 text-ink transition-colors hover:border-signal-deep hover:text-signal-ink"
            >
              open instrument →
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1120px] px-5 sm:px-10">
        {/* hero */}
        <section className="flex flex-col items-start gap-6 pb-12 pt-[clamp(44px,8vh,96px)]">
          <p className="eng lg lp-reveal">Element 002 · Public instrument · SPD-1</p>
          <h1 className="display lp-reveal lp-d1 max-w-[13ch] text-[clamp(44px,7.4vw,92px)] text-ink">
            Know your <span className="text-signal-ink">true</span> speed.
          </h1>
          <p className="lp-reveal lp-d2 max-w-[52ch] text-[clamp(15px,1.6vw,18px)] leading-relaxed text-ink-60">
            Most quick speed tests under-report by 2–5× — one connection, warm-up counted, zeros
            uploaded. Pacer is a precision instrument that does the boring, correct thing at every
            step, <strong className="text-ink">and shows its work.</strong>
          </p>
          <div className="lp-reveal lp-d3 flex flex-col items-start gap-3">
            <button
              onClick={onEnter}
              className="mono inline-flex items-center gap-3 rounded-ctrl border border-signal bg-signal px-8 py-3.5 text-[13px] font-medium uppercase tracking-eng text-white transition-colors hover:border-signal-deep hover:bg-signal-deep"
            >
              <PlayIcon className="text-[14px]" />
              Run the test
            </button>
            <span className="mono text-[10px] uppercase tracking-eng text-ink-40">
              free · no sign-up · no ads · ~30 seconds
            </span>
          </div>
        </section>

        {/* spec ribbon */}
        <div className="lp-reveal flex flex-wrap items-center gap-x-6 gap-y-2 border-y border-line py-3" aria-label="Measurement specification">
          {SPECS.map((s) => (
            <span key={s} className="flex items-center gap-2">
              <span
                className="led"
                style={{ backgroundColor: "var(--meter-green)", borderColor: "var(--meter-green)" }}
                aria-hidden="true"
              />
              <span className="mono text-[10px] uppercase tracking-eng text-ink-60">{s}</span>
            </span>
          ))}
        </div>

        {/* the rack — real frames of the instrument */}
        <section className="flex flex-col gap-5 py-14">
          {RACK.map((r, i) => (
            <figure key={r.unit} className={`lp-reveal lp-d${i + 1} m-0 overflow-hidden rounded-mod border border-line bg-panel`}>
              <img src={r.img} alt={r.alt} loading="lazy" className="block w-full" />
              <figcaption className="flex items-center justify-between border-t border-line px-4 py-2.5">
                <span className="eng">{r.label}</span>
                <span className="mono text-[11px] text-ink-40">{r.unit} / 03</span>
              </figcaption>
            </figure>
          ))}
        </section>

        {/* where speed tests lie */}
        <section className="pb-14">
          <h2 className="display lp-reveal max-w-[16ch] text-[clamp(28px,3.8vw,44px)] text-ink">
            Where quick tests <span className="text-signal-ink">cut corners.</span>
          </h2>
          <div className="mt-7 grid gap-4 sm:grid-cols-2">
            {LIES.map((l, i) => (
              <article key={l.k} className={`lp-reveal lp-d${(i % 2) + 1} rounded-mod border border-line bg-panel p-5`}>
                <p className="mono text-[11px] font-medium text-signal-ink">THE SHORTCUT / {l.k}</p>
                <h3 className="mt-2 text-[17px] font-semibold text-ink">{l.lie}</h3>
                <p className="mt-1.5 text-[14px] leading-relaxed text-ink-60">{l.fix}</p>
              </article>
            ))}
          </div>
        </section>

        {/* methodology strip — the instrument's spec sheet */}
        <section className="lp-reveal grid grid-cols-2 gap-px overflow-hidden rounded-mod border border-line bg-line sm:grid-cols-4" aria-label="Methodology at a glance">
          {[
            { label: "STREAMS", value: "5", sub: "parallel, summed" },
            { label: "WARM-UP", value: "1.2s", sub: "slow-start cut" },
            { label: "BANDWIDTH", value: "p90", sub: "of throughput" },
            { label: "PING", value: "TTFB", sub: "responseStart" },
          ].map((m) => (
            <div key={m.label} className="bg-panel px-5 py-4">
              <p className="eng">{m.label}</p>
              <p className="mono mt-1 text-[24px] font-medium leading-none text-ink">{m.value}</p>
              <p className="mono mt-1 text-[10px] text-ink-40">{m.sub}</p>
            </div>
          ))}
        </section>

        {/* open + honest */}
        <section className="flex flex-col items-center gap-4 py-16 text-center">
          <h2 className="display lp-reveal max-w-[18ch] text-[clamp(26px,3.4vw,40px)] text-ink">
            Every byte of it is <span className="text-signal-ink">hand-written.</span>
          </h2>
          <p className="lp-reveal lp-d1 max-w-[54ch] text-[15px] leading-relaxed text-ink-60">
            The throughput engine, the percentile math, the latency probing, and the backend that
            serves the test bytes — no third-party measurement kit anywhere. Your speed is measured
            first-party, and the method is public.
          </p>
          <div className="lp-reveal lp-d2 mt-2 flex flex-col items-center gap-3">
            <button
              onClick={onEnter}
              className="mono inline-flex items-center gap-3 rounded-ctrl border border-signal bg-signal px-8 py-3.5 text-[13px] font-medium uppercase tracking-eng text-white transition-colors hover:border-signal-deep hover:bg-signal-deep"
            >
              <PlayIcon className="text-[14px]" />
              Run the test now
            </button>
            <a
              href="https://github.com/lmntltools/pacer"
              target="_blank"
              rel="noreferrer"
              className="mono text-[10px] uppercase tracking-eng text-ink-40 underline-offset-4 hover:text-signal-ink hover:underline"
            >
              read the methodology on GitHub
            </a>
          </div>
        </section>
      </main>

      {/* constant LMNTL footer — the studio signature on every element */}
      <LmntlFooter />
    </div>
  );
}
