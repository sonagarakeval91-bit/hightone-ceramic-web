export interface BakedOgImageEntry {
  path: string;
  mime: string;
  hash: string;
  bytes: number;
}

// Auto-updated during `npm run build` by scripts/generate-ssr-assets.mjs
export const BAKED_OG_MANIFEST: Record<string, BakedOgImageEntry> = {};
