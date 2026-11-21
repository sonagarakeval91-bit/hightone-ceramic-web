import React, { useEffect, useMemo, useState } from 'react';
import { Download, FileSpreadsheet, Lock, X } from 'lucide-react';
import { SavedDealerOrder } from '../../types';
import {
  buildDefaultEstimateConfig,
  downloadOrderEstimateExcel,
  EstimateExportConfig
} from '../../utils/orderEstimateExcel';

interface OrderEstimateExportModalProps {
  order: SavedDealerOrder;
  onClose: () => void;
  onExported: (filename: string) => void;
  onError: (message: string) => void;
}

const GST_PRESETS = [0, 9, 18] as const;

export const OrderEstimateExportModal: React.FC<OrderEstimateExportModalProps> = ({
  order,
  onClose,
  onExported,
  onError
}) => {
  const [config, setConfig] = useState<EstimateExportConfig>(() =>
    buildDefaultEstimateConfig(order)
  );
  const [gstInput, setGstInput] = useState<string>(() =>
    String(buildDefaultEstimateConfig(order).gstPercent)
  );
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const next = buildDefaultEstimateConfig(order);
    setConfig(next);
    setGstInput(String(next.gstPercent));
  }, [order]);

  const totalQty = useMemo(
    () => config.lines.reduce((sum, line) => sum + (Number(line.quantity) || 0), 0),
    [config.lines]
  );

  const handleGstChange = (raw: string) => {
    setGstInput(raw);
    const parsed = parseFloat(raw);
    if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 100) {
      setConfig((prev) => ({ ...prev, gstPercent: parsed }));
    } else if (raw.trim() === '') {
      setConfig((prev) => ({ ...prev, gstPercent: 0 }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isExporting) return;
    if (config.lines.length === 0) {
      onError('This order has no line items to export.');
      return;
    }

    setIsExporting(true);
    try {
      const filename = await downloadOrderEstimateExcel({
        ...config,
        voucherNo: config.voucherNo.trim() || order.orderId || order.id,
        voucherDate: config.voucherDate.trim(),
        dealerName: config.dealerName.trim() || 'DEALER',
        dealerAddress: config.dealerAddress.trim(),
        vehicleNo: config.vehicleNo.trim(),
        remarks: config.remarks.trim()
      });
      onExported(filename);
      onClose();
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Unable to generate Excel estimate file.';
      onError(msg);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-60 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="estimate-export-title"
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-3xl max-h-[92dvh] flex flex-col bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden"
      >
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-3 bg-white shrink-0">
          <div className="min-w-0">
            <div className="flex items-center space-x-2">
              <FileSpreadsheet className="w-4 h-4 text-emerald-700 shrink-0" />
              <h3
                id="estimate-export-title"
                className="font-display font-bold text-base text-slate-900 truncate"
              >
                Export Sales Order Estimate (.xlsx)
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Print-ready A4 Sales Order sheet with blank confidential Rate cells and live Excel formulas.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close export estimate dialog"
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {/* Security & Formula Assurance Notice */}
          <div className="px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl flex items-start space-x-2.5 text-xs text-slate-700">
            <Lock className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
            <div>
              <strong className="text-slate-900">Confidential Pricing Protected:</strong> Rate cells are left{' '}
              <strong className="text-slate-900">blank</strong> and never saved online. Type dealer rates in Excel to auto-calculate{' '}
              <span className="font-mono text-[11px] text-slate-900">Amount = Qty × Rate</span>, Subtotal,{' '}
              <span className="font-mono text-[11px] text-slate-900">GST TAX</span> (editable % cell), Total, and Current Balance.
            </div>
          </div>

          {/* Editable Sheet Header Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label
                htmlFor="est-voucher-no"
                className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600"
              >
                Voucher No
              </label>
              <input
                id="est-voucher-no"
                type="text"
                required
                value={config.voucherNo}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, voucherNo: e.target.value }))
                }
                placeholder="SO/145"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono font-semibold text-slate-900 focus:outline-none focus:border-blue-600"
              />
            </div>

            <div className="space-y-1">
              <label
                htmlFor="est-voucher-date"
                className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600"
              >
                Voucher Date
              </label>
              <input
                id="est-voucher-date"
                type="text"
                required
                value={config.voucherDate}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, voucherDate: e.target.value }))
                }
                placeholder="DD/MM/YYYY"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-900 tabular-nums focus:outline-none focus:border-blue-600"
              />
            </div>

            <div className="space-y-1">
              <label
                htmlFor="est-vehicle-no"
                className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600"
              >
                Vehicle No (Optional)
              </label>
              <input
                id="est-vehicle-no"
                type="text"
                value={config.vehicleNo}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, vehicleNo: e.target.value }))
                }
                placeholder="Leave blank if pending"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:border-blue-600"
              />
            </div>

            <div className="sm:col-span-2 space-y-1">
              <label
                htmlFor="est-dealer-name"
                className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600"
              >
                Name (Dealer / Party)
              </label>
              <input
                id="est-dealer-name"
                type="text"
                required
                value={config.dealerName}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, dealerName: e.target.value }))
                }
                placeholder="Dealer Firm Name"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:border-blue-600"
              />
            </div>

            <div className="space-y-1">
              <label
                htmlFor="est-dealer-address"
                className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600"
              >
                Address (City / Location)
              </label>
              <input
                id="est-dealer-address"
                type="text"
                value={config.dealerAddress}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, dealerAddress: e.target.value }))
                }
                placeholder="City / Address"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600"
              />
            </div>

            <div className="sm:col-span-1 space-y-1">
              <label
                htmlFor="est-gst-pct"
                className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600"
              >
                Default GST %
              </label>
              <div className="flex items-center gap-1.5">
                <div className="relative w-20 shrink-0">
                  <input
                    id="est-gst-pct"
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={gstInput}
                    onChange={(e) => handleGstChange(e.target.value)}
                    className="w-full pl-2.5 pr-6 py-2 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 text-right tabular-nums focus:outline-none focus:border-blue-600"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-500 pointer-events-none">
                    %
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {GST_PRESETS.map((preset) => {
                    const active = config.gstPercent === preset;
                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => handleGstChange(String(preset))}
                        className={`px-2 py-2 rounded-lg text-[11px] font-mono font-semibold border transition-colors cursor-pointer tabular-nums ${
                          active
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {preset}%
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="sm:col-span-2 space-y-1">
              <label
                htmlFor="est-remarks"
                className="block text-[11px] font-semibold uppercase tracking-wider text-slate-600"
              >
                Remarks (Optional)
              </label>
              <input
                id="est-remarks"
                type="text"
                value={config.remarks}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, remarks: e.target.value }))
                }
                placeholder="Order notes or Bank / Cash reference"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:border-blue-600"
              />
            </div>
          </div>

          {/* Compact Line-Item Preview Grid */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-3.5 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-slate-900">
                Excel Line Items Preview ({config.lines.length} rows)
              </span>
              <span className="font-mono text-[11px] text-slate-600 tabular-nums">
                Total Qty: <strong className="text-slate-900">{totalQty.toFixed(3)}</strong>
                <span className="mx-2 text-slate-300">|</span>
                Weight: <strong className="text-slate-900">{config.totalWeightKg.toFixed(2)} kg</strong>
                <span className="mx-2 text-slate-300">|</span>
                GST Cell: <strong className="text-slate-900">{config.gstPercent}%</strong>
              </span>
            </div>

            <div className="max-h-60 overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-white border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-600 font-semibold">
                  <tr>
                    <th className="py-2 px-3">Product Name</th>
                    <th className="py-2 px-2 text-center">Grade</th>
                    <th className="py-2 px-2 text-center">Color/Code</th>
                    <th className="py-2 px-2 text-center">Packing</th>
                    <th className="py-2 px-3 text-right">Qty.</th>
                    <th className="py-2 px-3 text-right">Rate</th>
                    <th className="py-2 px-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {config.lines.map((line, idx) => (
                    <tr key={`${line.productName}-${line.colorCode}-${idx}`} className="h-9 hover:bg-slate-50/70">
                      <td className="py-1.5 px-3 font-medium text-slate-900">{line.productName}</td>
                      <td className="py-1.5 px-2 text-center text-slate-700">{line.grade}</td>
                      <td className="py-1.5 px-2 text-center text-slate-700">{line.colorCode}</td>
                      <td className="py-1.5 px-2 text-center text-slate-700">{line.packing}</td>
                      <td className="py-1.5 px-3 text-right font-mono font-semibold text-slate-900 tabular-nums">
                        {line.quantity.toFixed(3)}
                      </td>
                      <td className="py-1.5 px-3 text-right font-mono text-[11px] text-slate-400 italic">
                        Blank
                      </td>
                      <td className="py-1.5 px-3 text-right font-mono text-[11px] text-emerald-700">
                        =Qty×Rate
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <span className="text-[11px] text-slate-500">
            Print-ready A4 Portrait `.xlsx` with live Excel formulas (`SUM`, `ROUND`, editable GST %).
          </span>
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isExporting || config.lines.length === 0}
              className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors flex items-center space-x-1.5 cursor-pointer whitespace-nowrap shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isExporting ? 'Generating Excel...' : 'Download Estimate (.xlsx)'}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
