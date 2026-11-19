import { DEFAULT_SERVERLESS_BLOG_POSTS, ServerlessBlogPost } from './_blogDefaults.js';
import {
  buildMergedSeoCollections,
  DEFAULT_COLLECTIONS,
  escapeHtml,
  getLiveCmsSeoSnapshot,
  getPublishedBlogPosts,
  resolveOgImageAsset,
  SITE_ORIGIN
} from './_seoData.js';

function resolveIsoDate(raw?: string, fallback?: string): string {
  const trimmed = String(raw || '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
  return fallback || new Date().toISOString().split('T')[0];
}

export default async function handler(_req: any, res: any) {
  try {
    let collections = DEFAULT_COLLECTIONS;
    let publishedPosts: ServerlessBlogPost[] = DEFAULT_SERVERLESS_BLOG_POSTS.filter(
      (p) => p.status === 'published'
    );

    try {
      const snapshot = await getLiveCmsSeoSnapshot();
      const merged = buildMergedSeoCollections(snapshot);
      if (merged.length > 0) collections = merged;
      const livePosts = getPublishedBlogPosts(snapshot);
      if (livePosts.length > 0) publishedPosts = livePosts;
    } catch {
      // Fallback to defaults if Firestore REST times out
    }

    const today = new Date().toISOString().split('T')[0];

    const staticPages = [
      { loc: `${SITE_ORIGIN}/`, title: 'Hightone Ceramic', lastmod: today, changefreq: 'daily', priority: '1.0', image: '' },
      { loc: `${SITE_ORIGIN}/collections`, title: 'Sanitaryware Collections', lastmod: today, changefreq: 'weekly', priority: '0.9', image: '' },
      { loc: `${SITE_ORIGIN}/blog`, title: 'Sanitaryware Technical Guides & B2B Blog', lastmod: today, changefreq: 'weekly', priority: '0.9', image: resolveOgImageAsset('blog').url },
      { loc: `${SITE_ORIGIN}/b2b`, title: 'B2B Dealership & Wholesale Supply', lastmod: today, changefreq: 'weekly', priority: '0.9', image: '' },
      { loc: `${SITE_ORIGIN}/about`, title: 'About Hightone Ceramic Plant', lastmod: today, changefreq: 'monthly', priority: '0.8', image: '' }
    ];

    const collectionUrls = collections.map((col) => ({
      loc: `${SITE_ORIGIN}/collections/${encodeURIComponent(col.id)}`,
      title: col.title,
      lastmod: today,
      changefreq: 'weekly',
      priority:
        col.id === 'one-piece' || col.id === 'wall-hung' || col.id === 'table-top' || col.id === 'floor-mount'
          ? '0.9'
          : '0.8',
      image: resolveOgImageAsset(col.id).url
    }));

    const blogUrls = publishedPosts.map((post) => ({
      loc: `${SITE_ORIGIN}/blog/${encodeURIComponent(post.slug)}`,
      title: post.title,
      lastmod: resolveIsoDate(post.updatedAt || post.publishedAt, today),
      changefreq: 'monthly',
      priority: post.featured ? '0.8' : '0.7',
      image: resolveOgImageAsset(`blog-${post.slug}`).url
    }));

    const allUrls = [...staticPages, ...collectionUrls, ...blogUrls];

    const xmlEntries = allUrls
      .map((entry) => {
        const imageXml = entry.image
          ? `\n    <image:image>\n      <image:loc>${escapeHtml(entry.image)}</image:loc>\n      <image:title>${escapeHtml(
              entry.title
            )}</image:title>\n    </image:image>`
          : '';
        return `  <url>
    <loc>${escapeHtml(entry.loc)}</loc>
    <lastmod>${entry.lastmod}</lastmod>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>${imageXml}
  </url>`;
      })
      .join('\n');

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');
    return res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${xmlEntries}
</urlset>
`);
  } catch {
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    return res.status(200).send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SITE_ORIGIN}/</loc><priority>1.0</priority></url>
  <url><loc>${SITE_ORIGIN}/collections</loc><priority>0.9</priority></url>
  <url><loc>${SITE_ORIGIN}/blog</loc><priority>0.9</priority></url>
</urlset>`);
  }
}
