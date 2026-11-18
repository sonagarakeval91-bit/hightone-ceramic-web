import { buildMergedSeoCollections, escapeHtml, getLiveCmsSeoSnapshot, SITE_ORIGIN } from './_seoData';

export default async function handler(_req: any, res: any) {
  const snapshot = await getLiveCmsSeoSnapshot();
  const collections = buildMergedSeoCollections(snapshot);
  const today = new Date().toISOString().split('T')[0];

  const staticPages = [
    { loc: `${SITE_ORIGIN}/`, title: 'Hightone Ceramic', changefreq: 'daily', priority: '1.0', image: '' },
    { loc: `${SITE_ORIGIN}/collections`, title: 'Sanitaryware Collections', changefreq: 'weekly', priority: '0.9', image: '' },
    { loc: `${SITE_ORIGIN}/b2b`, title: 'B2B Dealership & Wholesale Supply', changefreq: 'weekly', priority: '0.9', image: '' },
    { loc: `${SITE_ORIGIN}/about`, title: 'About Hightone Ceramic Plant', changefreq: 'monthly', priority: '0.8', image: '' }
  ];

  const collectionUrls = collections.map((col) => ({
    loc: `${SITE_ORIGIN}/collections/${encodeURIComponent(col.id)}`,
    title: col.title,
    changefreq: 'weekly',
    priority:
      col.id === 'one-piece' || col.id === 'wall-hung' || col.id === 'table-top' || col.id === 'floor-mount'
        ? '0.9'
        : '0.8',
    image: `${SITE_ORIGIN}/og-image/${encodeURIComponent(col.id)}.jpg`
  }));

  const allUrls = [...staticPages, ...collectionUrls];

  const xmlEntries = allUrls
    .map((entry) => {
      const imageXml = entry.image
        ? `\n    <image:image>\n      <image:loc>${escapeHtml(entry.image)}</image:loc>\n      <image:title>${escapeHtml(
            entry.title
          )}</image:title>\n    </image:image>`
        : '';
      return `  <url>
    <loc>${escapeHtml(entry.loc)}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>${imageXml}
  </url>`;
    })
    .join('\n');

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');
  res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${xmlEntries}
</urlset>
`);
}
