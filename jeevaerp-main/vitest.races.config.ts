import { defineConfig } from "vitest/config";
import path from "node:path";

/** Needs DATABASE_URL pointing at a THROWAWAY database. Never your real one. */
export default defineConfig({
  test: { environment: "node", include: ["tests/races.test.ts"], testTimeout: 20000 },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
});
