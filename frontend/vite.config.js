import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Lanyard imports the card model as a URL asset.
  assetsInclude: ["**/*.glb"],
  server: { port: 5173 },
});
