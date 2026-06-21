import { useEffect, useRef, useState } from "react";
import {
  Plus,
  Download,
  Upload,
  Trash2,
  Pencil,
  X,
  Check,
  Info,
  HardDrive,
  Database,
  AlertTriangle,
  Save,
  Pipette,
  Camera,
  Image as ImageIcon,
} from "lucide-react";
import { rgbToHex } from "@/lib/color";
import { useT } from "@/lib/i18n";
import { CameraCapture } from "@/components/CameraCapture";
import {
  getProjects,
  getEntries,
  putProject,
  deleteProject,
  putEntry,
  deleteEntry,
  downscaleImage,
  exportLogbook,
  importLogbook,
  newId,
  type LogProject,
  type LogEntry,
} from "@/lib/logbook";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

// Render an IndexedDB Blob as an <img>, managing the object URL lifecycle.
function BlobImg({
  blob,
  className,
  alt,
}: {
  blob?: Blob;
  className?: string;
  alt?: string;
}) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!blob) {
      setUrl(undefined);
      return;
    }
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  if (!url) return null;
  return <img src={url} alt={alt} className={className} />;
}

// Upload control: a labeled photo slot that downscales on pick and shows a
// thumbnail with replace / remove actions.
function PhotoField({
  label,
  blob,
  onChange,
}: {
  label: string;
  blob?: Blob;
  onChange: (b?: Blob) => void;
}) {
  const { t } = useT();
  const ref = useRef<HTMLInputElement>(null);
  const [showCam, setShowCam] = useState(false);
  return (
    <div className="space-y-1.5">
      {showCam && (
        <CameraCapture
          onCapture={async (b) => onChange(await downscaleImage(b))}
          onClose={() => setShowCam(false)}
        />
      )}
      <label className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (f) onChange(await downscaleImage(f));
          e.target.value = "";
        }}
      />
      {blob ? (
        <div className="flex items-start gap-2">
          <BlobImg
            blob={blob}
            alt={label}
            className="h-20 w-20 rounded-md border border-border object-cover"
          />
          <div className="flex flex-col gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => ref.current?.click()}
            >
              {t("logbook.replacePhoto")}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowCam(true)}>
              <Camera className="h-3.5 w-3.5" /> {t("camera.use")}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onChange(undefined)}>
              <X className="h-3.5 w-3.5" /> {t("logbook.removePhoto")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          <button
            onClick={() => ref.current?.click()}
            className="flex h-20 w-full flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-border text-muted-foreground transition-colors hover:border-accent hover:text-foreground"
          >
            <ImageIcon className="h-5 w-5" />
            <span className="text-xs">{t("logbook.addPhoto")}</span>
          </button>
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => setShowCam(true)}
          >
            <Camera className="h-3.5 w-3.5" /> {t("camera.use")}
          </Button>
        </div>
      )}
    </div>
  );
}

// Click the already-uploaded swatch photo to lift its color into the chip —
// no second upload needed (draws the stored Blob to a canvas and reads a pixel).
function SwatchSampler({
  blob,
  onPick,
}: {
  blob: Blob;
  onPick: (hex: string) => void;
}) {
  const { t } = useT();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hover, setHover] = useState<string | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const c = canvasRef.current;
      if (!c) {
        URL.revokeObjectURL(url);
        return;
      }
      const maxW = 360;
      const scale = Math.min(1, maxW / img.width);
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext("2d", { willReadFrequently: true })?.drawImage(
        img,
        0,
        0,
        c.width,
        c.height
      );
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }, [blob]);

  const sampleAt = (e: React.MouseEvent<HTMLCanvasElement>): string | null => {
    const c = canvasRef.current;
    if (!c) return null;
    const rect = c.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * c.width);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * c.height);
    const d = c
      .getContext("2d", { willReadFrequently: true })
      ?.getImageData(x, y, 1, 1).data;
    if (!d) return null;
    return rgbToHex({ r: d[0], g: d[1], b: d[2] });
  };

  return (
    <div className="space-y-1.5">
      <p className="text-xs text-muted-foreground">
        {t("logbook.pickFromSwatch")}
      </p>
      <canvas
        ref={canvasRef}
        onMouseMove={(e) => setHover(sampleAt(e))}
        onMouseLeave={() => setHover(null)}
        onClick={(e) => {
          const hex = sampleAt(e);
          if (hex) onPick(hex);
        }}
        className="max-w-sm cursor-crosshair rounded-md border border-border"
      />
      {hover && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span
            className="h-4 w-4 rounded border border-border"
            style={{ backgroundColor: hover }}
          />
          <span className="font-mono">{hover}</span>
        </div>
      )}
    </div>
  );
}

// Inline editor for creating or editing a color entry.
function EntryEditor({
  projectId,
  entry,
  onSaved,
  onCancel,
}: {
  projectId: string;
  entry?: LogEntry;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const { t } = useT();
  const [name, setName] = useState(entry?.name ?? "");
  const [recipe, setRecipe] = useState(entry?.recipe ?? "");
  const [notes, setNotes] = useState(entry?.notes ?? "");
  const [hex, setHex] = useState(entry?.hex ?? "");
  const [ref, setRef] = useState<Blob | undefined>(entry?.ref);
  const [swatch, setSwatch] = useState<Blob | undefined>(entry?.swatch);
  const [picking, setPicking] = useState(false);

  async function save() {
    const now = Date.now();
    await putEntry({
      id: entry?.id ?? newId("entry"),
      projectId,
      name: name.trim(),
      recipe: recipe.trim(),
      notes: notes.trim(),
      hex: hex || undefined,
      ref,
      swatch,
      createdAt: entry?.createdAt ?? now,
      updatedAt: now,
    });
    onSaved();
  }

  return (
    <Card className="border-accent/40">
      <CardContent className="space-y-4 pt-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              {t("logbook.colorName")}
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("logbook.colorNamePh")}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              {t("logbook.chipColor")}
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={hex || "#cccccc"}
                onChange={(e) => setHex(e.target.value.toUpperCase())}
                className="h-10 w-12 cursor-pointer rounded-md border border-border bg-background"
              />
              {hex ? (
                <>
                  <span className="font-mono text-sm">{hex}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setHex("")}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </>
              ) : (
                <span className="text-xs text-muted-foreground">—</span>
              )}
            </div>
            {swatch && (
              <Button
                variant={picking ? "accent" : "outline"}
                size="sm"
                onClick={() => setPicking((p) => !p)}
              >
                <Pipette className="h-3.5 w-3.5" /> {t("logbook.pickFromSwatch")}
              </Button>
            )}
          </div>
        </div>

        {picking && swatch && (
          <SwatchSampler
            blob={swatch}
            onPick={(hex) => {
              setHex(hex);
              setPicking(false);
            }}
          />
        )}

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            {t("logbook.recipe")}
          </label>
          <textarea
            value={recipe}
            onChange={(e) => setRecipe(e.target.value)}
            placeholder={t("logbook.recipePh")}
            rows={2}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            {t("logbook.notes")}
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t("logbook.notesPh")}
            rows={2}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <PhotoField
            label={t("logbook.swatchPhoto")}
            blob={swatch}
            onChange={setSwatch}
          />
          <PhotoField
            label={t("logbook.refPhoto")}
            blob={ref}
            onChange={setRef}
          />
        </div>

        <div className="flex gap-2">
          <Button variant="accent" size="sm" onClick={save}>
            <Check className="h-4 w-4" /> {t("logbook.saveColor")}
          </Button>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            {t("logbook.cancel")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// A saved color entry, read-only card with edit / delete.
function EntryCard({
  entry,
  onEdit,
  onDelete,
}: {
  entry: LogEntry;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useT();
  return (
    <Card>
      <CardContent className="flex gap-4 pt-5">
        <div className="flex shrink-0 flex-col gap-2">
          {entry.hex ? (
            <span
              className="h-12 w-12 rounded-md border border-border"
              style={{ backgroundColor: entry.hex }}
              title={entry.hex}
            />
          ) : (
            <span className="flex h-12 w-12 items-center justify-center rounded-md border border-dashed border-border text-muted-foreground">
              <ImageIcon className="h-4 w-4" />
            </span>
          )}
          {entry.swatch && (
            <BlobImg
              blob={entry.swatch}
              alt={t("logbook.swatchPhoto")}
              className="h-12 w-12 rounded-md border border-border object-cover"
            />
          )}
          {entry.ref && (
            <BlobImg
              blob={entry.ref}
              alt={t("logbook.refPhoto")}
              className="h-12 w-12 rounded-md border border-border object-cover"
            />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h4 className="font-medium leading-tight">
              {entry.name || (
                <span className="text-muted-foreground">
                  {t("logbook.unnamed")}
                </span>
              )}
              {entry.hex && (
                <span className="ml-2 font-mono text-xs text-muted-foreground">
                  {entry.hex}
                </span>
              )}
            </h4>
            <div className="flex shrink-0 gap-1">
              <Button variant="ghost" size="icon" onClick={onEdit} title={t("logbook.editColor")}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={onDelete} title={t("logbook.delete")}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {entry.recipe && (
            <p className="mt-1 whitespace-pre-wrap text-sm">{entry.recipe}</p>
          )}
          {entry.notes && (
            <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">
              {entry.notes}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Explains where data is stored (localStorage + IndexedDB), the caveats, and
// how to back up / restore. Local-only apps need this — users must know their
// data is per-browser and how to keep a copy.
function StorageInfoModal({ onClose }: { onClose: () => void }) {
  const { t } = useT();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-background shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border/60 px-5 py-3.5">
          <h3 className="flex items-center gap-2 font-semibold">
            <Info className="h-4 w-4 text-accent" /> {t("logbook.storage.title")}
          </h3>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-4 px-5 py-4 text-sm">
          <p className="text-muted-foreground">{t("logbook.storage.intro")}</p>

          <div className="flex gap-3">
            <HardDrive className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
            <p>
              <span className="font-medium">
                {t("logbook.storage.localTitle")}
              </span>
              <br />
              <span className="text-muted-foreground">
                {t("logbook.storage.localBody")}
              </span>
            </p>
          </div>
          <div className="flex gap-3">
            <Database className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
            <p>
              <span className="font-medium">
                {t("logbook.storage.idbTitle")}
              </span>
              <br />
              <span className="text-muted-foreground">
                {t("logbook.storage.idbBody")}
              </span>
            </p>
          </div>

          <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
            <p className="flex items-center gap-2 font-medium">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              {t("logbook.storage.cautionsTitle")}
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
              <li>{t("logbook.storage.caution1")}</li>
              <li>{t("logbook.storage.caution2")}</li>
              <li>{t("logbook.storage.caution3")}</li>
              <li>{t("logbook.storage.caution4")}</li>
            </ul>
          </div>

          <div className="flex gap-3">
            <Save className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
            <p>
              <span className="font-medium">
                {t("logbook.storage.backupTitle")}
              </span>
              <br />
              <span className="text-muted-foreground">
                {t("logbook.storage.backupBody")}
              </span>
            </p>
          </div>

          <p className="rounded-md bg-secondary/60 px-3 py-2 text-xs">
            {t("logbook.storage.tip")}
          </p>
        </div>

        <div className="flex justify-end border-t border-border/60 px-5 py-3">
          <Button variant="accent" size="sm" onClick={onClose}>
            {t("logbook.storage.close")}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function LogbookView() {
  const { t } = useT();
  const [projects, setProjects] = useState<LogProject[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [renameText, setRenameText] = useState("");
  const [editingEntry, setEditingEntry] = useState<LogEntry | "new" | null>(
    null
  );
  const [showStorage, setShowStorage] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  const active = projects.find((p) => p.id === activeId) ?? null;

  useEffect(() => {
    getProjects().then((ps) => {
      setProjects(ps);
      setActiveId((cur) => cur ?? ps[0]?.id ?? null);
    });
  }, []);

  useEffect(() => {
    if (activeId) getEntries(activeId).then(setEntries);
    else setEntries([]);
  }, [activeId]);

  async function reloadProjects(selectId?: string) {
    const ps = await getProjects();
    setProjects(ps);
    if (selectId) setActiveId(selectId);
    else if (!ps.find((p) => p.id === activeId)) setActiveId(ps[0]?.id ?? null);
  }
  async function reloadEntries() {
    if (activeId) setEntries(await getEntries(activeId));
  }

  async function createProject() {
    const name = newName.trim();
    if (!name) return;
    const now = Date.now();
    const id = newId("proj");
    await putProject({ id, name, notes: "", createdAt: now, updatedAt: now });
    setNewName("");
    await reloadProjects(id);
  }

  async function saveRename() {
    if (!active) return;
    const name = renameText.trim() || active.name;
    await putProject({ ...active, name, updatedAt: Date.now() });
    setRenaming(false);
    await reloadProjects(active.id);
  }

  async function removeProject() {
    if (!active) return;
    if (!window.confirm(t("logbook.confirmDeleteProject"))) return;
    await deleteProject(active.id);
    await reloadProjects();
  }

  async function removeEntry(id: string) {
    if (!window.confirm(t("logbook.confirmDeleteEntry"))) return;
    await deleteEntry(id);
    await reloadEntries();
  }

  async function doExport() {
    if (projects.length === 0) {
      setMsg(t("logbook.exportEmpty"));
      return;
    }
    const json = await exportLogbook();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pigment-logbook-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function doImport(file: File) {
    try {
      const text = await file.text();
      const n = await importLogbook(text);
      setMsg(t("logbook.imported", { n }));
      await reloadProjects();
    } catch {
      setMsg(t("logbook.importError"));
    }
  }

  return (
    <div className="space-y-5">
      {showStorage && <StorageInfoModal onClose={() => setShowStorage(false)} />}

      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">{t("logbook.intro")}</p>
        <button
          onClick={() => setShowStorage(true)}
          className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
        >
          <Info className="h-3.5 w-3.5" /> {t("logbook.storage.button")}
        </button>
      </div>

      {/* Top bar: project select + create + export/import */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            {t("logbook.projects")}
          </label>
          <select
            value={activeId ?? ""}
            onChange={(e) => {
              setActiveId(e.target.value || null);
              setRenaming(false);
              setEditingEntry(null);
            }}
            disabled={projects.length === 0}
            className="flex h-10 min-w-48 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          >
            {projects.length === 0 && <option value="">—</option>}
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-end gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createProject()}
            placeholder={t("logbook.projectNamePh")}
            className="w-52"
          />
          <Button variant="outline" size="default" onClick={createProject}>
            <Plus className="h-4 w-4" /> {t("logbook.newProject")}
          </Button>
        </div>

        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="default" onClick={doExport}>
            <Download className="h-4 w-4" /> {t("logbook.export")}
          </Button>
          <Button
            variant="outline"
            size="default"
            onClick={() => importRef.current?.click()}
          >
            <Upload className="h-4 w-4" /> {t("logbook.import")}
          </Button>
          <input
            ref={importRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) doImport(f);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      {msg && (
        <p className="rounded-md bg-secondary/60 px-3 py-2 text-sm">{msg}</p>
      )}

      {projects.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          {t("logbook.noProjects")}
        </p>
      ) : active ? (
        <div className="space-y-4">
          {/* Project header */}
          <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-3">
            {renaming ? (
              <div className="flex items-center gap-2">
                <Input
                  value={renameText}
                  onChange={(e) => setRenameText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && saveRename()}
                  className="w-56"
                  autoFocus
                />
                <Button variant="accent" size="sm" onClick={saveRename}>
                  {t("logbook.save")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setRenaming(false)}
                >
                  {t("logbook.cancel")}
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold">{active.name}</h3>
                <span className="text-xs text-muted-foreground">
                  {t("logbook.count", { n: entries.length })}
                </span>
              </div>
            )}
            {!renaming && (
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setRenameText(active.name);
                    setRenaming(true);
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" /> {t("logbook.rename")}
                </Button>
                <Button variant="ghost" size="sm" onClick={removeProject}>
                  <Trash2 className="h-3.5 w-3.5" /> {t("logbook.delete")}
                </Button>
              </div>
            )}
          </div>

          {/* Add color button / editor */}
          {editingEntry === "new" ? (
            <EntryEditor
              projectId={active.id}
              onSaved={() => {
                setEditingEntry(null);
                reloadEntries();
                reloadProjects(active.id);
              }}
              onCancel={() => setEditingEntry(null)}
            />
          ) : (
            <Button
              variant="accent"
              size="sm"
              onClick={() => setEditingEntry("new")}
            >
              <Plus className="h-4 w-4" /> {t("logbook.addColor")}
            </Button>
          )}

          {/* Entries */}
          {entries.length === 0 && editingEntry !== "new" ? (
            <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
              {t("logbook.noEntries")}
            </p>
          ) : (
            <div className="space-y-3">
              {entries.map((e) =>
                editingEntry !== "new" &&
                typeof editingEntry === "object" &&
                editingEntry?.id === e.id ? (
                  <EntryEditor
                    key={e.id}
                    projectId={active.id}
                    entry={e}
                    onSaved={() => {
                      setEditingEntry(null);
                      reloadEntries();
                    }}
                    onCancel={() => setEditingEntry(null)}
                  />
                ) : (
                  <EntryCard
                    key={e.id}
                    entry={e}
                    onEdit={() => setEditingEntry(e)}
                    onDelete={() => removeEntry(e.id)}
                  />
                )
              )}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
