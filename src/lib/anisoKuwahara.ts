// Anisotropic Kuwahara (Kyprianidis/Kang/Döllner) on WebGL2 — the painterly
// filter with ORIENTED elliptic sectors: brushstroke-like daubs that stretch
// along the local edge direction instead of square patches. This algorithm
// was designed for the GPU (per-pixel rotated ellipses defeat the summed-area
// trick that makes the classic filter fast on the CPU), so it runs as three
// fragment-shader passes:
//   1. structure tensor of the image (Sobel),
//   2. gaussian smoothing of the tensor,
//   3. per-pixel eigen-analysis → orientation + anisotropy → elliptic
//      8-sector Kuwahara, sectors weighted by 1/(1+variance^q).
// Returns null when WebGL2 / float render targets aren't available — the
// caller falls back to the classic (CPU) oil filter, so this is purely an
// upgrade, never a requirement.

import type { PixelGrid } from "./imagefx";

const VERT = `#version 300 es
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const FRAG_TENSOR = `#version 300 es
precision highp float;
uniform sampler2D u_src;
out vec4 o;
vec3 px(ivec2 q) {
  ivec2 sz = textureSize(u_src, 0);
  return texelFetch(u_src, clamp(q, ivec2(0), sz - 1), 0).rgb;
}
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  vec3 u = (
    -1.0 * px(p + ivec2(-1, -1)) - 2.0 * px(p + ivec2(-1, 0)) - 1.0 * px(p + ivec2(-1, 1)) +
     1.0 * px(p + ivec2( 1, -1)) + 2.0 * px(p + ivec2( 1, 0)) + 1.0 * px(p + ivec2( 1, 1))
  ) / 4.0;
  vec3 v = (
    -1.0 * px(p + ivec2(-1, -1)) - 2.0 * px(p + ivec2(0, -1)) - 1.0 * px(p + ivec2(1, -1)) +
     1.0 * px(p + ivec2(-1,  1)) + 2.0 * px(p + ivec2(0,  1)) + 1.0 * px(p + ivec2(1,  1))
  ) / 4.0;
  o = vec4(dot(u, u), dot(v, v), dot(u, v), 1.0);
}`;

const FRAG_SMOOTH = `#version 300 es
precision highp float;
uniform sampler2D u_src;
out vec4 o;
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  ivec2 sz = textureSize(u_src, 0);
  vec4 sum = vec4(0.0);
  float wsum = 0.0;
  for (int j = -3; j <= 3; j++)
    for (int i = -3; i <= 3; i++) {
      float w = exp(-float(i * i + j * j) / 8.0); // sigma = 2
      sum += w * texelFetch(u_src, clamp(p + ivec2(i, j), ivec2(0), sz - 1), 0);
      wsum += w;
    }
  o = sum / wsum;
}`;

const FRAG_MAIN = `#version 300 es
precision highp float;
uniform sampler2D u_src;
uniform sampler2D u_tensor;
uniform float u_radius;
out vec4 o;
#define SECTORS 8
#define MAX_R 12
vec3 px(ivec2 q) {
  ivec2 sz = textureSize(u_src, 0);
  return texelFetch(u_src, clamp(q, ivec2(0), sz - 1), 0).rgb;
}
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  vec4 t = texelFetch(u_tensor, p, 0);
  // eigen-analysis of the smoothed structure tensor (Exx, Eyy, Exy)
  float tr = t.x + t.y;
  float det = sqrt(max(0.0, (t.x - t.y) * (t.x - t.y) + 4.0 * t.z * t.z));
  float l1 = 0.5 * (tr + det);
  float l2 = 0.5 * (tr - det);
  vec2 dir = vec2(l1 - t.x, -t.z); // along the edge (minor eigenvector)
  dir = (length(dir) > 1e-6) ? normalize(dir) : vec2(0.0, 1.0);
  float A = (l1 + l2 > 1e-6) ? (l1 - l2) / (l1 + l2) : 0.0;

  // ellipse axes: stretched along the edge by the anisotropy
  float a = u_radius * clamp((1.0 + A), 1.0, 2.0);
  float b = u_radius * clamp(1.0 / (1.0 + A), 0.35, 1.0);
  float cp = dir.x;
  float sp = dir.y;
  // maps an image offset into the unit-disc ellipse space (rotate by -phi,
  // then scale by 1/a, 1/b)
  mat2 SR = mat2(cp / a, -sp / b, sp / a, cp / b);

  vec4 m[SECTORS];
  vec3 s[SECTORS];
  for (int k = 0; k < SECTORS; k++) {
    m[k] = vec4(0.0);
    s[k] = vec3(0.0);
  }
  int R = int(ceil(max(a, b)));
  for (int j = -MAX_R; j <= MAX_R; j++) {
    if (abs(j) > R) continue;
    for (int i = -MAX_R; i <= MAX_R; i++) {
      if (abs(i) > R) continue;
      vec2 v = SR * vec2(float(i), float(j));
      float r2 = dot(v, v);
      if (r2 > 1.0) continue;
      vec3 c = px(p + ivec2(i, j));
      float wr = exp(-3.125 * r2); // radial gaussian inside the ellipse
      float ang = atan(v.y, v.x) + 3.14159265;
      int k = int(floor(ang / (6.2831853 / float(SECTORS)))) % SECTORS;
      m[k] += vec4(c * wr, wr);
      s[k] += c * c * wr;
    }
  }
  vec3 outc = vec3(0.0);
  float wsum = 0.0;
  for (int k = 0; k < SECTORS; k++) {
    if (m[k].w < 1e-4) continue;
    vec3 mean = m[k].rgb / m[k].w;
    vec3 varc = abs(s[k] / m[k].w - mean * mean);
    float sigma2 = varc.r + varc.g + varc.b;
    // low-variance (uniform) sectors dominate — the Kuwahara principle
    float wk = 1.0 / (1.0 + pow(1000.0 * sigma2, 4.0));
    outc += mean * wk;
    wsum += wk;
  }
  o = vec4(wsum > 1e-6 ? outc / wsum : px(p), 1.0);
}`;

// Cached GL state (context creation and shader compilation are expensive; the
// textures are resized per call).
let cache: {
  canvas: HTMLCanvasElement;
  gl: WebGL2RenderingContext;
  progTensor: WebGLProgram;
  progSmooth: WebGLProgram;
  progMain: WebGLProgram;
} | null = null;
let unavailable = false;

function compile(gl: WebGL2RenderingContext, vert: string, frag: string): WebGLProgram | null {
  const mk = (type: number, src: string) => {
    const sh = gl.createShader(type);
    if (!sh) return null;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) return null;
    return sh;
  };
  const vs = mk(gl.VERTEX_SHADER, vert);
  const fs = mk(gl.FRAGMENT_SHADER, frag);
  if (!vs || !fs) return null;
  const prog = gl.createProgram();
  if (!prog) return null;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  return prog;
}

function getGL() {
  if (unavailable) return null;
  if (cache) return cache;
  try {
    if (typeof document === "undefined") {
      unavailable = true;
      return null;
    }
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2", {
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
    });
    if (!gl || !gl.getExtension("EXT_color_buffer_float")) {
      unavailable = true;
      return null;
    }
    const progTensor = compile(gl, VERT, FRAG_TENSOR);
    const progSmooth = compile(gl, VERT, FRAG_SMOOTH);
    const progMain = compile(gl, VERT, FRAG_MAIN);
    if (!progTensor || !progSmooth || !progMain) {
      unavailable = true;
      return null;
    }
    cache = { canvas, gl, progTensor, progSmooth, progMain };
    return cache;
  } catch {
    unavailable = true;
    return null;
  }
}

// Run the three passes. Returns null when the GPU path is unavailable.
export function anisoKuwaharaImage(
  base: PixelGrid,
  radius = 6
): Uint8ClampedArray | null {
  const ctx = getGL();
  if (!ctx) return null;
  const { gl, progTensor, progSmooth, progMain } = ctx;
  const { width: w, height: h, data } = base;
  try {
    ctx.canvas.width = w;
    ctx.canvas.height = h;
    gl.viewport(0, 0, w, h);

    const mkTex = (internal: number, format: number, type: number, pixels: ArrayBufferView | null) => {
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, pixels);
      return tex;
    };
    const srcTex = mkTex(gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(data.buffer, data.byteOffset, data.length));
    const tensorTex = mkTex(gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT, null);
    const smoothTex = mkTex(gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT, null);
    const outTex = mkTex(gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, null);
    const fbo = gl.createFramebuffer();

    const pass = (prog: WebGLProgram, target: WebGLTexture, binds: [string, WebGLTexture][], radiusUniform?: number) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, target, 0);
      gl.useProgram(prog);
      binds.forEach(([name, tex], unit) => {
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.uniform1i(gl.getUniformLocation(prog, name), unit);
      });
      if (radiusUniform !== undefined)
        gl.uniform1f(gl.getUniformLocation(prog, "u_radius"), radiusUniform);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    pass(progTensor, tensorTex!, [["u_src", srcTex!]]);
    pass(progSmooth, smoothTex!, [["u_src", tensorTex!]]);
    pass(
      progMain,
      outTex!,
      [
        ["u_src", srcTex!],
        ["u_tensor", smoothTex!],
      ],
      Math.min(12, Math.max(2, radius))
    );

    const out = new Uint8ClampedArray(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(out.buffer));
    // restore alpha from the source (the passes write 1.0)
    for (let i = 3; i < out.length; i += 4) out[i] = data[i];

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    [srcTex, tensorTex, smoothTex, outTex].forEach((t) => t && gl.deleteTexture(t));
    if (fbo) gl.deleteFramebuffer(fbo);
    return out;
  } catch {
    return null;
  }
}
