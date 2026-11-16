import React from 'react';
import {
  Activity,
  RefreshCw,
  Download,
  Copy,
  Trash2,
  Users,
  MessageSquare,
  Phone,
  FileSpreadsheet,
  BarChart3,
  Crosshair,
  Info,
  Building2,
  SlidersHorizontal,
  ZoomIn,
  Sparkles,
  Timer,
  MapPin,
  Smartphone,
  Laptop,
  Globe,
  ExternalLink,
  Search,
  Check,
  RotateCcw,
  Share2,
  CheckCircle2
} from 'lucide-react';
import { CategoryMeta, CollectionSeoMeta, AnalyticsSummary, AnalyticsEvent } from '../../types';
import {
  downloadAnalyticsCSV,
  downloadLocationMarketCSV,
  formatDwellTime,
  formatLocationString
} from '../../services/analyticsService';
import { normalizeImageUrl } from '../../services/googleSheetsService';
import { useToast } from '../../context/ToastContext';

interface AdminInsightsPanelProps {
  insightsSummary: AnalyticsSummary;
  rawEvents?: AnalyticsEvent[];
  isCloudAnalytics?: boolean;
  selectedLocationFilter: string;
  onSelectLocationFilter: (val: string) => void;
  isDetectingGps: boolean;
  gpsStatusMessage: { text: string; type: 'success' | 'error' | 'info' } | null;
  copiedInsightsSuccess: boolean;
  ga4IdInput: string;
  ga4SaveStatus: string | null;
  onRefreshInsights: () => void;
  onCopyInsights: () => void;
  onClearInsights: () => void;
  onDetectGPS: () => void;
  onGa4IdChange: (val: string) => void;
  onSaveGA4: (e: React.FormEvent) => void;
}

export const AdminInsightsPanel: React.FC<AdminInsightsPanelProps> = ({
  insightsSummary,
  rawEvents,
  isCloudAnalytics = false,
  selectedLocationFilter,
  onSelectLocationFilter,
  isDetectingGps,
  gpsStatusMessage,
  copiedInsightsSuccess,
  ga4IdInput,
  ga4SaveStatus,
  onRefreshInsights,
  onCopyInsights,
  onClearInsights,
  onDetectGPS,
  onGa4IdChange,
  onSaveGA4
}) => {
  const { toastSuccess } = useToast();
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-700 mb-1">
            Private Analytics
          </p>
          <h1 className="font-display font-bold text-2xl text-slate-900">
            Visitor Insights &amp; Demand Matrix
          </h1>
          <p className="text-xs text-slate-500 mt-0.5 max-w-2xl">
            {isCloudAnalytics
              ? 'Cloud-synced visitor interactions, collection dwell times, top inquired models, and regional demand centers.'
              : 'Track buyer interactions, collection dwell times, top inquired models, and regional demand centers.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onRefreshInsights}
            className="px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors flex items-center space-x-1.5 cursor-pointer whitespace-nowrap"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => {
              downloadAnalyticsCSV(rawEvents);
              toastSuccess('Exported visitor analytics CSV.', 'CSV Downloaded');
            }}
            disabled={insightsSummary.recentEvents.length === 0}
            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors flex items-center space-x-1.5 cursor-pointer whitespace-nowrap shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={onCopyInsights}
            disabled={insightsSummary.recentEvents.length === 0}
            className="px-3 py-2 bg-white hover:bg-slate-50 disabled:opacity-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors flex items-center space-x-1.5 cursor-pointer whitespace-nowrap"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>{copiedInsightsSuccess ? 'Copied!' : 'Copy for Sheets'}</span>
          </button>

          {insightsSummary.recentEvents.length > 0 && (
            <button
              type="button"
              onClick={onClearInsights}
              className="px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg transition-colors flex items-center space-x-1.5 cursor-pointer font-semibold whitespace-nowrap"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* 5 KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-white border border-slate-200 p-4 rounded-xl space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-semibold">Page Views</span>
            <Activity className="w-4 h-4 text-blue-600" />
          </div>
          <div className="font-display font-bold text-2xl text-slate-900 tabular-nums">
            {insightsSummary.totalPageViews}
          </div>
          <span className="text-[11px] text-slate-400 block">Total visits</span>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-xl space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-semibold">Est. Visitors</span>
            <Users className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="font-display font-bold text-2xl text-slate-900 tabular-nums">
            {insightsSummary.totalUniqueSessions}
          </div>
          <span className="text-[11px] text-slate-400 block">Unique sessions</span>
        </div>

        <div className="bg-white border border-emerald-200 p-4 rounded-xl space-y-1">
          <div className="flex items-center justify-between text-emerald-800">
            <span className="text-[11px] font-semibold">WhatsApp Clicks</span>
            <MessageSquare className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="font-display font-bold text-2xl text-emerald-700 tabular-nums">
            {insightsSummary.totalWhatsAppClicks}
          </div>
          <span className="text-[11px] text-emerald-700/80 block">Chat inquiries</span>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-xl space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-semibold">Phone Calls</span>
            <Phone className="w-4 h-4 text-amber-600" />
          </div>
          <div className="font-display font-bold text-2xl text-slate-900 tabular-nums">
            {insightsSummary.totalCallClicks}
          </div>
          <span className="text-[11px] text-slate-400 block">Plant dialings</span>
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-xl space-y-1 col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-semibold">Quotes Sent</span>
            <FileSpreadsheet className="w-4 h-4 text-blue-600" />
          </div>
          <div className="font-display font-bold text-2xl text-slate-900 tabular-nums">
            {insightsSummary.totalQuoteSubmits}
          </div>
          <span className="text-[11px] text-slate-400 block">B2B forms</span>
        </div>
      </div>

      {/* Top Collections & Top Models */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 p-5 rounded-xl space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <span className="font-display font-bold text-xs uppercase tracking-wider text-slate-900 flex items-center space-x-1.5">
              <BarChart3 className="w-4 h-4 text-blue-600" />
              <span>Most Viewed Collections</span>
            </span>
            <span className="text-[11px] text-slate-500">Buyer Interest</span>
          </div>

          {insightsSummary.topCollections.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">
              No collection views recorded yet.
            </p>
          ) : (
            <div className="space-y-2.5">
              {insightsSummary.topCollections.map((col, idx) => {
                const maxVal = insightsSummary.topCollections[0]?.count || 1;
                const pct = Math.round((col.count / maxVal) * 100);
                return (
                  <div key={col.name} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-slate-900 truncate">
                        {idx + 1}. {col.name}
                      </span>
                      <span className="text-slate-500 font-mono text-[11px] tabular-nums shrink-0 ml-2">
                        {col.count} views
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white border border-slate-200 p-5 rounded-xl space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <span className="font-display font-bold text-xs uppercase tracking-wider text-slate-900 flex items-center space-x-1.5">
              <MessageSquare className="w-4 h-4 text-emerald-600" />
              <span>Top Inquired Ceramic Models</span>
            </span>
            <span className="text-[11px] text-slate-500">WhatsApp Clicks</span>
          </div>

          {insightsSummary.topProducts.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">
              No product WhatsApp inquiries recorded yet.
            </p>
          ) : (
            <div className="space-y-2">
              {insightsSummary.topProducts.map((prod, idx) => (
                <div
                  key={prod.name}
                  className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-200/80 rounded-lg text-xs"
                >
                  <div className="flex items-center space-x-2 min-w-0">
                    <span className="w-5 h-5 rounded-md bg-emerald-100 text-emerald-800 text-[11px] font-bold flex items-center justify-center shrink-0 tabular-nums">
                      {idx + 1}
                    </span>
                    <span className="font-semibold text-slate-900 truncate">{prod.name}</span>
                  </div>
                  <span className="text-emerald-700 font-bold font-mono text-xs tabular-nums shrink-0 ml-2">
                    {prod.count} clicks
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* GPS Calibration */}
      <div className="bg-white border border-blue-200 p-4 sm:p-5 rounded-xl space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-start space-x-2.5">
            <Crosshair className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-display font-bold text-sm text-slate-900 block">
                High-Precision Location &amp; GPS Calibration
              </span>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                Resolves municipal City, District, and Postal PIN Code via browser GPS or multi-tier network IP.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onDetectGPS}
            disabled={isDetectingGps}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg cursor-pointer transition-colors disabled:opacity-60 whitespace-nowrap self-start sm:self-auto"
          >
            <Crosshair className={`w-3.5 h-3.5 ${isDetectingGps ? 'animate-spin' : ''}`} />
            <span>{isDetectingGps ? 'Calibrating GPS...' : 'Verify Pinpoint GPS'}</span>
          </button>
        </div>

        {gpsStatusMessage && (
          <div
            className={`p-2.5 rounded-lg text-xs font-medium flex items-center space-x-2 ${
              gpsStatusMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : gpsStatusMessage.type === 'error'
                ? 'bg-rose-50 text-rose-800 border border-rose-200'
                : 'bg-amber-50 text-amber-800 border border-amber-200'
            }`}
          >
            <Info className="w-4 h-4 shrink-0" />
            <span>{gpsStatusMessage.text}</span>
          </div>
        )}
      </div>

      {/* Location-Wise Dwell Time Matrix */}
      <div className="bg-white border border-slate-200 p-4 sm:p-5 rounded-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <div className="flex items-center space-x-2">
              <Building2 className="w-4 h-4 text-slate-700 shrink-0" />
              <span className="font-display font-bold text-xs uppercase tracking-wider text-slate-900">
                Location-Wise Dwell Time &amp; Product Demand Matrix
              </span>
            </div>
            <span className="text-xs text-slate-500">
              Active buyer engagement segmented by city, district, and collection.
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedLocationFilter}
              onChange={(e) => onSelectLocationFilter(e.target.value)}
              aria-label="Filter insights by location center"
              className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-800 focus:outline-none focus:border-blue-500"
            >
              <option value="all">All Locations ({insightsSummary.locationMarketInsights.length})</option>
              {insightsSummary.locationMarketInsights.map((item) => (
                <option key={item.area} value={item.area}>
                  {item.city}{item.district ? ` (${item.district})` : ''}, {item.region}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => {
                downloadLocationMarketCSV(rawEvents);
                toastSuccess('Exported location demand matrix CSV.', 'CSV Downloaded');
              }}
              disabled={insightsSummary.locationMarketInsights.length === 0}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Matrix CSV</span>
            </button>
          </div>
        </div>

        {insightsSummary.locationMarketInsights.length === 0 ? (
          <div className="py-8 text-center space-y-2">
            <Timer className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs text-slate-600 font-medium">
              Recording location-wise dwell times as buyers browse your collections.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {insightsSummary.locationMarketInsights
              .filter((item) => selectedLocationFilter === 'all' || item.area === selectedLocationFilter)
              .map((item, idx) => (
                <div
                  key={item.area}
                  className="border border-slate-200 rounded-xl p-4 bg-slate-50/70 space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 pb-2.5">
                    <div className="flex items-center space-x-2">
                      <span className="w-5 h-5 rounded-md bg-slate-900 text-white text-[11px] font-bold flex items-center justify-center shrink-0 tabular-nums">
                        {idx + 1}
                      </span>
                      <div className="text-xs">
                        <span className="font-bold text-slate-900 text-sm">
                          {item.city}{item.district && item.district !== item.city ? ` (${item.district})` : ''}
                        </span>
                        <span className="text-slate-500 ml-2">
                          {item.region}, {item.country}
                          {item.postal ? ` · PIN ${item.postal}` : ''}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs font-mono tabular-nums">
                      <span className="px-2 py-0.5 bg-white border border-slate-200 rounded-md text-slate-700 font-semibold">
                        {item.precision === 'gps' ? 'GPS Verified' : 'Network IP'}
                      </span>
                      <span className="px-2 py-0.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-md font-bold">
                        Dwell: {formatDwellTime(item.totalDwellSeconds)}
                      </span>
                      <span className="px-2 py-0.5 bg-white border border-slate-200 text-slate-700 rounded-md">
                        {item.totalVisits} Actions
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-700">
                        <span className="flex items-center space-x-1.5">
                          <SlidersHorizontal className="w-3 h-3" />
                          <span>Collections Time</span>
                        </span>
                        <span className="font-mono text-slate-400">{item.collectionTimeSpent.length}</span>
                      </div>
                      {item.collectionTimeSpent.length === 0 ? (
                        <p className="text-xs text-slate-400 py-2">No individual collections explored yet.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {item.collectionTimeSpent.map((col) => (
                            <div key={col.collectionName} className="flex items-center justify-between text-xs p-1.5 bg-slate-50 rounded-md">
                              <span className="font-medium text-slate-800 truncate">{col.collectionName}</span>
                              <span className="font-mono font-semibold text-blue-700 tabular-nums shrink-0 ml-2">
                                {formatDwellTime(col.seconds)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-700">
                        <span className="flex items-center space-x-1.5">
                          <ZoomIn className="w-3 h-3" />
                          <span>Products Inspected</span>
                        </span>
                        <span className="font-mono text-slate-400">{item.productTimeSpent.length}</span>
                      </div>
                      {item.productTimeSpent.length === 0 ? (
                        <p className="text-xs text-slate-400 py-2">General catalog browsing only.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {item.productTimeSpent.map((p) => (
                            <div key={p.productName} className="flex items-center justify-between text-xs p-1.5 bg-slate-50 rounded-md">
                              <span className="font-medium text-slate-800 truncate">{p.productName}</span>
                              <span className="font-mono font-semibold text-emerald-700 tabular-nums shrink-0 ml-2">
                                {formatDwellTime(p.seconds)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-amber-50/70 border border-amber-200/80 p-2.5 rounded-lg flex items-start space-x-2 text-xs">
                    <Sparkles className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-slate-900">Insight for {item.city}: </span>
                      <span className="text-slate-700">{item.commercialTakeaway}</span>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Event Stream */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <span className="font-bold text-xs text-slate-900 uppercase tracking-wider">
            Recent Visitor Actions ({insightsSummary.recentEvents.length})
          </span>
          <span className="text-[11px] text-slate-500 font-mono">IST Timezone</span>
        </div>

        {insightsSummary.recentEvents.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No visitor activity logged yet in this session.
          </div>
        ) : (
          <div className="overflow-x-auto max-h-72">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[11px] uppercase font-semibold text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Time</th>
                  <th className="py-2.5 px-3">Action</th>
                  <th className="py-2.5 px-3">Target</th>
                  <th className="py-2.5 px-3">Dwell</th>
                  <th className="py-2.5 px-3">Location</th>
                  <th className="py-2.5 px-3">Device</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {insightsSummary.recentEvents.map((ev) => (
                  <tr key={ev.id} className="hover:bg-slate-50/70">
                    <td className="py-2 px-3 font-mono text-[11px] text-slate-500 whitespace-nowrap tabular-nums">
                      {ev.timestamp}
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap font-semibold text-slate-800 capitalize">
                      {ev.type.replace('_', ' ')}
                    </td>
                    <td className="py-2 px-3 text-slate-900 max-w-xs truncate">
                      {ev.target || 'General'}
                    </td>
                    <td className="py-2 px-3 font-mono tabular-nums text-amber-800 whitespace-nowrap">
                      {ev.durationSeconds ? formatDwellTime(ev.durationSeconds) : '—'}
                    </td>
                    <td className="py-2 px-3 text-slate-700 whitespace-nowrap">
                      <span className="inline-flex items-center space-x-1">
                        <MapPin className="w-3 h-3 text-rose-500 shrink-0" />
                        <span>{formatLocationString(ev.location)}</span>
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-500 capitalize whitespace-nowrap">
                      <span className="inline-flex items-center space-x-1">
                        {ev.device === 'mobile' ? <Smartphone className="w-3 h-3" /> : <Laptop className="w-3 h-3" />}
                        <span>{ev.device || 'Desktop'}</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* GA4 & Search Console */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 p-4 rounded-xl space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <strong className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
              <Globe className="w-4 h-4 text-blue-600" />
              <span>Google Analytics 4</span>
            </strong>
            <a
              href="https://analytics.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:underline flex items-center space-x-1"
            >
              <span>Open GA4</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <form onSubmit={onSaveGA4} className="space-y-2">
            <label className="block text-[11px] font-semibold text-slate-600">
              GA4 Measurement ID
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="G-XXXXXXXXXX"
                value={ga4IdInput}
                onChange={(e) => onGa4IdChange(e.target.value)}
                className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 font-mono focus:outline-none focus:bg-white focus:border-blue-500"
              />
              <button
                type="submit"
                className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                Save ID
              </button>
            </div>
          </form>
          {ga4SaveStatus && (
            <p className="text-xs text-emerald-700 bg-emerald-50 p-2 rounded-lg font-medium">
              {ga4SaveStatus}
            </p>
          )}
        </div>

        <div className="bg-white border border-slate-200 p-4 rounded-xl space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <strong className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
              <Search className="w-4 h-4 text-amber-600" />
              <span>Google Search Console</span>
            </strong>
            <a
              href="https://search.google.com/search-console"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-amber-700 hover:underline flex items-center space-x-1"
            >
              <span>Search Console</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Monitor search queries, Google Search impressions, and indexing for <code>https://hightoneceramic.com</code>.
          </p>
        </div>
      </div>
    </div>
  );
};

interface AdminSeoPanelProps {
  categoriesList: CategoryMeta[];
  collectionSeoMap: Record<string, CollectionSeoMeta>;
  selectedSeoCatId: string;
  onSelectSeoCatId: (id: string) => void;
  selectedCategoryMeta?: CategoryMeta;
  seoTitleInput: string;
  seoDescInput: string;
  seoKeywordsInput: string;
  seoSaveStatus: string | null;
  copiedShareLink: boolean;
  siteMediaLogoSymbol?: string;
  onSeoTitleChange: (val: string) => void;
  onSeoDescChange: (val: string) => void;
  onSeoKeywordsChange: (val: string) => void;
  onSaveSeo: (e: React.FormEvent) => void;
  onApplyRecommendedSeo: () => void;
  onResetSeo: () => void;
  onCopyShareLink: (url: string) => void;
}

export const AdminSeoPanel: React.FC<AdminSeoPanelProps> = ({
  categoriesList,
  collectionSeoMap,
  selectedSeoCatId,
  onSelectSeoCatId,
  selectedCategoryMeta,
  seoTitleInput,
  seoDescInput,
  seoKeywordsInput,
  seoSaveStatus,
  copiedShareLink,
  siteMediaLogoSymbol,
  onSeoTitleChange,
  onSeoDescChange,
  onSeoKeywordsChange,
  onSaveSeo,
  onApplyRecommendedSeo,
  onResetSeo,
  onCopyShareLink
}) => {
  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-blue-700 mb-1">
          Search &amp; Social
        </p>
        <h1 className="font-display font-bold text-2xl text-slate-900">
          Collection SEO &amp; Social Previews
        </h1>
        <p className="text-xs text-slate-500 mt-0.5 max-w-2xl">
          Customize page titles, meta descriptions, keywords, and WhatsApp share cards for each sanitaryware collection.
        </p>
      </div>

      {/* Collection Selector */}
      <div className="bg-white border border-slate-200 p-4 rounded-xl space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <label className="font-semibold text-slate-900">
            Select Collection ({categoriesList.length})
          </label>
          <span className="text-slate-500">Click to edit live head tags</span>
        </div>
        <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1.5 bg-slate-50 border border-slate-200 rounded-lg">
          {categoriesList.map((cat) => {
            const isSelected = cat.id === selectedSeoCatId;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => onSelectSeoCatId(cat.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer border ${
                  isSelected
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {cat.shortLabel || cat.title}
              </button>
            );
          })}
        </div>
      </div>

      {selectedCategoryMeta && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Form */}
          <form onSubmit={onSaveSeo} className="lg:col-span-7 bg-white border border-slate-200 p-5 rounded-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-[11px] font-medium text-slate-500">Configuring Collection</span>
                <h2 className="font-display font-bold text-base text-slate-900">
                  {selectedCategoryMeta.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={onApplyRecommendedSeo}
                className="text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-lg flex items-center space-x-1.5 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Auto-Fill B2B SEO</span>
              </button>
            </div>

            {seoSaveStatus && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg flex items-center space-x-2 text-xs font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{seoSaveStatus}</span>
              </div>
            )}

            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <label className="font-semibold text-slate-700">Page Title &lt;title&gt; *</label>
                <span className="font-mono tabular-nums text-[11px] text-slate-500">
                  {seoTitleInput.length} / 60 chars
                </span>
              </div>
              <input
                type="text"
                required
                value={seoTitleInput}
                onChange={(e) => onSeoTitleChange(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500"
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <label className="font-semibold text-slate-700">Meta Description *</label>
                <span className="font-mono tabular-nums text-[11px] text-slate-500">
                  {seoDescInput.length} / 160 chars
                </span>
              </div>
              <textarea
                rows={3}
                required
                value={seoDescInput}
                onChange={(e) => onSeoDescChange(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 block">Target Keywords</label>
              <input
                type="text"
                value={seoKeywordsInput}
                onChange={(e) => onSeoKeywordsChange(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500"
              />
            </div>

            <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100">
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center space-x-1.5 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Save &amp; Activate SEO</span>
              </button>

              <button
                type="button"
                onClick={onResetSeo}
                className="px-3 py-2 text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors flex items-center space-x-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Defaults</span>
              </button>
            </div>
          </form>

          {/* Previews */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 block">
                Google Search Preview
              </span>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                <div className="flex items-center space-x-1.5 text-[11px] text-slate-700 truncate">
                  <img
                    src={siteMediaLogoSymbol || '/favicon.png'}
                    alt="Site Favicon"
                    className="w-4 h-4 rounded-full object-contain bg-white border border-slate-200"
                  />
                  <span className="font-medium">hightoneceramic.com</span>
                  <span className="text-slate-400">› collections › {selectedSeoCatId}</span>
                </div>
                <div className="text-sm text-[#1a0dab] font-medium line-clamp-1">
                  {seoTitleInput || 'Untitled Collection'}
                </div>
                <p className="text-xs text-slate-600 leading-snug line-clamp-2">
                  {seoDescInput || 'No meta description provided.'}
                </p>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 flex items-center space-x-1.5">
                  <Share2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>WhatsApp Share Card</span>
                </span>
                {Boolean(collectionSeoMap[selectedSeoCatId]) && (
                  <span className="text-[11px] text-emerald-700 font-semibold">Custom Active</span>
                )}
              </div>

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-3">
                <div className="bg-white rounded-lg overflow-hidden border border-slate-200">
                  {selectedCategoryMeta.coverImage && (
                    <div className="aspect-16/9 bg-slate-100 overflow-hidden">
                      <img
                        src={normalizeImageUrl(selectedCategoryMeta.coverImage)}
                        alt={selectedCategoryMeta.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="p-2.5 space-y-1">
                    <span className="text-[10px] uppercase font-mono text-slate-400 block">
                      hightoneceramic.com
                    </span>
                    <div className="font-bold text-xs text-slate-900 line-clamp-1">
                      {seoTitleInput || selectedCategoryMeta.title}
                    </div>
                    <div className="text-[11px] text-slate-500 line-clamp-2">
                      {seoDescInput || selectedCategoryMeta.description}
                    </div>
                  </div>
                </div>

                {(() => {
                  const richShareUrl = `https://hightoneceramic.com/share/${selectedSeoCatId}`;
                  return (
                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                          `*${seoTitleInput || selectedCategoryMeta.title}*\n${seoDescInput || selectedCategoryMeta.description}\n\n👉 View Collection: ${richShareUrl}`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 bg-[#25D366] hover:bg-[#20ba59] text-white text-xs font-semibold rounded-lg flex items-center space-x-1.5 transition-colors"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Share WhatsApp</span>
                      </a>

                      <button
                        type="button"
                        onClick={() => onCopyShareLink(richShareUrl)}
                        className="px-3 py-1.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 text-xs font-semibold rounded-lg flex items-center space-x-1.5 cursor-pointer"
                      >
                        <Copy className="w-3.5 h-3.5 text-slate-500" />
                        <span>{copiedShareLink ? 'Copied!' : 'Copy Share Link'}</span>
                      </button>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
