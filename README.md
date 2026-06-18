# Pigment Match

A local-first web app for traditional oil painters. It turns a target color
(HEX / RGB / picked from an image) into an approximate **paint mixing recipe**
using a customizable palette of real pigments — and describes color the way a
painter does, not in math.

> Think in paint, not in RGB.

Everything runs **entirely in your browser**. There is no backend; palettes are
saved to `localStorage`.

> 📖 User manuals: [English](MANUAL_EN.md) · [Español](MANUAL_ES.md)

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
- **Calibrate** *(optional)* — teach the model your real paints: record a few
  "I mixed these parts and got this color" observations and fit each pigment's
  tinting strength. Off by default; flip one toggle and every recipe in the app
  uses the model tuned to your tubes.
- **Palette** — create, edit, save and switch palettes. Each pigment has a
  color, opacity, temperature, and tinting strength. Ships with a traditional
  8-pigment oil palette.

## How the mixing works

Paint mixes **subtractively**, not like light. The recipe engine uses a
single-constant **Kubelka-Munk** approximation per sRGB channel (weighted by
each pigment's tinting strength) so blue + yellow drifts toward green and white
dilutes correctly. A search (seeded restarts + hill-climbing) finds the pigment
proportions whose mix is closest to the target in **CIE Lab** (ΔE). Results are
a starting point — trust your eye on the easel.

## Tech

React + TypeScript + Vite, Tailwind CSS, shadcn-style components, Lucide icons.

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
  lib/        color math, pigment model, mixer, coach, calibration, extraction, storage
  hooks/      usePalettes, useRecipeUnit, useCalibration, useCalibratedEngine
  components/ feature components + ui/ (shadcn-style primitives)
  App.tsx     tabbed layout (Match · Image · Extract · Coach · Calibrate · Palette)
```

## Roadmap

- Calibrate more than tinting strength (fit masstone colors / a per-pigment
  K/S scale) from observations.
- Full multi-constant Kubelka-Munk spectral mixing.
