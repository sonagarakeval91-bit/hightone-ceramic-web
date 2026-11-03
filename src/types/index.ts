export type PageId = 'home' | 'collections' | 'b2b' | 'about';

export type ProductCategory = string;

export interface CategoryMeta {
  id: ProductCategory;
  title: string;
  shortLabel: string;
  subtitle: string;
  tagBadge: string;
  description: string;
  coverImage: string;
  showOnHome?: boolean;
  order?: number;
  homeOrder?: number;
  relatedCollections?: string[];
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string;
}

export interface CollectionSeoMeta {
  title?: string;
  description?: string;
  keywords?: string;
}

export interface ProductItem {
  id: string;
  name: string;
  series: string;
  category: ProductCategory;
  tagBadge: string;
  subType: string;
  description: string;
  keyFeatures: string[];
  dimensions: {
    length: number;
    width: number;
    height: number;
    unit?: string; // 'mm' | 'Inch' | 'cm'
    formatted?: string; // e.g. '16" × 16" × 6" Inch' or '520 × 355 × 340 mm'
  };
  trapType: string; // e.g. "S-Trap 220mm/300mm", "P-Trap 180mm"
  flushType: string; // e.g. "Siphonic Vortex 3/6L", "Rimless Direct Wash"
  waterAbsorption: string; // e.g. "< 0.45% (Grade A Ceramic)"
  boxQuantity: string;
  moqUnits: number;
  featuredModels?: string[];
  imageUrl: string;
}

export interface B2BInquiryPayload {
  businessName: string;
  contactPerson: string;
  whatsappNumber: string;
  cityState: string;
  volume: string;
  productInterest: string;
  notes: string;
  timestamp?: string;
}

export interface SavedInquiry extends B2BInquiryPayload {
  id: string;
  source: string;
  status: 'new' | 'contacted' | 'quoted';
}

export interface DebugFinding {
  id: string;
  page: 'All Pages' | 'Home' | 'B2B Dealers' | 'Collections' | 'About' | 'Quote Modal';
  category: 'Typography & Layout' | 'Protocol & Links' | 'Form Validation' | 'Performance & Assets' | 'Design System Adherence';
  detail: string;
  microObservation: string;
  severity: 'Resolved' | 'Verified' | 'Attention';
  fixApplied: string;
}

export type AnalyticsEventType =
  | 'page_view'
  | 'collection_view'
  | 'product_view'
  | 'whatsapp_click'
  | 'call_click'
  | 'quote_open'
  | 'quote_submit'
  | 'catalog_download'
  | 'cookie_consent';

export interface AnalyticsEvent {
  id: string;
  type: AnalyticsEventType;
  target?: string;
  details?: string;
  page?: string;
  device?: 'mobile' | 'desktop' | 'tablet';
  timestamp: string;
  location?: {
    city?: string;
    region?: string;
    country?: string;
    countryCode?: string;
  };
}

export interface AnalyticsSummary {
  totalPageViews: number;
  totalUniqueSessions: number;
  totalWhatsAppClicks: number;
  totalCallClicks: number;
  totalQuoteSubmits: number;
  topCollections: { name: string; count: number }[];
  topProducts: { name: string; count: number }[];
  topLocations: { area: string; count: number; city?: string; region?: string; country?: string }[];
  recentEvents: AnalyticsEvent[];
}
