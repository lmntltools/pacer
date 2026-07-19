// The constant LMNTL studio footer — the signature on every element's
// lmntltools.com surface. Rendered on the product landing always, and beneath
// the instrument itself on the lmntltools host.
export function LmntlFooter() {
  return (
    <footer className="border-t border-line" style={{ background: "#0f1d26" }}>
      <div className="mx-auto flex w-full max-w-[1120px] flex-wrap items-center justify-between gap-3 px-5 py-5 sm:px-10">
        <a href="https://lmntltools.com" aria-label="LMNTL home">
          <img
            src="/brand/LMNTL_Wordmark_White_Transparent.png"
            alt="LMNTL"
            style={{ height: 12, width: "auto", opacity: 0.9 }}
          />
        </a>
        <span className="mono text-[8px] uppercase tracking-eng" style={{ color: "#8ba0a0" }}>
          pacer.lmntltools.com / element 002
        </span>
        <span className="mono text-[8px] uppercase tracking-eng" style={{ color: "#8ba0a0" }}>
          © 2026{" "}
          <a href="https://lmntltools.com" style={{ color: "#48a5a8", textDecoration: "none" }}>
            LMNTL
          </a>{" "}
          — every element, part of the body
        </span>
      </div>
    </footer>
  );
}
