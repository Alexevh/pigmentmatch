import { useSyncExternalStore } from "react";

// Optional "batch" size: turn the recipe's proportions into real amounts to mix.
// amount = 0 means off (default) — the recipe just shows parts/percent as before.
// The unit is only a label + rounding rule; per-pigment amount = weight * total.

export type BatchUnit = "ml" | "g" | "drops";

const AMOUNT_KEY = "pigment-match.batchAmount.v1";
const UNIT_KEY = "pigment-match.batchUnit.v1";

function readAmount(): number {
  try {
    const n = parseFloat(localStorage.getItem(AMOUNT_KEY) ?? "");
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}
function readUnit(): BatchUnit {
  try {
    const u = localStorage.getItem(UNIT_KEY);
    return u === "g" || u === "drops" ? u : "ml";
  } catch {
    return "ml";
  }
}

let amount = readAmount();
let unit = readUnit();
const listeners = new Set<() => void>();
function emit() {
  listeners.forEach((l) => l());
}
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function setBatchAmount(next: number) {
  amount = Number.isFinite(next) && next > 0 ? next : 0;
  try {
    localStorage.setItem(AMOUNT_KEY, String(amount));
  } catch {
    // ignore
  }
  emit();
}

export function setBatchUnit(next: BatchUnit) {
  unit = next;
  try {
    localStorage.setItem(UNIT_KEY, next);
  } catch {
    // ignore
  }
  emit();
}

export function useBatchAmount(): number {
  return useSyncExternalStore(subscribe, () => amount, () => amount);
}
export function useBatchUnit(): BatchUnit {
  return useSyncExternalStore(subscribe, () => unit, () => unit);
}

// weight (0..1) × total → numeric string for the unit (no unit label; the
// caller appends the localized unit). Returns "" for zero.
export function formatBatchQty(
  weight: number,
  total: number,
  u: BatchUnit
): string {
  const q = weight * total;
  if (q <= 0) return "";
  if (u === "drops") {
    const r = Math.round(q);
    return r < 1 ? "<1" : `${r}`;
  }
  // ml / g: one decimal, trimmed
  if (q < 0.1) return "<0.1";
  const r = Math.round(q * 10) / 10;
  return r % 1 === 0 ? r.toFixed(0) : r.toFixed(1);
}
