import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react";

// Fontsource's CSS lists a .woff fallback after each .woff2. Every browser
// that understands unicode-range reads woff2, so the woff copies (about 9 MB
// for Zen Kaku Gothic New's 3 weights) would only weigh down every upload.
function woff2Only(): Plugin {
  return {
    name: "fontsource-woff2-only",
    enforce: "pre",
    transform(code, id) {
      if (!/[\\/]@fontsource[\\/][^?]*\.css(\?|$)/.test(id)) return null;
      const stripped = code.replace(/,\s*url\([^)]*\.woff\)\s*format\(['"]woff['"]\)/g, "");
      // Fails loudly if a Fontsource update writes its CSS differently
      if (/\.woff\)/.test(stripped)) this.error(`woff2Only: a .woff fallback is left in ${id}`);
      return { code: stripped, map: null };
    },
  };
}

export default defineConfig({
  plugins: [woff2Only(), react()],
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
    // Fonts are always separate files: Vite would otherwise inline the smallest
    // Japanese slices into the CSS, where every page pays for them.
    assetsInlineLimit: (file) => (/\.woff2?$/.test(file) ? false : undefined),
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
