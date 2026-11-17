import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  Factory,
  Plus,
  Search,
  Trash2,
  Check,
  Calendar,
  AlertCircle,
  Lock,
  PackageCheck,
  ArrowUpRight,
  Pencil,
  X,
  ChevronDown
} from 'lucide-react';
import {
  CeramicGrade,
  CeramicPacking,
  DailyProductionEntry,
  ProductItem,
  ProductConfigOverride,
  ProductionQueueItem,
  SavedDealerOrder
} from '../../types';
import {
  buildProductionManufactureTargets,
  formatDeliveryDateLabel,
  getEffectiveVerificationStatus,
  isOrderCompleted,
  makeProductionVariantKey
} from '../../utils/adminRoles';
import { ConfirmDialogConfig } from './adminTypes';
import { useToast } from '../../context/ToastContext';
import { getDefaultProductConfig, extractBuiltInProductCode } from '../../data/productClassifications';

interface OrderLinePickState {
  key: string;
  productId: string;
  productName: string;
  codeOrColor: string;
  orderedQty: number;
  unitWeightKg: number;
  selected: boolean;
  qtyToMake: number;
}

interface AdminProductionPanelProps {
  dealerOrders: SavedDealerOrder[];
  productionQueue: ProductionQueueItem[];
  products: ProductItem[];
  productConfigs: Record<string, ProductConfigOverride>;
  colorsList: string[];
  designCodesList: string[];
  globalDefaultCode?: string;
  dailyProductionLogs: DailyProductionEntry[];
  productionCheckedKeys: Record<string, boolean>;
  canLogProduction: boolean;
  canCheckProduction: boolean;
  canManageQueue: boolean;
  recordedByLabel: string;
  onAddProductionQueueItems: (items: Omit<ProductionQueueItem, 'id' | 'createdAt'>[]) => void;
  onUpdateProductionQueueItem: (id: string, updates: Partial<Omit<ProductionQueueItem, 'id'>>) => void;
  onDeleteProductionQueueItem: (id: string) => void;
  onAddProductionEntry: (entry: Omit<DailyProductionEntry, 'id' | 'createdAt'>) => void;
  onUpdateProductionEntry: (id: string, updates: Partial<Omit<DailyProductionEntry, 'id'>>) => void;
  onSetVariantProducedTotal: (
    item: {
      itemKey: string;
      productId: string;
      productName: string;
      grade?: CeramicGrade | string;
      packing?: CeramicPacking | string;
      codeOrColor: string;
    },
    targetTotal: number,
    recordedBy: string,
    note?: string
  ) => void;
  onDeleteProductionEntry: (id: string) => void;
  onClearProductionLogs: () => void;
  onToggleItemChecked: (itemKey: string, nextVal?: boolean) => void;
  canViewOrders?: boolean;
  onRequestConfirm: (config: ConfirmDialogConfig) => void;
  onJumpToOrders: () => void;
}

const getTodayIso = () => new Date().toISOString().slice(0, 10);

const formatVariantSpec = (grade?: string, packing?: string, codeOrColor?: string): string => {
  return [grade, packing, codeOrColor || 'White']
    .map((part) => (part || '').trim())
    .filter(Boolean)
    .join(' · ');
};

export const AdminProductionPanel: React.FC<AdminProductionPanelProps> = ({
  dealerOrders,
  productionQueue,
  products,
  productConfigs,
  colorsList,
  designCodesList,
  globalDefaultCode = '',
  dailyProductionLogs,
  productionCheckedKeys,
  canLogProduction,
  canCheckProduction,
  canManageQueue,
  recordedByLabel,
  onAddProductionQueueItems,
  onUpdateProductionQueueItem,
  onDeleteProductionQueueItem,
  onAddProductionEntry,
  onUpdateProductionEntry,
  onSetVariantProducedTotal,
  onDeleteProductionEntry,
  onClearProductionLogs,
  onToggleItemChecked,
  canViewOrders = true,
  onRequestConfirm,
  onJumpToOrders
}) => {
  const todayIso = getTodayIso();
  const { toastSuccess, toastError } = useToast();

  const pendingVerificationCount = useMemo(
    () =>
      dealerOrders.filter(
        (ord) => getEffectiveVerificationStatus(ord) === 'pending' && !isOrderCompleted(ord)
      ).length,
    [dealerOrders]
  );

  const requirements = useMemo(
    () => buildProductionManufactureTargets(productionQueue, dealerOrders),
    [productionQueue, dealerOrders]
  );

  const producedByItemKey = useMemo(() => {
    const totals: Record<string, number> = {};
    dailyProductionLogs.forEach((log) => {
      totals[log.itemKey] = (totals[log.itemKey] || 0) + (log.quantityMade || 0);
    });
    return totals;
  }, [dailyProductionLogs]);

  const todayProducedByKey = useMemo(() => {
    const totals: Record<string, number> = {};
    dailyProductionLogs.forEach((log) => {
      if (log.date === todayIso) {
        totals[log.itemKey] = (totals[log.itemKey] || 0) + (log.quantityMade || 0);
      }
    });
    return totals;
  }, [dailyProductionLogs, todayIso]);

  // Daily Production Form State
  const [entryDate, setEntryDate] = useState(todayIso);
  const [selectedItemKey, setSelectedItemKey] = useState<string>('');
  const [qtyMadeInput, setQtyMadeInput] = useState<string>('');
  const [noteInput, setNoteInput] = useState<string>('');
  const [entryFeedback, setEntryFeedback] = useState<string | null>(null);

  // Matrix Filters
  const [matrixSearch, setMatrixSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'remaining' | 'ready'>('all');
  const [historyDateFilter, setHistoryDateFilter] = useState<string>('');

  // Edit Modals State
  const [editingEntry, setEditingEntry] = useState<DailyProductionEntry | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editItemKey, setEditItemKey] = useState('');
  const [editQty, setEditQty] = useState('');
  const [editNotes, setEditNotes] = useState('');

  const [editingVariantKey, setEditingVariantKey] = useState<string | null>(null);
  const [variantTargetQty, setVariantTargetQty] = useState('');
  const [variantAdjustNote, setVariantAdjustNote] = useState('');

  // + Add Item to Manufacture Modal State (Pick from Dealer Order OR Product Catalog)
  const [isAddQueueOpen, setIsAddQueueOpen] = useState(false);
  const [queueSourceTab, setQueueSourceTab] = useState<'order' | 'catalog'>('order');
  const [selectedSourceOrderId, setSelectedSourceOrderId] = useState<string>('');
  const [orderLinePicks, setOrderLinePicks] = useState<OrderLinePickState[]>([]);
  const [catalogProductId, setCatalogProductId] = useState<string>(() => products[0]?.id || '');
  const [catalogDropdownOpen, setCatalogDropdownOpen] = useState(false);
  const [catalogProductSearch, setCatalogProductSearch] = useState('');
  const catalogDropdownRef = useRef<HTMLDivElement>(null);
  const catalogSearchInputRef = useRef<HTMLInputElement>(null);
  const [catalogColorOrCode, setCatalogColorOrCode] = useState<string>('White');
  const [colorDropdownOpen, setColorDropdownOpen] = useState(false);
  const [colorSearch, setColorSearch] = useState('');
  const colorDropdownRef = useRef<HTMLDivElement>(null);
  const colorSearchInputRef = useRef<HTMLInputElement>(null);
  const [catalogQtyToMake, setCatalogQtyToMake] = useState<string>('10');
  const [catalogTargetDate, setCatalogTargetDate] = useState<string>('');
  const [catalogNote, setCatalogNote] = useState<string>('');

  const selectedCatalogProduct = useMemo(
    () => products.find((p) => p.id === catalogProductId) || products[0] || null,
    [products, catalogProductId]
  );

  const filteredCatalogProducts = useMemo(() => {
    const q = catalogProductSearch.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q)
    );
  }, [products, catalogProductSearch]);

  useEffect(() => {
    if (!catalogDropdownOpen) return;
    const focusTimer = window.setTimeout(() => {
      catalogSearchInputRef.current?.focus();
    }, 10);
    const handleClickOutside = (ev: MouseEvent) => {
      if (catalogDropdownRef.current && !catalogDropdownRef.current.contains(ev.target as Node)) {
        setCatalogDropdownOpen(false);
      }
    };
    const handleKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        setCatalogDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [catalogDropdownOpen]);

  useEffect(() => {
    if (!colorDropdownOpen) return;
    const focusTimer = window.setTimeout(() => {
      colorSearchInputRef.current?.focus();
    }, 10);
    const handleClickOutside = (ev: MouseEvent) => {
      if (colorDropdownRef.current && !colorDropdownRef.current.contains(ev.target as Node)) {
        setColorDropdownOpen(false);
      }
    };
    const handleKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        setColorDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [colorDropdownOpen]);

  useEffect(() => {
    if (requirements.length > 0 && !requirements.some((r) => r.itemKey === selectedItemKey)) {
      const firstRemaining = requirements.find(
        (r) => (producedByItemKey[r.itemKey] || 0) < r.totalOrderedQty
      );
      setSelectedItemKey((firstRemaining || requirements[0]).itemKey);
    }
  }, [requirements, selectedItemKey, producedByItemKey]);

  const enrichedRows = useMemo(() => {
    return requirements.map((req) => {
      const producedQty = producedByItemKey[req.itemKey] || 0;
      const producedToday = todayProducedByKey[req.itemKey] || 0;
      const remainingQty = Math.max(0, req.totalOrderedQty - producedQty);
      const reachedQuota = req.totalOrderedQty > 0 && producedQty >= req.totalOrderedQty;
      const manualOverride = productionCheckedKeys[req.itemKey];
      const isReady = manualOverride !== undefined ? manualOverride : reachedQuota;
      const pct = req.totalOrderedQty > 0 ? Math.min(100, Math.round((producedQty / req.totalOrderedQty) * 100)) : 0;
      return {
        ...req,
        producedQty,
        producedToday,
        remainingQty,
        reachedQuota,
        isReady,
        pct
      };
    });
  }, [requirements, producedByItemKey, todayProducedByKey, productionCheckedKeys]);

  const filteredRows = useMemo(() => {
    return enrichedRows.filter((row) => {
      if (statusFilter === 'remaining' && row.isReady) return false;
      if (statusFilter === 'ready' && !row.isReady) return false;
      if (!matrixSearch.trim()) return true;
      const q = matrixSearch.toLowerCase();
      return (
        row.productName.toLowerCase().includes(q) ||
        (row.grade || '').toLowerCase().includes(q) ||
        (row.packing || '').toLowerCase().includes(q) ||
        row.codeOrColor.toLowerCase().includes(q)
      );
    });
  }, [enrichedRows, statusFilter, matrixSearch]);

  const totals = useMemo(() => {
    const requiredTotal = enrichedRows.reduce((s, r) => s + r.totalOrderedQty, 0);
    const producedTotal = enrichedRows.reduce((s, r) => s + r.producedQty, 0);
    const remainingTotal = enrichedRows.reduce((s, r) => s + r.remainingQty, 0);
    const readyCount = enrichedRows.filter((r) => r.isReady).length;
    const todayTotal = dailyProductionLogs
      .filter((l) => l.date === todayIso)
      .reduce((s, l) => s + l.quantityMade, 0);
    return { requiredTotal, producedTotal, remainingTotal, readyCount, todayTotal };
  }, [enrichedRows, dailyProductionLogs, todayIso]);

  const selectedRequirement = enrichedRows.find((r) => r.itemKey === selectedItemKey);

  const flashFeedback = (msg: string) => {
    setEntryFeedback(msg);
    setTimeout(() => setEntryFeedback(null), 4000);
    toastSuccess(msg, 'Production Updated');
  };

  const activePickableOrders = useMemo(
    () =>
      dealerOrders.filter(
        (ord) => getEffectiveVerificationStatus(ord) !== 'rejected' && !isOrderCompleted(ord)
      ),
    [dealerOrders]
  );

  const populateOrderLinesForOrderId = (orderId: string) => {
    const found = dealerOrders.find((o) => o.id === orderId);
    if (!found) {
      setOrderLinePicks([]);
      return;
    }
    const mergedMap = new Map<string, OrderLinePickState>();
    (found.items || []).forEach((item) => {
      const unitWeightKg = Number(item.unitWeightKg) || 15;
      const splits =
        item.colorSplits && item.colorSplits.length > 0
          ? item.colorSplits
          : [{ codeOrColor: 'White', quantity: item.totalQuantity || 0 }];
      splits.forEach((split) => {
        if (!split.quantity || split.quantity <= 0) return;
        const codeOrColor = (split.codeOrColor || 'White').trim();
        const mergeKey = `${found.id}::${item.productId}::${codeOrColor.toLowerCase()}`;
        const existing = mergedMap.get(mergeKey);
        if (existing) {
          existing.orderedQty += split.quantity;
          existing.qtyToMake += split.quantity;
        } else {
          mergedMap.set(mergeKey, {
            key: mergeKey,
            productId: item.productId,
            productName: item.name,
            codeOrColor,
            orderedQty: split.quantity,
            unitWeightKg,
            selected: false,
            qtyToMake: split.quantity
          });
        }
      });
    });
    setOrderLinePicks(Array.from(mergedMap.values()));
  };

  const getColorOptionsForProduct = (productId: string): string[] => {
    const prod = products.find((p) => p.id === productId);
    const defaultCfg = prod ? getDefaultProductConfig(prod) : undefined;
    const mode = productConfigs[productId]?.variantMode || prod?.variantMode || defaultCfg?.variantMode || 'white-only';
    if (mode === 'design-code') {
      const overrideCodes = productConfigs[productId]?.availableDesignCodes;
      if (overrideCodes && overrideCodes.length > 0) return overrideCodes;
      if (prod?.defaultDesignCodes && prod.defaultDesignCodes.length > 0) return prod.defaultDesignCodes;
      return designCodesList.length > 0 ? designCodesList : ['White'];
    }
    if (mode === 'default-code') {
      const code =
        productConfigs[productId]?.defaultCode?.trim() ||
        prod?.defaultCode?.trim() ||
        defaultCfg?.defaultCode?.trim() ||
        (prod ? extractBuiltInProductCode(prod.name) : null) ||
        globalDefaultCode.trim() ||
        'Default';
      return [code];
    }
    if (mode === 'color-glaze') return colorsList.length > 0 ? colorsList : ['White'];
    return ['White'];
  };

  const getAllColorAndCodeOptions = (productId: string): Array<{ value: string; group: string }> => {
    const seen = new Set<string>();
    const result: Array<{ value: string; group: string }> = [];
    const addOption = (raw: string, group: string) => {
      const cleaned = raw.trim();
      if (!cleaned) return;
      const key = cleaned.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      result.push({ value: cleaned, group });
    };

    // 1. Product-specific primary options first
    getColorOptionsForProduct(productId).forEach((val) => addOption(val, 'Suggested'));
    // 2. All Factory Colors from Admin -> Colors & Codes
    colorsList.forEach((col) => addOption(col, 'Color'));
    // 3. All Master Design Codes from Admin -> Colors & Codes
    designCodesList.forEach((cd) => addOption(cd, 'Code'));
    if (globalDefaultCode.trim()) {
      addOption(globalDefaultCode, 'Code');
    }
    addOption('White', 'Color');

    return result;
  };

  const allColorAndCodeOptions = useMemo(
    () => getAllColorAndCodeOptions(catalogProductId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [catalogProductId, products, productConfigs, colorsList, designCodesList, globalDefaultCode]
  );

  const filteredColorOptions = useMemo(() => {
    const q = colorSearch.trim().toLowerCase();
    if (!q) return allColorAndCodeOptions;
    return allColorAndCodeOptions.filter(
      (opt) => opt.value.toLowerCase().includes(q) || opt.group.toLowerCase().includes(q)
    );
  }, [allColorAndCodeOptions, colorSearch]);

  const openAddQueueModal = () => {
    if (!canManageQueue) return;
    const defaultTab = activePickableOrders.length > 0 ? 'order' : 'catalog';
    setQueueSourceTab(defaultTab);
    if (activePickableOrders.length > 0) {
      const firstId = activePickableOrders[0].id;
      setSelectedSourceOrderId(firstId);
      populateOrderLinesForOrderId(firstId);
    } else {
      setSelectedSourceOrderId('');
      setOrderLinePicks([]);
    }
    const firstProdId = products[0]?.id || '';
    setCatalogProductId(firstProdId);
    setCatalogDropdownOpen(false);
    setCatalogProductSearch('');
    setColorDropdownOpen(false);
    setColorSearch('');
    const opts = getColorOptionsForProduct(firstProdId);
    setCatalogColorOrCode(opts[0] || colorsList[0] || 'White');
    setCatalogQtyToMake('10');
    setCatalogTargetDate('');
    setCatalogNote('');
    setIsAddQueueOpen(true);
  };

  const handleSubmitAddFromOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageQueue) return;
    const srcOrder = dealerOrders.find((o) => o.id === selectedSourceOrderId);
    if (!srcOrder) {
      toastError('Select a valid dealer order first.', 'Order Required');
      return;
    }
    const picked = orderLinePicks.filter((l) => l.selected && l.qtyToMake > 0);
    if (picked.length === 0) {
      toastError('Select at least one order line item with quantity > 0.', 'No Items Selected');
      return;
    }

    const firmName = (srcOrder.dealerInfo?.firmName || '').trim();
    const dealerName = (srcOrder.personName || srcOrder.dealerInfo?.contactPerson || firmName || 'Dealer').trim();
    const orderCode = srcOrder.orderId || srcOrder.id;

    onAddProductionQueueItems(
      picked.map((l) => ({
        itemKey: makeProductionVariantKey(l.productId, '', '', l.codeOrColor),
        sourceType: 'order-shortage',
        sourceOrderId: srcOrder.id,
        sourceOrderCode: orderCode,
        firmName,
        dealerName,
        productId: l.productId,
        productName: l.productName,
        codeOrColor: l.codeOrColor,
        quantityToMake: Math.max(1, Math.round(l.qtyToMake)),
        unitWeightKg: l.unitWeightKg,
        requiredDate: srcOrder.requiredDate,
        requiredPeriod: srcOrder.requiredPeriod,
        notes: 'Added from order to Production',
        addedBy: recordedByLabel
      }))
    );

    setIsAddQueueOpen(false);
    flashFeedback(`Added ${picked.length} item${picked.length === 1 ? '' : 's'} from ${orderCode} to Production Tracker.`);
  };

  const handleSubmitAddFromCatalog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageQueue) return;
    const prod = products.find((p) => p.id === catalogProductId);
    const qty = parseInt(catalogQtyToMake, 10);
    if (!prod || isNaN(qty) || qty <= 0) {
      toastError('Select a product and enter a valid positive quantity.', 'Invalid Input');
      return;
    }

    const code = catalogColorOrCode.trim() || 'White';
    const unitWeightKg = productConfigs[prod.id]?.weightKg ?? prod.weightKg ?? 15;
    const itemKey = makeProductionVariantKey(prod.id, '', '', code);

    onAddProductionQueueItems([
      {
        itemKey,
        sourceType: 'manual-catalog',
        firmName: catalogNote.trim() || 'Manual Stock Build',
        dealerName: recordedByLabel,
        productId: prod.id,
        productName: prod.name,
        codeOrColor: code,
        quantityToMake: qty,
        unitWeightKg,
        requiredDate: catalogTargetDate || undefined,
        notes: catalogNote.trim() || 'Manual manufacture target',
        addedBy: recordedByLabel
      }
    ]);

    setIsAddQueueOpen(false);
    flashFeedback(`Added ${qty} units of ${prod.name} (${code}) to Production Tracker.`);
  };

  const handleLogSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canLogProduction) return;
    const req = requirements.find((r) => r.itemKey === selectedItemKey);
    const qty = parseInt(qtyMadeInput, 10);
    if (!req || isNaN(qty) || qty <= 0) {
      toastError('Select a production target and enter a valid quantity > 0.', 'Invalid Quantity');
      return;
    }

    onAddProductionEntry({
      date: entryDate || todayIso,
      itemKey: req.itemKey,
      productId: req.productId,
      productName: req.productName,
      grade: req.grade || undefined,
      packing: req.packing || undefined,
      codeOrColor: req.codeOrColor,
      quantityMade: qty,
      recordedBy: recordedByLabel,
      notes: noteInput.trim() || undefined
    });

    const newTotal = (producedByItemKey[req.itemKey] || 0) + qty;
    if (newTotal >= req.totalOrderedQty && canCheckProduction) {
      onToggleItemChecked(req.itemKey, true);
    }

    setQtyMadeInput('');
    setNoteInput('');
    flashFeedback(`Logged ${qty} units of ${req.productName} (${formatVariantSpec(req.grade, req.packing, req.codeOrColor)}).`);
  };

  const openEditEntryModal = (log: DailyProductionEntry) => {
    setEditingEntry(log);
    setEditDate(log.date);
    setEditItemKey(log.itemKey);
    setEditQty(String(log.quantityMade));
    setEditNotes(log.notes || '');
  };

  const handleSaveEntryEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEntry || !canLogProduction) return;
    const parsedQty = parseInt(editQty, 10);
    if (isNaN(parsedQty) || parsedQty <= 0) {
      toastError('Production quantity must be greater than 0.', 'Invalid Quantity');
      return;
    }

    const matchedReq = requirements.find((r) => r.itemKey === editItemKey);
    const nextItemKey = matchedReq ? matchedReq.itemKey : editingEntry.itemKey;

    onUpdateProductionEntry(editingEntry.id, {
      date: editDate || editingEntry.date,
      itemKey: nextItemKey,
      productId: matchedReq ? matchedReq.productId : editingEntry.productId,
      productName: matchedReq ? matchedReq.productName : editingEntry.productName,
      grade: matchedReq ? matchedReq.grade : editingEntry.grade,
      packing: matchedReq ? matchedReq.packing : editingEntry.packing,
      codeOrColor: matchedReq ? matchedReq.codeOrColor : editingEntry.codeOrColor,
      quantityMade: parsedQty,
      notes: editNotes.trim() || undefined
    });

    // Recalculate auto ready state for affected variant(s)
    if (canCheckProduction) {
      const targetReq = requirements.find((r) => r.itemKey === nextItemKey);
      if (targetReq) {
        const recalculated = dailyProductionLogs.reduce((sum, l) => {
          if (l.id === editingEntry.id) return nextItemKey === l.itemKey ? sum : sum;
          return l.itemKey === nextItemKey ? sum + (l.quantityMade || 0) : sum;
        }, parsedQty);
        onToggleItemChecked(nextItemKey, recalculated >= targetReq.totalOrderedQty);
      }
      if (nextItemKey !== editingEntry.itemKey) {
        const oldReq = requirements.find((r) => r.itemKey === editingEntry.itemKey);
        if (oldReq) {
          const oldRemainingTotal = dailyProductionLogs.reduce((sum, l) => {
            if (l.id === editingEntry.id) return sum;
            return l.itemKey === editingEntry.itemKey ? sum + (l.quantityMade || 0) : sum;
          }, 0);
          onToggleItemChecked(editingEntry.itemKey, oldRemainingTotal >= oldReq.totalOrderedQty);
        }
      }
    }

    setEditingEntry(null);
    flashFeedback('Production log entry updated successfully.');
  };

  const editingVariantRow = useMemo(
    () => enrichedRows.find((r) => r.itemKey === editingVariantKey) || null,
    [enrichedRows, editingVariantKey]
  );

  const editingVariantLogs = useMemo(
    () => (editingVariantKey ? dailyProductionLogs.filter((l) => l.itemKey === editingVariantKey) : []),
    [dailyProductionLogs, editingVariantKey]
  );

  const openEditVariantModal = (row: (typeof enrichedRows)[number]) => {
    setEditingVariantKey(row.itemKey);
    setVariantTargetQty(String(row.producedQty));
    setVariantAdjustNote('');
  };

  const handleSaveVariantTotal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVariantRow || !canLogProduction) return;
    const nextTotal = parseInt(variantTargetQty, 10);
    if (isNaN(nextTotal) || nextTotal < 0) {
      toastError('Produced total cannot be negative.', 'Invalid Total');
      return;
    }

    onSetVariantProducedTotal(
      {
        itemKey: editingVariantRow.itemKey,
        productId: editingVariantRow.productId,
        productName: editingVariantRow.productName,
        grade: editingVariantRow.grade,
        packing: editingVariantRow.packing,
        codeOrColor: editingVariantRow.codeOrColor
      },
      nextTotal,
      recordedByLabel,
      variantAdjustNote
    );

    if (canCheckProduction) {
      onToggleItemChecked(
        editingVariantRow.itemKey,
        nextTotal >= editingVariantRow.totalOrderedQty
      );
    }

    setEditingVariantKey(null);
    flashFeedback(
      `Updated produced total for ${editingVariantRow.productName} (${editingVariantRow.codeOrColor}) to ${nextTotal} units.`
    );
  };

  const filteredLogs = useMemo(() => {
    return dailyProductionLogs.filter((log) => {
      if (historyDateFilter && log.date !== historyDateFilter) return false;
      if (!matrixSearch.trim()) return true;
      const q = matrixSearch.toLowerCase();
      return (
        log.productName.toLowerCase().includes(q) ||
        log.codeOrColor.toLowerCase().includes(q) ||
        (log.notes || '').toLowerCase().includes(q)
      );
    });
  }, [dailyProductionLogs, historyDateFilter, matrixSearch]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-700 mb-1">
            Factory Floor &amp; Daily Output
          </p>
          <h1 className="font-display font-bold text-2xl text-slate-900">
            Production Tracker &amp; Daily Log
          </h1>
          <p className="text-xs text-slate-500 mt-0.5 max-w-2xl">
            Tracks unavailable order items and manual manufacture targets grouped by Product &amp; Color/Code (Grade &amp; Packing decided at final sorting).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {canManageQueue && (
            <button
              type="button"
              onClick={openAddQueueModal}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center space-x-1.5 cursor-pointer whitespace-nowrap shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Item to Manufacture</span>
            </button>
          )}
          {canViewOrders && (
            <button
              type="button"
              onClick={onJumpToOrders}
              className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors flex items-center space-x-1.5 cursor-pointer whitespace-nowrap"
            >
              <span>View Dealer Orders</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-slate-500" />
            </button>
          )}
        </div>
      </div>

      {/* Pending Verification Notice */}
      {pendingVerificationCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-amber-900">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              <strong>{pendingVerificationCount}</strong> incoming dealer {pendingVerificationCount === 1 ? 'order is' : 'orders are'} waiting for verification. Only items marked <strong>Not Available in Stock</strong> enter Production.
            </span>
          </div>
          {canViewOrders && (
            <button
              type="button"
              onClick={onJumpToOrders}
              className="text-xs font-bold text-amber-900 underline hover:text-amber-700 cursor-pointer self-start sm:self-auto shrink-0"
            >
              Verify Pending Orders
            </button>
          )}
        </div>
      )}

      {/* 4 KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500">Total To Manufacture</div>
          <div className="text-2xl font-display font-bold text-slate-900 tabular-nums mt-1">
            {totals.requiredTotal} Units
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500">Produced To Date</div>
          <div className="text-2xl font-display font-bold text-blue-700 tabular-nums mt-1">
            {totals.producedTotal} Units
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
            Today: {totals.todayTotal} units
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500">Remaining To Make</div>
          <div className="text-2xl font-display font-bold text-amber-700 tabular-nums mt-1">
            {totals.remainingTotal} Units
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500">Items Checked Ready</div>
          <div className="text-2xl font-display font-bold text-emerald-700 tabular-nums mt-1">
            {totals.readyCount} / {enrichedRows.length}
          </div>
        </div>
      </div>

      {/* Daily Production Entry Card */}
      {canLogProduction ? (
        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div className="flex items-center space-x-2">
              <Factory className="w-4 h-4 text-blue-600" />
              <h2 className="font-display font-bold text-sm text-slate-900">
                Log Everyday Factory Production
              </h2>
            </div>
          </div>

          {requirements.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-500">
              No unavailable or custom manufacture items in Production right now. Verify a dealer order&apos;s unavailable items or click <strong>+ Add Item to Manufacture</strong>.
            </div>
          ) : (
            <form onSubmit={handleLogSubmit} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              <div className="sm:col-span-3 space-y-1">
                <label className="block text-[11px] font-semibold text-slate-700">
                  Production Date
                </label>
                <input
                  type="date"
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500"
                />
              </div>

              <div className="sm:col-span-4 space-y-1">
                <label className="block text-[11px] font-semibold text-slate-700">
                  Production Variant (Product · Color/Code)
                </label>
                <select
                  value={selectedItemKey}
                  onChange={(e) => setSelectedItemKey(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500"
                >
                  {enrichedRows.map((row) => (
                    <option key={row.itemKey} value={row.itemKey}>
                      {row.productName} · {formatVariantSpec(row.grade, row.packing, row.codeOrColor)} (Rem: {row.remainingQty})
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2 space-y-1">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-semibold text-slate-700">
                    Qty Made Today
                  </label>
                  {selectedRequirement && selectedRequirement.remainingQty > 0 && (
                    <button
                      type="button"
                      onClick={() => setQtyMadeInput(String(selectedRequirement.remainingQty))}
                      className="text-[10px] font-semibold text-blue-700 hover:underline cursor-pointer"
                    >
                      Fill Rem ({selectedRequirement.remainingQty})
                    </button>
                  )}
                </div>
                <input
                  type="number"
                  min="1"
                  required
                  placeholder="e.g. 15"
                  value={qtyMadeInput}
                  onChange={(e) => setQtyMadeInput(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500 tabular-nums"
                />
              </div>

              <div className="sm:col-span-3 flex gap-2 items-end">
                <div className="flex-1 space-y-1">
                  <label className="block text-[11px] font-semibold text-slate-700">
                    Shift / Kiln Note
                  </label>
                  <input
                    type="text"
                    placeholder="Optional note..."
                    value={noteInput}
                    onChange={(e) => setNoteInput(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={!qtyMadeInput || parseInt(qtyMadeInput, 10) <= 0}
                  className="px-4 py-2 min-h-[38px] bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors flex items-center space-x-1.5 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Log Output</span>
                </button>
              </div>
            </form>
          )}

          {entryFeedback && (
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-medium text-emerald-800">
              {entryFeedback}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 flex items-center space-x-2.5 text-xs text-slate-600">
          <Lock className="w-4 h-4 text-slate-400 shrink-0" />
          <span>
            Read-only production visibility. Logging daily factory output, editing produced totals, and checking finished items are restricted to <strong>Production Manager</strong> and <strong>Admin</strong>.
          </span>
        </div>
      )}

      {/* Required Production & Remaining Matrix */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-3.5 sm:p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Filter by product or color/code..."
                value={matrixSearch}
                onChange={(e) => setMatrixSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500"
              />
            </div>

            <div className="inline-flex items-center p-1 bg-slate-100 rounded-lg text-xs font-semibold">
              {([
                { id: 'all', label: `All (${enrichedRows.length})` },
                { id: 'remaining', label: `Pending (${enrichedRows.filter((r) => !r.isReady).length})` },
                { id: 'ready', label: `Ready (${enrichedRows.filter((r) => r.isReady).length})` }
              ] as const).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                    statusFilter === tab.id ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {(canLogProduction || canCheckProduction) && (
            <div className="text-xs text-slate-500">
              Click <strong>Edit</strong> on any row to fix produced numbers, or check Done when finished.
            </div>
          )}
        </div>

        {filteredRows.length === 0 ? (
          <div className="py-12 px-4 text-center">
            <PackageCheck className="w-9 h-9 text-slate-300 mx-auto mb-2" />
            <div className="text-sm font-semibold text-slate-700">
              {enrichedRows.length === 0 ? 'No Items Queued in Production Tracker' : 'No variants match current filter'}
            </div>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Only unavailable order items marked during order verification or items added manually via + Add Item to Manufacture appear here.
            </p>
            {enrichedRows.length === 0 && canManageQueue && (
              <button
                type="button"
                onClick={openAddQueueModal}
                className="mt-3 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg inline-flex items-center space-x-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Item to Manufacture</span>
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Mobile Stacked Cards */}
            <div className="divide-y divide-slate-200 md:hidden">
              {filteredRows.map((row) => (
                <div key={row.itemKey} className={`p-4 space-y-2.5 ${row.isReady ? 'bg-emerald-50/30' : ''}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5 min-w-0">
                      {canCheckProduction ? (
                        <button
                          type="button"
                          onClick={() => onToggleItemChecked(row.itemKey, !row.isReady)}
                          className={`mt-0.5 w-6 h-6 rounded border flex items-center justify-center shrink-0 cursor-pointer ${
                            row.isReady
                              ? 'bg-emerald-600 border-emerald-600 text-white'
                              : 'bg-white border-slate-300 text-transparent hover:border-blue-500'
                          }`}
                          title="Mark item ready / produced"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <span
                          className={`mt-1 text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                            row.isReady ? 'text-emerald-700' : 'text-amber-700'
                          }`}
                        >
                          {row.isReady ? 'Ready' : 'Pending'}
                        </span>
                      )}
                      <div className="min-w-0">
                        <div className={`font-bold text-sm ${row.isReady ? 'line-through text-slate-500' : 'text-slate-900'}`}>
                          {row.productName}
                        </div>
                        <div className="text-xs text-slate-600">
                          {row.grade ? `${row.grade} · ` : ''}
                          {row.packing ? `${row.packing} · ` : ''}
                          <strong className="text-slate-900">{row.codeOrColor}</strong>
                        </div>
                      </div>
                    </div>
                    <div className="text-right font-mono tabular-nums shrink-0">
                      <div className="text-xs font-bold text-amber-700">Rem: {row.remainingQty}</div>
                      <div className="text-[11px] text-slate-500">Req: {row.totalOrderedQty}</div>
                    </div>
                  </div>

                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${row.isReady ? 'bg-emerald-600' : 'bg-blue-600'}`}
                      style={{ width: `${row.pct}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono tabular-nums">
                    <span>Produced: {row.producedQty} (Today: {row.producedToday})</span>
                    <div className="flex items-center space-x-2">
                      <span>Due: {row.earliestDueDate ? formatDeliveryDateLabel(row.earliestDueDate) : 'Standard'}</span>
                      {canLogProduction && (
                        <button
                          type="button"
                          onClick={() => openEditVariantModal(row)}
                          className="px-2 py-1 bg-slate-100 hover:bg-blue-50 text-blue-700 font-sans font-semibold rounded border border-slate-200 flex items-center space-x-1 cursor-pointer"
                        >
                          <Pencil className="w-3 h-3" />
                          <span>Edit</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Production Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 text-[11px] uppercase tracking-wider font-semibold">
                    <th className="py-3 px-4 w-16 text-center">{canCheckProduction ? 'Done' : 'Status'}</th>
                    <th className="py-3 px-4">Product Specification</th>
                    <th className="py-3 px-4">Earliest Target</th>
                    <th className="py-3 px-4 text-right">To Make</th>
                    <th className="py-3 px-4 text-right">Today</th>
                    <th className="py-3 px-4 text-right">Produced</th>
                    <th className="py-3 px-4 text-right">Remaining</th>
                    <th className="py-3 px-4 w-36">Progress</th>
                    {canLogProduction && <th className="py-3 px-4 text-right">Edit</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRows.map((row) => (
                    <tr
                      key={row.itemKey}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        row.isReady ? 'bg-emerald-50/30' : ''
                      }`}
                    >
                      <td className="py-3 px-4 text-center">
                        {canCheckProduction ? (
                          <button
                            type="button"
                            onClick={() => onToggleItemChecked(row.itemKey, !row.isReady)}
                            className={`w-6 h-6 rounded border inline-flex items-center justify-center cursor-pointer transition-colors ${
                              row.isReady
                                ? 'bg-emerald-600 border-emerald-600 text-white'
                                : 'bg-white border-slate-300 text-transparent hover:border-blue-500'
                            }`}
                            title="Toggle item ready status"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <span
                            className={`text-[11px] font-bold uppercase tracking-wider ${
                              row.isReady ? 'text-emerald-700' : 'text-amber-700'
                            }`}
                          >
                            {row.isReady ? 'Ready' : 'Pending'}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className={`font-semibold ${row.isReady ? 'line-through text-slate-500' : 'text-slate-900'}`}>
                          {row.productName}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {row.grade && (
                            <>
                              <span className="font-semibold text-amber-800">{row.grade}</span>
                              <span className="mx-1.5" aria-hidden="true">·</span>
                            </>
                          )}
                          {row.packing && (
                            <>
                              <span>{row.packing}</span>
                              <span className="mx-1.5" aria-hidden="true">·</span>
                            </>
                          )}
                          <span className="font-mono font-semibold text-slate-800">{row.codeOrColor}</span>
                          <span className="mx-1.5" aria-hidden="true">·</span>
                          <span>{row.contributingOrders.length} {row.contributingOrders.length === 1 ? 'target' : 'targets'}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px] text-slate-600 tabular-nums">
                        {row.earliestDueDate ? formatDeliveryDateLabel(row.earliestDueDate) : '—'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 tabular-nums">
                        {row.totalOrderedQty}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-600 tabular-nums">
                        {row.producedToday > 0 ? `+${row.producedToday}` : '0'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-blue-700 tabular-nums">
                        {row.producedQty}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold tabular-nums">
                        <span className={row.remainingQty === 0 ? 'text-emerald-700' : 'text-amber-700'}>
                          {row.remainingQty}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-2">
                          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                row.isReady ? 'bg-emerald-600' : 'bg-blue-600'
                              }`}
                              style={{ width: `${row.pct}%` }}
                            />
                          </div>
                          <span className="text-[11px] font-mono tabular-nums text-slate-600 w-9 text-right">
                            {row.pct}%
                          </span>
                        </div>
                      </td>
                      {canLogProduction && (
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => openEditVariantModal(row)}
                            className="px-2.5 py-1.5 bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 rounded-lg text-[11px] font-semibold inline-flex items-center space-x-1 cursor-pointer transition-colors"
                            title="Edit produced total or view logs for this variant"
                          >
                            <Pencil className="w-3 h-3" />
                            <span>Edit</span>
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Everyday Production Log History */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-slate-600" />
            <span className="font-bold text-xs uppercase tracking-wider text-slate-900">
              Daily Production History ({filteredLogs.length})
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={historyDateFilter}
              onChange={(e) => setHistoryDateFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-800"
              aria-label="Filter production history by date"
            />
            {historyDateFilter && (
              <button
                type="button"
                onClick={() => setHistoryDateFilter('')}
                className="text-xs font-semibold text-blue-600 hover:underline cursor-pointer"
              >
                All Dates
              </button>
            )}
            {canLogProduction && dailyProductionLogs.length > 0 && (
              <button
                type="button"
                onClick={() =>
                  onRequestConfirm({
                    title: 'Clear Daily Production History?',
                    message: `This will remove all ${dailyProductionLogs.length} daily production log entries. Remaining order counts will reset to 0.`,
                    confirmLabel: 'Clear History',
                    tone: 'danger',
                    onConfirm: onClearProductionLogs
                  })
                }
                className="px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg cursor-pointer"
              >
                Clear Logs
              </button>
            )}
          </div>
        </div>

        {filteredLogs.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            {historyDateFilter
              ? `No production entries recorded for ${formatDeliveryDateLabel(historyDateFilter)}.`
              : 'No daily production entries logged yet.'}
          </div>
        ) : (
          <>
            {/* Mobile Log Cards */}
            <div className="divide-y divide-slate-200 md:hidden">
              {filteredLogs.map((log) => (
                <div key={log.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-xs text-slate-900">
                        {log.productName} ({formatVariantSpec(log.grade, log.packing, log.codeOrColor)})
                      </div>
                      <div className="text-[11px] font-mono text-slate-500 mt-0.5 tabular-nums">
                        {formatDeliveryDateLabel(log.date)} · {log.createdAt} · {log.recordedBy}
                      </div>
                    </div>
                    <div className="font-mono font-bold text-sm text-blue-700 tabular-nums shrink-0">
                      +{log.quantityMade}
                    </div>
                  </div>
                  {log.notes && <div className="text-xs text-slate-600">Note: {log.notes}</div>}
                  {canLogProduction && (
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => openEditEntryModal(log)}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 rounded-lg text-xs font-semibold flex items-center space-x-1 cursor-pointer"
                      >
                        <Pencil className="w-3 h-3" />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          onRequestConfirm({
                            title: 'Remove Production Entry?',
                            message: `Delete +${log.quantityMade} units of ${log.productName} (${log.codeOrColor}) logged on ${formatDeliveryDateLabel(log.date)}?`,
                            confirmLabel: 'Remove Entry',
                            tone: 'danger',
                            onConfirm: () => onDeleteProductionEntry(log.id)
                          })
                        }
                        className="px-2.5 py-1.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold flex items-center space-x-1 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Delete</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Desktop Log Table */}
            <div className="hidden md:block overflow-x-auto max-h-80">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wider font-semibold text-slate-500 border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th className="py-2.5 px-4">Date &amp; Time</th>
                    <th className="py-2.5 px-4">Product &amp; Variant</th>
                    <th className="py-2.5 px-4 text-right">Qty Made</th>
                    <th className="py-2.5 px-4">Recorded By</th>
                    <th className="py-2.5 px-4">Notes</th>
                    {canLogProduction && <th className="py-2.5 px-4 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-4 whitespace-nowrap font-mono text-[11px] text-slate-700 tabular-nums">
                        <span className="font-semibold text-slate-900">{formatDeliveryDateLabel(log.date)}</span>
                        <span className="text-slate-400 ml-1.5">{log.createdAt}</span>
                      </td>
                      <td className="py-2.5 px-4">
                        <span className="font-semibold text-slate-900">{log.productName}</span>
                        <span className="text-slate-500 ml-1.5">
                          ({formatVariantSpec(log.grade, log.packing, log.codeOrColor)})
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-blue-700 tabular-nums">
                        +{log.quantityMade}
                      </td>
                      <td className="py-2.5 px-4 whitespace-nowrap text-slate-600">{log.recordedBy}</td>
                      <td className="py-2.5 px-4 text-slate-500 max-w-xs truncate">{log.notes || '—'}</td>
                      {canLogProduction && (
                        <td className="py-2.5 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center space-x-1">
                            <button
                              type="button"
                              onClick={() => openEditEntryModal(log)}
                              className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg cursor-pointer"
                              title="Edit entry"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                onRequestConfirm({
                                  title: 'Remove Production Entry?',
                                  message: `Delete +${log.quantityMade} units of ${log.productName} (${log.codeOrColor}) logged on ${formatDeliveryDateLabel(log.date)}?`,
                                  confirmLabel: 'Remove Entry',
                                  tone: 'danger',
                                  onConfirm: () => onDeleteProductionEntry(log.id)
                                })
                              }
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                              title="Delete entry"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* MODAL 1: EDIT INDIVIDUAL DAILY PRODUCTION ENTRY */}
      {editingEntry && (
        <div className="fixed inset-0 z-60 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveEntryEdit}
            className="w-full max-w-md max-h-[90dvh] overflow-y-auto bg-white border border-slate-200 rounded-2xl shadow-xl p-5 space-y-4"
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-display font-bold text-base text-slate-900">
                  Edit Production Entry
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Correct date, product variant, quantity made, or note.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingEntry(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">Production Date</label>
                <input
                  type="date"
                  required
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500"
                />
              </div>

              {requirements.length > 0 && (
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Ordered Variant
                  </label>
                  <select
                    value={editItemKey}
                    onChange={(e) => setEditItemKey(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500"
                  >
                    {!requirements.some((r) => r.itemKey === editItemKey) && (
                      <option value={editItemKey}>
                        {editingEntry.productName} · {formatVariantSpec(editingEntry.grade, editingEntry.packing, editingEntry.codeOrColor)}
                      </option>
                    )}
                    {requirements.map((r) => (
                      <option key={r.itemKey} value={r.itemKey}>
                        {r.productName} · {formatVariantSpec(r.grade, r.packing, r.codeOrColor)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">Qty Made *</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={editQty}
                  onChange={(e) => setEditQty(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500 tabular-nums"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Shift / Kiln Note
                </label>
                <input
                  type="text"
                  placeholder="Optional note..."
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingEntry(null)}
                className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!editQty || parseInt(editQty, 10) <= 0}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                Save Changes
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 2: EDIT VARIANT PRODUCED TOTAL & VIEW ITS LOGS */}
      {editingVariantRow && (
        <div className="fixed inset-0 z-60 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg max-h-[90dvh] overflow-y-auto bg-white border border-slate-200 rounded-2xl shadow-xl p-5 space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-display font-bold text-base text-slate-900">
                  Edit Variant Production · {editingVariantRow.productName}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {formatVariantSpec(editingVariantRow.grade, editingVariantRow.packing, editingVariantRow.codeOrColor)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingVariantKey(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center bg-slate-50 border border-slate-200 rounded-xl p-3">
              <div>
                <div className="text-[11px] text-slate-500">Ordered</div>
                <div className="font-mono font-bold text-sm text-slate-900 tabular-nums">
                  {editingVariantRow.totalOrderedQty}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-500">Produced</div>
                <div className="font-mono font-bold text-sm text-blue-700 tabular-nums">
                  {editingVariantRow.producedQty}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-500">Remaining</div>
                <div className="font-mono font-bold text-sm text-amber-700 tabular-nums">
                  {editingVariantRow.remainingQty}
                </div>
              </div>
            </div>

            <form onSubmit={handleSaveVariantTotal} className="space-y-3 border border-slate-200 rounded-xl p-3.5">
              <div className="text-xs font-bold text-slate-900">
                Set Exact Total Produced Quantity
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-slate-700">
                    Corrected Total Produced *
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={variantTargetQty}
                    onChange={(e) => setVariantTargetQty(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500 tabular-nums"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-slate-700">
                    Correction Note (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Count correction"
                    value={variantAdjustNote}
                    onChange={(e) => setVariantAdjustNote(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500"
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2">
                <button
                  type="submit"
                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg cursor-pointer"
                >
                  Apply Corrected Total
                </button>
              </div>
            </form>

            {/* Queued Manufacture Targets (Admin can adjust target qty or remove line) */}
            {canManageQueue && editingVariantRow.queueEntries && editingVariantRow.queueEntries.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-900">
                  Queued Manufacture Targets ({editingVariantRow.queueEntries.length})
                </div>
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl max-h-44 overflow-y-auto">
                  {editingVariantRow.queueEntries.map((q) => (
                    <div key={q.id} className="px-3 py-2.5 flex items-center justify-between gap-2 text-xs">
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 truncate">
                          {q.sourceType === 'manual-catalog'
                            ? q.firmName || 'Manual Manufacture'
                            : `${q.firmName || q.dealerName} (${q.sourceOrderCode || 'Order'})`}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                          {q.sourceType === 'order-shortage' ? 'Order Shortage' : 'Catalog Manual'}
                          {q.requiredDate ? ` · Due ${formatDeliveryDateLabel(q.requiredDate)}` : ''}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 shrink-0">
                        <input
                          type="number"
                          min="1"
                          value={q.quantityToMake}
                          onChange={(e) => {
                            const val = Math.max(1, parseInt(e.target.value || '1', 10) || 1);
                            onUpdateProductionQueueItem(q.id, { quantityToMake: val });
                          }}
                          className="w-16 px-2 py-1 bg-slate-50 border border-slate-200 rounded text-right font-mono font-bold text-xs text-slate-900 tabular-nums"
                          title="Quantity to manufacture"
                        />
                        <button
                          type="button"
                          onClick={() => onDeleteProductionQueueItem(q.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                          title="Remove from production queue"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Individual Logs for this Variant */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-900">
                Individual Entries for This Variant ({editingVariantLogs.length})
              </div>
              {editingVariantLogs.length === 0 ? (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-500 text-center">
                  No production entries logged yet for this variant.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl max-h-48 overflow-y-auto">
                  {editingVariantLogs.map((log) => (
                    <div key={log.id} className="px-3 py-2.5 flex items-center justify-between gap-2 text-xs">
                      <div className="min-w-0">
                        <div className="font-mono font-semibold text-slate-900 tabular-nums">
                          {formatDeliveryDateLabel(log.date)} · <span className="text-blue-700">+{log.quantityMade}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 truncate">
                          {log.recordedBy}{log.notes ? ` · ${log.notes}` : ''}
                        </div>
                      </div>
                      <div className="flex items-center space-x-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingVariantKey(null);
                            openEditEntryModal(log);
                          }}
                          className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg cursor-pointer"
                          title="Edit this entry"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteProductionEntry(log.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                          title="Remove this entry"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingVariantKey(null)}
                className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: + ADD ITEM TO MANUFACTURE (FROM DEALER ORDER OR CATALOG) */}
      {isAddQueueOpen && canManageQueue && (
        <div className="fixed inset-0 z-60 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-xl max-h-[90dvh] overflow-y-auto bg-white border border-slate-200 rounded-2xl shadow-xl p-5 space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-display font-bold text-base text-slate-900">
                  Add Unavailable Item to Manufacture
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Pick specific unavailable lines from a Dealer Order or choose any Product directly from the catalog with custom quantity.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddQueueOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Source Mode Tabs */}
            <div className="inline-flex p-1 bg-slate-100 rounded-lg text-xs font-semibold">
              <button
                type="button"
                onClick={() => setQueueSourceTab('order')}
                className={`px-3 py-1.5 rounded-md cursor-pointer transition-colors ${
                  queueSourceTab === 'order' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                From Dealer Orders ({activePickableOrders.length})
              </button>
              <button
                type="button"
                onClick={() => setQueueSourceTab('catalog')}
                className={`px-3 py-1.5 rounded-md cursor-pointer transition-colors ${
                  queueSourceTab === 'catalog' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                From Product Catalog
              </button>
            </div>

            {queueSourceTab === 'order' ? (
              <form onSubmit={handleSubmitAddFromOrder} className="space-y-3.5">
                {activePickableOrders.length === 0 ? (
                  <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-500">
                    No active dealer orders available. Switch to <strong>From Product Catalog</strong> to add any model directly.
                  </div>
                ) : (
                  <>
                    <div className="space-y-1">
                      <label className="block text-[11px] font-semibold text-slate-700">
                        Select Dealer Order
                      </label>
                      <select
                        value={selectedSourceOrderId}
                        onChange={(e) => {
                          setSelectedSourceOrderId(e.target.value);
                          populateOrderLinesForOrderId(e.target.value);
                        }}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500"
                      >
                        {activePickableOrders.map((ord) => {
                          const firm = ord.dealerInfo?.firmName || '';
                          const person = ord.personName || ord.dealerInfo?.contactPerson || 'Dealer';
                          const label = firm && firm !== person ? `${firm} (${person})` : person;
                          return (
                            <option key={ord.id} value={ord.id}>
                              {ord.orderId || ord.id} · {label} · {ord.totalQuantity} Units
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600">
                        <span>Check items not in stock &amp; set quantity to make:</span>
                        <button
                          type="button"
                          onClick={() =>
                            setOrderLinePicks((prev) =>
                              prev.map((l) => ({ ...l, selected: true }))
                            )
                          }
                          className="text-blue-700 hover:underline cursor-pointer"
                        >
                          Select All
                        </button>
                      </div>

                      {orderLinePicks.map((line, idx) => (
                        <div
                          key={line.key}
                          className={`p-2.5 rounded-xl border flex flex-wrap items-center justify-between gap-2 ${
                            line.selected
                              ? 'bg-blue-50/70 border-blue-300'
                              : 'bg-slate-50 border-slate-200'
                          }`}
                        >
                          <label className="flex items-center space-x-2.5 cursor-pointer min-w-0 flex-1">
                            <input
                              type="checkbox"
                              checked={line.selected}
                              onChange={(e) =>
                                setOrderLinePicks((prev) =>
                                  prev.map((p, i) =>
                                    i === idx ? { ...p, selected: e.target.checked } : p
                                  )
                                )
                              }
                              className="w-4 h-4 rounded border-slate-300 text-blue-600 shrink-0"
                            />
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-slate-900 truncate">
                                {line.productName}
                              </div>
                              <div className="text-[11px] text-slate-600 font-mono">
                                {line.codeOrColor} · Ordered: {line.orderedQty}
                              </div>
                            </div>
                          </label>

                          <div className="flex items-center space-x-1.5 shrink-0">
                            <span className="text-[11px] text-slate-600">Make Qty:</span>
                            <input
                              type="number"
                              min="1"
                              value={line.qtyToMake}
                              onChange={(e) => {
                                const val = Math.max(1, parseInt(e.target.value || '1', 10) || 1);
                                setOrderLinePicks((prev) =>
                                  prev.map((p, i) =>
                                    i === idx ? { ...p, qtyToMake: val, selected: true } : p
                                  )
                                );
                              }}
                              className="w-16 px-2 py-1 bg-white border border-slate-300 rounded text-right font-mono font-bold text-xs text-slate-900 tabular-nums"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsAddQueueOpen(false)}
                    className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!orderLinePicks.some((l) => l.selected && l.qtyToMake > 0)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg cursor-pointer"
                  >
                    Add Selected to Production
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleSubmitAddFromCatalog} className="space-y-3.5">
                <div className="space-y-1 relative" ref={catalogDropdownRef}>
                  <label className="block text-[11px] font-semibold text-slate-700">
                    Catalog Product *
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setColorDropdownOpen(false);
                      setCatalogDropdownOpen((prev) => !prev);
                    }}
                    aria-expanded={catalogDropdownOpen}
                    aria-haspopup="listbox"
                    className="w-full px-3 py-2.5 bg-slate-50 hover:bg-white border border-slate-200 focus:border-blue-500 rounded-lg text-xs text-slate-900 flex items-center justify-between gap-2 text-left cursor-pointer transition-colors"
                  >
                    <span className="truncate font-medium">
                      {selectedCatalogProduct
                        ? `${selectedCatalogProduct.name} (${selectedCatalogProduct.category})`
                        : 'Select a catalog product...'}
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${
                        catalogDropdownOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {catalogDropdownOpen && (
                    <div className="absolute left-0 right-0 top-full mt-1.5 z-30 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
                      <div className="p-2 border-b border-slate-100 bg-slate-50/70">
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <input
                            ref={catalogSearchInputRef}
                            type="text"
                            value={catalogProductSearch}
                            onChange={(e) => setCatalogProductSearch(e.target.value)}
                            placeholder="Search product by name or category..."
                            className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                          />
                          {catalogProductSearch && (
                            <button
                              type="button"
                              onClick={() => setCatalogProductSearch('')}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                              aria-label="Clear search"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div role="listbox" className="max-h-52 overflow-y-auto divide-y divide-slate-100">
                        {filteredCatalogProducts.length === 0 ? (
                          <div className="px-3 py-4 text-center text-xs text-slate-500">
                            No products matching &ldquo;{catalogProductSearch}&rdquo;
                          </div>
                        ) : (
                          filteredCatalogProducts.map((p) => {
                            const isSelected = p.id === catalogProductId;
                            return (
                              <button
                                key={p.id}
                                type="button"
                                role="option"
                                aria-selected={isSelected}
                                onClick={() => {
                                  setCatalogProductId(p.id);
                                  const opts = getColorOptionsForProduct(p.id);
                                  setCatalogColorOrCode(opts[0] || colorsList[0] || 'White');
                                  setCatalogDropdownOpen(false);
                                  setCatalogProductSearch('');
                                }}
                                className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                                  isSelected
                                    ? 'bg-blue-50 text-blue-900 font-semibold'
                                    : 'text-slate-800 hover:bg-slate-50'
                                }`}
                              >
                                <span className="truncate">
                                  {p.name}{' '}
                                  <span className="text-slate-400 font-normal">({p.category})</span>
                                </span>
                                {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1 relative" ref={colorDropdownRef}>
                    <label className="block text-[11px] font-semibold text-slate-700">Color / Design Code *</label>
                    <button
                      type="button"
                      onClick={() => {
                        setCatalogDropdownOpen(false);
                        setColorDropdownOpen((prev) => !prev);
                      }}
                      aria-expanded={colorDropdownOpen}
                      aria-haspopup="listbox"
                      className="w-full px-3 py-2 bg-slate-50 hover:bg-white border border-slate-200 focus:border-blue-500 rounded-lg text-xs font-semibold text-slate-900 flex items-center justify-between gap-2 text-left cursor-pointer transition-colors"
                    >
                      <span className="truncate">{catalogColorOrCode || 'Select Color / Code...'}</span>
                      <ChevronDown
                        className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${
                          colorDropdownOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </button>

                    {colorDropdownOpen && (
                      <div className="absolute left-0 right-0 top-full mt-1.5 z-30 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
                        <div className="p-2 border-b border-slate-100 bg-slate-50/70">
                          <div className="relative">
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <input
                              ref={colorSearchInputRef}
                              type="text"
                              value={colorSearch}
                              onChange={(e) => setColorSearch(e.target.value)}
                              placeholder="Search color or code..."
                              className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                            />
                            {colorSearch && (
                              <button
                                type="button"
                                onClick={() => setColorSearch('')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                                aria-label="Clear search"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        <div role="listbox" className="max-h-48 overflow-y-auto divide-y divide-slate-100">
                          {filteredColorOptions.map((opt) => {
                            const isSelected =
                              opt.value.toLowerCase() === catalogColorOrCode.trim().toLowerCase();
                            return (
                              <button
                                key={`${opt.group}-${opt.value}`}
                                type="button"
                                role="option"
                                aria-selected={isSelected}
                                onClick={() => {
                                  setCatalogColorOrCode(opt.value);
                                  setColorDropdownOpen(false);
                                  setColorSearch('');
                                }}
                                className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                                  isSelected
                                    ? 'bg-blue-50 text-blue-900 font-semibold'
                                    : 'text-slate-800 hover:bg-slate-50'
                                }`}
                              >
                                <span className="truncate">
                                  {opt.value}{' '}
                                  <span className="text-slate-400 font-normal">· {opt.group}</span>
                                </span>
                                {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                              </button>
                            );
                          })}

                          {colorSearch.trim() &&
                            !allColorAndCodeOptions.some(
                              (opt) => opt.value.toLowerCase() === colorSearch.trim().toLowerCase()
                            ) && (
                              <button
                                type="button"
                                onClick={() => {
                                  setCatalogColorOrCode(colorSearch.trim());
                                  setColorDropdownOpen(false);
                                  setColorSearch('');
                                }}
                                className="w-full px-3 py-2 text-left text-xs text-blue-700 font-semibold hover:bg-blue-50 cursor-pointer"
                              >
                                Use custom: &ldquo;{colorSearch.trim()}&rdquo;
                              </button>
                            )}

                          {filteredColorOptions.length === 0 && !colorSearch.trim() && (
                            <div className="px-3 py-4 text-center text-xs text-slate-500">
                              No colors or codes found.
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-semibold text-slate-700">Qty to Manufacture *</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={catalogQtyToMake}
                      onChange={(e) => setCatalogQtyToMake(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-900 tabular-nums"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-semibold text-slate-700">Target Date (Optional)</label>
                    <input
                      type="date"
                      value={catalogTargetDate}
                      onChange={(e) => setCatalogTargetDate(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-900"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-semibold text-slate-700">Source / Batch Note</label>
                    <input
                      type="text"
                      placeholder="e.g. Stock Shortage / Urgent"
                      value={catalogNote}
                      onChange={(e) => setCatalogNote(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsAddQueueOpen(false)}
                    className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!catalogProductId || !catalogQtyToMake || parseInt(catalogQtyToMake, 10) <= 0}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg cursor-pointer"
                  >
                    Add to Production Tracker
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
