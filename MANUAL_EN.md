# Pigment Match — User Manual

A calm, local-first companion for oil painters. Give it a color and it tells you
how to **mix it from real pigments**, and describes it the way a painter
thinks — value, temperature, saturation — instead of raw numbers.

> Think in paint, not in RGB.

Everything runs in your browser. Nothing is uploaded; your palettes are saved on
your own device.

---

## Getting started

1. Open the app (`npm run dev`, then visit the local URL it prints).
2. The interface has nine tabs across the top: **Match · Image · Extract ·
   Coach · Compare · Mix · Logbook · Calibrate · Palette**.
3. Start in **Match** — it opens with the example color `#927073`.

The header (top-right) shows your active palette and pigment count, and a
**language toggle (`EN / ES`)** — the whole app, including the painter
descriptions and coaching, switches between English and Spanish. Your choice is
remembered.

---

## The Match tab — color → recipe

This is the core of the app.

### 1. Enter your target color

Three ways, all interchangeable:

- **Picker** — click the colored square to open your system color picker.
- **HEX** — type a hex value like `#927073` and press Enter.
- **RGB** — set the R, G and B channels (0–255) individually.

### 2. Read the results

- **Target color** — a large swatch with its HEX and RGB.
- **Painter analysis** — a plain-language sentence ("a low-saturation,
  mid-value reddish, slightly warm") plus the four axes: **Value** (light /
  medium / dark), **Temperature** (warm / neutral / cool), **Saturation**, and
  **Hue tendency**.
- **Mixing recipe** — the pigments and amounts that get closest to the target,
  with a **match score** (and ΔE, the perceptual error). A swatch shows the
  color the mix is predicted to produce. A chip shows the **active palette** the
  mix is drawn from.
- **Variations** — six one-click alternatives: Lighter, Darker, Warmer, Cooler,
  More saturated, Less saturated. **Click any variation** to make it your new
  target. Each one also has a **"How to mix it"** link: it opens the recipe for
  your base color plus the small adjustment (which pigment to add) that takes
  that mix to the variation — so you don't start the mix from scratch.

### 3. Parts vs. percentages

Above the recipe there's a small toggle: **Parts | %**.

- **Parts** — painter-style ratios ("1 part Titanium White") with small
  contributions listed as *touches* (small / tiny / microscopic touch).
- **%** — each pigment as a percentage of the mix (they add up to 100; anything
  under 1% shows as `<1%`).

Your choice is remembered and applies everywhere (including the Extract tab).

> Not sure what the three toggles above the recipe do? Click **"What do these
> options do?"** there — a short explainer covers the mixing model (Classic /
> Spectral), the detail level (Simple / Precise), and the units (Parts / %).

> **What the match score means:** it's the model's confidence in its own
> prediction, measured in CIE Lab (ΔE). A high score means "this mix *should*
> land very close." It is a strong starting point, not a guarantee about real
> paint — always trust your eye on the easel.

---

## The Image tab — sample colors from a photo

1. Click the upload area and choose an image (a photo, a master painting…).
2. Move your cursor over it — the swatch under the canvas previews the color.
3. **Click anywhere** on the image to set that color as your target.
4. The sampled color flows into the same recipe + analysis + variations as the
   Match tab.

Use **Replace image** to load a different one.

> **Use your camera:** anywhere you can upload a photo (Image, Mix, Coach,
> Compare, and the Logbook), there's a **Use camera** button. It opens your PC
> webcam or phone camera right in the page (with a front/back flip), and the
> snapshot becomes the image. The camera feed stays on your device — nothing is
> uploaded. Your browser will ask for camera permission the first time.

---

## The Extract tab — a palette from a painting

1. Click **Upload a painting**.
2. Choose how many colors to pull out: **8, 12, or 20**.
3. The app finds the dominant colors (clustered perceptually) and arranges them
   **from light to dark**.

For each extracted color you get:

- A swatch with its HEX (click it to send the color to **Match**).
- A short painter's description.
- A compact mixing recipe with its match score.
- A **relationship hint** when colors are related — e.g. *"close to #3 — add a
  touch of Ultramarine."*

Switching the color count re-extracts instantly from the same image.

---

## The Coach tab — what to fix next

For when you're mixing on a real palette and want to close the gap.

1. Set your **Target color** (type it, pick it, or carry it over from another
   tab).
2. Set **Your current mix** — the color you have on the palette right now. Type
   it, or click **Sample from photo** to pick it from a photo of your palette.
3. The **Coach** card gives you prioritized, plain-language steps:
   - **Value** — "too dark — lift the value with Titanium White."
   - **Saturation** — "too saturated — knock it back with a touch of Raw Umber."
   - **Hue / temperature** — "the hue needs to go warmer — nudge it with Cadmium
     Orange."
   Each step shows a dot of the suggested pigment.
4. The live **match score** climbs as your mix gets closer. When you're there it
   turns green: *"You're there — lay it in and trust it."*

> Work through the steps in order, add color in **tiny** amounts, and re-sample.
> Matching a color is always a few small corrections, never one big one.

---

## The Compare tab — reference vs. your painting

Upload a **reference** photo and a photo of your **work in progress**, then
critique the whole painting.

1. Upload both images.
2. **Align** each: drag the **4 dots** to the painting's corners. The app
   de-keystones both so they line up pixel-for-pixel (handles different angles
   and crops). Press **Analyze differences**.
3. Explore the views:
   - **Overlay** — swipe or onion-skin between the two, with a **squint** (blur)
     slider to compare big masses.
   - **Values** — grayscale, **notan** (posterized value masses), a
     value-difference heatmap, and a value histogram.
   - **Color** — difference heatmaps you can switch between: overall **ΔE**,
     **temperature**, **saturation**, **hue**.
   - **Region coach** — click a spot on the reference to get Coach advice for
     that area.
   - **Palettes** — the dominant palette of each, side by side.
   - **Scorecard** — value & color accuracy, bias readouts, and a one-line
     summary.

There's a **Normalize lighting** toggle to ignore exposure / white-balance
differences between the two photos. Value and relative comparisons are the most
trustworthy — photo color is never exact.

---

## The Mix tab — match a reference color with your palette mix

A focused two-photo workflow for "did I mix this color right?"

1. **Reference** — upload a photo and **click** the color you're trying to
   match.
2. **Your palette mix** — upload a photo of the paint on your palette and click
   the blob.
3. You get each color's painter description, a **value scale** with both marked
   (and how much lighter/darker yours is), and the **Coach's** advice + a match
   score.

Tick **Show grayscale** for an optional value view, **cropped to the spots you
sampled**. While hovering the reference, two small swatches follow the cursor —
the **color under the pointer** (left) and **your mix** (right) — so you can see
in real time where your color/value matches. (Clicking still re-picks the
target.) Both a color reference and a grayscale-value version are available.

---

## The Logbook tab — save your mixes for next time

Your personal notebook of color mixes. Log a generic skin tone, a sky, the grey
you mixed for the shadows — anything you'll want to find again — and come back
another day to pick it up.

### Projects

Everything is organized into **projects** (a portrait commission, a study, a
series). Pick a project from the dropdown, or type a name and press **New
project**. Use **Rename** and **Delete** on the project header. (Deleting a
project removes its colors too.)

### Logging a color

1. Press **Add color**.
2. Fill in what's useful — all optional except your own habits:
   - **Color name** — e.g. *Generic caucasian skin*.
   - **Swatch color** — an optional color chip (a quick visual marker). If
     you've added a swatch photo, press **Pick color from swatch photo** and
     click the paint to lift the chip color straight from it.
   - **Mix / recipe** — free text, written however you think:
     *"5 Titanium White · 1 Yellow Ochre · touch Cadmium Red · tiny Burnt Umber."*
   - **Notes** — lighting, where it's used, what to tweak next time.
   - **Swatch photo** and **Reference photo** — optional. Pick from your
     device; they're shrunk automatically so storage stays small.
3. Press **Save color**. Edit (pencil) or delete (trash) any entry later.

### Backup — export & import

- **Export** downloads your whole logbook — projects, colors, and the embedded
  photos — as a single `.json` file.
- **Import** loads such a file back, **adding** its projects (it never
  overwrites what you already have). Use it to back up or move your logbook to
  another device or browser.

> **Where it's stored:** the Logbook lives in your browser's **IndexedDB** (a
> larger local store than the rest of the app uses, so photos fit comfortably).
> It's still 100% local — nothing is uploaded. Since it's per-browser, use
> **Export** for a real backup. The **"How is my data stored?"** link (under the
> intro text) opens an explainer covering exactly where your data lives, the
> caveats, and how to back it up and recover it.

---

## The Calibrate tab — teach the model your real paints *(optional)*

By default the app uses generic, eyeballed pigment data. Calibration tunes the
mixing model to *your* actual tubes and lighting, using mixes you've really
made. It's entirely optional — leave it off and nothing changes.

How it works: you record a few **observations** ("I mixed these parts and got
this color"), press **Calibrate**, and the model fits each pigment's tinting
strength to match what you saw. Then a single toggle switches the whole app
over to the calibrated model.

### Recording an observation

1. In **Record a mix you made**, enter the **parts** you used of each pigment
   (leave the rest at 0).
2. Set **the real color you got** — type it, or **Sample from photo** of your
   actual swatch (most accurate).
3. Click **Add observation**.

Repeat for a handful of mixes — **three or more** gives the best fit. Useful
ones: white + each pigment at a couple of ratios, and any mixes you find the app
currently predicts poorly.

### Calibrating

1. Press **Calibrate from N observations**.
2. The card shows the average error **before → after** (in ΔE). A big drop means
   the model now predicts your paints well.
3. Turn on the **Calibrated mixing** toggle (top of the tab). A **Calibrated**
   badge appears in the header, and every recipe — Match, Image, Extract,
   Coach — now uses your tuned model.

You can **Re-calibrate** after adding more observations, **Discard calibration**
to drop the fit, or toggle the engine off anytime to return to the default.
Calibration is saved per palette, so each palette can have its own.

> Calibration currently fits **tinting strength** (how far each pigment goes in
> a mix). A pigment's base color is set directly in the Palette tab.

---

## The Palette tab — your pigments

The recipes are only as good as the pigments the app thinks you own, so keep
this in sync with your real paints.

### Managing palettes

- **Palette dropdown** — switch between saved palettes.
- **Name field** — rename the active palette.
- **Add preset…** — spin up a palette from a known kit (Traditional Oil,
  Winsor & Newton Artists', Corfix).
- **New** — create a new palette (starts from the default oil set).
- **Reset** — restore the active palette to the default 8 pigments.
- **Delete** — remove the active palette (you always keep at least one).
- **Export** — download the active palette as a JSON file (backup or share).
- **Import** — load a palette from a JSON file; it's added as a new palette.

### Editing a pigment

Each row has a color square, a name, an **Edit** button and a delete icon.

Click **Edit** to reveal:

- **Opacity** — transparent (for glazes) to fully opaque.
- **Tinting strength** — how strongly the pigment pulls a mix toward its color.
  Strong pigments (e.g. blues) "go further" with less.
- **Temperature** — warm / neutral / cool.

Click the color square to change the pigment's color. **Add pigment** appends a
new one.

> **Tip — calibrate to your real tubes:** paint a pure swatch of a tube, photo­
> graph it in good light, sample it in the **Image** tab, and copy that HEX into
> the pigment. The closer the pigment data is to your real paint, the better the
> recipes.

### Saving

Everything saves automatically to your browser (`localStorage`). Close the tab
and your palettes are still there next time. Since storage is per-browser, use
**Export** to back a palette up or move it to another device, and **Import** to
bring it back.

---

## The default oil palette

Titanium White · Raw Umber · Burnt Umber · Cadmium Orange · Cadmium Red Light ·
Alizarin Crimson · Ultramarine Blue · Yellow Ochre.

A limited, traditional set. If a color can't be reached with it (a saturated
green, say), the match score will honestly say so rather than invent a recipe.

---

## How it mixes (in brief)

Paint mixes **subtractively** — it absorbs light — so the app does not average
RGB. It uses a single-constant **Kubelka-Munk** approximation per color channel
(weighted by each pigment's tinting strength), which makes blue + yellow drift
toward green and white dilute correctly. A search then finds the pigment
proportions whose predicted mix is closest to your target in **CIE Lab**.

The model is a physically-motivated approximation, not a measurement of your
actual paint. Expect it to put you in the right neighborhood — right value,
right temperature, close hue — and finish by eye.

Background reading: this is the same single-constant Kubelka-Munk method used in
color science to match artist paints — Mohammadi, Nezamabadi, Taplin & Berns
(RIT Munsell Color Science Lab, 2004), *Pigment Selection Using Kubelka–Munk
Turbid Media Theory and Non-Negative Least Square Technique*
([PDF](https://repository.rit.edu/cgi/viewcontent.cgi?article=1929&context=article)).
The match score uses the perceptual CIEDE2000 color difference. The recipe card
has a **Simple / Precise** toggle (few practical pigments vs. the lowest
possible error) and an optional **Classic / Spectral** mixing-model toggle
(Spectral reconstructs a full reflectance curve per pigment; experimental).

---

## FAQ

**Do I need an internet connection?** No. After loading, it runs fully offline.

**Where is my data stored?** Only in your browser, on this device.

**The color picker shows RGB, not HEX.** That dialog is your operating system's,
not the app's — its fields can't be changed. The app shows HEX and RGB next to
the picker in Match, Image and Coach.

**A match score is low. Is it broken?** No — it means your current palette can't
reach that color. Add or edit pigments in the **Palette** tab.

**Will the recipe be exact?** It's a strong starting point. Pigment data is
approximate and real paint has variables the model doesn't capture (brand,
gloss, layering, drying). Adjust on the palette — the **Coach** tab is built for
exactly that.
