import React, { useState, useEffect } from 'react';
import { useWebsiteData } from '../context/DataContext';
import {
  X,
  Table,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Download,
  Copy,
  Trash2,
  MessageSquare,
  Webhook,
  ExternalLink,
  Link2,
  Unlink,
  Search,
  Code,
  Lock,
  KeyRound,
  Eye,
  EyeOff,
  ShieldCheck,
  UserCheck,
  Globe,
  Sparkles,
  Share2,
  RotateCcw,
  Check,
  BarChart3,
  TrendingUp,
  Users,
  Phone,
  Smartphone,
  Laptop,
  Activity,
  MapPin,
  Navigation,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  ListOrdered,
  GripVertical,
  SlidersHorizontal,
  Info,
  Crosshair,
  Timer,
  Building2,
  ZoomIn
} from 'lucide-react';
import { CategoryMeta } from '../types';
import { buildMergedCategoriesList } from './pages/CollectionsPage';
import { generateRecommendedSeo } from '../services/seoService';
import { normalizeImageUrl, cleanGoogleMapsEmbedUrl, getGoogleMapsDirectionsUrl, DEFAULT_COMPANY_INFO } from '../services/googleSheetsService';
import {
  getAnalyticsSummary,
  clearAnalyticsData,
  downloadAnalyticsCSV,
  downloadLocationMarketCSV,
  copyAnalyticsForSheets,
  getSavedGA4Id,
  saveGA4Id,
  requestPreciseLocation,
  formatDwellTime,
  formatLocationString,
  VisitorGeo
} from '../services/analyticsService';

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
    deleteInquiry,
    clearInquiries,
    downloadCSV,
    copyForSheets,
    sheetWebhookUrl,
    updateWebhookUrl,
    siteMedia,
    collectionsMeta,
    collectionSeoMap,
    updateCollectionSeo,
    resetCollectionSeo,
    updateCollectionsMeta,
    updateSingleCollectionOrder,
    resetCollectionsOrder,
    companyInfo,
    updateCompanyInfo,
    resetCompanyInfo
  } = useWebsiteData();

  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return typeof window !== 'undefined' && sessionStorage.getItem('htc_sheet_admin_session') === 'unlocked';
  });

  // Login Form States: USER ID and PASSWORD
  const [userIdInput, setUserIdInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Inside-portal Settings: set custom credentials
  const [customUserIdInput, setCustomUserIdInput] = useState(() => {
    return typeof window !== 'undefined' ? localStorage.getItem('hightone_admin_user') || '' : '';
  });
  const [customPasswordInput, setCustomPasswordInput] = useState('');
  const [credentialChangeStatus, setCredentialChangeStatus] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'inquiries' | 'order' | 'cms' | 'seo' | 'insights' | 'location'>('inquiries');
  const [inputUrl, setInputUrl] = useState('');
  const [webhookInput, setWebhookInput] = useState(sheetWebhookUrl);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [showAppsScriptGuide, setShowAppsScriptGuide] = useState(false);
  const [copiedSuccess, setCopiedSuccess] = useState(false);

  // Factory Location & Google Map State
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
    setLocSaveStatus('Factory location pin & details updated live across the entire website!');
    setTimeout(() => setLocSaveStatus(null), 4000);
  };

  const handleRestoreAccurateLocation = () => {
    resetCompanyInfo();
    setLocAddress(DEFAULT_COMPANY_INFO.factory_address);
    setLocEmbedUrl(DEFAULT_COMPANY_INFO.google_maps_embed_url);
    setLocMapsUrl(DEFAULT_COMPANY_INFO.google_maps_url);
    setLocPhone1(DEFAULT_COMPANY_INFO.primary_phone);
    setLocPhone2(DEFAULT_COMPANY_INFO.secondary_phone);
    setLocSaveStatus('Restored verified Hightone Ceramic factory location pin in Thangadh (Gujarat)!');
    setTimeout(() => setLocSaveStatus(null), 4000);
  };

  // Private Insights State
  const [insightsSummary, setInsightsSummary] = useState(() => getAnalyticsSummary());
  const [ga4IdInput, setGa4IdInput] = useState(() => getSavedGA4Id());
  const [ga4SaveStatus, setGa4SaveStatus] = useState<string | null>(null);
  const [copiedInsightsSuccess, setCopiedInsightsSuccess] = useState(false);
  const [selectedLocationFilter, setSelectedLocationFilter] = useState<string>('all');
  const [isDetectingGps, setIsDetectingGps] = useState<boolean>(false);
  const [gpsStatusMessage, setGpsStatusMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

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
      } else {
        setGpsStatusMessage({
          text: 'Browser location permission not granted. Cellular/Network gateway IP is active.',
          type: 'info'
        });
      }
    } catch {
      setGpsStatusMessage({
        text: 'Could not retrieve browser GPS coordinates. Please check browser permissions.',
        type: 'error'
      });
    } finally {
      setIsDetectingGps(false);
      setTimeout(() => setGpsStatusMessage(null), 7000);
    }
  };

  useEffect(() => {
    if (activeTab === 'insights') {
      setInsightsSummary(getAnalyticsSummary());
    }
  }, [activeTab]);

  const handleSaveGA4 = (e: React.FormEvent) => {
    e.preventDefault();
    saveGA4Id(ga4IdInput.trim());
    setGa4SaveStatus('Google Analytics 4 Measurement ID saved & activated!');
    setTimeout(() => setGa4SaveStatus(null), 4000);
  };

  const handleClearInsights = () => {
    if (window.confirm('Are you sure you want to reset your private visitor analytics? This action cannot be undone.')) {
      clearAnalyticsData();
      setInsightsSummary(getAnalyticsSummary());
    }
  };

  const handleCopyInsights = async () => {
    const success = await copyAnalyticsForSheets();
    if (success) {
      setCopiedInsightsSuccess(true);
      setTimeout(() => setCopiedInsightsSuccess(false), 3000);
    }
  };

  // Collection SEO Panel State
  const categoriesList = buildMergedCategoriesList(collectionsMeta, siteMedia, products);

  // Collection Ordering Management State
  const [orderSubTab, setOrderSubTab] = useState<'collections' | 'home' | 'guide'>('collections');
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [orderSaveStatus, setOrderSaveStatus] = useState<string | null>(null);
  const [copiedOrderSuccess, setCopiedOrderSuccess] = useState(false);

  // Editable collections state for live visual reordering
  const [editableCollections, setEditableCollections] = useState<CategoryMeta[]>(() => {
    return buildMergedCategoriesList(collectionsMeta, siteMedia, products);
  });

  useEffect(() => {
    setEditableCollections(buildMergedCategoriesList(collectionsMeta, siteMedia, products));
  }, [collectionsMeta, siteMedia, products]);

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
        order: item.order ?? (idx + 1),
        ...(item.homeOrder !== undefined ? { homeOrder: item.homeOrder } : {}),
        ...(item.showOnHome !== undefined ? { showOnHome: item.showOnHome } : {})
      };
    });
    updateCollectionsMeta(newMeta);
    setOrderSaveStatus(customMessage || 'Collection order updated live across Home & Collections pages!');
    setTimeout(() => setOrderSaveStatus(null), 4000);
  };

  const handleMoveCollection = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= editableCollections.length) return;

    const updated = [...editableCollections];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, moved);

    const resequenced = updated.map((item, idx) => ({
      ...item,
      order: idx + 1
    }));
    setEditableCollections(resequenced);
    applyCollectionsOrder(resequenced, `Moved "${moved.title}" to position #${targetIndex + 1}!`);
  };

  const handleOrderInputChange = (id: string, newOrderVal: number) => {
    if (isNaN(newOrderVal) || newOrderVal < 1) return;
    const updated = editableCollections.map((c) => {
      if (c.id === id) {
        return { ...c, order: newOrderVal };
      }
      return c;
    });
    updated.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
    setEditableCollections(updated);
    applyCollectionsOrder(updated, 'Updated collection order number!');
  };

  const handleHomeToggle = (id: string) => {
    const updated = editableCollections.map((c) => {
      if (c.id === id) {
        const nextShow = !c.showOnHome;
        return { ...c, showOnHome: nextShow };
      }
      return c;
    });
    setEditableCollections(updated);
    applyCollectionsOrder(updated, 'Home showcase status updated!');
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
    homeList.forEach((item, idx) => {
      homeOrderMap.set(item.id, idx + 1);
    });

    const updated = editableCollections.map((c) => {
      if (homeOrderMap.has(c.id)) {
        return { ...c, homeOrder: homeOrderMap.get(c.id) };
      }
      return c;
    });

    setEditableCollections(updated);
    applyCollectionsOrder(updated, `Moved "${moved.title}" to Home slot #${targetIndex + 1}!`);
  };

  const handleResetDefaultOrder = () => {
    if (window.confirm('Reset all collection sequences to standard factory ordering?')) {
      resetCollectionsOrder();
      setOrderSaveStatus('Restored default factory collection order.');
      setTimeout(() => setOrderSaveStatus(null), 4000);
    }
  };

  const handleCopyOrderTSV = async () => {
    const headers = ['Category', 'Title', 'Order', 'Home', 'Home_Order'].join('\t');
    const rows = editableCollections.map((c, idx) => [
      c.id,
      c.title,
      c.order ?? (idx + 1),
      c.showOnHome ? 'TRUE' : 'FALSE',
      c.homeOrder ?? (idx < 8 ? idx + 1 : '')
    ].join('\t'));
    const text = [headers, ...rows].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopiedOrderSuccess(true);
      setTimeout(() => setCopiedOrderSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const [selectedSeoCatId, setSelectedSeoCatId] = useState<string>(() => {
    return categoriesList[0]?.id || 'one-piece';
  });
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
    const sheetTitle = selectedCategoryMeta.seoTitle;
    const sheetDesc = selectedCategoryMeta.seoDescription;
    const sheetKeywords = selectedCategoryMeta.seoKeywords;
    const rec = generateRecommendedSeo(selectedCategoryMeta);

    setSeoTitleInput(stored?.title ?? sheetTitle ?? rec.title);
    setSeoDescInput(stored?.description ?? sheetDesc ?? rec.description);
    setSeoKeywordsInput(stored?.keywords ?? sheetKeywords ?? rec.keywords);
    setSeoSaveStatus(null);
  }, [selectedSeoCatId, selectedCategoryMeta, collectionSeoMap]);

  const handleSaveSeo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCategoryMeta) return;
    updateCollectionSeo(selectedCategoryMeta.id, {
      title: seoTitleInput.trim(),
      description: seoDescInput.trim(),
      keywords: seoKeywordsInput.trim()
    });
    setSeoSaveStatus(`Saved SEO metadata for "${selectedCategoryMeta.title}"! Changes are active live.`);
    setTimeout(() => setSeoSaveStatus(null), 4000);
  };

  const handleApplyRecommendedSeo = () => {
    if (!selectedCategoryMeta) return;
    const rec = generateRecommendedSeo(selectedCategoryMeta);
    setSeoTitleInput(rec.title);
    setSeoDescInput(rec.description);
    setSeoKeywordsInput(rec.keywords);
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
  };

  if (!isOpen) return null;

  // Validate BOTH User ID and Password
  const handleAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    const enteredUser = userIdInput.trim().toLowerCase();
    const enteredPass = passwordInput.trim();

    if (!enteredUser) {
      setAuthError('Please enter your User ID.');
      return;
    }
    if (!enteredPass) {
      setAuthError('Please enter your Password.');
      return;
    }

    // 1. Credentials synced directly from the connected Google Sheet
    const sheetUser = (localStorage.getItem('hightone_sheet_admin_user') || '').trim().toLowerCase();
    const sheetPass = (localStorage.getItem('hightone_sheet_admin_pass') || '').trim();

    // 2. Custom credentials saved by owner in localStorage
    const savedCustomUser = (localStorage.getItem('hightone_admin_user') || '').trim().toLowerCase();
    const savedCustomPass = (localStorage.getItem('hightone_admin_password') || '').trim();

    // 3. Fallback authorized plant User IDs & Passwords
    const defaultUserIds = ['sonagarakeval91@gmail.com', 'admin', 'htc', 'htc-admin'];
    const defaultPasswords = ['HTC@2025', 'Hightone2025', 'htc2025', 'htc1234', 'HTC2025'];

    // Check matching combinations
    const matchesSheet = Boolean(sheetUser && sheetPass && enteredUser === sheetUser && enteredPass === sheetPass);
    const matchesCustom = Boolean(savedCustomUser && savedCustomPass && enteredUser === savedCustomUser && enteredPass === savedCustomPass);
    const matchesDefault = defaultUserIds.includes(enteredUser) && defaultPasswords.includes(enteredPass);

    if (matchesSheet || matchesCustom || matchesDefault) {
      setIsAuthenticated(true);
      sessionStorage.setItem('htc_sheet_admin_session', 'unlocked');
      setUserIdInput('');
      setPasswordInput('');
      setAuthError(null);
    } else {
      setAuthError(
        'Invalid User ID or Password. Please try again.'
      );
    }
  };

  const handleLock = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('htc_sheet_admin_session');
    setUserIdInput('');
    setPasswordInput('');
    setAuthError(null);
  };

  const handleUpdateCredentials = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customUserIdInput.trim() || !customPasswordInput.trim()) return;

    localStorage.setItem('hightone_admin_user', customUserIdInput.trim());
    localStorage.setItem('hightone_admin_password', customPasswordInput.trim());
    setCredentialChangeStatus('User ID and Password updated successfully in system storage!');
    setCustomPasswordInput('');
    setTimeout(() => setCredentialChangeStatus(null), 4000);
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputUrl.trim()) return;

    setStatusMessage(null);
    const result = await connectSheet(inputUrl.trim());
    if (result.success) {
      setStatusMessage({ text: result.message, type: 'success' });
      setInputUrl('');
    } else {
      setStatusMessage({ text: result.message, type: 'error' });
    }
  };

  const handleRefresh = async () => {
    setStatusMessage(null);
    const result = await refreshData();
    setStatusMessage({
      text: result.message || 'Content refreshed successfully from your Google Sheet.',
      type: result.success ? 'success' : 'error'
    });
  };

  const handleDisconnect = () => {
    disconnectSheet();
    setStatusMessage({ text: 'Disconnected from Google Sheet. Restored default factory data.', type: 'success' });
  };

  const handleSaveWebhook = (e: React.FormEvent) => {
    e.preventDefault();
    updateWebhookUrl(webhookInput.trim());
    setStatusMessage({
      text: webhookInput.trim()
        ? 'Google Sheet Webhook URL saved. All future form submissions will be pushed to your sheet automatically!'
        : 'Webhook URL removed.',
      type: 'success'
    });
  };

  const handleCopyTable = async () => {
    const ok = await copyForSheets();
    if (ok) {
      setCopiedSuccess(true);
      setTimeout(() => setCopiedSuccess(false), 3000);
    }
  };

  const filteredInquiries = inquiries.filter((inq) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return (
      inq.businessName.toLowerCase().includes(q) ||
      inq.contactPerson.toLowerCase().includes(q) ||
      inq.whatsappNumber.includes(q) ||
      inq.cityState.toLowerCase().includes(q) ||
      inq.productInterest.toLowerCase().includes(q) ||
      inq.id.toLowerCase().includes(q)
    );
  });

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-[#001936]/65 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="bg-white w-full max-w-4xl max-h-[92dvh] sm:max-h-[88vh] rounded-[4px] shadow-2xl border border-[#cbd5e1] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* If NOT Authenticated: Show User ID and Password Form */}
        {!isAuthenticated ? (
          <>
            {/* Locked Modal Header */}
            <div className="bg-[#001936] text-white px-5 py-4 flex items-center justify-between border-b border-[#0F2E52] shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300">
                  <Lock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-base tracking-wide flex items-center space-x-2">
                    <span>Hightone Ceramic — Sheet Management</span>
                  </h3>
                  <p className="text-[11px] text-amber-200 font-mono tracking-wider">
                    RESTRICTED ACCESS • USER ID &amp; PASSWORD REQUIRED
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-white p-1.5 rounded transition-colors cursor-pointer"
                aria-label="Close Modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* User ID & Password Login Screen */}
            <div className="p-6 sm:p-10 flex-1 flex flex-col items-center justify-center text-center overflow-y-auto">
              <div className="w-16 h-16 rounded-full bg-slate-100 border-2 border-slate-300 flex items-center justify-center text-[#0F2E52] mb-3.5 shadow-sm">
                <ShieldCheck className="w-8 h-8 text-[#0F2E52]" />
              </div>

              <h4 className="font-display font-bold text-xl sm:text-2xl text-[#0F2E52] mb-1">
                Management Authorization
              </h4>
              <p className="text-xs sm:text-sm text-[#515f74] max-w-md mx-auto mb-6 leading-relaxed">
                Enter your <strong>User ID</strong> and <strong>Password</strong> to access the sheet management portal.
              </p>

              {/* Authentication Form with User ID and Password */}
              <form onSubmit={handleAuthSubmit} className="w-full max-w-sm space-y-3.5">
                {/* 1. User ID Field */}
                <div className="text-left">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#475569] mb-1">
                    User ID *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      autoFocus
                      required
                      placeholder=""
                      value={userIdInput}
                      onChange={(e) => {
                        setUserIdInput(e.target.value);
                        if (authError) setAuthError(null);
                      }}
                      className="w-full px-3.5 py-2.5 bg-white border border-[#cbd5e1] rounded-[3px] text-[#0F172A] text-xs sm:text-sm focus:outline-none focus:border-[#0F2E52] focus:ring-2 focus:ring-[#0F2E52]/20"
                    />
                  </div>
                </div>

                {/* 2. Password Field */}
                <div className="text-left">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#475569] mb-1">
                    Password *
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder=""
                      value={passwordInput}
                      onChange={(e) => {
                        setPasswordInput(e.target.value);
                        if (authError) setAuthError(null);
                      }}
                      className="w-full pl-3.5 pr-10 py-2.5 bg-white border border-[#cbd5e1] rounded-[3px] text-[#0F172A] text-xs sm:text-sm focus:outline-none focus:border-[#0F2E52] focus:ring-2 focus:ring-[#0F2E52]/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {authError && (
                  <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-[3px] flex items-center space-x-2 text-left">
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                    <span>{authError}</span>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-2 pt-1.5">
                  <button
                    type="submit"
                    className="flex-1 py-2.5 px-4 bg-[#0F2E52] hover:bg-[#1e3a5f] text-white text-xs font-semibold rounded-[3px] transition-colors flex items-center justify-center space-x-2 cursor-pointer shadow-xs active:scale-[0.99]"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Unlock Sheet Management</span>
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="py-2.5 px-4 border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-[3px] transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>

            <div className="bg-[#f8fafc] px-5 py-3 border-t border-[#e2e8f0] flex items-center justify-between text-xs shrink-0">
              <span className="text-[11px] text-[#64748b]">
                Hightone Ceramic • User ID &amp; Password Verification Active
              </span>
              <button
                onClick={onClose}
                className="px-3.5 py-1 text-xs border border-slate-300 text-slate-600 rounded hover:bg-slate-100 cursor-pointer"
              >
                Exit
              </button>
            </div>
          </>
        ) : (
          /* Unlocked Authenticated Sheet Management */
          <>
            {/* Header */}
            <div className="bg-[#001936] text-white px-5 py-4 flex items-center justify-between border-b border-[#0F2E52] shrink-0">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-base tracking-wide flex items-center space-x-2">
                    <span>Hightone Ceramic — Sheet Management</span>
                  </h3>
                  <p className="text-[11px] text-slate-300">
                    Inquiry form records, Google Sheets live sync &amp; plant export
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {/* Instant Lock Button */}
                <button
                  type="button"
                  onClick={handleLock}
                  className="flex items-center space-x-1 px-2.5 py-1 text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-amber-200 rounded-[3px] border border-amber-400/30 transition-colors cursor-pointer"
                  title="Lock management console"
                >
                  <Lock className="w-3 h-3 text-amber-300" />
                  <span>Lock</span>
                </button>
                <button
                  onClick={onClose}
                  className="text-slate-400 hover:text-white p-1.5 rounded transition-colors cursor-pointer"
                  aria-label="Close Modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex items-center border-b border-[#e2e8f0] bg-[#f8fafc] px-4 sm:px-5 shrink-0 text-xs font-semibold overflow-x-auto scrollbar-none">
              <button
                type="button"
                onClick={() => setActiveTab('inquiries')}
                className={`py-3 px-3.5 border-b-2 flex items-center space-x-2 transition-colors cursor-pointer shrink-0 ${
                  activeTab === 'inquiries'
                    ? 'border-[#0F2E52] text-[#0F2E52] font-bold'
                    : 'border-transparent text-[#64748b] hover:text-[#0F2E52]'
                }`}
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                <span>Inquiries &amp; Leads Sheet</span>
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-mono px-2 py-0.5 rounded-full font-bold">
                  {inquiries.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('order')}
                className={`py-3 px-3.5 border-b-2 flex items-center space-x-2 transition-colors cursor-pointer shrink-0 ${
                  activeTab === 'order'
                    ? 'border-[#0F2E52] text-[#0F2E52] font-bold'
                    : 'border-transparent text-[#64748b] hover:text-[#0F2E52]'
                }`}
              >
                <ListOrdered className="w-4 h-4 text-amber-600" />
                <span>Collection Ordering</span>
                <span className="bg-amber-100 text-amber-900 text-[10px] font-mono px-1.5 py-0.5 rounded-full font-bold">
                  {editableCollections.length} Items
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('cms')}
                className={`py-3 px-3.5 border-b-2 flex items-center space-x-2 transition-colors cursor-pointer ${
                  activeTab === 'cms'
                    ? 'border-[#0F2E52] text-[#0F2E52] font-bold'
                    : 'border-transparent text-[#64748b] hover:text-[#0F2E52]'
                }`}
              >
                <Table className="w-4 h-4 text-[#0F2E52]" />
                <span>Website CMS &amp; Catalog Sync</span>
                {sheetId && (
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('seo')}
                className={`py-3 px-3.5 border-b-2 flex items-center space-x-2 transition-colors cursor-pointer ${
                  activeTab === 'seo'
                    ? 'border-[#0F2E52] text-[#0F2E52] font-bold'
                    : 'border-transparent text-[#64748b] hover:text-[#0F2E52]'
                }`}
              >
                <Globe className="w-4 h-4 text-sky-600" />
                <span>Collection SEO (Head Tags)</span>
                {Object.keys(collectionSeoMap).length > 0 && (
                  <span className="bg-sky-100 text-sky-800 text-[10px] font-mono px-1.5 py-0.5 rounded-full font-bold">
                    {Object.keys(collectionSeoMap).length} Custom
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('insights')}
                className={`py-3 px-3.5 border-b-2 flex items-center space-x-2 transition-colors cursor-pointer ${
                  activeTab === 'insights'
                    ? 'border-[#0F2E52] text-[#0F2E52] font-bold'
                    : 'border-transparent text-[#64748b] hover:text-[#0F2E52]'
                }`}
              >
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <span>Executive Insights (Private)</span>
                {insightsSummary.totalWhatsAppClicks + insightsSummary.totalQuoteSubmits > 0 && (
                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-mono px-1.5 py-0.5 rounded-full font-bold">
                    {insightsSummary.totalWhatsAppClicks + insightsSummary.totalQuoteSubmits} Leads
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('location')}
                className={`py-3 px-3.5 border-b-2 flex items-center space-x-2 transition-colors cursor-pointer ${
                  activeTab === 'location'
                    ? 'border-[#0F2E52] text-[#0F2E52] font-bold'
                    : 'border-transparent text-[#64748b] hover:text-[#0F2E52]'
                }`}
              >
                <MapPin className="w-4 h-4 text-rose-600" />
                <span>Factory Pin &amp; Map</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 space-y-5 overflow-y-auto flex-1 text-xs text-[#515f74]">

              {/* Feedback Messages */}
              {statusMessage && (
                <div
                  className={`p-3 rounded-[3px] flex items-start space-x-2 text-xs ${
                    statusMessage.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-red-50 text-red-800 border border-red-200'
                  }`}
                >
                  {statusMessage.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  )}
                  <span>{statusMessage.text}</span>
                </div>
              )}

              {/* TAB 1: INQUIRIES & LEADS SHEET */}
              {activeTab === 'inquiries' && (
                <div className="space-y-4">
                  {/* Action Toolbar */}
                  <div className="bg-[#f8fafc] border border-[#e2e8f0] p-3 rounded-[3px] flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="relative flex-1 max-w-sm">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search by Firm, WhatsApp, City, Item..."
                        value={searchFilter}
                        onChange={(e) => setSearchFilter(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 bg-white border border-[#cbd5e1] rounded-[3px] text-xs text-[#0F172A] focus:outline-none focus:border-[#0F2E52]"
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={downloadCSV}
                        disabled={inquiries.length === 0}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold rounded-[3px] transition-colors flex items-center space-x-1.5 cursor-pointer shadow-2xs"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Export CSV</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleCopyTable}
                        disabled={inquiries.length === 0}
                        className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-[#cbd5e1] text-[#0F2E52] font-semibold rounded-[3px] transition-colors flex items-center space-x-1.5 cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>{copiedSuccess ? 'Copied to Clipboard!' : 'Copy for Google Sheets'}</span>
                      </button>

                      {inquiries.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm('Are you sure you want to clear all inquiries? Consider downloading CSV first.')) {
                              clearInquiries();
                            }
                          }}
                          className="px-2.5 py-1.5 text-red-600 hover:bg-red-50 border border-red-200 rounded-[3px] transition-colors flex items-center space-x-1 cursor-pointer"
                          title="Clear all saved inquiries"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Clear All</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Webhook Configuration Banner */}
                  <div className="p-3.5 bg-[#f0fdf4] border border-[#bbf7d0] rounded-[3px] space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Webhook className="w-4 h-4 text-emerald-600" />
                        <span className="font-bold text-[#0F2E52] text-xs">
                          Automatic Webhook Push (Push directly to Google Sheets)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowAppsScriptGuide(!showAppsScriptGuide)}
                        className="text-emerald-700 hover:underline text-[11px] flex items-center space-x-1 cursor-pointer font-medium"
                      >
                        <Code className="w-3 h-3" />
                        <span>{showAppsScriptGuide ? 'Hide Apps Script Code' : 'View Google Apps Script Code'}</span>
                      </button>
                    </div>

                    <form onSubmit={handleSaveWebhook} className="flex gap-2 items-center">
                      <input
                        type="url"
                        placeholder="Paste Webhook URL (Apps Script or SheetDB URL: https://...)"
                        value={webhookInput}
                        onChange={(e) => setWebhookInput(e.target.value)}
                        className="flex-1 px-3 py-1.5 bg-white border border-[#cbd5e1] rounded-[3px] text-xs text-[#0F172A] focus:outline-none focus:border-[#0F2E52]"
                      />
                      <button
                        type="submit"
                        className="px-3.5 py-1.5 bg-[#0F2E52] hover:bg-[#1e3a5f] text-white font-semibold rounded-[3px] cursor-pointer"
                      >
                        Save Webhook
                      </button>
                    </form>

                    {showAppsScriptGuide && (
                      <div className="mt-3 p-3.5 bg-white border border-slate-200 rounded text-[11px] space-y-3">
                        <div className="space-y-1">
                          <p className="font-bold text-[#0F2E52]">
                            Standard Google Apps Script Setup:
                          </p>
                          <ol className="list-decimal pl-4 space-y-1 text-slate-700">
                            <li>In your Google Sheet, click <strong>Extensions &gt; Apps Script</strong>.</li>
                            <li>At the top left, click <em>Untitled project</em> and rename it to <strong>Hightone Leads Webhook</strong>.</li>
                            <li>Paste the script code below.</li>
                            <li>Click <strong>Deploy &gt; New deployment</strong> (Select type: <strong>Web app</strong>, Execute as: <strong>Me</strong>, Who has access: <strong>Anyone</strong>).</li>
                            <li><strong className="text-red-700">Do NOT click the "▶ Run" button</strong> in the editor (clicking Run triggers OAuth errors). Only click <em>Deploy</em>!</li>
                            <li>Copy the resulting Web App URL and paste it into the Webhook box above.</li>
                          </ol>
                        </div>

                        <pre className="p-2.5 bg-slate-900 text-slate-100 rounded text-[10px] overflow-x-auto font-mono">
                          {appsScriptCode}
                        </pre>

                        {/* Advanced Protection Program Troubleshooting Box */}
                        <div className="p-2.5 bg-amber-50 border border-amber-200 rounded text-[11px] space-y-1 text-amber-900">
                          <strong className="block text-amber-950 font-semibold">
                            ⚠️ Got "Access blocked: Untitled project is not approved by Advanced Protection (Error 400)"?
                          </strong>
                          <p className="text-[10.5px] leading-relaxed">
                            Your Google Account has Google's highest security mode (Advanced Protection) enabled, which prevents unverified personal scripts from accessing your account. You have two easy solutions:
                          </p>
                          <ul className="list-disc pl-4 space-y-1 text-[10.5px]">
                            <li>
                              <strong>Option 1 (Zero-code, 30 seconds):</strong> Use free <a href="https://sheetdb.io" target="_blank" rel="noopener noreferrer" className="text-blue-700 underline font-semibold">SheetDB.io</a>. Connect your Google Sheet link there, copy the generated API URL (e.g. <code>https://sheetdb.io/api/v1/...</code>), and paste it above!
                            </li>
                            <li>
                              <strong>Option 2 (Use alternate email):</strong> Open the Google Sheet using a regular Gmail or workspace email without Advanced Protection, deploy the Apps Script there, and share the sheet with your main email.
                            </li>
                            <li>
                              <strong>Option 3 (No Webhook needed):</strong> Use the <strong>"Copy for Google Sheets"</strong> or <strong>"Export CSV"</strong> buttons above anytime to paste all inquiries directly into your Sheet.
                            </li>
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Inquiries Table */}
                  <div className="border border-[#e2e8f0] rounded-[3px] overflow-hidden bg-white shadow-2xs">
                    <div className="overflow-x-auto max-h-[360px]">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-[#f8fafc] text-[#0F2E52] font-semibold border-b border-[#e2e8f0] sticky top-0 z-10">
                          <tr>
                            <th className="py-2.5 px-3 whitespace-nowrap">ID / Time</th>
                            <th className="py-2.5 px-3 whitespace-nowrap">Business / Contact</th>
                            <th className="py-2.5 px-3 whitespace-nowrap">WhatsApp</th>
                            <th className="py-2.5 px-3 whitespace-nowrap">City &amp; State</th>
                            <th className="py-2.5 px-3 whitespace-nowrap">Product Interest</th>
                            <th className="py-2.5 px-3 whitespace-nowrap">Volume</th>
                            <th className="py-2.5 px-3 whitespace-nowrap text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#f1f5f9]">
                          {filteredInquiries.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="py-8 text-center text-slate-400">
                                {searchFilter ? 'No matching inquiries found.' : 'No inquiries recorded yet. Form submissions from the website will automatically appear here.'}
                              </td>
                            </tr>
                          ) : (
                            filteredInquiries.map((inq) => (
                              <tr key={inq.id} className="hover:bg-slate-50 transition-colors">
                                <td className="py-2.5 px-3 whitespace-nowrap font-mono text-[11px]">
                                  <div className="font-semibold text-[#0F2E52]">{inq.id}</div>
                                  <div className="text-[10px] text-slate-400">{inq.timestamp}</div>
                                </td>
                                <td className="py-2.5 px-3 whitespace-nowrap">
                                  <div className="font-bold text-[#0F2E52]">{inq.businessName}</div>
                                  <div className="text-[11px] text-slate-500">{inq.contactPerson}</div>
                                </td>
                                <td className="py-2.5 px-3 whitespace-nowrap font-mono">
                                  <a
                                    href={`https://wa.me/${inq.whatsappNumber.replace(/\D/g, '')}?text=Hello%20${encodeURIComponent(inq.contactPerson)}%2C%20regarding%20your%20Hightone%20Ceramic%20inquiry%20for%20${encodeURIComponent(inq.productInterest)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-emerald-700 hover:underline flex items-center space-x-1"
                                  >
                                    <MessageSquare className="w-3 h-3 text-emerald-600" />
                                    <span>{inq.whatsappNumber}</span>
                                  </a>
                                </td>
                                <td className="py-2.5 px-3 whitespace-nowrap text-slate-700">
                                  {inq.cityState || '—'}
                                </td>
                                <td className="py-2.5 px-3 max-w-[200px] truncate text-slate-800" title={inq.productInterest}>
                                  {inq.productInterest}
                                </td>
                                <td className="py-2.5 px-3 whitespace-nowrap text-[11px] text-slate-600">
                                  {inq.volume || '—'}
                                </td>
                                <td className="py-2.5 px-3 whitespace-nowrap text-right">
                                  <button
                                    onClick={() => deleteInquiry(inq.id)}
                                    className="text-slate-400 hover:text-red-600 p-1 rounded transition-colors cursor-pointer"
                                    title="Delete inquiry"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB: COLLECTION ORDERING & DISPLAY MANAGER */}
              {activeTab === 'order' && (
                <div className="space-y-4">
                  {/* Banner */}
                  <div className="bg-[#0F2E52] text-white p-4 sm:p-5 rounded-[4px] shadow-xs space-y-2.5">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center space-x-2.5">
                        <div className="w-8 h-8 rounded bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300">
                          <ListOrdered className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="font-display font-bold text-sm sm:text-base">
                            Collection Sequence &amp; Home Display Manager
                          </h4>
                          <p className="text-[11px] text-amber-200">
                            Reorder collections for both Home Page &amp; Collections Page
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={handleCopyOrderTSV}
                          className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded text-[11px] font-semibold border border-white/20 flex items-center space-x-1.5 cursor-pointer transition-colors"
                          title="Copy table formatted for Google Sheets paste"
                        >
                          <Copy className="w-3.5 h-3.5 text-amber-300" />
                          <span>{copiedOrderSuccess ? 'Copied to Clipboard!' : 'Copy for Google Sheets'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleResetDefaultOrder}
                          className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white rounded text-[11px] font-semibold border border-white/20 flex items-center space-x-1 cursor-pointer transition-colors"
                          title="Restore original factory sequence"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Reset Default</span>
                        </button>
                      </div>
                    </div>

                    <p className="text-xs text-slate-200 leading-relaxed max-w-3xl">
                      Rearrange which collections appear first on your website. Use the <strong>↑ Up</strong> and <strong>↓ Down</strong> buttons or enter numbers directly. You can also pick which 8 collections appear in the Home Page grid. Changes apply live immediately!
                    </p>
                  </div>

                  {/* Feedback Message */}
                  {orderSaveStatus && (
                    <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-[3px] flex items-center space-x-2 text-xs">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{orderSaveStatus}</span>
                    </div>
                  )}

                  {/* Sub Navigation Controls */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#e2e8f0] pb-2.5 gap-2">
                    <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded">
                      <button
                        type="button"
                        onClick={() => setOrderSubTab('collections')}
                        className={`px-3 py-1 rounded text-xs font-semibold cursor-pointer transition-colors ${
                          orderSubTab === 'collections'
                            ? 'bg-white text-[#0F2E52] shadow-2xs font-bold'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Collections Page Order ({editableCollections.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setOrderSubTab('home')}
                        className={`px-3 py-1 rounded text-xs font-semibold cursor-pointer transition-colors ${
                          orderSubTab === 'home'
                            ? 'bg-white text-[#0F2E52] shadow-2xs font-bold'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Home Page 8-Card Showcase
                      </button>
                      <button
                        type="button"
                        onClick={() => setOrderSubTab('guide')}
                        className={`px-3 py-1 rounded text-xs font-semibold cursor-pointer transition-colors ${
                          orderSubTab === 'guide'
                            ? 'bg-white text-[#0F2E52] shadow-2xs font-bold'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Google Sheet Instructions
                      </button>
                    </div>

                    {orderSubTab !== 'guide' && (
                      <div className="relative min-w-[200px]">
                        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Filter collection..."
                          value={orderSearchQuery}
                          onChange={(e) => setOrderSearchQuery(e.target.value)}
                          className="w-full pl-7 pr-3 py-1 bg-white border border-[#cbd5e1] rounded text-xs text-[#0F172A] focus:outline-none focus:border-[#0F2E52]"
                        />
                      </div>
                    )}
                  </div>

                  {/* SUB-VIEW 1: COLLECTIONS PAGE ORDER */}
                  {orderSubTab === 'collections' && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-slate-600 text-xs">
                        <p>
                          Showing all <strong>{editableCollections.length} collections</strong> sorted by their sequence number. Tap <strong>↑</strong> / <strong>↓</strong> to move, or type an exact order number.
                        </p>
                      </div>

                      <div className="border border-[#cbd5e1] rounded-[3px] overflow-hidden bg-white">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-[#f8fafc] text-[#0F2E52] border-b border-[#e2e8f0] text-[11px] uppercase tracking-wider font-bold">
                              <th className="py-2.5 px-3 w-16 text-center">Order #</th>
                              <th className="py-2.5 px-3">Collection Details</th>
                              <th className="py-2.5 px-3 w-28 whitespace-nowrap">Catalog Models</th>
                              <th className="py-2.5 px-3 w-36 text-center">Home Page Status</th>
                              <th className="py-2.5 px-3 w-28 text-center">Quick Move</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#e2e8f0]">
                            {editableCollections
                              .filter((c) => {
                                if (!orderSearchQuery.trim()) return true;
                                const q = orderSearchQuery.toLowerCase();
                                return (
                                  c.title.toLowerCase().includes(q) ||
                                  c.id.toLowerCase().includes(q) ||
                                  c.subtitle.toLowerCase().includes(q)
                                );
                              })
                              .map((cat, index) => {
                                const count = products.filter((p) => {
                                  const pCat = p.category.toLowerCase().replace(/[\s_-]+/g, '');
                                  const cCat = cat.id.toLowerCase().replace(/[\s_-]+/g, '');
                                  return pCat === cCat || p.category.toLowerCase().includes(cCat);
                                }).length;

                                return (
                                  <tr key={cat.id} className="hover:bg-slate-50/80 transition-colors">
                                    {/* Order Number Input */}
                                    <td className="py-2.5 px-3 text-center">
                                      <input
                                        type="number"
                                        min="1"
                                        max="99"
                                        value={cat.order ?? index + 1}
                                        onChange={(e) => handleOrderInputChange(cat.id, parseInt(e.target.value, 10))}
                                        className="w-12 px-1.5 py-1 text-center font-bold font-mono text-xs bg-slate-50 border border-slate-300 rounded focus:bg-white focus:outline-none focus:border-[#0F2E52] text-[#0F2E52]"
                                      />
                                    </td>

                                    {/* Thumbnail & Title */}
                                    <td className="py-2.5 px-3">
                                      <div className="flex items-center space-x-3">
                                        <div className="w-10 h-10 rounded bg-slate-100 border border-slate-200 overflow-hidden shrink-0">
                                          <img
                                            src={normalizeImageUrl(cat.coverImage)}
                                            alt={cat.title}
                                            className="w-full h-full object-cover"
                                          />
                                        </div>
                                        <div>
                                          <span className="font-bold text-[#0F2E52] text-xs block">
                                            {cat.title}
                                          </span>
                                          <div className="flex items-center space-x-2 text-[10px] text-slate-500">
                                            <span className="font-mono bg-slate-100 px-1 rounded">
                                              category: {cat.id}
                                            </span>
                                            <span>•</span>
                                            <span className="truncate max-w-[200px]">{cat.subtitle}</span>
                                          </div>
                                        </div>
                                      </div>
                                    </td>

                                    {/* Model Count */}
                                    <td className="py-2.5 px-3 whitespace-nowrap">
                                      <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded font-semibold text-[11px]">
                                        {count} {count === 1 ? 'Model' : 'Models'}
                                      </span>
                                    </td>

                                    {/* Home Page Status Toggle */}
                                    <td className="py-2.5 px-3 text-center">
                                      <button
                                        type="button"
                                        onClick={() => handleHomeToggle(cat.id)}
                                        className={`px-2.5 py-1 rounded text-[11px] font-semibold cursor-pointer transition-colors ${
                                          cat.showOnHome
                                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-emerald-200'
                                            : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
                                        }`}
                                      >
                                        {cat.showOnHome ? '✓ Visible on Home' : '+ Show on Home'}
                                      </button>
                                    </td>

                                    {/* Quick Move Up/Down Buttons */}
                                    <td className="py-2.5 px-3 text-center">
                                      <div className="inline-flex items-center space-x-1">
                                        <button
                                          type="button"
                                          onClick={() => handleMoveCollection(index, 'up')}
                                          disabled={index === 0}
                                          className="p-1.5 text-slate-600 hover:text-[#0F2E52] hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent rounded transition-colors cursor-pointer"
                                          title="Move position up"
                                        >
                                          <ArrowUp className="w-4 h-4" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleMoveCollection(index, 'down')}
                                          disabled={index === editableCollections.length - 1}
                                          className="p-1.5 text-slate-600 hover:text-[#0F2E52] hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent rounded transition-colors cursor-pointer"
                                          title="Move position down"
                                        >
                                          <ArrowDown className="w-4 h-4" />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* SUB-VIEW 2: HOME PAGE 8-CARD SHOWCASE */}
                  {orderSubTab === 'home' && (
                    <div className="space-y-4">
                      <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-[3px] text-xs text-amber-900 leading-relaxed">
                        <strong className="block text-amber-950 font-bold mb-0.5">
                          How Home Page Display Works:
                        </strong>
                        The Home Page features <strong>8 collection cards</strong> followed by the automatic 9th card: <em>&quot;Explore Our All Collections&quot;</em>. You can arrange the exact order of these 8 cards below:
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {/* Selected for Home List */}
                        <div className="border border-[#cbd5e1] rounded-[3px] bg-white p-3 space-y-2">
                          <div className="flex items-center justify-between pb-2 border-b border-[#e2e8f0]">
                            <span className="font-bold text-[#0F2E52] text-xs flex items-center space-x-1.5">
                              <span className="w-2 h-2 rounded-full bg-emerald-500" />
                              <span>Active Home Showcase (Slots 1 to 8)</span>
                            </span>
                            <span className="text-[11px] text-slate-500 font-mono">
                              {editableCollections.filter((c) => c.showOnHome).length} of 8 slots filled
                            </span>
                          </div>

                          <div className="space-y-2">
                            {editableCollections
                              .filter((c) => c.showOnHome === true)
                              .sort((a, b) => (a.homeOrder ?? a.order ?? 999) - (b.homeOrder ?? b.order ?? 999))
                              .map((cat, homeIdx) => (
                                <div
                                  key={cat.id}
                                  className="flex items-center justify-between p-2 rounded border border-slate-200 bg-slate-50/60 hover:bg-slate-50"
                                >
                                  <div className="flex items-center space-x-2.5">
                                    <span className="w-6 h-6 rounded-full bg-[#0F2E52] text-white flex items-center justify-center font-mono font-bold text-[11px] shrink-0">
                                      {homeIdx + 1}
                                    </span>
                                    <div className="w-8 h-8 rounded bg-slate-100 border border-slate-200 overflow-hidden shrink-0">
                                      <img
                                        src={normalizeImageUrl(cat.coverImage)}
                                        alt={cat.title}
                                        className="w-full h-full object-cover"
                                      />
                                    </div>
                                    <div>
                                      <span className="font-bold text-xs text-[#0F2E52] block leading-tight">
                                        {cat.title}
                                      </span>
                                      <span className="text-[10px] text-slate-500 font-mono">
                                        Slot #{homeIdx + 1} on Home
                                      </span>
                                    </div>
                                  </div>

                                  <div className="flex items-center space-x-1">
                                    <button
                                      type="button"
                                      onClick={() => handleMoveHomeCollection(homeIdx, 'up')}
                                      disabled={homeIdx === 0}
                                      className="p-1 text-slate-600 hover:text-[#0F2E52] disabled:opacity-20 cursor-pointer"
                                      title="Move up on Home"
                                    >
                                      <ArrowUp className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleMoveHomeCollection(homeIdx, 'down')}
                                      disabled={
                                        homeIdx ===
                                        editableCollections.filter((c) => c.showOnHome === true).length - 1
                                      }
                                      className="p-1 text-slate-600 hover:text-[#0F2E52] disabled:opacity-20 cursor-pointer"
                                      title="Move down on Home"
                                    >
                                      <ArrowDown className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleHomeToggle(cat.id)}
                                      className="text-slate-400 hover:text-red-600 p-1 text-[11px] cursor-pointer ml-1"
                                      title="Remove from Home Showcase"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              ))}

                            {/* Slot 9 Preview */}
                            <div className="p-2.5 rounded border border-dashed border-[#0F2E52]/40 bg-[#0F2E52]/5 text-[#0F2E52] flex items-center justify-between">
                              <div className="flex items-center space-x-2.5">
                                <span className="w-6 h-6 rounded-full bg-[#0F2E52]/20 text-[#0F2E52] flex items-center justify-center font-mono font-bold text-[11px]">
                                  9
                                </span>
                                <div>
                                  <span className="font-bold text-xs block leading-tight">
                                    Explore Our All Collections (Auto Card)
                                  </span>
                                  <span className="text-[10px] text-[#0F2E52]/80">
                                    Links directly to complete collections catalog
                                  </span>
                                </div>
                              </div>
                              <span className="text-[10px] bg-white px-2 py-0.5 rounded font-mono border border-[#0F2E52]/30">
                                Automatic
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Other Collections Available to Add */}
                        <div className="border border-[#cbd5e1] rounded-[3px] bg-white p-3 space-y-2">
                          <div className="flex items-center justify-between pb-2 border-b border-[#e2e8f0]">
                            <span className="font-bold text-[#0F2E52] text-xs">
                              Other Available Collections
                            </span>
                            <span className="text-[11px] text-slate-500">
                              Click &quot;+ Feature on Home&quot; to add
                            </span>
                          </div>

                          <div className="space-y-1.5 max-h-[360px] overflow-y-auto">
                            {editableCollections
                              .filter((c) => !c.showOnHome)
                              .map((cat) => (
                                <div
                                  key={cat.id}
                                  className="flex items-center justify-between p-2 rounded border border-slate-200 bg-white hover:bg-slate-50"
                                >
                                  <div className="flex items-center space-x-2">
                                    <div className="w-7 h-7 rounded bg-slate-100 overflow-hidden shrink-0">
                                      <img
                                        src={normalizeImageUrl(cat.coverImage)}
                                        alt={cat.title}
                                        className="w-full h-full object-cover"
                                      />
                                    </div>
                                    <span className="font-medium text-xs text-slate-800">
                                      {cat.title}
                                    </span>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => handleHomeToggle(cat.id)}
                                    className="px-2 py-1 text-[11px] bg-[#0F2E52] hover:bg-[#1e3a5f] text-white font-semibold rounded cursor-pointer transition-colors"
                                  >
                                    + Feature on Home
                                  </button>
                                </div>
                              ))}

                            {editableCollections.filter((c) => !c.showOnHome).length === 0 && (
                              <p className="text-center text-xs text-slate-500 py-6">
                                All collections are currently featured on the Home Page!
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SUB-VIEW 3: GOOGLE SHEET INSTRUCTIONS */}
                  {orderSubTab === 'guide' && (
                    <div className="space-y-4 bg-white p-4 border border-[#cbd5e1] rounded-[3px]">
                      <div className="flex items-center justify-between border-b border-[#e2e8f0] pb-2">
                        <span className="font-bold text-[#0F2E52] text-sm">
                          How to Set Collection Order Directly in Google Sheets
                        </span>
                        <button
                          type="button"
                          onClick={handleCopyOrderTSV}
                          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-semibold flex items-center space-x-1.5 cursor-pointer shadow-2xs"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>{copiedOrderSuccess ? 'Copied!' : 'Copy Template Table'}</span>
                        </button>
                      </div>

                      <div className="space-y-2 text-xs text-[#515f74] leading-relaxed">
                        <p>
                          You can control all collection ordering permanently in your connected Google Sheet. Follow these simple steps:
                        </p>
                        <ol className="list-decimal pl-5 space-y-2 text-slate-700">
                          <li>
                            Open your Google Sheet and switch to the <strong>Collections</strong> (or <strong>Categories</strong>) tab.
                          </li>
                          <li>
                            Add a column with header <strong><code>order</code></strong> (or <code>collection_order</code>). Write numbers like <code>1</code>, <code>2</code>, <code>3</code>, <code>4</code>... This sets the exact display order on the <strong>Collections</strong> page.
                          </li>
                          <li>
                            Add a column with header <strong><code>home</code></strong> (or <code>show_on_home</code>). Write <strong><code>TRUE</code></strong> or <strong><code>YES</code></strong> for the 8 collections you want featured on the <strong>Home Page</strong>.
                          </li>
                          <li>
                            <em>(Optional)</em> Add a column with header <strong><code>home_order</code></strong> (with numbers <code>1</code> to <code>8</code>) if you want the Home Page order to be different from the Collections page order.
                          </li>
                          <li>
                            Come back to this Sheet Management window, open the <strong>Website CMS &amp; Catalog Sync</strong> tab, and click <strong>&quot;Sync Now&quot;</strong>. The website will load your exact ordering!
                          </li>
                        </ol>
                      </div>

                      {/* Visual Table Columns Preview */}
                      <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded font-mono text-[11px] overflow-x-auto">
                        <div className="font-bold text-[#0F2E52] mb-1">
                          Preview of Google Sheet Columns:
                        </div>
                        <table className="w-full text-left border-collapse text-[10.5px]">
                          <thead>
                            <tr className="bg-slate-200 text-slate-800 font-bold">
                              <th className="p-1.5 border border-slate-300">category</th>
                              <th className="p-1.5 border border-slate-300">title</th>
                              <th className="p-1.5 border border-slate-300">order</th>
                              <th className="p-1.5 border border-slate-300">home</th>
                              <th className="p-1.5 border border-slate-300">home_order</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              <td className="p-1.5 border border-slate-300">one-piece</td>
                              <td className="p-1.5 border border-slate-300">One Piece Closets</td>
                              <td className="p-1.5 border border-slate-300 font-bold text-blue-700">1</td>
                              <td className="p-1.5 border border-slate-300 font-bold text-emerald-700">TRUE</td>
                              <td className="p-1.5 border border-slate-300 font-bold text-amber-700">1</td>
                            </tr>
                            <tr>
                              <td className="p-1.5 border border-slate-300">wall-hung</td>
                              <td className="p-1.5 border border-slate-300">Wall Hung Closets</td>
                              <td className="p-1.5 border border-slate-300 font-bold text-blue-700">2</td>
                              <td className="p-1.5 border border-slate-300 font-bold text-emerald-700">TRUE</td>
                              <td className="p-1.5 border border-slate-300 font-bold text-amber-700">2</td>
                            </tr>
                            <tr>
                              <td className="p-1.5 border border-slate-300">floor-mount</td>
                              <td className="p-1.5 border border-slate-300">Water Closets &amp; Floor Mounts</td>
                              <td className="p-1.5 border border-slate-300 font-bold text-blue-700">3</td>
                              <td className="p-1.5 border border-slate-300 font-bold text-emerald-700">TRUE</td>
                              <td className="p-1.5 border border-slate-300 font-bold text-amber-700">3</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: WEBSITE CMS & CATALOG SYNC */}
              {activeTab === 'cms' && (
                <div className="space-y-4">
                  {/* Current Connection Status Box */}
                  <div className="p-4 rounded-[3px] border border-[#cbd5e1] bg-[#f8fafc] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-[#0F2E52] text-sm">
                          {sheetId ? 'Connected to Google Sheet' : 'No Google Sheet Connected'}
                        </span>
                        {sheetId && (
                          <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 rounded font-mono font-bold">
                            LIVE SYNC
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#64748b] mt-0.5">
                        {sheetId ? (
                          <>
                            Sheet ID: <code className="bg-white px-1 py-0.5 rounded border border-slate-200">{sheetId}</code>
                            {lastSyncTime && ` • Last synced: ${lastSyncTime}`}
                          </>
                        ) : (
                          'Connect your Google Sheet to manage all catalog models, cover images, address, and credentials in real time.'
                        )}
                      </p>
                    </div>

                    <div className="flex items-center space-x-2">
                      {sheetId ? (
                        <>
                          <button
                            type="button"
                            onClick={handleRefresh}
                            disabled={isSyncing}
                            className="px-3 py-1.5 bg-[#0F2E52] hover:bg-[#1e3a5f] disabled:opacity-50 text-white font-semibold rounded-[3px] transition-colors flex items-center space-x-1.5 cursor-pointer shadow-2xs"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                            <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
                          </button>
                          <a
                            href={`https://docs.google.com/spreadsheets/d/${sheetId}/edit`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 bg-white border border-[#cbd5e1] hover:bg-slate-50 text-[#0F2E52] font-semibold rounded-[3px] transition-colors flex items-center space-x-1 cursor-pointer"
                          >
                            <span>Open Sheet</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                          <button
                            type="button"
                            onClick={handleDisconnect}
                            className="px-2.5 py-1.5 text-red-600 hover:bg-red-50 border border-red-200 rounded-[3px] transition-colors flex items-center space-x-1 cursor-pointer"
                            title="Disconnect Sheet"
                          >
                            <Unlink className="w-3.5 h-3.5" />
                            <span>Disconnect</span>
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>

                  {/* Connect / Change Sheet Form */}
                  <form onSubmit={handleConnect} className="space-y-3 bg-white p-4 border border-[#e2e8f0] rounded-[3px]">
                    <label className="block font-bold text-[#0F2E52]">
                      {sheetId ? 'Replace with Another Google Sheet URL or ID:' : 'Connect New Google Sheet:'}
                    </label>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        placeholder="https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/edit..."
                        value={inputUrl}
                        onChange={(e) => setInputUrl(e.target.value)}
                        className="flex-1 px-3 py-2 bg-white border border-[#cbd5e1] rounded-[3px] text-xs text-[#0F172A] focus:outline-none focus:border-[#0F2E52]"
                      />
                      <button
                        type="submit"
                        disabled={isSyncing || !inputUrl.trim()}
                        className="px-4 py-2 bg-[#0F2E52] hover:bg-[#1e3a5f] disabled:opacity-50 text-white font-semibold rounded-[3px] transition-colors flex items-center justify-center space-x-1.5 cursor-pointer shadow-xs"
                      >
                        <Link2 className="w-3.5 h-3.5" />
                        <span>{isSyncing ? 'Connecting...' : 'Connect Sheet'}</span>
                      </button>
                    </div>
                  </form>

                  {/* Manual Credentials Override / Direct Update */}
                  <form onSubmit={handleUpdateCredentials} className="bg-white p-4 border border-[#e2e8f0] rounded-[3px] space-y-3">
                    <div className="flex items-center space-x-2">
                      <KeyRound className="w-4 h-4 text-[#0F2E52]" />
                      <label className="font-bold text-[#0F2E52]">
                        System User ID &amp; Password Settings
                      </label>
                    </div>
                    <p className="text-[11px] text-[#64748b]">
                      You can write these directly in the <strong>Admin</strong> tab of your Google Sheet, or override them manually below.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">User ID</label>
                        <input
                          type="text"
                          required
                          placeholder=""
                          value={customUserIdInput}
                          onChange={(e) => setCustomUserIdInput(e.target.value)}
                          className="w-full px-3 py-1.5 bg-white border border-[#cbd5e1] rounded-[3px] text-xs text-[#0F172A] focus:outline-none focus:border-[#0F2E52]"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">New Password</label>
                        <input
                          type="text"
                          required
                          placeholder="Enter new password..."
                          value={customPasswordInput}
                          onChange={(e) => setCustomPasswordInput(e.target.value)}
                          className="w-full px-3 py-1.5 bg-white border border-[#cbd5e1] rounded-[3px] text-xs text-[#0F172A] focus:outline-none focus:border-[#0F2E52]"
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <button
                        type="submit"
                        className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-[3px] cursor-pointer"
                      >
                        Save Credentials
                      </button>
                      {credentialChangeStatus && (
                        <p className="text-emerald-700 text-[11px] font-medium">{credentialChangeStatus}</p>
                      )}
                    </div>
                  </form>

                  {/* Expected Tab Names Guide */}
                  <div className="border-t border-[#e2e8f0] pt-4 space-y-3">
                    <span className="font-bold text-[#0F2E52] block text-[11px] uppercase tracking-wider">
                      Expected Tab Names in your Sheet:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                      <div className="p-2.5 border border-[#e2e8f0] rounded bg-white space-y-1.5">
                        <strong className="text-[#0F2E52] block">1. Products (Subpages &amp; Technical Specs)</strong>
                        <p className="text-[#515f74]">
                          <strong>Category:</strong> <code>category</code> sets the subpage (e.g. <code>table-top</code>, <code>one-piece</code>, <code>wall-hung</code>, <code>pedestal</code>, <code>urinal</code>).
                        </p>
                        <p className="text-[#515f74]">
                          <strong>Dimensions:</strong> Add column <code>dimensions</code> or <code>size</code>. Supports both <strong>Inch</strong> (e.g. <code>16&quot; X 16&quot; X 6&quot; Inch</code>, <code>14 x 14 Inch</code>) and <strong>MM</strong> (e.g. <code>520 X 355 X 340 MM</code>), or separate columns <code>length</code>, <code>width</code>, <code>height</code>.
                        </p>
                        <p className="text-[#515f74]">
                          <strong>Trap:</strong> Add column <code>trap</code> or <code>traptype</code> (e.g. <code>S-Trap 220mm</code>, <code>P-Trap 180mm</code>). If left blank or empty, the <strong>Trap option is completely removed</strong> from that product card!
                        </p>
                      </div>
                      <div className="p-2.5 border border-[#e2e8f0] rounded bg-white space-y-1">
                        <strong className="text-[#0F2E52] block">2. CompanyInfo &amp; Map</strong>
                        <p className="text-[#515f74]">
                          Key/value pairs: <code>factory_address</code>, <code>primary_phone</code>, <code>google_maps_embed_url</code>, and <code>google_maps_url</code>.
                        </p>
                      </div>
                      <div className="p-2.5 border border-[#e2e8f0] rounded bg-white space-y-1">
                        <strong className="text-[#0F2E52] block">3. SiteMedia &amp; Thumbnails</strong>
                        <p className="text-[#515f74]">
                          Keys: <code>logo</code>, <code>logo_symbol</code> (Google Search &amp; Tab Favicon), <code>logo_stacked</code>, <code>tunnel_kiln</code>, <code>dispatch_loading</code>, plus collection covers.
                        </p>
                      </div>
                      <div className="p-2.5 border border-[#e2e8f0] rounded bg-white space-y-1">
                        <strong className="text-[#0F2E52] block">4. Collections / Categories (All Collections &amp; Home 8 Grid)</strong>
                        <p className="text-[#515f74]">
                          Tab name: <code>Collections</code>. Add as many collections as you need (9, 12, 15+). All of them appear on the <strong>Collections</strong> page!
                        </p>
                        <p className="text-[#515f74] text-[11px]">
                          <strong>Columns:</strong> <code>category</code> (e.g. <code>one-piece</code>, <code>wall-hung</code>, or any new collection name), <code>title</code>, <code>short_label</code> (name on View button), <code>subtitle</code>, <code>image_url</code>, <code>tag_badge</code>, <code>related_collection</code>, plus optional SEO columns: <code>seo_title</code>, <code>seo_description</code>, and <code>seo_keywords</code>.
                        </p>
                        <div className="text-emerald-800 bg-emerald-50 p-2 rounded text-[11px] space-y-1.5">
                          <p>
                            <strong>Choose 8 for Home Tab &amp; Order:</strong> Add column <code>home</code> (write <code>TRUE</code> or <code>YES</code> for your preferred 8 collections) and column <code>order</code> (1, 2, 3...) or <code>home_order</code> (1 to 8).
                          </p>
                          <button
                            type="button"
                            onClick={() => setActiveTab('order')}
                            className="inline-flex items-center space-x-1 text-[#0F2E52] hover:text-[#1e3a5f] font-bold text-[10.5px] bg-white px-2 py-1 rounded border border-emerald-300 shadow-2xs cursor-pointer transition-colors"
                          >
                            <ListOrdered className="w-3.5 h-3.5 text-amber-600" />
                            <span>Rearrange in Collection Ordering Tab →</span>
                          </button>
                        </div>
                      </div>
                      <div className="p-2.5 border border-emerald-200 bg-emerald-50/50 rounded space-y-1">
                        <strong className="text-[#0F2E52] flex items-center space-x-1.5">
                          <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                          <span>5. Admin (User ID &amp; Password)</span>
                        </strong>
                        <p className="text-[#515f74]">
                          Tab name: <code>Admin</code>. Column headers: <code>userId</code> and <code>password</code>. When synced, these two values are required to authenticate and open Sheet Management!
                        </p>
                      </div>
                      <div className="p-2.5 border border-cyan-200 bg-cyan-50/50 rounded space-y-1">
                        <strong className="text-[#0F2E52] flex items-center space-x-1.5">
                          <ShieldCheck className="w-3.5 h-3.5 text-cyan-700" />
                          <span>6. Legal &amp; Policies (Privacy &amp; Terms)</span>
                        </strong>
                        <p className="text-[#515f74]">
                          Tab name: <code>Legal</code> (or separate tabs <code>Privacy</code> and <code>Terms</code>). Columns: <code>Heading</code> (or Title) and <code>Detail</code> (or Body/Content), plus optional <code>Type</code> (Privacy or Terms). Each row creates a clean numbered heading with its detail text!
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: COLLECTION SEO & DYNAMIC HEAD TAGS CMS */}
              {activeTab === 'seo' && (
                <div className="space-y-5">
                  {/* Banner explaining SEO importance and immediate impact */}
                  <div className="bg-[#0F2E52] text-white p-4 sm:p-5 rounded-[4px] shadow-xs space-y-2">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center space-x-2">
                        <Globe className="w-5 h-5 text-sky-400 shrink-0" />
                        <h4 className="font-display font-bold text-sm sm:text-base">
                          Collection SEO &amp; Head Tags Manager (Restricted CMS)
                        </h4>
                      </div>
                      <span className="text-[10px] font-mono uppercase tracking-wider bg-white/10 px-2 py-0.5 rounded text-sky-200">
                        Live Head Tags
                      </span>
                    </div>
                    <p className="text-xs text-slate-200 leading-relaxed max-w-3xl">
                      Customize search engine titles (<code>&lt;title&gt;</code>), descriptions, keywords, OpenGraph tags, and Schema.org rich snippets for each sanitaryware collection. Search engines (Google/Bing) and chat platforms (WhatsApp/LinkedIn) use these tags when indexing or sharing links.
                    </p>
                  </div>

                  {/* Collection Selector Carousel / Horizontal list */}
                  <div className="bg-white border border-[#cbd5e1] p-3 sm:p-4 rounded-[4px] space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-[#0F2E52]">
                        Select Collection to Configure ({categoriesList.length} Total):
                      </label>
                      <span className="text-[10px] text-[#64748b]">
                        Click any collection to edit its SEO tags
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1 bg-[#f8fafc] border border-[#e2e8f0] rounded">
                      {categoriesList.map((cat) => {
                        const isSelected = cat.id === selectedSeoCatId;
                        const hasCustom = Boolean(collectionSeoMap[cat.id]);
                        const hasSheet = Boolean(cat.seoTitle || cat.seoDescription);
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => setSelectedSeoCatId(cat.id)}
                            className={`px-2.5 py-1 text-xs font-semibold rounded-[3px] transition-all cursor-pointer border flex items-center space-x-1.5 ${
                              isSelected
                                ? 'bg-[#0F2E52] text-white border-[#0F2E52] shadow-xs'
                                : 'bg-white text-[#334155] border-[#cbd5e1] hover:bg-slate-100'
                            }`}
                          >
                            <span>{cat.shortLabel || cat.title}</span>
                            {hasCustom ? (
                              <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-sky-300' : 'bg-sky-600'}`} title="Custom CMS override active" />
                            ) : hasSheet ? (
                              <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-emerald-300' : 'bg-emerald-600'}`} title="From Google Sheet" />
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Form & Live Previews Grid */}
                  {selectedCategoryMeta && (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                      
                      {/* Left Column: Form Fields */}
                      <form onSubmit={handleSaveSeo} className="lg:col-span-7 bg-white border border-[#cbd5e1] p-4 sm:p-5 rounded-[4px] space-y-4 shadow-2xs">
                        
                        <div className="flex items-center justify-between pb-3 border-b border-[#e2e8f0]">
                          <div>
                            <span className="text-[10px] font-mono uppercase text-[#64748b]">
                              Configuring Collection
                            </span>
                            <h5 className="font-display font-bold text-base text-[#0F2E52]">
                              {selectedCategoryMeta.title}
                            </h5>
                          </div>
                          <button
                            type="button"
                            onClick={handleApplyRecommendedSeo}
                            className="text-xs font-bold text-[#0F2E52] hover:text-[#1e3a5f] bg-[#f0f9ff] hover:bg-[#e0f2fe] border border-sky-200 px-2.5 py-1 rounded-[3px] flex items-center space-x-1 transition-colors cursor-pointer"
                            title="Automatically generate high-ranking B2B sanitaryware SEO copy"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-sky-600" />
                            <span>Auto-Fill B2B SEO</span>
                          </button>
                        </div>

                        {seoSaveStatus && (
                          <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-[3px] flex items-center space-x-2 text-xs">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>{seoSaveStatus}</span>
                          </div>
                        )}

                        {/* 1. Page Title */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <label className="text-[11px] font-bold uppercase tracking-wider text-[#334155]">
                              Page Title &lt;title&gt; *
                            </label>
                            <span className={`text-[10px] font-mono ${
                              seoTitleInput.length >= 30 && seoTitleInput.length <= 60
                                ? 'text-emerald-700 font-semibold'
                                : seoTitleInput.length > 60
                                ? 'text-amber-700 font-semibold'
                                : 'text-[#64748b]'
                            }`}>
                              {seoTitleInput.length} / 60 chars {seoTitleInput.length >= 30 && seoTitleInput.length <= 60 ? '• Optimal' : seoTitleInput.length > 60 ? '• Truncated' : ''}
                            </span>
                          </div>
                          <input
                            type="text"
                            required
                            value={seoTitleInput}
                            onChange={(e) => setSeoTitleInput(e.target.value)}
                            placeholder="e.g. One Piece Closets Manufacturer & B2B Wholesale | Hightone Ceramic"
                            className="w-full px-3 py-2 bg-white border border-[#cbd5e1] rounded-[3px] text-xs text-[#0F172A] focus:outline-none focus:border-[#0F2E52]"
                          />
                          <p className="text-[10px] text-[#64748b]">
                            Shown as the main blue link in Google search results and browser tab. Recommended: 30–60 characters.
                          </p>
                        </div>

                        {/* 2. Meta Description */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <label className="text-[11px] font-bold uppercase tracking-wider text-[#334155]">
                              Meta Description &lt;meta name=&quot;description&quot;&gt; *
                            </label>
                            <span className={`text-[10px] font-mono ${
                              seoDescInput.length >= 120 && seoDescInput.length <= 160
                                ? 'text-emerald-700 font-semibold'
                                : seoDescInput.length > 160
                                ? 'text-amber-700 font-semibold'
                                : 'text-[#64748b]'
                            }`}>
                              {seoDescInput.length} / 160 chars {seoDescInput.length >= 120 && seoDescInput.length <= 160 ? '• Optimal' : seoDescInput.length > 160 ? '• Truncated' : ''}
                            </span>
                          </div>
                          <textarea
                            rows={3}
                            required
                            value={seoDescInput}
                            onChange={(e) => setSeoDescInput(e.target.value)}
                            placeholder="e.g. Direct manufacturer of vitrified ceramic one piece closets in Thangadh, Gujarat..."
                            className="w-full px-3 py-2 bg-white border border-[#cbd5e1] rounded-[3px] text-xs text-[#0F172A] focus:outline-none focus:border-[#0F2E52]"
                          />
                          <p className="text-[10px] text-[#64748b]">
                            The black snippet text displayed beneath the title in search engines and WhatsApp link previews. Recommended: 120–160 characters.
                          </p>
                        </div>

                        {/* 3. Keywords */}
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <label className="text-[11px] font-bold uppercase tracking-wider text-[#334155]">
                              Target Keywords &lt;meta name=&quot;keywords&quot;&gt;
                            </label>
                            <span className="text-[10px] text-[#64748b]">Comma-separated</span>
                          </div>
                          <input
                            type="text"
                            value={seoKeywordsInput}
                            onChange={(e) => setSeoKeywordsInput(e.target.value)}
                            placeholder="one piece closet, ceramic water closet, sanitaryware manufacturer thangadh, b2b sanitaryware"
                            className="w-full px-3 py-2 bg-white border border-[#cbd5e1] rounded-[3px] text-xs text-[#0F172A] focus:outline-none focus:border-[#0F2E52]"
                          />
                        </div>

                        {/* Action Buttons */}
                        <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-[#e2e8f0]">
                          <button
                            type="submit"
                            className="px-4 py-2 bg-[#0F2E52] hover:bg-[#1e3a5f] text-white font-bold rounded-[3px] transition-colors flex items-center space-x-1.5 cursor-pointer shadow-xs"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Save &amp; Activate SEO</span>
                          </button>

                          <button
                            type="button"
                            onClick={handleResetSeo}
                            className="px-3 py-1.5 text-xs text-[#64748b] hover:text-[#0F2E52] hover:bg-slate-100 rounded-[3px] border border-slate-200 transition-colors flex items-center space-x-1 cursor-pointer"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Reset to Defaults</span>
                          </button>
                        </div>
                      </form>

                      {/* Right Column: Live SERP & Social Previews */}
                      <div className="lg:col-span-5 space-y-4">
                        
                        {/* 1. Google SERP Preview */}
                        <div className="bg-white border border-[#cbd5e1] rounded-[4px] p-3.5 sm:p-4 shadow-2xs space-y-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748b] flex items-center space-x-1">
                            <span>Google Search Snippet Preview</span>
                          </span>
                          <div className="p-3 bg-white border border-slate-200 rounded font-sans space-y-1">
                            <div className="flex items-center space-x-1.5 text-[11px] text-[#202124] truncate">
                              {siteMedia?.logo_symbol ? (
                                <img
                                  src={siteMedia.logo_symbol}
                                  alt="Google Favicon"
                                  className="w-4 h-4 rounded-full object-contain bg-white border border-slate-200 shadow-2xs"
                                />
                              ) : (
                                <img
                                  src="/favicon.png"
                                  alt="Google Favicon"
                                  className="w-4 h-4 rounded-full object-contain bg-white border border-slate-200 shadow-2xs"
                                />
                              )}
                              <span className="text-[#202124] font-medium">hightoneceramic.com</span>
                              <span className="text-[#5f6368]">› collections › {selectedSeoCatId}</span>
                            </div>
                            <h6 className="text-[15px] text-[#1a0dab] hover:underline font-normal cursor-pointer leading-tight line-clamp-1">
                              {seoTitleInput || 'Untitled Collection'}
                            </h6>
                            <p className="text-[12px] text-[#4d5156] leading-snug line-clamp-2">
                              {seoDescInput || 'No meta description provided. Add description to improve your click-through rate from search engines.'}
                            </p>
                          </div>
                        </div>

                        {/* 2. WhatsApp / Social Share Preview */}
                        <div className="bg-white border border-[#cbd5e1] rounded-[4px] p-3.5 sm:p-4 shadow-2xs space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748b] flex items-center space-x-1">
                              <Share2 className="w-3 h-3 text-emerald-600" />
                              <span>WhatsApp / Social Share Card Preview</span>
                            </span>
                            <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              Auto-Generated Preview
                            </span>
                          </div>

                          <div className="bg-[#e2e8f0]/40 p-3 rounded space-y-2">
                            <div className="bg-white rounded overflow-hidden border border-slate-200 shadow-xs max-w-xs">
                              {selectedCategoryMeta.coverImage && (
                                <div className="aspect-16/9 bg-slate-100 overflow-hidden">
                                  <img
                                    src={normalizeImageUrl(selectedCategoryMeta.coverImage)}
                                    alt={selectedCategoryMeta.title}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              )}
                              <div className="p-2.5 space-y-1 bg-[#f8fafc]">
                                <span className="text-[9px] uppercase font-mono text-[#64748b] block">hightoneceramic.com</span>
                                <div className="font-bold text-[12px] text-[#0F2E52] leading-tight line-clamp-1">
                                  {seoTitleInput || selectedCategoryMeta.title}
                                </div>
                                <div className="text-[10px] text-[#515f74] line-clamp-2 leading-relaxed">
                                  {seoDescInput || selectedCategoryMeta.description}
                                </div>
                              </div>
                            </div>

                            {/* Direct Share & Copy Link Actions */}
                            {(() => {
                              // Always use the official production domain for customer sharing so WhatsApp crawlers aren't blocked by Vercel Preview Protection
                              const origin = 'https://hightoneceramic.com';
                              // Rich social share link routes through /api/share for collection-specific OpenGraph photo
                              const richShareUrl = `${origin}/share/${selectedSeoCatId}`;
                              const directDeepLink = `${origin}/#collections/${selectedSeoCatId}`;
                              return (
                                <div className="space-y-1.5 pt-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <a
                                      href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                                        `*${seoTitleInput || selectedCategoryMeta.title}*\n${seoDescInput || selectedCategoryMeta.description}\n\n👉 View Collection: ${richShareUrl}`
                                      )}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="px-3 py-1.5 bg-[#25D366] hover:bg-[#20ba59] text-white text-[11px] font-bold rounded-[3px] flex items-center space-x-1.5 transition-colors shadow-xs"
                                    >
                                      <MessageSquare className="w-3 h-3" />
                                      <span>Share on WhatsApp</span>
                                    </a>

                                    <button
                                      type="button"
                                      onClick={async () => {
                                        try {
                                          await navigator.clipboard.writeText(richShareUrl);
                                          setCopiedShareLink(true);
                                          setTimeout(() => setCopiedShareLink(false), 2500);
                                        } catch {}
                                      }}
                                      className="px-2.5 py-1.5 bg-white border border-[#cbd5e1] hover:border-[#0F2E52] text-[#0F2E52] text-[11px] font-semibold rounded-[3px] flex items-center space-x-1 transition-colors cursor-pointer"
                                    >
                                      {copiedShareLink ? (
                                        <>
                                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                          <span className="text-emerald-700">Link Copied!</span>
                                        </>
                                      ) : (
                                        <>
                                          <Copy className="w-3 h-3 text-slate-500" />
                                          <span>Copy Link</span>
                                        </>
                                      )}
                                    </button>
                                  </div>
                                  <div className="text-[10px] text-slate-500 font-mono truncate bg-slate-50 border border-slate-200 px-2 py-1 rounded flex items-center justify-between gap-2">
                                    <span className="truncate">
                                      <strong className="text-[#0F2E52]">Share URL: </strong>
                                      {richShareUrl}
                                    </span>
                                    <span className="text-[9px] text-emerald-700 font-semibold uppercase shrink-0 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                      Collection Photo
                                    </span>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>

                          {/* How this works guide */}
                          <div className="bg-[#f1f5f9] border border-slate-200/80 rounded p-2.5 text-[11px] text-slate-600 space-y-1.5 leading-relaxed">
                            <div className="font-semibold text-[#0F2E52] flex items-center gap-1">
                              <Info className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                              <span>How to see &amp; use these snippets:</span>
                            </div>
                            <ul className="list-disc pl-4 space-y-1 text-[10.5px]">
                              <li>
                                <strong>Google Snippet:</strong> Appears on Google Search results when buyers search for your products. You can verify your live Google index anytime by searching <code className="bg-white px-1 py-0.5 rounded border border-slate-300">site:hightoneceramic.com</code> on Google.
                              </li>
                              <li>
                                <strong>WhatsApp Card:</strong> Uses your official domain <code className="bg-white px-1 py-0.5 rounded border border-slate-300 font-semibold text-[#0F2E52]">hightoneceramic.com</code>. WhatsApp automatically displays the photo, brand title, and product catalog details for your recipient!
                              </li>
                              <li className="text-amber-800 bg-amber-50/80 p-1.5 rounded border border-amber-200 text-[10px] list-none -ml-2">
                                <strong>⚠️ Note on Vercel Preview Links:</strong> Temporary preview links like <code>*.vercel.app</code> have Vercel password protection enabled by default (which shows a black triangle &ldquo;Protected Deployment&rdquo;). Always share via <code className="font-semibold">hightoneceramic.com</code> for public WhatsApp previews.
                              </li>
                            </ul>
                          </div>
                        </div>

                        {/* 3. Google Sheet Column Tip */}
                        <div className="p-3 bg-amber-50/70 border border-amber-200 rounded text-[11px] text-[#515f74] space-y-1">
                          <strong className="text-[#0F2E52] block">Optional Cloud Sync in Google Sheet:</strong>
                          <p>
                            You can also define these columns in your <code>Collections</code> sheet tab: <code>seo_title</code>, <code>seo_description</code>, and <code>seo_keywords</code>. When present, they sync across devices automatically!
                          </p>
                        </div>

                      </div>

                    </div>
                  )}

                </div>
              )}

              {/* TAB 4: EXECUTIVE INSIGHTS (PRIVATE & CONFIDENTIAL) */}
              {activeTab === 'insights' && (
                <div className="space-y-5">
                  
                  {/* Top Confidentiality Banner */}
                  <div className="bg-[#0F2E52] text-white p-4 sm:p-5 rounded-[4px] shadow-xs space-y-2">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center space-x-2">
                        <TrendingUp className="w-5 h-5 text-emerald-400 shrink-0" />
                        <h4 className="font-display font-bold text-sm sm:text-base">
                          Executive Insights &amp; Private Buyer Demand Intelligence
                        </h4>
                      </div>
                      <span className="text-[10px] font-mono uppercase tracking-wider bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 px-2 py-0.5 rounded">
                        100% Private to Plant Owner
                      </span>
                    </div>
                    <p className="text-xs text-slate-200 leading-relaxed max-w-3xl">
                      This data is <strong>completely private to you</strong>. Ordinary website visitors cannot see any counters, telemetry, or statistics. All metrics are stored securely in your browser and sync with your private Google Sheet without using public cookies.
                    </p>
                  </div>

                  {/* Actions Toolbar */}
                  <div className="bg-white border border-[#cbd5e1] p-3 rounded-[3px] flex flex-wrap items-center justify-between gap-3 shadow-2xs">
                    <div className="flex items-center space-x-2 text-xs font-semibold text-[#0F2E52]">
                      <Activity className="w-4 h-4 text-emerald-600" />
                      <span>Live Buyer Interactions ({insightsSummary.recentEvents.length} Recent Logged)</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setInsightsSummary(getAnalyticsSummary())}
                        className="px-3 py-1.5 bg-[#f8fafc] hover:bg-slate-100 border border-[#cbd5e1] text-[#0F2E52] text-xs font-semibold rounded-[3px] transition-colors flex items-center space-x-1 cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Refresh Metrics</span>
                      </button>

                      <button
                        type="button"
                        onClick={downloadAnalyticsCSV}
                        disabled={insightsSummary.recentEvents.length === 0}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold rounded-[3px] transition-colors flex items-center space-x-1 cursor-pointer shadow-2xs"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Export CSV</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleCopyInsights}
                        disabled={insightsSummary.recentEvents.length === 0}
                        className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-[#cbd5e1] text-[#0F2E52] text-xs font-semibold rounded-[3px] transition-colors flex items-center space-x-1 cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>{copiedInsightsSuccess ? 'Copied to Clipboard!' : 'Copy for Google Sheets'}</span>
                      </button>

                      {insightsSummary.recentEvents.length > 0 && (
                        <button
                          type="button"
                          onClick={handleClearInsights}
                          className="px-2.5 py-1.5 text-xs text-red-600 hover:bg-red-50 border border-red-200 rounded-[3px] transition-colors flex items-center space-x-1 cursor-pointer"
                          title="Clear local visitor insights"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Clear</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 5 KPI Metric Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    {/* 1. Pageviews */}
                    <div className="bg-white border border-[#cbd5e1] p-3.5 rounded-[4px] shadow-2xs space-y-1">
                      <div className="flex items-center justify-between text-[#64748b]">
                        <span className="text-[10px] font-bold uppercase tracking-wider">Page Views</span>
                        <Activity className="w-3.5 h-3.5 text-sky-600" />
                      </div>
                      <div className="font-display font-bold text-xl sm:text-2xl text-[#0F2E52]">
                        {insightsSummary.totalPageViews}
                      </div>
                      <span className="text-[10px] text-[#64748b] block">Total visits</span>
                    </div>

                    {/* 2. Unique Sessions */}
                    <div className="bg-white border border-[#cbd5e1] p-3.5 rounded-[4px] shadow-2xs space-y-1">
                      <div className="flex items-center justify-between text-[#64748b]">
                        <span className="text-[10px] font-bold uppercase tracking-wider">Est. Visitors</span>
                        <Users className="w-3.5 h-3.5 text-indigo-600" />
                      </div>
                      <div className="font-display font-bold text-xl sm:text-2xl text-[#0F2E52]">
                        {insightsSummary.totalUniqueSessions}
                      </div>
                      <span className="text-[10px] text-[#64748b] block">Unique buyer sessions</span>
                    </div>

                    {/* 3. WhatsApp Clicks */}
                    <div className="bg-white border border-emerald-300 bg-emerald-50/20 p-3.5 rounded-[4px] shadow-2xs space-y-1">
                      <div className="flex items-center justify-between text-emerald-800">
                        <span className="text-[10px] font-bold uppercase tracking-wider">WhatsApp Clicks</span>
                        <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                      </div>
                      <div className="font-display font-bold text-xl sm:text-2xl text-emerald-700">
                        {insightsSummary.totalWhatsAppClicks}
                      </div>
                      <span className="text-[10px] text-emerald-800/80 block">Chat pricing inquiries</span>
                    </div>

                    {/* 4. Phone Calls */}
                    <div className="bg-white border border-[#cbd5e1] p-3.5 rounded-[4px] shadow-2xs space-y-1">
                      <div className="flex items-center justify-between text-[#64748b]">
                        <span className="text-[10px] font-bold uppercase tracking-wider">Phone Calls</span>
                        <Phone className="w-3.5 h-3.5 text-amber-600" />
                      </div>
                      <div className="font-display font-bold text-xl sm:text-2xl text-[#0F2E52]">
                        {insightsSummary.totalCallClicks}
                      </div>
                      <span className="text-[10px] text-[#64748b] block">Direct plant dialings</span>
                    </div>

                    {/* 5. Quotes Submitted */}
                    <div className="bg-white border border-[#cbd5e1] p-3.5 rounded-[4px] shadow-2xs space-y-1">
                      <div className="flex items-center justify-between text-[#64748b]">
                        <span className="text-[10px] font-bold uppercase tracking-wider">Quotes Sent</span>
                        <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600" />
                      </div>
                      <div className="font-display font-bold text-xl sm:text-2xl text-[#0F2E52]">
                        {insightsSummary.totalQuoteSubmits}
                      </div>
                      <span className="text-[10px] text-[#64748b] block">B2B Dealership forms</span>
                    </div>
                  </div>

                  {/* Demand Intelligence: Top Collections & Top Products */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* Top Collections */}
                    <div className="bg-white border border-[#cbd5e1] p-4 rounded-[4px] shadow-2xs space-y-3">
                      <div className="flex items-center justify-between border-b border-[#e2e8f0] pb-2">
                        <span className="font-display font-bold text-xs uppercase tracking-wider text-[#0F2E52] flex items-center space-x-1.5">
                          <BarChart3 className="w-4 h-4 text-sky-600" />
                          <span>Most Viewed Collections</span>
                        </span>
                        <span className="text-[10px] text-[#64748b]">Buyer Interest</span>
                      </div>

                      {insightsSummary.topCollections.length === 0 ? (
                        <p className="text-xs text-[#64748b] italic py-4 text-center">
                          No collection views recorded yet. Visitor interactions will appear here automatically.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {insightsSummary.topCollections.map((col, idx) => {
                            const maxVal = insightsSummary.topCollections[0]?.count || 1;
                            const pct = Math.round((col.count / maxVal) * 100);
                            return (
                              <div key={col.name} className="space-y-1">
                                <div className="flex items-center justify-between text-xs font-semibold">
                                  <span className="text-[#0F2E52] truncate">
                                    {idx + 1}. {col.name}
                                  </span>
                                  <span className="text-[#64748b] font-mono text-[11px] shrink-0 ml-2">
                                    {col.count} views
                                  </span>
                                </div>
                                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-[#0F2E52] rounded-full transition-all duration-500"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Top Products Inquired */}
                    <div className="bg-white border border-[#cbd5e1] p-4 rounded-[4px] shadow-2xs space-y-3">
                      <div className="flex items-center justify-between border-b border-[#e2e8f0] pb-2">
                        <span className="font-display font-bold text-xs uppercase tracking-wider text-[#0F2E52] flex items-center space-x-1.5">
                          <MessageSquare className="w-4 h-4 text-emerald-600" />
                          <span>Top Inquired Ceramic Models</span>
                        </span>
                        <span className="text-[10px] text-[#64748b]">WhatsApp Inquiries</span>
                      </div>

                      {insightsSummary.topProducts.length === 0 ? (
                        <p className="text-xs text-[#64748b] italic py-4 text-center">
                          No product WhatsApp inquiries recorded yet. When buyers click WhatsApp on any product card, they rank here.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {insightsSummary.topProducts.map((prod, idx) => (
                            <div
                              key={prod.name}
                              className="flex items-center justify-between p-2 bg-[#f8fafc] border border-slate-200/80 rounded-[3px] text-xs"
                            >
                              <div className="flex items-center space-x-2 truncate">
                                <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold flex items-center justify-center shrink-0">
                                  {idx + 1}
                                </span>
                                <span className="font-semibold text-[#0F2E52] truncate">{prod.name}</span>
                              </div>
                              <span className="text-emerald-700 font-bold font-mono text-[11px] shrink-0 ml-2">
                                {prod.count} clicks
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                  </div>

                  {/* Precision Location Calibration & GPS Accuracy Tool */}
                  <div className="bg-gradient-to-r from-blue-50/90 via-sky-50/70 to-indigo-50/80 border border-blue-200/90 p-4 rounded-[4px] shadow-2xs space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-blue-200/70 pb-3">
                      <div className="flex items-start space-x-2.5">
                        <Crosshair className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="font-display font-bold text-sm text-[#0F2E52]">
                              High-Precision Location & GPS Calibration
                            </span>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold">
                              District & PIN Code Accuracy
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                            Detects exact Municipal City, District (e.g. Surendranagar, Rajkot, Morbi, Pune, Mumbai), and Postal PIN Code via browser GPS or multi-tier network IP.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={handleDetectGPS}
                          disabled={isDetectingGps}
                          className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-[#0F2E52] hover:bg-[#1e3a5f] text-white text-xs font-semibold rounded-[3px] shadow-xs cursor-pointer transition-colors disabled:opacity-60"
                        >
                          <Crosshair className={`w-3.5 h-3.5 ${isDetectingGps ? 'animate-spin' : ''}`} />
                          <span>{isDetectingGps ? 'Calibrating GPS...' : 'Verify Pinpoint GPS Accuracy'}</span>
                        </button>
                      </div>
                    </div>

                    {gpsStatusMessage && (
                      <div
                        className={`p-2.5 rounded-[3px] text-xs font-medium flex items-center space-x-2 ${
                          gpsStatusMessage.type === 'success'
                            ? 'bg-emerald-100/80 text-emerald-800 border border-emerald-300'
                            : gpsStatusMessage.type === 'error'
                            ? 'bg-rose-100/80 text-rose-800 border border-rose-300'
                            : 'bg-amber-100/80 text-amber-800 border border-amber-300'
                        }`}
                      >
                        <Info className="w-4 h-4 shrink-0" />
                        <span>{gpsStatusMessage.text}</span>
                      </div>
                    )}

                    {/* Explanatory Technical Note */}
                    <div className="bg-white/80 border border-blue-100 rounded-[3px] p-3 text-[11px] text-slate-700 leading-relaxed space-y-1">
                      <span className="font-bold text-[#0F2E52] block">
                        Why did cellular data initially show &quot;Maharashtra / India&quot;?
                      </span>
                      <p>
                        In India, major mobile carriers (Reliance Jio, Airtel, Vi) route 4G/5G mobile tower traffic through central submarine cable Internet Exchanges located in Mumbai. An IP-only lookup detects that cellular hub. Clicking <strong>&quot;Verify Pinpoint GPS Accuracy&quot;</strong> or opening on Wi-Fi allows browser coordinates to pin down the exact District, City, and PIN code.
                      </p>
                    </div>
                  </div>

                  {/* Location-Wise Collection Dwell Time & Specific Product Demand Matrix */}
                  <div className="bg-white border border-[#cbd5e1] p-4 rounded-[4px] shadow-2xs space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#e2e8f0] pb-3">
                      <div>
                        <div className="flex items-center space-x-2">
                          <Building2 className="w-4 h-4 text-[#0F2E52] shrink-0" />
                          <span className="font-display font-bold text-xs uppercase tracking-wider text-[#0F2E52]">
                            Location-Wise Collection Dwell Time & Product Demand Matrix
                          </span>
                        </div>
                        <span className="text-[11px] text-[#64748b]">
                          See which specific location spends more time in which sanitaryware collection & which specific models they inspect.
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {/* Location Filter Dropdown */}
                        <div className="flex items-center space-x-1.5">
                          <span className="text-[11px] font-semibold text-slate-500">Filter Center:</span>
                          <select
                            value={selectedLocationFilter}
                            onChange={(e) => setSelectedLocationFilter(e.target.value)}
                            aria-label="Filter insights by location center"
                            className="text-xs bg-slate-50 border border-slate-300 rounded-[3px] px-2 py-1 font-medium text-[#0F2E52] focus:ring-1 focus:ring-[#0F2E52] focus:outline-none"
                          >
                            <option value="all">All Locations ({insightsSummary.locationMarketInsights.length})</option>
                            {insightsSummary.locationMarketInsights.map((item) => (
                              <option key={item.area} value={item.area}>
                                {item.city}{item.district ? ` (${item.district})` : ''}, {item.region}
                              </option>
                            ))}
                          </select>
                        </div>

                        <button
                          type="button"
                          onClick={downloadLocationMarketCSV}
                          disabled={insightsSummary.locationMarketInsights.length === 0}
                          className="inline-flex items-center space-x-1 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-[3px] text-xs font-semibold text-[#0F2E52] transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Export Demand Matrix CSV</span>
                        </button>
                      </div>
                    </div>

                    {insightsSummary.locationMarketInsights.length === 0 ? (
                      <div className="py-8 text-center space-y-2">
                        <Timer className="w-8 h-8 text-slate-400 mx-auto animate-pulse" />
                        <p className="text-xs text-[#64748b] font-medium">
                          Recording location-wise dwell times as buyers browse your collections...
                        </p>
                        <p className="text-[11px] text-[#94a3b8] max-w-lg mx-auto">
                          When visitors from Maharashtra, Gujarat, or other states spend active seconds examining Tabletop Basins, Orissa Pans, or Wall Hung Closets, their center-specific time breakdown will appear right here.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {insightsSummary.locationMarketInsights
                          .filter((item) => selectedLocationFilter === 'all' || item.area === selectedLocationFilter)
                          .map((item, idx) => {
                            return (
                              <div
                                key={item.area}
                                className="border border-slate-200/90 rounded-[4px] p-4 bg-[#f8fafc] space-y-3 hover:border-slate-300 transition-colors"
                              >
                                {/* Center Header */}
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 pb-2.5">
                                  <div className="flex items-center space-x-2">
                                    <span className="w-5 h-5 rounded-full bg-[#0F2E52] text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                                      {idx + 1}
                                    </span>
                                    <div>
                                      <div className="flex items-center space-x-2">
                                        <h4 className="font-bold text-sm text-[#0F2E52]">
                                          {item.city}{item.district && item.district !== item.city ? ` (${item.district})` : ''}
                                        </h4>
                                        <span className="text-xs text-slate-500 font-medium">
                                          {item.region}, {item.country}
                                        </span>
                                        {item.postal && (
                                          <span className="font-mono text-[10px] bg-slate-200/80 px-1.5 py-0.5 rounded text-slate-700 font-bold">
                                            PIN: {item.postal}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  <div className="flex flex-wrap items-center gap-2">
                                    {item.precision === 'gps' ? (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-200">
                                        📍 GPS Pinpoint Verified
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold border border-blue-200">
                                        🌐 Network Gateway IP
                                      </span>
                                    )}

                                    <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 bg-amber-50 border border-amber-200 text-amber-900 rounded text-xs font-bold font-mono">
                                      <Timer className="w-3.5 h-3.5 text-amber-700" />
                                      <span>Total Dwell: {formatDwellTime(item.totalDwellSeconds)}</span>
                                    </span>

                                    <span className="text-xs font-semibold text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded">
                                      {item.totalVisits} {item.totalVisits === 1 ? 'Action' : 'Actions'}
                                    </span>
                                  </div>
                                </div>

                                {/* Two-Column Breakdown: Collections Time Spent vs Specific Products */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                                  {/* Collections Dwell Time */}
                                  <div className="bg-white border border-slate-200 rounded-[3px] p-3 space-y-2">
                                    <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                                      <span className="text-[11px] font-bold uppercase tracking-wider text-[#0F2E52] flex items-center space-x-1.5">
                                        <SlidersHorizontal className="w-3 h-3 text-[#0F2E52]" />
                                        <span>Collections Time Spent</span>
                                      </span>
                                      <span className="text-[10px] font-mono text-slate-500">
                                        {item.collectionTimeSpent.length} Explored
                                      </span>
                                    </div>

                                    {item.collectionTimeSpent.length === 0 ? (
                                      <p className="text-xs text-slate-400 italic py-2">
                                        No individual collections explored yet.
                                      </p>
                                    ) : (
                                      <div className="space-y-1.5">
                                        {item.collectionTimeSpent.map((col, cIdx) => (
                                          <div
                                            key={col.collectionName}
                                            className="flex items-center justify-between p-1.5 bg-slate-50/80 rounded text-xs hover:bg-slate-100/80 transition-colors"
                                          >
                                            <div className="flex items-center space-x-1.5 min-w-0 pr-2">
                                              <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-700 text-[9px] font-bold flex items-center justify-center shrink-0">
                                                {cIdx + 1}
                                              </span>
                                              <span className="font-semibold text-slate-800 truncate">
                                                {col.collectionName}
                                              </span>
                                            </div>
                                            <div className="flex items-center space-x-2 shrink-0">
                                              <span className="text-[10px] text-slate-500 font-mono">
                                                {col.views} {col.views === 1 ? 'view' : 'views'}
                                              </span>
                                              <span className="font-mono font-bold text-xs text-[#0F2E52] bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded">
                                                {formatDwellTime(col.seconds)}
                                              </span>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>

                                  {/* Specific Products Inspected */}
                                  <div className="bg-white border border-slate-200 rounded-[3px] p-3 space-y-2">
                                    <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                                      <span className="text-[11px] font-bold uppercase tracking-wider text-[#0F2E52] flex items-center space-x-1.5">
                                        <ZoomIn className="w-3 h-3 text-[#0F2E52]" />
                                        <span>Specific Products Demanded</span>
                                      </span>
                                      <span className="text-[10px] font-mono text-slate-500">
                                        {item.productTimeSpent.length} Inspected
                                      </span>
                                    </div>

                                    {item.productTimeSpent.length === 0 ? (
                                      <p className="text-xs text-slate-400 italic py-2">
                                        General catalog viewing without specific model zooms.
                                      </p>
                                    ) : (
                                      <div className="space-y-1.5">
                                        {item.productTimeSpent.map((p, pIdx) => (
                                          <div
                                            key={p.productName}
                                            className="flex items-center justify-between p-1.5 bg-slate-50/80 rounded text-xs hover:bg-slate-100/80 transition-colors"
                                          >
                                            <div className="flex items-center space-x-1.5 min-w-0 pr-2">
                                              <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-800 text-[9px] font-bold flex items-center justify-center shrink-0">
                                                {pIdx + 1}
                                              </span>
                                              <span className="font-semibold text-slate-800 truncate">
                                                {p.productName}
                                              </span>
                                            </div>
                                            <div className="flex items-center space-x-2 shrink-0">
                                              <span className="text-[10px] text-slate-500 font-mono">
                                                {p.views} {p.views === 1 ? 'view' : 'views'}
                                              </span>
                                              <span className="font-mono font-bold text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded">
                                                {formatDwellTime(p.seconds)}
                                              </span>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Conversions & Actionable Sales Recommendation */}
                                <div className="bg-amber-50/60 border border-amber-200/70 p-2.5 rounded-[3px] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                                  <div className="flex items-start space-x-2">
                                    <Sparkles className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                                    <div>
                                      <span className="font-bold text-[#0F2E52] block">
                                        Commercial Sales Insight for {item.city}:
                                      </span>
                                      <p className="text-slate-700 text-[11px] leading-relaxed">
                                        {item.commercialTakeaway}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="flex items-center space-x-2 shrink-0 pt-1 sm:pt-0">
                                    {item.whatsappClicks > 0 && (
                                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[10px] font-bold">
                                        {item.whatsappClicks} WhatsApp
                                      </span>
                                    )}
                                    {item.callClicks > 0 && (
                                      <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded text-[10px] font-bold">
                                        {item.callClicks} Calls
                                      </span>
                                    )}
                                    {item.quoteSubmits > 0 && (
                                      <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-[10px] font-bold">
                                        {item.quoteSubmits} Quotes
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </div>

                  {/* Visitor Geographic Reach Overview Cards */}
                  <div className="bg-white border border-[#cbd5e1] p-4 rounded-[4px] shadow-2xs space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e2e8f0] pb-2">
                      <div className="flex items-center space-x-2">
                        <MapPin className="w-4 h-4 text-rose-600 shrink-0" />
                        <div>
                          <span className="font-display font-bold text-xs uppercase tracking-wider text-[#0F2E52] block">
                            Regional Reach & All Detected Centers
                          </span>
                          <span className="text-[10px] text-[#64748b]">
                            Total {insightsSummary.topLocations?.length || 0} regional centers registered
                          </span>
                        </div>
                      </div>
                    </div>

                    {!insightsSummary.topLocations || insightsSummary.topLocations.length === 0 ? (
                      <div className="py-6 text-center space-y-1">
                        <p className="text-xs text-[#64748b] font-medium">
                          Detecting visitor regional areas in the background...
                        </p>
                        <p className="text-[11px] text-[#94a3b8]">
                          When dealers from different cities or states explore your sanitaryware catalog or click WhatsApp, their city & state will automatically appear here.
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
                        {insightsSummary.topLocations.map((loc, idx) => {
                          const maxVal = insightsSummary.topLocations[0]?.count || 1;
                          const pct = Math.round((loc.count / maxVal) * 100);
                          return (
                            <div
                              key={loc.area}
                              className="p-3 bg-[#f8fafc] border border-slate-200/90 rounded-[4px] space-y-2 hover:border-slate-300 transition-colors"
                            >
                              <div className="flex items-start justify-between">
                                <div className="space-y-0.5 min-w-0 pr-2">
                                  <div className="flex items-center space-x-1.5">
                                    <span className="w-4 h-4 rounded-full bg-rose-100 text-rose-800 text-[9px] font-bold flex items-center justify-center shrink-0">
                                      {idx + 1}
                                    </span>
                                    <span className="font-bold text-xs text-[#0F2E52] truncate">
                                      {loc.city || loc.area}
                                    </span>
                                    {loc.precision === 'gps' && (
                                      <span className="text-[9px] bg-emerald-100 text-emerald-800 px-1 py-0.2 rounded font-bold">
                                        GPS
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[10px] font-semibold text-[#8B5E3C] block truncate">
                                    {loc.district && loc.district !== loc.city ? `${loc.district}, ` : ''}{loc.region ? `${loc.region}, ${loc.country || 'India'}` : (loc.country || 'India')}
                                    {loc.postal ? ` • PIN: ${loc.postal}` : ''}
                                  </span>
                                </div>
                                <span className="font-mono text-xs font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-100 shrink-0">
                                  {loc.count} {loc.count === 1 ? 'visit' : 'visits'}
                                </span>
                              </div>
                              <div className="h-1.5 w-full bg-slate-200/80 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-rose-600 rounded-full transition-all duration-500"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Real-time Event Stream Table */}
                  <div className="bg-white border border-[#cbd5e1] rounded-[4px] shadow-2xs overflow-hidden">
                    <div className="p-3 bg-[#f8fafc] border-b border-[#e2e8f0] flex items-center justify-between">
                      <span className="font-bold text-xs text-[#0F2E52] uppercase tracking-wider flex items-center space-x-1.5">
                        <Activity className="w-3.5 h-3.5 text-sky-600" />
                        <span>Recent Visitor Actions Log (Latest {insightsSummary.recentEvents.length})</span>
                      </span>
                      <span className="text-[10px] text-[#64748b] font-mono">
                        IST Timezone
                      </span>
                    </div>

                    {insightsSummary.recentEvents.length === 0 ? (
                      <div className="p-8 text-center text-xs text-[#64748b] italic">
                        No visitor activity logged yet in this session.
                      </div>
                    ) : (
                      <div className="overflow-x-auto max-h-72">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 text-[10px] uppercase font-bold text-[#64748b] border-b border-slate-200">
                            <tr>
                              <th className="py-2 px-3">Time</th>
                              <th className="py-2 px-3">Action Type</th>
                              <th className="py-2 px-3">Target / Item</th>
                              <th className="py-2 px-3">Dwell Time</th>
                              <th className="py-2 px-3">Location (City, District, PIN)</th>
                              <th className="py-2 px-3">Device</th>
                              <th className="py-2 px-3">Details</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {insightsSummary.recentEvents.map((ev) => {
                              const isWhatsApp = ev.type === 'whatsapp_click';
                              const isQuote = ev.type === 'quote_submit';
                              const isCall = ev.type === 'call_click';
                              const isDwell = ev.type === 'collection_dwell' || ev.type === 'product_dwell';
                              const locText = formatLocationString(ev.location);

                              return (
                                <tr key={ev.id} className="hover:bg-slate-50/80 transition-colors">
                                  <td className="py-2 px-3 font-mono text-[11px] text-[#64748b] whitespace-nowrap">
                                    {ev.timestamp}
                                  </td>
                                  <td className="py-2 px-3 whitespace-nowrap">
                                    <span
                                      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                        isWhatsApp
                                          ? 'bg-emerald-100 text-emerald-800'
                                          : isQuote
                                          ? 'bg-blue-100 text-blue-800'
                                          : isCall
                                          ? 'bg-amber-100 text-amber-800'
                                          : isDwell
                                          ? 'bg-purple-100 text-purple-800'
                                          : 'bg-slate-100 text-slate-700'
                                      }`}
                                    >
                                      {ev.type.replace('_', ' ')}
                                    </span>
                                  </td>
                                  <td className="py-2 px-3 font-semibold text-[#0F2E52] max-w-xs truncate">
                                    {ev.target || 'General'}
                                  </td>
                                  <td className="py-2 px-3 font-mono text-xs font-bold whitespace-nowrap text-amber-900">
                                    {ev.durationSeconds ? (
                                      <span className="inline-flex items-center space-x-1 bg-amber-50 border border-amber-200/80 px-1.5 py-0.5 rounded">
                                        <Timer className="w-3 h-3 text-amber-700" />
                                        <span>{formatDwellTime(ev.durationSeconds)}</span>
                                      </span>
                                    ) : (
                                      <span className="text-slate-400 font-normal">-</span>
                                    )}
                                  </td>
                                  <td className="py-2 px-3 text-[#0F2E52] whitespace-nowrap">
                                    <div className="flex items-center space-x-1 text-[11px]">
                                      <MapPin className="w-3 h-3 text-rose-500 shrink-0" />
                                      <span className="font-medium text-[#191c1e]">{locText}</span>
                                      {ev.location?.precision === 'gps' && (
                                        <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1 rounded ml-1">
                                          GPS
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="py-2 px-3 text-[#64748b] capitalize whitespace-nowrap">
                                    <div className="flex items-center space-x-1">
                                      {ev.device === 'mobile' ? (
                                        <Smartphone className="w-3 h-3 text-[#64748b]" />
                                      ) : (
                                        <Laptop className="w-3 h-3 text-[#64748b]" />
                                      )}
                                      <span className="text-[11px]">{ev.device || 'Desktop'}</span>
                                    </div>
                                  </td>
                                  <td className="py-2 px-3 text-[#64748b] max-w-sm truncate text-[11px]">
                                    {ev.details || '-'}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* External Private Analytics Configurations (GA4 & Search Console) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* Google Analytics 4 (GA4) Card */}
                    <div className="bg-white border border-[#cbd5e1] p-4 rounded-[4px] shadow-2xs space-y-3">
                      <div className="flex items-center justify-between border-b border-[#e2e8f0] pb-2">
                        <strong className="text-xs font-bold text-[#0F2E52] flex items-center space-x-1.5">
                          <Globe className="w-4 h-4 text-sky-600" />
                          <span>Google Analytics 4 (Private to your Google Account)</span>
                        </strong>
                        <a
                          href="https://analytics.google.com"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-sky-600 hover:underline flex items-center space-x-1"
                        >
                          <span>analytics.google.com</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>

                      <p className="text-[11px] text-[#515f74] leading-relaxed">
                        Want global geographic maps, live active visitors, and traffic sources? Create a free property in Google Analytics. Only <strong>you</strong> can access it by logging into Google.
                      </p>

                      <form onSubmit={handleSaveGA4} className="space-y-2">
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-[#334155]">
                          GA4 Measurement ID (Optional)
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="G-XXXXXXXXXX"
                            value={ga4IdInput}
                            onChange={(e) => setGa4IdInput(e.target.value)}
                            className="flex-1 px-3 py-1.5 bg-white border border-[#cbd5e1] rounded-[3px] text-xs text-[#0F172A] font-mono focus:outline-none focus:border-[#0F2E52]"
                          />
                          <button
                            type="submit"
                            className="px-3 py-1.5 bg-[#0F2E52] hover:bg-[#1e3a5f] text-white text-xs font-bold rounded-[3px] transition-colors cursor-pointer"
                          >
                            Save ID
                          </button>
                        </div>
                      </form>

                      {ga4SaveStatus && (
                        <p className="text-[11px] text-emerald-700 bg-emerald-50 p-1.5 rounded font-medium">
                          {ga4SaveStatus}
                        </p>
                      )}
                    </div>

                    {/* Google Search Console Card */}
                    <div className="bg-white border border-[#cbd5e1] p-4 rounded-[4px] shadow-2xs space-y-3">
                      <div className="flex items-center justify-between border-b border-[#e2e8f0] pb-2">
                        <strong className="text-xs font-bold text-[#0F2E52] flex items-center space-x-1.5">
                          <Search className="w-4 h-4 text-amber-600" />
                          <span>Google Search Console (Keyword Rankings)</span>
                        </strong>
                        <a
                          href="https://search.google.com/search-console"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-amber-700 hover:underline flex items-center space-x-1"
                        >
                          <span>search-console</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>

                      <p className="text-[11px] text-[#515f74] leading-relaxed">
                        To see what actual search terms buyers type into Google (e.g., <em>&quot;one piece closet manufacturer Gujarat&quot;</em>), how many impressions you receive, and your average rank on Google:
                      </p>

                      <div className="p-2.5 bg-amber-50/70 border border-amber-200/80 rounded space-y-1 text-[11px] text-[#515f74]">
                        <p className="font-semibold text-[#0F2E52]">How to verify your private access:</p>
                        <ol className="list-decimal list-inside space-y-0.5 text-[10px]">
                          <li>Visit <code>search.google.com/search-console</code></li>
                          <li>Add your domain: <code>https://hightoneceramic.com</code></li>
                          <li>Verify ownership via HTML tag or DNS record</li>
                        </ol>
                      </div>
                    </div>

                  </div>

                </div>
              )}

              {/* TAB 5: FACTORY PIN & GOOGLE MAPS CONFIGURATION */}
              {activeTab === 'location' && (
                <div className="space-y-5">
                  {/* Informative Banner */}
                  <div className="bg-[#0F2E52] text-white p-4 sm:p-5 rounded-[4px] shadow-xs space-y-2">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center space-x-2">
                        <MapPin className="w-5 h-5 text-rose-400 shrink-0" />
                        <h4 className="font-display font-bold text-sm sm:text-base">
                          Factory Pin &amp; Google Maps Accuracy Manager
                        </h4>
                      </div>
                      <span className="text-[10px] font-mono uppercase tracking-wider bg-white/10 px-2.5 py-0.5 rounded text-rose-200">
                        Thangadh, Gujarat (363530)
                      </span>
                    </div>
                    <p className="text-xs text-slate-200 leading-relaxed max-w-3xl">
                      Accurately pinpoints Hightone Ceramic&apos;s manufacturing plant in the Thangadh industrial cluster. The live map embed below is used in the website footer, About Plant page, and B2B portal. You can adjust the exact pin coordinates, address, and navigation routes below.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                    {/* Left Column: Location & Map Settings Form */}
                    <form onSubmit={handleSaveLocation} className="lg:col-span-7 bg-white border border-[#cbd5e1] p-4 sm:p-5 rounded-[4px] space-y-4 shadow-2xs">
                      <div className="flex items-center justify-between border-b border-[#e2e8f0] pb-2.5">
                        <h5 className="font-display font-bold text-sm text-[#0F2E52] flex items-center space-x-1.5">
                          <MapPin className="w-4 h-4 text-rose-600" />
                          <span>Factory Coordinates &amp; Contact Details</span>
                        </h5>
                        <button
                          type="button"
                          onClick={handleRestoreAccurateLocation}
                          className="text-[11px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2.5 py-1 rounded-[3px] transition-colors cursor-pointer"
                          title="Restore verified Survey No. 195/1 Paiki pin on Vagadiya Road, Thangadh"
                        >
                          Restore Accurate Factory Pin
                        </button>
                      </div>

                      {/* Factory Address */}
                      <div className="space-y-1">
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-[#0F2E52]">
                          Official Factory Street Address
                        </label>
                        <textarea
                          rows={2}
                          value={locAddress}
                          onChange={(e) => setLocAddress(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-[#cbd5e1] rounded-[3px] text-xs text-[#0F172A] focus:outline-none focus:border-[#0F2E52]"
                          placeholder="e.g. Vagadiya Road, Thangadh - 363 530 (Dist. Surendranagar, Gujarat)"
                        />
                        <p className="text-[10px] text-[#64748b]">
                          Displayed in the footer, dealer portal, and quote inquiry emails.
                        </p>
                      </div>

                      {/* Google Maps Embed URL or Iframe Code */}
                      <div className="space-y-1">
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-[#0F2E52]">
                          Google Maps Embed URL or Iframe Code
                        </label>
                        <textarea
                          rows={2}
                          value={locEmbedUrl}
                          onChange={(e) => setLocEmbedUrl(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-[#cbd5e1] rounded-[3px] text-xs text-[#0F172A] font-mono focus:outline-none focus:border-[#0F2E52]"
                          placeholder="https://maps.google.com/maps?q=... or <iframe src='...'></iframe> or coordinates '22.5742, 71.1994'"
                        />
                        <p className="text-[10px] text-[#64748b]">
                          Supports direct embed links (<code>output=embed</code>), full Google Maps <code>&lt;iframe&gt;</code> HTML, or coordinates.
                        </p>
                      </div>

                      {/* Google Maps External / Share Link */}
                      <div className="space-y-1">
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-[#0F2E52]">
                          Direct Google Maps / App Navigation Link
                        </label>
                        <input
                          type="text"
                          value={locMapsUrl}
                          onChange={(e) => setLocMapsUrl(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-[#cbd5e1] rounded-[3px] text-xs text-[#0F172A] font-mono focus:outline-none focus:border-[#0F2E52]"
                          placeholder="https://www.google.com/maps/search/?api=1&query=..."
                        />
                        <p className="text-[10px] text-[#64748b]">
                          Opened when clients tap &quot;Open Maps&quot; on mobile or desktop to navigate to the factory.
                        </p>
                      </div>

                      {/* Phones Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        <div className="space-y-1">
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-[#0F2E52]">
                            Primary Sales Phone (WhatsApp)
                          </label>
                          <input
                            type="text"
                            value={locPhone1}
                            onChange={(e) => setLocPhone1(e.target.value)}
                            className="w-full px-3 py-1.5 bg-white border border-[#cbd5e1] rounded-[3px] text-xs text-[#0F172A] focus:outline-none focus:border-[#0F2E52]"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-[#0F2E52]">
                            Secondary Phone (Optional)
                          </label>
                          <input
                            type="text"
                            value={locPhone2}
                            onChange={(e) => setLocPhone2(e.target.value)}
                            className="w-full px-3 py-1.5 bg-white border border-[#cbd5e1] rounded-[3px] text-xs text-[#0F172A] focus:outline-none focus:border-[#0F2E52]"
                          />
                        </div>
                      </div>

                      {/* Save Status and Button */}
                      <div className="flex items-center justify-between pt-2 border-t border-[#e2e8f0]">
                        <button
                          type="submit"
                          className="px-5 py-2 bg-[#0F2E52] hover:bg-[#1e3a5f] text-white text-xs font-bold rounded-[3px] transition-colors cursor-pointer shadow-xs flex items-center space-x-1.5"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Save &amp; Update Map Live</span>
                        </button>
                        {locSaveStatus && (
                          <span className="text-emerald-700 bg-emerald-50 px-2 py-1 rounded text-[11px] font-semibold animate-fade-in">
                            {locSaveStatus}
                          </span>
                        )}
                      </div>
                    </form>

                    {/* Right Column: Live Map Interactive Preview */}
                    <div className="lg:col-span-5 space-y-4">
                      <div className="bg-white border border-[#cbd5e1] rounded-[4px] p-4 shadow-2xs space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-1.5 text-xs font-bold text-[#0F2E52]">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span>Live Google Map Preview</span>
                          </div>
                          <span className="text-[10px] font-mono text-[#64748b]">
                            Active Rendering
                          </span>
                        </div>

                        {/* Interactive Iframe */}
                        <div className="rounded-[4px] overflow-hidden border border-[#cbd5e1] bg-[#f8fafc] aspect-4/3 relative">
                          <iframe
                            title="Live Hightone Ceramic Map Preview"
                            src={cleanGoogleMapsEmbedUrl(locEmbedUrl) || DEFAULT_COMPANY_INFO.google_maps_embed_url}
                            className="w-full h-full border-0"
                            loading="lazy"
                            referrerPolicy="no-referrer-when-downgrade"
                            allowFullScreen
                          />
                        </div>

                        {/* Interactive Buttons */}
                        <div className="flex items-center justify-between gap-2 pt-1">
                          <a
                            href={locMapsUrl || getGoogleMapsDirectionsUrl({ google_maps_embed_url: locEmbedUrl, google_maps_url: locMapsUrl, factory_address: locAddress })}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 py-1.5 px-2 bg-[#f1f5f9] hover:bg-[#e2e8f0] text-[#0F2E52] font-semibold text-[11px] rounded-[3px] border border-slate-200 flex items-center justify-center space-x-1 transition-colors"
                          >
                            <span>Open on Google Maps</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                          <a
                            href={getGoogleMapsDirectionsUrl({ google_maps_embed_url: locEmbedUrl, google_maps_url: locMapsUrl, factory_address: locAddress })}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 py-1.5 px-2 bg-[#0F2E52] hover:bg-[#1e3a5f] text-white font-semibold text-[11px] rounded-[3px] flex items-center justify-center space-x-1 transition-colors"
                          >
                            <Navigation className="w-3 h-3" />
                            <span>Test Directions</span>
                          </a>
                        </div>
                      </div>

                      {/* Google Sheet Sync Tips */}
                      <div className="bg-[#f8fafc] border border-[#cbd5e1] rounded-[4px] p-3 space-y-1.5 text-[11px]">
                        <strong className="text-[#0F2E52] block font-bold">
                          How to update in your Google Sheet:
                        </strong>
                        <p className="text-[#515f74] leading-relaxed">
                          In your connected Google Sheet, open the <strong>CompanyInfo</strong> tab and set:
                        </p>
                        <div className="bg-white p-2 rounded border border-slate-200 font-mono text-[10px] space-y-1 text-slate-700">
                          <div><strong>factory_address:</strong> {locAddress}</div>
                          <div><strong>google_maps_embed_url:</strong> {cleanGoogleMapsEmbedUrl(locEmbedUrl)}</div>
                          <div><strong>google_maps_url:</strong> {locMapsUrl}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Footer */}
            <div className="bg-[#f8fafc] px-5 py-3 border-t border-[#e2e8f0] flex items-center justify-between text-xs shrink-0">
              <span className="text-[11px] text-[#64748b]">
                Hightone Ceramic Commercial Plant Desk • Data preserved locally &amp; in Sheet
              </span>
              <button
                onClick={onClose}
                className="px-4 py-1.5 bg-[#e2e8f0] hover:bg-[#cbd5e1] text-[#0F2E52] font-semibold rounded-[3px] transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
