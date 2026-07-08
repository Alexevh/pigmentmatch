// Pigment data model and the default traditional oil palette.

import type { RGB } from "./color";

export type Temperature = "warm" | "cool" | "neutral";

export interface Pigment {
  id: string;
  name: string;
  rgb: RGB; // masstone RGB approximation (full-strength color)
  // Optional undertone: the color the pigment shows thinned / tinted / glazed
  // (e.g. ultramarine → violet, phthalo → cyan). When set, the mixing model
  // blends toward it as the pigment becomes a smaller fraction of the mix.
  // Undefined means "same as masstone" — byte-identical to the old behavior.
  undertone?: RGB;
  opacity: number; // 0 (transparent) .. 1 (opaque)
  temperature: Temperature;
  strength: number; // tinting strength 0..1 (how strongly it influences a mix)
  // Available for mixing? Undefined means available (back-compat with saved
  // palettes). Set false to keep a pigment in the palette but exclude it from
  // recipe suggestions — e.g. a tube that ran out.
  enabled?: boolean;
}

// A pigment counts as available unless explicitly disabled.
export function isEnabled(p: Pigment): boolean {
  return p.enabled !== false;
}

export interface Palette {
  id: string;
  name: string;
  pigments: Pigment[];
}

// RGB approximations of common artist oil pigments (masstone, eyeballed for
// painterly behavior rather than spectral accuracy).
export const DEFAULT_PIGMENTS: Pigment[] = [
  {
    id: "titanium-white",
    name: "Titanium White",
    rgb: { r: 249, g: 249, b: 244 },
    opacity: 1,
    temperature: "cool",
    strength: 0.55,
  },
  {
    id: "raw-umber",
    name: "Raw Umber",
    rgb: { r: 52, g: 42, b: 30 },
    opacity: 0.7,
    temperature: "cool",
    strength: 0.75,
  },
  {
    id: "burnt-umber",
    name: "Burnt Umber",
    rgb: { r: 48, g: 31, b: 22 },
    opacity: 0.75,
    temperature: "warm",
    strength: 0.8,
  },
  {
    id: "cadmium-orange",
    name: "Cadmium Orange",
    rgb: { r: 226, g: 105, b: 30 },
    opacity: 0.9,
    temperature: "warm",
    strength: 0.85,
  },
  {
    id: "cadmium-red-light",
    name: "Cadmium Red Light",
    rgb: { r: 196, g: 44, b: 36 },
    opacity: 0.9,
    temperature: "warm",
    strength: 0.85,
  },
  {
    id: "alizarin-crimson",
    name: "Alizarin Crimson",
    rgb: { r: 74, g: 16, b: 28 },
    opacity: 0.4,
    temperature: "cool",
    strength: 0.9,
  },
  {
    id: "ultramarine-blue",
    name: "Ultramarine Blue",
    rgb: { r: 24, g: 24, b: 64 },
    opacity: 0.5,
    temperature: "warm",
    strength: 0.95,
  },
  {
    id: "yellow-ochre",
    name: "Yellow Ochre",
    rgb: { r: 196, g: 145, b: 56 },
    opacity: 0.8,
    temperature: "warm",
    strength: 0.7,
  },
];

export function makeDefaultPalette(): Palette {
  return {
    id: "default-oil",
    name: "Traditional Oil",
    // deep-clone so edits never mutate the shared default
    pigments: DEFAULT_PIGMENTS.map((p) => ({ ...p, rgb: { ...p.rgb } })),
  };
}

// Winsor & Newton Artists' Oil Colour — one painter's actual kit.
// Colour Index (CI) pigment shown for reference. RGB masstones, opacity and
// tinting strength are eyeballed starting points — calibrate them to your own
// tubes via the Calibrate tab for the best results.
// This preset is one painter's actual 16-tube W&N Artists' kit (plus Titanium
// White, needed to mix any tint). Values are copied from the fuller W&N data we
// already had for each tube — informed estimates; calibrate to your own tubes
// via the Calibrate tab for the best results.
export const WINSOR_NEWTON_PIGMENTS: Pigment[] = [
  // whites / blacks / earths
  { id: "wn-titanium-white", name: "Titanium White", rgb: { r: 248, g: 244, b: 234 }, opacity: 1, temperature: "cool", strength: 0.55 }, // PW6; neutralized from measured cream (#F5EDD7) — keeps a slight oil warmth; Opaque
  { id: "wn-ivory-black", name: "Ivory Black", rgb: { r: 26, g: 26, b: 25 }, opacity: 0.9, temperature: "warm", strength: 0.9 }, // PBk9; near-black masstone (Griffin sample read as a grey tint — corrected to thick masstone); Opaque
  { id: "wn-raw-umber", name: "Raw Umber", rgb: { r: 44, g: 40, b: 35 }, opacity: 0.35, temperature: "cool", strength: 0.75 }, // PBk11/PBr7; dark masstone (thick), Transparent
  { id: "wn-burnt-umber", name: "Burnt Umber", rgb: { r: 46, g: 34, b: 28 }, opacity: 0.35, temperature: "warm", strength: 0.8 }, // PBr7; dark warm-brown masstone (thick), Transparent
  { id: "wn-yellow-ochre", name: "Yellow Ochre", rgb: { r: 170, g: 110, b: 47 }, opacity: 0.85, temperature: "warm", strength: 0.7 }, // PY43; masstone from measured Lab (Griffin line); Opaque
  { id: "wn-terra-rosa", name: "Terra Rosa", rgb: { r: 150, g: 77, b: 62 }, opacity: 0.8, temperature: "warm", strength: 0.7 }, // PR101
  { id: "wn-venetian-red", name: "Venetian Red", rgb: { r: 126, g: 52, b: 42 }, opacity: 0.8, temperature: "warm", strength: 0.75 }, // PR101
  // yellows
  { id: "wn-naples-yellow", name: "Naples Yellow", rgb: { r: 243, g: 222, b: 150 }, opacity: 0.85, temperature: "warm", strength: 0.6 }, // hue
  { id: "wn-winsor-yellow", name: "Winsor Yellow", rgb: { r: 215, g: 164, b: 10 }, opacity: 0.5, temperature: "warm", strength: 0.8 }, // PY154; masstone from the painter's real white-balanced swatch (#D7A40A) — darker/less bright than the prior #FFCD00 Lab estimate (that was a thin drawdown); Transparent
  // reds / pinks / violets
  { id: "wn-cadmium-red", name: "Cadmium Red", rgb: { r: 196, g: 44, b: 36 }, opacity: 0.9, temperature: "warm", strength: 0.85 }, // PR108
  { id: "wn-permanent-alizarin-crimson", name: "Permanent Alizarin Crimson", rgb: { r: 78, g: 10, b: 30 }, opacity: 0.3, temperature: "cool", strength: 0.85 }, // PR177; dark maroon masstone (thick); Transparent
  { id: "wn-pale-rose-blush", name: "Pale Rose Blush", rgb: { r: 224, g: 134, b: 125 }, opacity: 0.9, temperature: "warm", strength: 0.4 }, // PV19/PW4/PY42; masstone from measured Lab — Griffin-line fallback (Artists' not measured), approx
  { id: "wn-cobalt-violet", name: "Cobalt Violet", rgb: { r: 123, g: 73, b: 140 }, opacity: 0.6, temperature: "cool", strength: 0.4 }, // PV14
  // blues / greens
  { id: "wn-french-ultramarine", name: "French Ultramarine", rgb: { r: 28, g: 26, b: 64 }, opacity: 0.3, temperature: "warm", strength: 0.95 }, // PB29; dark blue masstone (thick); Transparent
  { id: "wn-cerulean-blue", name: "Cerulean Blue", rgb: { r: 44, g: 117, b: 170 }, opacity: 0.85, temperature: "cool", strength: 0.6 }, // PB35
  { id: "wn-viridian-green", name: "Viridian Green", rgb: { r: 10, g: 58, b: 48 }, opacity: 0.55, temperature: "cool", strength: 0.6 }, // PG18; dark green masstone (thick)
  { id: "wn-paynes-gray", name: "Payne's Gray", rgb: { r: 28, g: 32, b: 38 }, opacity: 0.85, temperature: "cool", strength: 0.85 }, // PB29/PBk6; very dark blue-grey masstone (thick); Opaque
];

export function makeWinsorNewtonPalette(): Palette {
  return {
    id: "wn-artists",
    name: "Winsor & Newton Artists'",
    pigments: WINSOR_NEWTON_PIGMENTS.map((p) => ({ ...p, rgb: { ...p.rgb } })),
  };
}

// Winsor & Newton Winton — the student-grade line (kept separate from Artists'
// because it's a different formulation, often "hue" substitutes). Another of
// the painter's actual kits. Values are copied from the W&N data we already had
// for each tube as a starting point; they'll be refined from real swatches, so
// treat them as estimates for now. Distinct ids (wnw-) so they don't collide
// with the Artists' tubes.
export const WINTON_PIGMENTS: Pigment[] = [
  // whites / blacks / earths
  { id: "wnw-titanium-white", name: "Titanium White", rgb: { r: 248, g: 244, b: 234 }, opacity: 1, temperature: "cool", strength: 0.55 },
  { id: "wnw-ivory-black", name: "Ivory Black", rgb: { r: 26, g: 26, b: 25 }, opacity: 0.9, temperature: "warm", strength: 0.9 },
  { id: "wnw-raw-umber", name: "Raw Umber", rgb: { r: 35, g: 39, b: 38 }, opacity: 0.35, temperature: "cool", strength: 0.75 }, // masstone from the painter's real white-balanced swatch (#232726) — dark and slightly greenish/cool (a* ~-2), as raw umber reads vs the warmer burnt umber
  { id: "wnw-burnt-sienna", name: "Burnt Sienna", rgb: { r: 78, g: 38, b: 30 }, opacity: 0.35, temperature: "warm", strength: 0.75 },
  { id: "wnw-yellow-ochre", name: "Yellow Ochre", rgb: { r: 170, g: 110, b: 47 }, opacity: 0.85, temperature: "warm", strength: 0.7 },
  // yellows
  { id: "wnw-lemon-yellow-hue", name: "Lemon Yellow Hue", rgb: { r: 243, g: 232, b: 76 }, opacity: 0.7, temperature: "cool", strength: 0.65 },
  { id: "wnw-cadmium-yellow-hue", name: "Cadmium Yellow Hue", rgb: { r: 252, g: 205, b: 42 }, opacity: 0.8, temperature: "warm", strength: 0.7 },
  { id: "wnw-cadmium-yellow-deep-hue", name: "Cadmium Yellow Deep Hue", rgb: { r: 249, g: 170, b: 18 }, opacity: 0.8, temperature: "warm", strength: 0.75 },
  // reds / pinks / violets
  { id: "wnw-cadmium-red-deep-hue", name: "Cadmium Red Deep Hue", rgb: { r: 161, g: 28, b: 42 }, opacity: 0.85, temperature: "warm", strength: 0.8 },
  { id: "wnw-permanent-alizarin-crimson", name: "Permanent Alizarin Crimson", rgb: { r: 78, g: 10, b: 30 }, opacity: 0.3, temperature: "cool", strength: 0.85 },
  { id: "wnw-permanent-rose", name: "Permanent Rose", rgb: { r: 206, g: 42, b: 98 }, opacity: 0.6, temperature: "cool", strength: 0.85 },
  { id: "wnw-quinacridone-deep-pink", name: "Quinacridone Deep Pink", rgb: { r: 96, g: 16, b: 58 }, opacity: 0.55, temperature: "cool", strength: 0.9 },
  { id: "wnw-pale-rose-blush", name: "Pale Rose Blush", rgb: { r: 224, g: 134, b: 125 }, opacity: 0.9, temperature: "warm", strength: 0.4 },
  { id: "wnw-dioxazine-blue", name: "Dioxazine Blue", rgb: { r: 32, g: 20, b: 52 }, opacity: 0.5, temperature: "cool", strength: 0.95 },
  // blues
  { id: "wnw-french-ultramarine", name: "French Ultramarine", rgb: { r: 28, g: 26, b: 64 }, opacity: 0.3, temperature: "warm", strength: 0.95 },
];

export function makeWintonPalette(): Palette {
  return {
    id: "wn-winton",
    name: "Winsor & Newton Winton",
    pigments: WINTON_PIGMENTS.map((p) => ({ ...p, rgb: { ...p.rgb } })),
  };
}

// Winsor & Newton Mixed — both W&N lines combined in one palette (Artists' +
// Winton), for a painter who owns and mixes across both. Shared tube names are
// suffixed with their line so recipes never show two ambiguous "Titanium White"
// entries; ids are already distinct (wn-/wnw-). Values are the same as each
// source line (refine Winton from swatches later).
export function makeWnMixedPalette(): Palette {
  const tag = (ps: Pigment[], suffix: string): Pigment[] =>
    ps.map((p) => ({ ...p, name: `${p.name} (${suffix})`, rgb: { ...p.rgb } }));
  return {
    id: "wn-mixed",
    name: "Winsor & Newton Mixed",
    pigments: [
      ...tag(WINSOR_NEWTON_PIGMENTS, "Artists'"),
      ...tag(WINTON_PIGMENTS, "Winton"),
    ],
  };
}

// Corfix (Brazilian brand, German high-permanence pigments). Built tube by
// tube from the painter's actual kit. Several Corfix colors are multi-pigment
// "hue" mixes, so their masstones can differ noticeably from a single-pigment
// equivalent of the same name. RGB/opacity/strength are starting points —
// calibrate to the real tubes for best results.
export const CORFIX_PIGMENTS: Pigment[] = [
  {
    id: "cx-titanium-white",
    name: "Titanium White",
    rgb: { r: 249, g: 249, b: 244 },
    opacity: 1,
    temperature: "cool",
    strength: 0.55,
  }, // PW6
  {
    id: "cx-raw-umber",
    name: "Raw Umber",
    // A hue made of yellows + red oxide + black, so it reads olive/green
    // rather than the red-black of a genuine PBr7 raw umber. Dark masstone.
    rgb: { r: 52, g: 50, b: 30 },
    opacity: 0.7,
    temperature: "neutral",
    strength: 0.75,
  }, // PY42, PR101, PY13, PBk1
  {
    id: "cx-natural-sienna",
    name: "Natural Sienna",
    // warm golden-brown; cleaner yellow (PY74) + red oxide, lightly darkened
    rgb: { r: 140, g: 96, b: 50 },
    opacity: 0.55,
    temperature: "warm",
    strength: 0.7,
  }, // PR101, PBk7, PY42, PY74
  {
    id: "cx-burnt-umber",
    name: "Burnt Umber",
    // "burnt" = redder and darker than the olive raw umber sibling
    rgb: { r: 48, g: 33, b: 22 },
    opacity: 0.72,
    temperature: "warm",
    strength: 0.8,
  }, // PY42, PR101, PY13, PBk7
  {
    id: "cx-van-dyke-brown",
    name: "Van Dyke Brown",
    // deep dark brown: red oxide heavily darkened by carbon black
    rgb: { r: 38, g: 28, b: 22 },
    opacity: 0.6,
    temperature: "neutral",
    strength: 0.85,
  }, // PR101, PBk7
  {
    id: "cx-burnt-sienna",
    name: "Burnt Sienna",
    // single-pigment red iron oxide: clean, transparent warm red-brown (dark masstone)
    rgb: { r: 82, g: 40, b: 26 },
    opacity: 0.5,
    temperature: "warm",
    strength: 0.75,
  }, // PR101
  {
    id: "cx-paynes-gray",
    name: "Payne's Gray",
    // very dark blue-grey; carbon black + blue. Medium opacity (the chart's
    // half-painted swatch flags it as semi-transparent).
    rgb: { r: 26, g: 31, b: 40 },
    opacity: 0.5,
    temperature: "cool",
    strength: 0.85,
  }, // PBk7, PB25
  {
    id: "cx-permanent-yellow-light",
    name: "Permanent Yellow Light",
    // warm light yellow; semi-transparent per the chart's half-painted swatch
    rgb: { r: 251, g: 213, b: 66 },
    opacity: 0.5,
    temperature: "warm",
    strength: 0.7,
  }, // PY74, PO5, PW6
  {
    id: "cx-cadmium-yellow",
    name: "Cadmium Yellow",
    // single-pigment arylide yellow, rich warm mid-yellow, opaque
    rgb: { r: 250, g: 196, b: 25 },
    opacity: 0.9,
    temperature: "warm",
    strength: 0.7,
  }, // PY74
  {
    id: "cx-emerald-green",
    name: "Emerald Green",
    // phthalo green: deep cool blue-green, very high tinting strength (very dark masstone)
    rgb: { r: 8, g: 54, b: 45 },
    opacity: 0.5,
    temperature: "cool",
    strength: 0.97,
  }, // PG7
  {
    id: "cx-english-green",
    name: "English Green",
    // phthalo green warmed with yellow + a touch of orange: mid foliage green
    rgb: { r: 66, g: 112, b: 48 },
    opacity: 0.5,
    temperature: "warm",
    strength: 0.82,
  }, // PG7, PY74, PO5
  {
    id: "cx-turquoise-blue",
    name: "Turquoise Blue",
    // two phthalos (blue + green): vivid deep cyan, very high tinting strength (dark masstone)
    rgb: { r: 10, g: 66, b: 80 },
    opacity: 0.5,
    temperature: "cool",
    strength: 0.95,
  }, // PB15:3, PG7
  {
    id: "cx-quinacridone-magenta",
    name: "Quinacridone Magenta",
    // vivid cool magenta-pink, transparent (great for glazing)
    rgb: { r: 196, g: 26, b: 110 },
    opacity: 0.35,
    temperature: "cool",
    strength: 0.9,
  }, // PR122
  {
    id: "cx-geranium-lake",
    name: "Geranium Lake",
    // naphthol: bright warm scarlet red, slightly orange-leaning
    rgb: { r: 206, g: 42, b: 38 },
    opacity: 0.5,
    temperature: "warm",
    strength: 0.8,
  }, // PR112
  {
    id: "cx-cadmium-red",
    name: "Cadmium Red",
    // mid warm red, opaque; cooler PR57 balances the warm PR112
    rgb: { r: 194, g: 38, b: 44 },
    opacity: 0.9,
    temperature: "warm",
    strength: 0.85,
  }, // PR57, PR112
  {
    id: "cx-rose-lake",
    name: "Rose Lake",
    // azo red softened with white: opaque rose pink
    rgb: { r: 216, g: 104, b: 128 },
    opacity: 0.9,
    temperature: "cool",
    strength: 0.6,
  }, // PR145, PW6
  {
    id: "cx-cadmium-yellow-orange",
    name: "Cadmium Yellow Orange",
    // yellow + pyrazolone orange: warm yellow-orange, opaque
    rgb: { r: 249, g: 158, b: 30 },
    opacity: 0.9,
    temperature: "warm",
    strength: 0.75,
  }, // PY74, PO13
  {
    id: "cx-orange",
    name: "Orange",
    // warm orange (PO5) with a little white; semi-transparent per the chart
    rgb: { r: 242, g: 110, b: 36 },
    opacity: 0.5,
    temperature: "warm",
    strength: 0.75,
  }, // PO5, PW6
  {
    id: "cx-carmine",
    name: "Carmine",
    // deep cool crimson (bluish reds PR57 + PR63), semi-transparent (dark masstone)
    rgb: { r: 100, g: 20, b: 42 },
    opacity: 0.5,
    temperature: "cool",
    strength: 0.85,
  }, // PR57, PR63
];

export function makeCorfixPalette(): Palette {
  return {
    id: "corfix",
    name: "Corfix",
    pigments: CORFIX_PIGMENTS.map((p) => ({ ...p, rgb: { ...p.rgb } })),
  };
}

// Palettes a painter can spin up from a known kit.
export const PALETTE_PRESETS: {
  id: string;
  name: string;
  make: () => Palette;
  // When true, this preset's tubes are NOT added to the cherry-pick library
  // (used for combined presets whose tubes already appear via their sources).
  libraryHidden?: boolean;
}[] = [
  { id: "traditional", name: "Traditional Oil (8)", make: makeDefaultPalette },
  {
    id: "wn-artists",
    name: "Winsor & Newton Artists' (17)",
    make: makeWinsorNewtonPalette,
  },
  {
    id: "wn-winton",
    name: "Winsor & Newton Winton (15)",
    make: makeWintonPalette,
  },
  {
    id: "wn-mixed",
    name: "Winsor & Newton Mixed (32)",
    make: makeWnMixedPalette,
    libraryHidden: true,
  },
  { id: "corfix", name: "Corfix", make: makeCorfixPalette },
];

// Every pigment across all presets, tagged with its source — a library to
// cherry-pick individual tubes from when building a custom palette.
export function libraryPigments(): { preset: string; pigment: Pigment }[] {
  const out: { preset: string; pigment: Pigment }[] = [];
  for (const preset of PALETTE_PRESETS) {
    if (preset.libraryHidden) continue;
    for (const p of preset.make().pigments) {
      out.push({ preset: preset.name, pigment: { ...p, rgb: { ...p.rgb } } });
    }
  }
  return out;
}

let idCounter = 0;
export function newId(prefix = "p"): string {
  idCounter += 1;
  return `${prefix}-${idCounter}-${performance.now().toString(36).replace(".", "")}`;
}
