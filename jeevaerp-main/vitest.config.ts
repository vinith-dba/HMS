import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    // Fast tests run on every save. The DB-backed race tests are opt-in via
    // `npm run test:races` — they need a live Postgres, and you should not have
    // to stand one up just to check that GST adds correctly.
    include: ["tests/**/*.test.ts"],
    exclude: ["tests/races.test.ts", "node_modules/**"],
  },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
});
