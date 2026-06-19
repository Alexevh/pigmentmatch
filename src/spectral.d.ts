// Minimal type declarations for spectral.js (a UMD/CommonJS module with no
// bundled types). Only the surface we use.
declare module "spectral.js" {
  export class Color {
    constructor(input: string | number[]);
    tintingStrength: number;
    readonly sRGB: number[];
    toString(opts?: {
      format?: "hex" | "rgb";
      method?: "map" | "clip";
    }): string;
  }
  export function mix(...colors: Array<[Color, number]>): Color;
}
