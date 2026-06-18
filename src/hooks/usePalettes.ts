import { useCallback, useEffect, useMemo, useState } from "react";
import {
  loadActiveId,
  loadPalettes,
  saveActiveId,
  savePalettes,
} from "@/lib/storage";
import {
  makeDefaultPalette,
  newId,
  type Palette,
  type Pigment,
} from "@/lib/pigments";

export function usePalettes() {
  const [palettes, setPalettes] = useState<Palette[]>(() => loadPalettes());
  const [activeId, setActiveId] = useState<string>(() =>
    loadActiveId(palettes[0]?.id ?? "default-oil")
  );

  useEffect(() => savePalettes(palettes), [palettes]);
  useEffect(() => saveActiveId(activeId), [activeId]);

  const active = useMemo(
    () => palettes.find((p) => p.id === activeId) ?? palettes[0],
    [palettes, activeId]
  );

  const updateActive = useCallback(
    (mut: (p: Palette) => Palette) => {
      setPalettes((prev) =>
        prev.map((p) => (p.id === active?.id ? mut(p) : p))
      );
    },
    [active?.id]
  );

  const addPigment = useCallback(
    (pigment: Omit<Pigment, "id">) => {
      updateActive((p) => ({
        ...p,
        pigments: [...p.pigments, { ...pigment, id: newId() }],
      }));
    },
    [updateActive]
  );

  const updatePigment = useCallback(
    (id: string, patch: Partial<Pigment>) => {
      updateActive((p) => ({
        ...p,
        pigments: p.pigments.map((pg) =>
          pg.id === id ? { ...pg, ...patch } : pg
        ),
      }));
    },
    [updateActive]
  );

  const removePigment = useCallback(
    (id: string) => {
      updateActive((p) => ({
        ...p,
        pigments: p.pigments.filter((pg) => pg.id !== id),
      }));
    },
    [updateActive]
  );

  const addPalette = useCallback((name: string) => {
    const fresh: Palette = { ...makeDefaultPalette(), id: newId("pal"), name };
    setPalettes((prev) => [...prev, fresh]);
    setActiveId(fresh.id);
  }, []);

  const renameActive = useCallback(
    (name: string) => updateActive((p) => ({ ...p, name })),
    [updateActive]
  );

  const deleteActive = useCallback(() => {
    setPalettes((prev) => {
      const next = prev.filter((p) => p.id !== activeId);
      const result = next.length ? next : [makeDefaultPalette()];
      setActiveId(result[0].id);
      return result;
    });
  }, [activeId]);

  const resetActive = useCallback(() => {
    updateActive((p) => ({ ...p, pigments: makeDefaultPalette().pigments }));
  }, [updateActive]);

  return {
    palettes,
    active,
    activeId,
    setActiveId,
    addPigment,
    updatePigment,
    removePigment,
    addPalette,
    renameActive,
    deleteActive,
    resetActive,
  };
}
