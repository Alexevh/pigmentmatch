// Local image processing for the IMG Lab: pixel adjustments (no deps) plus
// optional AI (UpscalerJS + TF.js, lazy-loaded only when invoked). Everything
// runs in the browser — no backend.

export interface Adjust {
  sharpen: number; // 0..100
  brightness: number; // -100..100
  contrast: number; // -100..100
  saturation: number; // -100..100
  temperature: number; // -100..100 (warm +)
}

export const DEFAULT_ADJUST: Adjust = {
  sharpen: 0,
  brightness: 0,
  contrast: 0,
  saturation: 0,
  temperature: 0,
};

export const adjustActive = (a: Adjust) =>
  a.sharpen !== 0 ||
  a.brightness !== 0 ||
  a.contrast !== 0 ||
  a.saturation !== 0 ||
  a.temperature !== 0;

const clampByte = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);

// 3x3 sharpen kernel blended into the original by `amount` (0..1).
function sharpenImage(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  amount: number
): Uint8ClampedArray {
  const k = [0, -1, 0, -1, 5, -1, 0, -1, 0];
  const out = new Uint8ClampedArray(data.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0,
        g = 0,
        b = 0;
      for (let ky = -1; ky <= 1; ky++) {
        const py = y + ky < 0 ? 0 : y + ky >= h ? h - 1 : y + ky;
        for (let kx = -1; kx <= 1; kx++) {
          const px = x + kx < 0 ? 0 : x + kx >= w ? w - 1 : x + kx;
          const idx = (py * w + px) * 4;
          const kk = k[(ky + 1) * 3 + (kx + 1)];
          r += data[idx] * kk;
          g += data[idx + 1] * kk;
          b += data[idx + 2] * kk;
        }
      }
      const o = (y * w + x) * 4;
      out[o] = clampByte(data[o] + (r - data[o]) * amount);
      out[o + 1] = clampByte(data[o + 1] + (g - data[o + 1]) * amount);
      out[o + 2] = clampByte(data[o + 2] + (b - data[o + 2]) * amount);
      out[o + 3] = data[o + 3];
    }
  }
  return out;
}

// Apply the adjustments to a base ImageData, returning the new pixel buffer.
export function computeAdjusted(
  base: ImageData,
  adjust: Adjust
): Uint8ClampedArray {
  const { width: w, height: h } = base;
  const px = new Uint8ClampedArray(base.data);
  const { sharpen, brightness, contrast, saturation, temperature } = adjust;
  const cf = (259 * (contrast + 255)) / (255 * (259 - contrast));
  const satF = 1 + saturation / 100;
  for (let i = 0; i < px.length; i += 4) {
    let r = px[i],
      g = px[i + 1],
      b = px[i + 2];
    r += brightness;
    g += brightness;
    b += brightness;
    r = cf * (r - 128) + 128;
    g = cf * (g - 128) + 128;
    b = cf * (b - 128) + 128;
    r += temperature * 0.6;
    b -= temperature * 0.6;
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    r = gray + (r - gray) * satF;
    g = gray + (g - gray) * satF;
    b = gray + (b - gray) * satF;
    px[i] = clampByte(r);
    px[i + 1] = clampByte(g);
    px[i + 2] = clampByte(b);
  }
  return sharpen > 0 ? sharpenImage(px, w, h, sharpen / 100) : px;
}

// Turn an image into a "stencil" / line drawing: black outlines on white, no
// color or shading. Grayscale → light blur (denoise) → Sobel edge magnitude →
// threshold. `detail` (0..100) controls how many edges survive (higher = more
// lines). No dependencies — pure canvas math.
export function stencilImage(base: ImageData, detail = 55): Uint8ClampedArray {
  const { width: w, height: h, data } = base;
  const n = w * h;
  const gray = new Float32Array(n);
  for (let i = 0, p = 0; i < data.length; i += 4, p++)
    gray[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];

  // 3x3 box blur to reduce speckle before edge detection
  const g = new Float32Array(n);
  const at = (x: number, y: number) =>
    gray[(y < 0 ? 0 : y >= h ? h - 1 : y) * w + (x < 0 ? 0 : x >= w ? w - 1 : x)];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let s = 0;
      for (let ky = -1; ky <= 1; ky++)
        for (let kx = -1; kx <= 1; kx++) s += at(x + kx, y + ky);
      g[y * w + x] = s / 9;
    }
  }
  const bat = (x: number, y: number) =>
    g[(y < 0 ? 0 : y >= h ? h - 1 : y) * w + (x < 0 ? 0 : x >= w ? w - 1 : x)];

  // higher detail → lower threshold → more edges kept
  const threshold = 140 - Math.max(0, Math.min(100, detail)) * 1.25;
  const out = new Uint8ClampedArray(data.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const gx =
        -bat(x - 1, y - 1) - 2 * bat(x - 1, y) - bat(x - 1, y + 1) +
        bat(x + 1, y - 1) + 2 * bat(x + 1, y) + bat(x + 1, y + 1);
      const gy =
        -bat(x - 1, y - 1) - 2 * bat(x, y - 1) - bat(x + 1, y - 1) +
        bat(x - 1, y + 1) + 2 * bat(x, y + 1) + bat(x + 1, y + 1);
      const mag = Math.sqrt(gx * gx + gy * gy);
      const v = mag > threshold ? 0 : 255; // black edge on white
      const o = (y * w + x) * 4;
      out[o] = out[o + 1] = out[o + 2] = v;
      out[o + 3] = 255;
    }
  }
  return out;
}

// --- AI (lazy-loaded) ---

// Bound the upscaled OUTPUT so a single GPU texture doesn't overflow.
export const MAX_AI_OUTPUT = 2048;

function cappedSource(img: HTMLImageElement, max: number): HTMLCanvasElement {
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  c.getContext("2d")?.drawImage(img, 0, 0, w, h);
  return c;
}

export type AiModel = "slim-2x" | "slim-4x" | "medium-4x" | "thick-4x";

// Static import() per choice so the bundler splits each model into its own chunk
// and only the selected one downloads.
async function loadUpscaleModel(key: AiModel) {
  switch (key) {
    case "slim-4x":
      return (await import("@upscalerjs/esrgan-slim/4x")).default;
    case "medium-4x":
      return (await import("@upscalerjs/esrgan-medium/4x")).default;
    case "thick-4x":
      return (await import("@upscalerjs/esrgan-thick/4x")).default;
    default:
      return (await import("@upscalerjs/esrgan-slim/2x")).default;
  }
}
const aiFactor = (key: AiModel) => (key.endsWith("2x") ? 2 : 4);

// Returns a base64 data URL of the upscaled image. Throws on GPU/model errors.
export async function upscaleImage(
  img: HTMLImageElement,
  key: AiModel
): Promise<string> {
  const [{ default: Upscaler }, model] = await Promise.all([
    import("upscaler"),
    loadUpscaleModel(key),
  ]);
  const up = new Upscaler({ model });
  try {
    const factor = aiFactor(key);
    // Hard-cap the INPUT so input × factor stays well under the WebGL texture
    // limit (16384). Process the whole (small) frame — no patchSize — which is
    // fast and avoids both giant textures and the thousands-of-tiny-passes that
    // lose the WebGL context.
    const SAFE_OUTPUT = 1536;
    const maxInput = Math.max(64, Math.floor(SAFE_OUTPUT / factor));
    const source = cappedSource(img, maxInput);
    console.log(
      `[imgfx] enhance ${key}: input ${source.width}x${source.height} -> ~${source.width * factor}px`
    );
    // Pass a data URL of the already-downscaled canvas (not the canvas/full
    // image) so the model can only ever see the capped size.
    return await up.upscale(source.toDataURL("image/png"), { output: "base64" });
  } finally {
    try {
      (up as { dispose?: () => unknown }).dispose?.();
    } catch {
      /* ignore */
    }
  }
}

// --- Cloud AI: Google Gemini image model ("Nano Banana"), bring-your-own key.
// Runs from the browser with the user's API key (CORS-enabled endpoint). The
// key is the caller's; we never store or send it anywhere but Google.

export async function cloudEnhance(
  img: HTMLImageElement,
  apiKey: string,
  prompt: string,
  model = "gemini-2.5-flash-image"
): Promise<string> {
  // Downscale before sending to keep the upload small and fast.
  const source = cappedSource(img, 1536);
  const base64 = source.toDataURL("image/jpeg", 0.92).split(",")[1];
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
    apiKey
  )}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: prompt },
            { inlineData: { mimeType: "image/jpeg", data: base64 } },
          ],
        },
      ],
      generationConfig: { responseModalities: ["IMAGE"] },
    }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${txt.slice(0, 300)}`);
  }
  const json = await res.json();
  const parts = json?.candidates?.[0]?.content?.parts ?? [];
  const part = parts.find(
    (p: { inlineData?: { data?: string; mimeType?: string } }) =>
      p.inlineData?.data
  );
  if (!part?.inlineData?.data) {
    throw new Error("No image in response");
  }
  return `data:${part.inlineData.mimeType || "image/png"};base64,${part.inlineData.data}`;
}

// NOTE: MAXIM restoration models (deblur/denoise/low-light) were removed — their
// global einsum mixing allocates intermediate WebGL textures far beyond the
// 16384 limit regardless of input size, so they can't run in the browser TF.js
// backend. Use ESRGAN enhance, the Gemini cloud option, or the classic sliders.
