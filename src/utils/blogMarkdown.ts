import { CategoryMeta } from '../types';
import { SiteMediaMap, normalizeImageUrl } from '../services/googleSheetsService';

export interface BlogHeadingTocItem {
  id: string;
  text: string;
  level: 2 | 3;
}

export type BlogContentBlock =
  | { type: 'h2'; id: string; text: string }
  | { type: 'h3'; id: string; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'quote'; text: string }
  | { type: 'table'; headers: string[]; rows: string[][] }
  | { type: 'image'; alt: string; url: string };

function slugifyHeading(text: string): string {
  return String(text || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'section';
}

export function parseBlogMarkdown(markdown: string): {
  blocks: BlogContentBlock[];
  headings: BlogHeadingTocItem[];
} {
  const lines = String(markdown || '').replace(/\r\n/g, '\n').split('\n');
  const blocks: BlogContentBlock[] = [];
  const headings: BlogHeadingTocItem[] = [];
  const usedIds = new Map<string, number>();

  const uniqueHeadingId = (text: string): string => {
    const base = slugifyHeading(text);
    const count = usedIds.get(base) || 0;
    usedIds.set(base, count + 1);
    return count === 0 ? base : `${base}-${count + 1}`;
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();

    if (!line) {
      i++;
      continue;
    }

    // H2 heading
    if (line.startsWith('## ')) {
      const text = line.slice(3).trim();
      const id = uniqueHeadingId(text);
      blocks.push({ type: 'h2', id, text });
      headings.push({ id, text, level: 2 });
      i++;
      continue;
    }

    // H3 heading
    if (line.startsWith('### ')) {
      const text = line.slice(4).trim();
      const id = uniqueHeadingId(text);
      blocks.push({ type: 'h3', id, text });
      headings.push({ id, text, level: 3 });
      i++;
      continue;
    }

    // Inline Markdown image: ![Alt caption](url)
    const imgMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imgMatch) {
      const alt = (imgMatch[1] || '').trim();
      const rawUrl = (imgMatch[2] || '').trim();
      const normalized = normalizeImageUrl(rawUrl) || rawUrl;
      if (normalized) {
        blocks.push({ type: 'image', alt, url: normalized });
      }
      i++;
      continue;
    }

    // Blockquote / Pull quote
    if (line.startsWith('> ')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('> ')) {
        quoteLines.push(lines[i].trim().slice(2).trim());
        i++;
      }
      blocks.push({ type: 'quote', text: quoteLines.join(' ') });
      continue;
    }

    // Markdown table
    if (line.startsWith('|') && i + 1 < lines.length && lines[i + 1].trim().startsWith('|')) {
      const splitCells = (rowLine: string) =>
        rowLine
          .trim()
          .replace(/^\|/, '')
          .replace(/\|$/, '')
          .split('|')
          .map((cell) => cell.trim());

      const headers = splitCells(line);
      const separatorRow = lines[i + 1].trim();
      const isSeparator = /^\|?[\s:-]+(?:\|[\s:-]+)+\|?$/.test(separatorRow);

      if (isSeparator) {
        i += 2;
        const rows: string[][] = [];
        while (i < lines.length && lines[i].trim().startsWith('|')) {
          rows.push(splitCells(lines[i]));
          i++;
        }
        blocks.push({ type: 'table', headers, rows });
        continue;
      }
    }

    // Unordered list
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, '').trim());
        i++;
      }
      blocks.push({ type: 'ul', items });
      continue;
    }

    // Ordered list
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s+/, '').trim());
        i++;
      }
      blocks.push({ type: 'ol', items });
      continue;
    }

    // Standard paragraph (join consecutive plain lines)
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].trim().startsWith('## ') &&
      !lines[i].trim().startsWith('### ') &&
      !lines[i].trim().startsWith('> ') &&
      !lines[i].trim().startsWith('|') &&
      !/^!\[[^\]]*\]\([^)]+\)$/.test(lines[i].trim()) &&
      !/^[-*]\s+/.test(lines[i].trim()) &&
      !/^\d+\.\s+/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i].trim());
      i++;
    }
    if (paraLines.length > 0) {
      blocks.push({ type: 'paragraph', text: paraLines.join(' ') });
    }
  }

  return { blocks, headings };
}

/**
 * Resolves a blog post's cover image to a live browser-renderable URL.
 * When a starter post references `/og-image/<key>.jpg`, this also maps `<key>` to
 * the live CMS collection/factory cover URL so images always load reliably both in
 * Vite dev preview and on Vercel production Edge CDN.
 */
export function resolveBlogCoverImage(
  rawCoverImage: string | undefined,
  categories: CategoryMeta[],
  siteMedia: SiteMediaMap
): { primarySrc: string; fallbackSrc: string } {
  const heroFallback =
    normalizeImageUrl(siteMedia?.hero_lifestyle || '') ||
    normalizeImageUrl(categories[0]?.coverImage || '') ||
    'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=1200&h=630&q=80';

  const trimmed = String(rawCoverImage || '').trim();
  if (!trimmed) {
    return { primarySrc: heroFallback, fallbackSrc: heroFallback };
  }

  const ogMatch = trimmed.match(/^\/og-image\/([a-z0-9_-]+)\.(?:jpe?g|png|webp)$/i);
  if (ogMatch) {
    const key = ogMatch[1].toLowerCase();
    let liveSrc = '';
    if (key === 'b2b') {
      liveSrc = normalizeImageUrl(siteMedia?.dispatch_loading || '') || heroFallback;
    } else if (key === 'about') {
      liveSrc = normalizeImageUrl(siteMedia?.tunnel_kiln || '') || heroFallback;
    } else if (key === 'collections') {
      liveSrc = normalizeImageUrl(categories[0]?.coverImage || '') || heroFallback;
    } else {
      const cat = categories.find(
        (c) => c.id.toLowerCase() === key || c.id.toLowerCase().replace(/-/g, '') === key.replace(/-/g, '')
      );
      liveSrc = normalizeImageUrl(cat?.coverImage || '') || heroFallback;
    }
    // Prefer live CMS image in browser (guaranteed in dev + prod) and fallback cleanly
    return { primarySrc: liveSrc || trimmed, fallbackSrc: heroFallback };
  }

  const normalized = normalizeImageUrl(trimmed);
  return {
    primarySrc: normalized || heroFallback,
    fallbackSrc: heroFallback
  };
}
