// Fonts (Archivo variable + IBM Plex Mono) are self-hosted and declared via
// @font-face in index.css — no third-party CDN, both type axes intact.
import "./index.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

const root = document.getElementById("root");
if (!root) throw new Error("Root element #root not found");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
