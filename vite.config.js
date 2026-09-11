import { defineConfig } from "vite";

export default defineConfig(({ mode }) => ({
  base: mode === "pages" ? "/corn-scooping-game/" : "/",
}));
