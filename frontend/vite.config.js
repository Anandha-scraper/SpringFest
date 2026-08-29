import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  // Lanyard imports the card model as a URL asset.
  assetsInclude: ["**/*.glb"],
  // `/api` -> the local Express server, so dev uses the same relative base
  // (client.js defaults to "/api") that production serves from one origin.
  server: { port: 5173, proxy: { "/api": "http://localhost:8000" } },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
