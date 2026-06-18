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

  const addObservation = (items: ObservationItem[], observed: RGB) => {
    const next = [...observations, { id: newId("obs"), items, observed }];
    setObservations(next);
    saveObservations(paletteId, next);
  };

  const removeObservation = (id: string) => {
    const next = observations.filter((o) => o.id !== id);
    setObservations(next);
    saveObservations(paletteId, next);
  };

  const clearObservations = () => {
    setObservations([]);
    saveObservations(paletteId, []);
  };

  const calibrate = () => {
    const fit = fitCalibration(observations, pigments);
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
    removeObservation,
    clearObservations,
    calibration,
    calibrate,
    clearCalibration,
    beforeError,
  };
}

export type CalibrationApi = ReturnType<typeof useCalibration>;
