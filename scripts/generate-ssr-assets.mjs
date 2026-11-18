import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const DIST_INDEX = path.join(DIST_DIR, 'index.html');
const SHELL_OUT = path.join(ROOT_DIR, 'api', '_indexShell.ts');

const FIRESTORE_BASE_URL =
  'https://firestore.googleapis.com/v1/projects/gen-lang-client-0026104580/databases/ai-studio-hightoneceramicv-ac6a3ce5-36fb-4ddb-9665-be67d4140131/documents/app_settings';
const SITE_ORIGIN = 'https://hightoneceramic.com';

const DEFAULT_COLLECTION_IDS = [
  'one-piece',
  'wall-hung',
  'floor-mount',
  'orissa-pan',
  'table-top',
  'pedestal',
  'urinal'
];

function syncBuiltShell() {
  if (!fs.existsSync(DIST_INDEX)) {
    throw new Error(`Expected built HTML at ${DIST_INDEX}`);
  }
  const html = fs.readFileSync(DIST_INDEX, 'utf8');
  const content = `// Auto-generated from dist/index.html during build\nexport const BUILT_INDEX_HTML = ${JSON.stringify(
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
      signal: AbortSignal.timeout(4000)
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
    <meta property="og:image:type" content="image/jpeg" />
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
async function generateStaticSsgPages(shellHtml) {
  const [catalogConfig, seoLegal] = await Promise.all([
    fetchSettingDoc('catalog_config'),
    fetchSettingDoc('cms_seo_legal')
  ]);

  const collectionsMeta = catalogConfig?.collectionsMeta || {};
  const seoMap = seoLegal?.collectionSeoMap || {};
  const ids = Object.keys(collectionsMeta).length > 0 ? Object.keys(collectionsMeta) : DEFAULT_COLLECTION_IDS;

  const targets = [
    {
      outPath: path.join(DIST_DIR, 'collections', 'index.html'),
      title: 'Sanitaryware Collections Catalog | Hightone Ceramic Thangadh',
      description:
        'Browse Hightone Ceramic vitrified sanitaryware collections: One Piece Closets, Wall Hung Toilets, Table Top & Pedestal Basins direct from Thangadh.',
      keywords: 'sanitaryware collections, one piece closet, wall hung toilet, Hightone Ceramic Thangadh',
      url: `${SITE_ORIGIN}/collections`,
      image: `${SITE_ORIGIN}/og-image/collections.jpg`
    },
    {
      outPath: path.join(DIST_DIR, 'b2b', 'index.html'),
      title: 'B2B Dealership & Wholesale Supply | Hightone Ceramic Thangadh',
      description:
        'Partner directly with Hightone Ceramic for authorized sanitaryware distributorships & full-truckload dispatch from Thangadh, Gujarat.',
      keywords: 'sanitaryware dealership India, Hightone Ceramic B2B, wholesale sanitaryware Thangadh',
      url: `${SITE_ORIGIN}/b2b`,
      image: `${SITE_ORIGIN}/og-image/b2b.jpg`
    },
    {
      outPath: path.join(DIST_DIR, 'about', 'index.html'),
      title: 'About Hightone Ceramic | Sanitaryware Plant in Thangadh, Gujarat',
      description:
        'Discover Hightone Ceramic manufacturing plant in Thangadh, Gujarat: continuous tunnel kilns, nano-glaze spraying & ISO quality testing.',
      keywords: 'Hightone Ceramic plant, ceramic sanitaryware factory Thangadh, vitreous china India',
      url: `${SITE_ORIGIN}/about`,
      image: `${SITE_ORIGIN}/og-image/about.jpg`
    }
  ];

  for (const id of ids) {
    const col = collectionsMeta[id] || {};
    const customSeo = seoMap[id] || {};
    const titleName = col.title || formatTitleFromSlug(id);
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
      image: `${SITE_ORIGIN}/og-image/${encodeURIComponent(id)}.jpg`
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
  if (process.argv.includes('--ssg')) {
    await generateStaticSsgPages(shellHtml);
  }
}

main().catch((err) => {
  console.error('[seo-assets] Failed:', err);
  process.exit(1);
});
