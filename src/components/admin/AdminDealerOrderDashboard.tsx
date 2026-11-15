import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  Package,
  Layers,
  Award,
  ArrowUpRight,
  Download,
  Weight
} from 'lucide-react';
import { ProductItem, SavedDealerOrder } from '../../types';
import { getEffectiveVerificationStatus, isOrderCompleted } from '../../utils/adminRoles';
import { AdminSectionId } from './adminTypes';

interface AdminDealerOrderDashboardProps {
  dealerOrders: SavedDealerOrder[];
  products: ProductItem[];
  onNavigateSection: (section: AdminSectionId) => void;
  onDownloadOrdersCSV: () => void;
}

type OrderScopeFilter = 'valid' | 'accepted' | 'pending' | 'all';

interface ModelAggregate {
  productId: string;
  name: string;
  category: string;
  totalUnits: number;
  totalWeightKg: number;
  orderIds: Set<string>;
  dealerKeys: Set<string>;
  grades: Record<string, number>;
  packings: Record<string, number>;
  variants: Record<string, number>;
}

interface CategoryAggregate {
  category: string;
  totalUnits: number;
  totalWeightKg: number;
  orderIds: Set<string>;
  models: ModelAggregate[];
  topModel: ModelAggregate | null;
}

export const AdminDealerOrderDashboard: React.FC<AdminDealerOrderDashboardProps> = ({
  dealerOrders,
  products,
  onNavigateSection,
  onDownloadOrdersCSV
}) => {
  const [scopeFilter, setScopeFilter] = useState<OrderScopeFilter>('valid');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showAllModels, setShowAllModels] = useState<boolean>(false);
  const [hoveredModelKey, setHoveredModelKey] = useState<string | null>(null);
  const [hoveredCategoryBar, setHoveredCategoryBar] = useState<string | null>(null);

  const productCategoryLookup = useMemo(() => {
    const map = new Map<string, string>();
    products.forEach((p) => {
      if (p.id && p.category) map.set(p.id, p.category);
    });
    return map;
  }, [products]);

  const scopeCounts = useMemo(() => {
    let valid = 0;
    let accepted = 0;
    let pending = 0;
    dealerOrders.forEach((ord) => {
      const ver = getEffectiveVerificationStatus(ord);
      const completed = isOrderCompleted(ord);
      if (ver !== 'rejected') valid++;
      if (ver === 'accepted' || completed) accepted++;
      if (ver === 'pending' && !completed) pending++;
    });
    return { valid, accepted, pending, all: dealerOrders.length };
  }, [dealerOrders]);

  const filteredOrders = useMemo(() => {
    return dealerOrders.filter((ord) => {
      const ver = getEffectiveVerificationStatus(ord);
      const completed = isOrderCompleted(ord);
      if (scopeFilter === 'valid') return ver !== 'rejected';
      if (scopeFilter === 'accepted') return ver === 'accepted' || completed;
      if (scopeFilter === 'pending') return ver === 'pending' && !completed;
      return true;
    });
  }, [dealerOrders, scopeFilter]);

  const analytics = useMemo(() => {
    const modelMap = new Map<string, ModelAggregate>();
    const categoryMap = new Map<string, CategoryAggregate>();
    const dealerSet = new Set<string>();
    let totalUnits = 0;
    let totalWeightKg = 0;

    filteredOrders.forEach((ord) => {
      const dealerKey = (
        ord.dealerAccountId ||
        ord.dealerUserId ||
        ord.dealerInfo?.firmName ||
        ord.personName ||
        ord.id
      )
        .trim()
        .toLowerCase();
      if (dealerKey) dealerSet.add(dealerKey);

      (ord.items || []).forEach((item) => {
        const qty = Number(item.totalQuantity) || 0;
        if (qty <= 0) return;

        const category =
          (item.category || '').trim() ||
          productCategoryLookup.get(item.productId) ||
          (item.series || '').trim() ||
          'Other Sanitaryware';

        const weight =
          typeof item.totalWeightKg === 'number' && !isNaN(item.totalWeightKg)
            ? item.totalWeightKg
            : qty * (item.unitWeightKg || 15);

        totalUnits += qty;
        totalWeightKg += weight;

        const modelKey = `${category}::${item.productId || item.name}`;
        let modelEntry = modelMap.get(modelKey);
        if (!modelEntry) {
          modelEntry = {
            productId: item.productId || item.name,
            name: item.name || 'Unnamed Model',
            category,
            totalUnits: 0,
            totalWeightKg: 0,
            orderIds: new Set<string>(),
            dealerKeys: new Set<string>(),
            grades: { Uty: 0, 'S.Uty': 0, ROK: 0 },
            packings: { Box: 0, Paper: 0 },
            variants: {}
          };
          modelMap.set(modelKey, modelEntry);
        }

        modelEntry.totalUnits += qty;
        modelEntry.totalWeightKg += weight;
        modelEntry.orderIds.add(ord.id);
        if (dealerKey) modelEntry.dealerKeys.add(dealerKey);

        const gradeKey = item.grade || 'Uty';
        const packingKey = item.packing || 'Box';
        modelEntry.grades[gradeKey] = (modelEntry.grades[gradeKey] || 0) + qty;
        modelEntry.packings[packingKey] = (modelEntry.packings[packingKey] || 0) + qty;

        (item.colorSplits || []).forEach((split) => {
          if (!split.quantity || split.quantity <= 0) return;
          const vKey = (split.codeOrColor || 'White').trim();
          modelEntry!.variants[vKey] = (modelEntry!.variants[vKey] || 0) + split.quantity;
        });

        let catEntry = categoryMap.get(category);
        if (!catEntry) {
          catEntry = {
            category,
            totalUnits: 0,
            totalWeightKg: 0,
            orderIds: new Set<string>(),
            models: [],
            topModel: null
          };
          categoryMap.set(category, catEntry);
        }
        catEntry.totalUnits += qty;
        catEntry.totalWeightKg += weight;
        catEntry.orderIds.add(ord.id);
      });
    });

    const allModels = Array.from(modelMap.values()).sort((a, b) => b.totalUnits - a.totalUnits);

    allModels.forEach((m) => {
      const catEntry = categoryMap.get(m.category);
      if (catEntry) {
        catEntry.models.push(m);
        if (!catEntry.topModel || m.totalUnits > catEntry.topModel.totalUnits) {
          catEntry.topModel = m;
        }
      }
    });

    const categories = Array.from(categoryMap.values()).sort(
      (a, b) => b.totalUnits - a.totalUnits
    );

    return {
      totalUnits,
      totalWeightKg,
      totalOrders: filteredOrders.length,
      uniqueDealers: dealerSet.size,
      categories,
      allModels,
      topCategory: categories[0] || null,
      topModel: allModels[0] || null
    };
  }, [filteredOrders, productCategoryLookup]);

  const effectiveCategory =
    selectedCategory !== 'all' &&
    analytics.categories.some((c) => c.category === selectedCategory)
      ? selectedCategory
      : 'all';

  const displayedModels = useMemo(() => {
    const base =
      effectiveCategory === 'all'
        ? analytics.allModels
        : analytics.allModels.filter((m) => m.category === effectiveCategory);
    return showAllModels ? base : base.slice(0, 10);
  }, [analytics.allModels, effectiveCategory, showAllModels]);

  const maxModelUnits = useMemo(
    () => Math.max(1, ...displayedModels.map((m) => m.totalUnits)),
    [displayedModels]
  );

  // SVG Vertical Bar Chart Geometry for Category Volume
  const categoryChartGeometry = useMemo(() => {
    const cats = analytics.categories;
    const svgWidth = Math.max(620, cats.length * 108 + 80);
    const svgHeight = 250;
    const padLeft = 52;
    const padRight = 24;
    const padTop = 32;
    const padBottom = 64;
    const plotW = svgWidth - padLeft - padRight;
    const plotH = svgHeight - padTop - padBottom;
    const maxCatUnits = Math.max(1, ...cats.map((c) => c.totalUnits));
    const slotW = cats.length > 0 ? plotW / cats.length : plotW;
    const barW = Math.min(54, Math.max(24, slotW * 0.56));

    const bars = cats.map((cat, idx) => {
      const h = (cat.totalUnits / maxCatUnits) * plotH;
      const x = padLeft + idx * slotW + (slotW - barW) / 2;
      const y = padTop + plotH - h;
      const sharePct =
        analytics.totalUnits > 0
          ? Math.round((cat.totalUnits / analytics.totalUnits) * 100)
          : 0;

      // Split label cleanly across up to 2 short lines
      const words = cat.category.split(/\s+/);
      const line1 = words.slice(0, 2).join(' ');
      const line2 = words.slice(2, 4).join(' ');

      return {
        ...cat,
        x,
        y,
        width: barW,
        height: Math.max(2, h),
        centerX: x + barW / 2,
        sharePct,
        line1,
        line2
      };
    });

    return { svgWidth, svgHeight, padLeft, padRight, padTop, plotH, maxCatUnits, bars };
  }, [analytics]);

  const inspectedModel = useMemo(() => {
    if (!hoveredModelKey) return displayedModels[0] || null;
    return (
      displayedModels.find((m) => `${m.category}::${m.productId}` === hoveredModelKey) ||
      displayedModels[0] ||
      null
    );
  }, [hoveredModelKey, displayedModels]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-700 mb-1">
            Order Analytics
          </p>
          <h1 className="font-display font-bold text-2xl sm:text-3xl text-slate-900 tracking-tight">
            Dealer Order Dashboard
          </h1>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl">
            Visualizes total ordered sanitaryware volume across categories and ranks the most popular models demanded by verified dealers.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onDownloadOrdersCSV}
            disabled={dealerOrders.length === 0}
            className="px-4 py-2 bg-white hover:bg-slate-50 disabled:opacity-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors flex items-center space-x-2 cursor-pointer whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export Orders CSV</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigateSection('dealer-orders')}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center space-x-1.5 cursor-pointer whitespace-nowrap shadow-xs"
          >
            <span>Open Dealer Orders</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Order Status Scope Filter */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="text-xs font-semibold text-slate-700">
          Order Volume Scope
        </div>
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
          {(
            [
              { id: 'valid', label: `Active & Accepted (${scopeCounts.valid})` },
              { id: 'accepted', label: `Accepted / Completed (${scopeCounts.accepted})` },
              { id: 'pending', label: `Pending Verify (${scopeCounts.pending})` },
              { id: 'all', label: `All Orders (${scopeCounts.all})` }
            ] as Array<{ id: OrderScopeFilter; label: string }>
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setScopeFilter(opt.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap tabular-nums ${
                scopeFilter === opt.id
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Empty State */}
      {analytics.totalUnits === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <BarChart3 className="w-6 h-6" />
          </div>
          <h2 className="font-display font-bold text-base text-slate-900">
            No ordered items found for this filter
          </h2>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {dealerOrders.length === 0
              ? 'Once dealers place wholesale orders in Create Dealer Order, ordered volumes, category totals, and most popular sanitaryware models will appear here.'
              : 'Try switching the Order Volume Scope above to All Orders or Active & Accepted to visualize dealer demand.'}
          </p>
          <div className="pt-1 flex items-center justify-center gap-2.5">
            {scopeFilter !== 'all' && dealerOrders.length > 0 && (
              <button
                type="button"
                onClick={() => setScopeFilter('all')}
                className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer"
              >
                Show All Orders
              </button>
            )}
            <button
              type="button"
              onClick={() => onNavigateSection('dealer-orders')}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg cursor-pointer"
            >
              Go to Dealer Orders
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* 4 KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                <Package className="w-5 h-5" />
              </div>
              <div className="mt-4">
                <div className="text-xs font-medium text-slate-500">Total Ordered Volume</div>
                <div className="text-2xl font-display font-bold text-slate-900 tabular-nums mt-0.5">
                  {analytics.totalUnits.toLocaleString('en-IN')} Units
                </div>
                <div className="text-xs text-slate-500 mt-1 tabular-nums">
                  {analytics.totalOrders} orders · {analytics.uniqueDealers} dealers
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <Weight className="w-5 h-5" />
              </div>
              <div className="mt-4">
                <div className="text-xs font-medium text-slate-500">Total Consignment Weight</div>
                <div className="text-2xl font-display font-bold text-slate-900 tabular-nums mt-0.5">
                  {analytics.totalWeightKg.toLocaleString('en-IN', { maximumFractionDigits: 1 })} kg
                </div>
                <div className="text-xs text-slate-500 mt-1 tabular-nums">
                  Across {analytics.allModels.length} distinct ordered models
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <Layers className="w-5 h-5" />
              </div>
              <div className="mt-4">
                <div className="text-xs font-medium text-slate-500">Highest-Volume Category</div>
                <div className="text-lg font-display font-bold text-slate-900 truncate mt-0.5">
                  {analytics.topCategory?.category || '—'}
                </div>
                <div className="text-xs text-slate-500 mt-1 tabular-nums">
                  {analytics.topCategory
                    ? `${analytics.topCategory.totalUnits.toLocaleString('en-IN')} units (${Math.round(
                        (analytics.topCategory.totalUnits / analytics.totalUnits) * 100
                      )}% share)`
                    : '—'}
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Award className="w-5 h-5" />
              </div>
              <div className="mt-4">
                <div className="text-xs font-medium text-slate-500">#1 Most Popular Model</div>
                <div className="text-lg font-display font-bold text-slate-900 truncate mt-0.5">
                  {analytics.topModel?.name || '—'}
                </div>
                <div className="text-xs text-slate-500 mt-1 truncate tabular-nums">
                  {analytics.topModel
                    ? `${analytics.topModel.totalUnits.toLocaleString('en-IN')} units · ${analytics.topModel.category}`
                    : '—'}
                </div>
              </div>
            </div>
          </div>

          {/* BAR CHART 1: TOTAL ORDERED VOLUME BY CATEGORY */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-700">
                  Category Volume Distribution
                </p>
                <h2 className="font-display font-bold text-lg text-slate-900 mt-0.5">
                  Total Ordered Units by Sanitaryware Category
                </h2>
              </div>
              <div className="text-xs text-slate-500">
                Click any bar to filter Popular Models below
                {effectiveCategory !== 'all' && (
                  <button
                    type="button"
                    onClick={() => setSelectedCategory('all')}
                    className="ml-2 text-blue-600 font-semibold hover:underline cursor-pointer"
                  >
                    Reset Filter
                  </button>
                )}
              </div>
            </div>

            <div className="w-full overflow-x-auto">
              <svg
                viewBox={`0 0 ${categoryChartGeometry.svgWidth} ${categoryChartGeometry.svgHeight}`}
                className="w-full h-64 min-w-[540px]"
                role="img"
                aria-label="Bar chart showing total ordered units by sanitaryware category"
              >
                {/* Y-axis horizontal grid lines & ticks */}
                {[0, 0.25, 0.5, 0.75, 1].map((frac, idx) => {
                  const y =
                    categoryChartGeometry.padTop +
                    (1 - frac) * categoryChartGeometry.plotH;
                  const val = Math.round(categoryChartGeometry.maxCatUnits * frac);
                  return (
                    <g key={idx}>
                      <line
                        x1={categoryChartGeometry.padLeft}
                        y1={y}
                        x2={categoryChartGeometry.svgWidth - categoryChartGeometry.padRight}
                        y2={y}
                        stroke={frac === 0 ? '#CBD5E1' : '#E2E8F0'}
                        strokeDasharray={frac === 0 ? undefined : '3 3'}
                        strokeWidth="1"
                      />
                      <text
                        x={categoryChartGeometry.padLeft - 8}
                        y={y + 3}
                        textAnchor="end"
                        fill="#64748B"
                        fontSize="10"
                        fontFamily="ui-monospace, SFMono-Regular, monospace"
                      >
                        {val}
                      </text>
                    </g>
                  );
                })}

                {/* Category Bars */}
                {categoryChartGeometry.bars.map((bar) => {
                  const isActive = effectiveCategory === bar.category;
                  const isHovered = hoveredCategoryBar === bar.category;
                  const fillColor = isActive
                    ? '#0F2E52'
                    : isHovered
                    ? '#1D4ED8'
                    : '#2563EB';

                  return (
                    <g
                      key={bar.category}
                      onClick={() =>
                        setSelectedCategory((prev) =>
                          prev === bar.category ? 'all' : bar.category
                        )
                      }
                      onMouseEnter={() => setHoveredCategoryBar(bar.category)}
                      onMouseLeave={() => setHoveredCategoryBar(null)}
                      className="cursor-pointer"
                    >
                      <rect
                        x={bar.x}
                        y={bar.y}
                        width={bar.width}
                        height={bar.height}
                        rx="4"
                        fill={fillColor}
                        className="transition-colors duration-150"
                      />
                      {/* Unit Count Above Bar */}
                      <text
                        x={bar.centerX}
                        y={bar.y - 8}
                        textAnchor="middle"
                        fill="#0F172A"
                        fontSize="11"
                        fontWeight="700"
                        fontFamily="ui-monospace, SFMono-Regular, monospace"
                      >
                        {bar.totalUnits}
                      </text>
                      {/* Share % just below unit line or top inside */}
                      <text
                        x={bar.centerX}
                        y={categoryChartGeometry.padTop + categoryChartGeometry.plotH + 16}
                        textAnchor="middle"
                        fill={isActive ? '#0F2E52' : '#334155'}
                        fontSize="10.5"
                        fontWeight={isActive ? '700' : '600'}
                      >
                        {bar.line1}
                      </text>
                      {bar.line2 && (
                        <text
                          x={bar.centerX}
                          y={categoryChartGeometry.padTop + categoryChartGeometry.plotH + 29}
                          textAnchor="middle"
                          fill="#64748B"
                          fontSize="10"
                        >
                          {bar.line2}
                        </text>
                      )}
                      <text
                        x={bar.centerX}
                        y={
                          categoryChartGeometry.padTop +
                          categoryChartGeometry.plotH +
                          (bar.line2 ? 43 : 31)
                        }
                        textAnchor="middle"
                        fill="#64748B"
                        fontSize="9.5"
                        fontFamily="ui-monospace, SFMono-Regular, monospace"
                      >
                        {bar.sharePct}% share
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>

          {/* BAR CHART 2: MOST POPULAR MODELS BY CATEGORY */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-700">
                  Model Demand Ranking
                </p>
                <h2 className="font-display font-bold text-lg text-slate-900 mt-0.5">
                  Most Popular Models{' '}
                  {effectiveCategory === 'all'
                    ? 'Across All Categories'
                    : `in ${effectiveCategory}`}
                </h2>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAllModels((prev) => !prev)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap"
                >
                  {showAllModels ? 'Show Top 10' : 'Show All Models'}
                </button>
              </div>
            </div>

            {/* Category Selector Tabs */}
            <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 pb-4">
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap tabular-nums ${
                  effectiveCategory === 'all'
                    ? 'bg-[#0F2E52] text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                All Categories ({analytics.allModels.length})
              </button>
              {analytics.categories.map((cat) => (
                <button
                  key={cat.category}
                  type="button"
                  onClick={() => setSelectedCategory(cat.category)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap tabular-nums ${
                    effectiveCategory === cat.category
                      ? 'bg-[#0F2E52] text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {cat.category} ({cat.models.length})
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Horizontal Model Bar Chart */}
              <div className="lg:col-span-8 space-y-3">
                {displayedModels.map((model, idx) => {
                  const pctOfTop = Math.max(4, Math.round((model.totalUnits / maxModelUnits) * 100));
                  const mKey = `${model.category}::${model.productId}`;
                  const isTop = idx === 0;
                  const isInspected =
                    inspectedModel &&
                    `${inspectedModel.category}::${inspectedModel.productId}` === mKey;

                  return (
                    <div
                      key={mKey}
                      onMouseEnter={() => setHoveredModelKey(mKey)}
                      onClick={() => setHoveredModelKey(mKey)}
                      className={`p-3 rounded-lg border transition-colors cursor-pointer ${
                        isInspected
                          ? 'bg-slate-50 border-blue-300'
                          : 'bg-white border-slate-200/80 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-baseline justify-between gap-3 mb-2">
                        <div className="min-w-0 flex items-baseline gap-2">
                          <span className="font-mono text-xs font-bold text-slate-400 tabular-nums shrink-0">
                            {String(idx + 1).padStart(2, '0')}
                          </span>
                          <span className="font-semibold text-sm text-slate-900 truncate">
                            {model.name}
                          </span>
                          <span className="text-xs text-slate-500 hidden sm:inline truncate">
                            · {model.category}
                          </span>
                        </div>
                        <div className="font-mono text-xs font-bold text-slate-900 tabular-nums shrink-0 whitespace-nowrap">
                          {model.totalUnits.toLocaleString('en-IN')} Units
                        </div>
                      </div>

                      {/* Proportional Horizontal Bar */}
                      <div className="h-3 w-full bg-slate-100 rounded overflow-hidden">
                        <div
                          className={`h-full rounded transition-all duration-300 ${
                            isTop ? 'bg-[#0F2E52]' : 'bg-blue-600'
                          }`}
                          style={{ width: `${pctOfTop}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1.5 tabular-nums">
                        <span>
                          {model.orderIds.size}{' '}
                          {model.orderIds.size === 1 ? 'order' : 'orders'} ·{' '}
                          {model.dealerKeys.size}{' '}
                          {model.dealerKeys.size === 1 ? 'dealer' : 'dealers'}
                        </span>
                        <span className="font-mono">
                          {model.totalWeightKg.toFixed(1)} kg
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Right Column: Selected / Hovered Model Breakdown */}
              <div className="lg:col-span-4 lg:border-l lg:border-slate-100 lg:pl-6 space-y-4">
                {inspectedModel && (
                  <div className="space-y-4">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-blue-700">
                        Model Demand Detail
                      </div>
                      <h3 className="font-display font-bold text-base text-slate-900 mt-0.5">
                        {inspectedModel.name}
                      </h3>
                      <div className="text-xs text-slate-500 mt-0.5">
                        {inspectedModel.category} · {inspectedModel.totalUnits} ordered units
                      </div>
                    </div>

                    <div className="border-t border-slate-100 pt-3 space-y-2">
                      <div className="text-xs font-semibold text-slate-700">
                        Grade Breakdown
                      </div>
                      <div className="space-y-1.5 text-xs">
                        {(['Uty', 'S.Uty', 'ROK'] as const).map((g) => {
                          const gQty = inspectedModel.grades[g] || 0;
                          const gPct =
                            inspectedModel.totalUnits > 0
                              ? Math.round((gQty / inspectedModel.totalUnits) * 100)
                              : 0;
                          return (
                            <div key={g} className="flex items-center justify-between tabular-nums">
                              <span className="text-slate-600">{g}</span>
                              <span className="font-mono font-semibold text-slate-900">
                                {gQty} units ({gPct}%)
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="border-t border-slate-100 pt-3 space-y-2">
                      <div className="text-xs font-semibold text-slate-700">
                        Packing Breakdown
                      </div>
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-lg">
                          <div className="text-[11px] text-slate-500">Box Packing</div>
                          <div className="text-sm font-bold text-slate-900 tabular-nums mt-0.5">
                            {inspectedModel.packings.Box || 0}
                          </div>
                        </div>
                        <div className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-lg">
                          <div className="text-[11px] text-slate-500">Paper Packing</div>
                          <div className="text-sm font-bold text-slate-900 tabular-nums mt-0.5">
                            {inspectedModel.packings.Paper || 0}
                          </div>
                        </div>
                      </div>
                    </div>

                    {Object.keys(inspectedModel.variants).length > 0 && (
                      <div className="border-t border-slate-100 pt-3 space-y-2">
                        <div className="text-xs font-semibold text-slate-700">
                          Top Colors / Design Codes
                        </div>
                        <div className="divide-y divide-slate-100 text-xs">
                          {Object.entries(inspectedModel.variants)
                            .sort(([, a], [, b]) => b - a)
                            .slice(0, 5)
                            .map(([variant, vQty]) => (
                              <div
                                key={variant}
                                className="py-1.5 flex items-center justify-between tabular-nums"
                              >
                                <span className="text-slate-700 font-medium">{variant}</span>
                                <span className="font-mono font-semibold text-slate-900">
                                  {vQty} pcs
                                </span>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* CATEGORY LEADERBOARD TABLE */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-display font-bold text-sm text-slate-900">
                  Category Volume &amp; Top Model Summary
                </h3>
                <p className="text-xs text-slate-500">
                  Click any category row to filter its model ranking chart above
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px] font-bold tracking-wider">
                    <th className="py-2.5 px-4">Category</th>
                    <th className="py-2.5 px-4">Most Popular Model</th>
                    <th className="py-2.5 px-4 text-right">Models Ordered</th>
                    <th className="py-2.5 px-4 text-right">Orders</th>
                    <th className="py-2.5 px-4 text-right">Weight (kg)</th>
                    <th className="py-2.5 px-4 text-right">Ordered Volume</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {analytics.categories.map((cat) => {
                    const sharePct =
                      analytics.totalUnits > 0
                        ? ((cat.totalUnits / analytics.totalUnits) * 100).toFixed(1)
                        : '0.0';
                    const isSelected = effectiveCategory === cat.category;

                    return (
                      <tr
                        key={cat.category}
                        onClick={() =>
                          setSelectedCategory((prev) =>
                            prev === cat.category ? 'all' : cat.category
                          )
                        }
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-blue-50/70' : 'hover:bg-slate-50'
                        }`}
                      >
                        <td className="py-3 px-4 font-semibold text-slate-900">
                          {cat.category}
                        </td>
                        <td className="py-3 px-4 text-slate-700">
                          {cat.topModel ? (
                            <span>
                              <strong className="font-semibold text-slate-900">
                                {cat.topModel.name}
                              </strong>
                              <span className="text-slate-500 font-mono tabular-nums ml-1.5">
                                ({cat.topModel.totalUnits} pcs)
                              </span>
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                          {cat.models.length}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                          {cat.orderIds.size}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-700">
                          {cat.totalWeightKg.toFixed(1)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-[#0F2E52]">
                          {cat.totalUnits.toLocaleString('en-IN')} Units{' '}
                          <span className="text-slate-500 font-normal">({sharePct}%)</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
