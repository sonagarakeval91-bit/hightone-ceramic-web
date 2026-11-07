import { ProductItem, ProductCategory, CategoryMeta } from '../types';
import { PRODUCTS_CATALOG, WHOLESALE_FAQS } from '../data/products';
import { normalizeImageUrl } from '../utils/imageUrl';
export { normalizeImageUrl };

export interface SiteMediaMap {
  logo: string;
  tunnel_kiln: string;
  dispatch_loading: string;
  hero_lifestyle: string;
  slip_casting: string;
  pressure_casting: string;
  [key: string]: string;
}

export interface CompanyInfoMap {
  brand_name: string;
  location: string;
  factory_address: string;
  primary_phone: string;
  secondary_phone: string;
  dispatch_type: string;
  kiln_type: string;
  google_maps_embed_url: string;
  google_maps_url: string;
  [key: string]: string;
}

export interface SheetAdminCredentials {
  userId: string;
  password: string;
}

export const DEFAULT_SITE_MEDIA: SiteMediaMap = {
  logo: 'https://dl.dropboxusercontent.com/scl/fi/ulvbbvuzdshuuf9kaq99g/HIGHTONE_CAT-45.png?rlkey=5vu5e8hjanb9409gf08kc4axs&st=hqqtaqnj',
  logo_stacked: 'https://dl.dropboxusercontent.com/scl/fi/dgqdobhs7gpne9qpoeiz5/HIGHTONE_CAT-43.png?rlkey=522cs8k86v8iih0mm8d7968jw&st=lp9ipd1v',
  logo_symbol: 'https://dl.dropboxusercontent.com/scl/fi/gorjw2njqo63kmz0w8sdn/HIGHTONE_CAT-45-1.png?rlkey=nqytbdg856r18v7avlwblgalx&st=7xt8hy0a',
  tunnel_kiln: 'https://dl.dropboxusercontent.com/scl/fi/zp36kxmzcqpgc96fts7xb/HIGHTONE_CAT-3.jpeg?rlkey=p1xllkt5sajfgsw7onjmuwwzk&st=1eri3pan',
  dispatch_loading: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80',
  hero_lifestyle: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=1200&q=80',
  slip_casting: 'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=800&q=80',
  pressure_casting: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=800&q=80'
};

export const DEFAULT_COMPANY_INFO: CompanyInfoMap = {
  brand_name: 'HIGHTONE CERAMIC',
  location: 'Thangadh, Saurashtra, Gujarat, India',
  factory_address: 'Vagadiya Road, Thangadh - 363 530 (Dist. Surendranagar, Gujarat)',
  primary_phone: '8141200924',
  secondary_phone: '7600341434',
  dispatch_type: 'Road Despatch (Full Truckload FTL and Road Freight)',
  kiln_type: 'Continuous Ceramic Tunnel Kiln • ~1,200°C Vitrification',
  google_maps_embed_url: 'https://www.google.com/maps/embed?pb=!1m14!1m12!1m3!1d651.2937659157873!2d71.2075011373969!3d22.568856666104217!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!5e0!3m2!1sen!2sin!4v1793547180400!5m2!1sen!2sin',
  google_maps_url: 'https://www.google.com/maps/place/Hightone+Ceramic/@22.568706,71.2054457,17z'
};

/**
 * Sanitizes, validates, and extracts the Google Maps embed URL.
 * Supports:
 * - Full `<iframe src="..." ...></iframe>` HTML code pasted directly from Google Maps
 * - Direct embed URLs (e.g. `/maps/embed?pb=...` or `output=embed`)
 * - Google Maps share/search/place links (converts them to clean iframe embeds)
 * - Coordinates (e.g. "22.5688, 71.2075")
 */
export function extractCoordinates(embedUrlOrMapsUrl?: string | null): { lat: string; lng: string } | null {
  if (!embedUrlOrMapsUrl) return null;
  const str = embedUrlOrMapsUrl.trim();

  // 1. Check pb=!1m... format (!2d<lng>!3d<lat>) - Note: in pb strings, 2d is longitude, 3d is latitude
  const pbMatch = str.match(/!2d(-?\d+(?:\.\d+)?)!3d(-?\d+(?:\.\d+)?)/);
  if (pbMatch) {
    return { lat: pbMatch[2], lng: pbMatch[1] };
  }

  // 2. Check /@lat,lng format
  const atMatch = str.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (atMatch) {
    return { lat: atMatch[1], lng: atMatch[2] };
  }

  // 3. Check q=lat,lng or destination=lat,lng format
  const qCoordMatch = str.match(/[?&](?:q|destination)=(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)/);
  if (qCoordMatch) {
    return { lat: qCoordMatch[1], lng: qCoordMatch[2] };
  }

  // 4. Raw coordinate string: "22.5688, 71.2075"
  const rawCoordMatch = str.match(/^(-?\d{1,2}(?:\.\d+)?)[,\s]+(-?\d{1,3}(?:\.\d+)?)$/);
  if (rawCoordMatch) {
    return { lat: rawCoordMatch[1], lng: rawCoordMatch[2] };
  }

  return null;
}

/**
 * Returns a high-precision Google Maps directions URL that routes directly to Hightone Ceramic.
 * Uses exact coordinates so Google Maps never defaults or misroutes to nearby factories like Choice Ceramic.
 */
export function getGoogleMapsDirectionsUrl(companyInfo?: Partial<CompanyInfoMap>): string {
  // Check user's embed URL first (contains the high-precision 22.5688567, 71.2075011 rooftop coordinates)
  const coordsFromEmbed = extractCoordinates(companyInfo?.google_maps_embed_url);
  if (coordsFromEmbed) {
    return `https://www.google.com/maps/dir/?api=1&destination=${coordsFromEmbed.lat},${coordsFromEmbed.lng}`;
  }

  // Next check place / map URL
  const coordsFromMapsUrl = extractCoordinates(companyInfo?.google_maps_url);
  if (coordsFromMapsUrl) {
    return `https://www.google.com/maps/dir/?api=1&destination=${coordsFromMapsUrl.lat},${coordsFromMapsUrl.lng}`;
  }

  // Fallback to exact Hightone Ceramic factory coordinates
  return 'https://www.google.com/maps/dir/?api=1&destination=22.5688567,71.2075011';
}

export function cleanGoogleMapsEmbedUrl(input: string | undefined | null): string {
  if (!input) return '';
  let str = input.trim();

  // If user pasted full <iframe ... src="..." ...> tag
  const srcMatch = str.match(/src=["']([^"']+)["']/i);
  if (srcMatch && srcMatch[1]) {
    str = srcMatch[1].trim();
  }

  // Strip wrapping single or double quotes
  str = str.replace(/^["']|["']$/g, '').trim();

  // Decode common HTML entities like &amp;
  str = str.replace(/&amp;/g, '&');

  // If it's already a valid embed URL with output=embed or /maps/embed
  if (str.includes('output=embed') || str.includes('/maps/embed')) {
    if (str.startsWith('http://') || str.startsWith('https://')) {
      return str;
    }
  }

  // If user pasted a Google Maps place/search URL like https://www.google.com/maps/place/... or https://maps.google.com/?q=...
  if (str.includes('google.com/maps') || str.includes('maps.google.com')) {
    // If it has a ?q= parameter, extract it
    const qMatch = str.match(/[?&]q=([^&]+)/);
    if (qMatch && qMatch[1]) {
      const query = decodeURIComponent(qMatch[1]);
      return `https://maps.google.com/maps?q=${encodeURIComponent(query)}&t=&z=16&ie=UTF8&iwloc=&output=embed`;
    }

    // If it is a /place/Name/@lat,lng URL
    const placeMatch = str.match(/\/place\/([^/@]+)/);
    if (placeMatch && placeMatch[1]) {
      const placeName = decodeURIComponent(placeMatch[1].replace(/\+/g, ' '));
      return `https://maps.google.com/maps?q=${encodeURIComponent(placeName)}&t=&z=16&ie=UTF8&iwloc=&output=embed`;
    }
  }

  // If user entered coordinates like "22.5742, 71.1994"
  const coordMatch = str.match(/^(-?\d+(\.\d+)?)\s*,\s*(-?\d+(\.\d+)?)$/);
  if (coordMatch) {
    return `https://maps.google.com/maps?q=${coordMatch[1]},${coordMatch[3]}+(Hightone+Ceramic)&t=&z=16&ie=UTF8&iwloc=&output=embed`;
  }

  // If it's an address text without protocol (e.g. "Hightone Ceramic, Vagadiya Road, Thangadh")
  if (!str.startsWith('http://') && !str.startsWith('https://') && str.length > 5) {
    return `https://maps.google.com/maps?q=${encodeURIComponent(str)}&t=&z=16&ie=UTF8&iwloc=&output=embed`;
  }

  if (!str.startsWith('http://') && !str.startsWith('https://')) {
    return '';
  }

  return str;
}

/**
 * Extracts a Google Sheet ID from a full URL or returns the clean ID.
 */
export function extractGoogleSheetId(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  // If it's already just the ID (alphanumeric and dashes/underscores)
  if (/^[a-zA-Z0-9-_]{20,60}$/.test(trimmed)) {
    return trimmed;
  }
  // Try matching /d/{id}/
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  return null;
}

/**
 * Parses CSV text safely handling quotes, commas, and linebreaks.
 */
function parseCSV(csvText: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let insideQuote = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"') {
      if (insideQuote && nextChar === '"') {
        currentCell += '"';
        i++; // skip next quote
      } else {
        insideQuote = !insideQuote;
      }
    } else if (char === ',' && !insideQuote) {
      currentRow.push(currentCell.trim());
      currentCell = '';
    } else if ((char === '\r' || char === '\n') && !insideQuote) {
      if (char === '\r' && nextChar === '\n') {
        i++; // skip \n
      }
      currentRow.push(currentCell.trim());
      if (currentRow.some((c) => c !== '')) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = '';
    } else {
      currentCell += char;
    }
  }

  if (currentCell || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some((c) => c !== '')) {
      rows.push(currentRow);
    }
  }

  return rows;
}

/**
 * Fetches a single sheet tab as CSV using Google Visualization API.
 */
async function fetchSheetTab(sheetId: string, tabName: string): Promise<string[][]> {
  const res = await fetchSheetTabWithRaw(sheetId, tabName);
  return res.rows;
}

/**
 * Fetches sheet tab and returns raw CSV text + parsed rows.
 */
async function fetchSheetTabWithRaw(sheetId: string, tabName?: string): Promise<{ text: string; rows: string[][] }> {
  const url = tabName
    ? `https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheetId)}/gviz/tq?tqx=out:csv&headers=1&sheet=${encodeURIComponent(tabName)}`
    : `https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheetId)}/gviz/tq?tqx=out:csv&headers=1`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch tab "${tabName || 'default'}". Status: ${response.status}`);
  }
  const text = await response.text();
  if (text.includes('<!DOCTYPE html>') || text.includes('google-site-verification')) {
    throw new Error(`Google Sheet is not publicly viewable. Please set "Share -> Anyone with the link can view".`);
  }
  return { text, rows: parseCSV(text) };
}

/**
 * Accurately scores whether candidate sheet rows represent a Collections / Categories table.
 * Rejects SiteMedia, CompanyInfo, FAQs, full Products catalog, and Legal tabs.
 */
function scoreCollectionsTab(rows: string[][]): number {
  if (!rows || rows.length < 2) return -100;

  const header = rows[0].map((h) => (h || '').toLowerCase().trim().replace(/[\s_-]+/g, ''));
  const headerStr = header.join(' ');

  // Reject tabs that clearly belong to other domain models
  const isSiteMedia = header.includes('key') && (header.includes('imageurl') || header.includes('url'));
  if (isSiteMedia) return -100;

  const isCompanyInfo = header.includes('key') && header.includes('value');
  if (isCompanyInfo) return -100;

  const isFaqs = header.includes('question') && header.includes('answer');
  if (isFaqs) return -100;

  const isFullProducts = (
    (headerStr.includes('trap') || headerStr.includes('flush')) &&
    (headerStr.includes('dimension') || headerStr.includes('absorption') || headerStr.includes('moq'))
  );
  if (isFullProducts) return -100;

  const isLegal = (
    (headerStr.includes('section') || headerStr.includes('policy') || headerStr.includes('privacy') || headerStr.includes('terms')) &&
    (headerStr.includes('heading') || headerStr.includes('body'))
  );
  if (isLegal) return -100;

  let score = 0;

  // Positive score for collection-specific column headers
  if (header.some(h => ['category', 'collection', 'collecion', 'categories', 'collections'].includes(h))) score += 40;
  if (header.some(h => ['categoryname', 'collectionname', 'categorytitle', 'collectiontitle'].includes(h))) score += 45;
  if (header.some(h => ['title', 'name', 'heading'].includes(h))) score += 15;
  if (header.some(h => ['shortlabel', 'buttonlabel', 'button', 'viewbutton'].includes(h))) score += 20;
  if (header.some(h => ['imageurl', 'coverimage', 'image', 'photo', 'picture'].includes(h))) score += 15;
  if (header.some(h => ['subtitle', 'subheading', 'tagline'].includes(h))) score += 10;
  if (header.some(h => ['tagbadge', 'badge', 'tag'].includes(h))) score += 10;
  if (header.some(h => ['home', 'showonhome', 'order', 'homeorder'].includes(h))) score += 15;

  // Check data rows for sanitaryware keywords
  const sanitaryKeywords = [
    'closet', 'basin', 'pan', 'urinal', 'piece', 'hung', 'mount', 'vanity',
    'pedestal', 'toilet', 'sanitary', 'table', 'orissa', 'siphonic', 'ceramic', 'collection'
  ];
  let matchedRows = 0;
  for (let r = 1; r < rows.length; r++) {
    const rowStr = rows[r].join(' ').toLowerCase();
    if (sanitaryKeywords.some(kw => rowStr.includes(kw))) {
      matchedRows++;
    }
  }
  score += matchedRows * 3;

  // Collections tabs typically have between 4 and 50 items
  if (rows.length >= 5 && rows.length <= 50) {
    score += 15;
  }

  // Bonus for row count up to 30
  score += Math.min(rows.length, 30);

  return score;
}

export function formatCategoryName(str: string): string {
  if (!str) return '';
  const trimmed = str.trim();
  // If slug with dashes or underscores (e.g. "orissa-pan", "table-top", "one-piece", "wall-hung", "floor-mount")
  if (trimmed.includes('-') || trimmed.includes('_')) {
    return trimmed
      .split(/[-_]+/)
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  }
  // If all lowercase words (e.g. "urinal collection", "pedestal", "wash basin")
  if (trimmed === trimmed.toLowerCase()) {
    return trimmed
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  }
  return trimmed;
}

export function normalizeCategory(cat: string): ProductCategory {
  const lower = (cat || '').toLowerCase().trim();
  if (!lower) return '';

  // Canonical standard matches for legacy templates & common tab variations:
  if (['one-piece', 'onepiece', 'opc', 'one piece', 'one piece closet', 'one piece closets', 'one piece collection'].includes(lower)) return 'one-piece';
  if (['wall-hung', 'wallhung', 'whc', 'wall hung', 'wall hung closet', 'wall hung closets', 'volang', 'wall hung collection'].includes(lower)) return 'wall-hung';
  if (['floor-mount', 'floormount', 'ewc', 'floor mount', 'floor mount closet', 'european water closet', 'couple suite', 'floor mount collection'].includes(lower)) return 'floor-mount';
  if (['orissa-pan', 'orissapan', 'orissa pan', 'orissa', 'horisaban', 'squatting pan', 'indian closet', 'indian pan', 'orissa pan collection'].includes(lower)) return 'orissa-pan';
  if (['table-top', 'tabletop', 'table-top basin', 'table top', 'table top basin', 'table', 'ttb', 'tabletop collection', 'table top collection'].includes(lower)) return 'table-top';
  if (['pedestal', 'pedestal basin', 'pedestal wash basin', 'ped', 'basin with pedestal', 'wash basin with pedestal'].includes(lower)) return 'pedestal';
  if (['urinal', 'urinals', 'commercial urinal', 'commercial urinals', 'urn', 'urinal collection'].includes(lower)) return 'urinal';

  // For all distinct custom collections (e.g. 'wall-hung-basin-collection' vs 'half-wall-hung-basin-collection'):
  // Strictly generate a clean kebab-case slug so Products and Collections match 100% without collision
  const slug = lower
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || lower;
}

export interface LegalSectionItem {
  heading: string;
  body: string;
  badge?: string;
}

export interface LegalPoliciesMap {
  privacy_notice?: string;
  privacy_collect?: string;
  privacy_purpose?: string;
  privacy_thirdparty?: string;
  privacy_security?: string;
  privacy_full?: string;
  terms_notice?: string;
  terms_pricing?: string;
  terms_moq?: string;
  terms_quality?: string;
  terms_transit?: string;
  terms_full?: string;
  privacySections?: LegalSectionItem[];
  termsSections?: LegalSectionItem[];
  [key: string]: any;
}

export interface FetchedDataResult {
  products: ProductItem[];
  siteMedia: SiteMediaMap;
  companyInfo: CompanyInfoMap;
  faqs: { question: string; answer: string }[];
  collectionsMeta: Record<string, Partial<CategoryMeta>>;
  legalPolicies?: LegalPoliciesMap;
  adminCredentials?: SheetAdminCredentials | null;
}

function makeColGetter(headerRow: string[]) {
  const cleanHeaders = headerRow.map((h) => h.toLowerCase().trim().replace(/[^a-z0-9]/g, ''));
  return (row: string[], ...aliases: string[]): string => {
    // 1. Exact cleaned match
    for (const alias of aliases) {
      const cleanAlias = alias.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
      const idx = cleanHeaders.indexOf(cleanAlias);
      if (idx !== -1 && row[idx] && row[idx].trim()) {
        return row[idx].trim();
      }
    }
    // 2. Substring match for longer aliases (e.g. "dimensions (mm)" matches "dimensions" or "size")
    for (const alias of aliases) {
      const cleanAlias = alias.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
      if (cleanAlias.length < 3) continue;
      const idx = cleanHeaders.findIndex((h) => h.includes(cleanAlias) || cleanAlias.includes(h));
      if (idx !== -1 && row[idx] && row[idx].trim()) {
        return row[idx].trim();
      }
    }
    return '';
  };
}

/**
 * Extracts numeric dimensions (length, width, height) from combined strings
 * (e.g., "500 x 380 x 140 mm", "480*370*130", "650 × 360") or individual columns.
 */
function extractProductDimensions(
  rawCombined: string,
  rawL: string,
  rawW: string,
  rawH: string,
  description: string,
  fallback?: { length: number; width: number; height: number; unit?: string; formatted?: string }
): { length: number; width: number; height: number; unit?: string; formatted?: string } {
  let length = 0;
  let width = 0;
  let height = 0;

  if (rawL && !isNaN(parseInt(rawL, 10))) length = parseInt(rawL, 10);
  if (rawW && !isNaN(parseInt(rawW, 10))) width = parseInt(rawW, 10);
  if (rawH && !isNaN(parseInt(rawH, 10))) height = parseInt(rawH, 10);

  // If combined dimension string is given or if in description
  const textToScan = rawCombined || (!length && !width ? description : '');
  if (textToScan) {
    const nums = textToScan.match(/\d+(?:\.\d+)?/g);
    if (nums && nums.length >= 2) {
      if (!length) length = Math.round(parseFloat(nums[0]));
      if (!width) width = Math.round(parseFloat(nums[1]));
      if (nums.length >= 3 && !height) {
        height = Math.round(parseFloat(nums[2]));
      }
    }
  }

  // Fallback to catalog product dimensions if available, else 0
  const finalLength = length > 0 ? length : (fallback?.length || 0);
  const finalWidth = width > 0 ? width : (fallback?.width || 0);
  const finalHeight = height > 0 ? height : (fallback?.height || 0);

  // Detect Unit (Inch vs mm vs cm)
  const fullText = (rawCombined || description || '').trim();
  const lowerText = fullText.toLowerCase();

  let unit = fallback?.unit || 'mm';
  const hasInchIndicator =
    lowerText.includes('inch') ||
    lowerText.includes('in.') ||
    fullText.includes('"') ||
    fullText.includes('”') ||
    fullText.includes('″');

  if (hasInchIndicator) {
    unit = 'Inch';
  } else if (lowerText.includes('cm')) {
    unit = 'cm';
  } else if (lowerText.includes('mm')) {
    unit = 'mm';
  } else if (finalLength > 0 && finalLength <= 50) {
    // Sanitaryware measurements <= 50 (like 16, 18, 14, 20) are inches
    unit = 'Inch';
  }

  // Build clean formatted display string
  let formatted = '';
  if (finalLength > 0 && finalWidth > 0) {
    const hasQuotes = fullText.includes('"') || fullText.includes('”') || fullText.includes('″');
    if (unit === 'Inch') {
      formatted = hasQuotes
        ? `${finalLength}" × ${finalWidth}"${finalHeight > 0 ? ` × ${finalHeight}"` : ''} Inch`
        : `${finalLength} × ${finalWidth}${finalHeight > 0 ? ` × ${finalHeight}` : ''} Inch`;
    } else {
      formatted = `${finalLength} × ${finalWidth}${finalHeight > 0 ? ` × ${finalHeight}` : ''} ${unit}`;
    }
  }

  return {
    length: finalLength,
    width: finalWidth,
    height: finalHeight,
    unit,
    formatted: formatted || fallback?.formatted
  };
}

export async function fetchAllDataFromGoogleSheet(sheetId: string): Promise<FetchedDataResult> {
  let products = [...PRODUCTS_CATALOG];
  let siteMedia = { ...DEFAULT_SITE_MEDIA };
  let companyInfo = { ...DEFAULT_COMPANY_INFO };
  let faqs = [...WHOLESALE_FAQS];
  let collectionsMeta: Record<string, Partial<CategoryMeta>> = {};
  const detectedCategoriesFromProducts: Record<string, string> = {};

  // 1. Fetch Products
  try {
    const productRows = await fetchSheetTab(sheetId, 'Products');
    if (productRows.length > 1) {
      const getCol = makeColGetter(productRows[0]);

      const parsedProducts: ProductItem[] = [];
      const seenIds = new Set<string>();

      for (let r = 1; r < productRows.length; r++) {
        const row = productRows[r];
        const rawId = (getCol(row, 'id') || `p-${r}`).trim();
        const name = getCol(row, 'name', 'model_name', 'model', 'product_name', 'product').trim();
        if (!name) continue;

        let id = rawId;
        let counter = 1;
        while (seenIds.has(id)) {
          id = `${rawId}-${counter}`;
          counter++;
        }
        seenIds.add(id);

        const rawCatStr = getCol(
          row,
          'category',
          'collection',
          'category_name',
          'collection_name',
          'category name',
          'collection name'
        );
        const validCategory = normalizeCategory(rawCatStr);

        if (rawCatStr) {
          const formattedCat = formatCategoryName(rawCatStr);
          const currentBest = detectedCategoriesFromProducts[validCategory];
          if (!currentBest || formattedCat.length > currentBest.length) {
            detectedCategoriesFromProducts[validCategory] = formattedCat;
          }
        }

        // Match existing catalog product for smart fallback specs
        const catalogMatch = PRODUCTS_CATALOG.find(
          (p) =>
            p.id.toLowerCase() === id.toLowerCase() ||
            p.name.toLowerCase() === name.toLowerCase() ||
            p.name.toLowerCase().includes(name.toLowerCase()) ||
            name.toLowerCase().includes(p.name.toLowerCase())
        );

        // Dimensions parsing: support single column "dimensions" or "size" (e.g. 500x380x140 mm) or separate columns
        const rawDimCombined = getCol(
          row,
          'dimensions',
          'dimension',
          'size',
          'sizes',
          'measurement',
          'measurements',
          'specs',
          'dimensions_mm',
          'size_mm',
          'dimension_mm',
          'dim',
          'dims'
        );
        const rawLength = getCol(row, 'dimensionslength', 'dimensions length', 'length', 'len', 'l');
        const rawWidth = getCol(row, 'dimensionswidth', 'dimensions width', 'width', 'wid', 'w', 'breadth', 'b');
        const rawHeight = getCol(row, 'dimensionsheight', 'dimensions height', 'height', 'ht', 'h', 'depth', 'd');

        const rawDesc = getCol(row, 'description');
        const dimensions = extractProductDimensions(
          rawDimCombined,
          rawLength,
          rawWidth,
          rawHeight,
          rawDesc,
          catalogMatch?.dimensions
        );

        const description = rawDesc || (dimensions.formatted
          ? `Dimensions: ${dimensions.formatted}`
          : (catalogMatch?.description || 'Export grade vitrified ceramic sanitaryware'));

        const rawFeatures = getCol(row, 'keyfeatures', 'key features', 'features');
        const keyFeatures = rawFeatures
          ? rawFeatures.split('|').map((s) => s.trim()).filter(Boolean)
          : (catalogMatch?.keyFeatures || ['High-density ceramic body', 'Nano glaze finish']);

        const rawModels = getCol(row, 'featuredmodels', 'featured models', 'models');
        const featuredModels = rawModels
          ? rawModels.split(',').map((s) => s.trim()).filter(Boolean)
          : [];

        // Trap parsing: STRICT per-product rule from Google Sheet
        // If there are no details about trap in sheet (or blank/n-a/standard outlet), REMOVE trapType ('')
        // If user added a specific value in trap (e.g. 'S-Trap 220mm', 'P-Trap 180mm', '300mm'), use it
        const rawTrap = getCol(
          row,
          'traptype',
          'trap_type',
          'trap type',
          'trap',
          'traps',
          'trap_distance',
          'trap distance',
          'trap_option',
          'trap option',
          'outlet',
          'outlet_type',
          'outlet type',
          'trap_details',
          'trap details',
          'strap',
          'ptrap',
          's_trap',
          'p_trap'
        );
        let trapType = '';
        if (rawTrap) {
          const cleanTrap = rawTrap.trim();
          const lowerTrap = cleanTrap.toLowerCase();
          const invalidTrapPlaceholders = [
            'n/a',
            'na',
            '-',
            '--',
            '---',
            'none',
            'no',
            'null',
            'nil',
            '0',
            'standard outlet',
            'standard',
            'not applicable',
            'empty',
            'undefined'
          ];
          if (!invalidTrapPlaceholders.includes(lowerTrap)) {
            trapType = cleanTrap;
          }
        }

        parsedProducts.push({
          id,
          name,
          series: getCol(row, 'series') || (catalogMatch?.series || `SERIES: ${id.toUpperCase()}`),
          category: validCategory,
          tagBadge: getCol(row, 'tagbadge', 'tag badge', 'badge', 'tag') || (catalogMatch?.tagBadge || 'FACTORY DIRECT'),
          subType: getCol(row, 'subtype', 'sub type') || (catalogMatch?.subType || 'Standard'),
          description,
          keyFeatures,
          dimensions,
          trapType,
          flushType: getCol(row, 'flushtype', 'flush type') || (catalogMatch?.flushType || 'Direct Wash'),
          waterAbsorption: getCol(row, 'waterabsorption', 'water absorption') || (catalogMatch?.waterAbsorption || '< 0.40%'),
          boxQuantity: getCol(row, 'boxquantity', 'box quantity') || (catalogMatch?.boxQuantity || '1 Piece / Box'),
          moqUnits: parseInt(getCol(row, 'moqunits', 'moq units', 'moq') || '', 10) || (catalogMatch?.moqUnits || 50),
          featuredModels: featuredModels.length > 0 ? featuredModels : (catalogMatch?.featuredModels || ['Standard Series']),
          imageUrl: normalizeImageUrl(getCol(row, 'imageurl', 'image_url', 'image url', 'image', 'photo')) || (catalogMatch?.imageUrl || DEFAULT_SITE_MEDIA.hero_lifestyle)
        });
      }

      if (parsedProducts.length > 0) {
        products = parsedProducts;
      }
    }
  } catch (err) {
    console.warn('Could not parse Products tab from Google Sheet:', err);
  }

  // 2. Fetch SiteMedia
  try {
    const mediaRows = await fetchSheetTab(sheetId, 'SiteMedia');
    if (mediaRows.length > 1) {
      const header = mediaRows[0].map((h) => h.toLowerCase());
      const keyIdx = header.indexOf('key');
      const urlIdx = header.indexOf('imageurl') !== -1 ? header.indexOf('imageurl') : header.indexOf('image_url');
      if (keyIdx !== -1 && urlIdx !== -1) {
        for (let r = 1; r < mediaRows.length; r++) {
          const row = mediaRows[r];
          const key = row[keyIdx]?.trim();
          const url = row[urlIdx]?.trim();
          if (key && url) {
            siteMedia[key] = normalizeImageUrl(url);
          }
        }
      }
    }
  } catch (err) {
    console.warn('Could not parse SiteMedia tab:', err);
  }

  // 3. Fetch CompanyInfo & Contact Details (Customizable Mobile Numbers, Address, etc.)
  const possibleCompanyTabs = ['CompanyInfo', 'Company Info', 'Company', 'Contact', 'ContactInfo', 'Contact Info', 'About', 'Admin'];
  for (const tabName of possibleCompanyTabs) {
    try {
      const infoRows = await fetchSheetTab(sheetId, tabName);
      if (!infoRows || infoRows.length < 2) continue;

      const header = infoRows[0].map((h) => h.toLowerCase().trim());
      const headerClean = header.map((h) => h.replace(/[\s_-]+/g, ''));

      // Check for Key-Value vertical format
      const keyIdx = headerClean.findIndex((h) => ['key', 'field', 'property', 'name', 'parameter', 'attribute', 'label', 'item'].includes(h));
      const valIdx = headerClean.findIndex((h) => ['value', 'val', 'detail', 'details', 'text', 'content', 'info', 'data'].includes(h));

      if (keyIdx !== -1 && valIdx !== -1) {
        for (let r = 1; r < infoRows.length; r++) {
          const row = infoRows[r];
          const rawKey = row[keyIdx]?.trim();
          const val = row[valIdx]?.trim();
          if (!rawKey || !val) continue;

          const cleanKey = rawKey.toLowerCase().replace(/[\s_-]+/g, '');

          // Check if key is a mobile or phone number
          if (['mobile', 'phone', 'primaryphone', 'mobilenumber', 'contact', 'contactnumber', 'whatsapp', 'whatsappnumber', 'call', 'callus', 'phonenumber', 'salesphone', 'directphone'].includes(cleanKey)) {
            // Check if user entered both primary and secondary numbers in the same cell (e.g. "+91 84859 59884 / +91 76003 41434")
            const parts = val.split(/[/,;|\n]|(\sand\s)/i).map((s) => s?.trim()).filter(Boolean);
            companyInfo.primary_phone = parts[0] || val;
            if (parts.length > 1 && parts[1]) {
              companyInfo.secondary_phone = parts[1];
            }
            companyInfo[rawKey] = val;
          } else if (['secondaryphone', 'secondarymobile', 'alternatephone', 'alternatemobile', 'phone2', 'mobile2', 'secondarycontact', 'contact2'].includes(cleanKey)) {
            companyInfo.secondary_phone = val;
            companyInfo[rawKey] = val;
          } else if (['brandname', 'companyname', 'brand'].includes(cleanKey)) {
            companyInfo.brand_name = val;
          } else if (['location', 'city'].includes(cleanKey)) {
            companyInfo.location = val;
          } else if (['factoryaddress', 'address', 'plantaddress'].includes(cleanKey)) {
            companyInfo.factory_address = val;
          } else if (['googlemapsembedurl', 'mapsembedurl', 'mapembed', 'mapsiframe'].includes(cleanKey)) {
            companyInfo.google_maps_embed_url = cleanGoogleMapsEmbedUrl(val) || val.trim();
          } else if (['googlemapsurl', 'mapsurl', 'maplink', 'googlemapslink'].includes(cleanKey)) {
            companyInfo.google_maps_url = val.trim();
          } else {
            companyInfo[rawKey] = val;
          }

          if (cleanKey === 'logo' || cleanKey === 'logourl' || cleanKey === 'brandlogo') {
            siteMedia.logo = normalizeImageUrl(val);
          }
        }
      } else if (infoRows[0].length >= 2) {
        // Fallback A: Column A is Key, Column B is Value even without explicit "key"/"value" headers
        let looksLikeKeyValue = false;
        const firstColClean = infoRows.slice(1, 6).map(r => (r[0] || '').toLowerCase().replace(/[\s_-]+/g, ''));
        if (firstColClean.some(k => ['phone', 'mobile', 'address', 'brand', 'email', 'location', 'whatsapp'].some(sub => k.includes(sub)))) {
          looksLikeKeyValue = true;
          for (let r = (headerClean.some(h => ['phone', 'mobile', 'address'].some(sub => h.includes(sub))) ? 0 : 1); r < infoRows.length; r++) {
            const row = infoRows[r];
            const rawKey = row[0]?.trim();
            const val = row[1]?.trim();
            if (!rawKey || !val) continue;
            const cleanKey = rawKey.toLowerCase().replace(/[\s_-]+/g, '');
            if (['mobile', 'phone', 'primaryphone', 'mobilenumber', 'contact', 'contactnumber', 'whatsapp', 'call', 'callus'].includes(cleanKey)) {
              const parts = val.split(/[/,;|\n]|(\sand\s)/i).map((s) => s?.trim()).filter(Boolean);
              companyInfo.primary_phone = parts[0] || val;
              if (parts.length > 1 && parts[1]) companyInfo.secondary_phone = parts[1];
            } else if (['secondaryphone', 'secondarymobile', 'alternatephone', 'phone2', 'mobile2'].includes(cleanKey)) {
              companyInfo.secondary_phone = val;
            } else {
              companyInfo[rawKey] = val;
            }
          }
        }

        // Fallback B: Horizontal layout where row 0 is column headers (e.g. Mobile, Secondary Mobile, Address)
        if (!looksLikeKeyValue && infoRows.length >= 2) {
          const row1 = infoRows[1];
          for (let c = 0; c < infoRows[0].length; c++) {
            const colHeader = headerClean[c];
            const val = row1[c]?.trim();
            if (!colHeader || !val) continue;

            if (['mobile', 'phone', 'primaryphone', 'mobilenumber', 'contact', 'contactnumber', 'whatsapp', 'call', 'callus'].includes(colHeader)) {
              const parts = val.split(/[/,;|\n]|(\sand\s)/i).map((s) => s?.trim()).filter(Boolean);
              companyInfo.primary_phone = parts[0] || val;
              if (parts.length > 1 && parts[1]) companyInfo.secondary_phone = parts[1];
            } else if (['secondaryphone', 'secondarymobile', 'alternatephone', 'phone2', 'mobile2'].includes(colHeader)) {
              companyInfo.secondary_phone = val;
            } else if (['address', 'factoryaddress'].includes(colHeader)) {
              companyInfo.factory_address = val;
            } else if (['brandname', 'companyname'].includes(colHeader)) {
              companyInfo.brand_name = val;
            }
          }
        }
      }
    } catch (err) {
      console.warn(`Could not parse ${tabName} tab:`, err);
    }
  }

  // 4. Fetch FAQs
  try {
    const faqRows = await fetchSheetTab(sheetId, 'FAQs');
    if (faqRows.length > 1) {
      const header = faqRows[0].map((h) => h.toLowerCase());
      const qIdx = header.indexOf('question');
      const aIdx = header.indexOf('answer');
      if (qIdx !== -1 && aIdx !== -1) {
        const parsedFaqs: { question: string; answer: string }[] = [];
        for (let r = 1; r < faqRows.length; r++) {
          const row = faqRows[r];
          const q = row[qIdx]?.trim();
          const a = row[aIdx]?.trim();
          if (q && a) {
            parsedFaqs.push({ question: q, answer: a });
          }
        }
        if (parsedFaqs.length > 0) {
          faqs = parsedFaqs;
        }
      }
    }
  } catch (err) {
    console.warn('Could not parse FAQs tab:', err);
  }

  // 5. Fetch Collections (All Collections Tab - Dynamic 7, 9, 11, 15+ Collections)
  try {
    let colRows: string[][] = [];
    let defaultTabCsv = '';

    // First, fetch the default sheet CSV to detect GViz silent redirect fallbacks
    try {
      const defaultRes = await fetchSheetTabWithRaw(sheetId);
      defaultTabCsv = defaultRes.text.trim();
      // If the default sheet itself happens to be the collections tab, score it
      const defaultScore = scoreCollectionsTab(defaultRes.rows);
      if (defaultScore > 35) {
        colRows = defaultRes.rows;
      }
    } catch {
      // ignore
    }

    // Comprehensive list of possible tab names (including user typos like 'collecion')
    const possibleTabNames = [
      'Collections',
      'collections',
      'Collection',
      'collection',
      'collecion',
      'Collecion',
      'collecions',
      'Collecions',
      'Collections Tab',
      'collections tab',
      'Collection Tab',
      'collection tab',
      'collecion tab',
      'Collecion tab',
      'Category',
      'Categories',
      'category',
      'categories',
      'Categories Tab',
      'Category Tab',
      'Categories tab',
      'Category tab',
      'All Collections',
      'All Collection',
      'All Categories',
      'Collections List',
      'Collection List',
      'Category List',
      'Categories List',
      'CollectionsMeta',
      'collectionsmeta',
      'Collections Meta',
      'Catalog',
      'Catalogue',
      'Sheet1',
      'Sheet2',
      'Sheet3',
      'Sheet4',
      'Sheet5',
      'Sheet6',
      'Sheet7',
      'Sheet8'
    ];

    let bestScore = colRows.length > 0 ? scoreCollectionsTab(colRows) : 0;
    let bestRows = colRows;

    // Check candidate tabs and find the genuine collections sheet
    for (const tab of possibleTabNames) {
      try {
        const candidate = await fetchSheetTabWithRaw(sheetId, tab);
        const candidateText = candidate.text.trim();

        // If GViz returned the default sheet fallback because tab doesn't exist, skip
        if (defaultTabCsv && candidateText === defaultTabCsv && bestScore > 35) {
          continue;
        }

        const score = scoreCollectionsTab(candidate.rows);
        if (score > bestScore) {
          bestScore = score;
          bestRows = candidate.rows;
          // If candidate is a clear match with collection columns, we found the tab
          if (bestScore >= 60) {
            break;
          }
        }
      } catch {
        // try next tab name
      }
    }

    if (bestRows && bestRows.length > 1) {
      colRows = bestRows;
    }

    if (colRows && colRows.length > 1) {
      const firstRowLower = colRows[0].map(c => (c || '').toLowerCase().trim());
      const isFirstRowHeader = firstRowLower.some(c => 
        ['category', 'collection', 'collecion', 'title', 'name', 'image', 'photo', 'url', 'cover', 'subtitle', 'tag', 'order', 'home', 'id', 'sr', 'no'].some(k => c.includes(k))
      );
      const getCol = makeColGetter(colRows[0]);
      const startRow = isFirstRowHeader ? 1 : 0;

      for (let r = startRow; r < colRows.length; r++) {
        const row = colRows[r];
        if (!row || row.every(cell => !cell || !cell.trim())) continue;

        let rawCategory = getCol(
          row,
          'category',
          'collection',
          'collecion',
          'category_name',
          'collection_name',
          'category name',
          'collection name',
          'categories',
          'collections',
          'category_title',
          'collection_title',
          'category title',
          'collection title',
          'name',
          'title',
          'collection_name_en',
          'category_en',
          'heading',
          'id'
        );

        if (!rawCategory) {
          // If first column is serial number / numeric index (like 1, 2, 3... 11), use column 1 as category name
          if (row[0] && /^\d+$/.test(row[0].trim()) && row[1] && row[1].trim()) {
            rawCategory = row[1].trim();
          } else if (row[0] && row[0].trim()) {
            rawCategory = row[0].trim();
          } else if (row[1] && row[1].trim()) {
            rawCategory = row[1].trim();
          }
        }

        if (!rawCategory) continue;

        // Skip accidental header repeats
        const lowerRaw = rawCategory.toLowerCase().trim();
        if (['category', 'collection', 'collecion', 'category name', 'collection name', 'name', 'id', 'title', 'categories', 'collections', 'sr no', 'sr. no.', 'sr.', 'no'].includes(lowerRaw)) {
          continue;
        }

        const catKey = normalizeCategory(rawCategory);
        const categoryDisplayName = formatCategoryName(rawCategory);

        const rawImg = getCol(
          row,
          'imageurl',
          'image_url',
          'image url',
          'coverimage',
          'cover_image',
          'cover image',
          'thumbnail',
          'image',
          'photo',
          'picture',
          'img',
          'photo_url'
        );
        const coverImage = rawImg ? normalizeImageUrl(rawImg) : '';

        // Check if user has an explicit custom short_label or button_label column
        const explicitShortLabel = getCol(
          row,
          'shortlabel',
          'short_label',
          'short label',
          'button_label',
          'button label',
          'button',
          'view_button',
          'view button',
          'view',
          'label'
        );

        // Check if user has an explicit title column
        const explicitTitle = getCol(
          row,
          'title',
          'heading',
          'collection_title',
          'category_title',
          'collection_name',
          'category_name',
          'name'
        );

        let subtitle = getCol(row, 'subtitle', 'sub_title', 'sub title', 'tagline', 'subheading');
        let tagBadge = getCol(row, 'tagbadge', 'tag_badge', 'tag badge', 'badge', 'tag');
        let description = getCol(row, 'description', 'desc', 'details', 'about');

        // Check if an explicit title or subtitle was accidentally left over from copying another row in the sheet
        // (e.g. user copied the urinal row to create "Half Wall Hung Basin" or "basin with pedestal" and forgot to edit Title/Subtitle)
        const rawCatLower = (rawCategory || '').toLowerCase();
        const titleLower = (explicitTitle || '').toLowerCase();
        const subLower = (subtitle || '').toLowerCase();

        const isBasinCat = rawCatLower.includes('basin') || rawCatLower.includes('pedestal') || catKey === 'pedestal' || catKey === 'table-top';
        const isUrinalCat = rawCatLower.includes('urinal') || catKey === 'urinal';
        const isClosetCat = rawCatLower.includes('closet') || rawCatLower.includes('toilet') || rawCatLower.includes('pan') || ['one-piece', 'wall-hung', 'floor-mount', 'orissa-pan'].includes(catKey);

        const titleIsUrinal = titleLower.includes('urinal');
        const titleIsBasin = titleLower.includes('basin') || titleLower.includes('pedestal');
        const titleIsCloset = titleLower.includes('closet') || titleLower.includes('toilet') || titleLower.includes('pan');

        const isCopiedMismatch = !!explicitTitle && (
          (isBasinCat && titleIsUrinal && !titleIsBasin) ||
          (isClosetCat && titleIsUrinal && !titleIsCloset) ||
          (isUrinalCat && titleIsBasin && !titleIsUrinal) ||
          (isUrinalCat && titleIsCloset && !titleIsUrinal)
        );

        // If mismatched, prioritize the actual category name from Column A
        const defaultForCategory = catKey === 'pedestal' ? 'Wash Basins with Pedestal' : categoryDisplayName;
        const resolvedName = (explicitTitle && !isCopiedMismatch) ? explicitTitle : (defaultForCategory || rawCategory);
        const title = resolvedName;
        const shortLabel = explicitShortLabel || resolvedName;

        // Clean up copied urinal subtitle/badges if applied to a basin/closet
        if (isCopiedMismatch) {
          if (subLower.includes('urinal') || subLower.includes('spreader')) {
            subtitle = isBasinCat ? 'Premium Vitrified Ceramic Wash Basin Collection' : 'High-Density Vitrified Sanitaryware Collection';
          }
          if ((tagBadge || '').toLowerCase().includes('spreader') || (tagBadge || '').toLowerCase().includes('urinal')) {
            tagBadge = isBasinCat ? 'VITRIFIED CERAMIC' : 'THANGADH CLUSTER DIRECT';
          }
          if ((description || '').toLowerCase().includes('urinal')) {
            description = '';
          }
        }

        // Optional column to choose which collections appear on the Home tab
        const rawHome = getCol(
          row,
          'home',
          'show_on_home',
          'show on home',
          'featured',
          'featured_home',
          'show_home',
          'show home',
          'home_tab',
          'home tab',
          'homepage'
        );
        let showOnHome: boolean | undefined = undefined;
        if (rawHome) {
          const lh = rawHome.toLowerCase().trim();
          if (['true', 'yes', '1', 'y', 'show', 'featured', 'enable'].includes(lh)) {
            showOnHome = true;
          } else if (['false', 'no', '0', 'n', 'hide', 'disable'].includes(lh)) {
            showOnHome = false;
          }
        }

        // Optional sequence / order column (Collections Page Order)
        const rawOrder = getCol(
          row,
          'order',
          'collection_order',
          'collection order',
          'category_order',
          'category order',
          'sequence',
          'seq',
          'position',
          'priority',
          'rank',
          'sr',
          'sr_no',
          'sr no',
          'no'
        );
        const parsedOrder = rawOrder ? parseInt(rawOrder, 10) : (r + 1);
        const order = isNaN(parsedOrder) ? (r + 1) : parsedOrder;

        // Optional home page order column (Home Page Top 8 Order)
        const rawHomeOrder = getCol(
          row,
          'home_order',
          'homeorder',
          'home order',
          'home_seq',
          'homeseq',
          'home sequence',
          'home_priority',
          'home priority',
          'home_rank',
          'home rank'
        );
        const parsedHomeOrder = rawHomeOrder ? parseInt(rawHomeOrder, 10) : undefined;
        const homeOrder = parsedHomeOrder !== undefined && !isNaN(parsedHomeOrder) ? parsedHomeOrder : undefined;

        // Optional Related Collections column (comma, pipe, or newline separated)
        // e.g. "Wall Hung Closets, Water Closets & Floor Mounts, Orissa Pan & Indian Closets"
        const rawRelated = getCol(
          row,
          'relatedcollection',
          'related_collection',
          'related collection',
          'relatedcollections',
          'related_collections',
          'related collections',
          'related',
          'related_categories',
          'related categories',
          'related category',
          'switch_collection',
          'switch_collections',
          'switch collection',
          'switch collections',
          'switch',
          'switch_to'
        );
        let relatedCollections: string[] | undefined = undefined;
        if (rawRelated) {
          const parts = rawRelated
            .split(/[,|;\n]/)
            .map((s) => s.trim())
            .filter(Boolean);
          if (parts.length > 0) {
            relatedCollections = parts;
          }
        }

        // Optional SEO columns
        const seoTitle = getCol(
          row,
          'seotitle',
          'seo_title',
          'seo title',
          'meta_title',
          'metatitle',
          'meta title',
          'page_title',
          'pagetitle'
        );
        const seoDescription = getCol(
          row,
          'seodescription',
          'seo_description',
          'seo description',
          'meta_description',
          'metadescription',
          'meta description',
          'search_description'
        );
        const seoKeywords = getCol(
          row,
          'seokeywords',
          'seo_keywords',
          'seo keywords',
          'keywords',
          'meta_keywords',
          'metakeywords',
          'tags'
        );

        collectionsMeta[catKey] = {
          id: catKey,
          title,
          shortLabel,
          subtitle: subtitle || 'High-Density Vitrified Sanitaryware Collection',
          tagBadge: tagBadge || 'THANGADH CLUSTER DIRECT',
          description: description || 'Premium grade vitrified ceramic sanitaryware manufactured with high-purity clay slip and nano glaze finish.',
          ...(coverImage ? { coverImage } : {}),
          ...(showOnHome !== undefined ? { showOnHome } : {}),
          ...(relatedCollections && relatedCollections.length > 0 ? { relatedCollections } : {}),
          ...(seoTitle ? { seoTitle } : {}),
          ...(seoDescription ? { seoDescription } : {}),
          ...(seoKeywords ? { seoKeywords } : {}),
          order,
          ...(homeOrder !== undefined ? { homeOrder } : {})
        };
      }
    }
  } catch (err) {
    console.warn('Could not parse Collections tab from Google Sheet:', err);
  }

  // Populate any custom category names discovered in the Products tab ONLY if no Collections tab was defined
  if (Object.keys(collectionsMeta).length === 0) {
    let autoOrder = 100;
    for (const [catKey, customCatName] of Object.entries(detectedCategoriesFromProducts)) {
      if (customCatName) {
        const typedKey = catKey as ProductCategory;
        collectionsMeta[typedKey] = {
          ...collectionsMeta[typedKey],
          id: typedKey,
          title: collectionsMeta[typedKey]?.title || customCatName,
          shortLabel: collectionsMeta[typedKey]?.shortLabel || customCatName,
          order: collectionsMeta[typedKey]?.order ?? autoOrder++
        };
      }
    }
  }



  // 6. Fetch Legal / Privacy Policy & Terms from Sheet
  // Supports tabs: 'Legal', 'Policies', 'Privacy', 'Terms', 'TermsAndConditions', etc.
  const legalPolicies: LegalPoliciesMap = {
    privacySections: [],
    termsSections: []
  };
  
  // Check CompanyInfo for any legal keys first
  for (const [k, v] of Object.entries(companyInfo)) {
    const lk = k.toLowerCase().replace(/[\s_-]/g, '');
    if (lk.includes('privacy') || lk.includes('terms') || lk.includes('policy')) {
      legalPolicies[k] = v;
    }
  }

  const possibleLegalTabs = ['Legal', 'Policies', 'Privacy', 'Terms', 'TermsAndConditions', 'LegalPolicy', 'Policy'];
  for (const tabName of possibleLegalTabs) {
    try {
      const rows = await fetchSheetTab(sheetId, tabName);
      if (!rows || rows.length < 2) continue;

      const getCol = makeColGetter(rows[0]);
      const headerLower = rows[0].map((h) => h.toLowerCase().trim().replace(/[\s_-]+/g, ''));
      const isPurePrivacyTab = tabName.toLowerCase().includes('privacy');
      const isPureTermsTab = tabName.toLowerCase().includes('term');

      // Check if this sheet has Heading / Title and Body / Detail columns (e.g. Type, Heading, Detail)
      const headingIdx = headerLower.findIndex((h) => h === 'heading' || h === 'title' || h === 'section' || h === 'sectiontitle' || h === 'header');
      const bodyIdx = headerLower.findIndex((h) => h === 'body' || h === 'detail' || h === 'details' || h === 'content' || h === 'text' || h === 'description' || h === 'value');
      const typeIdx = headerLower.findIndex((h) => h === 'type' || h === 'category' || h === 'policy' || h === 'tab');
      const keyIdx = headerLower.findIndex((h) => h === 'key' || h === 'field');

      if (headingIdx !== -1 && bodyIdx !== -1 && keyIdx === -1) {
        // Table format with Heading and Body/Detail columns!
        for (let r = 1; r < rows.length; r++) {
          const row = rows[r];
          const heading = row[headingIdx]?.trim() || '';
          const body = row[bodyIdx]?.trim() || '';
          const typeVal = (typeIdx !== -1 ? row[typeIdx]?.trim().toLowerCase() : '') || (isPurePrivacyTab ? 'privacy' : isPureTermsTab ? 'terms' : '');
          const badge = getCol(row, 'badge', 'tag', 'subheading');

          if (!heading && !body) continue;

          if (typeVal.includes('term')) {
            legalPolicies.termsSections!.push({ heading, body, badge });
          } else if (typeVal.includes('priv')) {
            legalPolicies.privacySections!.push({ heading, body, badge });
          } else {
            // If tab is purely Terms
            if (isPureTermsTab) {
              legalPolicies.termsSections!.push({ heading, body, badge });
            } else {
              legalPolicies.privacySections!.push({ heading, body, badge });
            }
          }
        }
      } else if (keyIdx !== -1 && bodyIdx !== -1) {
        // Key-Value layout (Key, Value)
        for (let r = 1; r < rows.length; r++) {
          const row = rows[r];
          const key = row[keyIdx]?.trim();
          const val = row[bodyIdx]?.trim();
          if (key && val) {
            legalPolicies[key] = val;
          }
        }
      } else {
        // Row-based with column names (e.g. privacy_notice, terms_pricing, etc.)
        for (let r = 1; r < rows.length; r++) {
          const row = rows[r];
          const pn = getCol(row, 'privacy_notice', 'privacynotice', 'privacy_header', 'privacy');
          const pc = getCol(row, 'privacy_collect', 'privacycollect', 'collect', 'information_collected');
          const pp = getCol(row, 'privacy_purpose', 'privacypurpose', 'purpose', 'usage');
          const pt = getCol(row, 'privacy_thirdparty', 'privacythirdparty', 'thirdparty', 'confidentiality');
          const ps = getCol(row, 'privacy_security', 'privacysecurity', 'security', 'protection');
          const pf = getCol(row, 'privacy_full', 'privacyfull', 'privacy_text');

          const tn = getCol(row, 'terms_notice', 'termsnotice', 'terms_header', 'terms');
          const tp = getCol(row, 'terms_pricing', 'termspricing', 'price_structure', 'pricing');
          const tm = getCol(row, 'terms_moq', 'termsmoq', 'moq', 'order_quantity');
          const tq = getCol(row, 'terms_quality', 'termsquality', 'quality', 'specifications');
          const tt = getCol(row, 'terms_transit', 'termstransit', 'transit', 'inspection');
          const tf = getCol(row, 'terms_full', 'termsfull', 'terms_text');

          if (pn) legalPolicies.privacy_notice = pn;
          if (pc) legalPolicies.privacy_collect = pc;
          if (pp) legalPolicies.privacy_purpose = pp;
          if (pt) legalPolicies.privacy_thirdparty = pt;
          if (ps) legalPolicies.privacy_security = ps;
          if (pf) legalPolicies.privacy_full = pf;

          if (tn) legalPolicies.terms_notice = tn;
          if (tp) legalPolicies.terms_pricing = tp;
          if (tm) legalPolicies.terms_moq = tm;
          if (tq) legalPolicies.terms_quality = tq;
          if (tt) legalPolicies.terms_transit = tt;
          if (tf) legalPolicies.terms_full = tf;
        }
      }
    } catch {
      // ignore missing tabs
    }
  }

  // 7. Fetch Admin / Auth Credentials from Sheet (User ID & Password)
  let adminCredentials: SheetAdminCredentials | null = null;
  try {
    let authRows: string[][] = [];
    try {
      authRows = await fetchSheetTab(sheetId, 'Admin');
    } catch {
      try {
        authRows = await fetchSheetTab(sheetId, 'Auth');
      } catch {
        // none
      }
    }

    if (authRows && authRows.length > 1) {
      const header = authRows[0].map((h) => h.toLowerCase().replace(/[\s_-]/g, ''));
      const userIdx = header.findIndex((h) => h.includes('user') || h.includes('email') || h.includes('login') || h === 'id');
      const passIdx = header.findIndex((h) => h.includes('pass') || h.includes('pwd'));
      if (userIdx !== -1 && passIdx !== -1) {
        const u = authRows[1][userIdx]?.trim();
        const p = authRows[1][passIdx]?.trim();
        if (u && p) {
          adminCredentials = { userId: u, password: p };
        }
      }
    }
  } catch {
    // Admin tab is optional
  }

  // Also check if CompanyInfo tab has admin credentials
  if (!adminCredentials && (companyInfo['admin_userid'] || companyInfo['admin_user'] || companyInfo['admin_email'])) {
    const u = companyInfo['admin_userid'] || companyInfo['admin_user'] || companyInfo['admin_email'];
    const p = companyInfo['admin_password'] || companyInfo['password'];
    if (u && p) {
      adminCredentials = { userId: u.trim(), password: p.trim() };
    }
  }

  return { products, siteMedia, companyInfo, faqs, collectionsMeta, legalPolicies, adminCredentials };
}
