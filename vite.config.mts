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
    rolldownOptions: {
      output: {
        // Keep rarely-changing libraries in their own long-cacheable chunks
        // (this also keeps every chunk under Vite's 500 kB warning)
        codeSplitting: {
          groups: [
            { name: "react", test: /node_modules[\\/](react|react-dom|react-router|scheduler)[\\/]/ },
            { name: "mui", test: /node_modules[\\/](@mui|@emotion|tss-react|react-transition-group|stylis)[\\/]/ },
          ],
        },
      },
    },
  },
});
