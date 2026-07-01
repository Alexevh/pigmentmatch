/// <reference lib="webworker" />
import { precacheAndRoute } from "workbox-precaching";

// Custom service worker (injectManifest) — same offline precaching as before,
// plus a Web Share Target handler so you can share a photo from your phone
// straight into the app.

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

// Precache the built assets (equivalent to the previous generateSW behavior).
precacheAndRoute(self.__WB_MANIFEST);

// "prompt" update flow: the page (PwaUpdater) asks us to activate the new SW.
self.addEventListener("message", (event) => {
  if ((event.data as { type?: string })?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// Web Share Target: the manifest points image shares at ./share-target (POST,
// multipart). We stash the file in a cache and redirect into the app, which
// reads it on load and drops it into the Image tab.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method === "POST" && url.pathname.endsWith("/share-target")) {
    event.respondWith(
      (async () => {
        try {
          const form = await event.request.formData();
          const file = form.get("image");
          if (file && file instanceof File) {
            const cache = await caches.open("pm-shared");
            await cache.put(
              "shared-image",
              new Response(file, {
                headers: { "content-type": file.type || "image/*" },
              })
            );
          }
        } catch {
          /* ignore — fall through to opening the app */
        }
        return Response.redirect(self.registration.scope + "?shared=1", 303);
      })()
    );
  }
});
