// Unit tests run in plain Node and do not load the Cloudflare Vite plugin.
import { defineConfig } from "vitest/config";

export default defineConfig({ test: { include: ["tests/**/*.test.ts"] } });
