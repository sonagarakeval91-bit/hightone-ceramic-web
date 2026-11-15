import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  AdminRole,
  AdminSessionInfo,
  ProductItem,
  CategoryMeta,
  CollectionSeoMeta,
  B2BInquiryPayload,
  SavedInquiry,
  DealerOrderPayload,
  SavedDealerOrder,
  ProductConfigOverride,
  DailyProductionEntry,
  ProductionQueueItem,
  CeramicGrade,
  CeramicPacking,
  DealerApplication,
  DealerAccount,
  DealerSession,
  DealerVerificationChecklist
} from '../types';
import { PRODUCTS_CATALOG, WHOLESALE_FAQS } from '../data/products';
import { DEFAULT_FACTORY_COLORS, DEFAULT_DESIGN_CODES, getDefaultProductConfig } from '../data/productClassifications';
import { normalizeAdminRole, ROLE_DEFINITIONS, STORAGE_KEY_ADMIN_SESSION } from '../utils/adminRoles';
import {
  SiteMediaMap,
  CompanyInfoMap,
  LegalPoliciesMap,
  DEFAULT_SITE_MEDIA,
  DEFAULT_COMPANY_INFO,
  extractGoogleSheetId,
  fetchAllDataFromGoogleSheet,
  cleanGoogleMapsEmbedUrl
} from '../services/googleSheetsService';
import {
  getSavedInquiries,
  getSheetWebhookUrl,
  saveSheetWebhookUrl,
  recordNewInquiry,
  updateSavedInquiry,
  removeInquiry,
  clearAllSavedInquiries,
  downloadInquiriesCSV,
  copyInquiriesForGoogleSheets,
  getSavedDealerOrders,
  recordNewDealerOrder,
  updateSavedDealerOrder,
  applyDealerOrderEdit,
  acceptSavedDealerOrder,
  rejectSavedDealerOrder,
  toggleSavedDealerOrderCompleted,
  removeCompletedSavedDealerOrders,
  removeDealerOrder,
  clearAllDealerOrders,
  downloadDealerOrdersCSV
} from '../services/inquiryStorageService';
import {
  NewDealerApplicationInput,
  buildSessionFromAccount,
  createDealerApplication,
  getActiveDealerSession,
  getDealerAccounts,
  getDealerApplications,
  isApplicationKycReady,
  saveActiveDealerSession,
  saveDealerAccounts,
  saveDealerApplications,
  updateApplicationVerificationChecklist
} from '../services/dealerPortalService';
import {
  getStoredCollectionSeo,
  updateSingleCollectionSeo,
  removeSingleCollectionSeo
} from '../services/seoService';
import { CATEGORIES_META } from '../components/pages/CollectionsPage';

interface DataContextType {
  products: ProductItem[];
  faqs: { question: string; answer: string }[];
  siteMedia: SiteMediaMap;
  companyInfo: CompanyInfoMap;
  collectionsMeta: Record<string, Partial<CategoryMeta>>;
  legalPolicies: LegalPoliciesMap;
  sheetId: string | null;
  isSyncing: boolean;
  isInitializing: boolean;
  initProgress: number;
  lastSyncTime: string | null;
  syncError: string | null;
  connectSheet: (sheetIdOrUrl: string) => Promise<{ success: boolean; message: string }>;
  disconnectSheet: () => void;
  refreshData: () => Promise<{ success: boolean; message: string }>;
  // Inquiries and Sheet Saving
  inquiries: SavedInquiry[];
  sheetWebhookUrl: string;
  updateWebhookUrl: (url: string) => void;
  recordInquiry: (payload: B2BInquiryPayload, source: string) => Promise<{ success: boolean; id: string; webhookSent: boolean; message: string }>;
  updateInquiry: (id: string, updates: Partial<SavedInquiry>) => void;
  deleteInquiry: (id: string) => void;
  clearInquiries: () => void;
  downloadCSV: () => void;
  copyForSheets: () => Promise<boolean>;
  // Dealer Orders
  dealerOrders: SavedDealerOrder[];
  recordDealerOrder: (payload: DealerOrderPayload, source?: string) => Promise<{ success: boolean; id: string; webhookSent: boolean; message: string }>;
  saveDealerEditedOrder: (id: string, editedPayload: DealerOrderPayload) => { success: boolean; wasAccepted: boolean };
  updateDealerOrder: (id: string, updatedOrder: SavedDealerOrder) => void;
  acceptDealerOrder: (
    id: string,
    verifiedBy?: string,
    options?: {
      availabilityStatus?: 'all-in-stock' | 'shortage-routed';
      unavailableItems?: Omit<ProductionQueueItem, 'id' | 'createdAt'>[];
    }
  ) => void;
  rejectDealerOrder: (id: string, reason: string, verifiedBy?: string) => void;
  toggleDealerOrderCompleted: (id: string) => void;
  removeCompletedDealerOrders: () => void;
  deleteDealerOrder: (id: string) => void;
  clearDealerOrders: () => void;
  downloadDealerOrdersCSV: (options?: { hideDealerContact?: boolean }) => void;
  // Dealer Applications, KYC Verification & Dealer Accounts
  dealerApplications: DealerApplication[];
  dealerAccounts: DealerAccount[];
  dealerSession: DealerSession | null;
  submitDealerApplication: (input: NewDealerApplicationInput) => DealerApplication;
  updateDealerApplicationKyc: (appId: string, updates: Partial<DealerVerificationChecklist>, verifiedBy: string) => void;
  approveDealerApplication: (
    appId: string,
    credentials: { userId: string; password: string },
    reviewedBy: string
  ) => { success: boolean; message: string; account?: DealerAccount };
  rejectDealerApplication: (appId: string, reason: string, reviewedBy: string) => void;
  deleteDealerApplication: (appId: string) => void;
  createManualDealerAccount: (
    data: Omit<DealerAccount, 'id' | 'createdAt' | 'active'>
  ) => { success: boolean; message: string; account?: DealerAccount };
  updateDealerAccountRecord: (id: string, updates: Partial<DealerAccount>) => { success: boolean; message: string };
  toggleDealerAccountActive: (id: string) => void;
  deleteDealerAccountRecord: (id: string) => void;
  dealerSignIn: (userId: string, password: string) => { success: boolean; message: string; session?: DealerSession };
  dealerSignOut: () => void;
  // Production Manufacture Queue (Unavailable / Custom Items to Manufacture)
  productionQueue: ProductionQueueItem[];
  addProductionQueueItems: (items: Omit<ProductionQueueItem, 'id' | 'createdAt'>[]) => void;
  updateProductionQueueItem: (id: string, updates: Partial<Omit<ProductionQueueItem, 'id'>>) => void;
  deleteProductionQueueItem: (id: string) => void;
  clearProductionQueue: () => void;
  // Daily Production Ledger & Variant Ready Check-Off
  dailyProductionLogs: DailyProductionEntry[];
  productionCheckedKeys: Record<string, boolean>;
  addDailyProductionEntry: (entry: Omit<DailyProductionEntry, 'id' | 'createdAt'>) => void;
  updateDailyProductionEntry: (id: string, updates: Partial<Omit<DailyProductionEntry, 'id'>>) => void;
  setProductionProducedTotal: (
    item: {
      itemKey: string;
      productId: string;
      productName: string;
      grade: CeramicGrade;
      packing: CeramicPacking;
      codeOrColor: string;
    },
    targetTotal: number,
    recordedBy: string,
    note?: string
  ) => void;
  deleteDailyProductionEntry: (id: string) => void;
  clearDailyProductionLogs: () => void;
  toggleProductionItemChecked: (itemKey: string, nextVal?: boolean) => void;
  // Product Variant Modes & Weights (Admin-configurable)
  productConfigs: Record<string, ProductConfigOverride>;
  updateProductConfig: (productId: string, updates: Partial<ProductConfigOverride>) => void;
  resetProductConfigs: () => void;
  // Factory Color Palette
  colorsList: string[];
  addColor: (color: string) => void;
  renameColor: (oldColor: string, newColor: string) => void;
  removeColor: (color: string) => void;
  resetColors: () => void;
  // Factory Design Codes
  designCodesList: string[];
  addDesignCode: (code: string) => void;
  renameDesignCode: (oldCode: string, newCode: string) => void;
  removeDesignCode: (code: string) => void;
  resetDesignCodes: () => void;
  // Global Default Product Code (for Default Code mode / coded SKUs)
  globalDefaultCode: string;
  updateGlobalDefaultCode: (code: string) => void;
  resetGlobalDefaultCode: () => void;
  // Collection SEO overrides
  collectionSeoMap: Record<string, CollectionSeoMeta>;
  updateCollectionSeo: (collectionId: string, seo: CollectionSeoMeta) => void;
  resetCollectionSeo: (collectionId: string) => void;
  // Collection Ordering & Management
  updateCollectionsMeta: (updated: Record<string, Partial<CategoryMeta>>) => void;
  updateSingleCollectionOrder: (collectionId: string, orderUpdates: { order?: number; homeOrder?: number; showOnHome?: boolean }) => void;
  resetCollectionsOrder: () => void;
  // Company Info & Map Controls
  updateCompanyInfo: (updates: Partial<CompanyInfoMap>) => void;
  resetCompanyInfo: () => void;
  // Admin Role Session (App-level RBAC state)
  adminSession: AdminSessionInfo | null;
  activeAdminRole: AdminRole | null;
  loginWithRole: (role: AdminRole, displayName?: string) => void;
  setAdminSession: (session: AdminSessionInfo | null) => void;
  logoutAdminSession: () => void;
}

const STORAGE_KEY_SHEET_ID = 'hightone_gsheet_id';
const STORAGE_KEY_PRODUCTS = 'hightone_cached_products';
const STORAGE_KEY_MEDIA = 'hightone_cached_media';
const STORAGE_KEY_COMPANY = 'hightone_cached_company';
const STORAGE_KEY_FAQS = 'hightone_cached_faqs';
const STORAGE_KEY_COLLECTIONS = 'hightone_cached_collections_meta';
const STORAGE_KEY_LEGAL = 'hightone_cached_legal_policies';
const STORAGE_KEY_LAST_SYNC = 'hightone_last_sync_time';
const STORAGE_KEY_PRODUCT_CONFIGS = 'hightone_product_configs';
const STORAGE_KEY_COLORS = 'hightone_factory_colors';
const STORAGE_KEY_DESIGN_CODES = 'hightone_design_codes';
const STORAGE_KEY_GLOBAL_DEFAULT_CODE = 'hightone_global_default_code';
const STORAGE_KEY_PRODUCTION_LOGS = 'hightone_daily_production_logs';
const STORAGE_KEY_PRODUCTION_CHECKED = 'hightone_production_checked_keys';
const STORAGE_KEY_PRODUCTION_QUEUE = 'hightone_production_queue';

const DataContext = createContext<DataContextType | undefined>(undefined);

function cleanTrapValue(raw?: string | null): string {
  if (!raw) return '';
  const trimmed = raw.trim();
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
  if (invalid.includes(lower)) return '';
  return trimmed;
}

function ensureUniqueProducts(items: ProductItem[]): ProductItem[] {
  if (!Array.isArray(items)) return PRODUCTS_CATALOG;
  const seen = new Set<string>();
  return items.map((item, index) => {
    let id = item.id ? item.id.trim() : `p-${index}`;
    let counter = 1;
    while (seen.has(id)) {
      id = `${item.id || 'p'}-${counter}`;
      counter++;
    }
    seen.add(id);

    // If item was stored with legacy '600 x 400 x 750' fallback, check if catalog item has true dimensions
    let dimensions = item.dimensions;
    if (
      dimensions &&
      dimensions.length === 600 &&
      dimensions.width === 400 &&
      dimensions.height === 750
    ) {
      const match = PRODUCTS_CATALOG.find(
        (p) =>
          p.id.toLowerCase() === id.toLowerCase() ||
          p.name.toLowerCase() === (item.name || '').toLowerCase()
      );
      if (match && match.dimensions && (match.dimensions.length !== 600 || match.dimensions.width !== 400)) {
        dimensions = match.dimensions;
      }
    }

    // Ensure unit and formatted are populated for dimensions (handling Inch vs mm)
    if (dimensions && dimensions.length > 0 && dimensions.width > 0) {
      const descLower = (item.description || '').toLowerCase();
      const isInch =
        dimensions.unit?.toLowerCase().includes('inch') ||
        descLower.includes('inch') ||
        item.description?.includes('"') ||
        dimensions.length <= 50;

      const unit = dimensions.unit || (isInch ? 'Inch' : 'mm');
      const hasQuotes = item.description?.includes('"');
      const formatted =
        dimensions.formatted ||
        (unit === 'Inch'
          ? (hasQuotes
              ? `${dimensions.length}" × ${dimensions.width}"${dimensions.height && dimensions.height > 0 ? ` × ${dimensions.height}"` : ''} Inch`
              : `${dimensions.length} × ${dimensions.width}${dimensions.height && dimensions.height > 0 ? ` × ${dimensions.height}` : ''} Inch`)
          : `${dimensions.length} × ${dimensions.width}${dimensions.height && dimensions.height > 0 ? ` × ${dimensions.height}` : ''} ${unit}`);

      dimensions = {
        ...dimensions,
        unit,
        formatted
      };
    }

    return {
      ...item,
      id,
      dimensions: dimensions || { length: 0, width: 0, height: 0, unit: 'mm' },
      trapType: cleanTrapValue(item.trapType)
    };
  });
}

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sheetId, setSheetId] = useState<string | null>(() => {
    const envId = (import.meta as any).env?.VITE_GOOGLE_SHEET_ID 
      ? extractGoogleSheetId((import.meta as any).env.VITE_GOOGLE_SHEET_ID) 
      : null;
    return localStorage.getItem(STORAGE_KEY_SHEET_ID) || envId || '1_HzPz-BeTe0DcPIF6RLlCZFLSokNFJRqxZ46ZkiAfqQ';
  });

  const [products, setProducts] = useState<ProductItem[]>(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEY_PRODUCTS);
      if (cached) return ensureUniqueProducts(JSON.parse(cached));
    } catch {
      // fallback
    }
    return ensureUniqueProducts(PRODUCTS_CATALOG);
  });

  const [siteMedia, setSiteMedia] = useState<SiteMediaMap>(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEY_MEDIA);
      if (cached) return JSON.parse(cached);
    } catch {
      // fallback
    }
    return DEFAULT_SITE_MEDIA;
  });

  const [companyInfo, setCompanyInfo] = useState<CompanyInfoMap>(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEY_COMPANY);
      if (cached) {
        const parsed = JSON.parse(cached);
        // Clean and auto-migrate any obsolete/inaccurate map URLs
        if (parsed.google_maps_embed_url && parsed.google_maps_embed_url.includes('Orient')) {
          parsed.google_maps_embed_url = DEFAULT_COMPANY_INFO.google_maps_embed_url;
        } else {
          parsed.google_maps_embed_url = cleanGoogleMapsEmbedUrl(parsed.google_maps_embed_url) || DEFAULT_COMPANY_INFO.google_maps_embed_url;
        }
        if (!parsed.google_maps_url || parsed.google_maps_url.includes('Orient') || parsed.google_maps_url.includes('0x39590bbeb85e0745')) {
          parsed.google_maps_url = DEFAULT_COMPANY_INFO.google_maps_url;
        }
        if (!parsed.factory_address) {
          parsed.factory_address = DEFAULT_COMPANY_INFO.factory_address;
        }
        return parsed;
      }
    } catch {
      // fallback
    }
    return DEFAULT_COMPANY_INFO;
  });

  const updateCompanyInfo = (updates: Partial<CompanyInfoMap>) => {
    setCompanyInfo((prev) => {
      const merged: CompanyInfoMap = { ...prev };
      for (const [k, v] of Object.entries(updates)) {
        if (v !== undefined) {
          merged[k] = v;
        }
      }
      if (merged.google_maps_embed_url) {
        merged.google_maps_embed_url = cleanGoogleMapsEmbedUrl(merged.google_maps_embed_url) || DEFAULT_COMPANY_INFO.google_maps_embed_url;
      }
      localStorage.setItem(STORAGE_KEY_COMPANY, JSON.stringify(merged));
      return merged;
    });
  };

  const resetCompanyInfo = () => {
    setCompanyInfo(DEFAULT_COMPANY_INFO);
    localStorage.setItem(STORAGE_KEY_COMPANY, JSON.stringify(DEFAULT_COMPANY_INFO));
  };

  const [faqs, setFaqs] = useState<{ question: string; answer: string }[]>(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEY_FAQS);
      if (cached) return JSON.parse(cached);
    } catch {
      // fallback
    }
    return WHOLESALE_FAQS;
  });

  const [collectionsMeta, setCollectionsMeta] = useState<Record<string, Partial<CategoryMeta>>>(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEY_COLLECTIONS);
      if (cached) return JSON.parse(cached);
    } catch {
      // fallback
    }
    return {};
  });

  const [legalPolicies, setLegalPolicies] = useState<LegalPoliciesMap>(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEY_LEGAL);
      if (cached) return JSON.parse(cached);
    } catch {
      // fallback
    }
    return {};
  });

  // App-level RBAC Admin Session state
  const [adminSession, setAdminSessionState] = useState<AdminSessionInfo | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY_ADMIN_SESSION);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...parsed,
          role: normalizeAdminRole(parsed?.role)
        };
      }
    } catch {
      // fallback
    }
    if (sessionStorage.getItem('htc_sheet_admin_session') === 'unlocked') {
      return {
        userId: 'admin',
        displayName: 'Admin',
        role: 'admin',
        isMasterOwner: true
      };
    }
    return null;
  });

  const setAdminSession = (session: AdminSessionInfo | null) => {
    if (!session) {
      setAdminSessionState(null);
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('htc_sheet_admin_session');
        sessionStorage.removeItem(STORAGE_KEY_ADMIN_SESSION);
      }
      return;
    }
    const normalized: AdminSessionInfo = {
      ...session,
      role: normalizeAdminRole(session.role)
    };
    setAdminSessionState(normalized);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('htc_sheet_admin_session', 'unlocked');
      sessionStorage.setItem(STORAGE_KEY_ADMIN_SESSION, JSON.stringify(normalized));
    }
  };

  const loginWithRole = (role: AdminRole, displayName?: string) => {
    const normalizedRole = normalizeAdminRole(role);
    const meta = ROLE_DEFINITIONS[normalizedRole];
    const cleanName = (displayName || '').trim() || meta.label;
    setAdminSession({
      userId: normalizedRole,
      displayName: cleanName,
      role: normalizedRole,
      isMasterOwner: normalizedRole === 'admin'
    });
  };

  const logoutAdminSession = () => {
    setAdminSession(null);
  };

  const activeAdminRole: AdminRole | null = adminSession
    ? normalizeAdminRole(adminSession.role)
    : null;

  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isInitializing, setIsInitializing] = useState<boolean>(false);
  const [initProgress, setInitProgress] = useState<number>(100);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(() => {
    return localStorage.getItem(STORAGE_KEY_LAST_SYNC);
  });
  const [syncError, setSyncError] = useState<string | null>(null);

  // Sync with Google Sheet if sheetId is configured
  const syncWithSheet = async (targetId: string): Promise<{ success: boolean; message: string }> => {
    setIsSyncing(true);
    setSyncError(null);
    try {
      const data = await fetchAllDataFromGoogleSheet(targetId);
      const uniqueProducts = ensureUniqueProducts(data.products);
      setProducts(uniqueProducts);
      setSiteMedia(data.siteMedia);
      setCompanyInfo(data.companyInfo);
      setFaqs(data.faqs);
      setCollectionsMeta(data.collectionsMeta || {});
      setLegalPolicies(data.legalPolicies || {});

      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setLastSyncTime(timeStr);

      // Persist to local storage
      localStorage.setItem(STORAGE_KEY_SHEET_ID, targetId);
      localStorage.setItem(STORAGE_KEY_PRODUCTS, JSON.stringify(uniqueProducts));
      localStorage.setItem(STORAGE_KEY_MEDIA, JSON.stringify(data.siteMedia));
      localStorage.setItem(STORAGE_KEY_COMPANY, JSON.stringify(data.companyInfo));
      localStorage.setItem(STORAGE_KEY_FAQS, JSON.stringify(data.faqs));
      localStorage.setItem(STORAGE_KEY_COLLECTIONS, JSON.stringify(data.collectionsMeta || {}));
      localStorage.setItem(STORAGE_KEY_LEGAL, JSON.stringify(data.legalPolicies || {}));
      localStorage.setItem(STORAGE_KEY_LAST_SYNC, timeStr);

      if (data.adminCredentials) {
        localStorage.setItem('hightone_sheet_admin_user', data.adminCredentials.userId);
        localStorage.setItem('hightone_sheet_admin_pass', data.adminCredentials.password);
      }

      setSheetId(targetId);
      setIsSyncing(false);
      const collectionsCount = Object.keys(data.collectionsMeta || {}).length;
      return { 
        success: true, 
        message: `Successfully synced! Loaded ${data.products.length} products, ${collectionsCount} collections, and website content from Google Sheet.` 
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to connect to Google Sheet';
      setSyncError(message);
      setIsSyncing(false);
      return { success: false, message };
    }
  };

  const connectSheet = async (sheetIdOrUrl: string) => {
    const extractedId = extractGoogleSheetId(sheetIdOrUrl);
    if (!extractedId) {
      return { 
        success: false, 
        message: 'Invalid Google Sheet link or ID. Please check the URL and try again.' 
      };
    }
    return await syncWithSheet(extractedId);
  };

  const disconnectSheet = () => {
    localStorage.removeItem(STORAGE_KEY_SHEET_ID);
    localStorage.removeItem(STORAGE_KEY_PRODUCTS);
    localStorage.removeItem(STORAGE_KEY_MEDIA);
    localStorage.removeItem(STORAGE_KEY_COMPANY);
    localStorage.removeItem(STORAGE_KEY_FAQS);
    localStorage.removeItem(STORAGE_KEY_COLLECTIONS);
    localStorage.removeItem(STORAGE_KEY_LEGAL);
    localStorage.removeItem(STORAGE_KEY_LAST_SYNC);

    setSheetId(null);
    setProducts(PRODUCTS_CATALOG);
    setSiteMedia(DEFAULT_SITE_MEDIA);
    setCompanyInfo(DEFAULT_COMPANY_INFO);
    setFaqs(WHOLESALE_FAQS);
    setCollectionsMeta({});
    setLegalPolicies({});
    setLastSyncTime(null);
    setSyncError(null);
  };

  const refreshData = async (): Promise<{ success: boolean; message: string }> => {
    if (sheetId) {
      return await syncWithSheet(sheetId);
    }
    return { success: false, message: 'No Google Sheet connected.' };
  };

  // Silent background sync and warm-up: updates sheet data and caches images in background
  useEffect(() => {
    let isMounted = true;

    const backgroundInit = async () => {
      let currentProducts = products;
      let currentCollectionsMeta = collectionsMeta;
      let currentSiteMedia = siteMedia;

      // 1. Sync data from Google Sheet if connected
      if (sheetId) {
        try {
          const syncRes = await syncWithSheet(sheetId);
          if (syncRes.success) {
            try {
              const cachedProd = localStorage.getItem(STORAGE_KEY_PRODUCTS);
              if (cachedProd) currentProducts = JSON.parse(cachedProd);
              const cachedColl = localStorage.getItem(STORAGE_KEY_COLLECTIONS);
              if (cachedColl) currentCollectionsMeta = JSON.parse(cachedColl);
              const cachedMedia = localStorage.getItem(STORAGE_KEY_MEDIA);
              if (cachedMedia) currentSiteMedia = JSON.parse(cachedMedia);
            } catch {
              // fallback
            }
          }
        } catch {
          // If sheet connection is slow or fails, proceed with cached data
        }
      }

      if (!isMounted) return;

      // Done
    };

    backgroundInit();

    return () => {
      isMounted = false;
    };
  }, []);

  // Inquiries and Sheet Saving State
  const [inquiries, setInquiries] = useState<SavedInquiry[]>(() => getSavedInquiries());
  const [sheetWebhookUrl, setSheetWebhookUrlState] = useState<string>(() => getSheetWebhookUrl());

  const updateWebhookUrl = (url: string) => {
    saveSheetWebhookUrl(url);
    setSheetWebhookUrlState(url);
  };

  const recordInquiry = async (payload: B2BInquiryPayload, source: string) => {
    const res = await recordNewInquiry(payload, source);
    setInquiries(getSavedInquiries());
    return res;
  };

  const updateInquiry = (id: string, updates: Partial<SavedInquiry>) => {
    const updated = updateSavedInquiry(id, updates);
    setInquiries(updated);
  };

  const deleteInquiry = (id: string) => {
    const updated = removeInquiry(id);
    setInquiries(updated);
  };

  const clearInquiries = () => {
    clearAllSavedInquiries();
    setInquiries([]);
  };

  const downloadCSV = () => {
    downloadInquiriesCSV();
  };

  const copyForSheets = async () => {
    return await copyInquiriesForGoogleSheets();
  };

  // Dealer Orders State
  const [dealerOrders, setDealerOrders] = useState<SavedDealerOrder[]>(() => getSavedDealerOrders());

  const recordDealerOrder = async (payload: DealerOrderPayload, source: string = 'Dealer Order Portal') => {
    const res = await recordNewDealerOrder(payload, source);
    setDealerOrders(getSavedDealerOrders());
    return res;
  };

  const updateDealerOrder = (id: string, updatedOrder: SavedDealerOrder) => {
    const updated = updateSavedDealerOrder(id, updatedOrder);
    setDealerOrders(updated);
  };

  // Dealer Applications, KYC Checklist, Dealer Accounts & Session
  const [dealerApplications, setDealerApplications] = useState<DealerApplication[]>(() =>
    getDealerApplications()
  );
  const [dealerAccounts, setDealerAccounts] = useState<DealerAccount[]>(() => getDealerAccounts());
  const [dealerSession, setDealerSession] = useState<DealerSession | null>(() =>
    getActiveDealerSession()
  );

  const submitDealerApplication = (input: NewDealerApplicationInput): DealerApplication => {
    const created = createDealerApplication(input);
    setDealerApplications(getDealerApplications());
    return created;
  };

  const updateDealerApplicationKyc = (
    appId: string,
    updates: Partial<DealerVerificationChecklist>,
    verifiedBy: string
  ) => {
    const updated = updateApplicationVerificationChecklist(appId, updates, verifiedBy);
    setDealerApplications(updated);
  };

  const approveDealerApplication = (
    appId: string,
    credentials: { userId: string; password: string },
    reviewedBy: string
  ): { success: boolean; message: string; account?: DealerAccount } => {
    const targetApp = dealerApplications.find((a) => a.id === appId);
    if (!targetApp) {
      return { success: false, message: 'Dealer application record not found.' };
    }
    if (!isApplicationKycReady(targetApp)) {
      return {
        success: false,
        message: 'Complete Address, GST Number, and Call verification checks before approving.'
      };
    }

    const cleanUserId = credentials.userId.trim();
    const cleanPassword = credentials.password.trim();
    if (cleanUserId.length < 3 || cleanPassword.length < 4) {
      return {
        success: false,
        message: 'User ID must be at least 3 characters and Password at least 4 characters.'
      };
    }

    const duplicate = dealerAccounts.find(
      (acc) => acc.userId.trim().toLowerCase() === cleanUserId.toLowerCase()
    );
    if (duplicate) {
      return {
        success: false,
        message: `User ID "${cleanUserId}" is already assigned to ${duplicate.firmName}. Choose another ID.`
      };
    }

    const nowTime = new Date().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      dateStyle: 'medium',
      timeStyle: 'short'
    });

    const newAccount: DealerAccount = {
      id: `DLR-${Date.now().toString().slice(-6)}`,
      firmName: targetApp.firmName,
      contactPerson: targetApp.contactPerson,
      businessType: targetApp.businessType,
      gstNumber: targetApp.gstNumber,
      phoneCode: targetApp.phoneCode,
      whatsappNumber: targetApp.whatsappNumber,
      email: targetApp.email,
      streetAddress: targetApp.streetAddress,
      pincode: targetApp.pincode,
      country: targetApp.country,
      state: targetApp.state,
      district: targetApp.district,
      city: targetApp.city,
      cityState: targetApp.cityState,
      userId: cleanUserId,
      password: cleanPassword,
      active: true,
      applicationId: targetApp.id,
      verificationSummary: `Address, GST & Call verified by ${reviewedBy} on ${nowTime}`,
      createdAt: nowTime
    };

    const nextAccounts = [newAccount, ...dealerAccounts];
    saveDealerAccounts(nextAccounts);
    setDealerAccounts(nextAccounts);

    const nextApps = dealerApplications.map((app) =>
      app.id === appId
        ? {
            ...app,
            status: 'approved' as const,
            rejectionReason: undefined,
            generatedAccountId: newAccount.id,
            issuedUserId: newAccount.userId,
            reviewedBy,
            reviewedAt: nowTime
          }
        : app
    );
    saveDealerApplications(nextApps);
    setDealerApplications(nextApps);

    return {
      success: true,
      message: `Approved ${targetApp.firmName} and created credentials for "${newAccount.userId}".`,
      account: newAccount
    };
  };

  const rejectDealerApplication = (appId: string, reason: string, reviewedBy: string) => {
    const cleanReason = reason.trim();
    if (!cleanReason) return;
    const nowTime = new Date().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      dateStyle: 'medium',
      timeStyle: 'short'
    });
    const nextApps = dealerApplications.map((app) =>
      app.id === appId
        ? {
            ...app,
            status: 'rejected' as const,
            rejectionReason: cleanReason,
            reviewedBy,
            reviewedAt: nowTime
          }
        : app
    );
    saveDealerApplications(nextApps);
    setDealerApplications(nextApps);
  };

  const deleteDealerApplication = (appId: string) => {
    const nextApps = dealerApplications.filter((app) => app.id !== appId);
    saveDealerApplications(nextApps);
    setDealerApplications(nextApps);
  };

  const createManualDealerAccount = (
    data: Omit<DealerAccount, 'id' | 'createdAt' | 'active'>
  ): { success: boolean; message: string; account?: DealerAccount } => {
    const cleanUserId = data.userId.trim();
    const cleanPassword = data.password.trim();
    if (cleanUserId.length < 3 || cleanPassword.length < 4) {
      return {
        success: false,
        message: 'User ID (min 3 chars) and Password (min 4 chars) are required.'
      };
    }
    const duplicate = dealerAccounts.find(
      (acc) => acc.userId.trim().toLowerCase() === cleanUserId.toLowerCase()
    );
    if (duplicate) {
      return {
        success: false,
        message: `User ID "${cleanUserId}" already exists for ${duplicate.firmName}.`
      };
    }

    const nowTime = new Date().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      dateStyle: 'medium',
      timeStyle: 'short'
    });

    const newAccount: DealerAccount = {
      ...data,
      id: `DLR-${Date.now().toString().slice(-6)}`,
      userId: cleanUserId,
      password: cleanPassword,
      gstNumber: (data.gstNumber || '').trim().toUpperCase(),
      email: (data.email || '').trim().toLowerCase(),
      active: true,
      createdAt: nowTime
    };

    const nextAccounts = [newAccount, ...dealerAccounts];
    saveDealerAccounts(nextAccounts);
    setDealerAccounts(nextAccounts);
    return { success: true, message: `Dealer account created for ${newAccount.firmName}.`, account: newAccount };
  };

  const updateDealerAccountRecord = (
    id: string,
    updates: Partial<DealerAccount>
  ): { success: boolean; message: string } => {
    if (updates.userId !== undefined) {
      const cleanId = updates.userId.trim();
      if (cleanId.length < 3) {
        return { success: false, message: 'User ID must be at least 3 characters.' };
      }
      const duplicate = dealerAccounts.find(
        (acc) => acc.id !== id && acc.userId.trim().toLowerCase() === cleanId.toLowerCase()
      );
      if (duplicate) {
        return { success: false, message: `User ID "${cleanId}" is already in use.` };
      }
    }

    const nowTime = new Date().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      dateStyle: 'medium',
      timeStyle: 'short'
    });

    const nextAccounts = dealerAccounts.map((acc) =>
      acc.id === id
        ? {
            ...acc,
            ...updates,
            id: acc.id,
            updatedAt: nowTime
          }
        : acc
    );
    saveDealerAccounts(nextAccounts);
    setDealerAccounts(nextAccounts);

    const updatedAccount = nextAccounts.find((a) => a.id === id);
    if (dealerSession && dealerSession.accountId === id) {
      if (!updatedAccount || !updatedAccount.active) {
        saveActiveDealerSession(null);
        setDealerSession(null);
      } else {
        const refreshedSession = buildSessionFromAccount(updatedAccount);
        saveActiveDealerSession(refreshedSession);
        setDealerSession(refreshedSession);
      }
    }

    return { success: true, message: 'Dealer account updated.' };
  };

  const toggleDealerAccountActive = (id: string) => {
    const nextAccounts = dealerAccounts.map((acc) =>
      acc.id === id ? { ...acc, active: !acc.active } : acc
    );
    saveDealerAccounts(nextAccounts);
    setDealerAccounts(nextAccounts);

    const target = nextAccounts.find((a) => a.id === id);
    if (dealerSession && dealerSession.accountId === id && target && !target.active) {
      saveActiveDealerSession(null);
      setDealerSession(null);
    }
  };

  const deleteDealerAccountRecord = (id: string) => {
    const nextAccounts = dealerAccounts.filter((acc) => acc.id !== id);
    saveDealerAccounts(nextAccounts);
    setDealerAccounts(nextAccounts);

    if (dealerSession && dealerSession.accountId === id) {
      saveActiveDealerSession(null);
      setDealerSession(null);
    }
  };

  const dealerSignIn = (
    userId: string,
    password: string
  ): { success: boolean; message: string; session?: DealerSession } => {
    const cleanId = userId.trim().toLowerCase();
    const matched = dealerAccounts.find(
      (acc) => acc.userId.trim().toLowerCase() === cleanId
    );
    if (!matched || matched.password !== password) {
      return {
        success: false,
        message: 'Invalid Dealer User ID or Password. Please verify with Hightone Ceramic Admin.'
      };
    }
    if (!matched.active) {
      return {
        success: false,
        message: 'This dealer account is currently disabled. Contact factory Admin to restore access.'
      };
    }

    const nowTime = new Date().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      dateStyle: 'medium',
      timeStyle: 'short'
    });
    const nextAccounts = dealerAccounts.map((acc) =>
      acc.id === matched.id ? { ...acc, lastLoginAt: nowTime } : acc
    );
    saveDealerAccounts(nextAccounts);
    setDealerAccounts(nextAccounts);

    const session = buildSessionFromAccount(matched);
    saveActiveDealerSession(session);
    setDealerSession(session);

    return {
      success: true,
      message: `Signed in as ${matched.firmName}.`,
      session
    };
  };

  const dealerSignOut = () => {
    saveActiveDealerSession(null);
    setDealerSession(null);
  };

  // Production Manufacture Queue (explicit unavailable / custom items to manufacture)
  const [productionQueue, setProductionQueue] = useState<ProductionQueueItem[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_PRODUCTION_QUEUE);
      if (raw) {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      }
    } catch {}
    return [];
  });

  const persistProductionQueue = (next: ProductionQueueItem[]) => {
    try {
      localStorage.setItem(STORAGE_KEY_PRODUCTION_QUEUE, JSON.stringify(next));
    } catch {}
  };

  const addProductionQueueItems = (items: Omit<ProductionQueueItem, 'id' | 'createdAt'>[]) => {
    if (!items || items.length === 0) return;
    const nowTime = new Date().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      dateStyle: 'medium',
      timeStyle: 'short'
    });
    const prepared: ProductionQueueItem[] = items
      .filter((i) => i.quantityToMake > 0)
      .map((item, idx) => ({
        ...item,
        id: `PQ-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
        createdAt: nowTime
      }));
    if (prepared.length === 0) return;
    setProductionQueue((prev) => {
      const updated = [...prepared, ...prev];
      persistProductionQueue(updated);
      return updated;
    });
  };

  const updateProductionQueueItem = (id: string, updates: Partial<Omit<ProductionQueueItem, 'id'>>) => {
    setProductionQueue((prev) => {
      const updated = prev
        .map((item) => (item.id === id ? { ...item, ...updates, id: item.id } : item))
        .filter((item) => item.quantityToMake > 0);
      persistProductionQueue(updated);
      return updated;
    });
  };

  const deleteProductionQueueItem = (id: string) => {
    setProductionQueue((prev) => {
      const updated = prev.filter((item) => item.id !== id);
      persistProductionQueue(updated);
      return updated;
    });
  };

  const clearProductionQueue = () => {
    setProductionQueue([]);
    try {
      localStorage.removeItem(STORAGE_KEY_PRODUCTION_QUEUE);
    } catch {}
  };

  const saveDealerEditedOrder = (
    id: string,
    editedPayload: DealerOrderPayload
  ): { success: boolean; wasAccepted: boolean } => {
    const { updatedOrders, wasAccepted } = applyDealerOrderEdit(id, editedPayload);
    setDealerOrders(updatedOrders);
    if (wasAccepted) {
      setProductionQueue((prev) => {
        const next = prev.filter((q) => !(q.sourceType === 'order-shortage' && q.sourceOrderId === id));
        persistProductionQueue(next);
        return next;
      });
    }
    return { success: true, wasAccepted };
  };

  const acceptDealerOrder = (
    id: string,
    verifiedBy: string = 'Admin',
    options?: {
      availabilityStatus?: 'all-in-stock' | 'shortage-routed';
      unavailableItems?: Omit<ProductionQueueItem, 'id' | 'createdAt'>[];
    }
  ) => {
    const unavailable = options?.unavailableItems || [];
    const availabilityStatus =
      options?.availabilityStatus || (unavailable.length > 0 ? 'shortage-routed' : 'all-in-stock');

    const updated = acceptSavedDealerOrder(id, verifiedBy, {
      availabilityStatus,
      productionRoutedCount: unavailable.length
    });
    setDealerOrders(updated);

    const nowTime = new Date().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      dateStyle: 'medium',
      timeStyle: 'short'
    });
    setProductionQueue((prev) => {
      // Remove any previous shortage queue entries for this order before inserting the verified ones
      const withoutOrder = prev.filter((q) => !(q.sourceType === 'order-shortage' && q.sourceOrderId === id));
      const newEntries: ProductionQueueItem[] = unavailable
        .filter((u) => u.quantityToMake > 0)
        .map((u, idx) => ({
          ...u,
          id: `PQ-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
          createdAt: nowTime
        }));
      const next = [...newEntries, ...withoutOrder];
      persistProductionQueue(next);
      return next;
    });
  };

  const rejectDealerOrder = (id: string, reason: string, verifiedBy: string = 'Admin') => {
    const updated = rejectSavedDealerOrder(id, reason, verifiedBy);
    setDealerOrders(updated);
    setProductionQueue((prev) => {
      const next = prev.filter((q) => !(q.sourceType === 'order-shortage' && q.sourceOrderId === id));
      persistProductionQueue(next);
      return next;
    });
  };

  const toggleDealerOrderCompleted = (id: string) => {
    const updated = toggleSavedDealerOrderCompleted(id);
    setDealerOrders(updated);
  };

  const removeCompletedDealerOrders = () => {
    const completedIds = new Set(
      dealerOrders
        .filter((o) => Boolean(o.completed) || o.status === 'completed')
        .map((o) => o.id)
    );
    const updated = removeCompletedSavedDealerOrders();
    setDealerOrders(updated);
    if (completedIds.size > 0) {
      setProductionQueue((prev) => {
        const next = prev.filter((q) => !(q.sourceType === 'order-shortage' && q.sourceOrderId && completedIds.has(q.sourceOrderId)));
        persistProductionQueue(next);
        return next;
      });
    }
  };

  const deleteDealerOrder = (id: string) => {
    const updated = removeDealerOrder(id);
    setDealerOrders(updated);
    setProductionQueue((prev) => {
      const next = prev.filter((q) => !(q.sourceType === 'order-shortage' && q.sourceOrderId === id));
      persistProductionQueue(next);
      return next;
    });
  };

  const clearDealerOrders = () => {
    clearAllDealerOrders();
    setDealerOrders([]);
    setProductionQueue((prev) => {
      const next = prev.filter((q) => q.sourceType !== 'order-shortage');
      persistProductionQueue(next);
      return next;
    });
  };

  const downloadOrdersCSV = (options?: { hideDealerContact?: boolean }) => {
    downloadDealerOrdersCSV(options);
  };

  // Daily Production Logs & Ready Variant Checks
  const [dailyProductionLogs, setDailyProductionLogs] = useState<DailyProductionEntry[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_PRODUCTION_LOGS);
      if (raw) {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      }
    } catch {}
    return [];
  });

  const [productionCheckedKeys, setProductionCheckedKeys] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_PRODUCTION_CHECKED);
      if (raw) return JSON.parse(raw);
    } catch {}
    return {};
  });

  const addDailyProductionEntry = (entry: Omit<DailyProductionEntry, 'id' | 'createdAt'>) => {
    const newEntry: DailyProductionEntry = {
      ...entry,
      id: `PROD-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: new Date().toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit'
      })
    };
    setDailyProductionLogs((prev) => {
      const updated = [newEntry, ...prev];
      try {
        localStorage.setItem(STORAGE_KEY_PRODUCTION_LOGS, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const updateDailyProductionEntry = (
    id: string,
    updates: Partial<Omit<DailyProductionEntry, 'id'>>
  ) => {
    setDailyProductionLogs((prev) => {
      const updated = prev.map((item) => (item.id === id ? { ...item, ...updates, id: item.id } : item));
      try {
        localStorage.setItem(STORAGE_KEY_PRODUCTION_LOGS, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const setProductionProducedTotal = (
    item: {
      itemKey: string;
      productId: string;
      productName: string;
      grade: CeramicGrade;
      packing: CeramicPacking;
      codeOrColor: string;
    },
    targetTotal: number,
    recordedBy: string,
    note?: string
  ) => {
    const safeTarget = Math.max(0, Math.round(targetTotal));
    const todayIso = new Date().toISOString().slice(0, 10);
    const nowTime = new Date().toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit'
    });

    setDailyProductionLogs((prev) => {
      const matchingLogs = prev.filter((l) => l.itemKey === item.itemKey);
      const currentTotal = matchingLogs.reduce((sum, l) => sum + (l.quantityMade || 0), 0);

      let updated: DailyProductionEntry[];
      if (safeTarget === currentTotal) {
        return prev;
      } else if (safeTarget === 0) {
        updated = prev.filter((l) => l.itemKey !== item.itemKey);
      } else if (safeTarget > currentTotal) {
        const diff = safeTarget - currentTotal;
        const newEntry: DailyProductionEntry = {
          id: `PROD-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          date: todayIso,
          itemKey: item.itemKey,
          productId: item.productId,
          productName: item.productName,
          grade: item.grade,
          packing: item.packing,
          codeOrColor: item.codeOrColor,
          quantityMade: diff,
          recordedBy,
          notes: note?.trim() || 'Manual output correction',
          createdAt: nowTime
        };
        updated = [newEntry, ...prev];
      } else {
        // Reduce from newest logs for this itemKey cleanly without creating negative entries
        let toSubtract = currentTotal - safeTarget;
        updated = prev
          .map((log) => {
            if (log.itemKey !== item.itemKey || toSubtract <= 0) return log;
            if (log.quantityMade <= toSubtract) {
              toSubtract -= log.quantityMade;
              return null;
            }
            const nextQty = log.quantityMade - toSubtract;
            toSubtract = 0;
            return {
              ...log,
              quantityMade: nextQty,
              notes: note?.trim() || log.notes
            };
          })
          .filter((l): l is DailyProductionEntry => l !== null);
      }

      try {
        localStorage.setItem(STORAGE_KEY_PRODUCTION_LOGS, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const deleteDailyProductionEntry = (id: string) => {
    setDailyProductionLogs((prev) => {
      const updated = prev.filter((item) => item.id !== id);
      try {
        localStorage.setItem(STORAGE_KEY_PRODUCTION_LOGS, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const clearDailyProductionLogs = () => {
    setDailyProductionLogs([]);
    try {
      localStorage.removeItem(STORAGE_KEY_PRODUCTION_LOGS);
    } catch {}
  };

  const toggleProductionItemChecked = (itemKey: string, nextVal?: boolean) => {
    setProductionCheckedKeys((prev) => {
      const updated = {
        ...prev,
        [itemKey]: nextVal !== undefined ? nextVal : !prev[itemKey]
      };
      try {
        localStorage.setItem(STORAGE_KEY_PRODUCTION_CHECKED, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  // Product Variant Modes & Weights (Admin overrides)
  const [productConfigs, setProductConfigs] = useState<Record<string, ProductConfigOverride>>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_PRODUCT_CONFIGS);
      if (raw) return JSON.parse(raw);
    } catch {}
    return {};
  });

  const updateProductConfig = (productId: string, updates: Partial<ProductConfigOverride>) => {
    const matchedProduct = products.find((p) => p.id === productId);
    const defaultCfg = matchedProduct
      ? getDefaultProductConfig(matchedProduct)
      : {
          productId,
          variantMode: 'white-only' as const,
          weightKg: 15.0
        };
    setProductConfigs((prev) => {
      const existing = prev[productId] || defaultCfg;
      const updated = {
        ...prev,
        [productId]: {
          ...existing,
          ...updates
        }
      };
      try {
        localStorage.setItem(STORAGE_KEY_PRODUCT_CONFIGS, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const resetProductConfigs = () => {
    try {
      localStorage.removeItem(STORAGE_KEY_PRODUCT_CONFIGS);
    } catch {}
    setProductConfigs({});
  };

  // Factory Color Palette
  const [colorsList, setColorsList] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_COLORS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return DEFAULT_FACTORY_COLORS;
  });

  const addColor = (colorName: string) => {
    const trimmed = colorName.trim();
    if (!trimmed) return;
    setColorsList((prev) => {
      if (prev.some((c) => c.toLowerCase() === trimmed.toLowerCase())) return prev;
      const updated = [...prev, trimmed];
      try {
        localStorage.setItem(STORAGE_KEY_COLORS, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const renameColor = (oldColor: string, newColor: string) => {
    const trimmed = newColor.trim();
    if (!trimmed) return;
    setColorsList((prev) => {
      if (
        oldColor.toLowerCase() !== trimmed.toLowerCase() &&
        prev.some((c) => c.toLowerCase() === trimmed.toLowerCase())
      ) {
        return prev;
      }
      const updated = prev.map((c) => (c === oldColor ? trimmed : c));
      try {
        localStorage.setItem(STORAGE_KEY_COLORS, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const removeColor = (colorName: string) => {
    setColorsList((prev) => {
      const updated = prev.filter((c) => c.toLowerCase() !== colorName.toLowerCase());
      try {
        localStorage.setItem(STORAGE_KEY_COLORS, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const resetColors = () => {
    try {
      localStorage.removeItem(STORAGE_KEY_COLORS);
    } catch {}
    setColorsList(DEFAULT_FACTORY_COLORS);
  };

  // Factory Design Codes
  const [designCodesList, setDesignCodesList] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_DESIGN_CODES);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return DEFAULT_DESIGN_CODES;
  });

  const addDesignCode = (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;
    setDesignCodesList((prev) => {
      if (prev.includes(trimmed)) return prev;
      const updated = [...prev, trimmed];
      try {
        localStorage.setItem(STORAGE_KEY_DESIGN_CODES, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const renameDesignCode = (oldCode: string, newCode: string) => {
    const trimmed = newCode.trim();
    if (!trimmed) return;
    setDesignCodesList((prev) => {
      if (oldCode !== trimmed && prev.includes(trimmed)) return prev;
      const updated = prev.map((c) => (c === oldCode ? trimmed : c));
      try {
        localStorage.setItem(STORAGE_KEY_DESIGN_CODES, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const removeDesignCode = (code: string) => {
    setDesignCodesList((prev) => {
      const updated = prev.filter((c) => c !== code);
      try {
        localStorage.setItem(STORAGE_KEY_DESIGN_CODES, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const resetDesignCodes = () => {
    try {
      localStorage.removeItem(STORAGE_KEY_DESIGN_CODES);
    } catch {}
    setDesignCodesList(DEFAULT_DESIGN_CODES);
  };

  // Global Default Product Code (Fallback when product uses Default Code mode)
  const [globalDefaultCode, setGlobalDefaultCode] = useState<string>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_GLOBAL_DEFAULT_CODE);
      if (raw !== null) return raw;
    } catch {}
    return '';
  });

  const updateGlobalDefaultCode = (code: string) => {
    const clean = code.trim();
    setGlobalDefaultCode(clean);
    try {
      if (clean) {
        localStorage.setItem(STORAGE_KEY_GLOBAL_DEFAULT_CODE, clean);
      } else {
        localStorage.removeItem(STORAGE_KEY_GLOBAL_DEFAULT_CODE);
      }
    } catch {}
  };

  const resetGlobalDefaultCode = () => {
    setGlobalDefaultCode('');
    try {
      localStorage.removeItem(STORAGE_KEY_GLOBAL_DEFAULT_CODE);
    } catch {}
  };

  const [collectionSeoMap, setCollectionSeoMap] = useState<Record<string, CollectionSeoMeta>>(() => getStoredCollectionSeo());

  const updateCollectionSeo = (collectionId: string, seo: CollectionSeoMeta) => {
    updateSingleCollectionSeo(collectionId, seo);
    setCollectionSeoMap((prev) => ({
      ...prev,
      [collectionId]: seo
    }));
  };

  const resetCollectionSeo = (collectionId: string) => {
    removeSingleCollectionSeo(collectionId);
    setCollectionSeoMap((prev) => {
      const copy = { ...prev };
      delete copy[collectionId];
      return copy;
    });
  };

  const updateCollectionsMeta = (updated: Record<string, Partial<CategoryMeta>>) => {
    setCollectionsMeta(updated);
    localStorage.setItem(STORAGE_KEY_COLLECTIONS, JSON.stringify(updated));
  };

  const updateSingleCollectionOrder = (
    collectionId: string,
    orderUpdates: { order?: number; homeOrder?: number; showOnHome?: boolean }
  ) => {
    setCollectionsMeta((prev) => {
      const copy = { ...prev };
      const current = copy[collectionId] || { id: collectionId };
      copy[collectionId] = {
        ...current,
        ...(orderUpdates.order !== undefined ? { order: orderUpdates.order } : {}),
        ...(orderUpdates.homeOrder !== undefined ? { homeOrder: orderUpdates.homeOrder } : {}),
        ...(orderUpdates.showOnHome !== undefined ? { showOnHome: orderUpdates.showOnHome } : {})
      };
      localStorage.setItem(STORAGE_KEY_COLLECTIONS, JSON.stringify(copy));
      return copy;
    });
  };

  const resetCollectionsOrder = () => {
    setCollectionsMeta({});
    localStorage.removeItem(STORAGE_KEY_COLLECTIONS);
  };

  return (
    <DataContext.Provider
      value={{
        products,
        faqs,
        siteMedia,
        companyInfo,
        collectionsMeta,
        legalPolicies,
        sheetId,
        isSyncing,
        isInitializing,
        initProgress,
        lastSyncTime,
        syncError,
        connectSheet,
        disconnectSheet,
        refreshData,
        inquiries,
        sheetWebhookUrl,
        updateWebhookUrl,
        recordInquiry,
        updateInquiry,
        deleteInquiry,
        clearInquiries,
        downloadCSV,
        copyForSheets,
        dealerOrders,
        recordDealerOrder,
        saveDealerEditedOrder,
        updateDealerOrder,
        acceptDealerOrder,
        rejectDealerOrder,
        toggleDealerOrderCompleted,
        removeCompletedDealerOrders,
        deleteDealerOrder,
        clearDealerOrders,
        downloadDealerOrdersCSV: downloadOrdersCSV,
        dealerApplications,
        dealerAccounts,
        dealerSession,
        submitDealerApplication,
        updateDealerApplicationKyc,
        approveDealerApplication,
        rejectDealerApplication,
        deleteDealerApplication,
        createManualDealerAccount,
        updateDealerAccountRecord,
        toggleDealerAccountActive,
        deleteDealerAccountRecord,
        dealerSignIn,
        dealerSignOut,
        productionQueue,
        addProductionQueueItems,
        updateProductionQueueItem,
        deleteProductionQueueItem,
        clearProductionQueue,
        dailyProductionLogs,
        productionCheckedKeys,
        addDailyProductionEntry,
        updateDailyProductionEntry,
        setProductionProducedTotal,
        deleteDailyProductionEntry,
        clearDailyProductionLogs,
        toggleProductionItemChecked,
        productConfigs,
        updateProductConfig,
        resetProductConfigs,
        colorsList,
        addColor,
        renameColor,
        removeColor,
        resetColors,
        designCodesList,
        addDesignCode,
        renameDesignCode,
        removeDesignCode,
        resetDesignCodes,
        globalDefaultCode,
        updateGlobalDefaultCode,
        resetGlobalDefaultCode,
        collectionSeoMap,
        updateCollectionSeo,
        resetCollectionSeo,
        updateCollectionsMeta,
        updateSingleCollectionOrder,
        resetCollectionsOrder,
        updateCompanyInfo,
        resetCompanyInfo,
        adminSession,
        activeAdminRole,
        loginWithRole,
        setAdminSession,
        logoutAdminSession
      }}
    >
      {children}
    </DataContext.Provider>
  );
};

export const useWebsiteData = (): DataContextType => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useWebsiteData must be used within a DataProvider');
  }
  return context;
};
