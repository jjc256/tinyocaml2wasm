import { defineConfig } from "vite";

export default defineConfig({
  root: "web",
  test: {
    include: ["../compiler/tests/**/*.spec.ts"],
  },
});
