import { useSyncExternalStore } from "react";
import type { FirebaseConfig } from "@/hooks/useFirebaseConfig";
import {
  cloudWatch,
  cloudSignIn,
  cloudSignOut,
  cloudBackup,
  cloudRestore,
  cloudInfo,
  LS_PREFIXES,
  LS_EXCLUDE,
  type CloudUser,
} from "@/lib/cloudSync";

// Orchestrates OPTIONAL active cloud sync. It is a module singleton (one set of
// auth/listeners for the whole app) exposed to React via useSyncExternalStore.
//
// Behaviour when the user turns sync ON (and is signed in):
//   • on open: pull from the cloud if it changed since this device last applied,
//     then reload so every store reads the fresh data;
//   • on any local change (palettes, settings, logbook): debounce-upload it.
// When OFF (the default), nothing touches the network — the app is 100% local.
//
// "Already applied here" is tracked by the cloud doc's updatedAt timestamp, so a
// device never re-pulls or reloads on its own changes, and only reloads when the
// cloud genuinely moved ahead of it.

const ENABLED_KEY = "pigmentmatch.cloudSyncEnabled";
const LAST_KEY = "pigmentmatch.cloudLastApplied";
const PUSH_DEBOUNCE = 2500;

export type CloudStatus =
  | "off" // disabled or no config
  | "connecting"
  | "signin" // enabled + config, but not signed in yet
  | "syncing"
  | "ready" // in sync
  | "error";

export interface CloudState {
  enabled: boolean;
  user: CloudUser | null;
  status: CloudStatus;
  lastSync: string | null; // ISO of the last successful push/pull
  busy: boolean; // a user-initiated action (sign-in, manual backup) is running
  error: string | null;
}

let config: FirebaseConfig | null = null;
let unsubAuth: (() => void) | null = null;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let applying = false; // suppress auto-push while a restore writes local data

function readBool(k: string): boolean {
  try {
    return localStorage.getItem(k) === "1";
  } catch {
    return false;
  }
}
function readStr(k: string): string | null {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}
function writeRaw(k: string, v: string) {
  try {
    rawSetItem(k, v);
  } catch {
    // ignore
  }
}

const live: CloudState = {
  enabled: readBool(ENABLED_KEY),
  user: null,
  status: "off",
  lastSync: readStr(LAST_KEY),
  busy: false,
  error: null,
};
let snapshot: CloudState = { ...live };
const listeners = new Set<() => void>();

function emit() {
  snapshot = { ...live };
  listeners.forEach((l) => l());
}

function setLastApplied(updatedAt: string) {
  writeRaw(LAST_KEY, updatedAt);
  live.lastSync = updatedAt;
}

function onError(e: unknown) {
  live.status = "error";
  live.error = e instanceof Error ? e.message : String(e);
  emit();
}

// ---- change detection (drives auto-push) -------------------------------------

const rawSetItem = localStorage.setItem.bind(localStorage);

function isSyncedKey(k: string): boolean {
  if (LS_EXCLUDE.has(k)) return false;
  return LS_PREFIXES.some((p) => k.startsWith(p));
}

// Patch localStorage.setItem ONCE so every palette/preference write schedules an
// upload — no need to wire each individual store. The logbook (IndexedDB) emits
// a window event instead. Installed lazily and ONLY when the user has turned
// sync on, so a user who never uses cloud sync gets the stock behavior untouched.
let patched = false;
function installDetectors() {
  if (patched) return;
  patched = true;
  localStorage.setItem = (k: string, v: string) => {
    rawSetItem(k, v);
    // Detection must never be able to break a normal localStorage write.
    try {
      if (isSyncedKey(k)) schedulePush();
    } catch {
      /* ignore */
    }
  };
  window.addEventListener("pm-logbook-changed", schedulePush);
  // Flush a pending upload promptly when the tab is hidden / closed.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && pushTimer) flushPush();
  });
}

function schedulePush() {
  if (!live.enabled || !config || !live.user || applying) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(flushPush, PUSH_DEBOUNCE);
}

async function flushPush() {
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
  if (!live.enabled || !config || !live.user) return;
  live.status = "syncing";
  emit();
  try {
    const { updatedAt } = await cloudBackup(config, live.user.uid);
    setLastApplied(updatedAt);
    live.status = "ready";
    live.error = null;
    emit();
  } catch (e) {
    onError(e);
  }
}

// ---- lifecycle ---------------------------------------------------------------

// Called by App whenever the saved Firebase config changes (incl. on mount).
// Only arms change-detection when sync is actually enabled — otherwise it's a
// complete no-op and the app behaves exactly as it did before cloud sync existed.
export function configureCloud(cfg: FirebaseConfig | null) {
  config = cfg;
  if (live.enabled) installDetectors();
  reconcile();
}

function reconcile() {
  if (!live.enabled || !config) {
    if (unsubAuth) {
      unsubAuth();
      unsubAuth = null;
    }
    live.user = null;
    live.status = "off";
    emit();
    return;
  }
  if (!unsubAuth) {
    live.status = "connecting";
    emit();
    cloudWatch(config, onUser)
      .then((u) => {
        unsubAuth = u;
      })
      .catch(onError);
  }
}

function onUser(u: CloudUser | null) {
  live.user = u;
  if (u && live.enabled && config) {
    initialSync();
  } else {
    live.status = live.enabled && config ? "signin" : "off";
    emit();
  }
}

// On open: pull if the cloud is ahead of what this device last applied.
async function initialSync() {
  if (!config || !live.user) return;
  const uid = live.user.uid;
  live.status = "syncing";
  live.error = null;
  emit();
  try {
    const info = await cloudInfo(config, uid);
    if (!info.exists) {
      // First time — seed the cloud from this device's local data.
      const { updatedAt } = await cloudBackup(config, uid);
      setLastApplied(updatedAt);
      live.status = "ready";
      emit();
      return;
    }
    if (info.updatedAt && info.updatedAt !== readStr(LAST_KEY)) {
      // Cloud moved ahead — apply it, remember it, then reload so all stores
      // re-read the fresh local data.
      applying = true;
      const ok = await cloudRestore(config, uid);
      if (ok && info.updatedAt) setLastApplied(info.updatedAt);
      window.location.reload();
      return;
    }
    // Already current.
    live.status = "ready";
    if (info.updatedAt) live.lastSync = info.updatedAt;
    emit();
  } catch (e) {
    onError(e);
  }
}

// ---- user-initiated actions (used by the Settings UI) ------------------------

export function setCloudEnabled(on: boolean) {
  live.enabled = on;
  writeRaw(ENABLED_KEY, on ? "1" : "0");
  if (on) installDetectors();
  emit();
  reconcile();
}

export async function cloudSignInAction() {
  if (!config) return;
  live.busy = true;
  live.error = null;
  emit();
  try {
    await cloudSignIn(config); // onAuthStateChanged → onUser → initialSync
  } catch (e) {
    onError(e);
  } finally {
    live.busy = false;
    emit();
  }
}

export async function cloudSignOutAction() {
  if (!config) return;
  live.busy = true;
  emit();
  try {
    await cloudSignOut(config);
  } catch (e) {
    onError(e);
  } finally {
    live.busy = false;
    emit();
  }
}

// Force an immediate upload. Returns the KB stored.
export async function cloudBackupNow(): Promise<number> {
  if (!config || !live.user) throw new Error("not signed in");
  const { bytes, updatedAt } = await cloudBackup(config, live.user.uid);
  setLastApplied(updatedAt);
  live.status = "ready";
  emit();
  return Math.max(1, Math.round(bytes / 1024));
}

// Force a pull from the cloud (replaces local + reloads). Returns false if the
// cloud has no backup yet.
export async function cloudRestoreNow(): Promise<boolean> {
  if (!config || !live.user) throw new Error("not signed in");
  const info = await cloudInfo(config, live.user.uid);
  if (!info.exists) return false;
  applying = true;
  const ok = await cloudRestore(config, live.user.uid);
  if (ok && info.updatedAt) setLastApplied(info.updatedAt);
  window.location.reload();
  return true;
}

export function useCloudSync(): CloudState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => snapshot,
    () => snapshot
  );
}
