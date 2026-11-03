import { CollectionSeoMeta } from '../types';

const STORAGE_KEY_COLLECTION_SEO = 'htc_collection_seo_overrides';

export function getStoredCollectionSeo(): Record<string, CollectionSeoMeta> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY_COLLECTION_SEO);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch (e) {
    console.warn('Failed to parse stored collection SEO overrides:', e);
    return {};
  }
}

export function saveStoredCollectionSeo(overrides: Record<string, CollectionSeoMeta>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_COLLECTION_SEO, JSON.stringify(overrides));
  } catch (e) {
    console.warn('Failed to save collection SEO overrides:', e);
  }
}

export function updateSingleCollectionSeo(collectionId: string, seo: CollectionSeoMeta): void {
  const current = getStoredCollectionSeo();
  current[collectionId] = seo;
  saveStoredCollectionSeo(current);
}

export function removeSingleCollectionSeo(collectionId: string): void {
  const current = getStoredCollectionSeo();
  delete current[collectionId];
  saveStoredCollectionSeo(current);
}

export function generateRecommendedSeo(category: {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
}): { title: string; description: string; keywords: string } {
  const lowerTitle = (category.title || '').toLowerCase();
  const lowerId = (category.id || '').toLowerCase();

  const isCloset =
    lowerTitle.includes('closet') ||
    lowerTitle.includes('toilet') ||
    lowerTitle.includes('pan') ||
    lowerId.includes('closet') ||
    lowerId === 'one-piece' ||
    lowerId === 'wall-hung' ||
    lowerId === 'floor-mount' ||
    lowerId === 'orissa-pan';

  const isBasin =
    lowerTitle.includes('basin') ||
    lowerTitle.includes('pedestal') ||
    lowerId.includes('basin') ||
    lowerId === 'table-top' ||
    lowerId === 'pedestal';

  const isUrinal = lowerTitle.includes('urinal') || lowerId.includes('urinal');

  if (isCloset) {
    return {
      title: `${category.title} Manufacturer & B2B Wholesale | Hightone Ceramic Thangadh`,
      description: `Direct manufacturer of vitrified ceramic ${category.title.toLowerCase()} in Thangadh, Gujarat. High-performance siphonic flush & concealed traps for wholesale dealers & builders.`,
      keywords: `${category.title.toLowerCase()}, ceramic water closet, sanitaryware manufacturer thangadh, vitrified toilet wholesale, b2b sanitaryware gujarat, ceramic commode factory`
    };
  }

  if (isBasin) {
    return {
      title: `${category.title} Wholesale & Ex-Factory Supply | Hightone Ceramic`,
      description: `Factory-direct vitreous china ${category.title.toLowerCase()} manufacturer in Thangadh. Stain-resistant nano glaze, modern design aesthetics, and direct truckload dispatch.`,
      keywords: `${category.title.toLowerCase()}, wash basin wholesale, ceramic basin manufacturer thangadh, table top wash basin factory, vitreous china wash basin india`
    };
  }

  if (isUrinal) {
    return {
      title: `Commercial Urinals Manufacturer & Wholesale Supply | Hightone Ceramic`,
      description: `Heavy-duty commercial ceramic urinals with integral spreaders and water-saving flush engineering. Direct factory dispatch from Thangadh, Gujarat for B2B projects.`,
      keywords: `commercial urinal manufacturer, ceramic urinals wholesale, waterless urinal gujarat, sanitaryware thangadh factory direct`
    };
  }

  return {
    title: `${category.title} Manufacturer & Wholesale | Hightone Ceramic Thangadh`,
    description: `Ex-factory vitrified ceramic sanitaryware wholesale for ${category.title.toLowerCase()} by Hightone Ceramic, Thangadh Gujarat. Direct container and truckload supply for dealers.`,
    keywords: `${category.title.toLowerCase()}, ceramic sanitaryware wholesale, thangadh ceramics manufacturer, vitrified sanitaryware gujarat, sanitaryware factory direct`
  };
}

export interface DocumentSeoOptions {
  title?: string;
  description?: string;
  keywords?: string;
  image?: string;
  url?: string;
  categoryName?: string;
}

export function updateDocumentSeo(options: DocumentSeoOptions): void {
  if (typeof document === 'undefined') return;

  const { title, description, keywords, image, url, categoryName } = options;

  // 1. Update Title tag
  if (title) {
    document.title = title;
  }

  const setOrCreateMeta = (attr: 'name' | 'property', key: string, content?: string) => {
    if (!content) return;
    let meta = document.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
    if (!meta) {
      meta = document.createElement('meta');
      meta.setAttribute(attr, key);
      document.head.appendChild(meta);
    }
    meta.setAttribute('content', content);
  };

  // 2. Standard Search Meta
  if (description) {
    setOrCreateMeta('name', 'description', description);
  }
  if (keywords) {
    setOrCreateMeta('name', 'keywords', keywords);
  }

  // 3. OpenGraph Social Share Tags
  if (title) {
    setOrCreateMeta('property', 'og:title', title);
  }
  if (description) {
    setOrCreateMeta('property', 'og:description', description);
  }
  if (image) {
    setOrCreateMeta('property', 'og:image', image);
  }
  if (url) {
    setOrCreateMeta('property', 'og:url', url);
  }
  setOrCreateMeta('property', 'og:type', 'website');
  setOrCreateMeta('property', 'og:site_name', 'Hightone Ceramic');

  // 4. Twitter / X Cards
  if (title) {
    setOrCreateMeta('name', 'twitter:title', title);
  }
  if (description) {
    setOrCreateMeta('name', 'twitter:description', description);
  }
  if (image) {
    setOrCreateMeta('name', 'twitter:image', image);
  }
  setOrCreateMeta('name', 'twitter:card', 'summary_large_image');

  // 5. Canonical Link
  if (url) {
    let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', 'canonical');
      document.head.appendChild(link);
    }
    link.setAttribute('href', url);
  }

  // 6. Schema.org JSON-LD Structured Data for Collection / Category
  if (categoryName) {
    let script = document.getElementById('dynamic-collection-seo-ldjson') as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement('script');
      script.id = 'dynamic-collection-seo-ldjson';
      script.type = 'application/ld+json';
      document.head.appendChild(script);
    }

    const currentUrl = url || (typeof window !== 'undefined' ? window.location.href : 'https://hightoneceramic.com');
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://hightoneceramic.com';

    const schemaData = {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: title || categoryName,
      description: description || `Browse vitrified sanitaryware models in ${categoryName} from Hightone Ceramic`,
      url: currentUrl,
      isPartOf: {
        '@type': 'WebSite',
        name: 'Hightone Ceramic',
        url: origin
      },
      breadcrumb: {
        '@type': 'BreadcrumbList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Home',
            item: origin
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Collections',
            item: `${origin}/#collections`
          },
          {
            '@type': 'ListItem',
            position: 3,
            name: categoryName,
            item: currentUrl
          }
        ]
      }
    };

    script.textContent = JSON.stringify(schemaData, null, 2);
  }
}
