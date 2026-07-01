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
      // Custom service worker (src/sw.ts) so we can add a Web Share Target
      // handler. It still precaches everything via precacheAndRoute.
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
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
        // Share a photo from the OS share sheet straight into the app (handled
        // by the service worker, which stashes the file and opens the Image tab).
        share_target: {
          action: "./share-target",
          method: "POST",
          enctype: "multipart/form-data",
          params: {
            files: [{ name: "image", accept: ["image/*"] }],
          },
        },
      },
      injectManifest: {
        // The optional spectral/AI chunk (TF.js) is ~1.1MB — allow precaching it.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
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
