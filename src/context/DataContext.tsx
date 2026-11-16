import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  AdminRole,
  AdminSessionInfo,
  AdminStaffAccount,
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
import {
  getStaffAccounts,
  normalizeAdminRole,
  ROLE_DEFINITIONS,
  saveStaffAccounts,
  STORAGE_KEY_ADMIN_SESSION
} from '../utils/adminRoles';
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
  buildDealerApplication,
  buildSessionFromAccount,
  getActiveDealerSession,
  getDealerAccounts,
  getDealerApplications,
  isApplicationKycReady,
  saveActiveDealerSession,
  saveDealerAccounts,
  saveDealerApplications,
  updateApplicationVerificationChecklist
} from '../services/dealerPortalService';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, computeDealerCredHash, db, OWNER_ADMIN_EMAIL, testConnection } from '../firebase';
import {
  authenticateDealerFromCloud,
  authenticateStaffFromCloud,
  CloudCmsMediaAndCompanyPayload,
  CloudCmsProductsPayload,
  CloudCmsSeoAndLegalPayload,
  CloudProductionStatePayload,
  deleteDailyProductionLogFromCloud,
  deleteDealerAccountFromCloud,
  deleteDealerApplicationFromCloud,
  deleteDealerOrderFromCloud,
  deleteInquiryFromCloud,
  deleteProductionQueueItemFromCloud,
  deleteStaffAccountFromCloud,
  fetchAllPublicCmsFromCloud,
  fetchDealerOrderFeedFromCloud,
  getAuthorizedCloudUserProfile,
  saveCatalogSettingsToCloud,
  saveCmsMediaAndCompanyToCloud,
  saveCmsProductsToCloud,
  saveCmsSeoAndLegalToCloud,
  saveDailyProductionLogToCloud,
  saveDealerAccountToCloud,
  saveDealerApplicationToCloud,
  saveDealerOrderToCloud,
  saveInquiryToCloud,
  saveMasterOwnerTokenToCloud,
  saveProductionQueueItemToCloud,
  saveProductionStateToCloud,
  saveStaffAccountToCloud,
  signInFirebaseAdminWithGoogle,
  signOutFirebaseUser,
  submitPublicDealerApplication,
  submitPublicInquiryToCloud,
  subscribeAdminCollections,
  subscribeDealerOrderFeed,
  subscribePublicCmsDocs,
  syncDealerOrderFeedToCloud
} from '../services/firestoreSyncService';
import {
  BackendConnectionState,
  FirestoreDiagnosticReport,
  verifyGoogleSheetModalFirestoreConnection
} from '../utils/firestoreDiagnostics';
import {
  getStoredCollectionSeo,
  saveStoredCollectionSeo,
  updateSingleCollectionSeo,
  removeSingleCollectionSeo
} from '../services/seoService';
import { getSavedGA4Id, saveGA4Id } from '../services/analyticsService';
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
  saveDealerEditedOrder: (id: string, editedPayload: DealerOrderPayload) => Promise<{ success: boolean; wasAccepted: boolean }>;
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
  submitDealerApplication: (input: NewDealerApplicationInput) => Promise<DealerApplication>;
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
  dealerSignIn: (userId: string, password: string) => Promise<{ success: boolean; message: string; session?: DealerSession }>;
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
  // GA4 Measurement ID
  ga4MeasurementId: string;
  saveGa4MeasurementId: (id: string) => void;
  // Collection Ordering & Management
  updateCollectionsMeta: (updated: Record<string, Partial<CategoryMeta>>) => void;
  updateSingleCollectionOrder: (collectionId: string, orderUpdates: { order?: number; homeOrder?: number; showOnHome?: boolean }) => void;
  resetCollectionsOrder: () => void;
  // Company Info & Map Controls
  updateCompanyInfo: (updates: Partial<CompanyInfoMap>) => void;
  resetCompanyInfo: () => void;
  // Admin & Staff RBAC Session + Cloud Staff Management
  staffAccounts: AdminStaffAccount[];
  addStaffAccount: (account: Omit<AdminStaffAccount, 'id' | 'createdAt' | 'active'>) => AdminStaffAccount;
  updateStaffAccount: (id: string, updates: Partial<AdminStaffAccount>) => void;
  updateStaffRole: (id: string, role: AdminRole) => void;
  toggleStaffActive: (id: string) => void;
  deleteStaffAccount: (id: string) => void;
  updateMasterOwnerCredentials: (userId: string, password: string) => Promise<void>;
  signInAdminWithCredentials: (userId: string, password: string) => Promise<{ success: boolean; message: string; session?: AdminSessionInfo }>;
  adminSession: AdminSessionInfo | null;
  activeAdminRole: AdminRole | null;
  loginWithRole: (role: AdminRole, displayName?: string) => void;
  setAdminSession: (session: AdminSessionInfo | null) => void;
  logoutAdminSession: () => void;
  // Cloud Sync (Firebase) State & Helpers
  firebaseUser: User | null;
  isFirebaseAdmin: boolean;
  activeCloudRole: AdminRole | null;
  isFirebaseAuthReady: boolean;
  cloudSyncError: string | null;
  backendSyncStatus: BackendConnectionState;
  backendDiagnostic: FirestoreDiagnosticReport | null;
  isVerifyingBackend: boolean;
  runBackendDiagnostics: () => Promise<FirestoreDiagnosticReport>;
  signInAdminWithGoogle: () => Promise<{ success: boolean; message: string }>;
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
      if (isFullAdminCloud()) {
        saveCatalogSettingsToCloud({ companyInfo: merged }).catch((err) => console.error(err));
        saveCmsMediaAndCompanyToCloud({ companyInfo: merged }).catch((err) => console.error(err));
      }
      return merged;
    });
  };

  const resetCompanyInfo = () => {
    setCompanyInfo(DEFAULT_COMPANY_INFO);
    localStorage.setItem(STORAGE_KEY_COMPANY, JSON.stringify(DEFAULT_COMPANY_INFO));
    if (isFullAdminCloud()) {
      saveCatalogSettingsToCloud({ companyInfo: DEFAULT_COMPANY_INFO }).catch((err) => console.error(err));
      saveCmsMediaAndCompanyToCloud({ companyInfo: DEFAULT_COMPANY_INFO }).catch((err) => console.error(err));
    }
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
    setHasConfirmedCloudSync(false);
    setCloudSyncError(null);
    signOutFirebaseUser().catch(() => {});
  };

  // Staff Accounts State (Cloud + Local Mirror)
  const [staffAccounts, setStaffAccounts] = useState<AdminStaffAccount[]>(() => getStaffAccounts());
  const staffAccountsRef = React.useRef<AdminStaffAccount[]>(staffAccounts);
  staffAccountsRef.current = staffAccounts;

  // Firebase Cloud Auth State
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [isFirebaseAdmin, setIsFirebaseAdmin] = useState<boolean>(false);
  const [activeCloudRole, setActiveCloudRole] = useState<AdminRole | null>(null);
  const [isFirebaseAuthReady, setIsFirebaseAuthReady] = useState<boolean>(false);
  const [cloudSyncError, setCloudSyncError] = useState<string | null>(null);
  const [isBrowserOnline, setIsBrowserOnline] = useState<boolean>(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine
  );
  const [hasConfirmedCloudSync, setHasConfirmedCloudSync] = useState<boolean>(false);
  const [backendDiagnostic, setBackendDiagnostic] = useState<FirestoreDiagnosticReport | null>(null);
  const [isVerifyingBackend, setIsVerifyingBackend] = useState<boolean>(false);
  const isFirebaseAdminRef = React.useRef<boolean>(false);
  isFirebaseAdminRef.current = isFirebaseAdmin;
  const activeCloudRoleRef = React.useRef<AdminRole | null>(null);
  activeCloudRoleRef.current = activeCloudRole;
  const adminSessionRef = React.useRef<AdminSessionInfo | null>(adminSession);
  adminSessionRef.current = adminSession;

  const isFullAdminCloud = () =>
    isFirebaseAdminRef.current && activeCloudRoleRef.current === 'admin';
  const isProdEditorCloud = () =>
    isFirebaseAdminRef.current &&
    (activeCloudRoleRef.current === 'admin' || activeCloudRoleRef.current === 'production-manager');
  const isStaffCloud = () =>
    isFirebaseAdminRef.current && activeCloudRoleRef.current !== null;

  const addStaffAccount = (
    account: Omit<AdminStaffAccount, 'id' | 'createdAt' | 'active'>
  ): AdminStaffAccount => {
    const cleanEmail = account.staffEmail ? account.staffEmail.trim().toLowerCase() : undefined;
    const created: AdminStaffAccount = {
      ...account,
      userId: account.userId.trim(),
      password: account.password.trim(),
      displayName: account.displayName.trim(),
      role: normalizeAdminRole(account.role),
      ...(cleanEmail ? { staffEmail: cleanEmail } : {}),
      id: `STF-${Date.now().toString().slice(-6)}`,
      active: true,
      createdAt: new Date().toISOString()
    };
    const next = [created, ...staffAccountsRef.current];
    saveStaffAccounts(next);
    setStaffAccounts(next);
    if (isFullAdminCloud()) {
      saveStaffAccountToCloud(created)
        .then((credHash) => {
          setStaffAccounts((prev) => {
            const withHash = prev.map((s) => (s.id === created.id ? { ...s, credHash } : s));
            saveStaffAccounts(withHash);
            return withHash;
          });
        })
        .catch((err) => console.error('Cloud staff create failed:', err));
    }
    return created;
  };

  const updateStaffAccount = (id: string, updates: Partial<AdminStaffAccount>) => {
    const prevItem = staffAccountsRef.current.find((a) => a.id === id);
    const nextEmail =
      updates.staffEmail !== undefined
        ? updates.staffEmail.trim().toLowerCase() || undefined
        : prevItem?.staffEmail;
    const next = staffAccountsRef.current.map((acc) => {
      if (acc.id !== id) return acc;
      const merged: AdminStaffAccount = {
        ...acc,
        ...updates,
        ...(updates.role ? { role: normalizeAdminRole(updates.role) } : {})
      };
      if (nextEmail) {
        merged.staffEmail = nextEmail;
      } else {
        delete merged.staffEmail;
      }
      return merged;
    });
    saveStaffAccounts(next);
    setStaffAccounts(next);
    const updatedItem = next.find((a) => a.id === id);
    if (updatedItem && isFullAdminCloud()) {
      saveStaffAccountToCloud(updatedItem, prevItem?.credHash, prevItem?.staffEmail)
        .then((credHash) => {
          setStaffAccounts((prev) => {
            const withHash = prev.map((s) => (s.id === id ? { ...s, credHash } : s));
            saveStaffAccounts(withHash);
            return withHash;
          });
        })
        .catch((err) => console.error('Cloud staff update failed:', err));
    }
  };

  const updateStaffRole = (id: string, role: AdminRole) => {
    updateStaffAccount(id, { role: normalizeAdminRole(role) });
  };

  const toggleStaffActive = (id: string) => {
    const prevItem = staffAccountsRef.current.find((a) => a.id === id);
    if (!prevItem) return;
    updateStaffAccount(id, { active: !prevItem.active });
  };

  const deleteStaffAccount = (id: string) => {
    const target = staffAccountsRef.current.find((a) => a.id === id);
    const next = staffAccountsRef.current.filter((a) => a.id !== id);
    saveStaffAccounts(next);
    setStaffAccounts(next);
    if (target && isFullAdminCloud()) {
      deleteStaffAccountFromCloud(target).catch((err) => console.error('Cloud staff delete failed:', err));
    }
  };

  const updateMasterOwnerCredentials = async (userId: string, password: string): Promise<void> => {
    const cleanUser = userId.trim();
    const cleanPass = password.trim();
    if (!cleanUser || !cleanPass) return;
    localStorage.setItem('hightone_admin_user', cleanUser);
    localStorage.setItem('hightone_admin_password', cleanPass);
    if (isFullAdminCloud()) {
      const prevHash = localStorage.getItem('hightone_master_owner_cred_hash') || undefined;
      const newHash = await saveMasterOwnerTokenToCloud(cleanUser, cleanPass, prevHash);
      localStorage.setItem('hightone_master_owner_cred_hash', newHash);
    }
  };

  const signInAdminWithCredentials = async (
    userId: string,
    password: string
  ): Promise<{ success: boolean; message: string; session?: AdminSessionInfo }> => {
    const enteredUser = userId.trim().toLowerCase();
    const enteredPass = password.trim();
    if (!enteredUser || !enteredPass) {
      return { success: false, message: 'Please enter both User ID and Password.' };
    }

    const sheetUser = (localStorage.getItem('hightone_sheet_admin_user') || '').trim().toLowerCase();
    const sheetPass = (localStorage.getItem('hightone_sheet_admin_pass') || '').trim();
    const savedCustomUser = (localStorage.getItem('hightone_admin_user') || '').trim().toLowerCase();
    const savedCustomPass = (localStorage.getItem('hightone_admin_password') || '').trim();

    const matchesSheet = Boolean(sheetUser && sheetPass && enteredUser === sheetUser && enteredPass === sheetPass);
    const matchesCustom = Boolean(savedCustomUser && savedCustomPass && enteredUser === savedCustomUser && enteredPass === savedCustomPass);

    if (matchesSheet || matchesCustom) {
      const session: AdminSessionInfo = {
        userId: userId.trim(),
        displayName: 'Admin',
        role: 'admin',
        isMasterOwner: true
      };
      setAdminSession(session);
      if (isFullAdminCloud() && !localStorage.getItem('hightone_master_owner_cred_hash')) {
        saveMasterOwnerTokenToCloud(userId.trim(), enteredPass)
          .then((h) => localStorage.setItem('hightone_master_owner_cred_hash', h))
          .catch(() => {});
      }
      return { success: true, message: 'Signed in as Admin (Master Owner).', session };
    }

    const matchedLocal = staffAccountsRef.current.find(
      (acc) => acc.userId.trim().toLowerCase() === enteredUser && acc.password === enteredPass
    );
    if (matchedLocal) {
      if (!matchedLocal.active) {
        return { success: false, message: 'This staff account is currently disabled. Contact Admin.' };
      }
      const session: AdminSessionInfo = {
        userId: matchedLocal.userId,
        displayName: matchedLocal.displayName,
        role: normalizeAdminRole(matchedLocal.role),
        isMasterOwner: false,
        ...(matchedLocal.staffEmail ? { staffEmail: matchedLocal.staffEmail } : {})
      };
      setAdminSession(session);
      return { success: true, message: `Signed in as ${matchedLocal.displayName}.`, session };
    }

    // Remote cloud credential lookup across devices
    try {
      const cloudRes = await authenticateStaffFromCloud(userId, password);
      if (!cloudRes.found || !cloudRes.tokenData) {
        return { success: false, message: 'Invalid User ID or Password. Please check your credentials and try again.' };
      }
      if (!cloudRes.active || !cloudRes.tokenData.active) {
        return { success: false, message: 'This staff account is currently disabled. Contact Admin.' };
      }
      const t = cloudRes.tokenData;
      const session: AdminSessionInfo = {
        userId: t.userId,
        displayName: t.displayName,
        role: normalizeAdminRole(t.role),
        isMasterOwner: Boolean(t.isMasterOwner),
        ...(t.staffEmail ? { staffEmail: t.staffEmail } : {})
      };
      setAdminSession(session);
      return { success: true, message: `Signed in as ${t.displayName}.`, session };
    } catch (err) {
      console.error('Cloud staff credential lookup failed:', err);
      return {
        success: false,
        message: 'Could not verify staff credentials with cloud server. Please check connection.'
      };
    }
  };

  const runBackendDiagnostics = React.useCallback(async (): Promise<FirestoreDiagnosticReport> => {
    setIsVerifyingBackend(true);
    try {
      const report = await verifyGoogleSheetModalFirestoreConnection();
      setBackendDiagnostic(report);
      if (!report.configMatches || !report.backendConnected) {
        setHasConfirmedCloudSync(false);
        setCloudSyncError(report.summary);
      } else {
        if (report.isAuthenticatedAdmin) {
          setHasConfirmedCloudSync(true);
        }
        setCloudSyncError(null);
      }
      return report;
    } finally {
      setIsVerifyingBackend(false);
    }
  }, []);

  const backendSyncStatus: BackendConnectionState = React.useMemo(() => {
    if (!isBrowserOnline) return 'offline';
    if (
      cloudSyncError ||
      (backendDiagnostic && (!backendDiagnostic.configMatches || !backendDiagnostic.backendConnected))
    ) {
      return 'error';
    }
    if (!isFirebaseAdmin) return 'local-only';
    if (hasConfirmedCloudSync) return 'connected';
    return 'connecting';
  }, [isBrowserOnline, cloudSyncError, backendDiagnostic, isFirebaseAdmin, hasConfirmedCloudSync]);

  const signInAdminWithGoogle = async (): Promise<{ success: boolean; message: string }> => {
    try {
      setCloudSyncError(null);
      const user = await signInFirebaseAdminWithGoogle();
      const profile = await getAuthorizedCloudUserProfile(user.uid, user.email, user.emailVerified);
      if (!profile?.allowed) {
        await signOutFirebaseUser().catch(() => {});
        const msg = `Google account "${user.email || 'Unknown'}" is not authorized for Hightone Admin Cloud Sync. Sign in with ${OWNER_ADMIN_EMAIL} or an Admin-invited staff Google email.`;
        setCloudSyncError(msg);
        return { success: false, message: msg };
      }
      setFirebaseUser(user);
      setIsFirebaseAdmin(true);
      setActiveCloudRole(profile.role);
      setAdminSession({
        userId: profile.email || user.email || user.uid,
        displayName: profile.displayName || user.displayName || 'Admin',
        role: profile.role,
        isMasterOwner: profile.isMasterOwner,
        ...(profile.email ? { staffEmail: profile.email } : {})
      });
      return {
        success: true,
        message: `Connected Cloud Sync via Google (${profile.email || user.email || OWNER_ADMIN_EMAIL}) as ${ROLE_DEFINITIONS[profile.role].label}.`
      };
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        return { success: false, message: 'Google sign-in popup was closed before completing.' };
      }
      if (code === 'auth/popup-blocked') {
        const msg = 'Google sign-in popup was blocked by your browser. Please allow popups for this site and click again.';
        setCloudSyncError(msg);
        return { success: false, message: msg };
      }
      if (code === 'auth/unauthorized-domain') {
        const host = typeof window !== 'undefined' ? window.location.hostname : 'this domain';
        const msg = `Domain "${host}" is not yet in Firebase Authorized Domains. Add "${host}" in Firebase Console → Authentication → Settings → Authorized domains, then sign in again.`;
        setCloudSyncError(msg);
        return { success: false, message: msg };
      }
      const message = err instanceof Error ? err.message : 'Google sign-in failed.';
      setCloudSyncError(message);
      return { success: false, message };
    }
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

      if (isFullAdminCloud()) {
        saveCmsProductsToCloud({
          products: uniqueProducts,
          sheetId: targetId,
          lastSyncTime: timeStr
        }).catch((err) => console.error('Cloud CMS products write failed:', err));
        saveCmsMediaAndCompanyToCloud({
          siteMedia: data.siteMedia,
          companyInfo: data.companyInfo,
          faqs: data.faqs
        }).catch((err) => console.error('Cloud CMS media/company write failed:', err));
        saveCmsSeoAndLegalToCloud({
          legalPolicies: data.legalPolicies || {}
        }).catch((err) => console.error('Cloud CMS SEO/legal write failed:', err));
        saveCatalogSettingsToCloud({
          collectionsMeta: data.collectionsMeta || {},
          companyInfo: data.companyInfo,
          sheetId: targetId
        }).catch((err) => console.error('Cloud catalog settings write failed:', err));
        if (data.adminCredentials) {
          saveMasterOwnerTokenToCloud(
            data.adminCredentials.userId,
            data.adminCredentials.password
          ).catch(() => {});
        }
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

    const restoredProducts = ensureUniqueProducts(PRODUCTS_CATALOG);
    setSheetId(null);
    setProducts(restoredProducts);
    setSiteMedia(DEFAULT_SITE_MEDIA);
    setCompanyInfo(DEFAULT_COMPANY_INFO);
    setFaqs(WHOLESALE_FAQS);
    setCollectionsMeta({});
    setLegalPolicies({});
    setLastSyncTime(null);
    setSyncError(null);

    if (isFullAdminCloud()) {
      saveCmsProductsToCloud({ products: restoredProducts, sheetId: null, lastSyncTime: null }).catch(() => {});
      saveCmsMediaAndCompanyToCloud({ siteMedia: DEFAULT_SITE_MEDIA, companyInfo: DEFAULT_COMPANY_INFO, faqs: WHOLESALE_FAQS }).catch(() => {});
      saveCmsSeoAndLegalToCloud({ legalPolicies: {} }).catch(() => {});
      saveCatalogSettingsToCloud({ collectionsMeta: {}, companyInfo: DEFAULT_COMPANY_INFO, sheetId: null }).catch(() => {});
    }
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
    const cleanUrl = url.trim();
    saveSheetWebhookUrl(cleanUrl);
    setSheetWebhookUrlState(cleanUrl);
    if (isFullAdminCloud()) {
      saveCmsMediaAndCompanyToCloud({ sheetWebhookUrl: cleanUrl }).catch((err) => console.error(err));
    }
  };

  const recordInquiry = async (payload: B2BInquiryPayload, source: string) => {
    const res = await recordNewInquiry(payload, source);
    if (res.record) {
      try {
        await submitPublicInquiryToCloud(res.record);
      } catch (err) {
        removeInquiry(res.record.id);
        setInquiries(getSavedInquiries());
        throw err;
      }
    }
    setInquiries(getSavedInquiries());
    return res;
  };

  const updateInquiry = (id: string, updates: Partial<SavedInquiry>) => {
    const updated = updateSavedInquiry(id, updates);
    setInquiries(updated);
    const target = updated.find((item) => item.id === id);
    if (target && isFullAdminCloud()) {
      saveInquiryToCloud(target).catch((err) => console.error(err));
    }
  };

  const deleteInquiry = (id: string) => {
    const updated = removeInquiry(id);
    setInquiries(updated);
    if (isFullAdminCloud()) {
      deleteInquiryFromCloud(id).catch((err) => console.error(err));
    }
  };

  const clearInquiries = () => {
    const current = [...inquiries];
    clearAllSavedInquiries();
    setInquiries([]);
    if (isFullAdminCloud()) {
      Promise.all(current.map((item) => deleteInquiryFromCloud(item.id))).catch((err) => console.error(err));
    }
  };

  const downloadCSV = () => {
    downloadInquiriesCSV();
  };

  const copyForSheets = async () => {
    return await copyInquiriesForGoogleSheets();
  };

  // Dealer Orders State
  const [dealerOrders, setDealerOrders] = useState<SavedDealerOrder[]>(() => getSavedDealerOrders());

  const syncMatchingDealerFeed = async (accountId: string | undefined, allOrders: SavedDealerOrder[], fallbackCredHash?: string) => {
    if (!accountId && !fallbackCredHash) return;
    const acc = accountId ? dealerAccountsRef.current.find((a) => a.id === accountId) : undefined;
    const credHash =
      fallbackCredHash ||
      acc?.credHash ||
      (acc ? await computeDealerCredHash(acc.userId, acc.password) : undefined);
    if (credHash && (accountId || acc?.id)) {
      await syncDealerOrderFeedToCloud(credHash, accountId || acc!.id, allOrders).catch((err) =>
        console.error('Dealer order feed sync failed:', err)
      );
    }
  };

  const recordDealerOrder = async (payload: DealerOrderPayload, source: string = 'Dealer Order Portal') => {
    const activeCredHash = payload.dealerCredHash || dealerSession?.credHash;
    const enrichedPayload: DealerOrderPayload = {
      ...payload,
      ...(activeCredHash ? { dealerCredHash: activeCredHash } : {})
    };
    const res = await recordNewDealerOrder(enrichedPayload, source);
    if (res.record) {
      try {
        await saveDealerOrderToCloud(res.record, true);
      } catch (err) {
        removeDealerOrder(res.record.id);
        setDealerOrders(getSavedDealerOrders());
        throw err;
      }
      const latestOrders = getSavedDealerOrders();
      setDealerOrders(latestOrders);
      await syncMatchingDealerFeed(res.record.dealerAccountId, latestOrders, activeCredHash);
    } else {
      setDealerOrders(getSavedDealerOrders());
    }
    return res;
  };

  const updateDealerOrder = (id: string, updatedOrder: SavedDealerOrder) => {
    const updated = updateSavedDealerOrder(id, updatedOrder);
    setDealerOrders(updated);
    const target = updated.find((o) => o.id === id);
    if (target && isStaffCloud()) {
      saveDealerOrderToCloud(target, false).catch((err) => console.error(err));
      syncMatchingDealerFeed(target.dealerAccountId, updated, target.dealerCredHash);
    }
  };

  // Dealer Applications, KYC Checklist, Dealer Accounts & Session
  const [dealerApplications, setDealerApplications] = useState<DealerApplication[]>(() =>
    getDealerApplications()
  );
  const [dealerAccounts, setDealerAccounts] = useState<DealerAccount[]>(() => getDealerAccounts());
  const dealerAccountsRef = React.useRef<DealerAccount[]>(dealerAccounts);
  dealerAccountsRef.current = dealerAccounts;

  const [dealerSession, setDealerSession] = useState<DealerSession | null>(() =>
    getActiveDealerSession()
  );

  const submitDealerApplication = async (input: NewDealerApplicationInput): Promise<DealerApplication> => {
    const candidate = buildDealerApplication(input);
    await submitPublicDealerApplication(candidate);
    const nextApps = [candidate, ...getDealerApplications()];
    saveDealerApplications(nextApps);
    setDealerApplications(nextApps);
    return candidate;
  };

  const updateDealerApplicationKyc = (
    appId: string,
    updates: Partial<DealerVerificationChecklist>,
    verifiedBy: string
  ) => {
    const updated = updateApplicationVerificationChecklist(appId, updates, verifiedBy);
    setDealerApplications(updated);
    const target = updated.find((a) => a.id === appId);
    if (target && isFirebaseAdminRef.current) {
      saveDealerApplicationToCloud(target).catch((err) => console.error(err));
    }
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

    const updatedApp: DealerApplication = {
      ...targetApp,
      status: 'approved' as const,
      rejectionReason: undefined,
      generatedAccountId: newAccount.id,
      issuedUserId: newAccount.userId,
      reviewedBy,
      reviewedAt: nowTime
    };

    const nextApps = dealerApplications.map((app) => (app.id === appId ? updatedApp : app));
    saveDealerApplications(nextApps);
    setDealerApplications(nextApps);

    if (isFirebaseAdminRef.current) {
      (async () => {
        const credHash = await saveDealerAccountToCloud(newAccount);
        await saveDealerApplicationToCloud(updatedApp);
        await syncDealerOrderFeedToCloud(credHash, newAccount.id, dealerOrders);
      })().catch((err) => console.error('Cloud approve dealer sync failed:', err));
    }

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
    const updatedApp = nextApps.find((a) => a.id === appId);
    if (updatedApp && isFirebaseAdminRef.current) {
      saveDealerApplicationToCloud(updatedApp).catch((err) => console.error(err));
    }
  };

  const deleteDealerApplication = (appId: string) => {
    const nextApps = dealerApplications.filter((app) => app.id !== appId);
    saveDealerApplications(nextApps);
    setDealerApplications(nextApps);
    if (isFirebaseAdminRef.current) {
      deleteDealerApplicationFromCloud(appId).catch((err) => console.error(err));
    }
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

    if (isFirebaseAdminRef.current) {
      (async () => {
        const credHash = await saveDealerAccountToCloud(newAccount);
        await syncDealerOrderFeedToCloud(credHash, newAccount.id, dealerOrders);
      })().catch((err) => console.error('Cloud create dealer account sync failed:', err));
    }

    return { success: true, message: `Dealer account created for ${newAccount.firmName}.`, account: newAccount };
  };

  const updateDealerAccountRecord = (
    id: string,
    updates: Partial<DealerAccount>
  ): { success: boolean; message: string } => {
    const prevAccount = dealerAccounts.find((a) => a.id === id);
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
    if (updatedAccount && isFirebaseAdminRef.current) {
      (async () => {
        const prevHash = prevAccount
          ? prevAccount.credHash || (await computeDealerCredHash(prevAccount.userId, prevAccount.password))
          : undefined;
        const newHash = await saveDealerAccountToCloud(updatedAccount, prevHash);
        await syncDealerOrderFeedToCloud(newHash, updatedAccount.id, dealerOrders);
      })().catch((err) => console.error('Cloud update dealer account sync failed:', err));
    }

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
    if (target && isFirebaseAdminRef.current) {
      saveDealerAccountToCloud(target, target.credHash).catch((err) => console.error(err));
    }
    if (dealerSession && dealerSession.accountId === id && target && !target.active) {
      saveActiveDealerSession(null);
      setDealerSession(null);
    }
  };

  const deleteDealerAccountRecord = (id: string) => {
    const target = dealerAccounts.find((acc) => acc.id === id);
    const nextAccounts = dealerAccounts.filter((acc) => acc.id !== id);
    saveDealerAccounts(nextAccounts);
    setDealerAccounts(nextAccounts);

    if (target && isFirebaseAdminRef.current) {
      deleteDealerAccountFromCloud(target).catch((err) => console.error(err));
    }

    if (dealerSession && dealerSession.accountId === id) {
      saveActiveDealerSession(null);
      setDealerSession(null);
    }
  };

  const dealerSignIn = async (
    userId: string,
    password: string
  ): Promise<{ success: boolean; message: string; session?: DealerSession }> => {
    const cleanId = userId.trim().toLowerCase();
    const matchedLocal = dealerAccounts.find(
      (acc) => acc.userId.trim().toLowerCase() === cleanId
    );

    if (matchedLocal) {
      if (matchedLocal.password !== password) {
        return {
          success: false,
          message: 'Invalid Dealer User ID or Password. Please verify with Hightone Ceramic Admin.'
        };
      }
      if (!matchedLocal.active) {
        return {
          success: false,
          message: 'This dealer account is currently disabled. Contact factory Admin to restore access.'
        };
      }

      const credHash = matchedLocal.credHash || (await computeDealerCredHash(matchedLocal.userId, matchedLocal.password));
      const nowTime = new Date().toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        dateStyle: 'medium',
        timeStyle: 'short'
      });
      const nextAccounts = dealerAccounts.map((acc) =>
        acc.id === matchedLocal.id ? { ...acc, lastLoginAt: nowTime, credHash } : acc
      );
      saveDealerAccounts(nextAccounts);
      setDealerAccounts(nextAccounts);

      const updatedMatched: DealerAccount = { ...matchedLocal, lastLoginAt: nowTime, credHash };
      const session: DealerSession = {
        ...buildSessionFromAccount(updatedMatched),
        credHash
      };
      saveActiveDealerSession(session);
      setDealerSession(session);

      if (isFirebaseAdminRef.current && !matchedLocal.credHash) {
        saveDealerAccountToCloud(updatedMatched).catch(() => {});
      }

      return {
        success: true,
        message: `Signed in as ${matchedLocal.firmName}.`,
        session
      };
    }

    // Cloud token lookup for public/remote devices where dealer_accounts isn't cached
    try {
      const cloudRes = await authenticateDealerFromCloud(userId, password);
      if (!cloudRes.found || !cloudRes.tokenData) {
        return {
          success: false,
          message: 'Invalid Dealer User ID or Password. Please verify with Hightone Ceramic Admin.'
        };
      }
      if (!cloudRes.active || !cloudRes.tokenData.active) {
        return {
          success: false,
          message: 'This dealer account is currently disabled. Contact factory Admin to restore access.'
        };
      }

      const t = cloudRes.tokenData;
      const nowTime = new Date().toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        dateStyle: 'medium',
        timeStyle: 'short'
      });
      const session: DealerSession = {
        accountId: t.accountId,
        userId: t.userId,
        credHash: cloudRes.credHash,
        firmName: t.firmName,
        contactPerson: t.contactPerson,
        businessType: t.businessType,
        gstNumber: t.gstNumber,
        phoneCode: t.phoneCode,
        whatsappNumber: t.whatsappNumber,
        email: t.email,
        streetAddress: t.streetAddress,
        pincode: t.pincode,
        country: t.country,
        state: t.state,
        district: t.district,
        city: t.city,
        cityState: t.cityState,
        signedInAt: nowTime
      };
      saveActiveDealerSession(session);
      setDealerSession(session);

      const cloudOrders = await fetchDealerOrderFeedFromCloud(cloudRes.credHash).catch(() => []);
      if (cloudOrders.length > 0) {
        setDealerOrders((prev) => {
          const map = new Map<string, SavedDealerOrder>();
          cloudOrders.forEach((o) => map.set(o.id, o));
          prev.forEach((o) => {
            if (!map.has(o.id)) map.set(o.id, o);
          });
          return Array.from(map.values());
        });
      }

      return {
        success: true,
        message: `Signed in as ${t.firmName}.`,
        session
      };
    } catch (err) {
      console.error('Dealer cloud sign-in failed:', err);
      return {
        success: false,
        message: 'Could not verify Dealer credentials with cloud server. Please check connection.'
      };
    }
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
  const productionQueueRef = React.useRef<ProductionQueueItem[]>(productionQueue);
  productionQueueRef.current = productionQueue;

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
    if (isStaffCloud()) {
      prepared.forEach((entry) => saveProductionQueueItemToCloud(entry).catch(() => {}));
    }
  };

  const updateProductionQueueItem = (id: string, updates: Partial<Omit<ProductionQueueItem, 'id'>>) => {
    const existing = productionQueueRef.current.find((item) => item.id === id);
    const merged = existing ? { ...existing, ...updates, id: existing.id } : null;
    setProductionQueue((prev) => {
      const updated = prev
        .map((item) => (item.id === id ? { ...item, ...updates, id: item.id } : item))
        .filter((item) => item.quantityToMake > 0);
      persistProductionQueue(updated);
      return updated;
    });
    if (merged) {
      if (merged.quantityToMake > 0 && isStaffCloud()) {
        saveProductionQueueItemToCloud(merged).catch(() => {});
      } else if (merged.quantityToMake <= 0 && isProdEditorCloud()) {
        deleteProductionQueueItemFromCloud(id).catch(() => {});
      }
    }
  };

  const deleteProductionQueueItem = (id: string) => {
    setProductionQueue((prev) => {
      const updated = prev.filter((item) => item.id !== id);
      persistProductionQueue(updated);
      return updated;
    });
    if (isProdEditorCloud()) {
      deleteProductionQueueItemFromCloud(id).catch(() => {});
    }
  };

  const clearProductionQueue = () => {
    const current = [...productionQueueRef.current];
    setProductionQueue([]);
    try {
      localStorage.removeItem(STORAGE_KEY_PRODUCTION_QUEUE);
    } catch {}
    if (isProdEditorCloud()) {
      current.forEach((item) => deleteProductionQueueItemFromCloud(item.id).catch(() => {}));
    }
  };

  const saveDealerEditedOrder = async (
    id: string,
    editedPayload: DealerOrderPayload
  ): Promise<{ success: boolean; wasAccepted: boolean }> => {
    const prevOrders = [...dealerOrders];
    const { updatedOrders, wasAccepted } = applyDealerOrderEdit(id, {
      ...editedPayload,
      dealerCredHash: editedPayload.dealerCredHash || dealerSession?.credHash
    });
    const editedOrder = updatedOrders.find((o) => o.id === id);
    if (editedOrder) {
      try {
        await saveDealerOrderToCloud(editedOrder, false);
      } catch (err) {
        try {
          localStorage.setItem('hightone_saved_dealer_orders', JSON.stringify(prevOrders));
        } catch {}
        setDealerOrders(prevOrders);
        throw err;
      }
      await syncMatchingDealerFeed(
        editedOrder.dealerAccountId,
        updatedOrders,
        editedOrder.dealerCredHash || dealerSession?.credHash
      );
    }
    setDealerOrders(updatedOrders);
    if (wasAccepted) {
      setProductionQueue((prev) => {
        const removed = prev.filter((q) => q.sourceType === 'order-shortage' && q.sourceOrderId === id);
        const next = prev.filter((q) => !(q.sourceType === 'order-shortage' && q.sourceOrderId === id));
        persistProductionQueue(next);
        if (isProdEditorCloud()) {
          removed.forEach((r) => deleteProductionQueueItemFromCloud(r.id).catch(() => {}));
        }
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

    const acceptedOrder = updated.find((o) => o.id === id);
    if (acceptedOrder && isStaffCloud()) {
      saveDealerOrderToCloud(acceptedOrder, false).catch((err) => console.error(err));
      syncMatchingDealerFeed(acceptedOrder.dealerAccountId, updated, acceptedOrder.dealerCredHash);
    }

    const nowTime = new Date().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      dateStyle: 'medium',
      timeStyle: 'short'
    });
    setProductionQueue((prev) => {
      const removed = prev.filter((q) => q.sourceType === 'order-shortage' && q.sourceOrderId === id);
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
      if (isProdEditorCloud()) {
        removed.forEach((r) => deleteProductionQueueItemFromCloud(r.id).catch(() => {}));
      }
      if (isStaffCloud()) {
        newEntries.forEach((entry) => saveProductionQueueItemToCloud(entry).catch(() => {}));
      }
      return next;
    });
  };

  const rejectDealerOrder = (id: string, reason: string, verifiedBy: string = 'Admin') => {
    const updated = rejectSavedDealerOrder(id, reason, verifiedBy);
    setDealerOrders(updated);
    const rejectedOrder = updated.find((o) => o.id === id);
    if (rejectedOrder && isStaffCloud()) {
      saveDealerOrderToCloud(rejectedOrder, false).catch((err) => console.error(err));
      syncMatchingDealerFeed(rejectedOrder.dealerAccountId, updated, rejectedOrder.dealerCredHash);
    }
    setProductionQueue((prev) => {
      const removed = prev.filter((q) => q.sourceType === 'order-shortage' && q.sourceOrderId === id);
      const next = prev.filter((q) => !(q.sourceType === 'order-shortage' && q.sourceOrderId === id));
      persistProductionQueue(next);
      if (isProdEditorCloud()) {
        removed.forEach((r) => deleteProductionQueueItemFromCloud(r.id).catch(() => {}));
      }
      return next;
    });
  };

  const toggleDealerOrderCompleted = (id: string) => {
    const updated = toggleSavedDealerOrderCompleted(id);
    setDealerOrders(updated);
    const target = updated.find((o) => o.id === id);
    if (target && isStaffCloud()) {
      saveDealerOrderToCloud(target, false).catch((err) => console.error(err));
      syncMatchingDealerFeed(target.dealerAccountId, updated, target.dealerCredHash);
    }
  };

  const removeCompletedDealerOrders = () => {
    const completedOrders = dealerOrders.filter((o) => Boolean(o.completed) || o.status === 'completed');
    const completedIds = new Set(completedOrders.map((o) => o.id));
    const updated = removeCompletedSavedDealerOrders();
    setDealerOrders(updated);
    if (isFullAdminCloud()) {
      completedOrders.forEach((o) => {
        deleteDealerOrderFromCloud(o.id).catch(() => {});
        syncMatchingDealerFeed(o.dealerAccountId, updated, o.dealerCredHash);
      });
    }
    if (completedIds.size > 0) {
      setProductionQueue((prev) => {
        const removed = prev.filter((q) => q.sourceType === 'order-shortage' && q.sourceOrderId && completedIds.has(q.sourceOrderId));
        const next = prev.filter((q) => !(q.sourceType === 'order-shortage' && q.sourceOrderId && completedIds.has(q.sourceOrderId)));
        persistProductionQueue(next);
        if (isProdEditorCloud()) {
          removed.forEach((r) => deleteProductionQueueItemFromCloud(r.id).catch(() => {}));
        }
        return next;
      });
    }
  };

  const deleteDealerOrder = (id: string) => {
    const target = dealerOrders.find((o) => o.id === id);
    const updated = removeDealerOrder(id);
    setDealerOrders(updated);
    if (isFullAdminCloud()) {
      deleteDealerOrderFromCloud(id).catch(() => {});
      if (target) {
        syncMatchingDealerFeed(target.dealerAccountId, updated, target.dealerCredHash);
      }
    }
    setProductionQueue((prev) => {
      const removed = prev.filter((q) => q.sourceType === 'order-shortage' && q.sourceOrderId === id);
      const next = prev.filter((q) => !(q.sourceType === 'order-shortage' && q.sourceOrderId === id));
      persistProductionQueue(next);
      if (isProdEditorCloud()) {
        removed.forEach((r) => deleteProductionQueueItemFromCloud(r.id).catch(() => {}));
      }
      return next;
    });
  };

  const clearDealerOrders = () => {
    const prevOrders = [...dealerOrders];
    clearAllDealerOrders();
    setDealerOrders([]);
    if (isFullAdminCloud()) {
      prevOrders.forEach((o) => deleteDealerOrderFromCloud(o.id).catch(() => {}));
    }
    setProductionQueue((prev) => {
      const removed = prev.filter((q) => q.sourceType === 'order-shortage');
      const next = prev.filter((q) => q.sourceType !== 'order-shortage');
      persistProductionQueue(next);
      if (isProdEditorCloud()) {
        removed.forEach((r) => deleteProductionQueueItemFromCloud(r.id).catch(() => {}));
      }
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
  const dailyProductionLogsRef = React.useRef<DailyProductionEntry[]>(dailyProductionLogs);
  dailyProductionLogsRef.current = dailyProductionLogs;

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
    if (isProdEditorCloud()) {
      saveDailyProductionLogToCloud(newEntry).catch(() => {});
    }
  };

  const updateDailyProductionEntry = (
    id: string,
    updates: Partial<Omit<DailyProductionEntry, 'id'>>
  ) => {
    const existing = dailyProductionLogsRef.current.find((item) => item.id === id);
    const merged = existing ? { ...existing, ...updates, id: existing.id } : null;
    setDailyProductionLogs((prev) => {
      const updated = prev.map((item) => (item.id === id ? { ...item, ...updates, id: item.id } : item));
      try {
        localStorage.setItem(STORAGE_KEY_PRODUCTION_LOGS, JSON.stringify(updated));
      } catch {}
      return updated;
    });
    if (isProdEditorCloud() && merged) {
      saveDailyProductionLogToCloud(merged).catch(() => {});
    }
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

    const prevLogs = dailyProductionLogsRef.current;
    const matchingLogs = prevLogs.filter((l) => l.itemKey === item.itemKey);
    const currentTotal = matchingLogs.reduce((sum, l) => sum + (l.quantityMade || 0), 0);
    if (safeTarget === currentTotal) return;

    const toSave: DailyProductionEntry[] = [];
    const toDeleteIds: string[] = [];
    let nextLogs: DailyProductionEntry[];

    if (safeTarget === 0) {
      matchingLogs.forEach((l) => toDeleteIds.push(l.id));
      nextLogs = prevLogs.filter((l) => l.itemKey !== item.itemKey);
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
      toSave.push(newEntry);
      nextLogs = [newEntry, ...prevLogs];
    } else {
      let toSubtract = currentTotal - safeTarget;
      nextLogs = prevLogs
        .map((log) => {
          if (log.itemKey !== item.itemKey || toSubtract <= 0) return log;
          if (log.quantityMade <= toSubtract) {
            toSubtract -= log.quantityMade;
            toDeleteIds.push(log.id);
            return null;
          }
          const nextQty = log.quantityMade - toSubtract;
          toSubtract = 0;
          const updatedLog: DailyProductionEntry = {
            ...log,
            quantityMade: nextQty,
            notes: note?.trim() || log.notes
          };
          toSave.push(updatedLog);
          return updatedLog;
        })
        .filter((l): l is DailyProductionEntry => l !== null);
    }

    setDailyProductionLogs(nextLogs);
    try {
      localStorage.setItem(STORAGE_KEY_PRODUCTION_LOGS, JSON.stringify(nextLogs));
    } catch {}

    if (isProdEditorCloud()) {
      toDeleteIds.forEach((id) => deleteDailyProductionLogFromCloud(id).catch(() => {}));
      toSave.forEach((entry) => saveDailyProductionLogToCloud(entry).catch(() => {}));
    }
  };

  const deleteDailyProductionEntry = (id: string) => {
    setDailyProductionLogs((prev) => {
      const updated = prev.filter((item) => item.id !== id);
      try {
        localStorage.setItem(STORAGE_KEY_PRODUCTION_LOGS, JSON.stringify(updated));
      } catch {}
      return updated;
    });
    if (isProdEditorCloud()) {
      deleteDailyProductionLogFromCloud(id).catch(() => {});
    }
  };

  const clearDailyProductionLogs = () => {
    const current = [...dailyProductionLogsRef.current];
    setDailyProductionLogs([]);
    try {
      localStorage.removeItem(STORAGE_KEY_PRODUCTION_LOGS);
    } catch {}
    if (isProdEditorCloud()) {
      current.forEach((entry) => deleteDailyProductionLogFromCloud(entry.id).catch(() => {}));
    }
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
      if (isProdEditorCloud()) {
        saveProductionStateToCloud(updated).catch(() => {});
      }
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
      if (isFirebaseAdminRef.current) {
        saveCatalogSettingsToCloud({ productConfigs: updated }).catch(() => {});
      }
      return updated;
    });
  };

  const resetProductConfigs = () => {
    try {
      localStorage.removeItem(STORAGE_KEY_PRODUCT_CONFIGS);
    } catch {}
    setProductConfigs({});
    if (isFirebaseAdminRef.current) {
      saveCatalogSettingsToCloud({ productConfigs: {} }).catch(() => {});
    }
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
      if (isFirebaseAdminRef.current) {
        saveCatalogSettingsToCloud({ colorsList: updated }).catch(() => {});
      }
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
      if (isFirebaseAdminRef.current) {
        saveCatalogSettingsToCloud({ colorsList: updated }).catch(() => {});
      }
      return updated;
    });
  };

  const removeColor = (colorName: string) => {
    setColorsList((prev) => {
      const updated = prev.filter((c) => c.toLowerCase() !== colorName.toLowerCase());
      try {
        localStorage.setItem(STORAGE_KEY_COLORS, JSON.stringify(updated));
      } catch {}
      if (isFirebaseAdminRef.current) {
        saveCatalogSettingsToCloud({ colorsList: updated }).catch(() => {});
      }
      return updated;
    });
  };

  const resetColors = () => {
    try {
      localStorage.removeItem(STORAGE_KEY_COLORS);
    } catch {}
    setColorsList(DEFAULT_FACTORY_COLORS);
    if (isFirebaseAdminRef.current) {
      saveCatalogSettingsToCloud({ colorsList: DEFAULT_FACTORY_COLORS }).catch(() => {});
    }
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
      if (isFirebaseAdminRef.current) {
        saveCatalogSettingsToCloud({ designCodesList: updated }).catch(() => {});
      }
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
      if (isFirebaseAdminRef.current) {
        saveCatalogSettingsToCloud({ designCodesList: updated }).catch(() => {});
      }
      return updated;
    });
  };

  const removeDesignCode = (code: string) => {
    setDesignCodesList((prev) => {
      const updated = prev.filter((c) => c !== code);
      try {
        localStorage.setItem(STORAGE_KEY_DESIGN_CODES, JSON.stringify(updated));
      } catch {}
      if (isFirebaseAdminRef.current) {
        saveCatalogSettingsToCloud({ designCodesList: updated }).catch(() => {});
      }
      return updated;
    });
  };

  const resetDesignCodes = () => {
    try {
      localStorage.removeItem(STORAGE_KEY_DESIGN_CODES);
    } catch {}
    setDesignCodesList(DEFAULT_DESIGN_CODES);
    if (isFirebaseAdminRef.current) {
      saveCatalogSettingsToCloud({ designCodesList: DEFAULT_DESIGN_CODES }).catch(() => {});
    }
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
    if (isFirebaseAdminRef.current) {
      saveCatalogSettingsToCloud({ globalDefaultCode: clean }).catch(() => {});
    }
  };

  const resetGlobalDefaultCode = () => {
    setGlobalDefaultCode('');
    try {
      localStorage.removeItem(STORAGE_KEY_GLOBAL_DEFAULT_CODE);
    } catch {}
    if (isFirebaseAdminRef.current) {
      saveCatalogSettingsToCloud({ globalDefaultCode: '' }).catch(() => {});
    }
  };

  const [collectionSeoMap, setCollectionSeoMap] = useState<Record<string, CollectionSeoMeta>>(() => getStoredCollectionSeo());
  const [ga4MeasurementId, setGa4MeasurementId] = useState<string>(() => getSavedGA4Id());

  const saveGa4MeasurementId = (id: string) => {
    const clean = id.trim();
    saveGA4Id(clean);
    setGa4MeasurementId(clean);
    if (isFullAdminCloud()) {
      saveCmsMediaAndCompanyToCloud({ ga4MeasurementId: clean }).catch(() => {});
    }
  };

  const updateCollectionSeo = (collectionId: string, seo: CollectionSeoMeta) => {
    updateSingleCollectionSeo(collectionId, seo);
    setCollectionSeoMap((prev) => {
      const next = {
        ...prev,
        [collectionId]: seo
      };
      if (isFullAdminCloud()) {
        saveCmsSeoAndLegalToCloud({ collectionSeoMap: next }).catch(() => {});
      }
      return next;
    });
  };

  const resetCollectionSeo = (collectionId: string) => {
    removeSingleCollectionSeo(collectionId);
    setCollectionSeoMap((prev) => {
      const copy = { ...prev };
      delete copy[collectionId];
      if (isFullAdminCloud()) {
        saveCmsSeoAndLegalToCloud({ collectionSeoMap: copy }).catch(() => {});
      }
      return copy;
    });
  };

  const updateCollectionsMeta = (updated: Record<string, Partial<CategoryMeta>>) => {
    setCollectionsMeta(updated);
    localStorage.setItem(STORAGE_KEY_COLLECTIONS, JSON.stringify(updated));
    if (isFullAdminCloud()) {
      saveCatalogSettingsToCloud({ collectionsMeta: updated }).catch(() => {});
    }
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
      if (isFullAdminCloud()) {
        saveCatalogSettingsToCloud({ collectionsMeta: copy }).catch(() => {});
      }
      return copy;
    });
  };

  const resetCollectionsOrder = () => {
    setCollectionsMeta({});
    localStorage.removeItem(STORAGE_KEY_COLLECTIONS);
    if (isFullAdminCloud()) {
      saveCatalogSettingsToCloud({ collectionsMeta: {} }).catch(() => {});
    }
  };

  // --- FIREBASE BOOTSTRAP, AUTH STATE & REAL-TIME CLOUD SYNC ---
  const applyCloudSettingsPayload = React.useCallback((settings: {
    productConfigs?: Record<string, ProductConfigOverride>;
    colorsList?: string[];
    designCodesList?: string[];
    globalDefaultCode?: string;
    collectionsMeta?: Record<string, Partial<CategoryMeta>>;
    companyInfo?: CompanyInfoMap;
    productionCheckedKeys?: Record<string, boolean>;
  }) => {
    if (settings.productConfigs && typeof settings.productConfigs === 'object') {
      setProductConfigs(settings.productConfigs);
      try {
        localStorage.setItem(STORAGE_KEY_PRODUCT_CONFIGS, JSON.stringify(settings.productConfigs));
      } catch {}
    }
    if (Array.isArray(settings.colorsList) && settings.colorsList.length > 0) {
      setColorsList(settings.colorsList);
      try {
        localStorage.setItem(STORAGE_KEY_COLORS, JSON.stringify(settings.colorsList));
      } catch {}
    }
    if (Array.isArray(settings.designCodesList) && settings.designCodesList.length > 0) {
      setDesignCodesList(settings.designCodesList);
      try {
        localStorage.setItem(STORAGE_KEY_DESIGN_CODES, JSON.stringify(settings.designCodesList));
      } catch {}
    }
    if (typeof settings.globalDefaultCode === 'string') {
      setGlobalDefaultCode(settings.globalDefaultCode);
      try {
        if (settings.globalDefaultCode) {
          localStorage.setItem(STORAGE_KEY_GLOBAL_DEFAULT_CODE, settings.globalDefaultCode);
        } else {
          localStorage.removeItem(STORAGE_KEY_GLOBAL_DEFAULT_CODE);
        }
      } catch {}
    }
    if (settings.collectionsMeta && typeof settings.collectionsMeta === 'object') {
      setCollectionsMeta(settings.collectionsMeta);
      try {
        localStorage.setItem(STORAGE_KEY_COLLECTIONS, JSON.stringify(settings.collectionsMeta));
      } catch {}
    }
    if (settings.companyInfo && typeof settings.companyInfo === 'object') {
      setCompanyInfo(settings.companyInfo);
      try {
        localStorage.setItem(STORAGE_KEY_COMPANY, JSON.stringify(settings.companyInfo));
      } catch {}
    }
    if (settings.productionCheckedKeys && typeof settings.productionCheckedKeys === 'object') {
      setProductionCheckedKeys(settings.productionCheckedKeys);
      try {
        localStorage.setItem(STORAGE_KEY_PRODUCTION_CHECKED, JSON.stringify(settings.productionCheckedKeys));
      } catch {}
    }
  }, []);

  const applyCloudCmsProducts = React.useCallback((data: CloudCmsProductsPayload) => {
    if (Array.isArray(data.products) && data.products.length > 0) {
      const unique = ensureUniqueProducts(data.products);
      setProducts(unique);
      try {
        localStorage.setItem(STORAGE_KEY_PRODUCTS, JSON.stringify(unique));
      } catch {}
    }
    if (data.sheetId !== undefined) {
      setSheetId(data.sheetId);
      try {
        if (data.sheetId) {
          localStorage.setItem(STORAGE_KEY_SHEET_ID, data.sheetId);
        } else {
          localStorage.removeItem(STORAGE_KEY_SHEET_ID);
        }
      } catch {}
    }
    if (data.lastSyncTime !== undefined) {
      setLastSyncTime(data.lastSyncTime);
      try {
        if (data.lastSyncTime) {
          localStorage.setItem(STORAGE_KEY_LAST_SYNC, data.lastSyncTime);
        } else {
          localStorage.removeItem(STORAGE_KEY_LAST_SYNC);
        }
      } catch {}
    }
  }, []);

  const applyCloudCmsMediaCompany = React.useCallback((data: CloudCmsMediaAndCompanyPayload) => {
    if (data.siteMedia && typeof data.siteMedia === 'object') {
      setSiteMedia(data.siteMedia);
      try {
        localStorage.setItem(STORAGE_KEY_MEDIA, JSON.stringify(data.siteMedia));
      } catch {}
    }
    if (data.companyInfo && typeof data.companyInfo === 'object') {
      setCompanyInfo(data.companyInfo);
      try {
        localStorage.setItem(STORAGE_KEY_COMPANY, JSON.stringify(data.companyInfo));
      } catch {}
    }
    if (Array.isArray(data.faqs) && data.faqs.length > 0) {
      setFaqs(data.faqs);
      try {
        localStorage.setItem(STORAGE_KEY_FAQS, JSON.stringify(data.faqs));
      } catch {}
    }
    if (typeof data.sheetWebhookUrl === 'string') {
      saveSheetWebhookUrl(data.sheetWebhookUrl);
      setSheetWebhookUrlState(data.sheetWebhookUrl);
    }
    if (typeof data.ga4MeasurementId === 'string') {
      saveGA4Id(data.ga4MeasurementId);
      setGa4MeasurementId(data.ga4MeasurementId);
    }
  }, []);

  const applyCloudCmsSeoLegal = React.useCallback((data: CloudCmsSeoAndLegalPayload) => {
    if (data.legalPolicies && typeof data.legalPolicies === 'object') {
      setLegalPolicies(data.legalPolicies);
      try {
        localStorage.setItem(STORAGE_KEY_LEGAL, JSON.stringify(data.legalPolicies));
      } catch {}
    }
    if (data.collectionSeoMap && typeof data.collectionSeoMap === 'object') {
      setCollectionSeoMap(data.collectionSeoMap);
      saveStoredCollectionSeo(data.collectionSeoMap);
    }
  }, []);

  const applyCloudProductionState = React.useCallback((data: CloudProductionStatePayload) => {
    if (data.productionCheckedKeys && typeof data.productionCheckedKeys === 'object') {
      setProductionCheckedKeys(data.productionCheckedKeys);
      try {
        localStorage.setItem(STORAGE_KEY_PRODUCTION_CHECKED, JSON.stringify(data.productionCheckedKeys));
      } catch {}
    }
  }, []);

  // 0. Track browser online/offline network status for accurate backend indicator
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleOnline = () => {
      setIsBrowserOnline(true);
      if (isFirebaseAdminRef.current) {
        runBackendDiagnostics().catch(() => {});
      }
    };
    const handleOffline = () => {
      setIsBrowserOnline(false);
      setHasConfirmedCloudSync(false);
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [runBackendDiagnostics]);

  // 1. Validate Firestore connection & listen to Firebase Auth (Owner + Authorized Staff)
  useEffect(() => {
    testConnection().catch(() => {});
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        const profile = await getAuthorizedCloudUserProfile(user.uid, user.email, user.emailVerified);
        const isAllowed = Boolean(profile?.allowed);
        setIsFirebaseAdmin(isAllowed);
        setActiveCloudRole(profile?.allowed ? profile.role : null);
        if (!isAllowed) {
          setHasConfirmedCloudSync(false);
        } else if (!adminSessionRef.current && profile) {
          setAdminSession({
            userId: profile.email || user.email || user.uid,
            displayName: profile.displayName || user.displayName || 'Admin',
            role: profile.role,
            isMasterOwner: profile.isMasterOwner,
            ...(profile.email ? { staffEmail: profile.email } : {})
          });
        }
      } else {
        setIsFirebaseAdmin(false);
        setActiveCloudRole(null);
        setHasConfirmedCloudSync(false);
        setCloudSyncError(null);
      }
      setIsFirebaseAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // 2. Public visitors fetch & subscribe to shared CMS docs (products, colors, company info, SEO)
  useEffect(() => {
    if (isFirebaseAdmin) return;
    let active = true;
    fetchAllPublicCmsFromCloud()
      .then((bundle) => {
        if (!active) return;
        if (bundle.catalogConfig) applyCloudSettingsPayload(bundle.catalogConfig);
        if (bundle.cmsProducts) applyCloudCmsProducts(bundle.cmsProducts);
        if (bundle.cmsMediaCompany) applyCloudCmsMediaCompany(bundle.cmsMediaCompany);
        if (bundle.cmsSeoLegal) applyCloudCmsSeoLegal(bundle.cmsSeoLegal);
        if (bundle.productionState) applyCloudProductionState(bundle.productionState);
      })
      .catch(() => {});

    const unsubscribe = subscribePublicCmsDocs({
      onCatalogSettings: (settings) => {
        if (active) applyCloudSettingsPayload(settings);
      },
      onCmsProducts: (data) => {
        if (active) applyCloudCmsProducts(data);
      },
      onCmsMediaCompany: (data) => {
        if (active) applyCloudCmsMediaCompany(data);
      },
      onCmsSeoLegal: (data) => {
        if (active) applyCloudCmsSeoLegal(data);
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [
    isFirebaseAdmin,
    applyCloudSettingsPayload,
    applyCloudCmsProducts,
    applyCloudCmsMediaCompany,
    applyCloudCmsSeoLegal,
    applyCloudProductionState
  ]);

  // 3. Admin one-time local->cloud migration + role-aware real-time Firestore collection listeners
  useEffect(() => {
    if (!isFirebaseAdmin || !activeCloudRole) return;
    let isCancelled = false;

    const migrateLocalDataIfNeeded = async () => {
      if (activeCloudRole !== 'admin') return;
      if (localStorage.getItem('htc_firebase_migrated_v3') === 'true') return;
      try {
        const tasks: Promise<unknown>[] = [];
        getDealerApplications().forEach((app) => {
          tasks.push(saveDealerApplicationToCloud(app));
        });
        const localAccounts = getDealerAccounts();
        const localOrders = getSavedDealerOrders();
        localAccounts.forEach((acc) => {
          tasks.push(
            saveDealerAccountToCloud(acc).then((credHash) =>
              syncDealerOrderFeedToCloud(credHash, acc.id, localOrders)
            )
          );
        });
        localOrders.forEach((ord) => {
          tasks.push(saveDealerOrderToCloud(ord, false));
        });
        getSavedInquiries().forEach((inq) => {
          tasks.push(saveInquiryToCloud(inq));
        });
        productionQueueRef.current.forEach((item) => {
          tasks.push(saveProductionQueueItemToCloud(item));
        });
        dailyProductionLogsRef.current.forEach((entry) => {
          tasks.push(saveDailyProductionLogToCloud(entry));
        });
        staffAccountsRef.current.forEach((staff) => {
          tasks.push(saveStaffAccountToCloud(staff));
        });

        const masterUser =
          localStorage.getItem('hightone_admin_user') ||
          localStorage.getItem('hightone_sheet_admin_user') ||
          '';
        const masterPass =
          localStorage.getItem('hightone_admin_password') ||
          localStorage.getItem('hightone_sheet_admin_pass') ||
          '';
        if (masterUser.trim() && masterPass.trim()) {
          tasks.push(saveMasterOwnerTokenToCloud(masterUser.trim(), masterPass.trim()));
        }

        tasks.push(
          saveCatalogSettingsToCloud({
            productConfigs,
            colorsList,
            designCodesList,
            globalDefaultCode,
            collectionsMeta,
            companyInfo,
            sheetId
          })
        );
        tasks.push(saveProductionStateToCloud(productionCheckedKeys));
        tasks.push(
          saveCmsProductsToCloud({
            products,
            sheetId,
            lastSyncTime
          })
        );
        tasks.push(
          saveCmsMediaAndCompanyToCloud({
            siteMedia,
            companyInfo,
            faqs,
            sheetWebhookUrl,
            ga4MeasurementId
          })
        );
        tasks.push(
          saveCmsSeoAndLegalToCloud({
            legalPolicies,
            collectionSeoMap
          })
        );

        const results = await Promise.allSettled(tasks);
        const hasFailures = results.some((r) => r.status === 'rejected');
        if (!hasFailures) {
          localStorage.setItem('htc_firebase_migrated_v3', 'true');
          localStorage.setItem('htc_firebase_migrated_v2', 'true');
          localStorage.setItem('htc_firebase_migrated_v1', 'true');
        }
      } catch (err) {
        console.warn('Initial local-to-cloud migration note:', err);
      }
    };

    migrateLocalDataIfNeeded();
    runBackendDiagnostics().catch(() => {});

    const unsubscribe = subscribeAdminCollections(activeCloudRole, {
      onApplications: (cloudApps) => {
        if (isCancelled) return;
        setDealerApplications(cloudApps);
        saveDealerApplications(cloudApps);
      },
      onAccounts: (cloudAccounts) => {
        if (isCancelled) return;
        setDealerAccounts(cloudAccounts);
        saveDealerAccounts(cloudAccounts);
      },
      onOrders: (cloudOrders) => {
        if (isCancelled) return;
        setDealerOrders(cloudOrders);
        try {
          localStorage.setItem('hightone_saved_dealer_orders', JSON.stringify(cloudOrders));
        } catch {}
      },
      onInquiries: (cloudInquiries) => {
        if (isCancelled) return;
        setInquiries(cloudInquiries);
        try {
          localStorage.setItem('hightone_saved_inquiries', JSON.stringify(cloudInquiries));
        } catch {}
      },
      onProductionQueue: (cloudQueue) => {
        if (isCancelled) return;
        setProductionQueue(cloudQueue);
        persistProductionQueue(cloudQueue);
      },
      onDailyLogs: (cloudLogs) => {
        if (isCancelled) return;
        setDailyProductionLogs(cloudLogs);
        try {
          localStorage.setItem(STORAGE_KEY_PRODUCTION_LOGS, JSON.stringify(cloudLogs));
        } catch {}
      },
      onStaffAccounts: (cloudStaff) => {
        if (isCancelled) return;
        setStaffAccounts(cloudStaff);
        saveStaffAccounts(cloudStaff);
      },
      onCatalogSettings: (settings) => {
        if (isCancelled) return;
        applyCloudSettingsPayload(settings);
      },
      onCmsProducts: (data) => {
        if (isCancelled) return;
        applyCloudCmsProducts(data);
      },
      onCmsMediaCompany: (data) => {
        if (isCancelled) return;
        applyCloudCmsMediaCompany(data);
      },
      onCmsSeoLegal: (data) => {
        if (isCancelled) return;
        applyCloudCmsSeoLegal(data);
      },
      onProductionState: (data) => {
        if (isCancelled) return;
        applyCloudProductionState(data);
      },
      onServerSync: (_colName, fromCache) => {
        if (isCancelled) return;
        if (!fromCache) {
          setHasConfirmedCloudSync(true);
          setCloudSyncError(null);
        }
      },
      onError: (err) => {
        if (isCancelled) return;
        setHasConfirmedCloudSync(false);
        setCloudSyncError(err instanceof Error ? err.message : 'Cloud sync encountered an error.');
      }
    });

    return () => {
      isCancelled = true;
      unsubscribe();
    };
  }, [
    isFirebaseAdmin,
    activeCloudRole,
    applyCloudSettingsPayload,
    applyCloudCmsProducts,
    applyCloudCmsMediaCompany,
    applyCloudCmsSeoLegal,
    applyCloudProductionState,
    runBackendDiagnostics
  ]);

  // 4. Signed-in Dealer live order feed sync & remote token validation
  useEffect(() => {
    const credHash = dealerSession?.credHash;
    if (!credHash) return;
    let isCancelled = false;

    getDoc(doc(db, 'dealer_auth_tokens', credHash))
      .then((snap) => {
        if (isCancelled) return;
        if (snap.exists()) {
          if (snap.data()?.active !== true) {
            saveActiveDealerSession(null);
            setDealerSession(null);
          }
          return;
        }
        const localMatch = getDealerAccounts().find(
          (acc) => acc.id === dealerSession?.accountId && acc.active
        );
        if (localMatch) {
          if (isFullAdminCloud()) {
            saveDealerAccountToCloud(localMatch).catch(() => {});
          }
          return;
        }
        saveActiveDealerSession(null);
        setDealerSession(null);
      })
      .catch(() => {});

    const unsubscribe = subscribeDealerOrderFeed(credHash, (cloudOrders) => {
      if (isCancelled) return;
      setDealerOrders((prev) => {
        const map = new Map<string, SavedDealerOrder>();
        cloudOrders.forEach((o) => map.set(o.id, o));
        prev.forEach((o) => {
          const isSameDealer =
            o.dealerAccountId === dealerSession?.accountId || o.dealerCredHash === credHash;
          if (!isSameDealer && !map.has(o.id)) {
            map.set(o.id, o);
          }
        });
        const merged = Array.from(map.values());
        try {
          localStorage.setItem('hightone_saved_dealer_orders', JSON.stringify(merged));
        } catch {}
        return merged;
      });
    });

    return () => {
      isCancelled = true;
      unsubscribe();
    };
  }, [dealerSession?.credHash, dealerSession?.accountId]);

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
        ga4MeasurementId,
        saveGa4MeasurementId,
        updateCollectionsMeta,
        updateSingleCollectionOrder,
        resetCollectionsOrder,
        updateCompanyInfo,
        resetCompanyInfo,
        staffAccounts,
        addStaffAccount,
        updateStaffAccount,
        updateStaffRole,
        toggleStaffActive,
        deleteStaffAccount,
        updateMasterOwnerCredentials,
        signInAdminWithCredentials,
        adminSession,
        activeAdminRole,
        loginWithRole,
        setAdminSession,
        logoutAdminSession,
        firebaseUser,
        isFirebaseAdmin,
        activeCloudRole,
        isFirebaseAuthReady,
        cloudSyncError,
        backendSyncStatus,
        backendDiagnostic,
        isVerifyingBackend,
        runBackendDiagnostics,
        signInAdminWithGoogle
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
