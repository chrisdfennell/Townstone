import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// On GitHub Pages a project site is served from /<repo>/, so assets must be
// referenced under that path. The deploy workflow sets VITE_BASE to
// "/<repo-name>/"; locally it falls back to "/" for normal dev/build.
export default defineConfig({
  base: process.env.VITE_BASE ?? "/",
  plugins: [react()],
  test: {
    globals: true,
    environment: "node",
  },
});
