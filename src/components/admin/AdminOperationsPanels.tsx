import React, { useMemo, useState } from 'react';
import {
  Search,
  Download,
  Trash2,
  Package,
  FileText,
  MessageSquare,
  Copy,
  Webhook,
  Code,
  Scale,
  Layers,
  Check,
  CheckCircle2,
  XCircle,
  ClipboardList,
  Factory,
  Printer,
  Calendar,
  Lock,
  Pencil,
  X,
  Plus,
  Filter,
  ClipboardCheck,
  AlertTriangle,
  FileSpreadsheet
} from 'lucide-react';
import {
  CeramicGrade,
  CeramicPacking,
  DealerOrderItem,
  OrderVerificationStatus,
  ProductionQueueItem,
  SavedDealerOrder,
  SavedInquiry
} from '../../types';
import { CompanyInfoMap } from '../../services/googleSheetsService';
import { downloadDealerOrderPDF, printDealerOrderPDF } from '../../utils/orderPdf';
import {
  buildMergedOrderRequirements,
  downloadMergedRequirementsCSV,
  formatDeliveryDateLabel,
  getEffectiveVerificationStatus,
  isOrderCompleted,
  makeProductionVariantKey,
  printMergedRequirementsSheet
} from '../../utils/adminRoles';
import { ConfirmDialogConfig } from './adminTypes';
import { OrderEstimateExportModal } from './OrderEstimateExportModal';
import { useToast } from '../../context/ToastContext';

interface VerifyLineState {
  lineKey: string;
  productId: string;
  productName: string;
  grade: CeramicGrade;
  packing: CeramicPacking;
  codeOrColor: string;
  orderedQty: number;
  unitWeightKg: number;
  unavailable: boolean;
  qtyToMake: number;
}

interface AdminDealerOrdersPanelProps {
  dealerOrders: SavedDealerOrder[];
  productionQueue: ProductionQueueItem[];
  orderSearchFilter: string;
  onSearchChange: (val: string) => void;
  onDownloadCSV: () => void;
  onUpdateOrder: (id: string, updatedOrder: SavedDealerOrder) => void;
  onAcceptOrder: (
    id: string,
    options?: {
      availabilityStatus?: 'all-in-stock' | 'shortage-routed';
      unavailableItems?: Omit<ProductionQueueItem, 'id' | 'createdAt'>[];
    }
  ) => void;
  onRequestRejectOrder: (order: SavedDealerOrder) => void;
  onToggleOrderCompleted: (id: string) => void;
  onRemoveCompletedOrders: () => void;
  onDeleteOrder: (id: string) => void;
  onClearOrders: () => void;
  canVerifyOrders: boolean;
  canEditOrders: boolean;
  canCompleteOrders: boolean;
  canDeleteOrders: boolean;
  canExportEstimate?: boolean;
  canConfigureCatalog?: boolean;
  hideDealerContact?: boolean;
  recordedByLabel?: string;
  onRequestConfirm: (config: ConfirmDialogConfig) => void;
  companyInfo: CompanyInfoMap;
  onJumpToConfig: () => void;
  onJumpToProduction: () => void;
}

export const AdminDealerOrdersPanel: React.FC<AdminDealerOrdersPanelProps> = ({
  dealerOrders,
  productionQueue,
  orderSearchFilter,
  onSearchChange,
  onDownloadCSV,
  onUpdateOrder,
  onAcceptOrder,
  onRequestRejectOrder,
  onToggleOrderCompleted,
  onRemoveCompletedOrders,
  onDeleteOrder,
  onClearOrders,
  canVerifyOrders,
  canEditOrders,
  canCompleteOrders,
  canDeleteOrders,
  canExportEstimate = false,
  canConfigureCatalog = true,
  hideDealerContact = false,
  recordedByLabel = 'Staff',
  onRequestConfirm,
  companyInfo,
  onJumpToConfig,
  onJumpToProduction
}) => {
  const [viewMode, setViewMode] = useState<'orders' | 'merged'>('orders');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'accepted' | 'rejected' | 'completed'>('all');
  const [mergedSearch, setMergedSearch] = useState('');
  const [editingOrder, setEditingOrder] = useState<SavedDealerOrder | null>(null);
  const [editOrderError, setEditOrderError] = useState<string | null>(null);
  const [verifyingOrder, setVerifyingOrder] = useState<SavedDealerOrder | null>(null);
  const [verifyLines, setVerifyLines] = useState<VerifyLineState[]>([]);
  const [estimateOrder, setEstimateOrder] = useState<SavedDealerOrder | null>(null);
  const { toastSuccess, toastInfo, toastError } = useToast();

  const counts = useMemo(() => {
    let pending = 0;
    let accepted = 0;
    let rejected = 0;
    let completed = 0;

    dealerOrders.forEach((ord) => {
      const done = isOrderCompleted(ord);
      const ver = getEffectiveVerificationStatus(ord);
      if (done) completed++;
      if (ver === 'pending' && !done) pending++;
      if (ver === 'accepted' && !done) accepted++;
      if (ver === 'rejected') rejected++;
    });

    return { pending, accepted, rejected, completed, all: dealerOrders.length };
  }, [dealerOrders]);

  const filteredOrders = useMemo(() => {
    return dealerOrders.filter((ord) => {
      const done = isOrderCompleted(ord);
      const ver = getEffectiveVerificationStatus(ord);

      if (statusFilter === 'pending' && !(ver === 'pending' && !done)) return false;
      if (statusFilter === 'accepted' && !(ver === 'accepted' && !done)) return false;
      if (statusFilter === 'rejected' && ver !== 'rejected') return false;
      if (statusFilter === 'completed' && !done) return false;

      const q = orderSearchFilter.trim().toLowerCase();
      if (!q) return true;
      const statusText = done ? 'completed' : ver;
      const inContact = (ord.dealerInfo?.contactPerson || '').toLowerCase().includes(q);
      const inFirm = (ord.dealerInfo?.firmName || '').toLowerCase().includes(q);
      const inPerson = (ord.personName || '').toLowerCase().includes(q);
      const inPhone = !hideDealerContact && `${ord.dealerInfo?.phoneCode || ''} ${ord.dealerInfo?.phoneNumber || ''}`.toLowerCase().includes(q);
      const inCity = !hideDealerContact && (ord.dealerInfo?.cityState || '').toLowerCase().includes(q);
      const inId = (ord.orderId || ord.id || '').toLowerCase().includes(q);
      const inStatus = statusText.includes(q);
      const inReason = (ord.rejectionReason || '').toLowerCase().includes(q);
      const inItems = (ord.items || []).some(
        (i) => (i.name || '').toLowerCase().includes(q) || (i.category || '').toLowerCase().includes(q)
      );
      return inContact || inFirm || inPerson || inPhone || inCity || inId || inStatus || inReason || inItems;
    });
  }, [dealerOrders, statusFilter, orderSearchFilter, hideDealerContact]);

  // Merged active (Accepted & uncompleted) order requirements
  const mergedRequirements = useMemo(
    () => buildMergedOrderRequirements(dealerOrders),
    [dealerOrders]
  );

  const filteredMerged = useMemo(() => {
    if (!mergedSearch.trim()) return mergedRequirements;
    const q = mergedSearch.toLowerCase();
    return mergedRequirements.filter(
      (r) =>
        r.productName.toLowerCase().includes(q) ||
        (r.grade || '').toLowerCase().includes(q) ||
        (r.packing || '').toLowerCase().includes(q) ||
        r.codeOrColor.toLowerCase().includes(q) ||
        r.contributingOrders.some(
          (c) =>
            c.personName.toLowerCase().includes(q) ||
            (c.firmName || '').toLowerCase().includes(q)
        )
    );
  }, [mergedRequirements, mergedSearch]);

  const totalUnits = dealerOrders.reduce((sum, o) => sum + (o.totalQuantity || 0), 0);
  const totalWeight = dealerOrders.reduce((sum, o) => sum + (o.totalWeightKg || 0), 0);
  const activeAcceptedUnits = mergedRequirements.reduce((sum, r) => sum + r.totalOrderedQty, 0);

  const openVerifyOrderModal = (ord: SavedDealerOrder) => {
    if (!canVerifyOrders) return;
    const existingForOrder = productionQueue.filter(
      (q) => q.sourceType === 'order-shortage' && q.sourceOrderId === ord.id
    );
    const existingQtyByItemKey = new Map<string, number>();
    existingForOrder.forEach((q) => {
      existingQtyByItemKey.set(q.itemKey, (existingQtyByItemKey.get(q.itemKey) || 0) + q.quantityToMake);
    });

    const lines: VerifyLineState[] = [];
    (ord.items || []).forEach((item, bIdx) => {
      const grade: CeramicGrade = item.grade || 'Uty';
      const packing: CeramicPacking = item.packing || 'Box';
      const unitWeightKg = Number(item.unitWeightKg) || 15;
      const splits =
        item.colorSplits && item.colorSplits.length > 0
          ? item.colorSplits
          : [{ codeOrColor: 'White', quantity: item.totalQuantity || 0 }];

      splits.forEach((split, sIdx) => {
        if (!split.quantity || split.quantity <= 0) return;
        const codeOrColor = (split.codeOrColor || 'White').trim();
        const variantKey = makeProductionVariantKey(item.productId, grade, packing, codeOrColor);
        const preSortKey = makeProductionVariantKey(item.productId, '', '', codeOrColor);
        const matchedKey = existingQtyByItemKey.has(variantKey) ? variantKey : preSortKey;
        const queuedQty = existingQtyByItemKey.get(matchedKey) || 0;
        const isAlreadyQueued = queuedQty > 0;
        if (isAlreadyQueued) {
          // Consume once so duplicate batches don't double-prefill weirdly
          existingQtyByItemKey.set(matchedKey, 0);
        }
        lines.push({
          lineKey: `${bIdx}-${sIdx}-${variantKey}`,
          productId: item.productId,
          productName: item.name,
          grade,
          packing,
          codeOrColor,
          orderedQty: split.quantity,
          unitWeightKg,
          unavailable: isAlreadyQueued,
          qtyToMake: isAlreadyQueued ? queuedQty : split.quantity
        });
      });
    });

    setVerifyLines(lines);
    setVerifyingOrder(ord);
  };

  const handleConfirmVerification = (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyingOrder || !canVerifyOrders) return;
    const firmName = (verifyingOrder.dealerInfo?.firmName || '').trim();
    const person =
      (verifyingOrder.personName || verifyingOrder.dealerInfo?.contactPerson || firmName || 'Dealer').trim();
    const orderCode = verifyingOrder.orderId || verifyingOrder.id;

    const unavailableItems: Omit<ProductionQueueItem, 'id' | 'createdAt'>[] = verifyLines
      .filter((line) => line.unavailable && line.qtyToMake > 0)
      .map((line) => ({
        itemKey: makeProductionVariantKey(line.productId, line.grade, line.packing, line.codeOrColor),
        sourceType: 'order-shortage',
        sourceOrderId: verifyingOrder.id,
        sourceOrderCode: orderCode,
        firmName,
        dealerName: person,
        productId: line.productId,
        productName: line.productName,
        grade: line.grade,
        packing: line.packing,
        codeOrColor: line.codeOrColor,
        quantityToMake: Math.max(1, Math.round(line.qtyToMake)),
        unitWeightKg: line.unitWeightKg,
        requiredDate: verifyingOrder.requiredDate,
        requiredPeriod: verifyingOrder.requiredPeriod,
        addedBy: recordedByLabel
      }));

    onAcceptOrder(verifyingOrder.id, {
      availabilityStatus: unavailableItems.length > 0 ? 'shortage-routed' : 'all-in-stock',
      unavailableItems
    });
    setVerifyingOrder(null);
    setVerifyLines([]);
  };

  const openEditOrderModal = (ord: SavedDealerOrder) => {
    if (!canEditOrders) return;
    setEditOrderError(null);
    setEditingOrder(JSON.parse(JSON.stringify(ord)) as SavedDealerOrder);
  };

  const recalculateOrderTotals = (items: DealerOrderItem[]) => {
    const normalized = items.map((item) => {
      const cleanedSplits = (item.colorSplits || []).map((s) => ({
        ...s,
        quantity: Math.max(0, Number(s.quantity) || 0)
      }));
      const totalQuantity = cleanedSplits.reduce((s, c) => s + c.quantity, 0);
      const unitWeightKg = Number(item.unitWeightKg) || 15;
      return {
        ...item,
        colorSplits: cleanedSplits,
        totalQuantity,
        totalWeightKg: totalQuantity * unitWeightKg
      };
    });
    const uniqueModels = new Set(normalized.map((i) => i.productId));
    return {
      items: normalized,
      totalQuantity: normalized.reduce((s, i) => s + i.totalQuantity, 0),
      totalWeightKg: normalized.reduce((s, i) => s + i.totalWeightKg, 0),
      totalModels: uniqueModels.size,
      totalBatches: normalized.length
    };
  };

  const handleSaveEditedOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOrder || !canEditOrders) return;
    if (editingOrder.verificationStatus === 'rejected' && !(editingOrder.rejectionReason || '').trim()) {
      const msg = 'Please enter a rejection reason when status is Rejected.';
      setEditOrderError(msg);
      toastError(msg, 'Reason Required');
      return;
    }
    const totals = recalculateOrderTotals(editingOrder.items);
    if (totals.items.length === 0 || totals.totalQuantity <= 0) {
      const msg = 'Order must contain at least 1 unit across its batches.';
      setEditOrderError(msg);
      toastError(msg, 'Empty Order');
      return;
    }

    const cleanPerson = editingOrder.personName.trim() || editingOrder.dealerInfo.contactPerson.trim() || 'Dealer';
    const cleanFirm = (editingOrder.dealerInfo?.firmName || '').trim();
    const nextOrder: SavedDealerOrder = {
      ...editingOrder,
      personName: cleanPerson,
      dealerInfo: {
        ...editingOrder.dealerInfo,
        firmName: cleanFirm,
        contactPerson: cleanPerson
      },
      items: totals.items,
      totalQuantity: totals.totalQuantity,
      totalWeightKg: totals.totalWeightKg,
      totalModels: totals.totalModels,
      totalBatches: totals.totalBatches,
      rejectionReason: editingOrder.verificationStatus === 'rejected' ? editingOrder.rejectionReason?.trim() : undefined,
      status: editingOrder.completed ? 'completed' : editingOrder.verificationStatus === 'accepted' ? 'processing' : 'new'
    };

    onUpdateOrder(editingOrder.id, nextOrder);
    setEditingOrder(null);
    setEditOrderError(null);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-700 mb-1">
            Sales &amp; Verification Gate
          </p>
          <h1 className="font-display font-bold text-2xl text-slate-900">Dealer Orders</h1>
          <p className="text-xs text-slate-500 mt-0.5 max-w-2xl">
            Verify incoming wholesale orders (Accept into Production or Reject with reason), check off finished orders, or inspect the consolidated Merged Requirements Sheet.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onJumpToProduction}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors flex items-center space-x-1.5 cursor-pointer whitespace-nowrap"
          >
            <Factory className="w-3.5 h-3.5 text-blue-600" />
            <span>Production Tracker</span>
          </button>

          {canConfigureCatalog && (
            <button
              type="button"
              onClick={onJumpToConfig}
              className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors flex items-center space-x-1.5 cursor-pointer whitespace-nowrap"
            >
              <Scale className="w-3.5 h-3.5 text-slate-500" />
              <span>Weights &amp; Modes</span>
            </button>
          )}

          <button
            type="button"
            onClick={onDownloadCSV}
            disabled={dealerOrders.length === 0}
            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors flex items-center space-x-1.5 cursor-pointer whitespace-nowrap shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Orders CSV</span>
          </button>

          {canDeleteOrders && counts.completed > 0 && (
            <button
              type="button"
              onClick={() =>
                onRequestConfirm({
                  title: `Remove ${counts.completed} Checked Order${counts.completed === 1 ? '' : 's'}?`,
                  message: 'This will permanently delete all orders marked Completed from your saved dealer order list.',
                  confirmLabel: `Remove ${counts.completed} Checked`,
                  tone: 'danger',
                  onConfirm: onRemoveCompletedOrders
                })
              }
              className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-lg transition-colors flex items-center space-x-1.5 cursor-pointer text-xs font-semibold whitespace-nowrap"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Remove Checked ({counts.completed})</span>
            </button>
          )}

          {canDeleteOrders && dealerOrders.length > 0 && (
            <button
              type="button"
              onClick={() =>
                onRequestConfirm({
                  title: 'Clear All Dealer Orders?',
                  message: `You are about to permanently clear all ${dealerOrders.length} dealer orders. Export CSV first if you want a backup copy.`,
                  confirmLabel: 'Clear All Orders',
                  tone: 'danger',
                  onConfirm: onClearOrders
                })
              }
              className="px-3 py-2 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg transition-colors flex items-center space-x-1.5 cursor-pointer text-xs font-semibold whitespace-nowrap"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear All</span>
            </button>
          )}
        </div>
      </div>

      {/* Role restriction notice when user cannot edit or delete orders */}
      {(!canVerifyOrders || !canDeleteOrders || !canEditOrders) && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 flex items-center space-x-2 text-xs text-slate-600">
          <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span>
            {canVerifyOrders
              ? 'Dealer address & phone are masked, and order deletion/editing are restricted to Admin. You can verify orders and route unavailable items to Production.'
              : 'Order approval (Accept / Reject), order editing, and order deletion are restricted to Admin.'}
          </span>
        </div>
      )}

      {/* 4 Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500">Pending Verification</div>
          <div className="text-2xl font-display font-bold text-amber-700 tabular-nums mt-1">
            {counts.pending} Orders
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500">Accepted Active Units</div>
          <div className="text-2xl font-display font-bold text-blue-700 tabular-nums mt-1">
            {activeAcceptedUnits} Units
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
            {counts.accepted} active accepted orders
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500">Total Consignment Weight</div>
          <div className="text-2xl font-display font-bold text-emerald-700 tabular-nums mt-1">
            {totalWeight.toFixed(1)} kg
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
            Across {totalUnits} total units
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs font-medium text-slate-500">Completed / Rejected</div>
          <div className="text-2xl font-display font-bold text-slate-900 tabular-nums mt-1">
            {counts.completed} / {counts.rejected}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Checked done / Declined
          </div>
        </div>
      </div>

      {/* View Switcher: Orders List vs Merged Order Requirements Sheet */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="inline-flex items-center p-1 bg-slate-100 rounded-lg self-start">
          <button
            type="button"
            onClick={() => setViewMode('orders')}
            className={`px-3.5 py-2 rounded-md text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              viewMode === 'orders' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>Orders List &amp; Verification ({dealerOrders.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('merged')}
            className={`px-3.5 py-2 rounded-md text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              viewMode === 'merged' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ClipboardList className="w-3.5 h-3.5" />
            <span>Merged Requirements Sheet ({mergedRequirements.length})</span>
          </button>
        </div>

        {viewMode === 'orders' ? (
          <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
            <span className="tabular-nums">
              Showing <strong className="text-slate-900">{filteredOrders.length}</strong> of{' '}
              <strong className="text-slate-900">{dealerOrders.length}</strong> orders
            </span>
            {(orderSearchFilter.trim() !== '' || statusFilter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  onSearchChange('');
                  setStatusFilter('all');
                }}
                className="px-2.5 py-1 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors cursor-pointer whitespace-nowrap"
              >
                Reset Filters
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2 flex-1 lg:justify-end">
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search merged product, grade, color..."
                value={mergedSearch}
                onChange={(e) => setMergedSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500"
              />
            </div>

            <button
              type="button"
              onClick={() => {
                downloadMergedRequirementsCSV(filteredMerged);
                toastSuccess('Exported merged requirements CSV.', 'CSV Downloaded');
              }}
              disabled={filteredMerged.length === 0}
              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg flex items-center space-x-1.5 cursor-pointer whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Merged CSV</span>
            </button>

            <button
              type="button"
              onClick={() => {
                printMergedRequirementsSheet(filteredMerged);
                toastInfo('Opening merged requirements print view.', 'Print Sheet Ready');
              }}
              disabled={filteredMerged.length === 0}
              className="px-3 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-semibold rounded-lg flex items-center space-x-1.5 cursor-pointer whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Sheet</span>
            </button>
          </div>
        )}
      </div>

      {/* Dedicated Search & Filter Bar for Dealer Orders */}
      {viewMode === 'orders' && (
        <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[220px] lg:max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              aria-label="Search dealer orders by Dealer Name, Order ID, or Status"
              placeholder="Search by Dealer Name, Order ID, Status..."
              value={orderSearchFilter}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500"
            />
            {orderSearchFilter && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center space-x-1.5 text-[11px] font-semibold text-slate-500">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span>Status:</span>
            </div>

            <div className="hidden sm:flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-lg text-[11px] font-semibold">
              {([
                { id: 'all', label: `All (${counts.all})` },
                { id: 'pending', label: `Pending (${counts.pending})` },
                { id: 'accepted', label: `Accepted (${counts.accepted})` },
                { id: 'rejected', label: `Rejected (${counts.rejected})` },
                { id: 'completed', label: `Completed (${counts.completed})` }
              ] as const).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-2.5 py-1 rounded-md cursor-pointer transition-colors whitespace-nowrap ${
                    statusFilter === tab.id ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <select
              aria-label="Select order status filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'pending' | 'accepted' | 'rejected' | 'completed')}
              className="sm:hidden px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:bg-white focus:border-blue-500 cursor-pointer"
            >
              <option value="all">All Statuses ({counts.all})</option>
              <option value="pending">Pending ({counts.pending})</option>
              <option value="accepted">Accepted ({counts.accepted})</option>
              <option value="rejected">Rejected ({counts.rejected})</option>
              <option value="completed">Completed ({counts.completed})</option>
            </select>
          </div>
        </div>
      )}

      {/* VIEW 1: INDIVIDUAL DEALER ORDERS & VERIFICATION */}
      {viewMode === 'orders' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {filteredOrders.length === 0 ? (
            <div className="py-14 px-4 text-center">
              <Package className="w-9 h-9 text-slate-300 mx-auto mb-2.5" />
              <div className="font-semibold text-slate-700 text-sm">
                {dealerOrders.length === 0 ? 'No Dealer Orders Recorded Yet' : 'No orders match your filter'}
              </div>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                {dealerOrders.length === 0
                  ? 'Orders submitted via Create Dealer Order arrive here for Verification before entering Production.'
                  : 'Try adjusting your Dealer Name / Order ID search or selecting a different status filter.'}
              </p>
              {dealerOrders.length > 0 && (orderSearchFilter.trim() !== '' || statusFilter !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    onSearchChange('');
                    setStatusFilter('all');
                  }}
                  className="mt-3 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  Clear Search &amp; Filters
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Mobile Stacked Cards */}
              <div className="divide-y divide-slate-200 md:hidden">
                {filteredOrders.map((ord) => {
                  const firm = (ord.dealerInfo?.firmName || '').trim();
                  const person = ord.personName || ord.dealerInfo?.contactPerson || firm || '—';
                  const hasSeparateFirm = Boolean(firm && firm.toLowerCase() !== person.toLowerCase());
                  const verStatus = getEffectiveVerificationStatus(ord);
                  const done = isOrderCompleted(ord);

                  return (
                    <div key={ord.id} className={`p-4 space-y-3 ${done ? 'bg-slate-50/80' : ''}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5 min-w-0">
                          {canCompleteOrders && verStatus !== 'rejected' && (
                            <button
                              type="button"
                              onClick={() => onToggleOrderCompleted(ord.id)}
                              className={`mt-0.5 w-6 h-6 rounded border flex items-center justify-center shrink-0 cursor-pointer ${
                                done
                                  ? 'bg-emerald-600 border-emerald-600 text-white'
                                  : 'bg-white border-slate-300 text-transparent hover:border-blue-500'
                              }`}
                              title="Mark order completed"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <div className="min-w-0">
                            <div className={`font-bold text-sm truncate ${done ? 'line-through text-slate-500' : 'text-slate-900'}`}>
                              {hasSeparateFirm ? firm : person}
                            </div>
                            {hasSeparateFirm && (
                              <div className="text-xs text-slate-600 truncate">Contact: {person}</div>
                            )}
                            <div className="text-xs text-slate-500 tabular-nums mt-0.5">
                              <span>{ord.orderId || ord.id}</span>
                              <span className="mx-1.5" aria-hidden="true">·</span>
                              <span>{ord.timestamp}</span>
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0 tabular-nums">
                          <div className="text-xs font-bold text-blue-700">{ord.totalQuantity} Units</div>
                          <div className="text-[11px] text-emerald-700 font-semibold">
                            {ord.totalWeightKg ? `${ord.totalWeightKg.toFixed(1)} kg` : '—'}
                          </div>
                        </div>
                      </div>

                      {/* Verification & Delivery Status Row */}
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                        <div>
                          <span
                            className={`font-bold uppercase tracking-wider ${
                              done
                                ? 'text-emerald-700'
                                : verStatus === 'accepted'
                                ? 'text-blue-700'
                                : verStatus === 'rejected'
                                ? 'text-rose-700'
                                : 'text-amber-700'
                            }`}
                          >
                            {done
                              ? 'Completed'
                              : verStatus === 'accepted'
                              ? 'Accepted'
                              : verStatus === 'rejected'
                              ? 'Rejected'
                              : 'Pending Verification'}
                          </span>
                          {!done && verStatus === 'accepted' && (
                            <div className="text-[11px] mt-0.5">
                              {ord.availabilityStatus === 'shortage-routed' ? (
                                <span className="font-semibold text-amber-700">
                                  {ord.productionRoutedCount || 0} unavailable line{(ord.productionRoutedCount || 0) === 1 ? '' : 's'} sent to Production
                                </span>
                              ) : ord.availabilityStatus === 'all-in-stock' ? (
                                <span className="font-semibold text-emerald-700">All items in stock</span>
                              ) : null}
                            </div>
                          )}
                        </div>

                        {(ord.requiredDate || ord.requiredPeriod) && (
                          <span className="font-mono text-slate-700 flex items-center space-x-1">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            <span>
                              Due: {ord.requiredDate ? formatDeliveryDateLabel(ord.requiredDate) : ord.requiredPeriod}
                            </span>
                          </span>
                        )}
                      </div>

                      {verStatus === 'rejected' && ord.rejectionReason && (
                        <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-[11px] text-rose-800">
                          <strong>Rejection Reason:</strong> {ord.rejectionReason}
                        </div>
                      )}

                      {!hideDealerContact && (
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                          <span>{ord.dealerInfo?.cityState || '—'}</span>
                          {ord.dealerInfo?.phoneNumber && (
                            <a
                              href={`https://wa.me/${(ord.dealerInfo.phoneCode || '+91').replace(/\D/g, '')}${ord.dealerInfo.phoneNumber.replace(/\D/g, '')}?text=Hello%20${encodeURIComponent(person)}%2C%20regarding%20your%20Hightone%20Ceramic%20Order%20${encodeURIComponent(ord.orderId || ord.id)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-emerald-700 font-mono font-semibold flex items-center space-x-1"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              <span>{ord.dealerInfo.phoneCode} {ord.dealerInfo.phoneNumber}</span>
                            </a>
                          )}
                        </div>
                      )}

                      <div className="space-y-1 bg-slate-50 border border-slate-200/80 rounded-lg p-2.5 text-[11px]">
                        {ord.items.map((item, idx) => {
                          const splitsSummary =
                            item.colorSplits && item.colorSplits.length > 0
                              ? item.colorSplits.map((s) => `${s.codeOrColor}: ${s.quantity}`).join(', ')
                              : `${item.totalQuantity} pcs`;
                          return (
                            <div key={idx} className="border-b border-slate-200/60 last:border-0 pb-1 last:pb-0">
                              <div className="font-semibold text-slate-900">
                                {item.name} · {item.grade || 'Uty'} · {item.packing || 'Box'}
                              </div>
                              <div className="text-slate-600 font-mono">{splitsSummary}</div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                        {canVerifyOrders && !done && (
                          <button
                            type="button"
                            onClick={() => openVerifyOrderModal(ord)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1 cursor-pointer ${
                              verStatus === 'accepted'
                                ? 'bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200'
                                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            }`}
                          >
                            <ClipboardCheck className="w-3.5 h-3.5" />
                            <span>{verStatus === 'accepted' ? 'Edit Stock / Prod' : 'Verify Order'}</span>
                          </button>
                        )}
                        {canVerifyOrders && verStatus !== 'rejected' && !done && (
                          <button
                            type="button"
                            onClick={() => onRequestRejectOrder(ord)}
                            className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-semibold flex items-center space-x-1 cursor-pointer"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Reject</span>
                          </button>
                        )}
                        {canEditOrders && (
                          <button
                            type="button"
                            onClick={() => openEditOrderModal(ord)}
                            className="px-3 py-1.5 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 rounded-lg text-xs font-semibold flex items-center space-x-1 cursor-pointer"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>
                        )}
                        {canExportEstimate && (
                          <button
                            type="button"
                            onClick={() => setEstimateOrder(ord)}
                            className="px-3 py-1.5 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 rounded-lg text-xs font-semibold flex items-center space-x-1.5 cursor-pointer whitespace-nowrap"
                            title="Export Admin Estimate Excel (.xlsx)"
                          >
                            <FileSpreadsheet className="w-3.5 h-3.5" />
                            <span>Estimate Excel</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            downloadDealerOrderPDF(ord, companyInfo, { hideDealerContact });
                            toastSuccess(`Downloaded PDF for order ${ord.orderId || ord.id}.`, 'PDF Downloaded');
                          }}
                          className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-xs font-semibold flex items-center space-x-1.5 cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>PDF</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            printDealerOrderPDF(ord, companyInfo, { hideDealerContact });
                            toastInfo(`Opening print dialog for order ${ord.orderId || ord.id}.`, 'Print Sheet Ready');
                          }}
                          className="px-3 py-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg text-xs font-semibold flex items-center space-x-1.5 cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Print</span>
                        </button>
                        {canDeleteOrders && (
                          <button
                            type="button"
                            onClick={() =>
                              onRequestConfirm({
                                title: `Delete Order ${ord.orderId || ord.id}?`,
                                message: `Remove order from ${hasSeparateFirm ? `${firm} (${person})` : person} (${ord.totalQuantity} units)?`,
                                confirmLabel: 'Delete Order',
                                tone: 'danger',
                                onConfirm: () => onDeleteOrder(ord.id)
                              })
                            }
                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Delete order"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop Orders Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 text-[11px] uppercase tracking-wider font-semibold">
                      {canCompleteOrders && <th className="py-3 px-3 w-11 text-center">Done</th>}
                      <th className="py-3 px-4 whitespace-nowrap">Order ID &amp; Date</th>
                      <th className="py-3 px-4 whitespace-nowrap">{hideDealerContact ? 'Dealer' : 'Dealer & Location'}</th>
                      <th className="py-3 px-4 whitespace-nowrap">Required Period</th>
                      <th className="py-3 px-4 whitespace-nowrap">Verification</th>
                      <th className="py-3 px-4 whitespace-nowrap text-right">Qty &amp; Weight</th>
                      <th className="py-3 px-4">Classification Matrix</th>
                      <th className="py-3 px-4 whitespace-nowrap text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredOrders.map((ord) => {
                      const firm = (ord.dealerInfo?.firmName || '').trim();
                      const person = ord.personName || ord.dealerInfo?.contactPerson || firm || '—';
                      const hasSeparateFirm = Boolean(firm && firm.toLowerCase() !== person.toLowerCase());
                      const verStatus = getEffectiveVerificationStatus(ord);
                      const done = isOrderCompleted(ord);

                      return (
                        <tr
                          key={ord.id}
                          className={`hover:bg-slate-50/70 transition-colors ${done ? 'bg-slate-50/80' : ''}`}
                        >
                          {canCompleteOrders && (
                            <td className="py-3 px-3 text-center">
                              {verStatus !== 'rejected' ? (
                                <button
                                  type="button"
                                  onClick={() => onToggleOrderCompleted(ord.id)}
                                  className={`w-6 h-6 rounded border inline-flex items-center justify-center cursor-pointer transition-colors ${
                                    done
                                      ? 'bg-emerald-600 border-emerald-600 text-white'
                                      : 'bg-white border-slate-300 text-transparent hover:border-blue-500'
                                  }`}
                                  title={done ? 'Unmark Completed' : 'Check Completed'}
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>
                          )}
                          <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px] tabular-nums">
                            <div className="font-bold text-slate-900">{ord.orderId || ord.id}</div>
                            <div className="text-[11px] text-slate-400">{ord.timestamp}</div>
                          </td>
                          <td className="py-3 px-4">
                            <div className={`font-semibold ${done ? 'line-through text-slate-500' : 'text-slate-900'}`}>
                              {hasSeparateFirm ? firm : person}
                            </div>
                            {hasSeparateFirm && (
                              <div className="text-[11px] text-slate-600">Contact: {person}</div>
                            )}
                            {!hideDealerContact && (
                              <>
                                <div className="text-[11px] text-slate-500">{ord.dealerInfo?.cityState || '—'}</div>
                                {ord.dealerInfo?.phoneNumber && (
                                  <a
                                    href={`https://wa.me/${(ord.dealerInfo.phoneCode || '+91').replace(/\D/g, '')}${ord.dealerInfo.phoneNumber.replace(/\D/g, '')}?text=Hello%20${encodeURIComponent(person)}%2C%20regarding%20your%20Hightone%20Ceramic%20Order%20${encodeURIComponent(ord.orderId || ord.id)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[11px] text-emerald-700 hover:underline font-mono inline-flex items-center space-x-1 mt-0.5"
                                  >
                                    <MessageSquare className="w-3 h-3 text-emerald-600" />
                                    <span>{ord.dealerInfo.phoneCode} {ord.dealerInfo.phoneNumber}</span>
                                  </a>
                                )}
                              </>
                            )}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap text-[11px]">
                            {ord.requiredDate ? (
                              <div>
                                <div className="font-mono font-bold text-slate-900 tabular-nums">
                                  {formatDeliveryDateLabel(ord.requiredDate)}
                                </div>
                                {ord.requiredPeriod && (
                                  <div className="text-slate-500">{ord.requiredPeriod}</div>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400">Standard</span>
                            )}
                          </td>
                          <td className="py-3 px-4 max-w-[220px]">
                            <div
                              className={`text-[11px] font-bold uppercase tracking-wider ${
                                done
                                  ? 'text-emerald-700'
                                  : verStatus === 'accepted'
                                  ? 'text-blue-700'
                                  : verStatus === 'rejected'
                                  ? 'text-rose-700'
                                  : 'text-amber-700'
                              }`}
                            >
                              {done
                                ? 'Completed'
                                : verStatus === 'accepted'
                                ? 'Accepted'
                                : verStatus === 'rejected'
                                ? 'Rejected'
                                : 'Pending Verify'}
                            </div>
                            {!done && verStatus === 'accepted' && (
                              <div className="text-[10px] mt-0.5">
                                {ord.availabilityStatus === 'shortage-routed' ? (
                                  <span className="font-semibold text-amber-700">
                                    {ord.productionRoutedCount || 0} unavailable &rarr; Prod
                                  </span>
                                ) : ord.availabilityStatus === 'all-in-stock' ? (
                                  <span className="font-semibold text-emerald-700">
                                    All In Stock
                                  </span>
                                ) : null}
                              </div>
                            )}
                            {verStatus === 'rejected' && ord.rejectionReason && (
                              <div className="text-[11px] text-rose-700 mt-0.5 line-clamp-2" title={ord.rejectionReason}>
                                Reason: {ord.rejectionReason}
                              </div>
                            )}
                            {ord.verifiedBy && verStatus !== 'pending' && (
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                By {ord.verifiedBy}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap text-right font-mono tabular-nums">
                            <div className="font-bold text-blue-700">{ord.totalQuantity} Units</div>
                            <div className="text-[11px] text-emerald-700 font-semibold">
                              {ord.totalWeightKg ? `${ord.totalWeightKg.toFixed(1)} kg` : '—'}
                            </div>
                          </td>
                          <td className="py-3 px-4 max-w-xs text-slate-700 text-[11px]">
                            <div className="space-y-1">
                              {ord.items.slice(0, 3).map((item, idx) => {
                                const splitsSummary =
                                  item.colorSplits && item.colorSplits.length > 0
                                    ? item.colorSplits.map((s) => `${s.codeOrColor}: ${s.quantity}`).join(', ')
                                    : `${item.totalQuantity} pcs`;
                                return (
                                  <div key={idx} className="border-b border-slate-100 last:border-0 pb-0.5 last:pb-0">
                                    <div className="text-[11px]">
                                      <strong className="text-slate-900">{item.name}</strong>
                                      <span className="text-slate-400 mx-1" aria-hidden="true">·</span>
                                      <span className="text-amber-800 font-semibold">{item.grade || 'Uty'}</span>
                                      <span className="text-slate-400 mx-1" aria-hidden="true">·</span>
                                      <span className="text-slate-600 font-medium">{item.packing || 'Box'}</span>
                                    </div>
                                    <div className="text-[10px] text-slate-500 font-mono">{splitsSummary}</div>
                                  </div>
                                );
                              })}
                              {ord.items.length > 3 && (
                                <div className="text-[10px] text-slate-400 italic">
                                  +{ord.items.length - 3} more batches...
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap text-right">
                            <div className="flex items-center justify-end space-x-1">
                              {canVerifyOrders && !done && (
                                <button
                                  type="button"
                                  onClick={() => openVerifyOrderModal(ord)}
                                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold flex items-center space-x-1 cursor-pointer ${
                                    verStatus === 'accepted'
                                      ? 'bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200'
                                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                  }`}
                                  title={verStatus === 'accepted' ? 'Update unavailable items sent to Production' : 'Verify order & choose unavailable items for Production'}
                                >
                                  <ClipboardCheck className="w-3.5 h-3.5" />
                                  <span>{verStatus === 'accepted' ? 'Stock / Prod' : 'Verify'}</span>
                                </button>
                              )}
                              {canVerifyOrders && verStatus !== 'rejected' && !done && (
                                <button
                                  type="button"
                                  onClick={() => onRequestRejectOrder(ord)}
                                  className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-[11px] font-semibold flex items-center space-x-1 cursor-pointer"
                                  title="Reject order with reason"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                  <span>Reject</span>
                                </button>
                              )}
                              {canEditOrders && (
                                <button
                                  type="button"
                                  onClick={() => openEditOrderModal(ord)}
                                  className="p-2 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                  title="Edit order details, items, quantities or schedule"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                              )}
                              {canExportEstimate && (
                                <button
                                  type="button"
                                  onClick={() => setEstimateOrder(ord)}
                                  className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-[11px] font-semibold flex items-center space-x-1 transition-colors cursor-pointer whitespace-nowrap"
                                  title="Export Admin Sales Order Estimate (.xlsx) with blank Rate cells"
                                >
                                  <FileSpreadsheet className="w-3.5 h-3.5" />
                                  <span>Estimate</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  downloadDealerOrderPDF(ord, companyInfo, { hideDealerContact });
                                  toastSuccess(`Downloaded PDF for order ${ord.orderId || ord.id}.`, 'PDF Downloaded');
                                }}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                title="Download PDF Order Sheet"
                              >
                                <Download className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  printDealerOrderPDF(ord, companyInfo, { hideDealerContact });
                                  toastInfo(`Opening print dialog for order ${ord.orderId || ord.id}.`, 'Print Sheet Ready');
                                }}
                                className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                                title="Print Order Sheet"
                              >
                                <Printer className="w-4 h-4" />
                              </button>
                              {canDeleteOrders && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    onRequestConfirm({
                                      title: `Delete Order ${ord.orderId || ord.id}?`,
                                      message: `Remove order from ${hasSeparateFirm ? `${firm} (${person})` : person} (${ord.totalQuantity} units)?`,
                                      confirmLabel: 'Delete Order',
                                      tone: 'danger',
                                      onConfirm: () => onDeleteOrder(ord.id)
                                    })
                                  }
                                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                  title="Delete order"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* VIEW 2: MERGED REQUIREMENTS SHEET (ACCEPTED ACTIVE ORDERS) */}
      {viewMode === 'merged' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div>
              <strong className="text-slate-900">Merged Accepted Order Sheet</strong>
              <span className="text-slate-500 ml-2">
                Consolidates Accepted, non-completed orders by Product · Grade · Packing · Color/Code
              </span>
            </div>
            <div className="font-mono font-bold text-slate-800 tabular-nums">
              {filteredMerged.reduce((s, r) => s + r.totalOrderedQty, 0)} Units ·{' '}
              {filteredMerged.reduce((s, r) => s + r.totalWeightKg, 0).toFixed(1)} kg
            </div>
          </div>

          {filteredMerged.length === 0 ? (
            <div className="py-14 px-4 text-center">
              <ClipboardList className="w-9 h-9 text-slate-300 mx-auto mb-2.5" />
              <div className="font-semibold text-slate-700 text-sm">
                No Accepted Active Orders to Merge
              </div>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Only orders verified &amp; Accepted (and not marked Completed) appear in this consolidated requirements sheet.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 text-[11px] uppercase tracking-wider font-semibold">
                    <th className="py-3 px-4 w-12 text-center">Sr.</th>
                    <th className="py-3 px-4">Product</th>
                    <th className="py-3 px-4">Grade</th>
                    <th className="py-3 px-4">Packing</th>
                    <th className="py-3 px-4">Color / Code</th>
                    <th className="py-3 px-4 text-right">Total Required</th>
                    <th className="py-3 px-4 text-right">Weight</th>
                    <th className="py-3 px-4">Earliest Due Date</th>
                    <th className="py-3 px-4">Contributing Dealers</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredMerged.map((req, idx) => (
                    <tr key={req.itemKey} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 text-center font-mono text-slate-400 tabular-nums">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900">{req.productName}</td>
                      <td className="py-3 px-4 font-semibold text-amber-800">{req.grade}</td>
                      <td className="py-3 px-4 text-slate-700">{req.packing}</td>
                      <td className="py-3 px-4 font-mono font-semibold text-slate-900">{req.codeOrColor}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-blue-700 tabular-nums">
                        {req.totalOrderedQty} Units
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-emerald-700 tabular-nums">
                        {req.totalWeightKg.toFixed(1)} kg
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px] text-slate-700 tabular-nums">
                        {req.earliestDueDate ? formatDeliveryDateLabel(req.earliestDueDate) : '—'}
                      </td>
                      <td className="py-3 px-4 text-[11px] text-slate-600">
                        <div className="space-y-0.5">
                          {req.contributingOrders.map((c) => (
                            <div key={c.id}>
                              <strong className="text-slate-800">
                                {c.firmName && c.firmName !== c.personName
                                  ? `${c.firmName} (${c.personName})`
                                  : c.personName}
                              </strong>
                              <span className="text-slate-400 mx-1">·</span>
                              <span className="font-mono font-semibold">{c.quantity} pcs</span>
                              {c.requiredDate && (
                                <span className="text-slate-400 ml-1">
                                  (Due {formatDeliveryDateLabel(c.requiredDate)})
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* EDIT DEALER ORDER MODAL */}
      {editingOrder && (
        <div className="fixed inset-0 z-60 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveEditedOrder}
            className="w-full max-w-2xl max-h-[90dvh] overflow-y-auto bg-white border border-slate-200 rounded-2xl shadow-xl p-5 space-y-4"
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-display font-bold text-base text-slate-900">
                  Edit Order {editingOrder.orderId || editingOrder.id}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Update dealer contact, required delivery schedule, verification status, or item quantities.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingOrder(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {editOrderError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 font-medium">
                {editOrderError}
              </div>
            )}

            {/* Dealer Details & Schedule */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-slate-700">Organization / Firm Name *</label>
                <input
                  type="text"
                  required
                  value={editingOrder.dealerInfo?.firmName || ''}
                  onChange={(e) =>
                    setEditingOrder({
                      ...editingOrder,
                      dealerInfo: { ...editingOrder.dealerInfo, firmName: e.target.value }
                    })
                  }
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-slate-700">Contact Person Name *</label>
                <input
                  type="text"
                  required
                  value={editingOrder.personName}
                  onChange={(e) =>
                    setEditingOrder({
                      ...editingOrder,
                      personName: e.target.value,
                      dealerInfo: { ...editingOrder.dealerInfo, contactPerson: e.target.value }
                    })
                  }
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-slate-700">WhatsApp / Mobile *</label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={editingOrder.dealerInfo.phoneCode || '+91'}
                    onChange={(e) =>
                      setEditingOrder({
                        ...editingOrder,
                        dealerInfo: { ...editingOrder.dealerInfo, phoneCode: e.target.value }
                      })
                    }
                    className="w-16 px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-900"
                  />
                  <input
                    type="text"
                    required
                    value={editingOrder.dealerInfo.phoneNumber}
                    onChange={(e) =>
                      setEditingOrder({
                        ...editingOrder,
                        dealerInfo: { ...editingOrder.dealerInfo, phoneNumber: e.target.value }
                      })
                    }
                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-slate-700">City &amp; State / Location</label>
                <input
                  type="text"
                  value={editingOrder.dealerInfo.cityState}
                  onChange={(e) =>
                    setEditingOrder({
                      ...editingOrder,
                      dealerInfo: { ...editingOrder.dealerInfo, cityState: e.target.value }
                    })
                  }
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-slate-700">Required Date</label>
                  <input
                    type="date"
                    value={editingOrder.requiredDate || ''}
                    onChange={(e) =>
                      setEditingOrder({
                        ...editingOrder,
                        requiredDate: e.target.value || undefined
                      })
                    }
                    className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-900"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-slate-700">Period Label</label>
                  <input
                    type="text"
                    placeholder="e.g. Within 7 Days"
                    value={editingOrder.requiredPeriod || ''}
                    onChange={(e) =>
                      setEditingOrder({
                        ...editingOrder,
                        requiredPeriod: e.target.value
                      })
                    }
                    className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900"
                  />
                </div>
              </div>
            </div>

            {/* Verification Status & Completed */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-slate-700">Verification Status</label>
                <select
                  value={getEffectiveVerificationStatus(editingOrder)}
                  onChange={(e) =>
                    setEditingOrder({
                      ...editingOrder,
                      verificationStatus: e.target.value as OrderVerificationStatus
                    })
                  }
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-900"
                >
                  <option value="pending">Pending Verification</option>
                  <option value="accepted">Accepted (In Production)</option>
                  <option value="rejected">Rejected (Excluded from Production)</option>
                </select>
              </div>

              <div className="flex items-end pb-1">
                <label className="inline-flex items-center space-x-2 text-xs font-semibold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(editingOrder.completed)}
                    onChange={(e) =>
                      setEditingOrder({
                        ...editingOrder,
                        completed: e.target.checked
                      })
                    }
                    className="w-4 h-4 rounded border-slate-300 text-emerald-600"
                  />
                  <span>Mark Order Completed</span>
                </label>
              </div>

              {getEffectiveVerificationStatus(editingOrder) === 'rejected' && (
                <div className="sm:col-span-2 space-y-1">
                  <label className="block text-[11px] font-semibold text-rose-700">
                    Rejection Reason *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Reason for rejecting this order..."
                    value={editingOrder.rejectionReason || ''}
                    onChange={(e) =>
                      setEditingOrder({
                        ...editingOrder,
                        rejectionReason: e.target.value
                      })
                    }
                    className="w-full px-3 py-2 bg-white border border-rose-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-rose-500"
                  />
                </div>
              )}
            </div>

            {/* Order Items & Batch Quantities */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900">
                  Order Batches ({editingOrder.items.length})
                </span>
                <span className="text-xs font-mono font-bold text-blue-700 tabular-nums">
                  Total: {recalculateOrderTotals(editingOrder.items).totalQuantity} Units ·{' '}
                  {recalculateOrderTotals(editingOrder.items).totalWeightKg.toFixed(1)} kg
                </span>
              </div>

              <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                {editingOrder.items.map((item, batchIdx) => (
                  <div
                    key={item.batchId || `${item.productId}-${batchIdx}`}
                    className="p-3 border border-slate-200 rounded-xl bg-slate-50/70 space-y-2.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-bold text-xs text-slate-900">{item.name}</div>
                      <div className="flex items-center gap-2">
                        <select
                          value={item.grade || 'Uty'}
                          onChange={(e) => {
                            const updated = [...editingOrder.items];
                            updated[batchIdx] = { ...item, grade: e.target.value as CeramicGrade };
                            setEditingOrder({ ...editingOrder, items: updated });
                          }}
                          className="px-2 py-1 bg-white border border-slate-200 rounded text-[11px] font-semibold text-slate-800"
                        >
                          <option value="Uty">Uty</option>
                          <option value="S.Uty">S.Uty</option>
                          <option value="ROK">ROK</option>
                        </select>
                        <select
                          value={item.packing || 'Box'}
                          onChange={(e) => {
                            const updated = [...editingOrder.items];
                            updated[batchIdx] = { ...item, packing: e.target.value as CeramicPacking };
                            setEditingOrder({ ...editingOrder, items: updated });
                          }}
                          className="px-2 py-1 bg-white border border-slate-200 rounded text-[11px] font-semibold text-slate-800"
                        >
                          <option value="Box">Box</option>
                          <option value="Paper">Paper</option>
                        </select>
                        {editingOrder.items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              const updated = editingOrder.items.filter((_, idx) => idx !== batchIdx);
                              setEditingOrder({ ...editingOrder, items: updated });
                            }}
                            className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                            title="Remove this batch"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {(item.colorSplits || []).map((split, splitIdx) => (
                        <div
                          key={splitIdx}
                          className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2 py-1.5"
                        >
                          <input
                            type="text"
                            value={split.codeOrColor}
                            onChange={(e) => {
                              const updated = [...editingOrder.items];
                              const nextSplits = [...item.colorSplits];
                              nextSplits[splitIdx] = { ...split, codeOrColor: e.target.value };
                              updated[batchIdx] = { ...item, colorSplits: nextSplits };
                              setEditingOrder({ ...editingOrder, items: updated });
                            }}
                            className="flex-1 min-w-0 text-xs font-medium text-slate-800 focus:outline-none"
                            placeholder="Color / Code"
                          />
                          <input
                            type="number"
                            min="0"
                            value={split.quantity}
                            onChange={(e) => {
                              const updated = [...editingOrder.items];
                              const nextSplits = [...item.colorSplits];
                              nextSplits[splitIdx] = {
                                ...split,
                                quantity: Math.max(0, parseInt(e.target.value || '0', 10) || 0)
                              };
                              updated[batchIdx] = { ...item, colorSplits: nextSplits };
                              setEditingOrder({ ...editingOrder, items: updated });
                            }}
                            className="w-16 px-2 py-1 bg-slate-50 border border-slate-200 rounded text-right font-mono font-bold text-xs text-slate-900 tabular-nums"
                          />
                          {item.colorSplits.length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                const updated = [...editingOrder.items];
                                const nextSplits = item.colorSplits.filter((_, sIdx) => sIdx !== splitIdx);
                                updated[batchIdx] = { ...item, colorSplits: nextSplits };
                                setEditingOrder({ ...editingOrder, items: updated });
                              }}
                              className="text-slate-400 hover:text-rose-600 cursor-pointer"
                              title="Remove line"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          const updated = [...editingOrder.items];
                          updated[batchIdx] = {
                            ...item,
                            colorSplits: [...item.colorSplits, { codeOrColor: 'White', quantity: 1 }]
                          };
                          setEditingOrder({ ...editingOrder, items: updated });
                        }}
                        className="flex items-center justify-center space-x-1 border border-dashed border-slate-300 hover:border-blue-500 text-slate-600 hover:text-blue-700 rounded-lg py-1.5 text-xs font-semibold cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Add Color/Code</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] font-semibold text-slate-700">Order Notes</label>
              <textarea
                rows={2}
                value={editingOrder.dealerInfo.notes || ''}
                onChange={(e) =>
                  setEditingOrder({
                    ...editingOrder,
                    dealerInfo: { ...editingOrder.dealerInfo, notes: e.target.value }
                  })
                }
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingOrder(null)}
                className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                Save Order Changes
              </button>
            </div>
          </form>
        </div>
      )}

      {/* VERIFY ORDER & SELECT UNAVAILABLE ITEMS MODAL */}
      {verifyingOrder && (
        <div className="fixed inset-0 z-60 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleConfirmVerification}
            className="w-full max-w-2xl max-h-[90dvh] overflow-y-auto bg-white border border-slate-200 rounded-2xl shadow-xl p-5 space-y-4"
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-display font-bold text-base text-slate-900 flex items-center space-x-2">
                  <ClipboardCheck className="w-4 h-4 text-emerald-600" />
                  <span>Verify Order &amp; Stock Availability · {verifyingOrder.orderId || verifyingOrder.id}</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {verifyingOrder.dealerInfo?.firmName
                    ? `${verifyingOrder.dealerInfo.firmName} (${verifyingOrder.personName || verifyingOrder.dealerInfo.contactPerson})`
                    : verifyingOrder.personName}{' '}
                  · {verifyingOrder.totalQuantity} Ordered Units
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setVerifyingOrder(null);
                  setVerifyLines([]);
                }}
                className="text-slate-400 hover:text-slate-700 p-1 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start space-x-2.5 text-xs text-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong>Selective Production Routing:</strong> Only mark items that are{' '}
                <strong>Not Available in Stock</strong>. In-stock items stay out of the Production Tracker, while unavailable items are sent directly to Production with your chosen quantity.
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-800">
                Order Line Items ({verifyLines.length})
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    setVerifyLines((prev) =>
                      prev.map((l) => ({ ...l, unavailable: false }))
                    )
                  }
                  className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-[11px] font-semibold cursor-pointer"
                >
                  All Available (In Stock)
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setVerifyLines((prev) =>
                      prev.map((l) => ({ ...l, unavailable: true, qtyToMake: l.orderedQty }))
                    )
                  }
                  className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-lg text-[11px] font-semibold cursor-pointer"
                >
                  Mark All Unavailable -&gt; Prod
                </button>
              </div>
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {verifyLines.map((line, idx) => (
                <div
                  key={line.lineKey}
                  className={`p-3 rounded-xl border transition-colors ${
                    line.unavailable
                      ? 'bg-amber-50/70 border-amber-300'
                      : 'bg-slate-50/70 border-slate-200'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="min-w-0">
                      <div className="font-bold text-xs text-slate-900">
                        {line.productName}
                      </div>
                      <div className="text-[11px] text-slate-600 font-mono">
                        {line.grade} · {line.packing} · <strong>{line.codeOrColor}</strong> · Ordered:{' '}
                        <strong className="text-blue-700">{line.orderedQty} pcs</strong>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <div className="inline-flex bg-white border border-slate-200 rounded-lg p-0.5 text-[11px] font-semibold">
                        <button
                          type="button"
                          onClick={() =>
                            setVerifyLines((prev) =>
                              prev.map((item, i) =>
                                i === idx ? { ...item, unavailable: false } : item
                              )
                            )
                          }
                          className={`px-2.5 py-1 rounded-md cursor-pointer transition-colors ${
                            !line.unavailable
                              ? 'bg-emerald-600 text-white'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          In Stock
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setVerifyLines((prev) =>
                              prev.map((item, i) =>
                                i === idx
                                  ? {
                                      ...item,
                                      unavailable: true,
                                      qtyToMake: item.qtyToMake > 0 ? item.qtyToMake : item.orderedQty
                                    }
                                  : item
                              )
                            )
                          }
                          className={`px-2.5 py-1 rounded-md cursor-pointer transition-colors ${
                            line.unavailable
                              ? 'bg-amber-600 text-white'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Not Available -&gt; Prod
                        </button>
                      </div>

                      {line.unavailable && (
                        <div className="flex items-center space-x-1.5">
                          <label className="text-[11px] font-semibold text-amber-900 whitespace-nowrap">
                            Make Qty:
                          </label>
                          <input
                            type="number"
                            min="1"
                            required
                            value={line.qtyToMake}
                            onChange={(e) => {
                              const val = Math.max(1, parseInt(e.target.value || '1', 10) || 1);
                              setVerifyLines((prev) =>
                                prev.map((item, i) =>
                                  i === idx ? { ...item, qtyToMake: val } : item
                                )
                              );
                            }}
                            className="w-20 px-2 py-1 bg-white border border-amber-300 rounded-lg text-xs font-mono font-bold text-slate-900 text-right tabular-nums"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs">
              {(() => {
                const selectedLines = verifyLines.filter((l) => l.unavailable && l.qtyToMake > 0);
                const selectedUnits = selectedLines.reduce((s, l) => s + l.qtyToMake, 0);
                return selectedLines.length > 0 ? (
                  <span className="text-amber-900 font-semibold">
                    {selectedLines.length} unavailable line{selectedLines.length === 1 ? '' : 's'} ({selectedUnits} units) will be added to Production Tracker.
                  </span>
                ) : (
                  <span className="text-emerald-800 font-semibold">
                    All items available in stock — 0 items will be sent to Production Tracker.
                  </span>
                );
              })()}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  const target = verifyingOrder;
                  setVerifyingOrder(null);
                  setVerifyLines([]);
                  onRequestRejectOrder(target);
                }}
                className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold rounded-lg cursor-pointer"
              >
                Reject Order...
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setVerifyingOrder(null);
                    setVerifyLines([]);
                  }}
                  className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg cursor-pointer flex items-center space-x-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Confirm Verification</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* ADMIN-ONLY ESTIMATE EXCEL EXPORT MODAL */}
      {canExportEstimate && estimateOrder && (
        <OrderEstimateExportModal
          order={estimateOrder}
          onClose={() => setEstimateOrder(null)}
          onExported={(filename) =>
            toastSuccess(`Downloaded ${filename} with live formulas and blank Rate cells.`, 'Estimate Excel Ready')
          }
          onError={(msg) => toastError(msg, 'Estimate Export Failed')}
        />
      )}
    </div>
  );
};

interface AdminInquiriesPanelProps {
  inquiries: SavedInquiry[];
  searchFilter: string;
  onSearchChange: (val: string) => void;
  onDownloadCSV: () => void;
  onCopyTable: () => void;
  copiedSuccess: boolean;
  onUpdateInquiry: (id: string, updates: Partial<SavedInquiry>) => void;
  onDeleteInquiry: (id: string) => void;
  onClearInquiries: () => void;
  canManageInquiries: boolean;
  canDeleteInquiries: boolean;
  canConfigureWebhook?: boolean;
  onRequestConfirm: (config: ConfirmDialogConfig) => void;
  webhookInput: string;
  onWebhookInputChange: (val: string) => void;
  onSaveWebhook: (e: React.FormEvent) => void;
  appsScriptCode: string;
}

export const AdminInquiriesPanel: React.FC<AdminInquiriesPanelProps> = ({
  inquiries,
  searchFilter,
  onSearchChange,
  onDownloadCSV,
  onCopyTable,
  copiedSuccess,
  onUpdateInquiry,
  onDeleteInquiry,
  onClearInquiries,
  canManageInquiries,
  canDeleteInquiries,
  canConfigureWebhook = true,
  onRequestConfirm,
  webhookInput,
  onWebhookInputChange,
  onSaveWebhook,
  appsScriptCode
}) => {
  const [showAppsScriptGuide, setShowAppsScriptGuide] = useState(false);
  const [editingInquiry, setEditingInquiry] = useState<SavedInquiry | null>(null);

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

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-700 mb-1">
            Lead Pipeline
          </p>
          <h1 className="font-display font-bold text-2xl text-slate-900">Inquiries &amp; Leads</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            All B2B dealership requests, website quote inquiries, and automated Google Sheet webhook pushes.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onDownloadCSV}
            disabled={inquiries.length === 0}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors flex items-center space-x-1.5 cursor-pointer whitespace-nowrap shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={onCopyTable}
            disabled={inquiries.length === 0}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 disabled:opacity-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors flex items-center space-x-1.5 cursor-pointer whitespace-nowrap"
          >
            <Copy className="w-3.5 h-3.5 text-slate-500" />
            <span>{copiedSuccess ? 'Copied to Clipboard!' : 'Copy for Sheets'}</span>
          </button>

          {canDeleteInquiries && inquiries.length > 0 && (
            <button
              type="button"
              onClick={() =>
                onRequestConfirm({
                  title: 'Clear All Inquiries?',
                  message: `Remove all ${inquiries.length} saved B2B inquiries? Export CSV first if you need a backup.`,
                  confirmLabel: 'Clear All Inquiries',
                  tone: 'danger',
                  onConfirm: onClearInquiries
                })
              }
              className="px-3 py-2 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg transition-colors flex items-center space-x-1.5 cursor-pointer text-xs font-semibold whitespace-nowrap"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear All</span>
            </button>
          )}
        </div>
      </div>

      {!canDeleteInquiries && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 flex items-center space-x-2 text-xs text-slate-600">
          <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span>
            Sales role can view, follow up, edit lead status/notes, and export inquiries. Deleting inquiries is restricted to <strong>Admin</strong>.
          </span>
        </div>
      )}

      {/* Webhook Push Configuration (Admin only) */}
      {canConfigureWebhook && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center space-x-2">
              <Webhook className="w-4 h-4 text-emerald-600" />
              <span className="font-semibold text-slate-900 text-xs">
                Automatic Webhook Push (Push directly to Google Sheets)
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowAppsScriptGuide(!showAppsScriptGuide)}
              className="text-blue-600 hover:underline text-xs flex items-center space-x-1 cursor-pointer font-medium"
            >
              <Code className="w-3.5 h-3.5" />
              <span>{showAppsScriptGuide ? 'Hide Apps Script Code' : 'View Google Apps Script Code'}</span>
            </button>
          </div>

          <form onSubmit={onSaveWebhook} className="flex flex-col sm:flex-row gap-2">
            <input
              type="url"
              placeholder="Paste Webhook URL (Apps Script or SheetDB URL: https://...)"
              value={webhookInput}
              onChange={(e) => onWebhookInputChange(e.target.value)}
              disabled={!canManageInquiries}
              className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={!canManageInquiries}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap"
            >
              Save Webhook
            </button>
          </form>

          {showAppsScriptGuide && (
            <div className="mt-3 p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-3">
              <div className="space-y-1.5">
                <p className="font-semibold text-slate-900">Standard Google Apps Script Setup:</p>
                <ol className="list-decimal pl-4 space-y-1 text-slate-600">
                  <li>In your Google Sheet, click <strong>Extensions &gt; Apps Script</strong>.</li>
                  <li>Rename project to <strong>Hightone Leads Webhook</strong> and paste the code below.</li>
                  <li>Click <strong>Deploy &gt; New deployment</strong> (Type: <strong>Web app</strong>, Execute as: <strong>Me</strong>, Access: <strong>Anyone</strong>).</li>
                  <li><strong className="text-rose-700">Do NOT click Run</strong> inside the script editor. Only click Deploy.</li>
                  <li>Paste the resulting Web App URL in the box above.</li>
                </ol>
              </div>

              <pre className="p-3 bg-slate-900 text-slate-100 rounded-lg text-[11px] overflow-x-auto font-mono">
                {appsScriptCode}
              </pre>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-[11px] space-y-1 text-amber-900">
                <strong className="block font-semibold">
                  Troubleshooting &quot;Access blocked (Error 400)&quot; under Google Advanced Protection:
                </strong>
                <p>
                  Use <a href="https://sheetdb.io" target="_blank" rel="noopener noreferrer" className="text-blue-700 underline font-semibold">SheetDB.io</a> to get an instant API URL, deploy from a standard Gmail account, or use Export CSV / Copy for Sheets anytime.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Search Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by Firm, Contact, WhatsApp, City, Item..."
            value={searchFilter}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500"
          />
        </div>
        <div className="text-xs text-slate-500 tabular-nums">
          Showing <strong>{filteredInquiries.length}</strong> of {inquiries.length} inquiries
        </div>
      </div>

      {/* Inquiries Table + Mobile Cards */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {filteredInquiries.length === 0 ? (
          <div className="py-12 px-4 text-center">
            <Layers className="w-9 h-9 text-slate-300 mx-auto mb-2.5" />
            <div className="font-semibold text-slate-700 text-sm">
              {searchFilter ? 'No matching inquiries found' : 'No inquiries recorded yet'}
            </div>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              Form submissions from the website quote modal and B2B dealership forms will appear here automatically.
            </p>
          </div>
        ) : (
          <>
            {/* Mobile Cards */}
            <div className="divide-y divide-slate-200 md:hidden">
              {filteredInquiries.map((inq) => (
                <div key={inq.id} className="p-4 space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-bold text-sm text-slate-900 truncate">{inq.businessName}</div>
                      <div className="text-xs text-slate-500">{inq.contactPerson}</div>
                    </div>
                    {(canManageInquiries || canDeleteInquiries) && (
                      <div className="flex items-center space-x-1">
                        {canManageInquiries && (
                          <button
                            type="button"
                            onClick={() => setEditingInquiry({ ...inq })}
                            className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg cursor-pointer"
                            title="Edit inquiry"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                        {canDeleteInquiries && (
                          <button
                            type="button"
                            onClick={() =>
                              onRequestConfirm({
                                title: 'Delete Inquiry?',
                                message: `Remove inquiry from ${inq.businessName}?`,
                                confirmLabel: 'Delete',
                                tone: 'danger',
                                onConfirm: () => onDeleteInquiry(inq.id)
                              })
                            }
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer"
                            title="Delete inquiry"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="text-xs text-slate-700 font-medium">{inq.productInterest}</div>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                    <span>{inq.cityState || '—'} · {inq.volume || 'Standard'}</span>
                    <a
                      href={`https://wa.me/${inq.whatsappNumber.replace(/\D/g, '')}?text=Hello%20${encodeURIComponent(inq.contactPerson)}%2C%20regarding%20your%20Hightone%20Ceramic%20inquiry%20for%20${encodeURIComponent(inq.productInterest)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-700 font-mono font-semibold flex items-center space-x-1"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>{inq.whatsappNumber}</span>
                    </a>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto max-h-[500px]">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 sticky top-0 z-10 text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4 whitespace-nowrap">ID / Time</th>
                    <th className="py-3 px-4 whitespace-nowrap">Business / Contact</th>
                    <th className="py-3 px-4 whitespace-nowrap">WhatsApp</th>
                    <th className="py-3 px-4 whitespace-nowrap">City &amp; State</th>
                    <th className="py-3 px-4 whitespace-nowrap">Product Interest</th>
                    <th className="py-3 px-4 whitespace-nowrap">Volume</th>
                    <th className="py-3 px-4 whitespace-nowrap text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredInquiries.map((inq) => (
                    <tr key={inq.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px] tabular-nums">
                        <div className="font-semibold text-slate-900">{inq.id}</div>
                        <div className="text-[11px] text-slate-400">{inq.timestamp}</div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-semibold text-slate-900">{inq.businessName}</div>
                        <div className="text-[11px] text-slate-500">{inq.contactPerson}</div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap font-mono tabular-nums">
                        <a
                          href={`https://wa.me/${inq.whatsappNumber.replace(/\D/g, '')}?text=Hello%20${encodeURIComponent(inq.contactPerson)}%2C%20regarding%20your%20Hightone%20Ceramic%20inquiry%20for%20${encodeURIComponent(inq.productInterest)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-emerald-700 hover:underline flex items-center space-x-1"
                        >
                          <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{inq.whatsappNumber}</span>
                        </a>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-slate-600">
                        {inq.cityState || '—'}
                      </td>
                      <td className="py-3 px-4 max-w-[220px] truncate text-slate-800" title={inq.productInterest}>
                        {inq.productInterest}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-slate-600">
                        {inq.volume || '—'}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-right">
                        {(canManageInquiries || canDeleteInquiries) && (
                          <div className="inline-flex items-center space-x-1">
                            {canManageInquiries && (
                              <button
                                type="button"
                                onClick={() => setEditingInquiry({ ...inq })}
                                className="text-slate-500 hover:text-blue-700 hover:bg-blue-50 p-1.5 rounded-lg transition-colors cursor-pointer"
                                title="Edit inquiry"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                            )}
                            {canDeleteInquiries && (
                              <button
                                type="button"
                                onClick={() =>
                                  onRequestConfirm({
                                    title: 'Delete Inquiry?',
                                    message: `Remove inquiry from ${inq.businessName}?`,
                                    confirmLabel: 'Delete',
                                    tone: 'danger',
                                    onConfirm: () => onDeleteInquiry(inq.id)
                                  })
                                }
                                className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg transition-colors cursor-pointer"
                                title="Delete inquiry"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* EDIT INQUIRY MODAL */}
      {editingInquiry && (
        <div className="fixed inset-0 z-60 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onUpdateInquiry(editingInquiry.id, {
                businessName: editingInquiry.businessName.trim(),
                contactPerson: editingInquiry.contactPerson.trim(),
                whatsappNumber: editingInquiry.whatsappNumber.trim(),
                cityState: editingInquiry.cityState.trim(),
                volume: editingInquiry.volume.trim(),
                productInterest: editingInquiry.productInterest.trim(),
                notes: editingInquiry.notes.trim(),
                status: editingInquiry.status
              });
              setEditingInquiry(null);
            }}
            className="w-full max-w-lg max-h-[90dvh] overflow-y-auto bg-white border border-slate-200 rounded-2xl shadow-xl p-5 space-y-4"
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-display font-bold text-base text-slate-900">
                  Edit Inquiry {editingInquiry.id}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Update firm name, contact person, WhatsApp, product interest, or lead status.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingInquiry(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-slate-700">Business / Firm Name *</label>
                <input
                  type="text"
                  required
                  value={editingInquiry.businessName}
                  onChange={(e) => setEditingInquiry({ ...editingInquiry, businessName: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-slate-700">Contact Person *</label>
                <input
                  type="text"
                  required
                  value={editingInquiry.contactPerson}
                  onChange={(e) => setEditingInquiry({ ...editingInquiry, contactPerson: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-slate-700">WhatsApp / Phone *</label>
                <input
                  type="text"
                  required
                  value={editingInquiry.whatsappNumber}
                  onChange={(e) => setEditingInquiry({ ...editingInquiry, whatsappNumber: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-slate-700">City &amp; State</label>
                <input
                  type="text"
                  value={editingInquiry.cityState}
                  onChange={(e) => setEditingInquiry({ ...editingInquiry, cityState: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-slate-700">Product Interest</label>
                <input
                  type="text"
                  value={editingInquiry.productInterest}
                  onChange={(e) => setEditingInquiry({ ...editingInquiry, productInterest: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-slate-700">Volume &amp; Lead Status</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={editingInquiry.volume}
                    onChange={(e) => setEditingInquiry({ ...editingInquiry, volume: e.target.value })}
                    className="flex-1 px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900"
                    placeholder="Volume"
                  />
                  <select
                    value={editingInquiry.status}
                    onChange={(e) =>
                      setEditingInquiry({
                        ...editingInquiry,
                        status: e.target.value as SavedInquiry['status']
                      })
                    }
                    className="px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800"
                  >
                    <option value="new">New</option>
                    <option value="contacted">Contacted</option>
                    <option value="quoted">Quoted</option>
                  </select>
                </div>
              </div>
              <div className="sm:col-span-2 space-y-1">
                <label className="block text-[11px] font-semibold text-slate-700">Notes</label>
                <textarea
                  rows={2}
                  value={editingInquiry.notes}
                  onChange={(e) => setEditingInquiry({ ...editingInquiry, notes: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingInquiry(null)}
                className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                Save Inquiry
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
