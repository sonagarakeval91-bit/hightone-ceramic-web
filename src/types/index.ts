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
  weightKg?: number;
  variantMode?: ProductVariantMode;
  defaultDesignCodes?: string[];
  defaultCode?: string;
}

export type CeramicGrade = 'Uty' | 'S.Uty' | 'ROK';
export type CeramicPacking = 'Box' | 'Paper';
export type ProductVariantMode = 'white-only' | 'color-glaze' | 'design-code' | 'default-code';

export interface ProductConfigOverride {
  productId: string;
  variantMode: ProductVariantMode;
  weightKg: number;
  availableDesignCodes?: string[];
  defaultCode?: string;
}

export interface ColorQuantitySplit {
  codeOrColor: string;
  quantity: number;
}

export interface B2BInquiryPayload {
  businessName: string;
  contactPerson: string;
  phoneCode?: string;
  whatsappNumber: string;
  country?: string;
  state?: string;
  district?: string;
  city?: string;
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

export interface DealerOrderItem {
  batchId?: string;
  productId: string;
  name: string;
  series: string;
  category: string;
  collectionName?: string;
  imageUrl?: string;
  trapType?: string;
  dimensions?: string;
  grade: CeramicGrade;
  packing: CeramicPacking;
  colorSplits: ColorQuantitySplit[];
  totalQuantity: number;
  unitWeightKg: number;
  totalWeightKg: number;
  piecesPerBox?: number;
}

export type AdminRole =
  | 'admin'
  | 'production-manager'
  | 'sales';

export type AdminPermission =
  | 'orders:verify'
  | 'orders:edit'
  | 'orders:complete'
  | 'orders:delete'
  | 'dealers:manage'
  | 'inquiries:manage'
  | 'inquiries:delete'
  | 'production:log'
  | 'production:check'
  | 'production:queue'
  | 'catalog:edit'
  | 'digital:edit'
  | 'system:cms'
  | 'system:location'
  | 'system:security';

export interface AdminStaffAccount {
  id: string;
  displayName: string;
  userId: string;
  password: string;
  role: AdminRole;
  staffEmail?: string;
  credHash?: string;
  active: boolean;
  createdAt: string;
}

export interface AdminSessionInfo {
  userId: string;
  displayName: string;
  role: AdminRole;
  isMasterOwner: boolean;
  staffEmail?: string;
}

export interface DealerVerificationChecklist {
  addressVerified: boolean;
  addressVerifiedBy?: string;
  addressVerifiedAt?: string;
  gstVerified: boolean;
  gstVerifiedBy?: string;
  gstVerifiedAt?: string;
  callVerified: boolean;
  callVerifiedBy?: string;
  callVerifiedAt?: string;
  businessVerified?: boolean;
  adminNotes?: string;
}

export type DealerApplicationStatus = 'pending' | 'approved' | 'rejected';

export interface DealerApplication {
  id: string;
  firmName: string;
  contactPerson: string;
  businessType: string;
  gstNumber: string;
  phoneCode: string;
  whatsappNumber: string;
  email: string;
  streetAddress: string;
  pincode: string;
  country: string;
  state: string;
  district: string;
  city: string;
  cityState: string;
  estimatedVolume: string;
  preferredCategories: string;
  notes: string;
  status: DealerApplicationStatus;
  verification: DealerVerificationChecklist;
  rejectionReason?: string;
  generatedAccountId?: string;
  issuedUserId?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
}

export interface DealerAccount {
  id: string;
  firmName: string;
  contactPerson: string;
  businessType: string;
  gstNumber: string;
  phoneCode: string;
  whatsappNumber: string;
  email: string;
  streetAddress: string;
  pincode: string;
  country: string;
  state: string;
  district: string;
  city: string;
  cityState: string;
  userId: string;
  password: string;
  active: boolean;
  applicationId?: string;
  verificationSummary?: string;
  createdAt: string;
  updatedAt?: string;
  lastLoginAt?: string;
  credHash?: string;
}

export interface DealerSession {
  accountId: string;
  userId: string;
  credHash?: string;
  firmName: string;
  contactPerson: string;
  businessType: string;
  gstNumber: string;
  phoneCode: string;
  whatsappNumber: string;
  email: string;
  streetAddress: string;
  pincode: string;
  country: string;
  state: string;
  district: string;
  city: string;
  cityState: string;
  signedInAt: string;
}

export type OrderVerificationStatus = 'pending' | 'accepted' | 'rejected';

export interface DealerOrderPayload {
  orderId: string;
  dispatchNo: string;
  vehicleNo?: string;
  personName: string;
  requiredDate?: string;
  requiredPeriod?: string;
  dealerAccountId?: string;
  dealerUserId?: string;
  dealerCredHash?: string;
  dealerEmail?: string;
  dealerGst?: string;
  dealerAddress?: string;
  lastEditedAt?: string;
  editCount?: number;
  dealerInfo: {
    firmName: string;
    contactPerson: string;
    phoneCode: string;
    phoneNumber: string;
    country: string;
    state: string;
    district: string;
    city: string;
    cityState: string;
    transporterHub?: string;
    notes?: string;
  };
  items: DealerOrderItem[];
  totalQuantity: number;
  totalModels: number;
  totalBatches?: number;
  totalWeightKg: number;
  timestamp?: string;
}

export interface SavedDealerOrder extends DealerOrderPayload {
  id: string;
  source: string;
  status: 'new' | 'processing' | 'dispatched' | 'completed';
  verificationStatus?: OrderVerificationStatus;
  availabilityStatus?: 'all-in-stock' | 'shortage-routed';
  productionRoutedCount?: number;
  rejectionReason?: string;
  verifiedBy?: string;
  verifiedAt?: string;
  completed?: boolean;
  completedAt?: string;
}

export interface DailyProductionEntry {
  id: string;
  date: string; // YYYY-MM-DD
  itemKey: string; // productId::PRE-SORT::codeOrColor (or legacy productId::grade::packing::codeOrColor)
  productId: string;
  productName: string;
  grade?: CeramicGrade | string;
  packing?: CeramicPacking | string;
  codeOrColor: string;
  quantityMade: number;
  recordedBy: string;
  notes?: string;
  createdAt: string;
}

export interface ProductionQueueItem {
  id: string;
  itemKey: string; // productId::PRE-SORT::codeOrColor (or legacy productId::grade::packing::codeOrColor)
  productId: string;
  productName: string;
  grade?: CeramicGrade | string;
  packing?: CeramicPacking | string;
  codeOrColor: string;
  quantityToMake: number;
  unitWeightKg: number;
  sourceType: 'order-shortage' | 'manual-catalog';
  sourceOrderId?: string;
  sourceOrderCode?: string;
  firmName?: string;
  dealerName?: string;
  requiredDate?: string;
  requiredPeriod?: string;
  notes?: string;
  addedBy: string;
  createdAt: string;
}

export interface MergedOrderRequirement {
  itemKey: string;
  productId: string;
  productName: string;
  grade?: CeramicGrade | string;
  packing?: CeramicPacking | string;
  codeOrColor: string;
  totalOrderedQty: number;
  unitWeightKg: number;
  totalWeightKg: number;
  earliestDueDate?: string;
  contributingOrders: Array<{
    id: string;
    orderId: string;
    firmName?: string;
    personName: string;
    quantity: number;
    requiredDate?: string;
    requiredPeriod?: string;
  }>;
  queueEntries?: ProductionQueueItem[];
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
  | 'collection_dwell'
  | 'product_view'
  | 'product_dwell'
  | 'whatsapp_click'
  | 'call_click'
  | 'quote_open'
  | 'quote_submit'
  | 'catalog_download'
  | 'cookie_consent'
  | 'precision_location_granted';

export interface AnalyticsEvent {
  id: string;
  type: AnalyticsEventType;
  target?: string;
  details?: string;
  page?: string;
  device?: 'mobile' | 'desktop' | 'tablet';
  timestamp: string;
  durationSeconds?: number;
  location?: {
    city?: string;
    district?: string;
    region?: string;
    postal?: string;
    country?: string;
    countryCode?: string;
    precision?: 'gps' | 'network';
    isp?: string;
    latitude?: number;
    longitude?: number;
  };
}

export interface LocationMarketInsight {
  area: string;
  city: string;
  district?: string;
  region: string;
  postal?: string;
  country: string;
  precision: 'gps' | 'network';
  isp?: string;
  totalVisits: number;
  totalDwellSeconds: number;
  collectionTimeSpent: { collectionName: string; seconds: number; views: number }[];
  productTimeSpent: { productName: string; seconds: number; views: number }[];
  whatsappClicks: number;
  callClicks: number;
  quoteSubmits: number;
  topDemandedCategory: string;
  commercialTakeaway: string;
}

export interface AnalyticsSummary {
  totalPageViews: number;
  totalUniqueSessions: number;
  totalWhatsAppClicks: number;
  totalCallClicks: number;
  totalQuoteSubmits: number;
  totalDwellSeconds: number;
  topCollections: { name: string; count: number; totalSeconds?: number }[];
  topProducts: { name: string; count: number; totalSeconds?: number }[];
  topLocations: { area: string; count: number; city?: string; district?: string; region?: string; postal?: string; country?: string; precision?: 'gps' | 'network' }[];
  locationMarketInsights: LocationMarketInsight[];
  recentEvents: AnalyticsEvent[];
}
