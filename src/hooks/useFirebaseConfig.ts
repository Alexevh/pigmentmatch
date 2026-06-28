import { useSyncExternalStore } from "react";

// The user's OWN Firebase web config (BYO: each user creates their own Firebase
// project and pastes its config here). It is NOT a secret — the config is public
// by design; access is protected by Firestore security rules + Google sign-in.
// Stored only in this browser; never bundled into the app.

const KEY = "pigmentmatch.firebaseConfig";

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId: string;
}

// Parse a pasted Firebase config — accepts either strict JSON or the JS snippet
// the Firebase console shows (`const firebaseConfig = { apiKey: "...", ... }`),
// pulling each known key out by regex so unquoted keys / trailing commas are ok.
export function parseFirebaseConfig(text: string): FirebaseConfig | null {
  const pick = (k: string) => {
    const m = text.match(
      new RegExp(`${k}\\s*[:=]\\s*["']([^"']+)["']`)
    );
    return m ? m[1] : "";
  };
  const cfg: FirebaseConfig = {
    apiKey: pick("apiKey"),
    authDomain: pick("authDomain"),
    projectId: pick("projectId"),
    storageBucket: pick("storageBucket") || undefined,
    messagingSenderId: pick("messagingSenderId") || undefined,
    appId: pick("appId"),
  };
  // Require the fields auth + firestore actually need.
  if (cfg.apiKey && cfg.authDomain && cfg.projectId && cfg.appId) return cfg;
  return null;
}

function read(): FirebaseConfig | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as FirebaseConfig) : null;
  } catch {
    return null;
  }
}

let value = read();
const listeners = new Set<() => void>();

export function setFirebaseConfig(next: FirebaseConfig | null) {
  value = next;
  try {
    if (next) localStorage.setItem(KEY, JSON.stringify(next));
    else localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
  listeners.forEach((l) => l());
}

export function useFirebaseConfig(): FirebaseConfig | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => value,
    () => value
  );
}
