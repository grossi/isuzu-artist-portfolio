import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Resolve bare imports such as "components/..." from src/ (tsconfig paths)
    tsconfigPaths: true,
  },
  server: {
    port: 3000,
  },
  build: {
    outDir: "build",
    sourcemap: false,
  },
});
