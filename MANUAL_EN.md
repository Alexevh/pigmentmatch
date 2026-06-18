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
2. The interface has six tabs across the top: **Match · Image · Extract ·
   Coach · Calibrate · Palette**.
3. Start in **Match** — it opens with the example color `#927073`.

The header (top-right) always shows your active palette and how many pigments it
holds.

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
  color the mix is predicted to produce.
- **Variations** — six one-click alternatives: Lighter, Darker, Warmer, Cooler,
  More saturated, Less saturated. **Click any variation** to make it your new
  target.

### 3. Parts vs. percentages

Above the recipe there's a small toggle: **Parts | %**.

- **Parts** — painter-style ratios ("1 part Titanium White") with small
  contributions listed as *touches* (small / tiny / microscopic touch).
- **%** — each pigment as a percentage of the mix (they add up to 100; anything
  under 1% shows as `<1%`).

Your choice is remembered and applies everywhere (including the Extract tab).

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
- **New** — create a new palette (starts from the default oil set).
- **Reset** — restore the active palette to the default 8 pigments.
- **Delete** — remove the active palette (you always keep at least one).

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
and your palettes are still there next time.

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
