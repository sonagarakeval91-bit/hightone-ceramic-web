import { escapeHtml, resolveSeoForRoute, SITE_ORIGIN } from './_seoData';

export default async function handler(req: any, res: any) {
  const rawCollection = String(req.query?.collection || req.query?.c || 'one-piece').trim();
  const seo = await resolveSeoForRoute('collections', rawCollection);
  const targetUrl = seo.canonicalUrl || `${SITE_ORIGIN}/collections/one-piece`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');

  res.status(200).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(seo.title)}</title>
  <meta name="description" content="${escapeHtml(seo.description)}">
  <meta name="keywords" content="${escapeHtml(seo.keywords)}">
  <meta name="robots" content="noindex, follow">

  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Hightone Ceramic">
  <meta property="og:locale" content="en_IN">
  <meta property="og:title" content="${escapeHtml(seo.title)}">
  <meta property="og:description" content="${escapeHtml(seo.description)}">
  <meta property="og:image" content="${escapeHtml(seo.image)}">
  <meta property="og:image:secure_url" content="${escapeHtml(seo.image)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${escapeHtml(seo.imageAlt)}">
  <meta property="og:url" content="${escapeHtml(targetUrl)}">

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(seo.title)}">
  <meta name="twitter:description" content="${escapeHtml(seo.description)}">
  <meta name="twitter:image" content="${escapeHtml(seo.image)}">
  <meta name="twitter:image:alt" content="${escapeHtml(seo.imageAlt)}">

  <meta http-equiv="refresh" content="0;url=${escapeHtml(targetUrl)}">
  <link rel="canonical" href="${escapeHtml(targetUrl)}">
</head>
<body style="font-family:sans-serif;text-align:center;padding:60px 20px;color:#0F2E52;background:#f7f9fb;">
  <h2 style="margin-bottom:12px;">Hightone Ceramic</h2>
  <p style="color:#64748b;margin-bottom:24px;">Opening ${escapeHtml(seo.title)}...</p>
  <p><a href="${escapeHtml(targetUrl)}" style="display:inline-block;padding:10px 20px;background:#0F2E52;color:#ffffff;text-decoration:none;border-radius:4px;font-weight:600;">View Collection</a></p>
  <script>
    window.location.replace(${JSON.stringify(targetUrl)});
  </script>
</body>
</html>`);
}
