// Logbook (Bitácora) storage. A painter's notebook of color mixes, grouped into
// projects, each entry holding optional reference + swatch photos.
//
// Why IndexedDB (not localStorage): photos are binary and large. localStorage
// is a small (~5MB) synchronous string store already holding palettes and
// calibration. IndexedDB is the browser's built-in document store, persists
// Blobs natively (no base64 bloat), and gives a much larger quota. No backend,
// no dependencies — everything stays local.
//
// Export/import uses a single self-contained JSON file with images embedded as
// base64 data URLs, so a backup is one portable file. (Base64 only lives in the
// export file; the live store keeps compact Blobs.)

export interface LogProject {
  id: string;
  name: string;
  notes: string;
  createdAt: number;
  updatedAt: number;
}

export interface LogEntry {
  id: string;
  projectId: string;
  name: string;
  recipe: string; // free-text mix, e.g. "5 White · 1 Yellow Ochre · touch Cad Red"
  notes: string;
  hex?: string; // optional representative color chip
  ref?: Blob; // reference photo
  swatch?: Blob; // swatch / painted sample photo
  createdAt: number;
  updatedAt: number;
}

const DB_NAME = "pigmentmatch-logbook";
const DB_VERSION = 1;
const PROJECTS = "projects";
const ENTRIES = "entries";

let dbPromise: Promise<IDBDatabase> | null = null;

function db(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains(PROJECTS))
        d.createObjectStore(PROJECTS, { keyPath: "id" });
      if (!d.objectStoreNames.contains(ENTRIES)) {
        const s = d.createObjectStore(ENTRIES, { keyPath: "id" });
        s.createIndex("projectId", "projectId", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function asPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export function newId(prefix = "lb"): string {
  try {
    if (crypto?.randomUUID) return `${prefix}_${crypto.randomUUID()}`;
  } catch {
    /* fall through */
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.floor(
    Math.random() * 1e9
  ).toString(36)}`;
}

// ---------- Projects ----------

export async function getProjects(): Promise<LogProject[]> {
  const d = await db();
  const all = await asPromise(
    d.transaction(PROJECTS, "readonly").objectStore(PROJECTS).getAll()
  );
  return (all as LogProject[]).sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function putProject(p: LogProject): Promise<void> {
  const d = await db();
  const tx = d.transaction(PROJECTS, "readwrite");
  tx.objectStore(PROJECTS).put(p);
  await txDone(tx);
}

export async function deleteProject(id: string): Promise<void> {
  const d = await db();
  const tx = d.transaction([PROJECTS, ENTRIES], "readwrite");
  tx.objectStore(PROJECTS).delete(id);
  const idx = tx.objectStore(ENTRIES).index("projectId");
  const keys = await asPromise(idx.getAllKeys(IDBKeyRange.only(id)));
  for (const k of keys as IDBValidKey[]) tx.objectStore(ENTRIES).delete(k);
  await txDone(tx);
}

// ---------- Entries ----------

export async function getEntries(projectId: string): Promise<LogEntry[]> {
  const d = await db();
  const idx = d
    .transaction(ENTRIES, "readonly")
    .objectStore(ENTRIES)
    .index("projectId");
  const all = await asPromise(idx.getAll(IDBKeyRange.only(projectId)));
  return (all as LogEntry[]).sort((a, b) => a.createdAt - b.createdAt);
}

export async function putEntry(e: LogEntry): Promise<void> {
  const d = await db();
  const tx = d.transaction(ENTRIES, "readwrite");
  tx.objectStore(ENTRIES).put(e);
  await txDone(tx);
}

export async function deleteEntry(id: string): Promise<void> {
  const d = await db();
  const tx = d.transaction(ENTRIES, "readwrite");
  tx.objectStore(ENTRIES).delete(id);
  await txDone(tx);
}

async function getAllEntries(): Promise<LogEntry[]> {
  const d = await db();
  return (await asPromise(
    d.transaction(ENTRIES, "readonly").objectStore(ENTRIES).getAll()
  )) as LogEntry[];
}

// ---------- Image helpers ----------

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// Re-encode an uploaded photo to a compact JPEG, downscaled so the longest side
// is at most `max`. Keeps the store (and exports) small without a backend.
export async function downscaleImage(
  file: File,
  max = 1000,
  quality = 0.82
): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((res) =>
      canvas.toBlob((b) => res(b), "image/jpeg", quality)
    );
    return blob ?? file;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

async function dataURLToBlob(dataURL: string): Promise<Blob> {
  const res = await fetch(dataURL);
  return res.blob();
}

// ---------- Export / Import ----------

interface ExportShape {
  type: "pigment-match-logbook";
  version: 1;
  exportedAt: number;
  projects: LogProject[];
  entries: Array<
    Omit<LogEntry, "ref" | "swatch"> & { ref?: string; swatch?: string }
  >;
}

// Whole logbook → one JSON string with images inlined as data URLs.
export async function exportLogbook(): Promise<string> {
  const [projects, entries] = await Promise.all([
    getProjects(),
    getAllEntries(),
  ]);
  const out: ExportShape = {
    type: "pigment-match-logbook",
    version: 1,
    exportedAt: Date.now(),
    projects,
    entries: await Promise.all(
      entries.map(async (e) => ({
        ...e,
        ref: e.ref ? await blobToDataURL(e.ref) : undefined,
        swatch: e.swatch ? await blobToDataURL(e.swatch) : undefined,
      }))
    ),
  };
  return JSON.stringify(out);
}

// Import a JSON export, merging it in with fresh ids (never clobbers existing
// projects). Returns the number of projects imported.
export async function importLogbook(json: string): Promise<number> {
  const data = JSON.parse(json) as ExportShape;
  if (data?.type !== "pigment-match-logbook" || !Array.isArray(data.projects))
    throw new Error("not a logbook file");

  const d = await db();
  const tx = d.transaction([PROJECTS, ENTRIES], "readwrite");
  const idMap = new Map<string, string>();
  const now = Date.now();

  for (const p of data.projects) {
    const id = newId("proj");
    idMap.set(p.id, id);
    tx.objectStore(PROJECTS).put({
      id,
      name: String(p.name ?? "Untitled"),
      notes: String(p.notes ?? ""),
      createdAt: Number(p.createdAt) || now,
      updatedAt: Number(p.updatedAt) || now,
    } satisfies LogProject);
  }

  for (const e of data.entries ?? []) {
    const projectId = idMap.get(e.projectId);
    if (!projectId) continue; // orphan entry
    tx.objectStore(ENTRIES).put({
      id: newId("entry"),
      projectId,
      name: String(e.name ?? ""),
      recipe: String(e.recipe ?? ""),
      notes: String(e.notes ?? ""),
      hex: e.hex,
      ref: e.ref ? await dataURLToBlob(e.ref) : undefined,
      swatch: e.swatch ? await dataURLToBlob(e.swatch) : undefined,
      createdAt: Number(e.createdAt) || now,
      updatedAt: Number(e.updatedAt) || now,
    } satisfies LogEntry);
  }

  await txDone(tx);
  return data.projects.length;
}
