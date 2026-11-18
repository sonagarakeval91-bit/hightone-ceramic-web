import { BUILT_INDEX_HTML } from './_indexShell';
import { resolveSeoForRoute, SITE_ORIGIN } from './_seoData';
import { buildSeoHeadMarkup, renderSsrHtmlWithSeo } from './_ssrRenderer';

let cachedRuntimeShell: string | null = null;
let cachedRuntimeShellAt = 0;
const SHELL_TTL_MS = 5 * 60 * 1000;

async function resolveHtmlShell(req: any): Promise<string | null> {
  if (BUILT_INDEX_HTML && BUILT_INDEX_HTML.includes('<div id="root"')) {
    return BUILT_INDEX_HTML;
  }

  const now = Date.now();
  if (cachedRuntimeShell && now - cachedRuntimeShellAt < SHELL_TTL_MS) {
    return cachedRuntimeShell;
  }

  const forwardedHost = req.headers?.['x-forwarded-host'] || req.headers?.host;
  const proto = String(req.headers?.['x-forwarded-proto'] || 'https').split(',')[0].trim();
  const candidates = forwardedHost
    ? [`${proto}://${String(forwardedHost).split(',')[0].trim()}/index.html`, `${SITE_ORIGIN}/index.html`]
    : [`${SITE_ORIGIN}/index.html`];

  for (const url of candidates) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    try {
      const resp = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'text/html' },
        signal: controller.signal
      });
      if (resp.ok) {
        const html = await resp.text();
        if (html.includes('<div id="root"') && html.includes('</head>')) {
          cachedRuntimeShell = html;
          cachedRuntimeShellAt = now;
          return html;
        }
      }
    } catch {
      // Try next candidate
    } finally {
      clearTimeout(timeout);
    }
  }

  return null;
}

export default async function handler(req: any, res: any) {
  const route = String(req.query?.route || 'collections').trim();
  const collection = typeof req.query?.collection === 'string' ? req.query.collection : undefined;

  const [seo, shellHtml] = await Promise.all([
    resolveSeoForRoute(route, collection),
    resolveHtmlShell(req)
  ]);

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');

  if (shellHtml) {
    return res.status(200).send(renderSsrHtmlWithSeo(shellHtml, seo));
  }

  return res.status(200).send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    ${buildSeoHeadMarkup(seo)}
  </head>
  <body>
    ${seo.noscriptHtml}
  </body>
</html>`);
}
