// Optional cloud sync via the user's OWN Firebase project (BYO config).
//
// Why Firebase (and not MongoDB): Firestore is designed to be reached directly
// from the browser — SDK + real-time + offline cache + security rules — so no
// backend of ours is needed. Each user supplies their own project's config
// (see useFirebaseConfig); their data lives under /users/{uid}/ in THEIR
// Firestore, isolated per Google account by the security rules.
//
// The Firebase SDK is loaded with dynamic import() so it never weighs on the
// base bundle — it only downloads when the user actually uses cloud sync.
//
// Model: a single snapshot document. "Backup" pushes the whole local state up;
// "Restore" replaces local state with the cloud copy (then reloads). Manual and
// conflict-free — no merge, no surprises.

import type { FirebaseConfig } from "@/hooks/useFirebaseConfig";
import { exportLogbook, importLogbook, clearAll } from "@/lib/logbook";

export interface CloudUser {
  uid: string;
  email: string | null;
}

// Lazy-initialized, cached SDK handles + instances (Firebase only allows one
// app per config; we reuse it across calls).
interface FB {
  auth: import("firebase/auth").Auth;
  db: import("firebase/firestore").Firestore;
  GoogleAuthProvider: typeof import("firebase/auth").GoogleAuthProvider;
  signInWithPopup: typeof import("firebase/auth").signInWithPopup;
  signOut: typeof import("firebase/auth").signOut;
  onAuthStateChanged: typeof import("firebase/auth").onAuthStateChanged;
  doc: typeof import("firebase/firestore").doc;
  getDoc: typeof import("firebase/firestore").getDoc;
  setDoc: typeof import("firebase/firestore").setDoc;
}

let cached: FB | null = null;

async function fb(config: FirebaseConfig): Promise<FB> {
  if (cached) return cached;
  const [appMod, authMod, fsMod] = await Promise.all([
    import("firebase/app"),
    import("firebase/auth"),
    import("firebase/firestore"),
  ]);
  const app = appMod.getApps().length
    ? appMod.getApps()[0]
    : appMod.initializeApp(config);
  cached = {
    auth: authMod.getAuth(app),
    db: fsMod.getFirestore(app),
    GoogleAuthProvider: authMod.GoogleAuthProvider,
    signInWithPopup: authMod.signInWithPopup,
    signOut: authMod.signOut,
    onAuthStateChanged: authMod.onAuthStateChanged,
    doc: fsMod.doc,
    getDoc: fsMod.getDoc,
    setDoc: fsMod.setDoc,
  };
  return cached;
}

function toUser(u: { uid: string; email: string | null } | null): CloudUser | null {
  return u ? { uid: u.uid, email: u.email } : null;
}

// Subscribe to auth state; returns an unsubscribe function (wrapped in a promise
// because we lazy-load the SDK first).
export async function cloudWatch(
  config: FirebaseConfig,
  cb: (user: CloudUser | null) => void
): Promise<() => void> {
  const f = await fb(config);
  return f.onAuthStateChanged(f.auth, (u) => cb(toUser(u)));
}

export async function cloudSignIn(config: FirebaseConfig): Promise<CloudUser> {
  const f = await fb(config);
  const res = await f.signInWithPopup(f.auth, new f.GoogleAuthProvider());
  return { uid: res.user.uid, email: res.user.email };
}

export async function cloudSignOut(config: FirebaseConfig): Promise<void> {
  const f = await fb(config);
  await f.signOut(f.auth);
}

// ---------- Snapshot of all local app data (no photos) ----------

// Every app preference/palette/calibration lives in localStorage under these
// prefixes. We snapshot them all generically so new prefs sync automatically —
// except the Firebase config itself (device-specific bootstrap; must not be
// overwritten by a restore).
export const LS_PREFIXES = ["pigment-match.", "pigmentmatch."];
// Device-specific control keys that must NEVER travel in a snapshot (otherwise a
// restore would clobber this device's Firebase config / sync bookkeeping).
export const LS_EXCLUDE = new Set([
  "pigmentmatch.firebaseConfig",
  "pigmentmatch.cloudSyncEnabled",
  "pigmentmatch.cloudLastApplied",
]);

interface Snapshot {
  v: 1;
  ls: Record<string, string>;
  logbook: string; // exportLogbook(false) JSON — text only, no images
}

async function collectSnapshot(): Promise<Snapshot> {
  const ls: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || LS_EXCLUDE.has(k)) continue;
    if (LS_PREFIXES.some((p) => k.startsWith(p))) {
      ls[k] = localStorage.getItem(k) ?? "";
    }
  }
  const logbook = await exportLogbook(false);
  return { v: 1, ls, logbook };
}

async function applySnapshot(snap: Snapshot): Promise<void> {
  // Replace the synced localStorage keys (leave the Firebase config alone).
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const k = localStorage.key(i);
    if (!k || LS_EXCLUDE.has(k)) continue;
    if (LS_PREFIXES.some((p) => k.startsWith(p))) localStorage.removeItem(k);
  }
  for (const [k, val] of Object.entries(snap.ls ?? {})) {
    if (LS_EXCLUDE.has(k)) continue;
    localStorage.setItem(k, val);
  }
  // Replace the logbook (clear then import).
  await clearAll();
  if (snap.logbook) {
    try {
      await importLogbook(snap.logbook);
    } catch {
      // empty / malformed logbook in the snapshot — skip rather than fail
    }
  }
}

const DOC_PATH = (uid: string) => ["users", uid, "backup", "data"] as const;

// Push the whole local state to the cloud. Returns the bytes stored and the
// timestamp written (so the caller can remember it as "already applied here").
export async function cloudBackup(
  config: FirebaseConfig,
  uid: string
): Promise<{ bytes: number; updatedAt: string }> {
  const f = await fb(config);
  const snap = await collectSnapshot();
  const json = JSON.stringify(snap);
  const updatedAt = new Date().toISOString();
  await f.setDoc(f.doc(f.db, ...DOC_PATH(uid)), { json, updatedAt });
  return { bytes: json.length, updatedAt };
}

export interface CloudInfo {
  updatedAt: string | null;
  exists: boolean;
}

export async function cloudInfo(
  config: FirebaseConfig,
  uid: string
): Promise<CloudInfo> {
  const f = await fb(config);
  const snap = await f.getDoc(f.doc(f.db, ...DOC_PATH(uid)));
  if (!snap.exists()) return { exists: false, updatedAt: null };
  const data = snap.data() as { updatedAt?: string };
  return { exists: true, updatedAt: data.updatedAt ?? null };
}

// Pull the cloud copy and replace local state. Caller should reload the app
// afterwards so the new palettes/prefs take effect. Returns false if no backup
// exists in the cloud.
export async function cloudRestore(
  config: FirebaseConfig,
  uid: string
): Promise<boolean> {
  const f = await fb(config);
  const snap = await f.getDoc(f.doc(f.db, ...DOC_PATH(uid)));
  if (!snap.exists()) return false;
  const data = snap.data() as { json?: string };
  if (!data.json) return false;
  await applySnapshot(JSON.parse(data.json) as Snapshot);
  return true;
}
