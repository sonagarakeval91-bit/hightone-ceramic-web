import React, { useState, useMemo } from 'react';
import {
  Package,
  FileSpreadsheet,
  MessageSquare,
  Layers,
  Download,
  RefreshCw,
  ArrowUpRight,
  FileText,
  Scale,
  Palette,
  TrendingUp,
  MapPin,
  SlidersHorizontal,
  Factory,
  Lock,
  ShieldCheck,
  BarChart3
} from 'lucide-react';
import { AdminRole, ProductItem, SavedDealerOrder, SavedInquiry, CategoryMeta, AnalyticsSummary, DailyProductionEntry } from '../../types';
import { CompanyInfoMap } from '../../services/googleSheetsService';
import { printDealerOrderPDF } from '../../utils/orderPdf';
import { useToast } from '../../context/ToastContext';
import {
  buildMergedOrderRequirements,
  canAccessSection,
  getEffectiveVerificationStatus,
  isOrderCompleted,
  ROLE_DEFINITIONS
} from '../../utils/adminRoles';
import { AdminSectionId } from './adminTypes';

interface AdminDashboardOverviewProps {
  activeRole: AdminRole;
  dealerOrders: SavedDealerOrder[];
  dailyProductionLogs: DailyProductionEntry[];
  inquiries: SavedInquiry[];
  products: ProductItem[];
  collections: CategoryMeta[];
  insightsSummary: AnalyticsSummary;
  sheetId: string | null;
  sheetWebhookUrl: string;
  isSyncing: boolean;
  companyInfo: CompanyInfoMap;
  onNavigateSection: (section: AdminSectionId) => void;
  onDownloadOrdersCSV: () => void;
  onSyncSheet: () => void;
}

export const AdminDashboardOverview: React.FC<AdminDashboardOverviewProps> = ({
  activeRole,
  dealerOrders,
  dailyProductionLogs,
  inquiries,
  products,
  collections,
  insightsSummary,
  sheetId,
  sheetWebhookUrl,
  isSyncing,
  companyInfo,
  onNavigateSection,
  onDownloadOrdersCSV,
  onSyncSheet
}) => {
  const roleMeta = ROLE_DEFINITIONS[activeRole];
  const canOrders = canAccessSection(activeRole, 'dealer-orders');
  const canInquiries = canAccessSection(activeRole, 'inquiries');
  const canInsights = canAccessSection(activeRole, 'insights');
  const canCatalog = canAccessSection(activeRole, 'product-config');
  const [chartView, setChartView] = useState<'classification' | 'demand' | 'funnel'>('classification');
  const { toastInfo } = useToast();

  const totalOrderUnits = useMemo(
    () => dealerOrders.reduce((sum, o) => sum + (o.totalQuantity || 0), 0),
    [dealerOrders]
  );

  const totalOrderWeight = useMemo(
    () => dealerOrders.reduce((sum, o) => sum + (o.totalWeightKg || 0), 0),
    [dealerOrders]
  );

  const pendingOrdersCount = useMemo(
    () => dealerOrders.filter((o) => getEffectiveVerificationStatus(o) === 'pending' && !isOrderCompleted(o)).length,
    [dealerOrders]
  );

  const productionBacklogUnits = useMemo(() => {
    const reqs = buildMergedOrderRequirements(dealerOrders);
    const producedMap: Record<string, number> = {};
    dailyProductionLogs.forEach((l) => {
      producedMap[l.itemKey] = (producedMap[l.itemKey] || 0) + l.quantityMade;
    });
    return reqs.reduce((sum, r) => sum + Math.max(0, r.totalOrderedQty - (producedMap[r.itemKey] || 0)), 0);
  }, [dealerOrders, dailyProductionLogs]);

  const totalBuyerSignals =
    insightsSummary.totalWhatsAppClicks +
    insightsSummary.totalCallClicks +
    insightsSummary.totalQuoteSubmits;

  // Grade & Packing aggregates from real dealer orders
  const classificationStats = useMemo(() => {
    const grades: Record<string, number> = { Uty: 0, 'S.Uty': 0, ROK: 0 };
    const packings: Record<string, number> = { Box: 0, Paper: 0 };
    dealerOrders.forEach((order) => {
      (order.items || []).forEach((item) => {
        const g = item.grade || 'Uty';
        const p = item.packing || 'Box';
        grades[g] = (grades[g] || 0) + (item.totalQuantity || 0);
        packings[p] = (packings[p] || 0) + (item.totalQuantity || 0);
      });
    });
    return { grades, packings };
  }, [dealerOrders]);

  // Real data series for the overview SVG line/area chart
  const chartSeries = useMemo(() => {
    if (chartView === 'demand') {
      if (insightsSummary.topCollections.length > 0) {
        return insightsSummary.topCollections.slice(0, 7).map((c) => ({
          label: c.name.split(' ').slice(0, 2).join(' '),
          primary: c.count,
          secondary: Math.max(1, Math.round(c.count * 0.4))
        }));
      }
      // Grounded fallback: actual SKU model count per top collection in catalog
      return collections.slice(0, 7).map((cat) => {
        const modelCount = products.filter(
          (p) => p.category.toLowerCase().replace(/[\s_-]+/g, '') === cat.id.toLowerCase().replace(/[\s_-]+/g, '')
        ).length;
        return {
          label: cat.shortLabel || cat.title.split(' ').slice(0, 2).join(' '),
          primary: modelCount,
          secondary: cat.showOnHome ? modelCount : 0
        };
      });
    }

    if (chartView === 'funnel') {
      return [
        { label: 'Page Views', primary: insightsSummary.totalPageViews, secondary: insightsSummary.totalUniqueSessions },
        { label: 'Sessions', primary: insightsSummary.totalUniqueSessions, secondary: totalBuyerSignals },
        { label: 'WhatsApp', primary: insightsSummary.totalWhatsAppClicks, secondary: insightsSummary.totalCallClicks },
        { label: 'Quotes', primary: insightsSummary.totalQuoteSubmits, secondary: inquiries.length },
        { label: 'Orders', primary: dealerOrders.length, secondary: totalOrderUnits }
      ];
    }

    // Default: classification & recent order trend
    if (dealerOrders.length >= 2) {
      return dealerOrders
        .slice(0, 7)
        .reverse()
        .map((ord, i) => ({
          label: ord.personName ? ord.personName.split(' ')[0] : `#${i + 1}`,
          primary: ord.totalQuantity || 0,
          secondary: Math.round(ord.totalWeightKg || 0)
        }));
    }

    return [
      { label: 'Uty', primary: classificationStats.grades['Uty'] || 0, secondary: classificationStats.packings['Box'] || 0 },
      { label: 'S.Uty', primary: classificationStats.grades['S.Uty'] || 0, secondary: classificationStats.packings['Paper'] || 0 },
      { label: 'ROK', primary: classificationStats.grades['ROK'] || 0, secondary: 0 },
      { label: 'Box', primary: classificationStats.packings['Box'] || 0, secondary: 0 },
      { label: 'Paper', primary: classificationStats.packings['Paper'] || 0, secondary: 0 }
    ];
  }, [
    chartView,
    insightsSummary,
    collections,
    products,
    dealerOrders,
    inquiries.length,
    totalBuyerSignals,
    totalOrderUnits,
    classificationStats
  ]);

  const svgGeometry = useMemo(() => {
    const width = 640;
    const height = 180;
    const padX = 28;
    const padY = 20;
    const innerW = width - padX * 2;
    const innerH = height - padY * 2;
    const maxVal = Math.max(1, ...chartSeries.map((d) => d.primary));

    const pts = chartSeries.map((d, idx) => {
      const x =
        chartSeries.length === 1
          ? width / 2
          : padX + (idx / (chartSeries.length - 1)) * innerW;
      const y = padY + innerH - (d.primary / maxVal) * innerH;
      return { x, y, ...d };
    });

    const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    const areaPath =
      pts.length > 0
        ? `${linePath} L ${pts[pts.length - 1].x.toFixed(1)} ${(height - padY).toFixed(1)} L ${pts[0].x.toFixed(1)} ${(height - padY).toFixed(1)} Z`
        : '';

    return { width, height, padY, pts, linePath, areaPath, maxVal };
  }, [chartSeries]);

  return (
    <div className="space-y-6">
      {/* Operating Dashboard Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-700 mb-1">
            Command Center
          </p>
          <h1 className="font-display font-bold text-2xl sm:text-3xl text-slate-900 tracking-tight">
            Operating dashboard
          </h1>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl">
            Monitor dealer wholesale orders, buyer inquiries, catalog configurations, and regional demand from one workspace.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {canOrders && (
            <button
              type="button"
              onClick={onDownloadOrdersCSV}
              disabled={dealerOrders.length === 0}
              className="px-4 py-2 bg-white hover:bg-slate-50 disabled:opacity-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors flex items-center space-x-2 cursor-pointer whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Export Orders</span>
            </button>
          )}

          {sheetId && canAccessSection(activeRole, 'cms') ? (
            <button
              type="button"
              onClick={onSyncSheet}
              disabled={isSyncing}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-semibold rounded-lg transition-colors flex items-center space-x-2 cursor-pointer whitespace-nowrap shadow-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing Sheet...' : 'Sync Sheet Now'}</span>
            </button>
          ) : canOrders ? (
            <button
              type="button"
              onClick={() => onNavigateSection('dealer-orders')}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center space-x-1.5 cursor-pointer whitespace-nowrap shadow-xs"
            >
              <span>Manage Orders</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      {/* Active Role Access Summary */}
      <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
        <div className="flex items-center space-x-2 text-slate-700">
          <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
          <span>
            Signed in with <strong className="text-slate-900">{roleMeta.label}</strong> role: {roleMeta.summary}
          </span>
        </div>
        {canAccessSection(activeRole, 'security') && (
          <button
            type="button"
            onClick={() => onNavigateSection('security')}
            className="text-xs font-semibold text-blue-600 hover:underline whitespace-nowrap self-start sm:self-auto cursor-pointer"
          >
            Manage Roles &amp; Staff →
          </button>
        )}
      </div>

      {/* 4 KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <button
          type="button"
          disabled={!canOrders}
          onClick={() => canOrders && onNavigateSection('dealer-orders')}
          className={`text-left bg-white border border-slate-200 rounded-xl p-5 transition-colors group ${
            canOrders ? 'hover:border-blue-300 cursor-pointer' : 'opacity-70 cursor-not-allowed'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Package className="w-5 h-5" />
            </div>
            {canOrders ? (
              <ArrowUpRight className="w-4 h-4 text-slate-300 group-hover:text-blue-600 transition-colors" />
            ) : (
              <Lock className="w-4 h-4 text-slate-300" />
            )}
          </div>
          <div className="mt-4">
            <div className="text-xs font-medium text-slate-500">Dealer Orders</div>
            <div className="text-2xl font-display font-bold text-slate-900 tabular-nums mt-0.5">
              {dealerOrders.length}
            </div>
            <div className="text-xs text-slate-500 mt-1 tabular-nums">
              {pendingOrdersCount > 0 ? `${pendingOrdersCount} pending verify · ` : ''}
              {totalOrderUnits} units · {totalOrderWeight.toFixed(1)} kg
            </div>
          </div>
        </button>

        <button
          type="button"
          disabled={!canInquiries}
          onClick={() => canInquiries && onNavigateSection('inquiries')}
          className={`text-left bg-white border border-slate-200 rounded-xl p-5 transition-colors group ${
            canInquiries ? 'hover:border-emerald-300 cursor-pointer' : 'opacity-70 cursor-not-allowed'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            {canInquiries ? (
              <ArrowUpRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-600 transition-colors" />
            ) : (
              <Lock className="w-4 h-4 text-slate-300" />
            )}
          </div>
          <div className="mt-4">
            <div className="text-xs font-medium text-slate-500">B2B Inquiries</div>
            <div className="text-2xl font-display font-bold text-slate-900 tabular-nums mt-0.5">
              {canInquiries ? inquiries.length : 'Restricted'}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {canInquiries
                ? sheetWebhookUrl
                  ? 'Sheet webhook active'
                  : 'Saved in plant records'
                : 'Available to Admin & Sales'}
            </div>
          </div>
        </button>

        <button
          type="button"
          disabled={!canInsights}
          onClick={() => canInsights && onNavigateSection('insights')}
          className={`text-left bg-white border border-slate-200 rounded-xl p-5 transition-colors group ${
            canInsights ? 'hover:border-amber-300 cursor-pointer' : 'opacity-70 cursor-not-allowed'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <MessageSquare className="w-5 h-5" />
            </div>
            {canInsights ? (
              <ArrowUpRight className="w-4 h-4 text-slate-300 group-hover:text-amber-600 transition-colors" />
            ) : (
              <Lock className="w-4 h-4 text-slate-300" />
            )}
          </div>
          <div className="mt-4">
            <div className="text-xs font-medium text-slate-500">Buyer Interactions</div>
            <div className="text-2xl font-display font-bold text-slate-900 tabular-nums mt-0.5">
              {canInsights ? totalBuyerSignals : 'Restricted'}
            </div>
            <div className="text-xs text-slate-500 mt-1 tabular-nums">
              {canInsights
                ? `${insightsSummary.totalWhatsAppClicks} WhatsApp · ${insightsSummary.totalCallClicks} calls`
                : 'Available to Admin & Sales'}
            </div>
          </div>
        </button>

        <button
          type="button"
          disabled={!canCatalog}
          onClick={() => canCatalog && onNavigateSection('product-config')}
          className={`text-left bg-white border border-slate-200 rounded-xl p-5 transition-colors group ${
            canCatalog ? 'hover:border-indigo-300 cursor-pointer' : 'opacity-70 cursor-not-allowed'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            {canCatalog ? (
              <ArrowUpRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-600 transition-colors" />
            ) : (
              <Lock className="w-4 h-4 text-slate-300" />
            )}
          </div>
          <div className="mt-4">
            <div className="text-xs font-medium text-slate-500">Catalog Models</div>
            <div className="text-2xl font-display font-bold text-slate-900 tabular-nums mt-0.5">
              {products.length}
            </div>
            <div className="text-xs text-slate-500 mt-1 tabular-nums">
              {collections.length} collections · {canCatalog ? 'Configurable' : 'Admin Only Setup'}
            </div>
          </div>
        </button>
      </div>

      {/* Main Analytics Overview Panel */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-700">
              Operations Pulse
            </p>
            <h2 className="font-display font-bold text-lg text-slate-900 mt-0.5">
              {chartView === 'classification'
                ? 'Order Volume & Classification Overview'
                : chartView === 'demand'
                ? 'Collection Catalog & Buyer Demand'
                : 'Visitor Conversion Funnel'}
            </h2>
          </div>

          <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setChartView('classification')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                chartView === 'classification'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Order Split
            </button>
            <button
              type="button"
              onClick={() => setChartView('demand')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                chartView === 'demand'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Collections
            </button>
            <button
              type="button"
              onClick={() => setChartView('funnel')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                chartView === 'funnel'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Funnel
            </button>
          </div>
        </div>

        {/* 3 Sub-Metrics Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-y border-slate-100 py-4">
          <div>
            <div className="text-xs text-slate-500">Total Ordered Units</div>
            <div className="text-xl font-display font-bold text-slate-900 tabular-nums mt-0.5">
              {totalOrderUnits} Units
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Total Consignment Weight</div>
            <div className="text-xl font-display font-bold text-slate-900 tabular-nums mt-0.5">
              {totalOrderWeight.toFixed(1)} kg
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Estimated Unique Visitors</div>
            <div className="text-xl font-display font-bold text-slate-900 tabular-nums mt-0.5">
              {insightsSummary.totalUniqueSessions}
            </div>
          </div>
        </div>

        {/* Chart Area + Grade/Packing Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-8">
            <div className="w-full overflow-x-auto">
              <svg
                viewBox={`0 0 ${svgGeometry.width} ${svgGeometry.height + 28}`}
                className="w-full h-52 min-w-[420px]"
                role="img"
                aria-label="Operations activity chart"
              >
                <defs>
                  <linearGradient id="htcAdminAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563EB" stopOpacity="0.22" />
                    <stop offset="100%" stopColor="#2563EB" stopOpacity="0.01" />
                  </linearGradient>
                </defs>

                {/* Subtle horizontal grid lines */}
                {[0.25, 0.5, 0.75, 1].map((frac, idx) => {
                  const y = svgGeometry.padY + (1 - frac) * (svgGeometry.height - svgGeometry.padY * 2);
                  return (
                    <line
                      key={idx}
                      x1={20}
                      y1={y}
                      x2={svgGeometry.width - 20}
                      y2={y}
                      stroke="#E2E8F0"
                      strokeDasharray="3 3"
                      strokeWidth="1"
                    />
                  );
                })}

                {svgGeometry.areaPath && (
                  <path d={svgGeometry.areaPath} fill="url(#htcAdminAreaGrad)" />
                )}
                {svgGeometry.linePath && (
                  <path
                    d={svgGeometry.linePath}
                    fill="none"
                    stroke="#2563EB"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                )}

                {svgGeometry.pts.map((pt, i) => (
                  <g key={i}>
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r="4.5"
                      fill="#FFFFFF"
                      stroke="#2563EB"
                      strokeWidth="2.5"
                    />
                    <text
                      x={pt.x}
                      y={pt.y - 10}
                      textAnchor="middle"
                      fill="#0F172A"
                      fontSize="10"
                      fontWeight="700"
                    >
                      {pt.primary}
                    </text>
                    <text
                      x={pt.x}
                      y={svgGeometry.height + 16}
                      textAnchor="middle"
                      fill="#64748B"
                      fontSize="10"
                      fontWeight="500"
                    >
                      {pt.label}
                    </text>
                  </g>
                ))}
              </svg>
            </div>
          </div>

          {/* Right Breakdown Column: Grade & Packing Summary */}
          <div className="lg:col-span-4 space-y-4 lg:border-l lg:border-slate-100 lg:pl-6">
            <div>
              <div className="text-xs font-semibold text-slate-700 mb-2">
                Grade Distribution (Units)
              </div>
              <div className="space-y-2">
                {(['Uty', 'S.Uty', 'ROK'] as const).map((g) => {
                  const qty = classificationStats.grades[g] || 0;
                  const pct = totalOrderUnits > 0 ? Math.round((qty / totalOrderUnits) * 100) : 0;
                  return (
                    <div key={g} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-700">{g}</span>
                        <span className="font-mono tabular-nums text-slate-600">
                          {qty} units ({pct}%)
                        </span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-600 rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <div className="text-xs font-semibold text-slate-700 mb-2">
                Packing Split (Units)
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-lg">
                  <div className="text-[11px] text-slate-500">Box Packing</div>
                  <div className="text-base font-bold text-slate-900 tabular-nums mt-0.5">
                    {classificationStats.packings['Box'] || 0}
                  </div>
                </div>
                <div className="p-2.5 bg-slate-50 border border-slate-200/80 rounded-lg">
                  <div className="text-[11px] text-slate-500">Paper Packing</div>
                  <div className="text-base font-bold text-slate-900 tabular-nums mt-0.5">
                    {classificationStats.packings['Paper'] || 0}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom 2-Column Operational Feeds */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Recent Dealer Orders */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="font-display font-bold text-sm text-slate-900">Recent Dealer Orders</h3>
              <p className="text-xs text-slate-500">Latest wholesale order submissions</p>
            </div>
            {canOrders && (
              <button
                type="button"
                onClick={() => onNavigateSection('dealer-orders')}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer flex items-center space-x-1"
              >
                <span>View all</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="divide-y divide-slate-100 flex-1">
            {dealerOrders.length === 0 ? (
              <div className="py-10 px-5 text-center space-y-2">
                <Package className="w-8 h-8 text-slate-300 mx-auto" />
                <div className="text-sm font-semibold text-slate-700">No dealer orders yet</div>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  Orders created in the B2B Dealer Order Builder will appear here with instant PDF order sheets.
                </p>
              </div>
            ) : (
              dealerOrders.slice(0, 5).map((ord) => (
                <div key={ord.id} className="px-5 py-3 flex items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors">
                  <div className="min-w-0">
                    <div className="font-semibold text-xs text-slate-900 truncate">
                      {ord.personName || ord.dealerInfo?.contactPerson || ord.dealerInfo?.firmName || 'Dealer'}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate mt-0.5 tabular-nums">
                      <span>{ord.orderId || ord.id}</span>
                      <span className="mx-1.5" aria-hidden="true">·</span>
                      <span>{ord.dealerInfo?.cityState || 'India'}</span>
                      <span className="mx-1.5" aria-hidden="true">·</span>
                      <span>{ord.timestamp}</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3 shrink-0">
                    <div className="text-right tabular-nums">
                      <div className="text-xs font-bold text-slate-900">{ord.totalQuantity} Units</div>
                      <div className="text-[11px] text-slate-500">
                        {ord.totalWeightKg ? `${ord.totalWeightKg.toFixed(1)} kg` : '—'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        printDealerOrderPDF(ord, companyInfo);
                        toastInfo(`Opening print/PDF sheet for ${ord.orderId || ord.id}.`, 'Order Sheet');
                      }}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                      title="Print / Download PDF Order Sheet"
                    >
                      <FileText className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Quick Workspace Modules & Recent Inquiries */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="font-display font-bold text-sm text-slate-900">Quick Module Shortcuts</h3>
              <p className="text-xs text-slate-500">Modules authorized for {roleMeta.label}</p>
            </div>
            {canInquiries && (
              <button
                type="button"
                onClick={() => onNavigateSection('inquiries')}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer flex items-center space-x-1"
              >
                <span>Inquiries ({inquiries.length})</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {[
              {
                section: 'dealer-order-dashboard' as AdminSectionId,
                title: 'Dealer Order Dashboard',
                subtitle: `${totalOrderUnits} units · Category & model bar charts`,
                icon: BarChart3,
                iconClass: 'text-indigo-600'
              },
              {
                section: 'dealer-orders' as AdminSectionId,
                title: 'Dealer Orders',
                subtitle: `${dealerOrders.length} orders · ${pendingOrdersCount} pending verify`,
                icon: Package,
                iconClass: 'text-blue-600'
              },
              {
                section: 'production' as AdminSectionId,
                title: 'Production Tracker',
                subtitle: `${productionBacklogUnits} units remaining · Daily log`,
                icon: Factory,
                iconClass: 'text-blue-600'
              },
              {
                section: 'inquiries' as AdminSectionId,
                title: 'Inquiries & Leads',
                subtitle: `${inquiries.length} dealer inquiries`,
                icon: FileSpreadsheet,
                iconClass: 'text-emerald-600'
              },
              {
                section: 'product-config' as AdminSectionId,
                title: 'Product Modes & Weights',
                subtitle: 'White, Glaze & Design Code setup',
                icon: Scale,
                iconClass: 'text-blue-600'
              },
              {
                section: 'colors-codes' as AdminSectionId,
                title: 'Colors & Design Codes',
                subtitle: 'Manage glazes & designer numbers',
                icon: Palette,
                iconClass: 'text-purple-600'
              },
              {
                section: 'collection-order' as AdminSectionId,
                title: 'Collection Ordering',
                subtitle: 'Reorder Home 8-card showcase',
                icon: SlidersHorizontal,
                iconClass: 'text-amber-600'
              },
              {
                section: 'insights' as AdminSectionId,
                title: 'Visitor Insights',
                subtitle: 'Regional reach & dwell times',
                icon: TrendingUp,
                iconClass: 'text-emerald-600'
              },
              {
                section: 'cms' as AdminSectionId,
                title: 'Google Sheets Sync',
                subtitle: sheetId ? 'Connected & active' : 'Connect catalog sheet',
                icon: RefreshCw,
                iconClass: 'text-sky-600'
              },
              {
                section: 'location' as AdminSectionId,
                title: 'Factory Pin & Map',
                subtitle: 'Thangadh GPS & contacts',
                icon: MapPin,
                iconClass: 'text-rose-600'
              },
              {
                section: 'security' as AdminSectionId,
                title: 'Staff Roles & Security',
                subtitle: 'Manage Admin, Production & Sales',
                icon: ShieldCheck,
                iconClass: 'text-slate-700'
              }
            ]
              .filter((shortcut) => canAccessSection(activeRole, shortcut.section))
              .map((shortcut) => {
                const ShortcutIcon = shortcut.icon;
                return (
                  <button
                    key={shortcut.section}
                    type="button"
                    onClick={() => onNavigateSection(shortcut.section)}
                    className="p-3 border border-slate-200 hover:border-blue-300 hover:bg-slate-50/70 rounded-lg text-left transition-colors cursor-pointer flex items-start space-x-3"
                  >
                    <ShortcutIcon className={`w-4 h-4 ${shortcut.iconClass} mt-0.5 shrink-0`} />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-900">{shortcut.title}</div>
                      <div className="text-[11px] text-slate-500 truncate tabular-nums">
                        {shortcut.subtitle}
                      </div>
                    </div>
                  </button>
                );
              })}
          </div>
        </div>
      </div>
    </div>
  );
};
