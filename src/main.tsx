// Fonts (Archivo variable + IBM Plex Mono) are self-hosted and declared via
// @font-face in index.css — no third-party CDN, both type axes intact.
import "./index.css";

import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import Landing from "./components/Landing";

// On the LMNTL-hosted copy (pacer.lmntltools.com) the product landing fronts
// the instrument once per session. Everywhere else (GitHub Pages, workers.dev,
// local dev) the bare app serves directly.
const onLmntl = window.location.hostname.includes("lmntltools");

function Root() {
  const [entered, setEntered] = useState(
    () => !onLmntl || sessionStorage.getItem("pacer-entered") === "1",
  );
  if (!entered) {
    return (
      <Landing
        onEnter={() => {
          sessionStorage.setItem("pacer-entered", "1");
          setEntered(true);
          window.scrollTo(0, 0);
        }}
      />
    );
  }
  return <App />;
}

const root = document.getElementById("root");
if (!root) throw new Error("Root element #root not found");

createRoot(root).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
