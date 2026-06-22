import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The site is served from https://<user>.github.io/pacer/, so every asset URL
// must be prefixed with the repo name. If you fork this under a different repo
// name, change `base` to "/<your-repo>/".
export default defineConfig({
  base: "/pacer/",
  plugins: [react()],
  build: {
    target: "es2020",
    sourcemap: false,
  },
});
