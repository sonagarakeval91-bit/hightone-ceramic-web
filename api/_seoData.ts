import { BAKED_OG_MANIFEST } from './_bakedOgManifest';

export const SITE_ORIGIN = 'https://hightoneceramic.com';

export const DEFAULT_OG_IMAGE =
  'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=1200&h=630&q=80';

const FIRESTORE_BASE_URL =
  'https://firestore.googleapis.com/v1/projects/gen-lang-client-0026104580/databases/ai-studio-hightoneceramicv-ac6a3ce5-36fb-4ddb-9665-be67d4140131/documents/app_settings';

export interface SeoCollectionMeta {
  id: string;
  title: string;
  shortLabel: string;
  subtitle: string;
  description: string;
  coverImage: string;
  rawCoverImage?: string;
  order?: number;
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string;
  seoImage?: string;
}

export interface SeoProductSummary {
  id: string;
  name: string;
  series?: string;
  category: string;
  imageUrl?: string;
  trapType?: string;
  dimensionsText?: string;
}

export interface ResolvedSeoPayload {
  title: string;
  description: string;
  keywords: string;
  canonicalUrl: string;
  image: string;
  imageMime: string;
  imageAlt: string;
  jsonLdList: Record<string, unknown>[];
  noscriptHtml: string;
  allCollections: SeoCollectionMeta[];
}

export function resolveOgImageAsset(key: string): { url: string; mime: string } {
  const cleanKey = String(key || 'one-piece').trim().toLowerCase();
  const baked = BAKED_OG_MANIFEST[cleanKey] || BAKED_OG_MANIFEST[key];
  if (baked && baked.path) {
    const versionSuffix = baked.hash ? `?v=${baked.hash}` : '';
    return {
      url: `${SITE_ORIGIN}${baked.path}${versionSuffix}`,
      mime: baked.mime || 'image/jpeg'
    };
  }
  return {
    url: `${SITE_ORIGIN}/og-image/${encodeURIComponent(cleanKey)}.jpg`,
    mime: 'image/jpeg'
  };
}

export const DEFAULT_COLLECTIONS: SeoCollectionMeta[] = [
  {
    id: 'one-piece',
    title: 'One Piece Closets',
    shortLabel: 'One Piece Closets',
    subtitle: 'Siphonic & Washdown Monolithic Water Closets',
    description:
      'Direct manufacturer of vitrified ceramic one piece closets in Thangadh, Gujarat. High-performance siphonic flush & concealed traps for wholesale dealers & builders.',
    coverImage:
      'https://images.unsplash.com/photo-1585060544812-6b45742d762f?auto=format&fit=crop&w=1200&h=630&q=80',
    order: 1,
    seoTitle: 'One Piece Closets Manufacturer & Wholesale | Hightone Ceramic',
    seoDescription:
      'Factory-direct vitrified ceramic one piece closets (onepiece toilets) in Thangadh, Gujarat. Siphonic flush, soft-close seat & concealed traps for B2B dealers.',
    seoKeywords:
      'one piece closet, onepiece toilet, one piece water closet, ceramic one piece commode, Hightone Ceramic Thangadh, siphonic toilet wholesale India'
  },
  {
    id: 'wall-hung',
    title: 'Wall Hung Closets',
    shortLabel: 'Wall Hung Closets',
    subtitle: 'Rimless Blind Fix Wall-Mounted Water Closets',
    description:
      'Direct manufacturer of rimless blind fix wall hung ceramic closets in Thangadh, Gujarat. 400kg load-tested floating suites for wholesale dealers.',
    coverImage:
      'https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?auto=format&fit=crop&w=1200&h=630&q=80',
    order: 2,
    seoTitle: 'Wall Hung Closets Manufacturer & Wholesale | Hightone Ceramic',
    seoDescription:
      'Rimless blind-fix wall hung toilets manufactured in Thangadh, Gujarat. 400kg load-tested floating ceramic suites direct for B2B dealers and projects.',
    seoKeywords:
      'wall hung closet, wall mounted toilet wholesale, rimless wall hung WC, concealed bracket toilet manufacturer Thangadh, Hightone Ceramic'
  },
  {
    id: 'floor-mount',
    title: 'Floor Mount Closets',
    shortLabel: 'Floor Mount Closets',
    subtitle: 'European Water Closets & Couple Suites',
    description:
      'Floor-mounted European water closets engineered for heavy-duty residential and commercial installations directly from Hightone Ceramic Thangadh.',
    coverImage:
      'https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=1200&h=630&q=80',
    order: 3,
    seoTitle: 'Floor Mount & European Water Closets | Hightone Ceramic',
    seoDescription:
      'Heavy-duty European water closets, EWC P/S trap & couple suites manufactured in Thangadh, Gujarat for residential, commercial & B2B project supply.',
    seoKeywords:
      'floor mount closet, EWC manufacturer Thangadh, European water closet wholesale, couple suite toilet India, Hightone Ceramic'
  },
  {
    id: 'orissa-pan',
    title: 'Orissa Pan',
    shortLabel: 'Orissa Pan',
    subtitle: '20" & 21" Deep Vitrified Squatting Pans',
    description:
      '20" & 21" deep high-density vitrified squatting pans with aqua rim and integrated anti-slip textured footrests.',
    coverImage:
      'https://images.unsplash.com/photo-1507652313519-d4e9174996dd?auto=format&fit=crop&w=1200&h=630&q=80',
    order: 4,
    seoTitle: 'Orissa Pan & Indian Closets Wholesale | Hightone Ceramic',
    seoDescription:
      '20 inch and 21 inch deep vitrified Orissa squatting pans with anti-slip footrests & aqua rim. Direct truckload supply from Thangadh, Gujarat.',
    seoKeywords:
      'orissa pan manufacturer, 20 inch orissa pan wholesale, 21 inch indian pan Thangadh, squatting pan ceramic Gujarat, Hightone Ceramic'
  },
  {
    id: 'table-top',
    title: 'Table Top Basins',
    shortLabel: 'Table Top Basins',
    subtitle: 'Designer Countertop Luxury Art Basins',
    description:
      'Contemporary countertop ceramic vanity art basins with razor-thin precision lip and nano-sheen glaze.',
    coverImage:
      'https://images.unsplash.com/photo-1620626011761-996317b8d101?auto=format&fit=crop&w=1200&h=630&q=80',
    order: 5,
    seoTitle: 'Table Top Vanity Art Basins Wholesale | Hightone Ceramic',
    seoDescription:
      'Designer ceramic table top & countertop wash basins with slim rim & stain-resistant nano glaze. Direct manufacturer supply from Thangadh, Gujarat.',
    seoKeywords:
      'table top wash basin, countertop basin manufacturer, designer ceramic art basin Thangadh, vanity basin wholesale India, Hightone Ceramic'
  },
  {
    id: 'pedestal',
    title: 'Pedestal Basins',
    shortLabel: 'Pedestal Basins',
    subtitle: 'Full & Half Pedestal Ceramic Sets',
    description:
      'Freestanding ceramic basin sets featuring solid pedestals, integrated soap ledges, and pre-punched faucet holes.',
    coverImage:
      'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=1200&h=630&q=80',
    order: 6,
    seoTitle: 'Full & Half Pedestal Wash Basins | Hightone Ceramic Thangadh',
    seoDescription:
      'Vitreous china wash basin sets with full and half pedestals, deep bowl profiles & glossy nano glaze. Ex-factory supply from Thangadh, Gujarat.',
    seoKeywords:
      'pedestal wash basin, half pedestal basin wholesale, full pedestal ceramic basin set Thangadh, vitreous wash basin factory, Hightone Ceramic'
  },
  {
    id: 'urinal',
    title: 'Commercial Urinals',
    shortLabel: 'Commercial Urinals',
    subtitle: 'Water-Saving Institutional Ceramic Urinals',
    description:
      'Heavy-duty ceramic urinals for high-traffic washrooms with deep parabolic bowls and eco spreaders.',
    coverImage:
      'https://images.unsplash.com/photo-1595515106969-1ce29566ff1c?auto=format&fit=crop&w=1200&h=630&q=80',
    order: 7,
    seoTitle: 'Commercial Ceramic Urinals Wholesale | Hightone Ceramic',
    seoDescription:
      'Heavy-duty ceramic urinals with water-saving eco spreaders & deep parabolic bowls for projects and institutions. Direct from Thangadh, Gujarat.',
    seoKeywords:
      'commercial urinal manufacturer, ceramic urinal wholesale India, half stall urinal Thangadh, institutional sanitaryware Gujarat, Hightone Ceramic'
  }
];

export function escapeHtml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function escapeJsonForScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}

export function normalizeSlug(raw: string): string {
  return String(raw || '')
    .toLowerCase()
    .trim()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const SLUG_ALIASES: Record<string, string> = {
  onepiece: 'one-piece',
  'one-piece-closet': 'one-piece',
  'one-piece-closets': 'one-piece',
  'one-piece-toilets': 'one-piece',
  wallhung: 'wall-hung',
  'wall-hung-closet': 'wall-hung',
  'wall-hung-closets': 'wall-hung',
  floormount: 'floor-mount',
  'floor-mount-closet': 'floor-mount',
  'floor-mount-closets': 'floor-mount',
  ewc: 'floor-mount',
  orissapan: 'orissa-pan',
  'indian-pan': 'orissa-pan',
  tabletop: 'table-top',
  'table-top-basin': 'table-top',
  'table-top-basins': 'table-top',
  'pedestal-basin': 'pedestal',
  'pedestal-basins': 'pedestal',
  urinals: 'urinal',
  'commercial-urinal': 'urinal',
  'commercial-urinals': 'urinal'
};

export function canonicalizeCategorySlug(raw: string): string {
  const slug = normalizeSlug(raw);
  return SLUG_ALIASES[slug] || slug;
}

export function formatCategoryTitle(slug: string): string {
  return String(slug || '')
    .replace(/[-_]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Normalizes Google Drive, Dropbox, and relative image URLs to crawler-compatible absolute HTTPS URLs.
 * Note: Social crawlers (WhatsApp, Facebook, LinkedIn, X) cannot render inline base64 `data:image` URIs,
 * so those return '' to trigger the HTTPS fallback image.
 */
export function normalizeCrawlerImageUrl(url?: string | null): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';

  const lower = trimmed.toLowerCase();
  if (lower.includes('paste') || lower.includes('your image') || trimmed.startsWith('(')) {
    return '';
  }

  // WhatsApp & OpenGraph scrapers do not accept base64 data URIs
  if (lower.startsWith('data:image')) {
    return '';
  }

  // Relative asset path -> convert to canonical HTTPS origin
  if (trimmed.startsWith('/')) {
    return `${SITE_ORIGIN}${trimmed}`;
  }

  if (!lower.startsWith('http://') && !lower.startsWith('https://')) {
    return '';
  }

  // Google Drive -> lh3.googleusercontent.com direct image CDN
  if (lower.includes('drive.google.com') || lower.includes('docs.google.com')) {
    const fileIdMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (fileIdMatch && fileIdMatch[1]) {
      return `https://lh3.googleusercontent.com/d/${fileIdMatch[1]}`;
    }
    const queryIdMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (queryIdMatch && queryIdMatch[1]) {
      return `https://lh3.googleusercontent.com/d/${queryIdMatch[1]}`;
    }
  }

  // Dropbox -> dl.dropboxusercontent.com direct image CDN
  if (lower.includes('dropbox.com')) {
    try {
      const parsed = new URL(trimmed);
      parsed.hostname = 'dl.dropboxusercontent.com';
      parsed.searchParams.delete('dl');
      parsed.searchParams.delete('raw');
      return parsed.toString();
    } catch {
      let direct = trimmed.replace(/^https?:\/\/(www\.)?dropbox\.com\//i, 'https://dl.dropboxusercontent.com/');
      direct = direct.replace(/[?&]dl=[01]/g, '').replace(/[?&]raw=[01]/g, '');
      if (direct.includes('&') && !direct.includes('?')) {
        direct = direct.replace('&', '?');
      }
      return direct.replace(/[?&]$/, '');
    }
  }

  // Ensure HTTPS for og:image compatibility
  if (lower.startsWith('http://')) {
    return 'https://' + trimmed.slice(7);
  }

  return trimmed;
}

// --- Lightweight Firestore REST Decoder ---
interface FirestoreRestValue {
  stringValue?: string;
  integerValue?: string;
  doubleValue?: number;
  booleanValue?: boolean;
  nullValue?: null;
  timestampValue?: string;
  mapValue?: { fields?: Record<string, FirestoreRestValue> };
  arrayValue?: { values?: FirestoreRestValue[] };
}

function decodeFirestoreValue(val: FirestoreRestValue | undefined): unknown {
  if (!val || typeof val !== 'object') return undefined;
  if ('stringValue' in val) return val.stringValue ?? '';
  if ('integerValue' in val) return Number(val.integerValue);
  if ('doubleValue' in val) return Number(val.doubleValue);
  if ('booleanValue' in val) return Boolean(val.booleanValue);
  if ('nullValue' in val) return null;
  if ('timestampValue' in val) return val.timestampValue;
  if ('arrayValue' in val) {
    const items = val.arrayValue?.values || [];
    return items.map((item) => decodeFirestoreValue(item));
  }
  if ('mapValue' in val) {
    return decodeFirestoreFields(val.mapValue?.fields);
  }
  return undefined;
}

function decodeFirestoreFields(fields?: Record<string, FirestoreRestValue>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  if (!fields) return result;
  for (const [key, val] of Object.entries(fields)) {
    result[key] = decodeFirestoreValue(val);
  }
  return result;
}

async function fetchPublicSettingDoc(docId: string): Promise<Record<string, unknown> | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3200);
  try {
    const response = await fetch(`${FIRESTORE_BASE_URL}/${encodeURIComponent(docId)}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal
    });
    if (!response.ok) return null;
    const json = (await response.json()) as { fields?: Record<string, FirestoreRestValue> };
    if (!json || !json.fields) return null;
    return decodeFirestoreFields(json.fields);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export interface LiveCmsSeoSnapshot {
  collectionsMeta: Record<string, Partial<SeoCollectionMeta>>;
  collectionSeoMap: Record<string, { title?: string; description?: string; keywords?: string; ogImage?: string }>;
  siteMedia: Record<string, string>;
  products: SeoProductSummary[];
  fetchedAt: number;
}

let cachedSnapshot: LiveCmsSeoSnapshot | null = null;
const CACHE_TTL_MS = 60 * 1000;

export async function getLiveCmsSeoSnapshot(forceRefresh = false): Promise<LiveCmsSeoSnapshot> {
  const now = Date.now();
  if (!forceRefresh && cachedSnapshot && now - cachedSnapshot.fetchedAt < CACHE_TTL_MS) {
    return cachedSnapshot;
  }

  const [catalogConfig, seoLegal, mediaCompany, cmsProducts] = await Promise.all([
    fetchPublicSettingDoc('catalog_config'),
    fetchPublicSettingDoc('cms_seo_legal'),
    fetchPublicSettingDoc('cms_media_company'),
    fetchPublicSettingDoc('cms_products')
  ]);

  const rawCollectionsMeta =
    catalogConfig && typeof catalogConfig.collectionsMeta === 'object' && catalogConfig.collectionsMeta !== null
      ? (catalogConfig.collectionsMeta as Record<string, Partial<SeoCollectionMeta>>)
      : {};

  const rawSeoMap =
    seoLegal && typeof seoLegal.collectionSeoMap === 'object' && seoLegal.collectionSeoMap !== null
      ? (seoLegal.collectionSeoMap as Record<
          string,
          { title?: string; description?: string; keywords?: string; ogImage?: string }
        >)
      : {};

  const rawSiteMedia =
    mediaCompany && typeof mediaCompany.siteMedia === 'object' && mediaCompany.siteMedia !== null
      ? (mediaCompany.siteMedia as Record<string, string>)
      : {};

  const rawProductsList = Array.isArray(cmsProducts?.products) ? cmsProducts.products : [];
  const products: SeoProductSummary[] = rawProductsList
    .filter((p): p is Record<string, unknown> => Boolean(p && typeof p === 'object'))
    .map((p) => {
      const dims = p.dimensions as Record<string, unknown> | undefined;
      let dimensionsText = '';
      if (dims && typeof dims.formatted === 'string' && dims.formatted.trim()) {
        dimensionsText = dims.formatted.trim();
      } else if (dims && Number(dims.length) > 0 && Number(dims.width) > 0) {
        dimensionsText = `${dims.length} x ${dims.width}${Number(dims.height) > 0 ? ` x ${dims.height}` : ''} ${
          typeof dims.unit === 'string' ? dims.unit : 'mm'
        }`;
      }
      return {
        id: String(p.id || ''),
        name: String(p.name || '').trim(),
        series: typeof p.series === 'string' ? p.series.trim() : undefined,
        category: String(p.category || '').trim(),
        imageUrl: typeof p.imageUrl === 'string' ? p.imageUrl : undefined,
        trapType: typeof p.trapType === 'string' ? p.trapType.trim() : undefined,
        dimensionsText: dimensionsText || undefined
      };
    })
    .filter((p) => p.name.length > 0 && p.category.length > 0);

  const snapshot: LiveCmsSeoSnapshot = {
    collectionsMeta: rawCollectionsMeta,
    collectionSeoMap: rawSeoMap,
    siteMedia: rawSiteMedia,
    products,
    fetchedAt: now
  };

  cachedSnapshot = snapshot;
  return snapshot;
}

export function buildMergedSeoCollections(snapshot: LiveCmsSeoSnapshot): SeoCollectionMeta[] {
  const { collectionsMeta, siteMedia, products } = snapshot;
  const metaKeys = Object.keys(collectionsMeta || {});
  const list: SeoCollectionMeta[] = [];
  const seen = new Set<string>();

  const resolveMediaCover = (id: string): string => {
    const underscoreKey = `collection_${id.replace(/-/g, '_')}`;
    const dashKey = `collection_${id}`;
    const categoryKey = `category_${id}`;
    return siteMedia[underscoreKey] || siteMedia[dashKey] || siteMedia[categoryKey] || '';
  };

  if (metaKeys.length > 0) {
    const sorted = Object.entries(collectionsMeta).sort((a, b) => (a[1]?.order ?? 999) - (b[1]?.order ?? 999));
    for (const [rawId, meta] of sorted) {
      const id = String(meta?.id || rawId).trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);

      const def = DEFAULT_COLLECTIONS.find((c) => c.id === id);
      const mediaImg = resolveMediaCover(id);
      const firstProductImg = products.find(
        (p) => canonicalizeCategorySlug(p.category) === canonicalizeCategorySlug(id) && normalizeCrawlerImageUrl(p.imageUrl)
      )?.imageUrl;

      const rawCandidate =
        String(meta?.seoImage || '').trim() ||
        String(meta?.coverImage || '').trim() ||
        String(mediaImg || '').trim() ||
        String(firstProductImg || '').trim();

      const resolvedImg =
        normalizeCrawlerImageUrl(meta?.seoImage) ||
        normalizeCrawlerImageUrl(meta?.coverImage) ||
        normalizeCrawlerImageUrl(mediaImg) ||
        normalizeCrawlerImageUrl(firstProductImg) ||
        normalizeCrawlerImageUrl(def?.coverImage) ||
        DEFAULT_OG_IMAGE;

      const title = String(meta?.title || def?.title || formatCategoryTitle(id)).trim();

      list.push({
        id,
        title,
        shortLabel: String(meta?.shortLabel || title).trim(),
        subtitle: String(meta?.subtitle || def?.subtitle || 'High-Density Vitrified Sanitaryware Collection').trim(),
        description: String(
          meta?.description ||
            def?.description ||
            `Direct ceramic ${title.toLowerCase()} manufacturer from Hightone Ceramic, Thangadh, Gujarat.`
        ).trim(),
        coverImage: resolvedImg,
        rawCoverImage: rawCandidate || resolvedImg,
        order: meta?.order,
        seoTitle: meta?.seoTitle,
        seoDescription: meta?.seoDescription,
        seoKeywords: meta?.seoKeywords,
        seoImage: meta?.seoImage
      });
    }
  } else {
    for (const def of DEFAULT_COLLECTIONS) {
      seen.add(def.id);
      const mediaImg = resolveMediaCover(def.id);
      const firstProductImg = products.find(
        (p) => canonicalizeCategorySlug(p.category) === def.id && normalizeCrawlerImageUrl(p.imageUrl)
      )?.imageUrl;

      list.push({
        ...def,
        coverImage:
          normalizeCrawlerImageUrl(mediaImg) ||
          normalizeCrawlerImageUrl(firstProductImg) ||
          def.coverImage
      });
    }
  }

  // Always discover any extra category slugs present on products that do not yet have a collection row
  const seenNormalized = new Set(list.map((c) => canonicalizeCategorySlug(c.id)));
  for (const p of products) {
    const slug = canonicalizeCategorySlug(p.category);
    if (slug && !seen.has(slug) && !seenNormalized.has(slug)) {
      seen.add(slug);
      seenNormalized.add(slug);
      const title = formatCategoryTitle(slug);
      list.push({
        id: slug,
        title,
        shortLabel: title,
        subtitle: 'Vitrified Sanitaryware Collection',
        description: `Explore vitrified ceramic ${title.toLowerCase()} direct from Hightone Ceramic, Thangadh, Gujarat.`,
        coverImage: normalizeCrawlerImageUrl(p.imageUrl) || DEFAULT_OG_IMAGE,
        rawCoverImage: String(p.imageUrl || '').trim() || DEFAULT_OG_IMAGE,
        order: list.length + 1
      });
    }
  }

  return list.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
}

function buildRecommendedCollectionSeo(col: SeoCollectionMeta): {
  title: string;
  description: string;
  keywords: string;
} {
  if (col.seoTitle && col.seoDescription) {
    return {
      title: col.seoTitle,
      description: col.seoDescription,
      keywords: col.seoKeywords || `${col.title.toLowerCase()}, ceramic sanitaryware Thangadh, Hightone Ceramic`
    };
  }

  const def = DEFAULT_COLLECTIONS.find((d) => d.id === col.id);
  if (def && def.seoTitle && def.seoDescription) {
    return {
      title: col.seoTitle || def.seoTitle,
      description: col.seoDescription || def.seoDescription,
      keywords: col.seoKeywords || def.seoKeywords || ''
    };
  }

  return {
    title: col.seoTitle || `${col.title} Manufacturer & Wholesale | Hightone Ceramic`,
    description:
      col.seoDescription ||
      `Direct manufacturer of vitrified ceramic ${col.title.toLowerCase()} in Thangadh, Gujarat for wholesale dealers, builders & projects.`,
    keywords:
      col.seoKeywords ||
      `${col.title.toLowerCase()}, ceramic sanitaryware wholesale Thangadh, vitrified sanitaryware Gujarat, Hightone Ceramic`
  };
}

function buildNavLinksHtml(allCollections: SeoCollectionMeta[]): string {
  const items = allCollections
    .map(
      (c) =>
        `<li><a href="${SITE_ORIGIN}/collections/${encodeURIComponent(c.id)}">${escapeHtml(c.title)}</a> — ${escapeHtml(
          c.subtitle
        )}</li>`
    )
    .join('');
  return `<nav aria-label="Sanitaryware Collections"><ul><li><a href="${SITE_ORIGIN}/">Home - Hightone Ceramic</a></li><li><a href="${SITE_ORIGIN}/collections">All Sanitaryware Collections</a></li>${items}<li><a href="${SITE_ORIGIN}/b2b">B2B Dealership &amp; Wholesale</a></li><li><a href="${SITE_ORIGIN}/about">About Hightone Ceramic Plant</a></li></ul></nav>`;
}

export async function resolveSeoForRoute(route: string, collectionParam?: string): Promise<ResolvedSeoPayload> {
  const snapshot = await getLiveCmsSeoSnapshot();
  const allCollections = buildMergedSeoCollections(snapshot);
  const heroFallback = normalizeCrawlerImageUrl(snapshot.siteMedia?.hero_lifestyle) || DEFAULT_OG_IMAGE;

  const cleanRoute = String(route || 'home').toLowerCase().trim();

  if (cleanRoute === 'b2b') {
    const title = 'B2B Dealership & Wholesale Supply | Hightone Ceramic Thangadh';
    const description =
      'Partner directly with Hightone Ceramic for authorized sanitaryware distributorships, OEM manufacturing & full-truckload dispatch from Thangadh, Gujarat.';
    const canonicalUrl = `${SITE_ORIGIN}/b2b`;
    const ogAsset = resolveOgImageAsset('b2b');
    return {
      title,
      description,
      keywords:
        'sanitaryware dealership India, Hightone Ceramic B2B, ceramic sanitaryware distributor, Thangadh factory direct supply, sanitaryware OEM Gujarat',
      canonicalUrl,
      image: ogAsset.url,
      imageMime: ogAsset.mime,
      imageAlt: 'Hightone Ceramic Factory Direct B2B Truckload Dispatch',
      jsonLdList: [
        {
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: title,
          description,
          url: canonicalUrl,
          isPartOf: { '@type': 'WebSite', name: 'Hightone Ceramic', url: SITE_ORIGIN }
        }
      ],
      noscriptHtml: `<main><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p>${buildNavLinksHtml(
        allCollections
      )}</main>`,
      allCollections
    };
  }

  if (cleanRoute === 'about') {
    const title = 'About Hightone Ceramic | Sanitaryware Plant in Thangadh, Gujarat';
    const description =
      'Discover Hightone Ceramic manufacturing facility in Thangadh, Gujarat: 120m continuous tunnel kilns, robotic nano-glaze spraying & ISO quality testing.';
    const canonicalUrl = `${SITE_ORIGIN}/about`;
    const ogAsset = resolveOgImageAsset('about');
    return {
      title,
      description,
      keywords:
        'Hightone Ceramic Thangadh plant, ceramic sanitaryware factory Gujarat, tunnel kiln sanitaryware manufacturing, vitreous china plant India',
      canonicalUrl,
      image: ogAsset.url,
      imageMime: ogAsset.mime,
      imageAlt: 'Hightone Ceramic Tunnel Kiln Manufacturing Facility in Thangadh',
      jsonLdList: [
        {
          '@context': 'https://schema.org',
          '@type': 'AboutPage',
          name: title,
          description,
          url: canonicalUrl,
          isPartOf: { '@type': 'WebSite', name: 'Hightone Ceramic', url: SITE_ORIGIN }
        }
      ],
      noscriptHtml: `<main><h1>${escapeHtml(title)}</h1><p>${escapeHtml(description)}</p>${buildNavLinksHtml(
        allCollections
      )}</main>`,
      allCollections
    };
  }

  // Collections directory (/collections) or specific collection (/collections/:slug)
  const rawSlug = String(collectionParam || '').trim();
  const normalizedTarget = canonicalizeCategorySlug(rawSlug);

  if (cleanRoute === 'collections' && (!rawSlug || normalizedTarget === 'all')) {
    const title = 'Sanitaryware Collections Catalog | Hightone Ceramic Thangadh';
    const description =
      'Browse Hightone Ceramic vitrified sanitaryware collections: One Piece Closets, Wall Hung Toilets, Table Top & Pedestal Basins direct from Thangadh.';
    const canonicalUrl = `${SITE_ORIGIN}/collections`;
    const ogAsset = resolveOgImageAsset('collections');
    return {
      title,
      description,
      keywords:
        'sanitaryware collections, one piece closet, wall hung toilet, table top basin, Hightone Ceramic catalog, sanitaryware manufacturer Thangadh',
      canonicalUrl,
      image: ogAsset.url,
      imageMime: ogAsset.mime,
      imageAlt: 'Hightone Ceramic Sanitaryware Collections',
      jsonLdList: [
        {
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: title,
          description,
          url: canonicalUrl,
          mainEntity: {
            '@type': 'ItemList',
            itemListElement: allCollections.map((c, idx) => ({
              '@type': 'ListItem',
              position: idx + 1,
              name: c.title,
              url: `${SITE_ORIGIN}/collections/${c.id}`
            }))
          }
        }
      ],
      noscriptHtml: `<main><h1>Sanitaryware Collections — Hightone Ceramic</h1><p>${escapeHtml(
        description
      )}</p>${buildNavLinksHtml(allCollections)}</main>`,
      allCollections
    };
  }

  // Find matching collection (supports exact id, alias like 'onepiece' -> 'one-piece', or '-collection' variants)
  const matchedCol =
    allCollections.find((c) => c.id.toLowerCase() === rawSlug.toLowerCase()) ||
    allCollections.find((c) => canonicalizeCategorySlug(c.id) === normalizedTarget) ||
    allCollections.find((c) => canonicalizeCategorySlug(c.id).replace(/-collection$/, '') === normalizedTarget) ||
    allCollections.find((c) => canonicalizeCategorySlug(c.title) === normalizedTarget) ||
    allCollections.find(
      (c) =>
        (normalizedTarget === 'pedestal' && c.id.includes('pedestal')) ||
        (normalizedTarget === 'orissa-pan' && (c.id.includes('orissapan') || c.id.includes('orissa-pan')))
    ) ||
    allCollections[0];

  const colId = matchedCol?.id || normalizedTarget || 'one-piece';
  const colTitle = matchedCol?.title || formatCategoryTitle(colId);
  const customOverride =
    snapshot.collectionSeoMap[colId] ||
    snapshot.collectionSeoMap[rawSlug] ||
    snapshot.collectionSeoMap[normalizedTarget] ||
    {};

  const recommended = matchedCol
    ? buildRecommendedCollectionSeo(matchedCol)
    : {
        title: `${colTitle} Manufacturer & Wholesale | Hightone Ceramic`,
        description: `Direct vitrified ceramic ${colTitle.toLowerCase()} manufacturer from Thangadh, Gujarat.`,
        keywords: `${colTitle.toLowerCase()}, ceramic sanitaryware, Hightone Ceramic Thangadh`
      };

  const title = (customOverride.title || recommended.title).trim();
  const description = (customOverride.description || recommended.description).trim();
  const keywords = (customOverride.keywords || recommended.keywords).trim();
  const canonicalUrl = `${SITE_ORIGIN}/collections/${colId}`;

  const colProducts = snapshot.products.filter((p) => {
    const pNorm = canonicalizeCategorySlug(p.category);
    return pNorm === canonicalizeCategorySlug(colId) || p.category.toLowerCase() === colId.toLowerCase();
  });

  // Use baked static Edge CDN image if present in manifest, otherwise fallback to /og-image proxy
  const ogAsset = resolveOgImageAsset(colId);
  const resolvedImage = ogAsset.url;

  const collectionJsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: title,
    description,
    url: canonicalUrl,
    image: resolvedImage,
    isPartOf: {
      '@type': 'WebSite',
      name: 'Hightone Ceramic',
      url: SITE_ORIGIN
    },
    about: {
      '@type': 'Thing',
      name: colTitle
    },
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Home',
          item: `${SITE_ORIGIN}/`
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Collections',
          item: `${SITE_ORIGIN}/collections`
        },
        {
          '@type': 'ListItem',
          position: 3,
          name: colTitle,
          item: canonicalUrl
        }
      ]
    }
  };

  if (colProducts.length > 0) {
    collectionJsonLd.mainEntity = {
      '@type': 'ItemList',
      numberOfItems: colProducts.length,
      itemListElement: colProducts.slice(0, 30).map((prod, idx) => ({
        '@type': 'ListItem',
        position: idx + 1,
        item: {
          '@type': 'Product',
          name: prod.name,
          category: colTitle,
          brand: {
            '@type': 'Brand',
            name: 'Hightone Ceramic'
          },
          ...(normalizeCrawlerImageUrl(prod.imageUrl)
            ? { image: normalizeCrawlerImageUrl(prod.imageUrl) }
            : {}),
          description: [prod.series, prod.dimensionsText, prod.trapType].filter(Boolean).join(' • ') || colTitle
        }
      }))
    };
  }

  const modelsListHtml =
    colProducts.length > 0
      ? `<h2>${escapeHtml(colTitle)} Models (${colProducts.length})</h2><ul>${colProducts
          .slice(0, 40)
          .map(
            (p) =>
              `<li><strong>${escapeHtml(p.name)}</strong>${p.series ? ` (${escapeHtml(p.series)})` : ''}${
                p.dimensionsText ? ` — ${escapeHtml(p.dimensionsText)}` : ''
              }${p.trapType ? ` — ${escapeHtml(p.trapType)}` : ''}</li>`
          )
          .join('')}</ul>`
      : '';

  const noscriptHtml = `<main><h1>${escapeHtml(colTitle)} — Hightone Ceramic Thangadh</h1><p>${escapeHtml(
    matchedCol?.subtitle || ''
  )}</p><p>${escapeHtml(description)}</p>${modelsListHtml}${buildNavLinksHtml(allCollections)}</main>`;

  return {
    title,
    description,
    keywords,
    canonicalUrl,
    image: resolvedImage,
    imageMime: ogAsset.mime,
    imageAlt: `${colTitle} - Hightone Ceramic Sanitaryware Collection`,
    jsonLdList: [collectionJsonLd],
    noscriptHtml,
    allCollections
  };
}
