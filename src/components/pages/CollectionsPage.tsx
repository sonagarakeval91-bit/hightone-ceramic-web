import React, { useState, useEffect } from 'react';
import { PageId, ProductCategory, ProductItem, CategoryMeta } from '../../types';
import { useWebsiteData } from '../../context/DataContext';
import { 
  ArrowLeft, 
  ArrowRight, 
  PhoneCall, 
  MessageSquare, 
  Package,
  CheckCircle2,
  ZoomIn
} from 'lucide-react';
import { ProductDetailModal } from '../ProductDetailModal';
import { formatCategoryName, normalizeCategory, normalizeImageUrl, SiteMediaMap } from '../../services/googleSheetsService';
import { sanitizePhoneForWhatsApp, sanitizePhoneForTel } from '../../utils/phone';
import { updateDocumentSeo, generateRecommendedSeo } from '../../services/seoService';
import { trackEvent } from '../../services/analyticsService';

interface CollectionsPageProps {
  onNavigate: (page: PageId) => void;
  onOpenQuote: (productInterest?: string) => void;
  activeCategory?: string;
  onSelectCategory?: (category: string) => void;
}

export const CATEGORIES_META: CategoryMeta[] = [
  {
    id: 'one-piece',
    title: 'One Piece Closets',
    shortLabel: 'One Piece Closets',
    subtitle: 'Siphonic & Washdown Monolithic Water Closets',
    tagBadge: 'SIPHONIC & WASHDOWN',
    description: 'Monolithic single-piece ceramic water closets with integrated cistern tanks and concealed trapways.',
    coverImage: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=800&q=80',
    relatedCollections: ['Wall Hung Closets', 'Water Closets & Floor Mounts', 'Orissa Pan & Indian Closets']
  },
  {
    id: 'wall-hung',
    title: 'Wall Hung Closets',
    shortLabel: 'Wall Hung Closets',
    subtitle: 'Rimless Blind Fix Wall-Mounted Water Closets',
    tagBadge: 'RIMLESS BLIND FIX • 400KG LOAD TESTED',
    description: 'Floating wall-mounted ceramic water closets with dynamic 360° rimless flush and concealed mounting.',
    coverImage: 'https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?auto=format&fit=crop&w=800&q=80',
    relatedCollections: ['One Piece Closets', 'Water Closets & Floor Mounts', 'Commercial Urinals']
  },
  {
    id: 'floor-mount',
    title: 'Floor Mount Closets',
    shortLabel: 'Floor Mount Closets',
    subtitle: 'European Water Closets & Couple Suites',
    tagBadge: 'EUROPEAN WATER CLOSET',
    description: 'Floor-mounted European water closets engineered for heavy-duty residential and commercial installations.',
    coverImage: 'https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=800&q=80',
    relatedCollections: ['One Piece Closets', 'Wall Hung Closets', 'Orissa Pan & Indian Closets']
  },
  {
    id: 'orissa-pan',
    title: 'Orissa Pan',
    shortLabel: 'Orissa Pan',
    subtitle: '20" & 21" Deep Vitrified Squatting Pans',
    tagBadge: '20" & 21" DEEP PAN • AQUA RIM',
    description: 'High-density vitrified Indian squatting pans with integrated anti-slip textured footrests.',
    coverImage: 'https://images.unsplash.com/photo-1507652313519-d4e9174996dd?auto=format&fit=crop&w=800&q=80',
    relatedCollections: ['One Piece Closets', 'Floor Mount Closets', 'Orissa Pan Rustic Collection']
  },
  {
    id: 'table-top',
    title: 'Table Top Basins',
    shortLabel: 'Table Top Basins',
    subtitle: 'Designer Countertop Luxury Art Basins',
    tagBadge: 'DESIGNER VANITY • ULTRA SLIM EDGE',
    description: 'Contemporary countertop ceramic vanity art basins with razor-thin precision lip and nano-sheen glaze.',
    coverImage: 'https://images.unsplash.com/photo-1620626011761-996317b8d101?auto=format&fit=crop&w=800&q=80',
    relatedCollections: ['Basin with Pedestal', 'Half Wall Hung Basins', 'Wall Hung Basins']
  },
  {
    id: 'pedestal',
    title: 'Pedestal Basins',
    shortLabel: 'Pedestal Basins',
    subtitle: 'Full & Half Pedestal Ceramic Sets',
    tagBadge: 'FULL & HALF PEDESTAL SETS',
    description: 'Freestanding basin sets featuring solid ceramic pedestals, integrated soap ledges, and pre-punched faucet holes.',
    coverImage: 'https://images.unsplash.com/photo-160058515340-be6161a56a0c?auto=format&fit=crop&w=800&q=80',
    relatedCollections: ['Table Top Basins', 'Half Wall Hung Basins', 'Wall Hung Basins']
  },
  {
    id: 'urinal',
    title: 'Commercial Urinals',
    shortLabel: 'Commercial Urinals',
    subtitle: 'Water-Saving Institutional Ceramic Urinals',
    tagBadge: 'INSTITUTIONAL GRADE • ECO SPREADER',
    description: 'Heavy-duty ceramic urinals for high-traffic washrooms with deep parabolic bowls and eco spreaders.',
    coverImage: 'https://images.unsplash.com/photo-1595515106969-1ce29566ff1c?auto=format&fit=crop&w=800&q=80',
    relatedCollections: ['One Piece Closets', 'Wall Hung Closets']
  }
];

/**
 * Merges default category metadata with custom collections defined in Google Sheet.
 * Guarantees that ALL collections added to the Collections tab (7, 9, 12+) appear dynamically,
 * in the exact sequence specified by the user in their spreadsheet.
 */
export function buildMergedCategoriesList(
  collectionsMeta: Record<string, Partial<CategoryMeta>> | undefined,
  siteMedia: SiteMediaMap | undefined,
  products?: ProductItem[]
): CategoryMeta[] {
  const metaKeys = collectionsMeta ? Object.keys(collectionsMeta) : [];

  // When no sheet data is available, return the default 7 collections
  if (metaKeys.length === 0 && (!products || products.length === 0)) {
    return CATEGORIES_META.map((cat, idx) => ({
      ...cat,
      order: idx + 1
    }));
  }

  const list: CategoryMeta[] = [];
  const processedIds = new Set<string>();

  // Sort entries from collectionsMeta by their explicit order if provided, preserving sheet order
  const sortedEntries = Object.entries(collectionsMeta || {}).sort((a, b) => {
    const orderA = a[1].order ?? 999;
    const orderB = b[1].order ?? 999;
    return orderA - orderB;
  });

  for (const [rawId, meta] of sortedEntries) {
    const id = meta.id || rawId;
    if (processedIds.has(id)) continue;
    processedIds.add(id);

    const defaultCat = CATEGORIES_META.find((c) => c.id === id);
    const underscoreKey = `collection_${id.replace(/-/g, '_')}`;
    const dashKey = `collection_${id}`;
    const categoryKey = `category_${id}`;
    const mediaCover = siteMedia?.[underscoreKey] || siteMedia?.[dashKey] || siteMedia?.[categoryKey];

    const fallbackTitle = formatCategoryName(id);
    const resolvedTitle = meta.title || defaultCat?.title || fallbackTitle;
    const resolvedShort = meta.shortLabel || meta.title || defaultCat?.shortLabel || resolvedTitle;

    list.push({
      id,
      title: resolvedTitle,
      shortLabel: resolvedShort,
      subtitle: meta.subtitle || defaultCat?.subtitle || 'High-Density Vitrified Sanitaryware Collection',
      tagBadge: meta.tagBadge || defaultCat?.tagBadge || 'THANGADH CLUSTER DIRECT',
      description: meta.description || defaultCat?.description || 'Premium grade vitrified ceramic sanitaryware manufactured with high-purity clay slip and nano glaze finish.',
      coverImage: meta.coverImage || mediaCover || defaultCat?.coverImage || 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=800&q=80',
      showOnHome: meta.showOnHome,
      order: meta.order,
      homeOrder: meta.homeOrder,
      relatedCollections: meta.relatedCollections || defaultCat?.relatedCollections
    });
  }

  // Only fall back to default categories and products if NO collections were provided in the sheet
  if (metaKeys.length === 0) {
    // Include any default categories that weren't explicitly in collectionsMeta
    CATEGORIES_META.forEach((defaultCat, idx) => {
      if (!processedIds.has(defaultCat.id)) {
        const underscoreKey = `collection_${defaultCat.id.replace(/-/g, '_')}`;
        const dashKey = `collection_${defaultCat.id}`;
        const categoryKey = `category_${defaultCat.id}`;
        const mediaCover = siteMedia?.[underscoreKey] || siteMedia?.[dashKey] || siteMedia?.[categoryKey];

        list.push({
          ...defaultCat,
          coverImage: mediaCover || defaultCat.coverImage,
          order: defaultCat.order ?? (list.length + 1)
        });
        processedIds.add(defaultCat.id);
      }
    });

    // Also include any categories detected from products
    if (products && products.length > 0) {
      for (const p of products) {
        if (p.category && !processedIds.has(p.category)) {
          const catName = formatCategoryName(p.category);
          list.push({
            id: p.category,
            title: catName,
            shortLabel: catName,
            subtitle: 'Vitrified Sanitaryware Collection',
            tagBadge: 'THANGADH CLUSTER DIRECT',
            description: 'Premium grade vitrified ceramic sanitaryware manufactured with high-purity clay slip and nano glaze finish.',
            coverImage: p.imageUrl || 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=800&q=80',
            order: list.length + 1
          });
          processedIds.add(p.category);
        }
      }
    }
  }

  // Ensure full sorted order
  list.sort((a, b) => {
    const oA = a.order ?? 999;
    const oB = b.order ?? 999;
    return oA - oB;
  });

  return list;
}

/**
 * Resolves the related categories to display in the subpage collection switcher.
 * - Always includes the active collection first (so the user knows where they are).
 * - Matches related collections specified in the Google Sheet (via 'related_collection' column).
 * - Matches by id, slug, title, or shortLabel (case-insensitive & whitespace tolerant).
 * - If no related collections are specified for this collection, falls back to smart sibling categories
 *   (e.g., closet types with closets, basin types with basins) capped at 4 items max, so the mobile
 *   view NEVER gets clogged by 20+ buttons!
 */
export function getRelatedCategories(
  selectedCat: CategoryMeta | undefined,
  allCategories: CategoryMeta[]
): CategoryMeta[] {
  if (!selectedCat) return allCategories.slice(0, 4);

  const matchedList: CategoryMeta[] = [selectedCat];
  const addedIds = new Set<string>([selectedCat.id]);

  // If user provided explicit related collection names in Google Sheet:
  if (selectedCat.relatedCollections && selectedCat.relatedCollections.length > 0) {
    for (const relItem of selectedCat.relatedCollections) {
      const cleanRel = relItem.trim().toLowerCase();
      if (!cleanRel) continue;
      const cleanSlug = normalizeCategory(cleanRel);

      const found = allCategories.find((cat) => {
        if (addedIds.has(cat.id)) return false;
        const catIdNorm = normalizeCategory(cat.id);
        const catTitleLower = cat.title.toLowerCase().trim();
        const catShortLower = cat.shortLabel.toLowerCase().trim();

        return (
          catIdNorm === cleanSlug ||
          catTitleLower === cleanRel ||
          catShortLower === cleanRel ||
          catTitleLower.includes(cleanRel) ||
          cleanRel.includes(catTitleLower) ||
          catShortLower.includes(cleanRel) ||
          cleanRel.includes(catShortLower)
        );
      });

      if (found && !addedIds.has(found.id)) {
        matchedList.push(found);
        addedIds.add(found.id);
      }
    }
  } else {
    // Smart fallback if the Google Sheet row has not specified related_collection yet:
    // Group similar categories (closets with closets, basins with basins, pans with pans)
    const currentIdLower = selectedCat.id.toLowerCase();
    const currentTitleLower = selectedCat.title.toLowerCase();

    const isCloset = currentIdLower.includes('closet') || currentTitleLower.includes('closet') || currentIdLower === 'one-piece' || currentIdLower === 'wall-hung' || currentIdLower === 'floor-mount';
    const isBasin = currentIdLower.includes('basin') || currentTitleLower.includes('basin') || currentIdLower.includes('pedestal') || currentIdLower.includes('table-top');
    const isPan = currentIdLower.includes('pan') || currentTitleLower.includes('pan');

    const siblings = allCategories.filter((cat) => {
      if (addedIds.has(cat.id)) return false;
      const idL = cat.id.toLowerCase();
      const titleL = cat.title.toLowerCase();
      if (isCloset) {
        return idL.includes('closet') || titleL.includes('closet') || idL === 'one-piece' || idL === 'wall-hung' || idL === 'floor-mount';
      }
      if (isBasin) {
        return idL.includes('basin') || titleL.includes('basin') || idL.includes('pedestal') || idL.includes('table-top');
      }
      if (isPan) {
        return idL.includes('pan') || titleL.includes('pan');
      }
      return false;
    });

    // Add up to 3-4 siblings
    for (const sib of siblings.slice(0, 4)) {
      matchedList.push(sib);
      addedIds.add(sib.id);
    }

    // If still just 1, add next 3 categories from list
    if (matchedList.length <= 1) {
      for (const cat of allCategories) {
        if (!addedIds.has(cat.id)) {
          matchedList.push(cat);
          addedIds.add(cat.id);
          if (matchedList.length >= 4) break;
        }
      }
    }
  }

  return matchedList;
}

const hasValidTrap = (trap?: string | null): boolean => {
  if (!trap) return false;
  const trimmed = trap.trim();
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();
  const invalid = [
    'standard outlet',
    'standard',
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
    'not applicable',
    'empty',
    'undefined'
  ];
  return !invalid.includes(lower);
};

export const CollectionsPage: React.FC<CollectionsPageProps> = ({
  onNavigate,
  onOpenQuote,
  activeCategory = 'all',
  onSelectCategory
}) => {
  const { products, companyInfo, siteMedia, collectionsMeta, collectionSeoMap } = useWebsiteData();
  const [currentCategory, setCurrentCategory] = useState<string>(activeCategory);
  const [selectedProductForModal, setSelectedProductForModal] = useState<ProductItem | null>(null);

  useEffect(() => {
    if (activeCategory) {
      setCurrentCategory(activeCategory);
    }
  }, [activeCategory]);

  const handleSelectCategory = (catId: string) => {
    const foundCat = categoriesList.find((c) => c.id === catId);
    trackEvent('collection_view', foundCat?.title || catId, `Category: ${catId}`);
    setCurrentCategory(catId);
    if (onSelectCategory) {
      onSelectCategory(catId);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBackToAll = () => {
    setCurrentCategory('all');
    if (onSelectCategory) {
      onSelectCategory('all');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Build full dynamic categories list from Google Sheet (supporting 7, 9, 11, 15+ collections)
  const categoriesList = buildMergedCategoriesList(collectionsMeta, siteMedia, products);

  const selectedMeta = categoriesList.find((c) => c.id === currentCategory);

  // Dynamic Head Tags & SEO Updater for Collection Subpage
  useEffect(() => {
    if (currentCategory === 'all' || !selectedMeta) {
      updateDocumentSeo({
        title: 'Ceramic Sanitaryware Collections | Hightone Ceramic Thangadh Wholesale',
        description: 'Explore complete vitrified sanitaryware collections: One Piece Closets, Wall Hung Toilets, Table Top & Pedestal Basins direct from Thangadh manufacturer.',
        keywords: 'sanitaryware collections, ceramic manufacturer thangadh, wholesale toilets india, vitrified sanitaryware gujarat',
        url: typeof window !== 'undefined' ? `${window.location.origin}/#collections` : undefined,
        categoryName: 'Sanitaryware Collections'
      });
      return;
    }

    // Check custom SEO overrides (from hidden CMS panel or Google Sheet)
    const customSeo = collectionSeoMap[currentCategory] || {};
    const sheetSeoTitle = selectedMeta.seoTitle;
    const sheetSeoDesc = selectedMeta.seoDescription;
    const sheetSeoKeywords = selectedMeta.seoKeywords;

    const recommended = generateRecommendedSeo(selectedMeta);

    const finalTitle = customSeo.title || sheetSeoTitle || recommended.title;
    const finalDescription = customSeo.description || sheetSeoDesc || recommended.description;
    const finalKeywords = customSeo.keywords || sheetSeoKeywords || recommended.keywords;
    const finalImage = selectedMeta.coverImage ? normalizeImageUrl(selectedMeta.coverImage) : undefined;
    const currentUrl = typeof window !== 'undefined' ? `${window.location.origin}/#collections/${currentCategory}` : undefined;

    updateDocumentSeo({
      title: finalTitle,
      description: finalDescription,
      keywords: finalKeywords,
      image: finalImage,
      url: currentUrl,
      categoryName: selectedMeta.title
    });
  }, [currentCategory, selectedMeta, collectionSeoMap]);

  // Dynamic related collections for quick switching without pushing product grid down on mobile
  const switchCollectionsList = getRelatedCategories(selectedMeta, categoriesList);
  const relatedCategories = switchCollectionsList.filter((cat) => cat.id !== currentCategory);

  // Products belonging strictly to the selected category (or all)
  const categoryProducts = currentCategory === 'all'
    ? products
    : products.filter((p) => {
        const pCat = normalizeCategory(p.category);
        const curCat = normalizeCategory(currentCategory);
        return (
          pCat === curCat ||
          p.category.trim().toLowerCase() === currentCategory.trim().toLowerCase()
        );
      });

  return (
    <div className="space-y-8 sm:space-y-12 pb-16">

      {/* VIEW A: MAIN COLLECTIONS DIRECTORY (When currentCategory === 'all') */}
      {currentCategory === 'all' ? (
        <>
          {/* Header Banner */}
          <section className="bg-white border-b border-[#e2e8f0] py-8 sm:py-12">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="space-y-2">
                  <div className="inline-flex items-center space-x-2 px-3 py-1 bg-white/85 backdrop-blur-md rounded-full text-xs font-semibold text-[#0F2E52] border border-slate-200/90 shadow-2xs">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="font-sans uppercase tracking-wider text-[10px] sm:text-[11px]">
                      HIGHTONE CERAMIC • THANGADH CLUSTER
                    </span>
                  </div>
                  <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold text-[#0F2E52] tracking-tight">
                    Sanitaryware Collections
                  </h1>
                  <p className="text-xs sm:text-sm text-[#515f74] max-w-2xl leading-relaxed">
                    Select a collection category to view dimensions and trap options manufactured directly at our Thangadh unit.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    onClick={() => onOpenQuote('Complete Ceramic Sanitaryware Catalog')}
                    className="px-4 py-2 sm:px-5 sm:py-2.5 bg-[#0F2E52] hover:bg-[#1e3a5f] text-white text-xs font-semibold rounded-[3px] transition-colors shadow-xs cursor-pointer"
                  >
                    Request Full Price List
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Category Directory Grid (2-Column Grid on Mobile, Medium Squares) */}
          <section className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
            <div className="mb-4 sm:mb-6 flex items-center justify-between pb-2 sm:pb-3 border-b border-[#e2e8f0]">
              <span className="text-[11px] sm:text-xs font-bold uppercase tracking-[0.15em] text-[#64748b]">
                COLLECTION CATEGORIES ({categoriesList.length})
              </span>
              <span className="text-[11px] sm:text-xs text-[#515f74]">
                Tap to explore models
              </span>
            </div>

            {/* Responsive grid: 2 cols on mobile (medium/small squares), 3 cols on tablet/desktop */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-3 sm:gap-6">
              {categoriesList.map((cat) => {
                const count = products.filter((p) => {
                  const pCat = normalizeCategory(p.category);
                  const curCat = normalizeCategory(cat.id);
                  return pCat === curCat || p.category.trim().toLowerCase() === cat.id.trim().toLowerCase();
                }).length;
                return (
                  <div
                    key={cat.id}
                    className="bg-white border border-[#cbd5e1] hover:border-[#0F2E52] rounded-[4px] overflow-hidden flex flex-col justify-between shadow-2xs hover:shadow-md transition-all duration-300 group cursor-pointer"
                    onClick={() => handleSelectCategory(cat.id)}
                  >
                    <div>
                      {/* Photo Area: Edge-to-edge cover in square without letterbox lines */}
                      <div className="relative aspect-4/3 sm:aspect-16/10 bg-[#f1f5f9] overflow-hidden">
                        <img
                          src={normalizeImageUrl(cat.coverImage)}
                          alt={cat.title}
                          referrerPolicy="no-referrer"
                          loading="lazy"
                          onError={(e) => {
                            const defaultImg = CATEGORIES_META.find((c) => c.id === cat.id)?.coverImage || 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=800&q=80';
                            if (e.currentTarget.src !== defaultImg) {
                              e.currentTarget.src = defaultImg;
                            }
                          }}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#001936]/60 via-transparent to-transparent opacity-60 pointer-events-none" />

                        {/* Tag Badge with Frosted Glass Effect (Image 1 Style) */}
                        <div className="absolute top-1.5 left-1.5 sm:top-2.5 sm:left-2.5 z-30 max-w-[calc(100%-8px)]">
                          <span className="inline-flex items-center gap-1 sm:gap-1.5 px-2 py-0.5 sm:px-3 sm:py-1 rounded-full bg-white/25 hover:bg-white/35 backdrop-blur-md text-white text-[7px] min-[360px]:text-[7.5px] sm:text-[10px] font-sans font-semibold tracking-tight sm:tracking-wider uppercase border border-white/40 shadow-sm transition-all whitespace-nowrap">
                            <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-cyan-300 shrink-0 shadow-[0_0_5px_rgba(103,232,249,0.9)]" />
                            <span className="whitespace-nowrap">{cat.tagBadge}</span>
                          </span>
                        </div>

                        {/* Model Count Badge with Frosted Glass Effect */}
                        <div className="absolute bottom-2 right-2 sm:bottom-3 sm:right-3 z-30">
                          <span className="inline-flex items-center px-2 py-0.5 sm:px-2.5 sm:py-0.5 rounded-full bg-black/40 hover:bg-black/55 backdrop-blur-md text-white text-[8.5px] sm:text-[10px] font-sans font-medium border border-white/25 shadow-xs transition-all">
                            {count > 0 ? `${count} ${count === 1 ? 'Model' : 'Models'}` : 'Catalog Ready'}
                          </span>
                        </div>
                      </div>

                      {/* Content Body: Clean, No Bulky Pills */}
                      <div className="p-3 sm:p-5 space-y-1.5 sm:space-y-2">
                        <h2 className="font-display text-xs sm:text-base lg:text-lg font-bold text-[#0F2E52] group-hover:text-[#1e3a5f] transition-colors leading-snug line-clamp-2">
                          {cat.title}
                        </h2>
                        
                        <p className="text-[10px] sm:text-xs text-[#515f74] line-clamp-1 sm:line-clamp-2 leading-relaxed">
                          {cat.subtitle}
                        </p>
                      </div>
                    </div>

                    {/* Bottom CTA Button */}
                    <div className="p-3 sm:p-5 pt-0 mt-1 sm:mt-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectCategory(cat.id);
                        }}
                        className="w-full py-1.5 sm:py-2 px-2 sm:px-3 bg-[#f8fafc] group-hover:bg-[#0F2E52] text-[#0F2E52] group-hover:text-white border border-[#cbd5e1] group-hover:border-[#0F2E52] rounded-[3px] text-[10px] sm:text-xs font-bold transition-all flex items-center justify-center space-x-1 sm:space-x-1.5 cursor-pointer"
                      >
                        <span className="truncate">
                          {cat.shortLabel.trim().toLowerCase().startsWith('view')
                            ? cat.shortLabel.trim()
                            : `View ${cat.shortLabel.trim()}`}
                        </span>
                        <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform shrink-0" />
                      </button>
                    </div>

                  </div>
                );
              })}
            </div>
          </section>
        </>
      ) : (

        /* VIEW B: DEDICATED COLLECTION SUBPAGE (When currentCategory !== 'all') */
        <>
          {/* Subpage Breadcrumb Bar */}
          <div className="bg-white border-b border-[#e2e8f0] sticky top-18 z-30 shadow-2xs">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              
              {/* Back to All Collections Button */}
              <button
                onClick={handleBackToAll}
                className="inline-flex items-center space-x-2 text-xs font-bold text-[#0F2E52] hover:text-[#1e3a5f] bg-[#f2f4f6] hover:bg-[#e2e8f0] px-3 py-1.5 rounded-[3px] border border-[#cbd5e1] transition-colors cursor-pointer select-none"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>All Collections</span>
              </button>

              {/* Breadcrumb Path */}
              <div className="flex items-center space-x-2 text-xs font-mono text-[#64748b]">
                <button
                  onClick={handleBackToAll}
                  className="hover:text-[#0F2E52] hover:underline cursor-pointer"
                >
                  COLLECTIONS
                </button>
                <span>/</span>
                <span className="font-bold text-[#0F2E52] uppercase truncate max-w-[200px] sm:max-w-none">
                  {selectedMeta?.title || currentCategory}
                </span>
              </div>

            </div>
          </div>

          {/* Subpage Header Banner (Compact on mobile so product grid is immediately visible) */}
          {selectedMeta && (
            <section className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
              <div className="bg-white border border-[#cbd5e1] rounded-[4px] p-4 sm:p-7 shadow-xs">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 items-center">
                  
                  {/* Left Column: Title and Actions */}
                  <div className="lg:col-span-7 space-y-2.5 sm:space-y-4">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#001936] text-white text-[10.5px] font-sans font-semibold uppercase tracking-wider border border-white/15 shadow-xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0 shadow-[0_0_6px_rgba(34,211,238,0.7)]" />
                      <span>{selectedMeta.tagBadge}</span>
                    </div>

                    <h1 className="font-display text-xl sm:text-3xl lg:text-4xl font-bold text-[#0F2E52]">
                      {selectedMeta.title}
                    </h1>

                    <p className="text-xs sm:text-sm font-semibold text-[#1e3a5f]">
                      {selectedMeta.subtitle}
                    </p>

                    <p className="text-xs text-[#515f74] leading-relaxed max-w-xl">
                      {selectedMeta.description}
                    </p>

                    {/* Action Buttons */}
                    <div className="pt-1 sm:pt-2 flex flex-wrap gap-2 sm:gap-2.5">
                      <a
                        href={`https://wa.me/${sanitizePhoneForWhatsApp(companyInfo.primary_phone)}?text=${encodeURIComponent(
                          `Hello Hightone Ceramic, I am inquiring about wholesale pricing and catalog for ${selectedMeta.title}.`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 sm:px-4 sm:py-2 bg-[#25D366] hover:bg-[#20ba59] text-white text-[10px] sm:text-xs font-bold rounded-[3px] flex items-center space-x-1.5 transition-colors"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Inquire on WhatsApp</span>
                      </a>

                      <button
                        onClick={() => onOpenQuote(`${selectedMeta.title}`)}
                        className="px-3 py-1.5 sm:px-4 sm:py-2 bg-[#0F2E52] hover:bg-[#1e3a5f] text-white text-[10px] sm:text-xs font-semibold rounded-[3px] transition-colors cursor-pointer"
                      >
                        Request Dealer Quote
                      </button>

                      <a
                        href={sanitizePhoneForTel(companyInfo.primary_phone)}
                        className="px-3 py-1.5 sm:px-3.5 sm:py-2 bg-white border border-[#cbd5e1] hover:border-[#0F2E52] text-[#0F2E52] text-[10px] sm:text-xs font-semibold rounded-[3px] flex items-center space-x-1.5 transition-colors"
                      >
                        <PhoneCall className="w-3.5 h-3.5" />
                        <span>Call Plant Desk</span>
                      </a>
                    </div>
                  </div>

                  {/* Right Column: Hero Photo (Shown on lg desktop screens to avoid pushing product grid off mobile screens) */}
                  <div className="hidden lg:block lg:col-span-5">
                    <div className="relative aspect-16/10 rounded-[3px] overflow-hidden border border-[#cbd5e1] bg-[#071324] shadow-sm">
                      <img
                        src={normalizeImageUrl(selectedMeta.coverImage)}
                        alt=""
                        aria-hidden="true"
                        referrerPolicy="no-referrer"
                        className="absolute inset-0 w-full h-full object-cover blur-md scale-110 opacity-40 pointer-events-none"
                      />
                      <img
                        src={normalizeImageUrl(selectedMeta.coverImage)}
                        alt={selectedMeta.title}
                        referrerPolicy="no-referrer"
                        className="relative z-10 w-full h-full object-contain"
                      />
                      <div className="absolute bottom-2.5 left-2.5 z-20 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md text-white text-[10px] font-sans font-semibold tracking-wider uppercase border border-white/35 shadow-sm transition-all">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-300 shrink-0 shadow-[0_0_6px_rgba(103,232,249,0.9)]" />
                        <span>THANGADH PLANT SPECIFICATION</span>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            </section>
          )}



          {/* Products in This Subpage: Technical Specs (Dimension & Trap) */}
          <section className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
            <div className="mb-4 sm:mb-6 flex items-center justify-between pb-2 sm:pb-3 border-b border-[#e2e8f0]">
              <span className="text-[11px] sm:text-xs font-bold uppercase tracking-[0.15em] text-[#64748b]">
                MODELS IN THIS COLLECTION ({categoryProducts.length})
              </span>
              <span className="text-[11px] sm:text-xs text-[#515f74]">
                Thangadh direct supply
              </span>
            </div>

            {categoryProducts.length === 0 ? (
              <div className="p-10 text-center bg-white border border-[#e2e8f0] rounded-[3px] space-y-3">
                <Package className="w-8 h-8 text-[#64748b] mx-auto" />
                <div className="space-y-1">
                  <h3 className="font-display font-bold text-base text-[#0F2E52]">
                    No Models Currently Listed in Google Sheet for &quot;{selectedMeta?.title}&quot;
                  </h3>
                  <p className="text-xs text-[#515f74] max-w-md mx-auto leading-relaxed">
                    Add new rows in your Google Sheet under the <strong>Products</strong> tab with category <code>{currentCategory}</code>.
                  </p>
                </div>
                <div className="pt-2 flex justify-center gap-3">
                  <button
                    onClick={handleBackToAll}
                    className="px-4 py-2 bg-[#0F2E52] text-white text-xs font-semibold rounded-[3px]"
                  >
                    View All Collections
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-3 sm:gap-6">
                {categoryProducts.map((product, index) => (
                  <div
                    key={`${product.id}-${index}`}
                    onClick={() => setSelectedProductForModal(product)}
                    className="bg-white border border-[#cbd5e1] hover:border-[#0F2E52] rounded-[4px] overflow-hidden flex flex-col justify-between shadow-2xs hover:shadow-md transition-all duration-300 group cursor-pointer"
                  >
                    <div>
                      {/* Photo Area: Edge-to-edge clean cover in square without letterbox lines */}
                      <div className="relative aspect-4/3 sm:aspect-16/10 bg-[#f1f5f9] overflow-hidden border-b border-[#f1f5f9]">
                        <img
                          src={normalizeImageUrl(product.imageUrl)}
                          alt={product.name}
                          referrerPolicy="no-referrer"
                          loading="lazy"
                          onError={(e) => {
                            const fallback = normalizeImageUrl(selectedMeta?.coverImage || '') || 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=800&q=80';
                            if (e.currentTarget.src !== fallback) {
                              e.currentTarget.src = fallback;
                            }
                          }}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />

                        {/* Hover Overlay Prompt: Large View & Zoom */}
                        <div className="absolute inset-0 bg-[#001936]/35 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center p-2 pointer-events-none">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/95 backdrop-blur-md text-[#0F2E52] text-[10px] sm:text-xs font-semibold shadow-md transform translate-y-2 group-hover:translate-y-0 transition-transform duration-200">
                            <ZoomIn className="w-3.5 h-3.5 text-[#0F2E52]" />
                            <span>Click to Zoom &amp; Specs</span>
                          </span>
                        </div>
                      </div>

                      {/* Card Content: ONLY Dimension and Trap */}
                      <div className="p-3 sm:p-5 space-y-1.5 sm:space-y-2">
                        <div className="flex items-center justify-between text-[9px] sm:text-[10px] font-mono text-[#64748b] border-b border-[#f1f5f9] pb-1 sm:pb-1.5">
                          <span className="font-semibold text-[#0F2E52] truncate">{product.series}</span>
                        </div>

                        <div>
                          <h2 className="font-display text-xs sm:text-base font-bold text-[#0F2E52] group-hover:text-[#1e3a5f] transition-colors leading-snug line-clamp-2">
                            {product.name}
                          </h2>
                        </div>

                        {/* Technical Specs Box: ONLY Dimension and Trap */}
                        {((product.dimensions && product.dimensions.length > 0 && product.dimensions.width > 0) ||
                          (product.trapType && hasValidTrap(product.trapType))) && (
                          <div className="space-y-1 p-2 sm:p-2.5 bg-[#f8fafc] border border-[#e2e8f0] rounded-[2px] text-[10px] sm:text-xs font-mono">
                            {product.dimensions && product.dimensions.length > 0 && product.dimensions.width > 0 && (
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-0.5 sm:gap-2">
                                <span className="text-[#64748b] shrink-0 font-semibold">Dimensions:</span>
                                <span className="font-bold text-[#0F2E52] sm:text-right truncate">
                                  {product.dimensions.formatted || (
                                    `${product.dimensions.length} × ${product.dimensions.width}${
                                      product.dimensions.height && product.dimensions.height > 0 ? ` × ${product.dimensions.height}` : ''
                                    } ${product.dimensions.unit || (product.dimensions.length <= 50 ? 'Inch' : 'mm')}`
                                  )}
                                </span>
                              </div>
                            )}

                            {product.trapType && hasValidTrap(product.trapType) ? (
                              <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-0.5 sm:gap-2 ${
                                product.dimensions && product.dimensions.length > 0 ? 'pt-1 border-t border-[#f1f5f9]' : ''
                              }`}>
                                <span className="text-[#64748b] shrink-0 font-semibold">Trap:</span>
                                <span className="text-[#0F2E52] font-semibold sm:text-right truncate" title={product.trapType}>
                                  {product.trapType}
                                </span>
                              </div>
                            ) : null}
                          </div>
                        )}

                      </div>
                    </div>

                    {/* Bottom Action Buttons: Compact 2-column action matching grid */}
                    <div className="p-2.5 sm:p-4 pt-0 mt-1 sm:mt-2">
                      <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                        <a
                          href={`https://wa.me/${sanitizePhoneForWhatsApp(companyInfo.primary_phone)}?text=${encodeURIComponent(
                            `Hello Hightone Ceramic, I need ex-factory price and dispatch schedule for ${product.name} (${product.series}).`
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => {
                            e.stopPropagation();
                            trackEvent('whatsapp_click', `Product: ${product.name}`, `Series: ${product.series}`);
                          }}
                          className="py-1.5 sm:py-2 px-1.5 bg-[#25D366] hover:bg-[#20ba59] text-white text-[10px] sm:text-xs font-bold rounded-[2px] flex items-center justify-center space-x-1 transition-colors text-center"
                        >
                          <MessageSquare className="w-3 h-3 sm:w-3.5 sm:h-3.5 shrink-0" />
                          <span className="truncate">WhatsApp</span>
                        </a>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenQuote(`${product.name} (${product.series})`);
                          }}
                          className="py-1.5 sm:py-2 px-1.5 bg-[#0F2E52] hover:bg-[#1e3a5f] text-white text-[10px] sm:text-xs font-semibold rounded-[2px] flex items-center justify-center space-x-1 transition-colors cursor-pointer text-center"
                        >
                          <span className="truncate">Inquire</span>
                        </button>
                      </div>
                    </div>

                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Related Collections Section at the end of all products */}
          {relatedCategories.length > 0 && (
            <section className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 mt-10 pt-8 border-t border-[#cbd5e1]">
              <div className="bg-[#f8fafc] border border-[#cbd5e1] rounded-[6px] p-4 sm:p-7 shadow-xs">
                
                {/* Header with Title and "All Collections" Link */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 sm:mb-6 border-b border-[#e2e8f0]">
                  <div>
                    <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.15em] text-[#64748b] block">
                      EXPLORE MORE CERAMICS
                    </span>
                    <h3 className="font-display text-lg sm:text-2xl font-bold text-[#0F2E52]">
                      Related Collections
                    </h3>
                    <p className="text-xs text-[#515f74] mt-0.5">
                      Explore companion sanitaryware collections matching {selectedMeta?.title || 'this category'}
                    </p>
                  </div>

                  <button
                    onClick={handleBackToAll}
                    className="inline-flex items-center space-x-1.5 text-xs font-bold text-[#0F2E52] hover:text-[#1e3a5f] bg-white hover:bg-[#f1f5f9] px-3.5 py-2 rounded-[3px] border border-[#cbd5e1] transition-all cursor-pointer self-start sm:self-auto shadow-2xs"
                  >
                    <span>All Collections ({categoriesList.length})</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Related Collection Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                  {relatedCategories.map((cat) => (
                    <div
                      key={cat.id}
                      onClick={() => handleSelectCategory(cat.id)}
                      className="group bg-white hover:bg-[#fcfdfd] border border-[#cbd5e1] hover:border-[#0F2E52] rounded-[4px] overflow-hidden flex flex-col justify-between shadow-2xs hover:shadow-md transition-all duration-300 cursor-pointer"
                    >
                      {/* Optional Image Preview if available */}
                      {cat.coverImage && (
                        <div className="relative aspect-16/9 bg-[#f1f5f9] overflow-hidden border-b border-[#f1f5f9]">
                          <img
                            src={normalizeImageUrl(cat.coverImage)}
                            alt={cat.title}
                            referrerPolicy="no-referrer"
                            loading="lazy"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          />
                          <div className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2 z-20 max-w-[calc(100%-8px)]">
                            <span className="inline-flex items-center gap-1 sm:gap-1.5 px-2 py-0.5 sm:px-3 sm:py-0.5 rounded-full bg-white/25 hover:bg-white/35 backdrop-blur-md text-white text-[7px] min-[360px]:text-[7.5px] sm:text-[10px] font-sans font-semibold tracking-tight sm:tracking-wider uppercase border border-white/40 shadow-xs whitespace-nowrap transition-all">
                              <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-cyan-300 shrink-0 shadow-[0_0_5px_rgba(103,232,249,0.9)]" />
                              <span className="whitespace-nowrap">{cat.tagBadge || 'Sanitaryware'}</span>
                            </span>
                          </div>
                        </div>
                      )}

                      <div className="p-3 sm:p-4 space-y-1.5 flex-1 flex flex-col justify-between">
                        <div>
                          {!cat.coverImage && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#f1f5f9] text-[#0F2E52] text-[9.5px] font-sans font-semibold uppercase tracking-wider mb-1.5 border border-slate-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 shrink-0" />
                              <span>{cat.tagBadge || 'Collection'}</span>
                            </span>
                          )}
                          <h4 className="font-display text-sm sm:text-base font-bold text-[#0F2E52] group-hover:text-[#1e3a5f] transition-colors line-clamp-1">
                            {cat.title}
                          </h4>
                          <p className="text-xs text-[#515f74] line-clamp-2 mt-1 leading-relaxed">
                            {cat.subtitle || cat.description}
                          </p>
                        </div>

                        <div className="pt-3 mt-2 border-t border-[#f1f5f9] flex items-center justify-between text-xs font-bold text-[#0F2E52] group-hover:text-[#1e3a5f]">
                          <span>Explore {cat.shortLabel}</span>
                          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Quick Switch Buttons Row at the bottom */}
                <div className="mt-5 pt-4 border-t border-[#e2e8f0] flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748b] mr-1">
                    Quick Jump:
                  </span>
                  {relatedCategories.map((cat) => (
                    <button
                      key={`btn-${cat.id}`}
                      onClick={() => handleSelectCategory(cat.id)}
                      className="px-2.5 py-1 text-[11px] font-semibold rounded-[3px] bg-white hover:bg-[#0F2E52] text-[#334155] hover:text-white border border-[#cbd5e1] hover:border-[#0F2E52] transition-colors cursor-pointer"
                    >
                      {cat.shortLabel}
                    </button>
                  ))}
                  <button
                    onClick={handleBackToAll}
                    className="px-2.5 py-1 text-[11px] font-bold rounded-[3px] bg-[#0F2E52] text-white hover:bg-[#1e3a5f] transition-colors cursor-pointer"
                  >
                    View All Collections →
                  </button>
                </div>

              </div>
            </section>
          )}
        </>
      )}

      {/* Large View Modal with Interactive Zoom In / Zoom Out and Specs */}
      <ProductDetailModal
        product={selectedProductForModal}
        allProducts={categoryProducts}
        categoryMeta={selectedMeta}
        isOpen={!!selectedProductForModal}
        onClose={() => setSelectedProductForModal(null)}
        onSelectProduct={(p) => setSelectedProductForModal(p)}
        onOpenQuote={onOpenQuote}
      />

    </div>
  );
};
