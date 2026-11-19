import { escapeHtml, escapeJsonForScript, ResolvedSeoPayload, SITE_ORIGIN } from './_seoData.js';

export function buildSeoHeadMarkup(seo: ResolvedSeoPayload): string {
  const jsonLdScripts = seo.jsonLdList
    .map((obj) => `<script type="application/ld+json">${escapeJsonForScript(obj)}</script>`)
    .join('\n    ');

  return `<title>${escapeHtml(seo.title)}</title>
    <meta name="description" content="${escapeHtml(seo.description)}" />
    <meta name="keywords" content="${escapeHtml(seo.keywords)}" />
    <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
    <link rel="canonical" href="${escapeHtml(seo.canonicalUrl)}" />

    <!-- OpenGraph Metadata (WhatsApp, LinkedIn, Facebook) -->
    <meta property="og:type" content="${escapeHtml(seo.ogType || 'website')}" />
    <meta property="og:site_name" content="Hightone Ceramic" />
    <meta property="og:locale" content="en_IN" />
    <meta property="og:url" content="${escapeHtml(seo.canonicalUrl)}" />
    <meta property="og:title" content="${escapeHtml(seo.title)}" />
    <meta property="og:description" content="${escapeHtml(seo.description)}" />
    <meta property="og:image" content="${escapeHtml(seo.image)}" />
    <meta property="og:image:secure_url" content="${escapeHtml(seo.image)}" />
    <meta property="og:image:type" content="${escapeHtml(seo.imageMime || 'image/jpeg')}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${escapeHtml(seo.imageAlt)}" />
    <meta property="og:logo" content="${SITE_ORIGIN}/favicon.png" />

    <!-- Twitter / X Summary Card -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(seo.title)}" />
    <meta name="twitter:description" content="${escapeHtml(seo.description)}" />
    <meta name="twitter:image" content="${escapeHtml(seo.image)}" />
    <meta name="twitter:image:alt" content="${escapeHtml(seo.imageAlt)}" />

    ${jsonLdScripts}`;
}

/**
 * Strips homepage default SEO/OG/Twitter tags regardless of attribute ordering and injects
 * route-specific tags right at the top of <head> (immediately after viewport meta) so social
 * scrapers like LinkedIn and WhatsApp always resolve the collection image in the first bytes.
 */
export function renderSsrHtmlWithSeo(shellHtml: string, seo: ResolvedSeoPayload): string {
  let cleaned = shellHtml
    .replace(/<title\b[^>]*>[\s\S]*?<\/title>/gi, '')
    .replace(/<meta\b[^>]*\bname=["'](?:description|keywords|robots|twitter:[^"']+)["'][^>]*>/gi, '')
    .replace(/<meta\b[^>]*\bproperty=["']og:[^"']+["'][^>]*>/gi, '')
    .replace(/<link\b[^>]*\brel=["']canonical["'][^>]*>/gi, '')
    .replace(/<script\b[^>]*\btype=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi, '');

  const seoHeadBlock = buildSeoHeadMarkup(seo);

  const viewportTagRegex = /(<meta\b[^>]*\bname=["']viewport["'][^>]*>)/i;
  if (viewportTagRegex.test(cleaned)) {
    cleaned = cleaned.replace(viewportTagRegex, `$1\n    ${seoHeadBlock}`);
  } else if (/<head\b[^>]*>/i.test(cleaned)) {
    cleaned = cleaned.replace(/(<head\b[^>]*>)/i, `$1\n    ${seoHeadBlock}`);
  } else if (cleaned.includes('</head>')) {
    cleaned = cleaned.replace('</head>', `    ${seoHeadBlock}\n  </head>`);
  }

  if (/<div\s+id=["']root["']\s*><\/div>/i.test(cleaned)) {
    cleaned = cleaned.replace(
      /<div\s+id=["']root["']\s*><\/div>/i,
      `<div id="root"></div>\n    <noscript>${seo.noscriptHtml}</noscript>`
    );
  }

  return cleaned;
}
