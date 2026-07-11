// Active-image store. The photos you upload in Image / Compare / Mix / Extract
// are kept here (IndexedDB, as Blobs) keyed by a fixed "slot" name, so they
// survive reloads and tab switches — and, when optional cloud sync is on, they
// follow you across devices.
//
// Local-first: this works with NO cloud. Optional sync (useCloudSync) mirrors
// each slot to its own Firestore doc /users/{uid}/images/{slot} (one doc per
// image, to stay well under Firestore's 1 MB/doc limit).
//
// A slot can be empty (no record) — then everything behaves exactly as before
// this feature existed.

import { downscaleImage } from "@/lib/logbook";

export type ImageSlot =
  | "image.reference"
  | "image.swatch"
  | "compare.reference"
  | "compare.wip"
  | "mix.target"
  | "mix.paint"
  | "extract.source"
  | "coach.sample"
  | "calibrate.sample"
  | "scene.reference";

interface ImageRecord {
  slot: string;
  blob: Blob;
  updatedAt: number; // ms epoch; the source of truth for cloud diffing
}

const DB_NAME = "pigmentmatch-images";
const DB_VERSION = 1;
const STORE = "images";

let dbPromise: Promise<IDBDatabase> | null = null;

function db(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains(STORE))
        d.createObjectStore(STORE, { keyPath: "slot" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  // Don't cache a failed open forever: a transient error (quota, private-mode
  // restrictions) would otherwise disable the image store for the whole
  // session; dropping the cached rejection lets the next call retry.
  dbPromise.catch(() => {
    dbPromise = null;
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

// Notify listeners (the cloud-sync orchestrator + the on-screen samplers) that a
// slot changed, so they can re-upload / re-draw.
function emitChange(slot: string) {
  try {
    window.dispatchEvent(new CustomEvent("pm-image-changed", { detail: { slot } }));
  } catch {
    // no window — ignore
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

// ---------- local CRUD ----------

export async function getImageRecord(
  slot: string
): Promise<ImageRecord | null> {
  const d = await db();
  const rec = await asPromise(
    d.transaction(STORE, "readonly").objectStore(STORE).get(slot)
  );
  return (rec as ImageRecord) ?? null;
}

export async function getImage(slot: string): Promise<Blob | null> {
  const rec = await getImageRecord(slot);
  return rec?.blob ?? null;
}

export async function listImages(): Promise<
  { slot: string; updatedAt: number }[]
> {
  const d = await db();
  const all = (await asPromise(
    d.transaction(STORE, "readonly").objectStore(STORE).getAll()
  )) as ImageRecord[];
  return all.map((r) => ({ slot: r.slot, updatedAt: r.updatedAt }));
}

// Store an image for a slot. By default the photo is downscaled (≤1000px JPEG)
// so the store stays small and the cloud copy fits in a Firestore doc. Cloud
// pulls pass {downscale:false, updatedAt} to keep the timestamp authoritative.
export async function putImage(
  slot: string,
  blob: Blob,
  opts: { downscale?: boolean; updatedAt?: number } = {}
): Promise<void> {
  const { downscale = true, updatedAt } = opts;
  const stored = downscale ? await downscaleImage(blob) : blob;
  const rec: ImageRecord = {
    slot,
    blob: stored,
    updatedAt: updatedAt ?? Date.now(),
  };
  const d = await db();
  const tx = d.transaction(STORE, "readwrite");
  tx.objectStore(STORE).put(rec);
  await txDone(tx);
  emitChange(slot);
}

export async function deleteImage(slot: string): Promise<void> {
  const d = await db();
  const tx = d.transaction(STORE, "readwrite");
  tx.objectStore(STORE).delete(slot);
  await txDone(tx);
  emitChange(slot);
}

// Wipe every active image from the local store. Emits a change per slot so the
// on-screen samplers / sync know.
export async function clearImages(): Promise<void> {
  const slots = (await listImages()).map((i) => i.slot);
  const d = await db();
  const tx = d.transaction(STORE, "readwrite");
  tx.objectStore(STORE).clear();
  await txDone(tx);
  slots.forEach((s) => emitChange(s));
}

// ---------- cloud (de)serialization helpers ----------

// A slot's image as a base64 data URL (for upload), or null if empty.
export async function imageToDataURL(slot: string): Promise<string | null> {
  const rec = await getImageRecord(slot);
  return rec ? blobToDataURL(rec.blob) : null;
}

// Write a slot from a cloud data URL WITHOUT re-downscaling, stamping the cloud
// timestamp so the next diff sees them as equal.
export async function putImageFromDataURL(
  slot: string,
  dataURL: string,
  updatedAt: number
): Promise<void> {
  const blob = await dataURLToBlob(dataURL);
  await putImage(slot, blob, { downscale: false, updatedAt });
}
