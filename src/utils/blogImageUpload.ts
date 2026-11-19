import { normalizeImageUrl } from './imageUrl';

export interface CompressedUploadResult {
  dataUrl: string;
  width: number;
  height: number;
  sizeBytes: number;
  sizeKb: number;
  fileName: string;
}

export interface ImageUrlInspection {
  kind: 'empty' | 'upload' | 'preset' | 'google-drive' | 'google-search' | 'google-photos-share' | 'https' | 'invalid';
  normalizedUrl: string;
  notice?: string;
}

/**
 * Inspects a pasted image URL and auto-normalizes Google Drive / Google Image Search / Dropbox links.
 */
export function inspectBlogImageUrl(rawUrl: string): ImageUrlInspection {
  const trimmed = String(rawUrl || '').trim();
  if (!trimmed) {
    return { kind: 'empty', normalizedUrl: '' };
  }

  if (trimmed.toLowerCase().startsWith('data:image/')) {
    return {
      kind: 'upload',
      normalizedUrl: trimmed,
      notice: `Uploaded photo embedded (${Math.max(1, Math.round(trimmed.length / 1024))} KB) — synced via Firestore & served as social preview.`
    };
  }

  if (trimmed.startsWith('/og-image/') || trimmed.startsWith('/assets/')) {
    return {
      kind: 'preset',
      normalizedUrl: trimmed
    };
  }

  const lower = trimmed.toLowerCase();

  // Detect Google Photos album/share pages (HTML wrapper, not direct image file)
  if (lower.includes('photos.app.goo.gl') || (lower.includes('photos.google.com') && !lower.includes('googleusercontent.com'))) {
    return {
      kind: 'google-photos-share',
      normalizedUrl: trimmed,
      notice:
        'Google Photos share links open a web page instead of a direct image. Right-click the photo → "Copy image address" (lh3.googleusercontent.com) or upload from Google Drive / your device.'
    };
  }

  // Detect Google Image Search redirect URLs (google.com/imgres?imgurl=...)
  if (lower.includes('google.') && lower.includes('imgurl=')) {
    const normalized = normalizeImageUrl(trimmed);
    if (normalized && normalized !== trimmed) {
      return {
        kind: 'google-search',
        normalizedUrl: normalized,
        notice: 'Google Image link extracted automatically to the direct source image URL.'
      };
    }
  }

  // Detect Google Drive / Docs share links
  if (lower.includes('drive.google.com') || lower.includes('docs.google.com')) {
    const normalized = normalizeImageUrl(trimmed);
    if (normalized.startsWith('https://lh3.googleusercontent.com/d/')) {
      return {
        kind: 'google-drive',
        normalizedUrl: normalized,
        notice: 'Google Drive link converted to direct fast CDN image. Ensure Drive sharing is set to "Anyone with the link".'
      };
    }
  }

  const normalized = normalizeImageUrl(trimmed);
  if (normalized) {
    return {
      kind: 'https',
      normalizedUrl: normalized,
      notice: lower.includes('googleusercontent.com')
        ? 'Direct Google image CDN link ready.'
        : undefined
    };
  }

  return {
    kind: 'invalid',
    normalizedUrl: '',
    notice: 'Enter a valid https:// image link, Google Drive share link, or upload an image file.'
  };
}

/**
 * Loads a local image File and compresses it via canvas into a compact JPEG Data URL
 * suitable for Firestore CMS sync and server-side OpenGraph image serving.
 */
export async function compressBlogImageFile(
  file: File,
  options: {
    maxWidth?: number;
    maxHeight?: number;
    targetMaxBytes?: number;
  } = {}
): Promise<CompressedUploadResult> {
  const maxWidth = options.maxWidth ?? 1200;
  const maxHeight = options.maxHeight ?? 800;
  const targetMaxBytes = options.targetMaxBytes ?? 95_000;

  if (!file || !file.type.startsWith('image/')) {
    throw new Error('Please choose a valid image file (JPG, PNG, or WebP).');
  }

  if (file.size > 15 * 1024 * 1024) {
    throw new Error('Image file is larger than 15 MB. Please pick a smaller photo.');
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Could not decode this image file. Try a standard JPG, PNG, or WebP image.'));
      el.src = objectUrl;
    });

    const srcWidth = img.naturalWidth || img.width || 1200;
    const srcHeight = img.naturalHeight || img.height || 675;

    let targetWidth = srcWidth;
    let targetHeight = srcHeight;

    const widthRatio = maxWidth / targetWidth;
    const heightRatio = maxHeight / targetHeight;
    const scale = Math.min(1, widthRatio, heightRatio);

    targetWidth = Math.max(1, Math.round(targetWidth * scale));
    targetHeight = Math.max(1, Math.round(targetHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Browser image compression context is unavailable.');
    }

    // Fill crisp white background so transparent PNGs convert cleanly to JPEG
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, targetWidth, targetHeight);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

    const qualities = [0.82, 0.72, 0.62, 0.52, 0.44];
    let bestDataUrl = canvas.toDataURL('image/jpeg', qualities[0]);

    for (const q of qualities) {
      const candidate = canvas.toDataURL('image/jpeg', q);
      bestDataUrl = candidate;
      if (candidate.length <= targetMaxBytes) {
        break;
      }
    }

    // If still above target (very detailed high-res photo), step down dimensions slightly once
    if (bestDataUrl.length > targetMaxBytes && targetWidth > 800) {
      const shrinkScale = 800 / targetWidth;
      const smallCanvas = document.createElement('canvas');
      smallCanvas.width = Math.round(targetWidth * shrinkScale);
      smallCanvas.height = Math.round(targetHeight * shrinkScale);
      const smallCtx = smallCanvas.getContext('2d');
      if (smallCtx) {
        smallCtx.fillStyle = '#FFFFFF';
        smallCtx.fillRect(0, 0, smallCanvas.width, smallCanvas.height);
        smallCtx.imageSmoothingEnabled = true;
        smallCtx.imageSmoothingQuality = 'high';
        smallCtx.drawImage(canvas, 0, 0, smallCanvas.width, smallCanvas.height);
        bestDataUrl = smallCanvas.toDataURL('image/jpeg', 0.64);
        targetWidth = smallCanvas.width;
        targetHeight = smallCanvas.height;
      }
    }

    const sizeBytes = bestDataUrl.length;
    return {
      dataUrl: bestDataUrl,
      width: targetWidth,
      height: targetHeight,
      sizeBytes,
      sizeKb: Math.max(1, Math.round(sizeBytes / 1024)),
      fileName: file.name
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
