import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  // GitHub Pages liegt unter /foodhub/ (Repo-Name). Auf moosburg.eu haengt die
  // App am Data Hub, dort ueberschreibt `pnpm build:hostinger` den Pfad mit
  // --base=/data/foodhub/. Deshalb steht der zweite Pfad nicht hier.
  base: "/foodhub/",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
