import { cloudflare } from "@cloudflare/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// LIBRARY_PERSIST lets the smoke test use throwaway local D1/R2 state.
const persist = process.env.LIBRARY_PERSIST;

export default defineConfig({
  plugins: [react(), cloudflare(persist ? { persistState: { path: persist } } : {})],
});
