// Read an image shared into the app via the Web Share Target. The service
// worker stashes the shared file in the "pm-shared" cache and redirects to
// ?shared=1; here we pull it out (once) and clear the flag.

export async function consumeSharedImage(): Promise<Blob | null> {
  try {
    if (!/[?&]shared=1/.test(location.search)) return null;
    const cache = await caches.open("pm-shared");
    const res = await cache.match("shared-image");
    if (!res) return null;
    await cache.delete("shared-image");
    return await res.blob();
  } catch {
    return null;
  }
}

export function clearSharedFlag(): void {
  try {
    history.replaceState(null, "", location.pathname);
  } catch {
    /* ignore */
  }
}
