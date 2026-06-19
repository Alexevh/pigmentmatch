# Pigment Match

A local-first web app for traditional oil painters. It turns a target color
(HEX / RGB / picked from an image) into an approximate **paint mixing recipe**
using a customizable palette of real pigments — and describes color the way a
painter does, not in math.

> Think in paint, not in RGB.

**🎨 Live app: [alexevh.github.io/pigmentmatch](https://alexevh.github.io/pigmentmatch/)**

Everything runs **entirely in your browser**. There is no backend; palettes are
saved to `localStorage`.

> 📖 User manuals: [English](MANUAL_EN.md) · [Español](MANUAL_ES.md)
>
> 🌐 Available in **English and Spanish** — toggle in the header (`EN / ES`).

## Features

- **Match** — enter a HEX/RGB value or use the color picker; get a mixing
  recipe (shown as **parts** or **percentages**, your choice), a match score, a
  painter's analysis, and six intuitive variations (warmer/cooler,
  lighter/darker, more/less saturated).
- **Image** — upload a photo or master painting and click to sample any color.
- **Extract** — pull the 8 / 12 / 20 dominant colors from a painting (k-means
  in Lab space), arranged light → dark, each with its own recipe, description,
  and a relationship hint ("close to #3 — add a touch of Ultramarine").
- **Coach** — give the app your target and the mix currently on your palette;
  it tells you what to do next in painter language ("too dark — lift the value
  with white", "a bit too saturated — knock it back with Raw Umber").
- **Compare** — upload a reference and a work-in-progress photo, align both
  with a 4-corner perspective warp, then critique the differences: swipe /
  onion-skin overlay with a squint (blur) slider; value views (grayscale,
  notan posterization, value-difference heatmap, value histogram); color
  difference heatmaps (ΔE / temperature / saturation / hue); click-a-region →
  Coach; side-by-side palette extraction; and a scorecard (value & color
  accuracy + a plain-language summary).
- **Mix** — sample the target from a reference photo and your actual paint from
  a photo of the palette mix; get each color's description, a value scale with
  both marked (ΔL), and the Coach's advice + match %. Optional cropped
  grayscale of both, with a value/color **probe** that follows the cursor on
  the reference (under-cursor color on the left, your mix on the right) for
  real-time matching.
- **Calibrate** *(optional)* — teach the model your real paints: record a few
  "I mixed these parts and got this color" observations and fit each pigment's
  tinting strength. Off by default; flip one toggle and every recipe in the app
  uses the model tuned to your tubes.
- **Palette** — create, edit, save and switch palettes; **import/export** any
  palette as JSON for backup or sharing. Each pigment has a color, opacity,
  temperature, and tinting strength. Ships with a traditional 8-pigment oil
  palette (plus Winsor & Newton and Corfix presets).

## How the mixing works

Paint mixes **subtractively**, not like light. The recipe engine uses a
single-constant **Kubelka-Munk** approximation per sRGB channel (weighted by
each pigment's tinting strength) so blue + yellow drifts toward green and white
dilutes correctly. A search (seeded restarts + hill-climbing) finds the pigment
proportions whose mix is closest to the target in **CIE Lab**, scored with the
perceptual **CIEDE2000 (ΔE₀₀)** color difference. Results are a starting point —
trust your eye on the easel.

The recipe display also has an optional **Spectral** engine ([spectral.js](https://github.com/rvanwijnen/spectral.js),
opt-in) that reconstructs a full reflectance curve per pigment and mixes across
the spectrum — and a **Simple / Precise** toggle that trades a few pigments for
a slightly closer match.

This follows the same single-constant Kubelka-Munk approach used in color
science for paint matching — see Mohammadi, Nezamabadi, Taplin & Berns (RIT
Munsell Color Science Lab, 2004), *Pigment Selection Using Kubelka–Munk Turbid
Media Theory and Non-Negative Least Square Technique*
([PDF](https://repository.rit.edu/cgi/viewcontent.cgi?article=1929&context=article)).

## Tech

React + TypeScript + Vite, Tailwind CSS, shadcn-style components, Lucide icons,
spectral.js (optional spectral mixing engine). English/Spanish i18n built in.

## Commands

```bash
npm install     # install dependencies
npm run dev     # start the dev server
npm run build   # type-check + production build
npm run preview # preview the production build
```

## Project layout

```
src/
  lib/        color math (deltaE2000), pigment model, mixer (classic + spectral),
              coach, calibration, extraction, compare, describe, storage, i18n
  hooks/      usePalettes, useRecipeUnit, useRecipeMode, useMixEngine,
              useCalibration, useCalibratedEngine
  components/ feature components + ui/ (shadcn-style primitives)
  App.tsx     tabbed layout (Match · Image · Extract · Coach · Compare · Mix ·
              Calibrate · Palette)
```

## Deployment

The build is **fully static** (just HTML/CSS/JS) — no server or "React hosting"
needed. `npm run build` outputs `dist/`, which you can drop on any static host
(GitHub Pages, Netlify, Vercel, Cloudflare Pages, S3, nginx…). The Vite `base`
is relative (`"./"`), so it works from a domain root or a subpath without
rebuilding.

**GitHub Pages (automatic).** A workflow at
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) builds and
publishes on every push to `main`. One-time setup: in the repo,
**Settings → Pages → Source → GitHub Actions**. After that, each push
redeploys to <https://alexevh.github.io/pigmentmatch/>.

**Anywhere else.** Run `npm run build` and upload the `dist/` folder. No SPA
redirect rules are required (the app uses tab state, not URL routes).

## Roadmap

- Calibrate more than tinting strength (fit masstone colors / a per-pigment
  K/S scale) from observations.
- Two-constant Kubelka-Munk (use opacity as the scattering coefficient) for
  realistic glazing/layering.
- Tune the optional spectral engine's search; per-pigment undertone.
