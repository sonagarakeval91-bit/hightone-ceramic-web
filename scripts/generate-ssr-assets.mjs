import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const DIST_INDEX = path.join(DIST_DIR, 'index.html');
const DIST_OG_DIR = path.join(DIST_DIR, 'og-image');
const SHELL_OUT = path.join(ROOT_DIR, 'api', '_indexShell.ts');
const MANIFEST_OUT = path.join(ROOT_DIR, 'api', '_bakedOgManifest.ts');

const FIRESTORE_BASE_URL =
  'https://firestore.googleapis.com/v1/projects/gen-lang-client-0026104580/databases/ai-studio-hightoneceramicv-ac6a3ce5-36fb-4ddb-9665-be67d4140131/documents/app_settings';
const SITE_ORIGIN = 'https://hightoneceramic.com';
const DEFAULT_OG_IMAGE =
  'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=1200&h=630&q=80';

const DEFAULT_COLLECTION_DEFAULTS = {
  'one-piece':
    'https://images.unsplash.com/photo-1585060544812-6b45742d762f?auto=format&fit=crop&w=1200&h=630&q=80',
  'wall-hung':
    'https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?auto=format&fit=crop&w=1200&h=630&q=80',
  'floor-mount':
    'https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=1200&h=630&q=80',
  'orissa-pan':
    'https://images.unsplash.com/photo-1507652313519-d4e9174996dd?auto=format&fit=crop&w=1200&h=630&q=80',
  'table-top':
    'https://images.unsplash.com/photo-1620626011761-996317b8d101?auto=format&fit=crop&w=1200&h=630&q=80',
  pedestal:
    'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=1200&h=630&q=80',
  urinal:
    'https://images.unsplash.com/photo-1595515106969-1ce29566ff1c?auto=format&fit=crop&w=1200&h=630&q=80'
};

function syncBuiltShell() {
  if (!fs.existsSync(DIST_INDEX)) {
    throw new Error(`Expected built HTML at ${DIST_INDEX}`);
  }
  const html = fs.readFileSync(DIST_INDEX, 'utf8');
  const content = `// Auto-generated from dist/index.html during build\nexport const BUILT_INDEX_HTML: string = ${JSON.stringify(
    html
  )};\n`;
  fs.writeFileSync(SHELL_OUT, content, 'utf8');
  console.log(`[seo-assets] Embedded built shell into ${path.relative(ROOT_DIR, SHELL_OUT)} (${html.length} bytes)`);
  return html;
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatTitleFromSlug(slug) {
  return String(slug || '')
    .replace(/[-_]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function canonicalSlug(raw) {
  return String(raw || '')
    .toLowerCase()
    .trim()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeSourceUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  const lower = trimmed.toLowerCase();
  if (lower.includes('paste') || lower.includes('your image') || trimmed.startsWith('(')) {
    return '';
  }
  if (lower.startsWith('data:image')) return trimmed;
  if (trimmed.startsWith('/')) {
    const localPublic = path.join(ROOT_DIR, 'public', trimmed.slice(1));
    if (fs.existsSync(localPublic)) return `file://${localPublic}`;
    return `${SITE_ORIGIN}${trimmed}`;
  }
  if (!lower.startsWith('http://') && !lower.startsWith('https://')) return '';

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

  return lower.startsWith('http://') ? `https://${trimmed.slice(7)}` : trimmed;
}

function detectMagicImageFormat(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { ext: 'jpg', mime: 'image/jpeg' };
  }
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return { ext: 'png', mime: 'image/png' };
  }
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) {
    return { ext: 'gif', mime: 'image/gif' };
  }
  if (
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  ) {
    return { ext: 'webp', mime: 'image/webp' };
  }
  return null;
}

async function resolveImageBuffer(candidates) {
  for (const rawUrl of candidates) {
    const src = normalizeSourceUrl(rawUrl);
    if (!src) continue;

    // 1. Base64 data URI
    const dataMatch = src.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
    if (dataMatch) {
      const buf = Buffer.from(dataMatch[2], 'base64');
      const fmt = detectMagicImageFormat(buf);
      if (fmt && buf.length > 100) {
        return { buf, ...fmt };
      }
      continue;
    }

    // 2. Local public file
    if (src.startsWith('file://')) {
      try {
        const localPath = src.slice(7);
        const buf = fs.readFileSync(localPath);
        const fmt = detectMagicImageFormat(buf);
        if (fmt && buf.length > 100) {
          return { buf, ...fmt };
        }
      } catch {
        // try next candidate
      }
      continue;
    }

    // 3. Remote HTTPS image (Dropbox, Google Drive, Unsplash, custom CDN)
    try {
      const resp = await fetch(src, {
        method: 'GET',
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; HightoneCeramicAssetBaker/1.0)',
          Accept: 'image/avif,image/webp,image/png,image/jpeg,image/*,*/*;q=0.8'
        },
        signal: AbortSignal.timeout(7000)
      });
      if (!resp.ok) continue;
      const arr = await resp.arrayBuffer();
      const buf = Buffer.from(arr);
      const fmt = detectMagicImageFormat(buf);
      if (fmt && buf.length > 100) {
        return { buf, ...fmt };
      }
    } catch {
      // try next candidate
    }
  }
  return null;
}

function decodeFirestoreVal(val) {
  if (!val || typeof val !== 'object') return undefined;
  if ('stringValue' in val) return val.stringValue ?? '';
  if ('integerValue' in val) return Number(val.integerValue);
  if ('doubleValue' in val) return Number(val.doubleValue);
  if ('booleanValue' in val) return Boolean(val.booleanValue);
  if ('nullValue' in val) return null;
  if ('arrayValue' in val) return (val.arrayValue?.values || []).map(decodeFirestoreVal);
  if ('mapValue' in val) {
    const out = {};
    for (const [k, v] of Object.entries(val.mapValue?.fields || {})) {
      out[k] = decodeFirestoreVal(v);
    }
    return out;
  }
  return undefined;
}

async function fetchSettingDoc(docId) {
  try {
    const resp = await fetch(`${FIRESTORE_BASE_URL}/${encodeURIComponent(docId)}`, {
      signal: AbortSignal.timeout(4500)
    });
    if (!resp.ok) return null;
    const json = await resp.json();
    if (!json?.fields) return null;
    const out = {};
    for (const [k, v] of Object.entries(json.fields)) {
      out[k] = decodeFirestoreVal(v);
    }
    return out;
  } catch {
    return null;
  }
}

async function fetchLiveCmsDocs() {
  const [catalogConfig, seoLegal, mediaCompany, cmsProducts] = await Promise.all([
    fetchSettingDoc('catalog_config'),
    fetchSettingDoc('cms_seo_legal'),
    fetchSettingDoc('cms_media_company'),
    fetchSettingDoc('cms_products')
  ]);
  return { catalogConfig, seoLegal, mediaCompany, cmsProducts };
}

/**
 * Downloads all live collection cover photos ONCE during build and saves verified static
 * JPEG/PNG/WebP images directly into dist/og-image/<slug>.<ext> (served on Vercel Edge CDN),
 * emitting api/_bakedOgManifest.ts for cache-busted, type-accurate OpenGraph tags.
 */
async function bakeCollectionOgImages(cms) {
  if (process.argv.includes('--skip-og-bake')) {
    return {};
  }

  const collectionsMeta = cms.catalogConfig?.collectionsMeta || {};
  const seoMap = cms.seoLegal?.collectionSeoMap || {};
  const siteMedia = cms.mediaCompany?.siteMedia || {};
  const products = Array.isArray(cms.cmsProducts?.products) ? cms.cmsProducts.products : [];
  const heroFallback = siteMedia.hero_lifestyle || DEFAULT_OG_IMAGE;

  const jobs = [];
  const seenKeys = new Set();

  const addJob = (key, candidateList) => {
    const cleanKey = String(key || '').trim();
    if (!cleanKey || seenKeys.has(cleanKey)) return;
    seenKeys.add(cleanKey);
    jobs.push({ key: cleanKey, candidates: candidateList.filter(Boolean) });
  };

  // All configured collections from catalog_config or default 7
  const metaKeys = Object.keys(collectionsMeta);
  const collectionIds =
    metaKeys.length > 0 ? metaKeys : Object.keys(DEFAULT_COLLECTION_DEFAULTS);

  for (const rawId of collectionIds) {
    const col = collectionsMeta[rawId] || {};
    const id = String(col.id || rawId).trim();
    const override = seoMap[id] || seoMap[rawId] || {};
    const underscoreKey = `collection_${id.replace(/-/g, '_')}`;
    const dashKey = `collection_${id}`;
    const categoryKey = `category_${id}`;
    const mediaCover = siteMedia[underscoreKey] || siteMedia[dashKey] || siteMedia[categoryKey];
    const firstProdImg = products.find(
      (p) => canonicalSlug(p?.category) === canonicalSlug(id) && p?.imageUrl
    )?.imageUrl;

    addJob(id, [
      override.ogImage,
      col.seoImage,
      col.coverImage,
      mediaCover,
      firstProdImg,
      DEFAULT_COLLECTION_DEFAULTS[id],
      heroFallback,
      DEFAULT_OG_IMAGE
    ]);
  }

  // Extra categories derived only from products
  for (const prod of products) {
    const slug = canonicalSlug(prod?.category);
    if (slug && !seenKeys.has(slug)) {
      addJob(slug, [prod.imageUrl, heroFallback, DEFAULT_OG_IMAGE]);
    }
  }

  // Core routes (collections directory, b2b, about)
  const firstColUrl = jobs[0]?.candidates[0];
  addJob('collections', [firstColUrl, heroFallback, DEFAULT_OG_IMAGE]);
  addJob('b2b', [siteMedia.dispatch_loading, heroFallback, DEFAULT_OG_IMAGE]);
  addJob('about', [siteMedia.tunnel_kiln, heroFallback, DEFAULT_OG_IMAGE]);

  fs.mkdirSync(DIST_OG_DIR, { recursive: true });
  const manifest = {};

  // Process downloads in batches of 6 to keep build fast without overwhelming upstream hosts
  const BATCH_SIZE = 6;
  for (let i = 0; i < jobs.length; i += BATCH_SIZE) {
    const batch = jobs.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async (job) => {
        const img = await resolveImageBuffer(job.candidates);
        return { key: job.key, img };
      })
    );
    for (const { key, img } of results) {
      if (!img) continue;
      const safeFileKey = key.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();
      const filename = `${safeFileKey}.${img.ext}`;
      const outPath = path.join(DIST_OG_DIR, filename);
      fs.writeFileSync(outPath, img.buf);
      const hash = crypto.createHash('sha256').update(img.buf).digest('hex').slice(0, 8);
      manifest[key.toLowerCase()] = {
        path: `/og-image/${filename}`,
        mime: img.mime,
        hash,
        bytes: img.buf.length
      };
    }
  }

  const manifestFile = `export interface BakedOgImageEntry {\n  path: string;\n  mime: string;\n  hash: string;\n  bytes: number;\n}\n\n// Auto-generated during build by scripts/generate-ssr-assets.mjs\nexport const BAKED_OG_MANIFEST: Record<string, BakedOgImageEntry> = ${JSON.stringify(
    manifest,
    null,
    2
  )};\n`;
  fs.writeFileSync(MANIFEST_OUT, manifestFile, 'utf8');
  console.log(
    `[seo-assets] Baked ${Object.keys(manifest).length}/${jobs.length} static OpenGraph images onto dist/og-image/`
  );
  return manifest;
}

function renderStaticRouteHtml(shellHtml, meta) {
  let cleaned = shellHtml
    .replace(/<title\b[^>]*>[\s\S]*?<\/title>/gi, '')
    .replace(/<meta\b[^>]*\bname=["'](?:description|keywords|robots|twitter:[^"']+)["'][^>]*>/gi, '')
    .replace(/<meta\b[^>]*\bproperty=["']og:[^"']+["'][^>]*>/gi, '')
    .replace(/<link\b[^>]*\brel=["']canonical["'][^>]*>/gi, '')
    .replace(/<script\b[^>]*\btype=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi, '');

  const headTags = `<title>${escapeHtml(meta.title)}</title>
    <meta name="description" content="${escapeHtml(meta.description)}" />
    <meta name="keywords" content="${escapeHtml(meta.keywords)}" />
    <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
    <link rel="canonical" href="${escapeHtml(meta.url)}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Hightone Ceramic" />
    <meta property="og:locale" content="en_IN" />
    <meta property="og:url" content="${escapeHtml(meta.url)}" />
    <meta property="og:title" content="${escapeHtml(meta.title)}" />
    <meta property="og:description" content="${escapeHtml(meta.description)}" />
    <meta property="og:image" content="${escapeHtml(meta.image)}" />
    <meta property="og:image:secure_url" content="${escapeHtml(meta.image)}" />
    <meta property="og:image:type" content="${escapeHtml(meta.imageMime || 'image/jpeg')}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(meta.title)}" />
    <meta name="twitter:description" content="${escapeHtml(meta.description)}" />
    <meta name="twitter:image" content="${escapeHtml(meta.image)}" />`;

  cleaned = cleaned.replace(/(<meta\b[^>]*\bname=["']viewport["'][^>]*>)/i, `$1\n    ${headTags}`);
  cleaned = cleaned.replace(
    /<div\s+id=["']root["']\s*><\/div>/i,
    `<div id="root"></div>\n    <noscript><main><h1>${escapeHtml(meta.title)}</h1><p>${escapeHtml(
      meta.description
    )}</p></main></noscript>`
  );
  return cleaned;
}

/**
 * Optional Static Site Generation helper (`node scripts/generate-ssr-assets.mjs --ssg`)
 * that writes pre-rendered static HTML files into dist/ for static-only hosts.
 */
async function generateStaticSsgPages(shellHtml, cms, manifest) {
  const collectionsMeta = cms.catalogConfig?.collectionsMeta || {};
  const seoMap = cms.seoLegal?.collectionSeoMap || {};
  const ids =
    Object.keys(collectionsMeta).length > 0
      ? Object.keys(collectionsMeta)
      : Object.keys(DEFAULT_COLLECTION_DEFAULTS);

  const imageForKey = (key) => {
    const entry = manifest[String(key).toLowerCase()];
    if (entry && entry.path) {
      return { url: `${SITE_ORIGIN}${entry.path}?v=${entry.hash}`, mime: entry.mime };
    }
    return { url: `${SITE_ORIGIN}/og-image/${encodeURIComponent(key)}.jpg`, mime: 'image/jpeg' };
  };

  const targets = [
    {
      outPath: path.join(DIST_DIR, 'collections', 'index.html'),
      title: 'Sanitaryware Collections Catalog | Hightone Ceramic Thangadh',
      description:
        'Browse Hightone Ceramic vitrified sanitaryware collections: One Piece Closets, Wall Hung Toilets, Table Top & Pedestal Basins direct from Thangadh.',
      keywords: 'sanitaryware collections, one piece closet, wall hung toilet, Hightone Ceramic Thangadh',
      url: `${SITE_ORIGIN}/collections`,
      image: imageForKey('collections').url,
      imageMime: imageForKey('collections').mime
    },
    {
      outPath: path.join(DIST_DIR, 'b2b', 'index.html'),
      title: 'B2B Dealership & Wholesale Supply | Hightone Ceramic Thangadh',
      description:
        'Partner directly with Hightone Ceramic for authorized sanitaryware distributorships & full-truckload dispatch from Thangadh, Gujarat.',
      keywords: 'sanitaryware dealership India, Hightone Ceramic B2B, wholesale sanitaryware Thangadh',
      url: `${SITE_ORIGIN}/b2b`,
      image: imageForKey('b2b').url,
      imageMime: imageForKey('b2b').mime
    },
    {
      outPath: path.join(DIST_DIR, 'about', 'index.html'),
      title: 'About Hightone Ceramic | Sanitaryware Plant in Thangadh, Gujarat',
      description:
        'Discover Hightone Ceramic manufacturing plant in Thangadh, Gujarat: continuous tunnel kilns, nano-glaze spraying & ISO quality testing.',
      keywords: 'Hightone Ceramic plant, ceramic sanitaryware factory Thangadh, vitreous china India',
      url: `${SITE_ORIGIN}/about`,
      image: imageForKey('about').url,
      imageMime: imageForKey('about').mime
    }
  ];

  for (const id of ids) {
    const col = collectionsMeta[id] || {};
    const customSeo = seoMap[id] || {};
    const titleName = col.title || formatTitleFromSlug(id);
    const imgInfo = imageForKey(id);
    targets.push({
      outPath: path.join(DIST_DIR, 'collections', id, 'index.html'),
      title: customSeo.title || col.seoTitle || `${titleName} Manufacturer & Wholesale | Hightone Ceramic`,
      description:
        customSeo.description ||
        col.seoDescription ||
        col.description ||
        `Factory-direct vitrified ceramic ${titleName.toLowerCase()} manufacturer in Thangadh, Gujarat.`,
      keywords: customSeo.keywords || col.seoKeywords || `${titleName.toLowerCase()}, Hightone Ceramic Thangadh`,
      url: `${SITE_ORIGIN}/collections/${id}`,
      image: imgInfo.url,
      imageMime: imgInfo.mime
    });
  }

  for (const page of targets) {
    fs.mkdirSync(path.dirname(page.outPath), { recursive: true });
    fs.writeFileSync(page.outPath, renderStaticRouteHtml(shellHtml, page), 'utf8');
  }
  console.log(`[seo-assets] Generated ${targets.length} SSG route HTML files under dist/`);
}

async function main() {
  const shellHtml = syncBuiltShell();
  const cms = await fetchLiveCmsDocs();
  const manifest = await bakeCollectionOgImages(cms);
  if (process.argv.includes('--ssg')) {
    await generateStaticSsgPages(shellHtml, cms, manifest);
  }
}

main().catch((err) => {
  console.error('[seo-assets] Failed:', err);
  process.exit(1);
});
