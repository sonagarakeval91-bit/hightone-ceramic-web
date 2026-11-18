import {
  buildMergedSeoCollections,
  canonicalizeCategorySlug,
  DEFAULT_OG_IMAGE,
  getLiveCmsSeoSnapshot,
  normalizeCrawlerImageUrl,
  SITE_ORIGIN
} from './_seoData.js';

declare const Buffer: {
  from(data: ArrayBuffer | string, encoding?: string): {
    length: number;
    [index: number]: number;
  };
};

function detectImageMime(bytes: { length: number; [index: number]: number }, fallbackType?: string | null): string {
  if (bytes.length >= 4) {
    if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
    if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return 'image/gif';
    if (
      bytes.length >= 12 &&
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50
    ) {
      return 'image/webp';
    }
  }
  if (fallbackType && fallbackType.toLowerCase().startsWith('image/')) {
    return fallbackType.split(';')[0].trim();
  }
  return 'image/jpeg';
}

function resolveRawImageSource(
  slug: string,
  snapshot: Awaited<ReturnType<typeof getLiveCmsSeoSnapshot>>
): string {
  const clean = slug.replace(/\.(jpe?g|png|webp)$/i, '').trim().toLowerCase();

  if (clean === 'b2b') {
    return (
      normalizeCrawlerImageUrl(snapshot.siteMedia?.dispatch_loading) ||
      normalizeCrawlerImageUrl(snapshot.siteMedia?.hero_lifestyle) ||
      DEFAULT_OG_IMAGE
    );
  }
  if (clean === 'about') {
    return (
      normalizeCrawlerImageUrl(snapshot.siteMedia?.tunnel_kiln) ||
      normalizeCrawlerImageUrl(snapshot.siteMedia?.hero_lifestyle) ||
      DEFAULT_OG_IMAGE
    );
  }

  const allCollections = buildMergedSeoCollections(snapshot);
  if (clean === 'all' || clean === 'collections') {
    return (
      allCollections[0]?.rawCoverImage ||
      allCollections[0]?.coverImage ||
      normalizeCrawlerImageUrl(snapshot.siteMedia?.hero_lifestyle) ||
      DEFAULT_OG_IMAGE
    );
  }

  const target = canonicalizeCategorySlug(clean);
  const matched =
    allCollections.find((c) => c.id.toLowerCase() === clean) ||
    allCollections.find((c) => canonicalizeCategorySlug(c.id) === target) ||
    allCollections.find((c) => canonicalizeCategorySlug(c.id).replace(/-collection$/, '') === target) ||
    allCollections.find((c) => canonicalizeCategorySlug(c.title) === target) ||
    allCollections.find(
      (c) =>
        (target === 'pedestal' && c.id.includes('pedestal')) ||
        (target === 'orissa-pan' && (c.id.includes('orissapan') || c.id.includes('orissa-pan')))
    ) ||
    allCollections[0];

  const customOverride = snapshot.collectionSeoMap[matched?.id || clean] || {};
  const colProducts = snapshot.products.filter((p) => {
    const pNorm = canonicalizeCategorySlug(p.category);
    return matched && (pNorm === canonicalizeCategorySlug(matched.id) || p.category.toLowerCase() === matched.id.toLowerCase());
  });
  const firstProductImg = colProducts.map((p) => p.imageUrl || '').find((u) => Boolean(u.trim()));

  return (
    customOverride.ogImage ||
    matched?.seoImage ||
    matched?.rawCoverImage ||
    matched?.coverImage ||
    firstProductImg ||
    normalizeCrawlerImageUrl(snapshot.siteMedia?.hero_lifestyle) ||
    DEFAULT_OG_IMAGE
  );
}

async function fetchImageBytes(url: string): Promise<{ buffer: ReturnType<typeof Buffer.from>; mime: string } | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6500);
  try {
    const resp = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; HightoneCeramicOG/1.0)',
        Accept: 'image/avif,image/webp,image/png,image/jpeg,image/*,*/*;q=0.8'
      },
      signal: controller.signal
    });
    if (!resp.ok) return null;
    const arrayBuffer = await resp.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    if (buffer.length < 100) return null;
    const respMime = resp.headers.get('content-type');
    // Verify it is actually an image via magic bytes or response header
    const mime = detectImageMime(buffer, respMime);
    const isMagicImage =
      (buffer[0] === 0xff && buffer[1] === 0xd8) ||
      (buffer[0] === 0x89 && buffer[1] === 0x50) ||
      (buffer[0] === 0x47 && buffer[1] === 0x49) ||
      (buffer[0] === 0x52 && buffer[1] === 0x49);
    if (!isMagicImage && !(respMime && respMime.toLowerCase().startsWith('image/'))) {
      return null;
    }
    return { buffer, mime };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export default async function handler(req: any, res: any) {
  try {
    const rawSlug = String(req?.query?.collection || 'one-piece').trim();
    const snapshot = await getLiveCmsSeoSnapshot();
    const source = resolveRawImageSource(rawSlug, snapshot).trim();

    // 1. Handle inline base64 data URIs uploaded in CMS
    const dataUriMatch = source.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
    if (dataUriMatch) {
      const mime = dataUriMatch[1];
      const buf = Buffer.from(dataUriMatch[2], 'base64');
      res.setHeader('Content-Type', mime);
      res.setHeader('Content-Length', String(buf.length));
      res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300, stale-while-revalidate=86400');
      res.setHeader('Access-Control-Allow-Origin', '*');
      if (req.method === 'HEAD') return res.status(200).end();
      return res.status(200).send(buf);
    }

    // 2. Normalize relative or http links to HTTPS
    const httpsUrl =
      source.startsWith('/')
        ? `${SITE_ORIGIN}${source}`
        : normalizeCrawlerImageUrl(source) || DEFAULT_OG_IMAGE;

    const fetched = (await fetchImageBytes(httpsUrl)) || (await fetchImageBytes(DEFAULT_OG_IMAGE));

    if (!fetched) {
      return res.redirect(302, DEFAULT_OG_IMAGE);
    }

    res.setHeader('Content-Type', fetched.mime);
    res.setHeader('Content-Length', String(fetched.buffer.length));
    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300, stale-while-revalidate=86400');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('X-Content-Type-Options', 'nosniff');

    if (req.method === 'HEAD') {
      return res.status(200).end();
    }

    return res.status(200).send(fetched.buffer);
  } catch {
    return res.redirect(302, DEFAULT_OG_IMAGE);
  }
}
