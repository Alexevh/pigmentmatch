import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

// https://vite.dev/config/
export default defineConfig({
  // Relative base so the build works whether it's served from a domain root
  // (Netlify, Vercel) or a subpath like GitHub Pages (/pigmentmatch/).
  base: "./",
  plugins: [
    react(),
    VitePWA({
      // "prompt": when a new build is deployed, the app shows an "update"
      // toast instead of silently serving a stale cache (PwaUpdater handles it).
      registerType: "prompt",
      includeAssets: ["palette.svg", "favicon.svg"],
      manifest: {
        name: "Pigment Match",
        short_name: "Pigment Match",
        description:
          "Turn any color into an oil paint mixing recipe, with a customizable palette of real pigments.",
        lang: "en",
        theme_color: "#1a1a1f",
        background_color: "#1a1a1f",
        display: "standalone",
        // Relative so it works under the GitHub Pages subpath.
        start_url: "./",
        scope: "./",
        icons: [
          {
            src: "palette.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        // The optional spectral/AI chunk (TF.js) is ~1.1MB — allow precaching it.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        // No navigateFallback: the app has no client-side routes, and a fallback
        // path is awkward under the GitHub Pages subpath.
        globIgnores: ["**/*.map"],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
