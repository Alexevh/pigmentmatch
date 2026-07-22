import { useEffect, useMemo, useState } from "react";
import {
  loadCalibration,
  loadObservations,
  saveCalibration,
  saveObservations,
} from "@/lib/storage";
import {
  averageError,
  fitCalibration,
  type Calibration,
  type Observation,
  type ObservationItem,
} from "@/lib/calibration";
import { newId, type Pigment } from "@/lib/pigments";
import type { RGB } from "@/lib/color";

// Per-palette calibration state (observations + fitted calibration), persisted
// to localStorage. Mutators write through synchronously so there is no race
// when the active palette changes.
export function useCalibration(paletteId: string, pigments: Pigment[]) {
  const [observations, setObservations] = useState<Observation[]>(() =>
    loadObservations(paletteId)
  );
  const [calibration, setCalibration] = useState<Calibration | null>(() =>
    loadCalibration(paletteId)
  );

  // reload when the active palette changes
  useEffect(() => {
    setObservations(loadObservations(paletteId));
    setCalibration(loadCalibration(paletteId));
  }, [paletteId]);

  // All mutators use FUNCTIONAL updates so several calls in one tick (e.g. the
  // calibration chart adding many observations in a loop, or a conflict resolve
  // that removes-then-adds) each build on the latest list instead of a stale
  // closure — the earlier "29 added but only 1 saved" bug.
  const addObservation = (items: ObservationItem[], observed: RGB) => {
    setObservations((prev) => {
      const next = [...prev, { id: newId("obs"), items, observed }];
      saveObservations(paletteId, next);
      return next;
    });
  };

  // Append many observations at once (one state update, one save).
  const addObservations = (
    list: { items: ObservationItem[]; observed: RGB }[]
  ) => {
    if (!list.length) return;
    setObservations((prev) => {
      const next = [
        ...prev,
        ...list.map((o) => ({ id: newId("obs"), items: o.items, observed: o.observed })),
      ];
      saveObservations(paletteId, next);
      return next;
    });
  };

  const removeObservation = (id: string) => {
    setObservations((prev) => {
      const next = prev.filter((o) => o.id !== id);
      saveObservations(paletteId, next);
      return next;
    });
  };

  const clearObservations = () => {
    setObservations(() => {
      saveObservations(paletteId, []);
      return [];
    });
  };

  const calibrate = (fitColor = false) => {
    const fit = fitCalibration(observations, pigments, { fitColor });
    setCalibration(fit);
    saveCalibration(paletteId, fit);
  };

  const clearCalibration = () => {
    setCalibration(null);
    saveCalibration(paletteId, null);
  };

  // error of the *uncalibrated* model on the current observations
  const beforeError = useMemo(
    () => averageError(observations, pigments),
    [observations, pigments]
  );

  return {
    observations,
    addObservation,
    addObservations,
    removeObservation,
    clearObservations,
    calibration,
    calibrate,
    clearCalibration,
    beforeError,
  };
}

export type CalibrationApi = ReturnType<typeof useCalibration>;
