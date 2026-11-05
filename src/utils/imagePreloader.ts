import { normalizeImageUrl } from './imageUrl';
import { ProductItem, CategoryMeta } from '../types';
import { SiteMediaMap } from '../services/googleSheetsService';

/**
 * Preloads a single image URL into browser cache via new Image().
 * Resolves with true if successfully loaded, false if error/timeout.
 */
export function preloadSingleImage(url: string, timeoutMs = 8000): Promise<boolean> {
  return new Promise((resolve) => {
    if (!url || typeof url !== 'string') {
      resolve(false);
      return;
    }

    const normalized = normalizeImageUrl(url);
    if (!normalized) {
      resolve(false);
      return;
    }

    const img = new Image();
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        // Clean up callbacks
        img.onload = null;
        img.onerror = null;
        resolve(false);
      }
    }, timeoutMs);

    img.onload = () => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        img.onload = null;
        img.onerror = null;
        resolve(true);
      }
    };

    img.onerror = () => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        img.onload = null;
        img.onerror = null;
        resolve(false);
      }
    };

    img.referrerPolicy = 'no-referrer';
    img.src = normalized;
  });
}

/**
 * Extracts and deduplicates all image URLs that the website displays.
 */
export function collectImagesToPreload({
  products = [],
  collectionsMeta = {},
  siteMedia,
  defaultCategories = []
}: {
  products?: ProductItem[];
  collectionsMeta?: Record<string, Partial<CategoryMeta>>;
  siteMedia?: SiteMediaMap;
  defaultCategories?: CategoryMeta[];
}): string[] {
  const urlSet = new Set<string>();

  // 1. Key site media assets
  if (siteMedia) {
    if (siteMedia.logo) urlSet.add(siteMedia.logo);
    if (siteMedia.hero_lifestyle) urlSet.add(siteMedia.hero_lifestyle);
    if (siteMedia.tunnel_kiln) urlSet.add(siteMedia.tunnel_kiln);
    if (siteMedia.dispatch_loading) urlSet.add(siteMedia.dispatch_loading);
    if (siteMedia.slip_casting) urlSet.add(siteMedia.slip_casting);
    if (siteMedia.pressure_casting) urlSet.add(siteMedia.pressure_casting);
  }

  // 2. Default categories cover images
  for (const cat of defaultCategories) {
    if (cat.coverImage) {
      urlSet.add(cat.coverImage);
    }
  }

  // 3. Collection meta cover images from Google Sheet
  for (const meta of Object.values(collectionsMeta)) {
    if (meta.coverImage) {
      urlSet.add(meta.coverImage);
    }
  }

  // 4. Products catalog images
  for (const p of products) {
    if (p.imageUrl) {
      urlSet.add(p.imageUrl);
    }
    if ((p as any).drawingUrl) {
      urlSet.add((p as any).drawingUrl);
    }
  }

  // Normalize and filter out invalid/empty strings
  const validList: string[] = [];
  for (const raw of urlSet) {
    const normalized = normalizeImageUrl(raw);
    if (normalized && !validList.includes(normalized)) {
      validList.push(normalized);
    }
  }

  return validList;
}

export interface PreloadProgress {
  loaded: number;
  total: number;
  percent: number;
}

/**
 * Preloads an array of image URLs in parallel, tracking progress and calling onProgress.
 * Resolves when all images have completed loading (or errored/timed out), with a safety ceiling.
 */
export async function preloadAllImages(
  urls: string[],
  onProgress?: (progress: PreloadProgress) => void,
  maxTimeoutMs = 8000
): Promise<{ total: number; loaded: number; failed: number }> {
  const total = urls.length;
  if (total === 0) {
    if (onProgress) onProgress({ loaded: 0, total: 0, percent: 100 });
    return { total: 0, loaded: 0, failed: 0 };
  }

  let completed = 0;
  let successCount = 0;
  let failCount = 0;

  return new Promise((resolve) => {
    let globalTimeoutTriggered = false;

    // Safety timeout: ensure we never hang the app if a CDN drops or user network stalls
    const globalTimeout = setTimeout(() => {
      globalTimeoutTriggered = true;
      if (onProgress) {
        onProgress({
          loaded: total,
          total,
          percent: 100
        });
      }
      resolve({
        total,
        loaded: successCount,
        failed: total - successCount
      });
    }, maxTimeoutMs);

    // Initial progress report (0%)
    if (onProgress) {
      onProgress({ loaded: 0, total, percent: 0 });
    }

    // Launch all image requests in parallel
    urls.forEach((url) => {
      preloadSingleImage(url, maxTimeoutMs - 500).then((isSuccess) => {
        if (globalTimeoutTriggered) return;

        completed++;
        if (isSuccess) {
          successCount++;
        } else {
          failCount++;
        }

        const percent = Math.min(100, Math.round((completed / total) * 100));

        if (onProgress) {
          onProgress({
            loaded: completed,
            total,
            percent
          });
        }

        if (completed >= total) {
          clearTimeout(globalTimeout);
          resolve({
            total,
            loaded: successCount,
            failed: failCount
          });
        }
      });
    });
  });
}
