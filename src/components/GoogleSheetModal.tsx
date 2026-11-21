import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useWebsiteData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import {
  X,
  Menu,
  LayoutDashboard,
  Package,
  FileSpreadsheet,
  Scale,
  Palette,
  ListOrdered,
  TrendingUp,
  Globe,
  Table,
  MapPin,
  ShieldCheck,
  Lock,
  AlertCircle,
  CheckCircle2,
  Search,
  RefreshCw,
  ArrowLeft,
  LogOut,
  Factory,
  XCircle,
  UserCheck,
  Users,
  BarChart3,
  Cloud,
  BookOpen
} from 'lucide-react';
import { AdminRole, AdminStaffAccount, AnalyticsEvent, CategoryMeta, SavedDealerOrder } from '../types';
import { buildMergedCategoriesList } from './pages/CollectionsPage';
import { generateRecommendedSeo } from '../services/seoService';
import { cleanGoogleMapsEmbedUrl, DEFAULT_COMPANY_INFO } from '../services/googleSheetsService';
import {
  getAnalyticsSummary,
  computeAnalyticsSummaryFromEvents,
  clearAnalyticsData,
  copyAnalyticsForSheets,
  requestPreciseLocation,
  formatLocationString
} from '../services/analyticsService';
import {
  fetchCloudAnalyticsEvents,
  subscribeCloudAnalyticsEvents,
  clearCloudAnalyticsEvents
} from '../services/firestoreSyncService';
import { AdminNavItem, AdminSectionId, ConfirmDialogConfig } from './admin/adminTypes';
import { AdminDashboardOverview } from './admin/AdminDashboardOverview';
import { AdminDealerOrderDashboard } from './admin/AdminDealerOrderDashboard';
import { AdminDealerOrdersPanel, AdminInquiriesPanel } from './admin/AdminOperationsPanels';
import { AdminDealersPanel } from './admin/AdminDealersPanel';
import { AdminProductionPanel } from './admin/AdminProductionPanel';
import { AdminLoginOverlay } from './admin/AdminLoginOverlay';
import {
  ROLE_DEFINITIONS,
  hasPermission,
  canAccessSection,
  getDefaultSectionForRole,
  normalizeAdminRole,
  buildProductionManufactureTargets
} from '../utils/adminRoles';
import {
  AdminProductConfigPanel,
  AdminColorsCodesPanel,
  AdminCollectionOrderPanel
} from './admin/AdminCatalogPanels';
import { AdminInsightsPanel, AdminSeoPanel } from './admin/AdminDigitalPanels';
import { AdminBlogPanel } from './admin/AdminBlogPanel';
import {
  AdminCmsSyncPanel,
  AdminLocationPanel,
  AdminSecurityPanel
} from './admin/AdminSystemPanels';
import { AdminNotificationsMenu } from './admin/AdminNotificationsMenu';
import {
  AdminNotificationItem,
  getDesktopAlertsEnabled,
  getNotificationSoundEnabled,
  getReadNotificationIds,
  markNotificationIdsRead,
  playAdminAlertChime,
  requestDesktopAlertPermission,
  setNotificationSoundEnabled,
  showDesktopAdminNotification,
  unmarkNotificationIdRead
} from '../services/adminNotificationService';

interface GoogleSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GoogleSheetModal: React.FC<GoogleSheetModalProps> = ({ isOpen, onClose }) => {
  const {
    sheetId,
    isSyncing,
    lastSyncTime,
    syncError,
    connectSheet,
    disconnectSheet,
    refreshData,
    products,
    inquiries,
    updateInquiry,
    deleteInquiry,
    clearInquiries,
    downloadCSV,
    copyForSheets,
    dealerOrders,
    updateDealerOrder,
    acceptDealerOrder,
    rejectDealerOrder,
    toggleDealerOrderCompleted,
    removeCompletedDealerOrders,
    deleteDealerOrder,
    clearDealerOrders,
    downloadDealerOrdersCSV,
    dealerApplications,
    dealerAccounts,
    updateDealerApplicationKyc,
    approveDealerApplication,
    rejectDealerApplication,
    deleteDealerApplication,
    createManualDealerAccount,
    updateDealerAccountRecord,
    toggleDealerAccountActive,
    deleteDealerAccountRecord,
    productionQueue,
    addProductionQueueItems,
    updateProductionQueueItem,
    deleteProductionQueueItem,
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
    sheetWebhookUrl,
    updateWebhookUrl,
    siteMedia,
    collectionsMeta,
    collectionSeoMap,
    updateCollectionSeo,
    resetCollectionSeo,
    blogPosts,
    saveBlogPost,
    deleteBlogPost,
    toggleBlogPostStatus,
    restoreStarterBlogPosts,
    ga4MeasurementId,
    saveGa4MeasurementId,
    updateCollectionsMeta,
    resetCollectionsOrder,
    companyInfo,
    updateCompanyInfo,
    resetCompanyInfo,
    staffAccounts,
    addStaffAccount,
    updateStaffAccount,
    updateStaffRole,
    toggleStaffActive,
    deleteStaffAccount,
    updateMasterOwnerCredentials,
    adminSession,
    setAdminSession,
    logoutAdminSession,
    firebaseUser,
    isFirebaseAuthReady,
    isFirebaseAdmin,
    activeCloudRole,
    cloudSyncError,
    lastCloudMergeNotice,
    clearCloudMergeNotice,
    backendSyncStatus,
    backendDiagnostic,
    isVerifyingBackend,
    runBackendDiagnostics,
    signInAdminWithGoogle
  } = useWebsiteData();
  const { toastSuccess, toastInfo, toastWarning, toastError } = useToast();
  const [isConnectingCloudSync, setIsConnectingCloudSync] = useState(false);

  const handleConnectCloudSync = async (): Promise<{ success: boolean; message: string }> => {
    setIsConnectingCloudSync(true);
    try {
      const res = await signInAdminWithGoogle();
      if (res.success) {
        toastSuccess(res.message, 'Cloud Sync Active');
      } else {
        toastError(res.message, 'Cloud Sync Failed');
      }
      return res;
    } finally {
      setIsConnectingCloudSync(false);
    }
  };

  const handleVerifyBackendConnection = async () => {
    const report = await runBackendDiagnostics();
    if (report.backendConnected && report.configMatches) {
      toastSuccess(report.summary, 'Backend Verified');
    } else if (!navigator.onLine) {
      toastWarning(report.summary, 'Offline');
    } else {
      toastError(report.summary, 'Backend Verification Issue');
    }
  };

  // Authentication & Role-Based Session State (Unified Google Cloud Sync)
  const isAuthenticated = Boolean(adminSession) && isFirebaseAdmin;
  const effectiveRole: AdminRole = normalizeAdminRole(adminSession?.role || 'sales');
  const hideDealerContact = effectiveRole === 'sales';

  useEffect(() => {
    if (isOpen && lastCloudMergeNotice) {
      toastSuccess(lastCloudMergeNotice, 'Local Data Synced');
      clearCloudMergeNotice();
    }
  }, [isOpen, lastCloudMergeNotice, clearCloudMergeNotice, toastSuccess]);

  // Admin Credentials State
  const [customUserIdInput, setCustomUserIdInput] = useState(() => {
    return typeof window !== 'undefined' ? localStorage.getItem('hightone_admin_user') || '' : '';
  });
  const [customPasswordInput, setCustomPasswordInput] = useState('');
  const [credentialChangeStatus, setCredentialChangeStatus] = useState<string | null>(null);

  // Navigation & Shared Modals State
  const [activeSection, setActiveSection] = useState<AdminSectionId>(() =>
    getDefaultSectionForRole(effectiveRole)
  );
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const [pendingConfirm, setPendingConfirm] = useState<ConfirmDialogConfig | null>(null);
  const [rejectTargetOrder, setRejectTargetOrder] = useState<SavedDealerOrder | null>(null);
  const [rejectReasonInput, setRejectReasonInput] = useState('');

  // CMS & Webhook State
  const [inputUrl, setInputUrl] = useState('');
  const [webhookInput, setWebhookInput] = useState(sheetWebhookUrl);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [orderSearchFilter, setOrderSearchFilter] = useState('');
  const [copiedSuccess, setCopiedSuccess] = useState(false);

  // Factory Location State
  const [locAddress, setLocAddress] = useState(companyInfo.factory_address || DEFAULT_COMPANY_INFO.factory_address);
  const [locEmbedUrl, setLocEmbedUrl] = useState(companyInfo.google_maps_embed_url || DEFAULT_COMPANY_INFO.google_maps_embed_url);
  const [locMapsUrl, setLocMapsUrl] = useState(companyInfo.google_maps_url || DEFAULT_COMPANY_INFO.google_maps_url);
  const [locPhone1, setLocPhone1] = useState(companyInfo.primary_phone || DEFAULT_COMPANY_INFO.primary_phone);
  const [locPhone2, setLocPhone2] = useState(companyInfo.secondary_phone || DEFAULT_COMPANY_INFO.secondary_phone);
  const [locSaveStatus, setLocSaveStatus] = useState<string | null>(null);

  useEffect(() => {
    setLocAddress(companyInfo.factory_address || DEFAULT_COMPANY_INFO.factory_address);
    setLocEmbedUrl(companyInfo.google_maps_embed_url || DEFAULT_COMPANY_INFO.google_maps_embed_url);
    setLocMapsUrl(companyInfo.google_maps_url || DEFAULT_COMPANY_INFO.google_maps_url);
    setLocPhone1(companyInfo.primary_phone || DEFAULT_COMPANY_INFO.primary_phone);
    setLocPhone2(companyInfo.secondary_phone || DEFAULT_COMPANY_INFO.secondary_phone);
  }, [companyInfo]);

  useEffect(() => {
    setWebhookInput(sheetWebhookUrl);
  }, [sheetWebhookUrl]);

  // Private Insights State
  const [cloudAnalyticsEvents, setCloudAnalyticsEvents] = useState<AnalyticsEvent[] | null>(null);
  const [insightsSummary, setInsightsSummary] = useState(() => getAnalyticsSummary());
  const [ga4IdInput, setGa4IdInput] = useState(ga4MeasurementId);
  const [ga4SaveStatus, setGa4SaveStatus] = useState<string | null>(null);
  const [copiedInsightsSuccess, setCopiedInsightsSuccess] = useState(false);
  const [selectedLocationFilter, setSelectedLocationFilter] = useState<string>('all');
  const [isDetectingGps, setIsDetectingGps] = useState<boolean>(false);
  const [gpsStatusMessage, setGpsStatusMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  useEffect(() => {
    setGa4IdInput(ga4MeasurementId);
  }, [ga4MeasurementId]);

  const refreshInsightsData = async (notify = false) => {
    if (isFirebaseAdmin && activeCloudRole === 'admin') {
      try {
        const events = await fetchCloudAnalyticsEvents(400);
        setCloudAnalyticsEvents(events);
        setInsightsSummary(computeAnalyticsSummaryFromEvents(events));
        if (notify) toastInfo('Cloud visitor insights refreshed.', 'Insights Updated');
        return;
      } catch {
        // Fallback to local summary if offline or restricted
      }
    }
    setCloudAnalyticsEvents(null);
    setInsightsSummary(getAnalyticsSummary());
    if (notify) toastInfo('Visitor insights refreshed.', 'Insights Updated');
  };

  useEffect(() => {
    if (!isOpen || !isFirebaseAdmin || activeCloudRole !== 'admin') return;
    const unsubscribe = subscribeCloudAnalyticsEvents(
      (events) => {
        setCloudAnalyticsEvents(events);
        setInsightsSummary(computeAnalyticsSummaryFromEvents(events));
      },
      400
    );
    return () => unsubscribe();
  }, [isOpen, isFirebaseAdmin, activeCloudRole]);

  useEffect(() => {
    if (isOpen && isAuthenticated) {
      runBackendDiagnostics().catch(() => {});
    }
  }, [isOpen, isAuthenticated, runBackendDiagnostics]);

  // Collection Ordering State
  const categoriesList = buildMergedCategoriesList(collectionsMeta, siteMedia, products);
  const [orderSubTab, setOrderSubTab] = useState<'collections' | 'home' | 'guide'>('collections');
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [orderSaveStatus, setOrderSaveStatus] = useState<string | null>(null);
  const [copiedOrderSuccess, setCopiedOrderSuccess] = useState(false);

  const [editableCollections, setEditableCollections] = useState<CategoryMeta[]>(() =>
    buildMergedCategoriesList(collectionsMeta, siteMedia, products)
  );

  useEffect(() => {
    setEditableCollections(buildMergedCategoriesList(collectionsMeta, siteMedia, products));
  }, [collectionsMeta, siteMedia, products]);

  // Collection SEO State
  const [selectedSeoCatId, setSelectedSeoCatId] = useState<string>(() => categoriesList[0]?.id || 'one-piece');
  const selectedCategoryMeta = categoriesList.find((c) => c.id === selectedSeoCatId) || categoriesList[0];
  const [seoTitleInput, setSeoTitleInput] = useState('');
  const [seoDescInput, setSeoDescInput] = useState('');
  const [seoKeywordsInput, setSeoKeywordsInput] = useState('');
  const [seoSaveStatus, setSeoSaveStatus] = useState<string | null>(null);
  const [copiedShareLink, setCopiedShareLink] = useState(false);

  useEffect(() => {
    if (!selectedCategoryMeta) return;
    const catId = selectedCategoryMeta.id;
    const stored = collectionSeoMap[catId];
    const rec = generateRecommendedSeo(selectedCategoryMeta);

    setSeoTitleInput(stored?.title ?? selectedCategoryMeta.seoTitle ?? rec.title);
    setSeoDescInput(stored?.description ?? selectedCategoryMeta.seoDescription ?? rec.description);
    setSeoKeywordsInput(stored?.keywords ?? selectedCategoryMeta.seoKeywords ?? rec.keywords);
    setSeoSaveStatus(null);
  }, [selectedSeoCatId, selectedCategoryMeta, collectionSeoMap]);

  // Ensure activeSection stays permitted when role switches
  useEffect(() => {
    if (!canAccessSection(effectiveRole, activeSection)) {
      setActiveSection(getDefaultSectionForRole(effectiveRole));
    }
  }, [effectiveRole, activeSection]);

  const productionActiveCount = useMemo(
    () => buildProductionManufactureTargets(productionQueue, dealerOrders).length,
    [productionQueue, dealerOrders]
  );

  const pendingDealerKycCount = useMemo(
    () => dealerApplications.filter((a) => a.status === 'pending').length,
    [dealerApplications]
  );

  // Admin Live Notifications State (Orders, Order Edits, Inquiries, Quotes, Dealer KYC)
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => getNotificationSoundEnabled());
  const [desktopEnabled, setDesktopEnabled] = useState<boolean>(() => getDesktopAlertsEnabled());
  const [desktopPermission, setDesktopPermission] = useState<NotificationPermission | 'unsupported'>(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
    return window.Notification.permission;
  });
  const [readNotificationIds, setReadNotificationIds] = useState<Set<string>>(() => getReadNotificationIds());

  const seenOrderIdsRef = useRef<Set<string>>(new Set());
  const seenOrderEditsRef = useRef<Map<string, number>>(new Map());
  const ordersWatcherReadyRef = useRef(false);

  const seenInquiryIdsRef = useRef<Set<string>>(new Set());
  const inquiriesWatcherReadyRef = useRef(false);

  const seenAppIdsRef = useRef<Set<string>>(new Set());
  const appsWatcherReadyRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated) {
      ordersWatcherReadyRef.current = false;
      inquiriesWatcherReadyRef.current = false;
      appsWatcherReadyRef.current = false;
      seenOrderIdsRef.current = new Set();
      seenOrderEditsRef.current = new Map();
      seenInquiryIdsRef.current = new Set();
      seenAppIdsRef.current = new Set();
    }
  }, [isAuthenticated]);

  // Detect live incoming Dealer Orders & Order Edits
  useEffect(() => {
    if (!isAuthenticated || !canAccessSection(effectiveRole, 'dealer-orders')) return;

    if (!ordersWatcherReadyRef.current) {
      dealerOrders.forEach((o) => {
        seenOrderIdsRef.current.add(o.id);
        seenOrderEditsRef.current.set(o.id, o.editCount || 0);
      });
      ordersWatcherReadyRef.current = true;
      return;
    }

    const newOrders: SavedDealerOrder[] = [];
    const editedOrders: SavedDealerOrder[] = [];

    dealerOrders.forEach((o) => {
      if (!seenOrderIdsRef.current.has(o.id)) {
        seenOrderIdsRef.current.add(o.id);
        seenOrderEditsRef.current.set(o.id, o.editCount || 0);
        newOrders.push(o);
      } else {
        const prevEdits = seenOrderEditsRef.current.get(o.id) || 0;
        const currEdits = o.editCount || 0;
        if (currEdits > prevEdits) {
          seenOrderEditsRef.current.set(o.id, currEdits);
          editedOrders.push(o);
          const nextRead = unmarkNotificationIdRead(`order-${o.id}-v${prevEdits}`);
          setReadNotificationIds(unmarkNotificationIdRead(`order-${o.id}-v${currEdits}`));
          void nextRead;
        }
      }
    });

    if (newOrders.length > 0 && newOrders.length <= 5) {
      playAdminAlertChime('order');
      if (newOrders.length === 1) {
        const ord = newOrders[0];
        const firm = ord.dealerInfo?.firmName || ord.personName || 'Verified Dealer';
        toastInfo(
          `New Dealer Order ${ord.orderId || ord.id} from ${firm} (${ord.totalQuantity} Units).`,
          'New Order Received'
        );
        showDesktopAdminNotification(
          `New Dealer Order · ${ord.orderId || ord.id}`,
          `${firm} ordered ${ord.totalQuantity} units`,
          `order-${ord.id}`,
          () => setActiveSection('dealer-orders')
        );
      } else {
        toastInfo(`${newOrders.length} new dealer orders synced.`, 'New Orders Received');
      }
    } else if (editedOrders.length > 0 && editedOrders.length <= 5) {
      playAdminAlertChime('order');
      const ord = editedOrders[0];
      const firm = ord.dealerInfo?.firmName || ord.personName || 'Verified Dealer';
      toastWarning(
        editedOrders.length === 1
          ? `Order ${ord.orderId || ord.id} edited by ${firm} (${ord.totalQuantity} Units).`
          : `${editedOrders.length} dealer orders were edited.`,
        'Dealer Order Edited'
      );
      showDesktopAdminNotification(
        `Order Edited · ${ord.orderId || ord.id}`,
        `${firm} updated order to ${ord.totalQuantity} units`,
        `order-edit-${ord.id}-${ord.editCount || 1}`,
        () => setActiveSection('dealer-orders')
      );
    }
  }, [isAuthenticated, effectiveRole, dealerOrders, toastInfo, toastWarning]);

  // Detect live incoming Wholesale Inquiries & Quote Modal submissions
  useEffect(() => {
    if (!isAuthenticated || !canAccessSection(effectiveRole, 'inquiries')) return;

    if (!inquiriesWatcherReadyRef.current) {
      inquiries.forEach((inq) => seenInquiryIdsRef.current.add(inq.id));
      inquiriesWatcherReadyRef.current = true;
      return;
    }

    const added = inquiries.filter((inq) => !seenInquiryIdsRef.current.has(inq.id));
    added.forEach((inq) => seenInquiryIdsRef.current.add(inq.id));

    if (added.length > 0 && added.length <= 5) {
      playAdminAlertChime('inquiry');
      const first = added[0];
      const isQuote = (first.source || '').toLowerCase().includes('quote');
      toastInfo(
        added.length === 1
          ? `New ${isQuote ? 'Quote Request' : 'Wholesale Inquiry'} from ${first.businessName} (${first.cityState || 'India'}).`
          : `${added.length} new wholesale inquiries received.`,
        isQuote ? 'New Quote Request' : 'New Inquiry Received'
      );
      showDesktopAdminNotification(
        isQuote ? 'New Quote Request' : 'New Wholesale Inquiry',
        `${first.businessName} · ${first.productInterest || 'Catalog Inquiry'}`,
        `inq-${first.id}`,
        () => setActiveSection('inquiries')
      );
    }
  }, [isAuthenticated, effectiveRole, inquiries, toastInfo]);

  // Detect live incoming Dealer KYC Applications
  useEffect(() => {
    if (!isAuthenticated || !canAccessSection(effectiveRole, 'dealers')) return;

    if (!appsWatcherReadyRef.current) {
      dealerApplications.forEach((app) => seenAppIdsRef.current.add(app.id));
      appsWatcherReadyRef.current = true;
      return;
    }

    const added = dealerApplications.filter((app) => !seenAppIdsRef.current.has(app.id));
    added.forEach((app) => seenAppIdsRef.current.add(app.id));

    if (added.length > 0 && added.length <= 5) {
      playAdminAlertChime('kyc');
      const first = added[0];
      toastInfo(
        added.length === 1
          ? `New Dealer KYC application from ${first.firmName} (${first.cityState || 'India'}).`
          : `${added.length} new dealer KYC applications received.`,
        'New Dealer KYC'
      );
      showDesktopAdminNotification(
        'New Dealer KYC Application',
        `${first.firmName} · GST: ${first.gstNumber}`,
        `kyc-${first.id}`,
        () => setActiveSection('dealers')
      );
    }
  }, [isAuthenticated, effectiveRole, dealerApplications, toastInfo]);

  const adminNotifications: AdminNotificationItem[] = useMemo(() => {
    const items: AdminNotificationItem[] = [];

    if (canAccessSection(effectiveRole, 'dealer-orders')) {
      dealerOrders
        .filter((ord) => ord.verificationStatus === 'pending' || (ord.editCount || 0) > 0)
        .slice(0, 15)
        .forEach((ord) => {
          const isEdited = (ord.editCount || 0) > 0;
          const notifId = `order-${ord.id}-v${ord.editCount || 0}`;
          const firm = ord.dealerInfo?.firmName || ord.personName || 'Verified Dealer';
          items.push({
            id: notifId,
            category: isEdited ? 'order-edit' : 'order',
            title: `${ord.orderId || ord.id} · ${firm}`,
            subtitle: hideDealerContact
              ? `${ord.totalQuantity} Units · ${ord.totalWeightKg.toFixed(1)} kg${isEdited ? ` · Edit #${ord.editCount}` : ''}`
              : `${ord.totalQuantity} Units · ${ord.dealerInfo?.cityState || 'India'}${isEdited ? ` · Edit #${ord.editCount}` : ''}`,
            timestamp: ord.lastEditedAt || ord.timestamp || '',
            targetSection: 'dealer-orders',
            searchHint: ord.orderId || ord.id,
            read: readNotificationIds.has(notifId)
          });
        });
    }

    if (canAccessSection(effectiveRole, 'inquiries')) {
      inquiries
        .filter((inq) => inq.status === 'new')
        .slice(0, 15)
        .forEach((inq) => {
          const isQuote = (inq.source || '').toLowerCase().includes('quote');
          const notifId = `inq-${inq.id}`;
          items.push({
            id: notifId,
            category: isQuote ? 'quote' : 'inquiry',
            title: `${inq.businessName} · ${inq.contactPerson}`,
            subtitle: `${inq.productInterest || 'Wholesale Inquiry'}${inq.cityState ? ` · ${inq.cityState}` : ''}`,
            timestamp: inq.timestamp || '',
            targetSection: 'inquiries',
            searchHint: inq.businessName,
            read: readNotificationIds.has(notifId)
          });
        });
    }

    if (canAccessSection(effectiveRole, 'dealers')) {
      dealerApplications
        .filter((app) => app.status === 'pending')
        .slice(0, 15)
        .forEach((app) => {
          const notifId = `kyc-${app.id}`;
          items.push({
            id: notifId,
            category: 'kyc',
            title: `${app.firmName} · ${app.contactPerson}`,
            subtitle: `GST: ${app.gstNumber}${app.cityState ? ` · ${app.cityState}` : ''}`,
            timestamp: app.createdAt || '',
            targetSection: 'dealers',
            read: readNotificationIds.has(notifId)
          });
        });
    }

    return items.slice(0, 30);
  }, [effectiveRole, dealerOrders, inquiries, dealerApplications, readNotificationIds, hideDealerContact]);

  const unreadNotificationsCount = useMemo(
    () => adminNotifications.filter((n) => !n.read).length,
    [adminNotifications]
  );

  const handleToggleNotificationSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    setNotificationSoundEnabled(next);
    if (next) {
      playAdminAlertChime('inquiry');
      toastInfo('Admin alert sound chime enabled.', 'Sound On');
    } else {
      toastInfo('Admin alert sound muted.', 'Sound Muted');
    }
  };

  const handleEnableDesktopAlerts = async () => {
    const perm = await requestDesktopAlertPermission();
    setDesktopPermission(perm);
    if (perm === 'granted') {
      setDesktopEnabled(true);
      toastSuccess('Browser desktop alerts enabled for incoming orders and inquiries.', 'Desktop Alerts On');
    } else if (perm === 'denied') {
      toastWarning('Desktop alerts are blocked by your browser site settings.', 'Permission Blocked');
    }
  };

  const handleSelectNotificationItem = (item: AdminNotificationItem) => {
    setReadNotificationIds(markNotificationIdsRead([item.id]));
    if (item.targetSection === 'dealer-orders' && item.searchHint) {
      setOrderSearchFilter(item.searchHint);
    } else if (item.targetSection === 'inquiries' && item.searchHint) {
      setSearchFilter(item.searchHint);
    }
    if (canAccessSection(effectiveRole, item.targetSection)) {
      setActiveSection(item.targetSection);
      setIsMobileSidebarOpen(false);
    }
  };

  const handleMarkAllNotificationsRead = () => {
    const allIds = adminNotifications.map((n) => n.id);
    if (allIds.length === 0) return;
    setReadNotificationIds(markNotificationIdsRead(allIds));
  };

  // Navigation Definition
  const navItems: AdminNavItem[] = useMemo(
    () => [
      {
        id: 'dashboard',
        label: 'Dashboard',
        group: 'Overview',
        description: 'Operating Dashboard'
      },
      {
        id: 'dealer-order-dashboard',
        label: 'Dealer Order Dashboard',
        group: 'Overview',
        description: 'Ordered Volume & Popular Models by Category'
      },
      {
        id: 'dealers',
        label: 'Dealers & KYC',
        group: 'Sales & Orders',
        description: 'Dealer KYC Verification & Accounts',
        count: pendingDealerKycCount > 0 ? pendingDealerKycCount : undefined
      },
      {
        id: 'dealer-orders',
        label: 'Dealer Orders',
        group: 'Sales & Orders',
        description: 'Wholesale Orders & Verification',
        count: dealerOrders.length
      },
      {
        id: 'production',
        label: 'Production Tracker',
        group: 'Sales & Orders',
        description: 'Daily Output & Order Backlog',
        count: productionActiveCount
      },
      {
        id: 'inquiries',
        label: 'Inquiries & Leads',
        group: 'Sales & Orders',
        description: 'B2B Inquiries & Webhooks',
        count: inquiries.length
      },
      {
        id: 'product-config',
        label: 'Modes & Weights',
        group: 'Catalog Setup',
        description: 'Product Classification & Weights'
      },
      {
        id: 'colors-codes',
        label: 'Colors & Codes',
        group: 'Catalog Setup',
        description: 'Factory Glazes & Design Codes'
      },
      {
        id: 'collection-order',
        label: 'Collection Ordering',
        group: 'Catalog Setup',
        description: 'Sequence & Home Showcase'
      },
      {
        id: 'insights',
        label: 'Visitor Insights',
        group: 'Digital & Insights',
        description: 'Private Analytics & Dwell Matrix'
      },
      {
        id: 'seo',
        label: 'SEO & Social Cards',
        group: 'Digital & Insights',
        description: 'Search Snippets & WhatsApp Previews'
      },
      {
        id: 'blog',
        label: 'Blog & Guides',
        group: 'Digital & Insights',
        description: 'SEO Articles & Technical Guides',
        count: blogPosts.length
      },
      {
        id: 'cms',
        label: 'Google Sheets Sync',
        group: 'System & Plant',
        description: 'Live Catalog & CMS Sync'
      },
      {
        id: 'location',
        label: 'Factory Pin & Map',
        group: 'System & Plant',
        description: 'Plant Address & Coordinates'
      },
      {
        id: 'security',
        label: 'Admin Security',
        group: 'System & Plant',
        description: 'Team Google Access & Roles'
      }
    ],
    [dealerOrders.length, productionActiveCount, inquiries.length, pendingDealerKycCount, blogPosts.length]
  );

  const visibleNavItems = useMemo(
    () => navItems.filter((item) => canAccessSection(effectiveRole, item.id)),
    [navItems, effectiveRole]
  );

  // Global Quick Jump Search Results
  const globalSearchResults = useMemo(() => {
    const q = globalSearch.trim().toLowerCase();
    if (!q) return [];

    const matches: Array<{
      id: string;
      title: string;
      subtitle: string;
      section: AdminSectionId;
      applyFilter?: () => void;
    }> = [];

    if (canAccessSection(effectiveRole, 'dealer-orders')) {
      dealerOrders.forEach((ord) => {
        const firm = (ord.dealerInfo?.firmName || '').trim();
        const person = ord.personName || ord.dealerInfo?.contactPerson || firm || '';
        const displayTitle = firm && person && firm !== person ? `${firm} (${person})` : firm || person;
        if (
          person.toLowerCase().includes(q) ||
          firm.toLowerCase().includes(q) ||
          (ord.orderId || ord.id).toLowerCase().includes(q) ||
          (!hideDealerContact && (ord.dealerInfo?.cityState || '').toLowerCase().includes(q))
        ) {
          matches.push({
            id: `ord-${ord.id}`,
            title: displayTitle || ord.orderId || ord.id,
            subtitle: hideDealerContact
              ? `Dealer Order · ${ord.totalQuantity} Units`
              : `Dealer Order · ${ord.totalQuantity} Units · ${ord.dealerInfo?.cityState || 'India'}`,
            section: 'dealer-orders',
            applyFilter: () => setOrderSearchFilter(globalSearch.trim())
          });
        }
      });
    }

    if (canAccessSection(effectiveRole, 'inquiries')) {
      inquiries.forEach((inq) => {
        if (
          inq.businessName.toLowerCase().includes(q) ||
          inq.contactPerson.toLowerCase().includes(q) ||
          inq.productInterest.toLowerCase().includes(q)
        ) {
          matches.push({
            id: `inq-${inq.id}`,
            title: inq.businessName,
            subtitle: `Inquiry · ${inq.contactPerson} · ${inq.productInterest}`,
            section: 'inquiries',
            applyFilter: () => setSearchFilter(globalSearch.trim())
          });
        }
      });
    }

    if (canAccessSection(effectiveRole, 'dealers')) {
      dealerApplications.forEach((app) => {
        if (
          app.firmName.toLowerCase().includes(q) ||
          app.contactPerson.toLowerCase().includes(q) ||
          app.gstNumber.toLowerCase().includes(q) ||
          app.id.toLowerCase().includes(q)
        ) {
          matches.push({
            id: `dapp-${app.id}`,
            title: app.firmName,
            subtitle: `Dealer KYC (${app.status.toUpperCase()}) · ${app.contactPerson} · ${app.cityState}`,
            section: 'dealers'
          });
        }
      });

      dealerAccounts.forEach((acc) => {
        if (
          acc.firmName.toLowerCase().includes(q) ||
          acc.userId.toLowerCase().includes(q) ||
          acc.gstNumber.toLowerCase().includes(q)
        ) {
          matches.push({
            id: `dacc-${acc.id}`,
            title: `${acc.firmName} (${acc.userId})`,
            subtitle: `Dealer Account · ${acc.active ? 'Active' : 'Disabled'} · ${acc.cityState}`,
            section: 'dealers'
          });
        }
      });
    }

    if (canAccessSection(effectiveRole, 'blog')) {
      blogPosts.forEach((post) => {
        if (post.title.toLowerCase().includes(q) || post.slug.toLowerCase().includes(q)) {
          matches.push({
            id: `blog-${post.id}`,
            title: post.title,
            subtitle: `Blog Guide (${post.status.toUpperCase()}) · /blog/${post.slug}`,
            section: 'blog'
          });
        }
      });
    }

    visibleNavItems.forEach((item) => {
      if (item.label.toLowerCase().includes(q) || item.description.toLowerCase().includes(q)) {
        matches.push({
          id: `nav-${item.id}`,
          title: item.label,
          subtitle: `Admin Module · ${item.group}`,
          section: item.id
        });
      }
    });

    return matches.slice(0, 8);
  }, [globalSearch, dealerOrders, inquiries, dealerApplications, dealerAccounts, blogPosts, visibleNavItems, effectiveRole]);

  if (!isOpen) return null;

  const handleLock = () => {
    logoutAdminSession();
    toastInfo('Signed out of Admin workspace.', 'Session Locked');
  };

  // Staff Accounts RBAC Handlers
  const handleAddStaffAccount = (account: Omit<AdminStaffAccount, 'id' | 'createdAt' | 'active'>) => {
    if (!hasPermission(effectiveRole, 'system:security')) return;
    const created = addStaffAccount(account);
    toastSuccess(`Added staff account "${created.displayName}" (${ROLE_DEFINITIONS[created.role].shortLabel}).`, 'Staff Added');
  };

  const handleUpdateStaffRole = (id: string, role: AdminRole) => {
    if (!hasPermission(effectiveRole, 'system:security')) return;
    const normalized = normalizeAdminRole(role);
    updateStaffRole(id, normalized);
    toastInfo(`Updated staff role to ${ROLE_DEFINITIONS[normalized].label}.`, 'Role Updated');
  };

  const handleUpdateStaffAccount = (id: string, updates: Partial<AdminStaffAccount>) => {
    if (!hasPermission(effectiveRole, 'system:security')) return;
    updateStaffAccount(id, updates);
    setStatusMessage({ text: 'Staff account details updated.', type: 'success' });
    toastSuccess('Staff account details updated.', 'Staff Updated');
  };

  const handleToggleStaffActive = (id: string) => {
    if (!hasPermission(effectiveRole, 'system:security')) return;
    const target = staffAccounts.find((acc) => acc.id === id);
    toggleStaffActive(id);
    toastInfo(
      target ? `${target.displayName} ${!target.active ? 'enabled' : 'disabled'}.` : 'Staff login access updated.',
      'Access Updated'
    );
  };

  const handleDeleteStaffAccount = (id: string) => {
    if (!hasPermission(effectiveRole, 'system:security')) return;
    deleteStaffAccount(id);
    toastInfo('Staff account removed.', 'Staff Removed');
  };

  const handleUpdateCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasPermission(effectiveRole, 'system:security')) return;
    if (!customUserIdInput.trim() || !customPasswordInput.trim()) {
      toastError('Enter both Master Owner User ID and New Password.', 'Missing Credentials');
      return;
    }
    try {
      await updateMasterOwnerCredentials(customUserIdInput.trim(), customPasswordInput.trim());
      setCredentialChangeStatus('Master Admin User ID and Password updated successfully.');
      setCustomPasswordInput('');
      setTimeout(() => setCredentialChangeStatus(null), 4000);
      toastSuccess('Master Owner User ID and Password updated.', 'Credentials Saved');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to save Master Owner credentials to cloud.';
      toastError(msg, 'Save Error');
    }
  };

  // Location Handlers
  const handleSaveLocation = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedEmbed = cleanGoogleMapsEmbedUrl(locEmbedUrl) || DEFAULT_COMPANY_INFO.google_maps_embed_url;
    const finalMapsUrl = locMapsUrl.trim() || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locAddress.trim())}`;
    updateCompanyInfo({
      factory_address: locAddress.trim(),
      google_maps_embed_url: cleanedEmbed,
      google_maps_url: finalMapsUrl,
      primary_phone: locPhone1.trim(),
      secondary_phone: locPhone2.trim()
    });
    setLocSaveStatus('Factory location & contacts updated live.');
    setTimeout(() => setLocSaveStatus(null), 4000);
    toastSuccess('Factory address, map pin, and contacts updated live.', 'Plant Details Saved');
  };

  const handleRestoreAccurateLocation = () => {
    resetCompanyInfo();
    setLocAddress(DEFAULT_COMPANY_INFO.factory_address);
    setLocEmbedUrl(DEFAULT_COMPANY_INFO.google_maps_embed_url);
    setLocMapsUrl(DEFAULT_COMPANY_INFO.google_maps_url);
    setLocPhone1(DEFAULT_COMPANY_INFO.primary_phone);
    setLocPhone2(DEFAULT_COMPANY_INFO.secondary_phone);
    setLocSaveStatus('Restored verified Thangadh factory location.');
    setTimeout(() => setLocSaveStatus(null), 4000);
    toastInfo('Restored verified Thangadh factory pin & contacts.', 'Location Restored');
  };

  // Insights Handlers
  const handleDetectGPS = async () => {
    setIsDetectingGps(true);
    setGpsStatusMessage(null);
    try {
      const geo = await requestPreciseLocation(true);
      if (geo && (geo.city || geo.district)) {
        setGpsStatusMessage({
          text: `Precise location verified: ${formatLocationString(geo)}`,
          type: 'success'
        });
        setInsightsSummary(getAnalyticsSummary());
        toastSuccess(`GPS verified: ${formatLocationString(geo)}`, 'GPS Calibrated');
      } else {
        setGpsStatusMessage({
          text: 'Browser location permission not granted. Network gateway IP active.',
          type: 'info'
        });
        toastInfo('Browser GPS declined. Network IP resolution active.', 'Location Fallback');
      }
    } catch {
      setGpsStatusMessage({
        text: 'Could not retrieve browser GPS coordinates.',
        type: 'error'
      });
      toastError('Could not retrieve browser GPS coordinates.', 'GPS Error');
    } finally {
      setIsDetectingGps(false);
      setTimeout(() => setGpsStatusMessage(null), 7000);
    }
  };

  const handleSaveGA4 = (e: React.FormEvent) => {
    e.preventDefault();
    saveGa4MeasurementId(ga4IdInput.trim());
    setGa4SaveStatus('Google Analytics 4 Measurement ID saved.');
    setTimeout(() => setGa4SaveStatus(null), 4000);
    toastSuccess(ga4IdInput.trim() ? 'GA4 Measurement ID saved.' : 'GA4 Measurement ID cleared.', 'Analytics Updated');
  };

  const handleClearInsights = () => {
    setPendingConfirm({
      title: 'Reset Visitor Analytics?',
      message: 'Are you sure you want to reset your private visitor analytics data?',
      confirmLabel: 'Reset Analytics',
      tone: 'danger',
      onConfirm: async () => {
        clearAnalyticsData();
        if (isFirebaseAdmin && activeCloudRole === 'admin') {
          try {
            await clearCloudAnalyticsEvents();
          } catch {
            // Keep UI responsive
          }
        }
        setCloudAnalyticsEvents(null);
        setInsightsSummary(getAnalyticsSummary());
        toastInfo('Private visitor analytics cleared.', 'Analytics Reset');
      }
    });
  };

  const handleCopyInsights = async () => {
    const success = await copyAnalyticsForSheets(cloudAnalyticsEvents || undefined);
    if (success) {
      setCopiedInsightsSuccess(true);
      setTimeout(() => setCopiedInsightsSuccess(false), 3000);
      toastSuccess('Visitor analytics copied to clipboard for Sheets.', 'Copied');
    } else {
      toastError('Could not copy analytics to clipboard.', 'Copy Failed');
    }
  };

  // Collection Ordering Handlers
  const applyCollectionsOrder = (list: CategoryMeta[], customMessage?: string) => {
    const newMeta: Record<string, Partial<CategoryMeta>> = { ...collectionsMeta };
    list.forEach((item, idx) => {
      newMeta[item.id] = {
        ...(newMeta[item.id] || {}),
        id: item.id,
        title: item.title,
        shortLabel: item.shortLabel,
        subtitle: item.subtitle,
        tagBadge: item.tagBadge,
        coverImage: item.coverImage,
        order: item.order ?? idx + 1,
        ...(item.homeOrder !== undefined ? { homeOrder: item.homeOrder } : {}),
        ...(item.showOnHome !== undefined ? { showOnHome: item.showOnHome } : {})
      };
    });
    updateCollectionsMeta(newMeta);
    const msg = customMessage || 'Collection order updated live.';
    setOrderSaveStatus(msg);
    setTimeout(() => setOrderSaveStatus(null), 4000);
    toastSuccess(msg, 'Catalog Order Saved');
  };

  const handleEditCollection = (updatedCat: CategoryMeta) => {
    const nextList = editableCollections.map((c) => (c.id === updatedCat.id ? updatedCat : c));
    setEditableCollections(nextList);
    applyCollectionsOrder(nextList, `Updated collection "${updatedCat.title}".`);
  };

  const handleMoveCollection = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= editableCollections.length) return;
    const updated = [...editableCollections];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, moved);
    const resequenced = updated.map((item, idx) => ({ ...item, order: idx + 1 }));
    setEditableCollections(resequenced);
    applyCollectionsOrder(resequenced, `Moved "${moved.title}" to position #${targetIndex + 1}.`);
  };

  const handleOrderInputChange = (id: string, newOrderVal: number) => {
    if (isNaN(newOrderVal) || newOrderVal < 1) return;
    const updated = editableCollections.map((c) => (c.id === id ? { ...c, order: newOrderVal } : c));
    updated.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
    setEditableCollections(updated);
    applyCollectionsOrder(updated, 'Updated collection order.');
  };

  const handleHomeToggle = (id: string) => {
    const updated = editableCollections.map((c) => (c.id === id ? { ...c, showOnHome: !c.showOnHome } : c));
    setEditableCollections(updated);
    applyCollectionsOrder(updated, 'Home showcase updated.');
  };

  const handleMoveHomeCollection = (homeIndex: number, direction: 'up' | 'down') => {
    const homeList = editableCollections
      .filter((c) => c.showOnHome === true)
      .sort((a, b) => (a.homeOrder ?? a.order ?? 999) - (b.homeOrder ?? b.order ?? 999));
    const targetIndex = direction === 'up' ? homeIndex - 1 : homeIndex + 1;
    if (targetIndex < 0 || targetIndex >= homeList.length) return;
    const [moved] = homeList.splice(homeIndex, 1);
    homeList.splice(targetIndex, 0, moved);
    const homeOrderMap = new Map<string, number>();
    homeList.forEach((item, idx) => homeOrderMap.set(item.id, idx + 1));
    const updated = editableCollections.map((c) => (homeOrderMap.has(c.id) ? { ...c, homeOrder: homeOrderMap.get(c.id) } : c));
    setEditableCollections(updated);
    applyCollectionsOrder(updated, `Moved "${moved.title}" to Home slot #${targetIndex + 1}.`);
  };

  const handleResetDefaultOrder = () => {
    setPendingConfirm({
      title: 'Reset Collection Order?',
      message: 'Reset all collection sequences to standard factory ordering?',
      confirmLabel: 'Reset Default',
      tone: 'warning',
      onConfirm: () => {
        resetCollectionsOrder();
        setOrderSaveStatus('Restored default factory collection order.');
        setTimeout(() => setOrderSaveStatus(null), 4000);
        toastInfo('Default factory collection sequence restored.', 'Order Reset');
      }
    });
  };

  const handleCopyOrderTSV = async () => {
    const headers = ['Category', 'Title', 'Order', 'Home', 'Home_Order'].join('\t');
    const rows = editableCollections.map((c, idx) =>
      [c.id, c.title, c.order ?? idx + 1, c.showOnHome ? 'TRUE' : 'FALSE', c.homeOrder ?? (idx < 8 ? idx + 1 : '')].join('\t')
    );
    try {
      await navigator.clipboard.writeText([headers, ...rows].join('\n'));
      setCopiedOrderSuccess(true);
      setTimeout(() => setCopiedOrderSuccess(false), 3000);
      toastSuccess('Collection sequence table copied for Google Sheets.', 'Copied');
    } catch (err) {
      console.error('Failed to copy', err);
      toastError('Clipboard copy failed.', 'Copy Error');
    }
  };

  // SEO Handlers
  const handleSaveSeo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCategoryMeta) return;
    updateCollectionSeo(selectedCategoryMeta.id, {
      title: seoTitleInput.trim(),
      description: seoDescInput.trim(),
      keywords: seoKeywordsInput.trim()
    });
    setSeoSaveStatus(`Saved SEO metadata for "${selectedCategoryMeta.title}".`);
    setTimeout(() => setSeoSaveStatus(null), 4000);
    toastSuccess(`Saved live SEO metadata for "${selectedCategoryMeta.title}".`, 'SEO Updated');
  };

  const handleApplyRecommendedSeo = () => {
    if (!selectedCategoryMeta) return;
    const rec = generateRecommendedSeo(selectedCategoryMeta);
    setSeoTitleInput(rec.title);
    setSeoDescInput(rec.description);
    setSeoKeywordsInput(rec.keywords);
    toastInfo(`Auto-filled B2B SEO template for "${selectedCategoryMeta.title}".`, 'SEO Template Applied');
  };

  const handleResetSeo = () => {
    if (!selectedCategoryMeta) return;
    resetCollectionSeo(selectedCategoryMeta.id);
    const rec = generateRecommendedSeo(selectedCategoryMeta);
    setSeoTitleInput(selectedCategoryMeta.seoTitle || rec.title);
    setSeoDescInput(selectedCategoryMeta.seoDescription || rec.description);
    setSeoKeywordsInput(selectedCategoryMeta.seoKeywords || rec.keywords);
    setSeoSaveStatus(`Reset "${selectedCategoryMeta.title}" to default metadata.`);
    setTimeout(() => setSeoSaveStatus(null), 4000);
    toastInfo(`Reset "${selectedCategoryMeta.title}" SEO to factory defaults.`, 'SEO Reset');
  };

  // CMS & Webhook Handlers
  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputUrl.trim()) {
      toastError('Paste a published Google Sheet URL or Sheet ID first.', 'Missing Sheet URL');
      return;
    }
    setStatusMessage(null);
    const result = await connectSheet(inputUrl.trim());
    if (result.success) {
      setStatusMessage({ text: result.message, type: 'success' });
      setInputUrl('');
      toastSuccess(result.message, 'Google Sheet Connected');
    } else {
      setStatusMessage({ text: result.message, type: 'error' });
      toastError(result.message, 'Connection Failed');
    }
  };

  const handleRefresh = async () => {
    setStatusMessage(null);
    const result = await refreshData();
    const text = result.message || 'Content refreshed successfully from your Google Sheet.';
    setStatusMessage({
      text,
      type: result.success ? 'success' : 'error'
    });
    if (result.success) {
      toastSuccess(text, 'Sync Complete');
    } else {
      toastError(text, 'Sync Failed');
    }
  };

  const handleDisconnect = () => {
    disconnectSheet();
    setStatusMessage({ text: 'Disconnected from Google Sheet. Restored default factory data.', type: 'success' });
    toastInfo('Disconnected Google Sheet. Factory catalog restored.', 'Sheet Disconnected');
  };

  const handleSaveWebhook = (e: React.FormEvent) => {
    e.preventDefault();
    updateWebhookUrl(webhookInput.trim());
    const text = webhookInput.trim()
      ? 'Google Sheet Webhook URL saved. Future form submissions will push automatically.'
      : 'Webhook URL removed.';
    setStatusMessage({
      text,
      type: 'success'
    });
    toastSuccess(webhookInput.trim() ? 'Google Sheet Webhook URL saved.' : 'Webhook URL removed.', 'Webhook Updated');
  };

  const handleCopyTable = async () => {
    const ok = await copyForSheets();
    if (ok) {
      setCopiedSuccess(true);
      setTimeout(() => setCopiedSuccess(false), 3000);
      toastSuccess('Inquiries copied to clipboard for Google Sheets.', 'Copied');
    } else {
      toastError('Clipboard copy failed.', 'Copy Error');
    }
  };

  const appsScriptCode = `function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Inquiries") || SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var raw = JSON.parse(e.postData.contents);
    var data = (raw && raw.data && raw.data[0]) ? raw.data[0] : raw;
    sheet.appendRow([
      data.id || '',
      data.timestamp || new Date().toLocaleString(),
      data.source || 'Website Form',
      data.businessName || '',
      data.contactPerson || '',
      data.whatsappNumber || '',
      data.cityState || '',
      data.volume || '',
      data.productInterest || '',
      data.notes || ''
    ]);
    return ContentService.createTextOutput(JSON.stringify({result: "success"})).setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({result: "error", error: err.toString()})).setMimeType(ContentService.MimeType.JSON);
  }
}`;

  const sectionIcon = (id: AdminSectionId) => {
    switch (id) {
      case 'dashboard':
        return LayoutDashboard;
      case 'dealer-order-dashboard':
        return BarChart3;
      case 'dealers':
        return Users;
      case 'dealer-orders':
        return Package;
      case 'production':
        return Factory;
      case 'inquiries':
        return FileSpreadsheet;
      case 'product-config':
        return Scale;
      case 'colors-codes':
        return Palette;
      case 'collection-order':
        return ListOrdered;
      case 'insights':
        return TrendingUp;
      case 'seo':
        return Globe;
      case 'blog':
        return BookOpen;
      case 'cms':
        return Table;
      case 'location':
        return MapPin;
      case 'security':
        return ShieldCheck;
    }
  };

  const groups: Array<AdminNavItem['group']> = [
    'Overview',
    'Sales & Orders',
    'Catalog Setup',
    'Digital & Insights',
    'System & Plant'
  ];

  const activeNav = navItems.find((n) => n.id === activeSection) || navItems[0];

  const selectSection = (section: AdminSectionId) => {
    if (!canAccessSection(effectiveRole, section)) return;
    setActiveSection(section);
    setIsMobileSidebarOpen(false);
    setGlobalSearch('');
  };

  // WAIT FOR FIREBASE AUTH SESSION RESTORE BEFORE RENDERING LOGIN
  if (!isFirebaseAuthReady) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl shadow-xl p-6 text-center space-y-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
            <RefreshCw className="w-5 h-5 animate-spin" />
          </div>
          <div className="font-display font-bold text-base text-slate-900">
            Checking Cloud Sync Session...
          </div>
          <p className="text-xs text-slate-500">
            Verifying your authorized Google Admin workspace access.
          </p>
        </div>
      </div>
    );
  }

  // RENDER GOOGLE CLOUD SYNC LOGIN OVERLAY
  if (!isAuthenticated) {
    return (
      <AdminLoginOverlay
        onLoginWithSession={(session) => {
          setAdminSession(session);
          setActiveSection(getDefaultSectionForRole(session.role));
        }}
        onClose={onClose}
      />
    );
  }

  // RENDER FULL-VIEWPORT SAAS COMMAND CENTER
  return (
    <div className="fixed inset-0 z-50 bg-[#F8FAFC] text-slate-900 flex overflow-hidden">
      {/* Mobile Drawer Backdrop */}
      {isMobileSidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-xs lg:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* Left Sidebar Navigation */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-slate-200 flex flex-col transform transition-transform duration-200 ease-out lg:static lg:translate-x-0 ${
          isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 px-5 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-display font-bold text-sm shrink-0">
              H
            </div>
            <div className="min-w-0">
              <div className="font-display font-bold text-sm text-slate-900 truncate">
                Hightone Admin
              </div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Admin Suite
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsMobileSidebarOpen(false)}
            className="lg:hidden p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
            aria-label="Close Sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Active Role Identity Strip */}
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/70 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-900 truncate">
                {adminSession?.displayName || ROLE_DEFINITIONS[effectiveRole]?.label}
              </div>
              <div className="text-[11px] font-semibold text-blue-700 truncate">
                {ROLE_DEFINITIONS[effectiveRole]?.label}
              </div>
            </div>
            <UserCheck className="w-4 h-4 text-blue-600 shrink-0" />
          </div>
        </div>

        {/* Navigation Groups */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {groups.map((groupName) => {
            const items = visibleNavItems.filter((item) => item.group === groupName);
            if (items.length === 0) return null;
            return (
              <div key={groupName} className="space-y-1">
                <div className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  {groupName}
                </div>
                {items.map((item) => {
                  const Icon = sectionIcon(item.id);
                  const isActive = activeSection === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => selectSection(item.id)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                        isActive
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      <span className="flex items-center space-x-2.5 min-w-0">
                        <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                        <span className="truncate">{item.label}</span>
                      </span>
                      {typeof item.count === 'number' && (
                        <span
                          className={`text-[11px] font-mono tabular-nums px-1.5 py-0.5 rounded ${
                            isActive ? 'bg-blue-700 text-white' : 'text-slate-400'
                          }`}
                        >
                          {item.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* Sidebar Footer Controls */}
        <div className="p-3 border-t border-slate-100 space-y-1.5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-slate-400" />
            <span>Back to Website</span>
          </button>
          <button
            type="button"
            onClick={handleLock}
            className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-slate-600 hover:bg-rose-50 hover:text-rose-700 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4 text-slate-400" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Utility Header */}
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4 shrink-0">
          {/* Left: Hamburger & Context */}
          <div className="flex items-center space-x-3 min-w-0">
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(true)}
              className="lg:hidden p-2 -ml-1 text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              aria-label="Open Navigation Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 hidden sm:block">
                Workspace
              </div>
              <div className="font-display font-bold text-sm text-slate-900 truncate">
                {activeNav.description}
              </div>
            </div>
          </div>

          {/* Center: Workspace Quick Search */}
          <div className="relative flex-1 max-w-md hidden md:block">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              placeholder="Search orders, inquiries, or admin modules..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500"
            />

            {globalSearch.trim() && (
              <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden">
                {globalSearchResults.length === 0 ? (
                  <div className="p-3 text-xs text-slate-500 text-center">
                    No matching orders, inquiries, or modules.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                    {globalSearchResults.map((res) => (
                      <button
                        key={res.id}
                        type="button"
                        onClick={() => {
                          res.applyFilter?.();
                          selectSection(res.section);
                        }}
                        className="w-full text-left px-3.5 py-2.5 hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        <div className="font-semibold text-xs text-slate-900 truncate">{res.title}</div>
                        <div className="text-[11px] text-slate-500 truncate">{res.subtitle}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right: Backend Sync State, Active Role & Action Controls */}
          <div className="flex items-center space-x-2 shrink-0">
            <button
              type="button"
              onClick={() => handleVerifyBackendConnection()}
              disabled={isVerifyingBackend || isConnectingCloudSync}
              className={`hidden sm:inline-flex items-center space-x-1.5 px-2.5 py-2 border rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60 ${
                backendSyncStatus === 'connected'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
                  : backendSyncStatus === 'connecting'
                  ? 'bg-sky-50 border-sky-200 text-sky-800'
                  : backendSyncStatus === 'error'
                  ? 'bg-rose-50 border-rose-200 text-rose-800 hover:bg-rose-100'
                  : backendSyncStatus === 'offline'
                  ? 'bg-amber-50 border-amber-200 text-amber-800'
                  : 'bg-sky-50 border-sky-200 text-sky-800'
              }`}
              title={
                backendDiagnostic?.summary ||
                'Live Multi-Admin Cloud Sync — click to verify Firestore connection'
              }
            >
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  backendSyncStatus === 'connected'
                    ? 'bg-emerald-500'
                    : backendSyncStatus === 'error'
                    ? 'bg-rose-500'
                    : backendSyncStatus === 'offline'
                    ? 'bg-amber-500'
                    : 'bg-sky-500 animate-pulse'
                }`}
              />
              <span>
                {isVerifyingBackend
                  ? 'Verifying...'
                  : backendSyncStatus === 'connected'
                  ? 'Cloud Synced'
                  : backendSyncStatus === 'error'
                  ? 'Sync Error'
                  : backendSyncStatus === 'offline'
                  ? 'Offline'
                  : 'Syncing...'}
              </span>
            </button>

            <AdminNotificationsMenu
              notifications={adminNotifications}
              unreadCount={unreadNotificationsCount}
              soundEnabled={soundEnabled}
              desktopEnabled={desktopEnabled}
              desktopPermission={desktopPermission}
              canConfigureAlerts={canAccessSection(effectiveRole, 'security')}
              onToggleSound={handleToggleNotificationSound}
              onEnableDesktopAlerts={handleEnableDesktopAlerts}
              onSelectNotification={handleSelectNotificationItem}
              onMarkAllRead={handleMarkAllNotificationsRead}
              onOpenAlertSettings={(section) => selectSection(section)}
            />

            <div className="hidden sm:flex items-center space-x-1.5 px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700">
              <UserCheck className="w-3.5 h-3.5 text-blue-600" />
              <span>{ROLE_DEFINITIONS[effectiveRole]?.label}</span>
            </div>
            {sheetId && canAccessSection(effectiveRole, 'cms') && (
              <button
                type="button"
                onClick={handleRefresh}
                disabled={isSyncing}
                className="px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors flex items-center space-x-1.5 cursor-pointer whitespace-nowrap"
                title="Sync Google Sheet"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">{isSyncing ? 'Syncing' : 'Sync'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleLock}
              className="px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors flex items-center space-x-1.5 cursor-pointer whitespace-nowrap"
              title="Sign out of Google Admin Cloud Sync"
            >
              <Lock className="w-3.5 h-3.5 text-slate-500" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg transition-colors flex items-center space-x-1.5 cursor-pointer whitespace-nowrap"
            >
              <X className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Exit Admin</span>
            </button>
          </div>
        </header>

        {/* Scrollable Workspace Content */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto space-y-5">
            {/* Global Feedback Toast/Alert */}
            {statusMessage && (
              <div
                className={`p-3.5 rounded-xl flex items-center justify-between gap-3 text-xs font-medium border ${
                  statusMessage.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}
              >
                <div className="flex items-center space-x-2">
                  {statusMessage.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span>{statusMessage.text}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setStatusMessage(null)}
                  className="text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {backendSyncStatus === 'offline' && (
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    <strong>Offline Mode</strong> — Network connection unavailable. Firestore backend sync will resume automatically when online.
                  </span>
                </div>
                <button
                  type="button"
                  disabled={isVerifyingBackend}
                  onClick={handleVerifyBackendConnection}
                  className="px-3 py-1.5 bg-white border border-amber-300 hover:bg-amber-100 text-amber-950 rounded-lg text-xs font-semibold shrink-0 cursor-pointer"
                >
                  {isVerifyingBackend ? 'Checking...' : 'Re-check Backend'}
                </button>
              </div>
            )}


            {cloudSyncError && backendSyncStatus !== 'offline' && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{cloudSyncError}</span>
                </div>
                <button
                  type="button"
                  disabled={isVerifyingBackend}
                  onClick={handleVerifyBackendConnection}
                  className="px-3 py-1.5 bg-white border border-rose-300 hover:bg-rose-100 text-rose-900 rounded-lg text-xs font-semibold shrink-0 cursor-pointer"
                >
                  {isVerifyingBackend ? 'Checking...' : 'Re-check Backend'}
                </button>
              </div>
            )}

            {syncError && (
              <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>{syncError}</span>
              </div>
            )}

            {activeSection === 'dashboard' && (
              <AdminDashboardOverview
                activeRole={effectiveRole}
                dealerOrders={dealerOrders}
                dailyProductionLogs={dailyProductionLogs}
                inquiries={inquiries}
                products={products}
                collections={editableCollections}
                insightsSummary={insightsSummary}
                sheetId={sheetId}
                sheetWebhookUrl={sheetWebhookUrl}
                isSyncing={isSyncing}
                companyInfo={companyInfo}
                onNavigateSection={selectSection}
                onDownloadOrdersCSV={() => {
                  downloadDealerOrdersCSV({ hideDealerContact });
                  toastSuccess('Exported dealer orders CSV.', 'CSV Downloaded');
                }}
                onSyncSheet={handleRefresh}
              />
            )}

            {activeSection === 'dealer-order-dashboard' && (
              <AdminDealerOrderDashboard
                dealerOrders={dealerOrders}
                products={products}
                onNavigateSection={selectSection}
                onDownloadOrdersCSV={() => {
                  downloadDealerOrdersCSV({ hideDealerContact });
                  toastSuccess('Exported dealer orders CSV.', 'CSV Downloaded');
                }}
              />
            )}

            {activeSection === 'dealers' && hasPermission(effectiveRole, 'dealers:manage') && (
              <AdminDealersPanel
                dealerApplications={dealerApplications}
                dealerAccounts={dealerAccounts}
                dealerOrders={dealerOrders}
                adminDisplayName={`${adminSession?.displayName || 'Admin'} (${ROLE_DEFINITIONS[effectiveRole].shortLabel})`}
                isCloudSyncActive={isFirebaseAdmin}
                cloudSyncEmail={firebaseUser?.email || null}
                backendSyncStatus={backendSyncStatus}
                cloudSyncError={cloudSyncError}
                backendDatabaseId={backendDiagnostic?.activeDatabaseId || null}
                isVerifyingBackend={isVerifyingBackend}
                onVerifyBackend={handleVerifyBackendConnection}
                onConnectCloudSync={handleConnectCloudSync}
                onUpdateKyc={(appId, updates, verifiedBy) => {
                  updateDealerApplicationKyc(appId, updates, verifiedBy);
                }}
                onApproveApplication={(appId, credentials, reviewedBy) => {
                  const res = approveDealerApplication(appId, credentials, reviewedBy);
                  if (res.success) {
                    setStatusMessage({ text: res.message, type: 'success' });
                    toastSuccess(res.message, 'Dealer Approved');
                  } else {
                    toastError(res.message, 'Approval Failed');
                  }
                  return res;
                }}
                onRejectApplication={(appId, reason, reviewedBy) => {
                  rejectDealerApplication(appId, reason, reviewedBy);
                  setStatusMessage({ text: 'Dealer application rejected and reason recorded.', type: 'success' });
                  toastWarning('Dealer application rejected and reason recorded.', 'Application Rejected');
                }}
                onDeleteApplication={(appId) => {
                  deleteDealerApplication(appId);
                  setStatusMessage({ text: 'Dealer application removed.', type: 'success' });
                  toastInfo('Dealer application removed.', 'Deleted');
                }}
                onCreateManualAccount={(data) => {
                  const res = createManualDealerAccount(data);
                  if (res.success) {
                    setStatusMessage({ text: res.message, type: 'success' });
                    toastSuccess(res.message, 'Dealer Account Created');
                  } else {
                    toastError(res.message, 'Creation Failed');
                  }
                  return res;
                }}
                onUpdateAccount={(id, updates) => {
                  const res = updateDealerAccountRecord(id, updates);
                  if (res.success) {
                    setStatusMessage({ text: res.message, type: 'success' });
                    toastSuccess(res.message, 'Dealer Account Updated');
                  } else {
                    toastError(res.message, 'Update Failed');
                  }
                  return res;
                }}
                onToggleAccountActive={(id) => {
                  toggleDealerAccountActive(id);
                  setStatusMessage({ text: 'Dealer account access updated.', type: 'success' });
                  toastInfo('Dealer account access status updated.', 'Access Updated');
                }}
                onDeleteAccount={(id) => {
                  deleteDealerAccountRecord(id);
                  setStatusMessage({ text: 'Dealer account removed.', type: 'success' });
                  toastInfo('Dealer account removed.', 'Deleted');
                }}
                onRequestConfirm={setPendingConfirm}
              />
            )}

            {activeSection === 'dealer-orders' && (
              <AdminDealerOrdersPanel
                dealerOrders={dealerOrders}
                productionQueue={productionQueue}
                orderSearchFilter={orderSearchFilter}
                onSearchChange={setOrderSearchFilter}
                onDownloadCSV={() => {
                  downloadDealerOrdersCSV({ hideDealerContact });
                  toastSuccess('Exported dealer orders CSV.', 'CSV Downloaded');
                }}
                onAcceptOrder={(id, options) => {
                  if (!hasPermission(effectiveRole, 'orders:verify')) return;
                  acceptDealerOrder(
                    id,
                    `${adminSession?.displayName || 'Admin'} (${ROLE_DEFINITIONS[effectiveRole].shortLabel})`,
                    options
                  );
                  const routedCount = options?.unavailableItems?.length || 0;
                  const text =
                    routedCount > 0
                      ? `Order verified: ${routedCount} unavailable line${routedCount === 1 ? '' : 's'} sent to Production Tracker.`
                      : 'Order verified: All items marked In Stock (0 items added to Production).';
                  setStatusMessage({
                    text,
                    type: 'success'
                  });
                  toastSuccess(text, 'Order Verified');
                }}
                onRequestRejectOrder={(ord) => {
                  if (!hasPermission(effectiveRole, 'orders:verify')) return;
                  setRejectTargetOrder(ord);
                  setRejectReasonInput(ord.rejectionReason || '');
                }}
                onUpdateOrder={(id, updatedOrder) => {
                  if (!hasPermission(effectiveRole, 'orders:edit')) return;
                  updateDealerOrder(id, updatedOrder);
                  setStatusMessage({ text: `Order ${updatedOrder.orderId || id} updated.`, type: 'success' });
                  toastSuccess(`Order ${updatedOrder.orderId || id} updated.`, 'Order Saved');
                }}
                onToggleOrderCompleted={(id) => {
                  if (!hasPermission(effectiveRole, 'orders:complete')) return;
                  toggleDealerOrderCompleted(id);
                  toastInfo('Order completion status updated.', 'Status Updated');
                }}
                onRemoveCompletedOrders={() => {
                  if (!hasPermission(effectiveRole, 'orders:delete')) return;
                  removeCompletedDealerOrders();
                  setStatusMessage({ text: 'Checked completed dealer orders removed.', type: 'success' });
                  toastInfo('Checked completed dealer orders removed.', 'Orders Cleaned');
                }}
                onDeleteOrder={(id) => {
                  if (!hasPermission(effectiveRole, 'orders:delete')) return;
                  deleteDealerOrder(id);
                  toastInfo('Dealer order deleted.', 'Order Deleted');
                }}
                onClearOrders={() => {
                  if (!hasPermission(effectiveRole, 'orders:delete')) return;
                  clearDealerOrders();
                  setStatusMessage({ text: 'All dealer orders cleared.', type: 'success' });
                  toastInfo('All dealer orders cleared.', 'Orders Cleared');
                }}
                canVerifyOrders={hasPermission(effectiveRole, 'orders:verify')}
                canEditOrders={hasPermission(effectiveRole, 'orders:edit')}
                canCompleteOrders={hasPermission(effectiveRole, 'orders:complete')}
                canDeleteOrders={hasPermission(effectiveRole, 'orders:delete')}
                canExportEstimate={effectiveRole === 'admin'}
                canConfigureCatalog={canAccessSection(effectiveRole, 'product-config')}
                hideDealerContact={hideDealerContact}
                recordedByLabel={`${adminSession?.displayName || 'Admin'} (${ROLE_DEFINITIONS[effectiveRole].shortLabel})`}
                onRequestConfirm={setPendingConfirm}
                companyInfo={companyInfo}
                onJumpToConfig={() => selectSection('product-config')}
                onJumpToProduction={() => selectSection('production')}
              />
            )}

            {activeSection === 'production' && (
              <AdminProductionPanel
                dealerOrders={dealerOrders}
                productionQueue={productionQueue}
                products={products}
                productConfigs={productConfigs}
                colorsList={colorsList}
                designCodesList={designCodesList}
                globalDefaultCode={globalDefaultCode}
                dailyProductionLogs={dailyProductionLogs}
                productionCheckedKeys={productionCheckedKeys}
                canLogProduction={hasPermission(effectiveRole, 'production:log')}
                canCheckProduction={hasPermission(effectiveRole, 'production:check')}
                canManageQueue={hasPermission(effectiveRole, 'production:queue')}
                recordedByLabel={`${adminSession?.displayName || 'Admin'} (${ROLE_DEFINITIONS[effectiveRole].shortLabel})`}
                onAddProductionQueueItems={(items) => {
                  if (!hasPermission(effectiveRole, 'production:queue')) return;
                  addProductionQueueItems(items);
                }}
                onUpdateProductionQueueItem={(id, updates) => {
                  if (!hasPermission(effectiveRole, 'production:queue')) return;
                  updateProductionQueueItem(id, updates);
                }}
                onDeleteProductionQueueItem={(id) => {
                  if (!hasPermission(effectiveRole, 'production:queue')) return;
                  deleteProductionQueueItem(id);
                  toastInfo('Removed item from production queue.', 'Queue Updated');
                }}
                onAddProductionEntry={(entry) => {
                  if (!hasPermission(effectiveRole, 'production:log')) return;
                  addDailyProductionEntry(entry);
                }}
                onUpdateProductionEntry={(id, updates) => {
                  if (!hasPermission(effectiveRole, 'production:log')) return;
                  updateDailyProductionEntry(id, updates);
                  setStatusMessage({ text: 'Production log entry updated.', type: 'success' });
                  toastSuccess('Production log entry updated.', 'Entry Updated');
                }}
                onSetVariantProducedTotal={(item, targetTotal, recordedBy, note) => {
                  if (!hasPermission(effectiveRole, 'production:log')) return;
                  setProductionProducedTotal(item, targetTotal, recordedBy, note);
                  setStatusMessage({ text: `Produced total updated to ${targetTotal} units for ${item.productName}.`, type: 'success' });
                }}
                onDeleteProductionEntry={(id) => {
                  if (!hasPermission(effectiveRole, 'production:log')) return;
                  deleteDailyProductionEntry(id);
                  toastInfo('Production log entry deleted.', 'Entry Deleted');
                }}
                onClearProductionLogs={() => {
                  if (!hasPermission(effectiveRole, 'production:log')) return;
                  clearDailyProductionLogs();
                  toastInfo('All production logs cleared.', 'Logs Cleared');
                }}
                onToggleItemChecked={(itemKey, nextVal) => {
                  if (!hasPermission(effectiveRole, 'production:check')) return;
                  toggleProductionItemChecked(itemKey, nextVal);
                  toastInfo(nextVal ? 'Production item marked completed.' : 'Production item reopened.', 'Production Status');
                }}
                canViewOrders={canAccessSection(effectiveRole, 'dealer-orders')}
                onRequestConfirm={setPendingConfirm}
                onJumpToOrders={() => selectSection('dealer-orders')}
              />
            )}

            {activeSection === 'inquiries' && (
              <AdminInquiriesPanel
                inquiries={inquiries}
                searchFilter={searchFilter}
                onSearchChange={setSearchFilter}
                onDownloadCSV={() => {
                  downloadCSV();
                  toastSuccess('Exported B2B inquiries CSV.', 'CSV Downloaded');
                }}
                onCopyTable={handleCopyTable}
                copiedSuccess={copiedSuccess}
                onUpdateInquiry={(id, updates) => {
                  if (!hasPermission(effectiveRole, 'inquiries:manage')) return;
                  updateInquiry(id, updates);
                  setStatusMessage({ text: 'Inquiry updated successfully.', type: 'success' });
                  toastSuccess('Inquiry details updated.', 'Inquiry Saved');
                }}
                onDeleteInquiry={(id) => {
                  if (!hasPermission(effectiveRole, 'inquiries:delete')) return;
                  deleteInquiry(id);
                  toastInfo('Inquiry deleted.', 'Inquiry Removed');
                }}
                onClearInquiries={() => {
                  if (!hasPermission(effectiveRole, 'inquiries:delete')) return;
                  clearInquiries();
                  toastInfo('All inquiries cleared.', 'Inquiries Cleared');
                }}
                canManageInquiries={hasPermission(effectiveRole, 'inquiries:manage')}
                canDeleteInquiries={hasPermission(effectiveRole, 'inquiries:delete')}
                canConfigureWebhook={hasPermission(effectiveRole, 'system:cms')}
                onRequestConfirm={setPendingConfirm}
                webhookInput={webhookInput}
                onWebhookInputChange={setWebhookInput}
                onSaveWebhook={handleSaveWebhook}
                appsScriptCode={appsScriptCode}
              />
            )}

            {activeSection === 'product-config' && (
              <AdminProductConfigPanel
                products={products}
                productConfigs={productConfigs}
                colorsList={colorsList}
                globalDefaultCode={globalDefaultCode}
                onUpdateGlobalDefaultCode={updateGlobalDefaultCode}
                updateProductConfig={updateProductConfig}
                resetProductConfigs={resetProductConfigs}
                onRequestConfirm={setPendingConfirm}
              />
            )}

            {activeSection === 'colors-codes' && (
              <AdminColorsCodesPanel
                colorsList={colorsList}
                addColor={addColor}
                renameColor={renameColor}
                removeColor={removeColor}
                resetColors={resetColors}
                designCodesList={designCodesList}
                addDesignCode={addDesignCode}
                renameDesignCode={renameDesignCode}
                removeDesignCode={removeDesignCode}
                resetDesignCodes={resetDesignCodes}
                globalDefaultCode={globalDefaultCode}
                onUpdateGlobalDefaultCode={updateGlobalDefaultCode}
                onResetGlobalDefaultCode={resetGlobalDefaultCode}
                onRequestConfirm={setPendingConfirm}
              />
            )}

            {activeSection === 'collection-order' && (
              <AdminCollectionOrderPanel
                editableCollections={editableCollections}
                products={products}
                orderSubTab={orderSubTab}
                onOrderSubTabChange={setOrderSubTab}
                orderSearchQuery={orderSearchQuery}
                onOrderSearchQueryChange={setOrderSearchQuery}
                orderSaveStatus={orderSaveStatus}
                copiedOrderSuccess={copiedOrderSuccess}
                onCopyOrderTSV={handleCopyOrderTSV}
                onResetDefaultOrder={handleResetDefaultOrder}
                onOrderInputChange={handleOrderInputChange}
                onHomeToggle={handleHomeToggle}
                onMoveCollection={handleMoveCollection}
                onMoveHomeCollection={handleMoveHomeCollection}
                onEditCollection={handleEditCollection}
              />
            )}

            {activeSection === 'insights' && (
              <AdminInsightsPanel
                insightsSummary={insightsSummary}
                rawEvents={cloudAnalyticsEvents || undefined}
                isCloudAnalytics={Boolean(cloudAnalyticsEvents)}
                selectedLocationFilter={selectedLocationFilter}
                onSelectLocationFilter={setSelectedLocationFilter}
                isDetectingGps={isDetectingGps}
                gpsStatusMessage={gpsStatusMessage}
                copiedInsightsSuccess={copiedInsightsSuccess}
                ga4IdInput={ga4IdInput}
                ga4SaveStatus={ga4SaveStatus}
                onRefreshInsights={() => {
                  refreshInsightsData(true).catch(() => {});
                }}
                onCopyInsights={handleCopyInsights}
                onClearInsights={handleClearInsights}
                onDetectGPS={handleDetectGPS}
                onGa4IdChange={setGa4IdInput}
                onSaveGA4={handleSaveGA4}
              />
            )}

            {activeSection === 'seo' && (
              <AdminSeoPanel
                categoriesList={categoriesList}
                blogPosts={blogPosts}
                collectionSeoMap={collectionSeoMap}
                selectedSeoCatId={selectedSeoCatId}
                onSelectSeoCatId={setSelectedSeoCatId}
                selectedCategoryMeta={selectedCategoryMeta}
                seoTitleInput={seoTitleInput}
                seoDescInput={seoDescInput}
                seoKeywordsInput={seoKeywordsInput}
                seoSaveStatus={seoSaveStatus}
                copiedShareLink={copiedShareLink}
                siteMediaLogoSymbol={siteMedia?.logo_symbol}
                onSeoTitleChange={setSeoTitleInput}
                onSeoDescChange={setSeoDescInput}
                onSeoKeywordsChange={setSeoKeywordsInput}
                onSaveSeo={handleSaveSeo}
                onApplyRecommendedSeo={handleApplyRecommendedSeo}
                onResetSeo={handleResetSeo}
                onCopyShareLink={async (url) => {
                  try {
                    await navigator.clipboard.writeText(url);
                    setCopiedShareLink(true);
                    setTimeout(() => setCopiedShareLink(false), 2500);
                    toastSuccess('Link copied to clipboard.', 'Link Copied');
                  } catch {
                    toastError('Could not copy link to clipboard.', 'Copy Failed');
                  }
                }}
              />
            )}

            {activeSection === 'blog' && (
              <AdminBlogPanel
                blogPosts={blogPosts}
                categoriesList={categoriesList}
                siteMedia={siteMedia}
                onSavePost={saveBlogPost}
                onDeletePost={deleteBlogPost}
                onToggleStatus={toggleBlogPostStatus}
                onRestoreStarterPosts={restoreStarterBlogPosts}
                onRequestConfirm={setPendingConfirm}
                onCopyUrl={async (url) => {
                  try {
                    await navigator.clipboard.writeText(url);
                    toastSuccess('Live article link copied to clipboard.', 'Link Copied');
                  } catch {
                    toastError('Could not copy link to clipboard.', 'Copy Failed');
                  }
                }}
                onNotify={(type, title, message) => {
                  if (type === 'success') toastSuccess(message, title);
                  else if (type === 'warning') toastWarning(message, title);
                  else if (type === 'error') toastError(message, title);
                  else toastInfo(message, title);
                }}
              />
            )}

            {activeSection === 'cms' && (
              <AdminCmsSyncPanel
                sheetId={sheetId}
                lastSyncTime={lastSyncTime}
                isSyncing={isSyncing}
                inputUrl={inputUrl}
                onInputUrlChange={setInputUrl}
                onConnect={handleConnect}
                onRefresh={handleRefresh}
                onDisconnect={handleDisconnect}
                onNavigateSection={selectSection}
              />
            )}

            {activeSection === 'location' && (
              <AdminLocationPanel
                locAddress={locAddress}
                locEmbedUrl={locEmbedUrl}
                locMapsUrl={locMapsUrl}
                locPhone1={locPhone1}
                locPhone2={locPhone2}
                locSaveStatus={locSaveStatus}
                onLocAddressChange={setLocAddress}
                onLocEmbedUrlChange={setLocEmbedUrl}
                onLocMapsUrlChange={setLocMapsUrl}
                onLocPhone1Change={setLocPhone1}
                onLocPhone2Change={setLocPhone2}
                onSaveLocation={handleSaveLocation}
                onRestoreAccurateLocation={handleRestoreAccurateLocation}
              />
            )}

            {activeSection === 'security' && (
              <AdminSecurityPanel
                signedInEmail={firebaseUser?.email || null}
                customUserIdInput={customUserIdInput}
                customPasswordInput={customPasswordInput}
                credentialChangeStatus={credentialChangeStatus}
                staffAccounts={staffAccounts}
                onAddStaffAccount={handleAddStaffAccount}
                onUpdateStaffRole={handleUpdateStaffRole}
                onUpdateStaffAccount={handleUpdateStaffAccount}
                onToggleStaffActive={handleToggleStaffActive}
                onDeleteStaffAccount={handleDeleteStaffAccount}
                onRequestConfirm={setPendingConfirm}
                onCustomUserIdChange={setCustomUserIdInput}
                onCustomPasswordChange={setCustomPasswordInput}
                onUpdateCredentials={handleUpdateCredentials}
                onLockSession={handleLock}
                soundEnabled={soundEnabled}
                desktopEnabled={desktopEnabled}
                desktopPermission={desktopPermission}
                onToggleSound={handleToggleNotificationSound}
                onEnableDesktopAlerts={handleEnableDesktopAlerts}
              />
            )}
          </div>
        </main>
      </div>

      {/* IN-APP REJECTION REASON DIALOG (Mandatory reason before excluding order from Production) */}
      {rejectTargetOrder && (
        <div className="fixed inset-0 z-60 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md max-h-[90dvh] overflow-y-auto bg-white border border-slate-200 rounded-2xl shadow-xl p-5 space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
                <div>
                  <h3 className="font-display font-bold text-sm text-slate-900">
                    Reject Order {rejectTargetOrder.orderId || rejectTargetOrder.id}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Dealer: {rejectTargetOrder.dealerInfo?.firmName
                      ? `${rejectTargetOrder.dealerInfo.firmName} (${rejectTargetOrder.personName || rejectTargetOrder.dealerInfo?.contactPerson})`
                      : rejectTargetOrder.personName || rejectTargetOrder.dealerInfo?.contactPerson}{' '}
                    · {rejectTargetOrder.totalQuantity} Units
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setRejectTargetOrder(null);
                  setRejectReasonInput('');
                }}
                className="text-slate-400 hover:text-slate-700 p-1 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <div className="text-[11px] font-semibold text-slate-700">Quick Reason Presets:</div>
              <div className="flex flex-wrap gap-1.5">
                {[
                  'Invalid / Unreachable Contact',
                  'Duplicate Order Entry',
                  'Minimum Quantity Not Met',
                  'Stock / Grade Hold',
                  'Scheduling / Delivery Issue'
                ].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setRejectReasonInput(preset)}
                    className={`px-2.5 py-1 rounded text-[11px] font-semibold border cursor-pointer transition-colors ${
                      rejectReasonInput === preset
                        ? 'bg-rose-600 text-white border-rose-600'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-800">
                Reason for Rejection *
              </label>
              <textarea
                rows={3}
                required
                placeholder="Enter clear reason why this order is rejected (it will NOT enter Production)..."
                value={rejectReasonInput}
                onChange={(e) => setRejectReasonInput(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setRejectTargetOrder(null);
                  setRejectReasonInput('');
                }}
                className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!rejectReasonInput.trim()}
                onClick={() => {
                  if (!hasPermission(effectiveRole, 'orders:verify')) return;
                  if (!rejectReasonInput.trim()) return;
                  rejectDealerOrder(
                    rejectTargetOrder.id,
                    rejectReasonInput.trim(),
                    `${adminSession?.displayName || 'Admin'} (${ROLE_DEFINITIONS[effectiveRole].shortLabel})`
                  );
                  setStatusMessage({
                    text: `Order ${rejectTargetOrder.orderId || rejectTargetOrder.id} rejected and excluded from Production.`,
                    type: 'error'
                  });
                  toastWarning(
                    `Order ${rejectTargetOrder.orderId || rejectTargetOrder.id} rejected and excluded from Production.`,
                    'Order Rejected'
                  );
                  setRejectTargetOrder(null);
                  setRejectReasonInput('');
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IN-APP CONFIRMATION DIALOG (Replaces blocked window.confirm popups everywhere) */}
      {pendingConfirm && (
        <div className="fixed inset-0 z-60 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm max-h-[90dvh] overflow-y-auto bg-white border border-slate-200 rounded-2xl shadow-xl p-5 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <h3 className="font-display font-bold text-base text-slate-900">
                  {pendingConfirm.title}
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {pendingConfirm.message}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPendingConfirm(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setPendingConfirm(null)}
                className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  pendingConfirm.onConfirm();
                  setPendingConfirm(null);
                }}
                className={`px-4 py-2 text-white text-xs font-semibold rounded-lg cursor-pointer ${
                  pendingConfirm.tone === 'warning'
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : pendingConfirm.tone === 'primary'
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {pendingConfirm.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
