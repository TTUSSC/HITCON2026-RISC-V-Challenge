import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
//
// COOP/COEP headers below are required for rv32emu's WASM build: it uses
// pthreads backed by SharedArrayBuffer, which browsers only expose to
// cross-origin-isolated pages (`self.crossOriginIsolated === true`). Without
// these two response headers, loading /rv32emu.js in the emulator adapter
// (src/engine/loadEmulator.ts) fails. This covers `vite dev` and `vite
// preview`; whatever static host serves the production build at the booth
// must set the same two headers, or the emulator will not load there.
const crossOriginIsolationHeaders = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
};

export default defineConfig({
  plugins: [react()],
  server: {
    headers: crossOriginIsolationHeaders,
  },
  preview: {
    headers: crossOriginIsolationHeaders,
  },
});
