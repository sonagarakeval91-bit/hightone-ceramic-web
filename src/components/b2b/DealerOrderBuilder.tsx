import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  ProductItem,
  DealerOrderItem,
  DealerOrderPayload,
  SavedDealerOrder,
  CeramicGrade,
  CeramicPacking,
  ColorQuantitySplit,
  ProductConfigOverride
} from '../../types';
import { useWebsiteData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import { getDefaultProductConfig, extractBuiltInProductCode } from '../../data/productClassifications';
import { buildMergedCategoriesList } from '../pages/CollectionsPage';
import { formatCategoryName, normalizeCategory } from '../../services/googleSheetsService';
import {
  Package,
  Search,
  ShoppingCart,
  Plus,
  Minus,
  CheckCircle2,
  Trash2,
  X,
  FileText,
  MessageSquare,
  ArrowRight,
  RotateCcw,
  AlertCircle,
  Truck,
  Weight,
  Calendar,
  Building2,
  Printer,
  Download,
  Info,
  Pencil,
  ShieldCheck
} from 'lucide-react';
import {
  FloatingCollectionSwitcher,
  CollectionMenuItem
} from './FloatingCollectionSwitcher';
import {
  COUNTRY_DIAL_CODES,
  COUNTRIES,
  INDIAN_STATES,
  getDistrictsForState,
  getCitiesForDistrict
} from '../../data/locationData';
import { sanitizePhoneForWhatsApp } from '../../utils/phone';
import { downloadDealerOrderPDF, printDealerOrderPDF } from '../../utils/orderPdf';

interface ItemOrderBatch {
  batchId: string;
  grade: CeramicGrade;
  packing: CeramicPacking;
  splits: ColorQuantitySplit[];
}

const ALL_GRADE_PACKING_COMBOS: Array<{ grade: CeramicGrade; packing: CeramicPacking }> = [
  { grade: 'Uty', packing: 'Box' },
  { grade: 'S.Uty', packing: 'Box' },
  { grade: 'ROK', packing: 'Box' },
  { grade: 'Uty', packing: 'Paper' },
  { grade: 'S.Uty', packing: 'Paper' },
  { grade: 'ROK', packing: 'Paper' }
];

const createBatchId = () => `batch-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const addDaysIso = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

const DELIVERY_PERIOD_PRESETS = [
  { label: 'Immediate (2-3 Days)', days: 3 },
  { label: 'Within 7 Days', days: 7 },
  { label: 'Within 15 Days', days: 15 },
  { label: 'Within 30 Days', days: 30 }
];

const formatIsoDateShort = (iso?: string): string => {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00`);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

interface DealerOrderDraft {
  selectedCategory: string;
  searchQuery: string;
  defaultGrade: CeramicGrade;
  defaultPacking: CeramicPacking;
  orderMap: Record<string, ItemOrderBatch[]>;
  requiredPeriod: string;
  requiredDate: string;
  notes: string;
}

const getOrderDraftStorageKey = (accountId?: string): string =>
  accountId ? `htc_dealer_order_draft_${accountId}` : 'htc_dealer_order_draft_guest';

const readOrderDraft = (storageKey: string): Partial<DealerOrderDraft> | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      selectedCategory: typeof parsed.selectedCategory === 'string' ? parsed.selectedCategory : 'all',
      searchQuery: typeof parsed.searchQuery === 'string' ? parsed.searchQuery : '',
      defaultGrade:
        parsed.defaultGrade === 'Uty' || parsed.defaultGrade === 'S.Uty' || parsed.defaultGrade === 'ROK'
          ? parsed.defaultGrade
          : 'Uty',
      defaultPacking:
        parsed.defaultPacking === 'Box' || parsed.defaultPacking === 'Paper'
          ? parsed.defaultPacking
          : 'Box',
      orderMap:
        parsed.orderMap && typeof parsed.orderMap === 'object' && !Array.isArray(parsed.orderMap)
          ? (parsed.orderMap as Record<string, ItemOrderBatch[]>)
          : {},
      requiredPeriod: typeof parsed.requiredPeriod === 'string' ? parsed.requiredPeriod : 'Within 7 Days',
      requiredDate: typeof parsed.requiredDate === 'string' ? parsed.requiredDate : addDaysIso(7),
      notes: typeof parsed.notes === 'string' ? parsed.notes : ''
    };
  } catch {
    return null;
  }
};

const writeOrderDraft = (storageKey: string, draft: DealerOrderDraft): void => {
  if (typeof window === 'undefined') return;
  try {
    const hasItems = Object.keys(draft.orderMap).length > 0;
    const hasCustomState =
      hasItems ||
      draft.selectedCategory !== 'all' ||
      draft.searchQuery.trim().length > 0 ||
      draft.notes.trim().length > 0 ||
      draft.defaultGrade !== 'Uty' ||
      draft.defaultPacking !== 'Box';

    if (!hasCustomState) {
      window.sessionStorage.removeItem(storageKey);
      return;
    }

    window.sessionStorage.setItem(storageKey, JSON.stringify(draft));
  } catch {
    // Ignore storage quota or private browsing errors cleanly
  }
};

const clearOrderDraft = (storageKey: string): void => {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(storageKey);
  } catch {
    // Ignore storage access errors cleanly
  }
};

interface DealerOrderBuilderProps {
  editingOrder?: SavedDealerOrder | null;
  reorderSource?: SavedDealerOrder | null;
  onCancelEdit?: () => void;
  onOrderSaved?: (payload: DealerOrderPayload, isEdit: boolean) => void;
  onRequireSignIn?: () => void;
}

export const DealerOrderBuilder: React.FC<DealerOrderBuilderProps> = ({
  editingOrder = null,
  reorderSource = null,
  onCancelEdit,
  onOrderSaved,
  onRequireSignIn
}) => {
  const {
    products,
    companyInfo,
    collectionsMeta,
    siteMedia,
    recordDealerOrder,
    saveDealerEditedOrder,
    dealerSession,
    productConfigs,
    colorsList,
    designCodesList,
    globalDefaultCode
  } = useWebsiteData();
  const { toastSuccess, toastInfo, toastWarning, toastError } = useToast();

  const draftStorageKey = getOrderDraftStorageKey(dealerSession?.accountId);
  const initialDraft =
    !editingOrder && !reorderSource ? readOrderDraft(draftStorageKey) : null;

  // Filter & Navigation States
  const [selectedCategory, setSelectedCategory] = useState<string>(
    () => initialDraft?.selectedCategory || 'all'
  );
  const [searchQuery, setSearchQuery] = useState<string>(
    () => initialDraft?.searchQuery || ''
  );
  const catalogTopRef = useRef<HTMLDivElement | null>(null);

  // Global Presets for new selections
  const [defaultGrade, setDefaultGrade] = useState<CeramicGrade>(
    () => initialDraft?.defaultGrade || 'Uty'
  );
  const [defaultPacking, setDefaultPacking] = useState<CeramicPacking>(
    () => initialDraft?.defaultPacking || 'Box'
  );

  // Item Orders State: productId -> array of classification batches
  const [orderMap, setOrderMap] = useState<Record<string, ItemOrderBatch[]>>(
    () => initialDraft?.orderMap || {}
  );

  // Finalize Modal State
  const [isFinalizeOpen, setIsFinalizeOpen] = useState(false);
  const [orderSubmittedPayload, setOrderSubmittedPayload] = useState<DealerOrderPayload | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editWasAcceptedNotice, setEditWasAcceptedNotice] = useState(false);

  // Order Form States
  const [firmName, setFirmName] = useState(() => dealerSession?.firmName || '');
  const [personName, setPersonName] = useState(() => dealerSession?.contactPerson || '');
  const [phoneCode, setPhoneCode] = useState(() => dealerSession?.phoneCode || '+91');
  const [phoneNumber, setPhoneNumber] = useState(() => dealerSession?.whatsappNumber || '');
  const [country, setCountry] = useState(() => dealerSession?.country || 'India');
  const [state, setState] = useState(() => dealerSession?.state || 'Gujarat');
  const [district, setDistrict] = useState(() => dealerSession?.district || 'Surendranagar');
  const [city, setCity] = useState(() => dealerSession?.city || 'Thangadh');
  const [customCity, setCustomCity] = useState('');
  const [requiredPeriod, setRequiredPeriod] = useState(
    () => initialDraft?.requiredPeriod || 'Within 7 Days'
  );
  const [requiredDate, setRequiredDate] = useState(
    () => initialDraft?.requiredDate || addDaysIso(7)
  );
  const [notes, setNotes] = useState(() => initialDraft?.notes || '');
  const [confirmClearDraft, setConfirmClearDraft] = useState(false);

  // Touched validation states
  const [touched, setTouched] = useState<Record<string, boolean>>({
    firmName: false,
    personName: false,
    phoneNumber: false
  });

  // Sync profile pre-fill when dealerSession changes (unless editing an existing order)
  useEffect(() => {
    if (!dealerSession || editingOrder) return;
    setFirmName(dealerSession.firmName || '');
    setPersonName(dealerSession.contactPerson || '');
    setPhoneCode(dealerSession.phoneCode || '+91');
    setPhoneNumber(dealerSession.whatsappNumber || '');
    setCountry(dealerSession.country || 'India');
    setState(dealerSession.state || 'Gujarat');
    setDistrict(dealerSession.district || '');
    const validCities = getCitiesForDistrict(dealerSession.district || '', dealerSession.state || '');
    if (dealerSession.country === 'India' && dealerSession.city && !validCities.includes(dealerSession.city)) {
      setCity('Other City');
      setCustomCity(dealerSession.city);
    } else {
      setCity(dealerSession.city || validCities[0] || '');
      setCustomCity('');
    }
  }, [dealerSession, editingOrder]);

  // Populate orderMap & metadata when entering Edit Order or Reorder mode
  useEffect(() => {
    const sourceOrder = editingOrder || reorderSource;
    if (!sourceOrder) return;

    const nextMap: Record<string, ItemOrderBatch[]> = {};
    (sourceOrder.items || []).forEach((item) => {
      const batch: ItemOrderBatch = {
        batchId: item.batchId || createBatchId(),
        grade: item.grade || 'Uty',
        packing: item.packing || 'Box',
        splits:
          item.colorSplits && item.colorSplits.length > 0
            ? item.colorSplits.map((s) => ({ ...s }))
            : [{ codeOrColor: 'White', quantity: item.totalQuantity || 0 }]
      };
      nextMap[item.productId] = [...(nextMap[item.productId] || []), batch];
    });
    setOrderMap(nextMap);
    setOrderSubmittedPayload(null);
    setEditWasAcceptedNotice(false);

    if (editingOrder) {
      setFirmName(editingOrder.dealerInfo?.firmName || dealerSession?.firmName || '');
      setPersonName(editingOrder.personName || editingOrder.dealerInfo?.contactPerson || dealerSession?.contactPerson || '');
      setPhoneCode(editingOrder.dealerInfo?.phoneCode || dealerSession?.phoneCode || '+91');
      setPhoneNumber(editingOrder.dealerInfo?.phoneNumber || dealerSession?.whatsappNumber || '');
      const ordCountry = editingOrder.dealerInfo?.country || dealerSession?.country || 'India';
      const ordState = editingOrder.dealerInfo?.state || dealerSession?.state || 'Gujarat';
      const ordDistrict = editingOrder.dealerInfo?.district || dealerSession?.district || '';
      const ordCity = editingOrder.dealerInfo?.city || dealerSession?.city || '';
      setCountry(ordCountry);
      setState(ordState);
      setDistrict(ordDistrict);
      const validCities = getCitiesForDistrict(ordDistrict, ordState);
      if (ordCountry === 'India' && ordCity && !validCities.includes(ordCity)) {
        setCity('Other City');
        setCustomCity(ordCity);
      } else {
        setCity(ordCity);
        setCustomCity('');
      }
      setRequiredPeriod(editingOrder.requiredPeriod || 'Within 7 Days');
      setRequiredDate(editingOrder.requiredDate || addDaysIso(7));
      setNotes(editingOrder.dealerInfo?.notes || '');
      setIsFinalizeOpen(false);
    } else if (reorderSource) {
      setNotes(reorderSource.dealerInfo?.notes || '');
      setIsFinalizeOpen(false);
    }
  }, [editingOrder, reorderSource, dealerSession]);

  // Persist Create Dealer Order progress (items & active floating collection) in sessionStorage
  const hydratedDraftKeyRef = useRef<string>(draftStorageKey);
  useEffect(() => {
    if (editingOrder || reorderSource) return;
    if (hydratedDraftKeyRef.current !== draftStorageKey) {
      hydratedDraftKeyRef.current = draftStorageKey;
      const saved = readOrderDraft(draftStorageKey);
      setSelectedCategory(saved?.selectedCategory || 'all');
      setSearchQuery(saved?.searchQuery || '');
      setDefaultGrade(saved?.defaultGrade || 'Uty');
      setDefaultPacking(saved?.defaultPacking || 'Box');
      setOrderMap(saved?.orderMap || {});
      setRequiredPeriod(saved?.requiredPeriod || 'Within 7 Days');
      setRequiredDate(saved?.requiredDate || addDaysIso(7));
      setNotes(saved?.notes || '');
    }
  }, [draftStorageKey, editingOrder, reorderSource]);

  useEffect(() => {
    if (editingOrder || reorderSource || orderSubmittedPayload) return;
    writeOrderDraft(draftStorageKey, {
      selectedCategory,
      searchQuery,
      defaultGrade,
      defaultPacking,
      orderMap,
      requiredPeriod,
      requiredDate,
      notes
    });
  }, [
    draftStorageKey,
    editingOrder,
    reorderSource,
    orderSubmittedPayload,
    selectedCategory,
    searchQuery,
    defaultGrade,
    defaultPacking,
    orderMap,
    requiredPeriod,
    requiredDate,
    notes
  ]);

  const handleCountryChange = (newCountry: string) => {
    setCountry(newCountry);
    if (newCountry === 'India') {
      setPhoneCode('+91');
      setState('Gujarat');
      const dists = getDistrictsForState('Gujarat');
      setDistrict(dists[0] || '');
      const cities = getCitiesForDistrict(dists[0] || '', 'Gujarat');
      setCity(cities[0] || '');
      setCustomCity('');
    } else {
      const match = COUNTRY_DIAL_CODES.find((c) => c.country.toLowerCase() === newCountry.toLowerCase());
      if (match) setPhoneCode(match.code);
      setState('');
      setDistrict('');
      setCity('');
      setCustomCity('');
    }
  };

  const handleStateChange = (newState: string) => {
    setState(newState);
    const dists = getDistrictsForState(newState);
    const defaultDist = dists[0] || '';
    setDistrict(defaultDist);
    const cities = getCitiesForDistrict(defaultDist, newState);
    setCity(cities[0] || '');
    setCustomCity('');
  };

  const handleDistrictChange = (newDist: string) => {
    setDistrict(newDist);
    const cities = getCitiesForDistrict(newDist, state);
    setCity(cities[0] || '');
    setCustomCity('');
  };

  // Resolve canonical collection titles and display sequence matching the Collections tab
  const mergedCollectionMetas = useMemo(
    () => buildMergedCategoriesList(collectionsMeta, siteMedia, products),
    [collectionsMeta, siteMedia, products]
  );

  const categoryDisplayInfo = useMemo(() => {
    const labelByKey = new Map<string, string>();
    const orderByKey = new Map<string, number>();

    mergedCollectionMetas.forEach((meta, idx) => {
      const displayLabel = meta.title || meta.shortLabel || formatCategoryName(meta.id);
      const normId = normalizeCategory(meta.id);
      labelByKey.set(meta.id, displayLabel);
      if (normId) labelByKey.set(normId, displayLabel);
      const orderVal = meta.order ?? idx + 1;
      orderByKey.set(meta.id, orderVal);
      if (normId) orderByKey.set(normId, orderVal);
    });

    return { labelByKey, orderByKey };
  }, [mergedCollectionMetas]);

  const getCollectionDisplayName = (catId: string): string => {
    if (!catId || catId === 'all') return 'All Collections';
    const norm = normalizeCategory(catId);
    return (
      categoryDisplayInfo.labelByKey.get(catId) ||
      (norm ? categoryDisplayInfo.labelByKey.get(norm) : undefined) ||
      formatCategoryName(catId)
    );
  };

  // Derive available categories in the same display order as the Collections tab
  const categoriesList = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set).sort((a, b) => {
      const orderA =
        categoryDisplayInfo.orderByKey.get(a) ??
        categoryDisplayInfo.orderByKey.get(normalizeCategory(a)) ??
        9999;
      const orderB =
        categoryDisplayInfo.orderByKey.get(b) ??
        categoryDisplayInfo.orderByKey.get(normalizeCategory(b)) ??
        9999;
      if (orderA !== orderB) return orderA - orderB;
      return getCollectionDisplayName(a).localeCompare(getCollectionDisplayName(b));
    });
  }, [products, categoryDisplayInfo]);

  // Reset selectedCategory safely if stored category no longer exists in catalog
  useEffect(() => {
    if (
      selectedCategory !== 'all' &&
      categoriesList.length > 0 &&
      !categoriesList.includes(selectedCategory)
    ) {
      setSelectedCategory('all');
    }
  }, [selectedCategory, categoriesList]);

  // Filter products by category and search
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchCategory = selectedCategory === 'all' || p.category === selectedCategory;
      if (!matchCategory) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const inName = p.name.toLowerCase().includes(q);
      const inSeries = p.series.toLowerCase().includes(q);
      const inCategory =
        p.category.toLowerCase().includes(q) ||
        getCollectionDisplayName(p.category).toLowerCase().includes(q);
      const inTrap = (p.trapType || '').toLowerCase().includes(q);
      const inDimensions = p.dimensions?.formatted?.toLowerCase().includes(q);

      return inName || inSeries || inCategory || inTrap || inDimensions;
    });
  }, [products, selectedCategory, searchQuery, categoryDisplayInfo]);

  // Get active config for a product
  const getProductConfig = (product: ProductItem) => {
    const override = productConfigs[product.id];
    if (override) return override;
    return getDefaultProductConfig(product);
  };

  const getResolvedDefaultCode = (product: ProductItem, config: ProductConfigOverride): string => {
    return (
      (config.defaultCode || '').trim() ||
      (product.defaultCode || '').trim() ||
      extractBuiltInProductCode(product.name) ||
      (globalDefaultCode || '').trim() ||
      'Default'
    );
  };

  const getDefaultSplitValue = (product: ProductItem) => {
    const config = getProductConfig(product);
    const variantMode = config.variantMode || 'white-only';
    const availableCodes = config.availableDesignCodes && config.availableDesignCodes.length > 0 ? config.availableDesignCodes : designCodesList;
    if (variantMode === 'design-code') return availableCodes[0] || '1';
    if (variantMode === 'default-code') return getResolvedDefaultCode(product, config);
    if (variantMode === 'color-glaze') return colorsList[0] || 'White';
    return 'White';
  };

  const createInitialBatch = (
    product: ProductItem,
    grade: CeramicGrade = defaultGrade,
    packing: CeramicPacking = defaultPacking
  ): ItemOrderBatch => ({
    batchId: createBatchId(),
    grade,
    packing,
    splits: [{ codeOrColor: getDefaultSplitValue(product), quantity: 0 }]
  });

  // Update a specific batch for a product (materializing initial virtual batch if needed)
  const updateProductBatch = (
    product: ProductItem,
    batchIndex: number,
    updater: (prev: ItemOrderBatch) => ItemOrderBatch
  ) => {
    setOrderMap((prev) => {
      const existing = prev[product.id] && prev[product.id].length > 0
        ? prev[product.id]
        : [createInitialBatch(product)];

      const nextBatches = existing.map((b, idx) => (idx === batchIndex ? updater(b) : b));
      const totalAcrossAll = nextBatches.reduce(
        (sum, b) => sum + b.splits.reduce((sSum, s) => sSum + s.quantity, 0),
        0
      );

      // Only drop from map if single batch and completely zeroed out
      if (nextBatches.length === 1 && totalAcrossAll === 0) {
        const defaultCode = getDefaultSplitValue(product);
        const onlyBatch = nextBatches[0];
        const isDefaultCombo = onlyBatch.grade === defaultGrade && onlyBatch.packing === defaultPacking;
        const isDefaultSplit = onlyBatch.splits.length === 1 && onlyBatch.splits[0].codeOrColor === defaultCode;
        if (isDefaultCombo && isDefaultSplit) {
          const copy = { ...prev };
          delete copy[product.id];
          return copy;
        }
      }

      return {
        ...prev,
        [product.id]: nextBatches
      };
    });
  };

  // Add a second/third/... Grade + Packing batch on the same product card
  const handleAddBatch = (product: ProductItem) => {
    setOrderMap((prev) => {
      const existing = prev[product.id] && prev[product.id].length > 0
        ? prev[product.id]
        : [createInitialBatch(product)];

      // Find the next unused (grade, packing) combo so the dealer doesn't get a duplicate by default
      const usedKeys = new Set(existing.map((b) => `${b.grade}__${b.packing}`));
      const nextCombo = ALL_GRADE_PACKING_COMBOS.find(
        (c) => !usedKeys.has(`${c.grade}__${c.packing}`)
      ) || {
        grade: existing[existing.length - 1].grade === 'Uty' ? 'S.Uty' : 'Uty',
        packing: existing[existing.length - 1].packing === 'Box' ? 'Paper' : 'Box'
      };

      const newBatch = createInitialBatch(product, nextCombo.grade, nextCombo.packing);
      return {
        ...prev,
        [product.id]: [...existing, newBatch]
      };
    });
  };

  // Remove a batch from a product card
  const handleRemoveBatch = (product: ProductItem, batchIndex: number) => {
    setOrderMap((prev) => {
      const existing = prev[product.id];
      if (!existing || existing.length <= 1) {
        const copy = { ...prev };
        delete copy[product.id];
        return copy;
      }

      const remaining = existing.filter((_, idx) => idx !== batchIndex);
      const remainingQty = remaining.reduce(
        (sum, b) => sum + b.splits.reduce((sSum, s) => sSum + s.quantity, 0),
        0
      );
      if (remaining.length === 1 && remainingQty === 0) {
        const copy = { ...prev };
        delete copy[product.id];
        return copy;
      }

      return {
        ...prev,
        [product.id]: remaining
      };
    });
  };

  // Change Quantity for White Only within a specific batch
  const handleWhiteOnlyQty = (product: ProductItem, batchIndex: number, qty: number) => {
    const cleanQty = Math.max(0, qty);
    updateProductBatch(product, batchIndex, (prev) => ({
      ...prev,
      splits: [{ codeOrColor: 'White', quantity: cleanQty }]
    }));
  };

  // Change Quantity for Default Code SKUs (read-only code configured by Admin)
  const handleDefaultCodeQty = (
    product: ProductItem,
    batchIndex: number,
    qty: number,
    resolvedCode: string
  ) => {
    const cleanQty = Math.max(0, qty);
    updateProductBatch(product, batchIndex, (prev) => ({
      ...prev,
      splits: [{ codeOrColor: resolvedCode, quantity: cleanQty }]
    }));
  };

  // Split changes for Color / Design Codes within a specific batch
  const handleSplitQtyChange = (product: ProductItem, batchIndex: number, splitIndex: number, newQty: number) => {
    const cleanQty = Math.max(0, newQty);
    updateProductBatch(product, batchIndex, (prev) => {
      const newSplits = [...prev.splits];
      if (newSplits[splitIndex]) {
        newSplits[splitIndex] = { ...newSplits[splitIndex], quantity: cleanQty };
      }
      return { ...prev, splits: newSplits };
    });
  };

  const handleSplitCodeChange = (product: ProductItem, batchIndex: number, splitIndex: number, newCode: string) => {
    updateProductBatch(product, batchIndex, (prev) => {
      const newSplits = [...prev.splits];
      if (newSplits[splitIndex]) {
        newSplits[splitIndex] = { ...newSplits[splitIndex], codeOrColor: newCode };
      }
      return { ...prev, splits: newSplits };
    });
  };

  const handleAddSplitRow = (product: ProductItem, batchIndex: number, defaultCode: string) => {
    updateProductBatch(product, batchIndex, (prev) => ({
      ...prev,
      splits: [...prev.splits, { codeOrColor: defaultCode, quantity: 10 }]
    }));
  };

  const handleRemoveSplitRow = (product: ProductItem, batchIndex: number, splitIndex: number) => {
    const fallbackCode = getDefaultSplitValue(product);
    updateProductBatch(product, batchIndex, (prev) => {
      const newSplits = prev.splits.filter((_, i) => i !== splitIndex);
      return {
        ...prev,
        splits: newSplits.length === 0 ? [{ codeOrColor: fallbackCode, quantity: 0 }] : newSplits
      };
    });
  };

  const handleGradeChange = (product: ProductItem, batchIndex: number, grade: CeramicGrade) => {
    updateProductBatch(product, batchIndex, (prev) => ({ ...prev, grade }));
  };

  const handlePackingChange = (product: ProductItem, batchIndex: number, packing: CeramicPacking) => {
    updateProductBatch(product, batchIndex, (prev) => ({ ...prev, packing }));
  };

  const handleClearOrder = () => {
    setOrderMap({});
    setConfirmClearDraft(false);
    toastInfo('Selected items cleared from order draft.', 'Order Cleared');
  };

  // Apply default grade/packing safely across single-batch selections
  const handleApplyDefaultsToAll = () => {
    if (Object.keys(orderMap).length === 0) {
      toastInfo('Select at least one product before applying quick defaults.', 'No Items Selected');
      return;
    }
    setOrderMap((prev) => {
      const updated: Record<string, ItemOrderBatch[]> = {};
      Object.entries(prev).forEach(([id, batches]) => {
        if (batches.length === 1) {
          updated[id] = [
            {
              ...batches[0],
              grade: defaultGrade,
              packing: defaultPacking
            }
          ];
        } else {
          // Preserve intentionally configured multi-batch combinations
          updated[id] = batches;
        }
      });
      return updated;
    });
    toastSuccess(`Applied ${defaultGrade} Grade & ${defaultPacking} Packing to selected items.`, 'Quick Defaults Applied');
  };

  // Compile active ordered batch rows (merging any identical product+grade+packing splits cleanly)
  const selectedItemsList: DealerOrderItem[] = useMemo(() => {
    const compiledMap = new Map<string, DealerOrderItem>();

    Object.entries(orderMap).forEach(([productId, batches]) => {
      const product = products.find((p) => p.id === productId);
      if (!product) return;

      const config = getProductConfig(product);
      const unitWeightKg = config.weightKg || 15.0;

      batches.forEach((batch) => {
        const fallbackCode =
          config.variantMode === 'default-code'
            ? getResolvedDefaultCode(product, config)
            : getDefaultSplitValue(product);
        const validSplits = batch.splits
          .filter((s) => s.quantity > 0)
          .map((s) => ({
            ...s,
            codeOrColor: s.codeOrColor.trim() || fallbackCode
          }));
        if (validSplits.length === 0) return;

        const comboKey = `${productId}__${batch.grade}__${batch.packing}`;
        const existingItem = compiledMap.get(comboKey);

        if (!existingItem) {
          const batchQty = validSplits.reduce((sum, s) => sum + s.quantity, 0);
          compiledMap.set(comboKey, {
            batchId: batch.batchId,
            productId: product.id,
            name: product.name,
            series: product.series,
            category: product.category,
            collectionName: product.series || product.category,
            imageUrl: product.imageUrl,
            trapType: product.trapType,
            dimensions: product.dimensions?.formatted,
            grade: batch.grade,
            packing: batch.packing,
            colorSplits: validSplits.map((s) => ({ ...s })),
            totalQuantity: batchQty,
            unitWeightKg,
            totalWeightKg: batchQty * unitWeightKg
          });
        } else {
          // Merge splits with identical product + grade + packing
          const mergedSplits = [...existingItem.colorSplits];
          validSplits.forEach((s) => {
            const matchIdx = mergedSplits.findIndex((m) => m.codeOrColor === s.codeOrColor);
            if (matchIdx >= 0) {
              mergedSplits[matchIdx] = {
                ...mergedSplits[matchIdx],
                quantity: mergedSplits[matchIdx].quantity + s.quantity
              };
            } else {
              mergedSplits.push({ ...s });
            }
          });
          const mergedQty = mergedSplits.reduce((sum, s) => sum + s.quantity, 0);
          compiledMap.set(comboKey, {
            ...existingItem,
            colorSplits: mergedSplits,
            totalQuantity: mergedQty,
            totalWeightKg: mergedQty * unitWeightKg
          });
        }
      });
    });

    return Array.from(compiledMap.values());
  }, [orderMap, products, productConfigs]);

  const totalQuantity = useMemo(() => {
    return selectedItemsList.reduce((acc, curr) => acc + curr.totalQuantity, 0);
  }, [selectedItemsList]);

  const totalWeightKg = useMemo(() => {
    return selectedItemsList.reduce((acc, curr) => acc + curr.totalWeightKg, 0);
  }, [selectedItemsList]);

  const totalBatches = selectedItemsList.length;

  const totalModels = useMemo(() => {
    return new Set(selectedItemsList.map((i) => i.productId)).size;
  }, [selectedItemsList]);

  const classificationSummary = useMemo(() => {
    const grades: Record<CeramicGrade, number> = { Uty: 0, 'S.Uty': 0, ROK: 0 };
    const packings: Record<CeramicPacking, number> = { Box: 0, Paper: 0 };
    selectedItemsList.forEach((item) => {
      grades[item.grade] = (grades[item.grade] || 0) + item.totalQuantity;
      packings[item.packing] = (packings[item.packing] || 0) + item.totalQuantity;
    });
    return { grades, packings };
  }, [selectedItemsList]);

  // Signal floating elements that bottom order tray is active
  useEffect(() => {
    if (totalQuantity > 0) {
      document.body.classList.add('has-order-tray');
      window.dispatchEvent(new CustomEvent('htc:ordertray', { detail: { active: true } }));
    } else {
      document.body.classList.remove('has-order-tray');
      window.dispatchEvent(new CustomEvent('htc:ordertray', { detail: { active: false } }));
    }
    return () => {
      document.body.classList.remove('has-order-tray');
      window.dispatchEvent(new CustomEvent('htc:ordertray', { detail: { active: false } }));
    };
  }, [totalQuantity]);

  const selectedQtyByCategory = useMemo(() => {
    const counts: Record<string, number> = {};
    selectedItemsList.forEach((item) => {
      counts[item.category] = (counts[item.category] || 0) + item.totalQuantity;
    });
    return counts;
  }, [selectedItemsList]);

  const floatingCollections: CollectionMenuItem[] = useMemo(() => {
    const modelCountsByCategory: Record<string, number> = {};
    products.forEach((p) => {
      if (p.category) {
        modelCountsByCategory[p.category] = (modelCountsByCategory[p.category] || 0) + 1;
      }
    });

    return [
      {
        id: 'all',
        label: 'All Collections',
        modelCount: products.length,
        selectedQty: totalQuantity
      },
      ...categoriesList.map((cat) => ({
        id: cat,
        label: getCollectionDisplayName(cat),
        modelCount: modelCountsByCategory[cat] || 0,
        selectedQty: selectedQtyByCategory[cat] || 0
      }))
    ];
  }, [products, categoriesList, totalQuantity, selectedQtyByCategory, categoryDisplayInfo]);

  const handleSelectCollection = (cat: string) => {
    setSelectedCategory(cat);
    if (catalogTopRef.current) {
      const rect = catalogTopRef.current.getBoundingClientRect();
      if (rect.top < 90) {
        catalogTopRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  // Validation
  const effectiveCity = city === 'Other City' ? customCity.trim() : city;
  const isFirmValid = (firmName.trim() || '').length >= 2;
  const isPersonValid = (personName.trim() || '').length >= 2;
  const cleanPhone = phoneNumber.replace(/[\s\-\(\)]/g, '');
  const isPhoneValid = cleanPhone.length >= 7 && /^\d+$/.test(cleanPhone);
  const isFormValid = isFirmValid && isPersonValid && isPhoneValid && totalQuantity > 0;

  const constructPayload = (): DealerOrderPayload => {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const orderId = editingOrder?.orderId || editingOrder?.id || `ORD-${randomSuffix}`;
    const timestamp = editingOrder?.timestamp || new Date().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      dateStyle: 'medium',
      timeStyle: 'short'
    });

    const cityStateStr = [effectiveCity, district, state, country].filter(Boolean).join(', ');
    const fullAddress = dealerSession
      ? [dealerSession.streetAddress, dealerSession.pincode].filter(Boolean).join(' - ')
      : editingOrder?.dealerAddress;

    return {
      orderId,
      dispatchNo: editingOrder?.dispatchNo || '',
      vehicleNo: editingOrder?.vehicleNo || '',
      personName: personName.trim(),
      requiredDate: requiredDate || undefined,
      requiredPeriod: requiredPeriod || undefined,
      dealerAccountId: dealerSession?.accountId || editingOrder?.dealerAccountId,
      dealerUserId: dealerSession?.userId || editingOrder?.dealerUserId,
      dealerEmail: dealerSession?.email || editingOrder?.dealerEmail,
      dealerGst: dealerSession?.gstNumber || editingOrder?.dealerGst,
      dealerAddress: fullAddress,
      dealerInfo: {
        firmName: firmName.trim(),
        contactPerson: personName.trim(),
        phoneCode,
        phoneNumber: cleanPhone,
        country,
        state,
        district,
        city: effectiveCity,
        cityState: cityStateStr,
        transporterHub: '',
        notes: notes.trim()
      },
      items: selectedItemsList,
      totalQuantity,
      totalModels,
      totalBatches,
      totalWeightKg,
      timestamp
    };
  };

  const handleSaveOrder = async (): Promise<DealerOrderPayload | null> => {
    if (!dealerSession) {
      toastInfo('Please sign in with your verified Dealer account to save factory orders.', 'Sign-In Required');
      onRequireSignIn?.();
      return null;
    }
    if (!isFormValid) {
      setTouched({ firmName: true, personName: true, phoneNumber: true });
      toastError(
        totalQuantity <= 0
          ? 'Add at least 1 unit before saving your order.'
          : 'Complete Firm Name, Contact Person, and WhatsApp/Mobile.',
        'Incomplete Order Details'
      );
      return null;
    }
    setIsSubmitting(true);
    try {
      const payload = orderSubmittedPayload || constructPayload();
      if (!orderSubmittedPayload) {
        if (editingOrder) {
          const editRes = saveDealerEditedOrder(editingOrder.id, payload);
          setEditWasAcceptedNotice(editRes.wasAccepted);
          setOrderSubmittedPayload(payload);
          onOrderSaved?.(payload, true);
          toastSuccess(`Order ${payload.orderId} updated & synced.`, 'Order Changes Saved');
        } else {
          await recordDealerOrder(payload, `Verified Dealer (${dealerSession.userId})`);
          clearOrderDraft(draftStorageKey);
          setOrderSubmittedPayload(payload);
          onOrderSaved?.(payload, false);
          toastSuccess(`Order ${payload.orderId} saved and queued for Sales verification.`, 'Order Sent to Factory');
        }
      }
      return payload;
    } catch (err) {
      console.error('Failed to record dealer order:', err);
      toastError('Could not save dealer order. Please try again.', 'Save Failed');
      return null;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWhatsAppSend = async () => {
    if (!dealerSession) {
      toastInfo('Please sign in with your verified Dealer account before sending orders.', 'Sign-In Required');
      onRequireSignIn?.();
      return;
    }
    if (!isFormValid) {
      setTouched({ firmName: true, personName: true, phoneNumber: true });
      toastError(
        totalQuantity <= 0
          ? 'Add at least 1 unit before sending via WhatsApp.'
          : 'Complete Firm Name, Contact Person, and WhatsApp/Mobile.',
        'Incomplete Order Details'
      );
      return;
    }

    const payload = orderSubmittedPayload || constructPayload();
    if (!orderSubmittedPayload) {
      try {
        if (editingOrder) {
          const editRes = saveDealerEditedOrder(editingOrder.id, payload);
          setEditWasAcceptedNotice(editRes.wasAccepted);
          setOrderSubmittedPayload(payload);
          onOrderSaved?.(payload, true);
        } else {
          await recordDealerOrder(payload, `Verified Dealer WhatsApp (${dealerSession.userId})`);
          clearOrderDraft(draftStorageKey);
          setOrderSubmittedPayload(payload);
          onOrderSaved?.(payload, false);
        }
      } catch {
        toastWarning('Could not save local copy before opening WhatsApp.', 'Local Save Warning');
      }
    }

    const itemsText = payload.items
      .map((item, idx) => {
        const matrix = item.colorSplits.map((s) => `${s.codeOrColor}: ${s.quantity}`).join(' | ');
        return `${idx + 1}. *${item.name}* [${item.packing}] [${item.grade}]\n   └ ${matrix} ➔ Total: *${item.totalQuantity} Qty* (${item.totalWeightKg.toFixed(1)} kg)`;
      })
      .join('\n');

    const gradeBreakdownText = Object.entries(classificationSummary.grades)
      .filter(([, q]) => q > 0)
      .map(([g, q]) => `${g}: ${q}`)
      .join(' | ');
    const packingBreakdownText = Object.entries(classificationSummary.packings)
      .filter(([, q]) => q > 0)
      .map(([p, q]) => `${p}: ${q}`)
      .join(' | ');

    const message =
      `*HIGHTONE CERAMIC - DEALER ORDER*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `*Date:* ${payload.timestamp}\n\n` +
      `*DEALER DETAILS:*` +
      `\n• *Organization / Firm:* ${payload.dealerInfo.firmName}` +
      `\n• *Person Name:* ${payload.personName}` +
      `\n• *Mobile:* ${payload.dealerInfo.phoneCode} ${payload.dealerInfo.phoneNumber}` +
      `\n• *Location:* ${payload.dealerInfo.cityState}` +
      (payload.requiredDate ? `\n• *Required By:* ${formatIsoDateShort(payload.requiredDate)}${payload.requiredPeriod ? ` (${payload.requiredPeriod})` : ''}` : '') +
      (payload.dealerInfo.notes ? `\n• *Notes:* ${payload.dealerInfo.notes}` : '') +
      `\n\n*ORDER ITEMS & MATRIX:*` +
      `\n${itemsText}\n\n` +
      `*CLASSIFICATION BREAKDOWN:*` +
      (gradeBreakdownText ? `\n• By Grade: ${gradeBreakdownText}` : '') +
      (packingBreakdownText ? `\n• By Packing: ${packingBreakdownText}` : '') +
      `\n\n*ORDER TOTALS:*` +
      `\n• Total Selected Models: *${payload.totalModels}* (${payload.totalBatches || payload.items.length} Rows)` +
      `\n• Total Order Quantity: *${payload.totalQuantity} Units*` +
      `\n• Total Order Weight: *${payload.totalWeightKg.toFixed(2)} kg*` +
      `\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `Please confirm order allocation and loading schedule.`;

    const whatsappUrl = `https://wa.me/${sanitizePhoneForWhatsApp(companyInfo.primary_phone)}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    toastSuccess(`Order ${payload.orderId} logged & opening Factory WhatsApp.`, 'WhatsApp Dispatch');
  };

  const handleDownloadPDF = () => {
    if (!isFormValid) {
      setTouched({ firmName: true, personName: true, phoneNumber: true });
      toastError(
        totalQuantity <= 0
          ? 'Add at least 1 unit to download the PDF order sheet.'
          : 'Complete dealer details before downloading PDF.',
        'Incomplete Order'
      );
      return;
    }
    const payload = orderSubmittedPayload || constructPayload();
    downloadDealerOrderPDF(payload, companyInfo);
    toastSuccess(`Downloaded PDF order sheet (${payload.orderId}).`, 'PDF Downloaded');
  };

  const handlePrintPDF = () => {
    if (!isFormValid) {
      setTouched({ firmName: true, personName: true, phoneNumber: true });
      toastError(
        totalQuantity <= 0
          ? 'Add at least 1 unit to print the order sheet.'
          : 'Complete dealer details before printing.',
        'Incomplete Order'
      );
      return;
    }
    const payload = orderSubmittedPayload || constructPayload();
    printDealerOrderPDF(payload, companyInfo);
    toastInfo(`Opening print dialog for ${payload.orderId}.`, 'Print Sheet Ready');
  };

  if (!dealerSession) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-8 text-center space-y-4">
        <ShieldCheck className="w-10 h-10 text-[#0F2E52] mx-auto" />
        <h3 className="font-display text-xl font-bold text-[#0F2E52]">
          Verified Dealer Sign-In Required
        </h3>
        <p className="text-xs sm:text-sm text-slate-600 max-w-lg mx-auto">
          Only Admin-verified dealers can create and submit factory orders. Please sign in with your Dealer User ID &amp; Password or apply to become a dealer.
        </p>
        {onRequireSignIn && (
          <button
            type="button"
            onClick={onRequireSignIn}
            className="inline-flex items-center space-x-2 px-5 py-2.5 bg-[#0F2E52] text-white rounded text-xs font-bold cursor-pointer"
          >
            <span>Go to Dealer Sign In</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* EDITING ACTIVE ORDER BANNER */}
      {editingOrder && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start space-x-2.5 text-xs text-amber-950">
            <Pencil className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-sm">
                Editing Active Order: <span className="font-mono">{editingOrder.orderId || editingOrder.id}</span>
              </div>
              <p className="text-[11px] text-amber-900 mt-0.5">
                Adjust quantities, packings, grades, or delivery date below, then open Review &amp; Finalize to save changes.
                {editingOrder.verificationStatus === 'accepted'
                  ? ' Note: Since this order was already Accepted, saving changes will send it back to Sales/Admin for quick re-verification.'
                  : ''}
              </p>
            </div>
          </div>
          {onCancelEdit && (
            <button
              type="button"
              onClick={onCancelEdit}
              className="px-3.5 py-2 bg-white hover:bg-amber-100 border border-amber-300 text-amber-950 rounded text-xs font-semibold shrink-0 cursor-pointer"
            >
              Cancel Editing
            </button>
          )}
        </div>
      )}

      {/* 1. TOP BANNER */}
      <div className="bg-[#0F2E52] text-white rounded-lg p-6 sm:p-7 relative overflow-hidden shadow-sm">
        <div className="max-w-3xl space-y-2 relative z-10">
          <div className="inline-flex items-center space-x-2 text-sky-300 text-xs font-bold uppercase tracking-wider font-mono">
            <Package className="w-4 h-4" />
            <span>
              {editingOrder
                ? `Modifying Order ${editingOrder.orderId || editingOrder.id}`
                : `Verified Dealer: ${dealerSession.firmName} (${dealerSession.userId})`}
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white font-display">
            {editingOrder ? 'Modify Active Dealer Order' : 'Create Dealer Wholesale Order'}
          </h2>
          <p className="text-slate-200 text-xs sm:text-sm leading-relaxed">
            Select ceramic sanitaryware with Grade (<strong>Uty</strong> 1st, <strong>S.Uty</strong> 2nd, <strong>ROK</strong> mix), packing (<strong>Box</strong> / <strong>Paper</strong>), and exact color or design code quantities. Automatically generates structured order sheets and PDF reports.
          </p>
        </div>

        {/* Live Counters */}
        <div className="mt-5 pt-4 border-t border-slate-700/80 grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 text-xs font-mono">
          <div>
            <div className="text-slate-400 text-[10px] uppercase">Catalog Models</div>
            <div className="text-sm sm:text-base font-bold text-white tabular-nums">{products.length} Products</div>
          </div>
          <div>
            <div className="text-slate-400 text-[10px] uppercase">Selected Items</div>
            <div className="text-sm sm:text-base font-bold text-sky-400 tabular-nums">
              {totalModels} {totalModels === 1 ? 'Model' : 'Models'}
              {totalBatches > totalModels && (
                <span className="text-[11px] text-sky-200 font-normal"> ({totalBatches} Batches)</span>
              )}
            </div>
          </div>
          <div>
            <div className="text-slate-400 text-[10px] uppercase">Total Quantity</div>
            <div className="text-sm sm:text-base font-bold text-emerald-400 tabular-nums">{totalQuantity} Units</div>
          </div>
          <div>
            <div className="text-slate-400 text-[10px] uppercase">Order Weight</div>
            <div className="text-sm sm:text-base font-bold text-amber-300 tabular-nums">{totalWeightKg.toFixed(2)} kg</div>
          </div>
        </div>
      </div>

      {/* 2. CLASSIFICATION DEFAULTS PRESET BAR */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 sm:p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px] font-mono">
            Quick Defaults:
          </span>

          {/* Grade Preset */}
          <div className="flex items-center space-x-1.5">
            <span className="text-slate-500 text-[11px]">Grade:</span>
            <div className="inline-flex rounded border border-slate-300 bg-white p-0.5">
              {(['Uty', 'S.Uty', 'ROK'] as CeramicGrade[]).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setDefaultGrade(g)}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold cursor-pointer transition-colors ${
                    defaultGrade === g ? 'bg-[#0F2E52] text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          {/* Packing Preset */}
          <div className="flex items-center space-x-1.5">
            <span className="text-slate-500 text-[11px]">Packing:</span>
            <div className="inline-flex rounded border border-slate-300 bg-white p-0.5">
              {(['Box', 'Paper'] as CeramicPacking[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setDefaultPacking(p)}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold cursor-pointer transition-colors ${
                    defaultPacking === p ? 'bg-[#0F2E52] text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>

        {totalModels > 0 && (
          <button
            type="button"
            onClick={handleApplyDefaultsToAll}
            className="text-[11px] font-semibold text-[#0F2E52] hover:underline cursor-pointer"
          >
            Apply ({defaultGrade} + {defaultPacking}) to All Selected
          </button>
        )}
      </div>

      {/* 3. SEARCH & ACTIVE COLLECTION STATUS */}
      <div className="bg-white border border-slate-200 rounded-lg p-3.5 sm:p-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search model name, collection, trap type (e.g. Spenta, 20 OP, Tabletop)..."
            className="w-full pl-9 pr-8 py-2 border border-slate-200 rounded text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#0F2E52]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs p-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-500">
          <span className="font-semibold text-[#0F2E52]">
            {selectedCategory === 'all' ? 'All Collections' : selectedCategory}
          </span>
          <span className="text-slate-300" aria-hidden="true">·</span>
          <span>
            Showing <strong className="text-slate-900 tabular-nums">{filteredProducts.length}</strong> models
          </span>
          {selectedCategory !== 'all' && (
            <button
              type="button"
              onClick={() => handleSelectCollection('all')}
              className="text-sky-700 hover:text-sky-800 font-semibold pl-2.5 border-l border-slate-200 cursor-pointer"
            >
              View All
            </button>
          )}
          {totalQuantity > 0 && (
            <button
              type="button"
              onClick={handleClearOrder}
              className="inline-flex items-center space-x-1 text-rose-600 hover:text-rose-700 font-medium pl-2.5 border-l border-slate-200 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Selections</span>
            </button>
          )}
        </div>
      </div>

      <div ref={catalogTopRef} className="scroll-mt-24" />

      {/* 4. PRODUCT CATALOG CARDS */}
      {filteredProducts.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-12 text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-slate-400 mx-auto" />
          <h3 className="text-sm font-semibold text-slate-800">No products match your search</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Try adjusting your search query or selecting a different category from above.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredProducts.map((product) => {
            const config = getProductConfig(product);
            const variantMode = config.variantMode || 'white-only';
            const unitWeightKg = config.weightKg || 15.0;
            const availableCodes = config.availableDesignCodes && config.availableDesignCodes.length > 0 ? config.availableDesignCodes : designCodesList;
            const resolvedDefaultCode = getResolvedDefaultCode(product, config);

            const productBatches = orderMap[product.id] && orderMap[product.id].length > 0
              ? orderMap[product.id]
              : [createInitialBatch(product)];

            const itemTotalQty = productBatches.reduce(
              (bSum, b) => bSum + b.splits.reduce((sSum, s) => sSum + s.quantity, 0),
              0
            );
            const activeBatchCount = productBatches.filter(
              (b) => b.splits.reduce((sSum, s) => sSum + s.quantity, 0) > 0
            ).length;
            const isSelected = itemTotalQty > 0;
            const itemTotalWeight = itemTotalQty * unitWeightKg;

            // Track duplicate Grade+Packing combinations inside this product card
            const comboCounts: Record<string, number> = {};
            productBatches.forEach((b) => {
              const key = `${b.grade}__${b.packing}`;
              comboCounts[key] = (comboCounts[key] || 0) + 1;
            });

            return (
              <div
                key={product.id}
                className={`bg-white border rounded-lg overflow-hidden flex flex-col justify-between transition-all duration-200 min-w-0 ${
                  isSelected
                    ? 'border-[#0F2E52] ring-2 ring-[#0F2E52]/15 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300 shadow-2xs'
                }`}
              >
                {/* Product Image and Meta */}
                <div>
                  <div className="relative aspect-4/3 bg-slate-50 border-b border-slate-100 overflow-hidden group">
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-contain p-4 group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                    <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-bold uppercase tracking-wider bg-white/95 text-slate-700 px-2 py-0.5 rounded shadow-2xs border border-slate-200">
                        {getCollectionDisplayName(product.category)}
                      </span>
                      <span className="text-[10px] font-mono font-semibold bg-slate-900/80 text-white px-2 py-0.5 rounded shadow-2xs tabular-nums">
                        {unitWeightKg} kg/pc
                      </span>
                    </div>

                    {isSelected && (
                      <div className="absolute top-2.5 right-2.5 bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-xs flex items-center space-x-1 tabular-nums">
                        <CheckCircle2 className="w-3 h-3 shrink-0" />
                        <span>
                          {activeBatchCount > 1 ? `${activeBatchCount} Batches · ` : ''}
                          {itemTotalQty} Qty ({itemTotalWeight.toFixed(1)} kg)
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="p-3.5 sm:p-4 space-y-3">
                    <div>
                      <div className="text-[10px] font-mono uppercase text-slate-400">
                        {product.series || product.category}
                      </div>
                      <h3 className="font-bold text-slate-900 text-sm leading-snug">
                        {product.name}
                      </h3>
                      {product.trapType && (
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {product.trapType} {product.dimensions?.formatted ? `· ${product.dimensions.formatted}` : ''}
                        </div>
                      )}
                    </div>

                    {/* Stacked Classification Batches */}
                    <div className="divide-y divide-slate-200 border-t border-slate-100">
                      {productBatches.map((batch, bIdx) => {
                        const batchQty = batch.splits.reduce((sum, s) => sum + s.quantity, 0);
                        const batchWeight = batchQty * unitWeightKg;
                        const isDuplicateCombo = comboCounts[`${batch.grade}__${batch.packing}`] > 1;

                        return (
                          <div key={batch.batchId} className={`${bIdx > 0 ? 'pt-3 mt-3' : 'pt-2.5'} space-y-2.5`}>
                            {/* Batch Header when multi-batch is active */}
                            {productBatches.length > 1 && (
                              <div className="flex items-center justify-between gap-2 text-[11px]">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span className="font-mono font-bold text-[#0F2E52] uppercase tracking-wider whitespace-nowrap">
                                    Batch #{bIdx + 1}
                                  </span>
                                  {isDuplicateCombo && (
                                    <span className="text-[10px] text-amber-700 font-medium truncate">
                                      (Merges on report)
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  {batchQty > 0 && (
                                    <span className="font-mono text-[10px] text-emerald-700 font-bold tabular-nums">
                                      {batchQty} Qty · {batchWeight.toFixed(1)} kg
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveBatch(product, bIdx)}
                                    className="text-slate-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors cursor-pointer"
                                    title={`Remove Batch #${bIdx + 1}`}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* Grade and Packing Selection Controls */}
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              {/* Packing: Box vs Paper */}
                              <div className="space-y-1 min-w-0">
                                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                                  Packing
                                </label>
                                <div className="grid grid-cols-2 rounded border border-slate-200 p-0.5 bg-slate-50 text-center font-semibold text-[11px]">
                                  {(['Box', 'Paper'] as CeramicPacking[]).map((pkg) => (
                                    <button
                                      key={pkg}
                                      type="button"
                                      onClick={() => handlePackingChange(product, bIdx, pkg)}
                                      className={`py-1 rounded transition-colors cursor-pointer whitespace-nowrap ${
                                        batch.packing === pkg
                                          ? 'bg-[#0F2E52] text-white shadow-2xs'
                                          : 'text-slate-600 hover:text-slate-900'
                                      }`}
                                    >
                                      {pkg}
                                    </button>
                                  ))}
                                </div>
                              </div>

                              {/* Grade: Uty / S.Uty / ROK */}
                              <div className="space-y-1 min-w-0">
                                <label
                                  className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block"
                                  title="Uty: 1st Grade | S.Uty: 2nd Grade | ROK: Regular Mix"
                                >
                                  Grade
                                </label>
                                <div className="grid grid-cols-3 rounded border border-slate-200 p-0.5 bg-slate-50 text-center font-semibold text-[10px]">
                                  {(['Uty', 'S.Uty', 'ROK'] as CeramicGrade[]).map((grd) => (
                                    <button
                                      key={grd}
                                      type="button"
                                      onClick={() => handleGradeChange(product, bIdx, grd)}
                                      className={`py-1 rounded transition-colors cursor-pointer whitespace-nowrap ${
                                        batch.grade === grd
                                          ? 'bg-[#0F2E52] text-white shadow-2xs'
                                          : 'text-slate-600 hover:text-slate-900'
                                      }`}
                                    >
                                      {grd}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>

                            {/* Variant & Quantity Inputs based on variantMode */}
                            <div className="space-y-2">
                              {/* Case A: White Only */}
                              {variantMode === 'white-only' && (
                                <div className="flex items-center justify-between gap-2">
                                  <div className="text-xs font-semibold text-slate-700 whitespace-nowrap">
                                    Color: <span className="font-normal text-slate-500">White</span>
                                  </div>
                                  <div className="flex items-center border border-slate-300 rounded overflow-hidden shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => handleWhiteOnlyQty(product, bIdx, batchQty - 10)}
                                      disabled={batchQty === 0}
                                      className="px-2.5 py-1.5 sm:py-1 bg-slate-50 hover:bg-slate-100 disabled:opacity-40 text-slate-700 cursor-pointer"
                                    >
                                      <Minus className="w-3 h-3" />
                                    </button>
                                    <input
                                      type="number"
                                      min="0"
                                      value={batchQty === 0 ? '' : batchQty}
                                      onChange={(e) => handleWhiteOnlyQty(product, bIdx, parseInt(e.target.value, 10) || 0)}
                                      placeholder="0"
                                      className="w-14 sm:w-16 text-center py-1 text-xs font-mono font-bold text-slate-900 focus:outline-none tabular-nums"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleWhiteOnlyQty(product, bIdx, batchQty + 10)}
                                      className="px-2.5 py-1.5 sm:py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 cursor-pointer"
                                    >
                                      <Plus className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              )}

                              {/* Case A2: Default Code (Pre-coded SKUs — read-only, no Color: White) */}
                              {variantMode === 'default-code' && (
                                <div className="flex items-center justify-between gap-2">
                                  <div className="text-xs font-semibold text-slate-700 whitespace-nowrap truncate">
                                    Default Code: <span className="font-mono font-bold text-[#0F2E52]">{resolvedDefaultCode}</span>
                                  </div>
                                  <div className="flex items-center border border-slate-300 rounded overflow-hidden shrink-0">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleDefaultCodeQty(product, bIdx, batchQty - 10, resolvedDefaultCode)
                                      }
                                      disabled={batchQty === 0}
                                      className="px-2.5 py-1.5 sm:py-1 bg-slate-50 hover:bg-slate-100 disabled:opacity-40 text-slate-700 cursor-pointer"
                                    >
                                      <Minus className="w-3 h-3" />
                                    </button>
                                    <input
                                      type="number"
                                      min="0"
                                      value={batchQty === 0 ? '' : batchQty}
                                      onChange={(e) =>
                                        handleDefaultCodeQty(
                                          product,
                                          bIdx,
                                          parseInt(e.target.value, 10) || 0,
                                          resolvedDefaultCode
                                        )
                                      }
                                      placeholder="0"
                                      className="w-14 sm:w-16 text-center py-1 text-xs font-mono font-bold text-slate-900 focus:outline-none tabular-nums"
                                    />
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleDefaultCodeQty(product, bIdx, batchQty + 10, resolvedDefaultCode)
                                      }
                                      className="px-2.5 py-1.5 sm:py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 cursor-pointer"
                                    >
                                      <Plus className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              )}

                              {/* Case B: Color Glazes */}
                              {variantMode === 'color-glaze' && (
                                <div className="space-y-2">
                                  <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                                    Glaze Colors &amp; Quantities:
                                  </div>
                                  {batch.splits.map((split, sIdx) => (
                                    <div key={sIdx} className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                                      <select
                                        value={split.codeOrColor}
                                        onChange={(e) => handleSplitCodeChange(product, bIdx, sIdx, e.target.value)}
                                        className="flex-1 min-w-0 px-2 py-1.5 sm:py-1 border border-slate-200 rounded text-xs bg-white text-slate-800 truncate"
                                      >
                                        {colorsList.map((c) => (
                                          <option key={c} value={c}>{c}</option>
                                        ))}
                                      </select>
                                      <div className="flex items-center border border-slate-200 rounded overflow-hidden shrink-0">
                                        <button
                                          type="button"
                                          onClick={() => handleSplitQtyChange(product, bIdx, sIdx, split.quantity - 10)}
                                          className="px-2 py-1.5 sm:py-1 bg-slate-50 text-slate-700 cursor-pointer"
                                        >
                                          <Minus className="w-2.5 h-2.5" />
                                        </button>
                                        <input
                                          type="number"
                                          min="0"
                                          value={split.quantity === 0 ? '' : split.quantity}
                                          onChange={(e) => handleSplitQtyChange(product, bIdx, sIdx, parseInt(e.target.value, 10) || 0)}
                                          placeholder="0"
                                          className="w-12 sm:w-14 text-center py-1 text-xs font-mono font-bold text-slate-900 focus:outline-none tabular-nums"
                                        />
                                        <button
                                          type="button"
                                          onClick={() => handleSplitQtyChange(product, bIdx, sIdx, split.quantity + 10)}
                                          className="px-2 py-1.5 sm:py-1 bg-slate-50 text-slate-700 cursor-pointer"
                                        >
                                          <Plus className="w-2.5 h-2.5" />
                                        </button>
                                      </div>
                                      {batch.splits.length > 1 && (
                                        <button
                                          type="button"
                                          onClick={() => handleRemoveSplitRow(product, bIdx, sIdx)}
                                          className="text-slate-400 hover:text-red-600 p-1 cursor-pointer shrink-0"
                                          title="Remove color split"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  ))}
                                  <button
                                    type="button"
                                    onClick={() => handleAddSplitRow(product, bIdx, colorsList[batch.splits.length % colorsList.length] || 'Ivory')}
                                    className="text-[11px] font-semibold text-sky-700 hover:underline flex items-center space-x-1 cursor-pointer pt-0.5"
                                  >
                                    <Plus className="w-3 h-3" />
                                    <span>Add Another Color Split</span>
                                  </button>
                                </div>
                              )}

                              {/* Case C: Design Code Numbers */}
                              {variantMode === 'design-code' && (
                                <div className="space-y-2">
                                  <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                                    Design Codes &amp; Quantities:
                                  </div>
                                  {batch.splits.map((split, sIdx) => (
                                    <div key={sIdx} className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                                      <select
                                        value={split.codeOrColor}
                                        onChange={(e) => handleSplitCodeChange(product, bIdx, sIdx, e.target.value)}
                                        className="flex-1 min-w-0 max-w-[115px] px-2 py-1.5 sm:py-1 border border-slate-200 rounded text-xs bg-white text-slate-800 font-mono font-semibold"
                                      >
                                        {availableCodes.map((cd) => (
                                          <option key={cd} value={cd}>Code {cd}</option>
                                        ))}
                                      </select>
                                      <div className="flex items-center border border-slate-200 rounded overflow-hidden shrink-0 ml-auto">
                                        <button
                                          type="button"
                                          onClick={() => handleSplitQtyChange(product, bIdx, sIdx, split.quantity - 5)}
                                          className="px-2 py-1.5 sm:py-1 bg-slate-50 text-slate-700 cursor-pointer"
                                        >
                                          <Minus className="w-2.5 h-2.5" />
                                        </button>
                                        <input
                                          type="number"
                                          min="0"
                                          value={split.quantity === 0 ? '' : split.quantity}
                                          onChange={(e) => handleSplitQtyChange(product, bIdx, sIdx, parseInt(e.target.value, 10) || 0)}
                                          placeholder="0"
                                          className="w-12 sm:w-14 text-center py-1 text-xs font-mono font-bold text-slate-900 focus:outline-none tabular-nums"
                                        />
                                        <button
                                          type="button"
                                          onClick={() => handleSplitQtyChange(product, bIdx, sIdx, split.quantity + 5)}
                                          className="px-2 py-1.5 sm:py-1 bg-slate-50 text-slate-700 cursor-pointer"
                                        >
                                          <Plus className="w-2.5 h-2.5" />
                                        </button>
                                      </div>
                                      {batch.splits.length > 1 && (
                                        <button
                                          type="button"
                                          onClick={() => handleRemoveSplitRow(product, bIdx, sIdx)}
                                          className="text-slate-400 hover:text-red-600 p-1 cursor-pointer shrink-0"
                                          title="Remove design code"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  ))}
                                  <button
                                    type="button"
                                    onClick={() => handleAddSplitRow(product, bIdx, availableCodes[batch.splits.length % availableCodes.length] || '21')}
                                    className="text-[11px] font-semibold text-sky-700 hover:underline flex items-center space-x-1 cursor-pointer pt-0.5"
                                  >
                                    <Plus className="w-3 h-3" />
                                    <span>Add Another Design Code</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Add Another Grade / Packing Batch Trigger */}
                    <div className="pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => handleAddBatch(product)}
                        className="w-full py-1.5 px-2.5 text-[11px] font-semibold text-[#0F2E52] bg-slate-50 hover:bg-slate-100 border border-dashed border-slate-300 rounded flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                        <span>Add Another Grade / Packing</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Card Footer Summary */}
                <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] font-mono tabular-nums">
                  <span className="text-slate-500">
                    Total: <strong className="text-slate-900">{itemTotalQty} Units</strong>
                    {productBatches.length > 1 && (
                      <span className="text-slate-400"> ({productBatches.length} batches)</span>
                    )}
                  </span>
                  <span className="text-slate-600 font-semibold">
                    Weight: {itemTotalWeight.toFixed(1)} kg
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. STICKY BOTTOM ORDER TRAY */}
      {totalQuantity > 0 && (
        <div
          id="dealer-order-tray"
          className="sticky bottom-3 sm:bottom-4 z-30 bg-slate-900 text-white rounded-lg p-3 sm:p-5 shadow-2xl border border-slate-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 sm:gap-4 max-w-7xl mx-auto"
        >
          <div className="flex items-center space-x-3 sm:space-x-5 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-sky-500/20 border border-sky-400/40 flex items-center justify-center shrink-0">
              <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5 text-sky-400" />
            </div>
            <div className="space-y-0.5 min-w-0">
              <div className="text-[10px] sm:text-[11px] font-mono text-slate-400 uppercase tracking-wider truncate">
                Order Loading Summary
              </div>
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs">
                <span>
                  <strong className="text-white font-mono text-sm tabular-nums">{totalModels}</strong> Models
                  {totalBatches > totalModels && (
                    <span className="text-sky-300 font-mono"> ({totalBatches} rows)</span>
                  )}
                </span>
                <span className="text-slate-600">·</span>
                <span>
                  <strong className="text-emerald-400 font-mono text-sm sm:text-base tabular-nums">{totalQuantity}</strong> Units
                </span>
                <span className="text-slate-600">·</span>
                <span>
                  <strong className="text-amber-300 font-mono text-xs sm:text-sm tabular-nums">{totalWeightKg.toFixed(2)} kg</strong>
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 sm:gap-3 shrink-0">
            {confirmClearDraft ? (
              <div className="flex items-center gap-1.5 bg-slate-800 px-2 py-1 rounded">
                <button
                  type="button"
                  onClick={handleClearOrder}
                  className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs rounded cursor-pointer"
                >
                  Confirm Clear
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClearDraft(false)}
                  className="px-2 py-1 text-slate-300 hover:text-white text-xs cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmClearDraft(true)}
                className="px-3 py-2 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                Clear
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setOrderSubmittedPayload(null);
                setIsFinalizeOpen(true);
              }}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center space-x-2 px-4 sm:px-6 py-2.5 bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs rounded transition-colors shadow-sm cursor-pointer whitespace-nowrap"
            >
              <span>Review &amp; Finalize Order</span>
              <ArrowRight className="w-4 h-4 shrink-0" />
            </button>
          </div>
        </div>
      )}

      {/* 6. FINALIZE MODAL (ORDER SUMMARY SHEET) */}
      {isFinalizeOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-lg max-w-4xl w-full my-auto overflow-hidden shadow-2xl border border-slate-200 flex flex-col max-h-[94dvh] sm:max-h-[92vh]">
            
            {/* Header */}
            <div className="bg-[#0F2E52] text-white px-4 py-3 sm:px-6 sm:py-4 flex items-start sm:items-center justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <span className="text-[10px] font-mono uppercase tracking-widest text-sky-300 block">
                  WHOLESALE ORDER SUMMARY
                </span>
                <h3 className="text-base sm:text-lg font-bold leading-snug">
                  Review &amp; Finalize Dealer Order
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsFinalizeOpen(false)}
                className="text-slate-300 hover:text-white p-1 rounded transition-colors cursor-pointer shrink-0"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-3.5 sm:p-6 overflow-y-auto overflow-x-hidden flex-1 space-y-5 text-xs">
              
              {/* Success View */}
              {orderSubmittedPayload ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 sm:p-6 text-center space-y-4">
                  <div className="w-11 h-11 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm sm:text-base font-bold text-emerald-950">
                      {editingOrder
                        ? 'Order Changes Saved & Synced!'
                        : 'Order Sent Directly to Sales Verification Queue!'}
                    </h4>
                    <p className="text-xs text-emerald-800 mt-1">
                      Order Ref: <strong className="font-mono">{orderSubmittedPayload.orderId}</strong>
                      {orderSubmittedPayload.dealerInfo?.firmName ? ` · ${orderSubmittedPayload.dealerInfo.firmName}` : ''}
                    </p>
                    {editWasAcceptedNotice && (
                      <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-3 py-1.5 mt-2 inline-block">
                        Because this previously accepted order was modified, it has been queued for fresh Sales/Admin verification.
                      </p>
                    )}
                    <p className="text-xs text-emerald-700 mt-1 font-mono tabular-nums">
                      Total: {orderSubmittedPayload.totalQuantity} Units across {orderSubmittedPayload.totalModels} Models · Weight: {orderSubmittedPayload.totalWeightKg.toFixed(2)} kg
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2.5 pt-1">
                    <button
                      type="button"
                      onClick={handleDownloadPDF}
                      className="inline-flex items-center justify-center space-x-1.5 px-4 py-2.5 bg-slate-900 text-white rounded font-bold hover:bg-slate-800 cursor-pointer shadow-xs"
                    >
                      <Download className="w-4 h-4 text-sky-300 shrink-0" />
                      <span>Download PDF</span>
                    </button>
                    <button
                      type="button"
                      onClick={handlePrintPDF}
                      className="inline-flex items-center justify-center space-x-1.5 px-4 py-2.5 bg-white text-slate-900 border border-slate-300 rounded font-bold hover:bg-slate-50 cursor-pointer shadow-xs"
                    >
                      <Printer className="w-4 h-4 text-slate-700 shrink-0" />
                      <span>Print Order Sheet</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleWhatsAppSend}
                      className="inline-flex items-center justify-center space-x-1.5 px-4 py-2.5 bg-[#25D366] text-white rounded font-bold hover:bg-emerald-600 cursor-pointer shadow-xs"
                    >
                      <MessageSquare className="w-4 h-4 shrink-0" />
                      <span>Send to Factory WhatsApp</span>
                    </button>
                  </div>
                </div>
              ) : null}

              {/* Order Matrix Table */}
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-1.5 font-semibold text-slate-900">
                  <span className="font-mono uppercase text-slate-500 text-[11px]">
                    Order Matrix Items ({selectedItemsList.length} {selectedItemsList.length === 1 ? 'Row' : 'Rows'})
                  </span>
                  <span className="font-mono text-slate-700 tabular-nums">
                    Total: {totalQuantity} Units · {totalWeightKg.toFixed(2)} kg
                  </span>
                </div>

                {/* MOBILE-OPTIMIZED STACKED ORDER LIST (Zero Clipping) */}
                <div className="sm:hidden border border-slate-300 rounded overflow-hidden divide-y divide-slate-200 bg-white">
                  {selectedItemsList.map((item, idx) => (
                    <div
                      key={item.batchId || `${item.productId}-${item.grade}-${item.packing}-${idx}`}
                      className="p-3 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-[10px] font-mono text-slate-400">Sr. No. #{idx + 1}</div>
                          <div className="font-bold text-slate-900 text-xs leading-snug break-words">
                            {item.name}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-mono font-bold text-[#0F2E52] text-sm tabular-nums">
                            {item.totalQuantity} Qty
                          </div>
                          <div className="font-mono text-[10px] text-slate-500 tabular-nums">
                            {item.totalWeightKg.toFixed(1)} kg
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-semibold">
                        <span className="border border-slate-300 px-2 py-0.5 rounded bg-white text-slate-700">
                          Packing: {item.packing}
                        </span>
                        <span className="border border-slate-300 px-2 py-0.5 rounded bg-slate-100 text-slate-800">
                          Grade: {item.grade}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-1.5 pt-0.5">
                        {item.colorSplits.map((s, sIdx) => (
                          <div
                            key={sIdx}
                            className="border border-slate-300 rounded overflow-hidden text-center min-w-[54px]"
                          >
                            <div className="bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700 border-b border-slate-300">
                              {s.codeOrColor}
                            </div>
                            <div className="px-2 py-0.5 font-mono font-bold text-slate-900 text-xs tabular-nums">
                              {s.quantity}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  {/* Mobile Manifest Footer */}
                  <div className="bg-slate-100 px-3 py-2.5 flex items-center justify-between font-mono font-bold text-slate-900 text-xs border-t border-slate-300 tabular-nums">
                    <span>Weight : {totalWeightKg.toFixed(2)} kg</span>
                    <span className="text-sm text-[#0F2E52]">Total : {totalQuantity}</span>
                  </div>
                </div>

                {/* DESKTOP EST2627 MATRIX TABLE */}
                <div className="hidden sm:block border border-slate-300 rounded overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-[#0F2E52] text-white text-[11px] font-semibold">
                      <tr>
                        <th className="py-2 px-3 text-center w-10">Sr.</th>
                        <th className="py-2 px-3">Description &amp; Color/Code Matrix</th>
                        <th className="py-2 px-3 text-center w-24">Packing / Grade</th>
                        <th className="py-2 px-3 text-right w-24">Quantity</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-slate-800">
                      {selectedItemsList.map((item, idx) => (
                        <tr
                          key={item.batchId || `${item.productId}-${item.grade}-${item.packing}-${idx}`}
                          className="hover:bg-slate-50/60"
                        >
                          <td className="py-2.5 px-3 text-center font-bold text-slate-400">
                            {idx + 1}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-bold text-slate-900">{item.name}</span>
                              <span className="text-[10px] font-mono text-slate-400 tabular-nums">
                                {item.totalWeightKg.toFixed(1)} kg
                              </span>
                            </div>
                            {/* Horizontal Matrix Grid */}
                            <div className="mt-1.5 inline-block max-w-full overflow-x-auto">
                              <table className="border border-slate-300 text-[11px] text-center border-collapse">
                                <thead>
                                  <tr className="bg-slate-100 text-slate-600">
                                    {item.colorSplits.map((s, sIdx) => (
                                      <th key={sIdx} className="border border-slate-300 px-2 py-0.5 font-semibold text-[10px] whitespace-nowrap">
                                        {s.codeOrColor}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  <tr>
                                    {item.colorSplits.map((s, sIdx) => (
                                      <td key={sIdx} className="border border-slate-300 px-2 py-1 font-mono font-bold text-slate-900 tabular-nums">
                                        {s.quantity}
                                      </td>
                                    ))}
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <div className="inline-flex flex-col gap-1">
                              <span className="border border-slate-300 px-2 py-0.5 rounded text-[10px] font-bold bg-white text-slate-700">
                                {item.packing}
                              </span>
                              <span className="border border-slate-300 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800">
                                {item.grade}
                              </span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 text-sm tabular-nums">
                            {item.totalQuantity}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-100 border-t-2 border-slate-300 font-mono font-bold text-slate-900 text-xs tabular-nums">
                      <tr>
                        <td colSpan={2} className="py-2 px-3">
                          Weight : {totalWeightKg.toFixed(2)} kg
                        </td>
                        <td className="py-2 px-3 text-right">
                          Total :
                        </td>
                        <td className="py-2 px-3 text-right text-base text-[#0F2E52]">
                          {totalQuantity}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Grade & Packing Breakdown Strip */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-[11px] font-mono">
                  <div className="bg-slate-50 border border-slate-200 rounded px-3 py-2 flex items-center justify-between gap-2">
                    <span className="text-slate-500 font-semibold uppercase text-[10px]">By Grade:</span>
                    <div className="flex items-center gap-2.5 text-slate-800 tabular-nums">
                      <span>Uty: <strong>{classificationSummary.grades.Uty}</strong></span>
                      <span className="text-slate-300">|</span>
                      <span>S.Uty: <strong>{classificationSummary.grades['S.Uty']}</strong></span>
                      <span className="text-slate-300">|</span>
                      <span>ROK: <strong>{classificationSummary.grades.ROK}</strong></span>
                    </div>
                  </div>
                  <div className="bg-slate-50 border border-slate-200 rounded px-3 py-2 flex items-center justify-between gap-2">
                    <span className="text-slate-500 font-semibold uppercase text-[10px]">By Packing:</span>
                    <div className="flex items-center gap-3 text-slate-800 tabular-nums">
                      <span>Box: <strong>{classificationSummary.packings.Box}</strong></span>
                      <span className="text-slate-300">|</span>
                      <span>Paper: <strong>{classificationSummary.packings.Paper}</strong></span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Dealer & Order Details Form */}
              <div className="space-y-4 pt-2">
                <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider border-b border-slate-200 pb-2">
                  Dealer &amp; Order Details
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  {/* Organization / Firm Name */}
                  <div className="space-y-1 min-w-0">
                    <label className="text-[11px] font-semibold text-slate-700 flex items-center space-x-1.5">
                      <Building2 className="w-3.5 h-3.5 text-slate-400" />
                      <span>Organization / Firm Name *</span>
                    </label>
                    <input
                      type="text"
                      value={firmName}
                      onChange={(e) => setFirmName(e.target.value)}
                      onBlur={() => setTouched((p) => ({ ...p, firmName: true }))}
                      placeholder="e.g. Apex Ceramics & Bath"
                      className={`w-full px-3 py-2 border rounded text-xs ${
                        touched.firmName && !isFirmValid ? 'border-red-500 bg-red-50/20' : 'border-slate-200'
                      }`}
                    />
                    {touched.firmName && !isFirmValid && (
                      <p className="text-[10px] text-red-600">Organization / firm name is required.</p>
                    )}
                  </div>

                  {/* Person Name */}
                  <div className="space-y-1 min-w-0">
                    <label className="text-[11px] font-semibold text-slate-700">
                      Contact Person Name *
                    </label>
                    <input
                      type="text"
                      value={personName}
                      onChange={(e) => setPersonName(e.target.value)}
                      onBlur={() => setTouched((p) => ({ ...p, personName: true }))}
                      placeholder="e.g. Rajesh Shah"
                      className={`w-full px-3 py-2 border rounded text-xs ${
                        touched.personName && !isPersonValid ? 'border-red-500 bg-red-50/20' : 'border-slate-200'
                      }`}
                    />
                    {touched.personName && !isPersonValid && (
                      <p className="text-[10px] text-red-600">Contact person name is required.</p>
                    )}
                  </div>

                  {/* Mobile Dial Code + Number */}
                  <div className="space-y-1 min-w-0">
                    <label className="text-[11px] font-semibold text-slate-700">
                      WhatsApp / Mobile Contact *
                    </label>
                    <div className="grid grid-cols-12 gap-2">
                      <div className="col-span-5 sm:col-span-4 min-w-0">
                        <select
                          value={phoneCode}
                          onChange={(e) => setPhoneCode(e.target.value)}
                          className="w-full px-2 py-2 border border-slate-200 rounded text-xs font-mono bg-white"
                        >
                          {COUNTRY_DIAL_CODES.map((item) => (
                            <option key={`${item.country}-${item.code}`} value={item.code}>
                              {item.code} ({item.country})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-7 sm:col-span-8 min-w-0">
                        <input
                          type="tel"
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          onBlur={() => setTouched((p) => ({ ...p, phoneNumber: true }))}
                          placeholder="e.g. 98765 43210"
                          className={`w-full px-3 py-2 border rounded text-xs font-mono ${
                            touched.phoneNumber && !isPhoneValid ? 'border-red-500 bg-red-50/20' : 'border-slate-200'
                          }`}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Country */}
                  <div className="space-y-1 min-w-0">
                    <label className="text-[11px] font-semibold text-slate-700">
                      Destination Country
                    </label>
                    <select
                      value={country}
                      onChange={(e) => handleCountryChange(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded text-xs bg-white"
                    >
                      {COUNTRIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  {/* State */}
                  {country === 'India' ? (
                    <div className="space-y-1 min-w-0">
                      <label className="text-[11px] font-semibold text-slate-700">
                        State
                      </label>
                      <select
                        value={state}
                        onChange={(e) => handleStateChange(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded text-xs bg-white"
                      >
                        {INDIAN_STATES.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="space-y-1 min-w-0">
                      <label className="text-[11px] font-semibold text-slate-700">
                        State / Province
                      </label>
                      <input
                        type="text"
                        value={state}
                        onChange={(e) => setState(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded text-xs"
                      />
                    </div>
                  )}

                  {/* District */}
                  {country === 'India' && (
                    <div className="space-y-1 min-w-0">
                      <label className="text-[11px] font-semibold text-slate-700">
                        District
                      </label>
                      <select
                        value={district}
                        onChange={(e) => handleDistrictChange(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded text-xs bg-white"
                      >
                        {getDistrictsForState(state).map((d) => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* City */}
                  {country === 'India' ? (
                    <div className="space-y-1 min-w-0">
                      <label className="text-[11px] font-semibold text-slate-700">
                        City / Hub
                      </label>
                      <select
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded text-xs bg-white"
                      >
                        {getCitiesForDistrict(district, state).map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                      {city === 'Other City' && (
                        <input
                          type="text"
                          value={customCity}
                          onChange={(e) => setCustomCity(e.target.value)}
                          placeholder="Type city name"
                          className="w-full mt-1.5 px-3 py-1.5 border border-slate-200 rounded text-xs"
                        />
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1 min-w-0">
                      <label className="text-[11px] font-semibold text-slate-700">
                        City
                      </label>
                      <input
                        type="text"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-200 rounded text-xs"
                      />
                    </div>
                  )}

                  {/* Required Delivery Schedule (Quick Period Presets + Exact Calendar Date) */}
                  <div className="space-y-2 sm:col-span-2 min-w-0 bg-slate-50 border border-slate-200 rounded-lg p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className="text-[11px] font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-[#0F2E52]" />
                        <span>Required Order Delivery Date / Period</span>
                      </label>
                      {requiredDate && (
                        <span className="text-[11px] font-mono font-semibold text-[#0F2E52] tabular-nums">
                          Target: {formatIsoDateShort(requiredDate)}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {DELIVERY_PERIOD_PRESETS.map((preset) => {
                        const isActive = requiredPeriod === preset.label;
                        return (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() => {
                              setRequiredPeriod(preset.label);
                              setRequiredDate(addDaysIso(preset.days));
                            }}
                            className={`px-2.5 py-1.5 rounded text-[11px] font-semibold border transition-colors cursor-pointer ${
                              isActive
                                ? 'bg-[#0F2E52] text-white border-[#0F2E52]'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {preset.label}
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-1">
                      <label className="text-[11px] font-medium text-slate-600 whitespace-nowrap">
                        Exact Delivery Date:
                      </label>
                      <input
                        type="date"
                        min={addDaysIso(0)}
                        value={requiredDate}
                        onChange={(e) => {
                          setRequiredDate(e.target.value);
                          setRequiredPeriod('Custom Date');
                        }}
                        className="px-3 py-1.5 bg-white border border-slate-200 rounded text-xs font-mono text-slate-900 focus:outline-none focus:border-[#0F2E52]"
                      />
                      <span className="text-[11px] text-slate-500">
                        Selected schedule: <strong className="text-slate-800">{requiredPeriod}</strong>
                      </span>
                    </div>
                  </div>

                  {/* Order Notes */}
                  <div className="space-y-1 sm:col-span-2 min-w-0">
                    <label className="text-[11px] font-semibold text-slate-700">
                      Order Notes (Optional)
                    </label>
                    <input
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="e.g. Loading priority, urgent requirement"
                      className="w-full px-3 py-2 border border-slate-200 rounded text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Clear Instruction Notice: Local PDF vs Sales Submission */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3.5 flex items-start space-x-2.5 text-xs text-amber-950">
                <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div className="space-y-0.5 leading-relaxed">
                  <div className="font-bold text-amber-950">
                    How Order Saving &amp; PDF Copies Work
                  </div>
                  <p className="text-[11px] text-amber-900">
                    <strong>Download PDF</strong> and <strong>Print Order Sheet</strong> keep a copy <strong>only with you</strong> on your device—they do not notify our factory. Click <strong>Save Order to Factory</strong> to send this order directly to our <strong>Sales</strong> team for verification.
                  </p>
                </div>
              </div>

              {/* Action Buttons: Separate PDF Download, Print Sheet, Save to Factory, WhatsApp */}
              <div className="pt-4 border-t border-slate-200 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDownloadPDF}
                    disabled={!isFormValid}
                    className="inline-flex items-center justify-center space-x-1.5 px-3.5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded font-bold text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
                    title="Directly download PDF file to your device (without opening print dialog)"
                  >
                    <Download className="w-3.5 h-3.5 text-sky-300 shrink-0" />
                    <span>Download PDF</span>
                  </button>

                  <button
                    type="button"
                    onClick={handlePrintPDF}
                    disabled={!isFormValid}
                    className="inline-flex items-center justify-center space-x-1.5 px-3.5 py-2.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 rounded font-bold text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
                    title="Open printable order sheet and Print dialog"
                  >
                    <Printer className="w-3.5 h-3.5 text-slate-600 shrink-0" />
                    <span>Print Order Sheet</span>
                  </button>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => void handleSaveOrder()}
                    disabled={!isFormValid || isSubmitting}
                    className="inline-flex items-center justify-center space-x-1.5 px-4 py-2.5 bg-[#0F2E52] hover:bg-[#1e3a5f] text-white rounded font-semibold text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>
                      {isSubmitting
                        ? 'Saving...'
                        : editingOrder
                        ? 'Save Order Changes'
                        : 'Save Order to Factory'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleWhatsAppSend()}
                    disabled={!isFormValid}
                    className="inline-flex items-center justify-center space-x-1.5 px-4 py-2.5 bg-[#25D366] hover:bg-emerald-600 text-white rounded font-bold text-xs transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap"
                  >
                    <MessageSquare className="w-4 h-4 shrink-0" />
                    <span>Send Order via WhatsApp</span>
                  </button>
                </div>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* 7. FLOATING COLLECTION SWITCHER (HOVER ON DESKTOP / TAP ON MOBILE) */}
      <FloatingCollectionSwitcher
        collections={floatingCollections}
        selectedCategory={selectedCategory}
        onSelectCategory={handleSelectCollection}
        hasOrderTray={totalQuantity > 0}
        hidden={isFinalizeOpen}
      />
    </div>
  );
};
