import { BlogPost, CategoryMeta } from '../types';
import { STARTER_BLOG_POSTS } from '../data/blogPosts';
import { fetchAllPublicCmsFromCloud, PublicCmsBundle } from './firestoreSyncService';
import { formatCategoryName } from './googleSheetsService';
import { normalizeImageUrl } from '../utils/imageUrl';

export const CANONICAL_SITE_ORIGIN = 'https://hightoneceramic.com';

export type SitemapChangeFreq =
  | 'always'
  | 'hourly'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'yearly'
  | 'never';

export interface SitemapUrlEntry {
  loc: string;
  lastmod: string;
  changefreq: SitemapChangeFreq;
  priority: string;
  pageType: 'core' | 'collection' | 'blog';
  title: string;
  categoryId?: string;
  imageUrl?: string;
}

export interface SitemapGenerationOptions {
  origin?: string;
  lastmod?: string;
  includeImages?: boolean;
  blogPosts?: BlogPost[];
}

export interface SearchConsoleExportBundle {
  sitemapEndpointUrl: string;
  generatedAt: string;
  totalUrls: number;
  collectionCount: number;
  blogCount: number;
  entries: SitemapUrlEntry[];
  xmlContent: string;
  csvContent: string;
  plainUrlList: string;
}

const DEFAULT_CORE_CATEGORIES: Pick<CategoryMeta, 'id' | 'title' | 'shortLabel' | 'coverImage' | 'order'>[] = [
  {
    id: 'one-piece',
    title: 'One Piece Closets',
    shortLabel: 'One Piece Closets',
    coverImage: 'https://images.unsplash.com/photo-1585060544812-6b45742d762f?auto=format&fit=crop&w=1200&h=630&q=80',
    order: 1
  },
  {
    id: 'wall-hung',
    title: 'Wall Hung Closets',
    shortLabel: 'Wall Hung Closets',
    coverImage: 'https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?auto=format&fit=crop&w=1200&h=630&q=80',
    order: 2
  },
  {
    id: 'floor-mount',
    title: 'Floor Mount Closets',
    shortLabel: 'Floor Mount Closets',
    coverImage: 'https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=1200&h=630&q=80',
    order: 3
  },
  {
    id: 'orissa-pan',
    title: 'Orissa Pan',
    shortLabel: 'Orissa Pan',
    coverImage: 'https://images.unsplash.com/photo-1507652313519-d4e9174996dd?auto=format&fit=crop&w=1200&h=630&q=80',
    order: 4
  },
  {
    id: 'table-top',
    title: 'Table Top Basins',
    shortLabel: 'Table Top Basins',
    coverImage: 'https://images.unsplash.com/photo-1620626011761-996317b8d101?auto=format&fit=crop&w=1200&h=630&q=80',
    order: 5
  },
  {
    id: 'pedestal',
    title: 'Pedestal Basins',
    shortLabel: 'Pedestal Basins',
    coverImage: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=1200&h=630&q=80',
    order: 6
  },
  {
    id: 'urinal',
    title: 'Commercial Urinals',
    shortLabel: 'Commercial Urinals',
    coverImage: 'https://images.unsplash.com/photo-1595515106969-1ce29566ff1c?auto=format&fit=crop&w=1200&h=630&q=80',
    order: 7
  }
];

function escapeXml(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapeCsvCell(value: string): string {
  const str = String(value ?? '');
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function sanitizeOrigin(origin?: string): string {
  const raw = (origin || CANONICAL_SITE_ORIGIN).trim().replace(/\/+$/, '');
  return raw.startsWith('http://') || raw.startsWith('https://') ? raw : CANONICAL_SITE_ORIGIN;
}

function resolveTodayIsoDate(lastmod?: string): string {
  if (lastmod && /^\d{4}-\d{2}-\d{2}/.test(lastmod)) {
    return lastmod.slice(0, 10);
  }
  return new Date().toISOString().split('T')[0];
}

/**
 * Extracts merged, sorted collection categories directly from Firestore CMS database payloads.
 */
export function extractCollectionCategoriesFromDatabase(cmsBundle?: PublicCmsBundle | null): CategoryMeta[] {
  const collectionsMeta = cmsBundle?.catalogConfig?.collectionsMeta || {};
  const siteMedia: Record<string, string> = cmsBundle?.cmsMediaCompany?.siteMedia || {};
  const products = cmsBundle?.cmsProducts?.products || [];

  const metaKeys = Object.keys(collectionsMeta);
  const resolved: CategoryMeta[] = [];
  const seen = new Set<string>();

  if (metaKeys.length > 0) {
    const sorted = Object.entries(collectionsMeta).sort(
      (a, b) => (a[1]?.order ?? 999) - (b[1]?.order ?? 999)
    );
    for (const [rawId, meta] of sorted) {
      const id = String(meta?.id || rawId).trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);

      const fallbackDef = DEFAULT_CORE_CATEGORIES.find((d) => d.id === id);
      const underscoreKey = `collection_${id.replace(/-/g, '_')}`;
      const dashKey = `collection_${id}`;
      const mediaImg = siteMedia[underscoreKey] || siteMedia[dashKey] || siteMedia[`category_${id}`];

      const title = String(meta?.title || fallbackDef?.title || formatCategoryName(id)).trim();
      resolved.push({
        id,
        title,
        shortLabel: String(meta?.shortLabel || title).trim(),
        subtitle: String(meta?.subtitle || 'Vitrified Sanitaryware Collection').trim(),
        tagBadge: String(meta?.tagBadge || 'THANGADH DIRECT').trim(),
        description: String(meta?.description || '').trim(),
        coverImage: normalizeImageUrl(meta?.coverImage || mediaImg || fallbackDef?.coverImage || ''),
        order: meta?.order ?? resolved.length + 1
      });
    }
  } else {
    for (const def of DEFAULT_CORE_CATEGORIES) {
      seen.add(def.id);
      const underscoreKey = `collection_${def.id.replace(/-/g, '_')}`;
      const mediaImg = siteMedia[underscoreKey] || siteMedia[`collection_${def.id}`];
      resolved.push({
        id: def.id,
        title: def.title,
        shortLabel: def.shortLabel,
        subtitle: 'Vitrified Sanitaryware Collection',
        tagBadge: 'THANGADH DIRECT',
        description: '',
        coverImage: normalizeImageUrl(mediaImg || def.coverImage),
        order: def.order
      });
    }
  }

  // Include any additional categories referenced by database products
  for (const product of products) {
    const catSlug = String(product.category || '').trim().toLowerCase();
    if (!catSlug || seen.has(catSlug)) continue;
    seen.add(catSlug);
    const title = formatCategoryName(catSlug);
    resolved.push({
      id: catSlug,
      title,
      shortLabel: title,
      subtitle: 'Vitrified Sanitaryware Collection',
      tagBadge: 'THANGADH DIRECT',
      description: '',
      coverImage: normalizeImageUrl(product.imageUrl || ''),
      order: resolved.length + 1
    });
  }

  return resolved.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
}

/**
 * Fetches live collections directly from Firestore (`app_settings/catalog_config`, `cms_products`, `cms_media_company`).
 */
export async function fetchDatabaseCategoriesForSitemap(): Promise<CategoryMeta[]> {
  const bundle = await fetchAllPublicCmsFromCloud();
  return extractCollectionCategoriesFromDatabase(bundle);
}

/**
 * Builds structured URL entries from the provided collection categories + core pages.
 */
export function buildSitemapEntries(
  categories: Pick<CategoryMeta, 'id' | 'title' | 'shortLabel' | 'coverImage' | 'order'>[],
  options: SitemapGenerationOptions = {}
): SitemapUrlEntry[] {
  const origin = sanitizeOrigin(options.origin);
  const lastmod = resolveTodayIsoDate(options.lastmod);

  const coreEntries: SitemapUrlEntry[] = [
    {
      loc: `${origin}/`,
      lastmod,
      changefreq: 'daily',
      priority: '1.0',
      pageType: 'core',
      title: 'Hightone Ceramic Home'
    },
    {
      loc: `${origin}/collections`,
      lastmod,
      changefreq: 'weekly',
      priority: '0.9',
      pageType: 'core',
      title: 'All Sanitaryware Collections'
    },
    {
      loc: `${origin}/b2b`,
      lastmod,
      changefreq: 'weekly',
      priority: '0.9',
      pageType: 'core',
      title: 'B2B Dealership & Wholesale Supply'
    },
    {
      loc: `${origin}/about`,
      lastmod,
      changefreq: 'monthly',
      priority: '0.8',
      pageType: 'core',
      title: 'About Hightone Ceramic Plant'
    },
    {
      loc: `${origin}/blog`,
      lastmod,
      changefreq: 'weekly',
      priority: '0.9',
      pageType: 'core',
      title: 'Blog & Technical Sanitaryware Guides'
    }
  ];

  const seenIds = new Set<string>();
  const sortedCategories = [...categories].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  const collectionEntries: SitemapUrlEntry[] = [];

  for (const cat of sortedCategories) {
    const cleanId = String(cat.id || '').trim();
    if (!cleanId || seenIds.has(cleanId)) continue;
    seenIds.add(cleanId);

    const isFlagship =
      cleanId === 'one-piece' ||
      cleanId === 'wall-hung' ||
      cleanId === 'table-top' ||
      cleanId === 'floor-mount';

    collectionEntries.push({
      loc: `${origin}/collections/${encodeURIComponent(cleanId)}`,
      lastmod,
      changefreq: 'weekly',
      priority: isFlagship ? '0.9' : '0.8',
      pageType: 'collection',
      title: cat.title || cat.shortLabel || formatCategoryName(cleanId),
      categoryId: cleanId,
      imageUrl: `${origin}/og-image/${encodeURIComponent(cleanId)}.jpg`
    });
  }

  const sourcePosts = options.blogPosts !== undefined ? options.blogPosts : STARTER_BLOG_POSTS;
  const seenSlugs = new Set<string>();
  const blogEntries: SitemapUrlEntry[] = [];

  for (const post of sourcePosts) {
    if (!post || post.status !== 'published') continue;
    const cleanSlug = String(post.slug || '').trim().toLowerCase();
    if (!cleanSlug || seenSlugs.has(cleanSlug)) continue;
    seenSlugs.add(cleanSlug);

    blogEntries.push({
      loc: `${origin}/blog/${encodeURIComponent(cleanSlug)}`,
      lastmod: resolveTodayIsoDate(post.updatedAt || post.publishedAt || options.lastmod),
      changefreq: 'monthly',
      priority: post.featured ? '0.8' : '0.7',
      pageType: 'blog',
      title: post.title || cleanSlug,
      categoryId: post.category || 'Blog',
      imageUrl: `${origin}/og-image/blog-${encodeURIComponent(cleanSlug)}.jpg`
    });
  }

  return [...coreEntries, ...collectionEntries, ...blogEntries];
}

/**
 * Generates standards-compliant sitemap.xml string dynamically from collection categories.
 */
export function generateDynamicSitemapXml(
  categories: Pick<CategoryMeta, 'id' | 'title' | 'shortLabel' | 'coverImage' | 'order'>[],
  options: SitemapGenerationOptions = {}
): string {
  const entries = buildSitemapEntries(categories, options);
  const includeImages = options.includeImages ?? true;

  const xmlUrls = entries
    .map((entry) => {
      const imageBlock =
        includeImages && entry.imageUrl
          ? `\n    <image:image>\n      <image:loc>${escapeXml(entry.imageUrl)}</image:loc>\n      <image:title>${escapeXml(
              entry.title
            )}</image:title>\n    </image:image>`
          : '';
      return `  <url>\n    <loc>${escapeXml(entry.loc)}</loc>\n    <lastmod>${entry.lastmod}</lastmod>\n    <changefreq>${
        entry.changefreq
      }</changefreq>\n    <priority>${entry.priority}</priority>${imageBlock}\n  </url>`;
    })
    .join('\n');

  const imageNs = includeImages ? ' xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"' : '';
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"${imageNs}>\n${xmlUrls}\n</urlset>\n`;
}

/**
 * Queries Firestore database live and generates a complete dynamic sitemap XML string.
 */
export async function generateDynamicSitemapFromDatabase(
  options: SitemapGenerationOptions = {}
): Promise<{ xml: string; categories: CategoryMeta[]; entries: SitemapUrlEntry[] }> {
  const bundle = await fetchAllPublicCmsFromCloud();
  const categories = extractCollectionCategoriesFromDatabase(bundle);
  const resolvedOptions: SitemapGenerationOptions = {
    ...options,
    blogPosts: options.blogPosts ?? bundle?.cmsBlog?.posts ?? STARTER_BLOG_POSTS
  };
  const entries = buildSitemapEntries(categories, resolvedOptions);
  const xml = generateDynamicSitemapXml(categories, resolvedOptions);
  return { xml, categories, entries };
}

/**
 * Helper function that builds structured export payloads (XML sitemap, CSV inventory, plain URL list)
 * ready for direct submission to Google Search Console (Sitemaps & URL Inspection).
 */
export function exportForGoogleSearchConsole(
  categories: Pick<CategoryMeta, 'id' | 'title' | 'shortLabel' | 'coverImage' | 'order'>[],
  options: SitemapGenerationOptions = {}
): SearchConsoleExportBundle {
  const origin = sanitizeOrigin(options.origin);
  const entries = buildSitemapEntries(categories, options);
  const xmlContent = generateDynamicSitemapXml(categories, options);

  const csvHeader = ['URL', 'Page Type', 'Title', 'Collection ID', 'Priority', 'Change Frequency', 'Last Modified', 'OG Image URL'];
  const csvRows = entries.map((e) => [
    escapeCsvCell(e.loc),
    escapeCsvCell(e.pageType),
    escapeCsvCell(e.title),
    escapeCsvCell(e.categoryId || ''),
    escapeCsvCell(e.priority),
    escapeCsvCell(e.changefreq),
    escapeCsvCell(e.lastmod),
    escapeCsvCell(e.imageUrl || '')
  ]);

  const csvContent = [csvHeader.join(','), ...csvRows.map((row) => row.join(','))].join('\n');
  const plainUrlList = entries.map((e) => e.loc).join('\n');

  return {
    sitemapEndpointUrl: `${origin}/sitemap.xml`,
    generatedAt: new Date().toISOString(),
    totalUrls: entries.length,
    collectionCount: entries.filter((e) => e.pageType === 'collection').length,
    blogCount: entries.filter((e) => e.pageType === 'blog').length,
    entries,
    xmlContent,
    csvContent,
    plainUrlList
  };
}

/**
 * Fetches live collection categories and blog posts from Firestore and builds the Google Search Console export bundle.
 */
export async function exportDatabaseSitemapForGoogleSearchConsole(
  options: SitemapGenerationOptions = {}
): Promise<SearchConsoleExportBundle> {
  const bundle = await fetchAllPublicCmsFromCloud();
  const categories = extractCollectionCategoriesFromDatabase(bundle);
  const resolvedOptions: SitemapGenerationOptions = {
    ...options,
    blogPosts: options.blogPosts ?? bundle?.cmsBlog?.posts ?? STARTER_BLOG_POSTS
  };
  return exportForGoogleSearchConsole(categories, resolvedOptions);
}

function triggerBrowserFileDownload(content: string, filename: string, mimeType: string): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadDynamicSitemapXml(
  categories: Pick<CategoryMeta, 'id' | 'title' | 'shortLabel' | 'coverImage' | 'order'>[],
  options: SitemapGenerationOptions = {}
): SearchConsoleExportBundle {
  const bundle = exportForGoogleSearchConsole(categories, options);
  triggerBrowserFileDownload(bundle.xmlContent, 'sitemap.xml', 'application/xml;charset=utf-8');
  return bundle;
}

export function downloadGoogleSearchConsoleCsv(
  categories: Pick<CategoryMeta, 'id' | 'title' | 'shortLabel' | 'coverImage' | 'order'>[],
  options: SitemapGenerationOptions = {}
): SearchConsoleExportBundle {
  const bundle = exportForGoogleSearchConsole(categories, options);
  triggerBrowserFileDownload(
    bundle.csvContent,
    'hightone-google-search-console-urls.csv',
    'text/csv;charset=utf-8'
  );
  return bundle;
}
