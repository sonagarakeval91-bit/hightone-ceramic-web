import React, { createContext, useContext, useState, useEffect } from 'react';
import { ProductItem, CategoryMeta, CollectionSeoMeta, B2BInquiryPayload, SavedInquiry } from '../types';
import { PRODUCTS_CATALOG, WHOLESALE_FAQS } from '../data/products';
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
  removeInquiry,
  clearAllSavedInquiries,
  downloadInquiriesCSV,
  copyInquiriesForGoogleSheets
} from '../services/inquiryStorageService';
import {
  getStoredCollectionSeo,
  updateSingleCollectionSeo,
  removeSingleCollectionSeo
} from '../services/seoService';
import {
  collectImagesToPreload,
  preloadAllImages
} from '../utils/imagePreloader';
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
  deleteInquiry: (id: string) => void;
  clearInquiries: () => void;
  downloadCSV: () => void;
  copyForSheets: () => Promise<boolean>;
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
}

const STORAGE_KEY_SHEET_ID = 'hightone_gsheet_id';
const STORAGE_KEY_PRODUCTS = 'hightone_cached_products';
const STORAGE_KEY_MEDIA = 'hightone_cached_media';
const STORAGE_KEY_COMPANY = 'hightone_cached_company';
const STORAGE_KEY_FAQS = 'hightone_cached_faqs';
const STORAGE_KEY_COLLECTIONS = 'hightone_cached_collections_meta';
const STORAGE_KEY_LEGAL = 'hightone_cached_legal_policies';
const STORAGE_KEY_LAST_SYNC = 'hightone_last_sync_time';

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

  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [initProgress, setInitProgress] = useState<number>(10);
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

  // Comprehensive app initialization: syncs Google Sheet data, then preloads ALL product images
  // and collection covers until completely loaded into memory before dismissing the loading screen.
  useEffect(() => {
    let isMounted = true;

    const initializeAndPreload = async () => {
      setInitProgress(15);

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
      setInitProgress(30);

      // 2. Collect all images (products, category covers, site media)
      const imagesToPreload = collectImagesToPreload({
        products: currentProducts,
        collectionsMeta: currentCollectionsMeta,
        siteMedia: currentSiteMedia,
        defaultCategories: CATEGORIES_META
      });

      // 3. Preload all images until completely downloaded in memory
      if (imagesToPreload.length > 0) {
        await preloadAllImages(
          imagesToPreload,
          (progress) => {
            if (isMounted) {
              // Map preloader progress from 30% to 100%
              const mapped = Math.min(100, Math.round(30 + progress.percent * 0.7));
              setInitProgress(mapped);
            }
          },
          8000 // 8-second safety ceiling to protect against stalled third-party hosts
        );
      }

      if (isMounted) {
        setInitProgress(100);
        // Short subtle settling buffer for smooth visual transition
        setTimeout(() => {
          if (isMounted) {
            setIsInitializing(false);
          }
        }, 220);
      }
    };

    initializeAndPreload();

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
        deleteInquiry,
        clearInquiries,
        downloadCSV,
        copyForSheets,
        collectionSeoMap,
        updateCollectionSeo,
        resetCollectionSeo,
        updateCollectionsMeta,
        updateSingleCollectionOrder,
        resetCollectionsOrder,
        updateCompanyInfo,
        resetCompanyInfo
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
