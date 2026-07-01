import { useEffect, useState } from "react";
import { NotebookPen, X, Check } from "lucide-react";
import { rgbToHex, valueScore, type RGB } from "@/lib/color";
import {
  recipePercentages,
  percentLabel,
  type Recipe,
} from "@/lib/mixer";
import { useT } from "@/lib/i18n";
import {
  getProjects,
  putProject,
  putEntry,
  newId,
  type LogProject,
} from "@/lib/logbook";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const NEW = "__new__";

// Turn a computed recipe into a compact, language-neutral text line for the
// logbook, e.g. "60% Titanium White · 30% Cadmium Red · touch Yellow Ochre".
function recipeToText(recipe: Recipe): string {
  const pcts = recipePercentages(recipe.items);
  return recipe.items
    .map((it, i) =>
      it.parts != null
        ? `${percentLabel(pcts[i])} ${it.pigment.name}`
        : `touch ${it.pigment.name}`
    )
    .join(" · ");
}

// One-click "save this mix to the Logbook": pick (or create) a project, tweak
// the auto-filled name / recipe text / notes, and store it as a color entry.
export function SaveRecipeModal({
  target,
  recipe,
  paletteName,
  onClose,
}: {
  target: RGB;
  recipe: Recipe;
  paletteName?: string;
  onClose: () => void;
}) {
  const { t } = useT();
  const hex = rgbToHex(target);

  const [projects, setProjects] = useState<LogProject[]>([]);
  const [projectId, setProjectId] = useState<string>(NEW);
  const [newName, setNewName] = useState(
    paletteName ? `${paletteName}` : ""
  );
  const [entryName, setEntryName] = useState(hex);
  const [recipeText, setRecipeText] = useState(recipeToText(recipe));
  const [notes, setNotes] = useState(
    `${t("saveRecipe.notesTarget")} ${hex} · ${t("recipe.match")} ${recipe.match}% · ${t("recipe.value")} ${valueScore(recipe.deltaL)}%`
  );
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    getProjects().then((ps) => {
      setProjects(ps);
      if (ps.length) setProjectId(ps[0].id);
    });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const save = async () => {
    setBusy(true);
    try {
      const now = Date.now();
      let pid = projectId;
      if (projectId === NEW) {
        pid = newId("proj");
        await putProject({
          id: pid,
          name: newName.trim() || t("saveRecipe.defaultProject"),
          notes: "",
          createdAt: now,
          updatedAt: now,
        });
      }
      await putEntry({
        id: newId("entry"),
        projectId: pid,
        name: entryName.trim() || hex,
        recipe: recipeText.trim(),
        notes: notes.trim(),
        hex,
        createdAt: now,
        updatedAt: now,
      });
      setDone(true);
      setTimeout(onClose, 900);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-lg border border-border bg-background shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-3.5">
          <h3 className="flex items-center gap-2 font-semibold">
            <NotebookPen className="h-4 w-4 text-accent" />
            {t("saveRecipe.title")}
          </h3>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {done ? (
          <div className="flex items-center gap-2 px-5 py-8 text-sm text-accent">
            <Check className="h-5 w-5" /> {t("saveRecipe.saved")}
          </div>
        ) : (
          <div className="space-y-3 px-5 py-4 text-sm">
            <div className="flex items-center gap-3">
              <span
                className="h-10 w-10 shrink-0 rounded-md border border-border"
                style={{ backgroundColor: hex }}
              />
              <span className="font-mono text-xs text-muted-foreground">
                {hex}
              </span>
            </div>

            {/* Project */}
            <label className="block space-y-1">
              <span className="text-xs font-medium text-muted-foreground">
                {t("saveRecipe.project")}
              </span>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
                <option value={NEW}>{t("saveRecipe.newProject")}</option>
              </select>
            </label>
            {projectId === NEW && (
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={t("saveRecipe.newProjectName")}
              />
            )}

            {/* Entry name */}
            <label className="block space-y-1">
              <span className="text-xs font-medium text-muted-foreground">
                {t("saveRecipe.name")}
              </span>
              <Input
                value={entryName}
                onChange={(e) => setEntryName(e.target.value)}
              />
            </label>

            {/* Recipe text (editable) */}
            <label className="block space-y-1">
              <span className="text-xs font-medium text-muted-foreground">
                {t("saveRecipe.recipe")}
              </span>
              <textarea
                value={recipeText}
                onChange={(e) => setRecipeText(e.target.value)}
                rows={2}
                className="w-full rounded-md border border-input bg-background p-2 text-sm"
              />
            </label>

            {/* Notes */}
            <label className="block space-y-1">
              <span className="text-xs font-medium text-muted-foreground">
                {t("saveRecipe.notes")}
              </span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full rounded-md border border-input bg-background p-2 text-sm"
              />
            </label>
          </div>
        )}

        {!done && (
          <div className="flex justify-end gap-2 border-t border-border/60 px-5 py-3">
            <Button variant="ghost" size="sm" onClick={onClose}>
              {t("saveRecipe.cancel")}
            </Button>
            <Button variant="accent" size="sm" onClick={save} disabled={busy}>
              <NotebookPen className="h-4 w-4" /> {t("saveRecipe.save")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
