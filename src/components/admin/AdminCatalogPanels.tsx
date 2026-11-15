import React, { useMemo, useState } from 'react';
import {
  Search,
  RotateCcw,
  Package,
  Plus,
  X,
  Copy,
  ArrowUp,
  ArrowDown,
  CheckCircle2,
  Palette,
  Tag,
  Pencil,
  Check
} from 'lucide-react';
import { CategoryMeta, ProductItem, ProductConfigOverride, ProductVariantMode } from '../../types';
import { getDefaultProductConfig, DEFAULT_DESIGN_CODES, extractBuiltInProductCode } from '../../data/productClassifications';
import { normalizeImageUrl } from '../../services/googleSheetsService';
import { ConfirmDialogConfig } from './adminTypes';
import { useToast } from '../../context/ToastContext';

interface AdminProductConfigPanelProps {
  products: ProductItem[];
  productConfigs: Record<string, ProductConfigOverride>;
  colorsList: string[];
  globalDefaultCode: string;
  onUpdateGlobalDefaultCode: (code: string) => void;
  updateProductConfig: (productId: string, config: Partial<ProductConfigOverride>) => void;
  resetProductConfigs: () => void;
  onRequestConfirm: (config: ConfirmDialogConfig) => void;
}

export const AdminProductConfigPanel: React.FC<AdminProductConfigPanelProps> = ({
  products,
  productConfigs,
  colorsList,
  globalDefaultCode,
  onUpdateGlobalDefaultCode,
  updateProductConfig,
  resetProductConfigs,
  onRequestConfirm
}) => {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [globalCodeDraft, setGlobalCodeDraft] = useState(globalDefaultCode);
  const [notice, setNotice] = useState<string | null>(null);
  const { toastSuccess } = useToast();

  const distinctCategories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set).sort();
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter((prod) => {
      if (categoryFilter !== 'all' && prod.category !== categoryFilter) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        (prod.name || '').toLowerCase().includes(q) ||
        (prod.series || '').toLowerCase().includes(q) ||
        (prod.subType || '').toLowerCase().includes(q) ||
        (prod.category || '').toLowerCase().includes(q)
      );
    });
  }, [products, categoryFilter, search]);

  const showNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3000);
    toastSuccess(msg, 'Catalog Updated');
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-700 mb-1">
            Catalog Setup
          </p>
          <h1 className="font-display font-bold text-2xl text-slate-900">
            Product Modes &amp; Weights
          </h1>
          <p className="text-xs text-slate-500 mt-0.5 max-w-2xl">
            Assign each SKU as White Only, Default Code (hides White for coded items), Color Glazes, or Design Code, and configure per-piece weights (kg) used in PDF order sheets.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            onRequestConfirm({
              title: 'Reset Product Modes & Weights?',
              message: 'Reset all product ordering modes, weights, and design codes back to factory defaults?',
              confirmLabel: 'Reset All Defaults',
              tone: 'warning',
              onConfirm: () => {
                resetProductConfigs();
                showNotice('All products reset to factory defaults.');
              }
            })
          }
          className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors flex items-center space-x-1.5 cursor-pointer whitespace-nowrap self-start sm:self-auto"
        >
          <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
          <span>Reset All to Defaults</span>
        </button>
      </div>

      {notice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-medium flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* Global Default Code Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onUpdateGlobalDefaultCode(globalCodeDraft);
          showNotice(
            globalCodeDraft.trim()
              ? `Global Default Code saved as "${globalCodeDraft.trim()}".`
              : 'Global Default Code cleared.'
          );
        }}
        className="bg-sky-50/70 border border-sky-200 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
      >
        <div className="min-w-0">
          <div className="text-xs font-bold text-sky-950 flex items-center space-x-1.5">
            <Tag className="w-3.5 h-3.5 text-sky-600 shrink-0" />
            <span>Global Default Code (Fallback for Default Code SKUs)</span>
          </div>
          <p className="text-[11px] text-sky-800 mt-0.5">
            Used whenever a product is in Default Code mode without its own SKU code (replaces &quot;Color: White&quot;).
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <input
            type="text"
            value={globalCodeDraft}
            onChange={(e) => setGlobalCodeDraft(e.target.value)}
            placeholder="e.g. STD-01, DF-01, Default"
            className="w-44 px-3 py-1.5 bg-white border border-sky-200 rounded-lg text-xs font-mono font-semibold text-slate-900 focus:outline-none focus:border-sky-500"
          />
          <button
            type="submit"
            className="px-3.5 py-1.5 bg-sky-700 hover:bg-sky-800 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            Save Default Code
          </button>
        </div>
      </form>

      {/* Search & Filter Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1 max-w-2xl">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search products by name, code or category..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-800 focus:outline-none focus:bg-white focus:border-blue-500"
          >
            <option value="all">All Categories ({distinctCategories.length})</option>
            {distinctCategories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="text-xs text-slate-500 tabular-nums">
          Showing <strong>{filteredProducts.length}</strong> of {products.length} products
        </div>
      </div>

      {/* Product Config Table / Cards */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 text-[11px] uppercase tracking-wider font-semibold">
                <th className="py-3 px-4 whitespace-nowrap">Product Details</th>
                <th className="py-3 px-4 whitespace-nowrap">Classification Mode</th>
                <th className="py-3 px-4 whitespace-nowrap">Piece Weight (kg)</th>
                <th className="py-3 px-4">Variant / Designer Codes</th>
                <th className="py-3 px-4 whitespace-nowrap text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    No matching products found.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((prod) => {
                  const defaultConfig = getDefaultProductConfig(prod);
                  const override = productConfigs[prod.id];
                  const currentMode: ProductVariantMode =
                    override?.variantMode || defaultConfig.variantMode || 'white-only';
                  const currentWeight: number =
                    typeof override?.weightKg === 'number'
                      ? override.weightKg
                      : defaultConfig.weightKg || 15.0;
                  const currentCodes: string[] =
                    override?.availableDesignCodes ||
                    defaultConfig.availableDesignCodes ||
                    DEFAULT_DESIGN_CODES;
                  const detectedCode = extractBuiltInProductCode(prod.name) || prod.defaultCode || '';
                  const currentDefaultCode: string =
                    override?.defaultCode ?? defaultConfig.defaultCode ?? '';

                  return (
                    <tr key={prod.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                            {prod.imageUrl ? (
                              <img
                                src={normalizeImageUrl(prod.imageUrl)}
                                alt={prod.name}
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            ) : (
                              <Package className="w-4 h-4 text-slate-400" />
                            )}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900">{prod.name}</div>
                            <div className="text-[11px] text-slate-500">
                              {prod.series ? `${prod.series} · ` : ''}
                              {prod.category}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <select
                          value={currentMode}
                          onChange={(e) => {
                            const newMode = e.target.value as ProductVariantMode;
                            const nextUpdates: Partial<ProductConfigOverride> = { variantMode: newMode };
                            if (newMode === 'default-code' && !currentDefaultCode.trim() && detectedCode) {
                              nextUpdates.defaultCode = detectedCode;
                            }
                            updateProductConfig(prod.id, nextUpdates);
                            showNotice(`Updated "${prod.name}" mode to ${newMode}.`);
                          }}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${
                            currentMode === 'white-only'
                              ? 'bg-slate-50 border-slate-200 text-slate-800'
                              : currentMode === 'default-code'
                              ? 'bg-sky-50 border-sky-200 text-sky-900'
                              : currentMode === 'color-glaze'
                              ? 'bg-purple-50 border-purple-200 text-purple-900'
                              : 'bg-amber-50 border-amber-200 text-amber-900'
                          }`}
                        >
                          <option value="white-only">White Only (Single Qty)</option>
                          <option value="default-code">Default Code (No White)</option>
                          <option value="color-glaze">Color Glazes (Factory Colors)</option>
                          <option value="design-code">Design Code (Numbered Codes)</option>
                        </select>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center space-x-1.5">
                          <input
                            type="number"
                            step="0.5"
                            min="0.5"
                            max="150"
                            value={currentWeight}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              if (!isNaN(val) && val > 0) {
                                updateProductConfig(prod.id, { weightKg: val });
                              }
                            }}
                            className="w-20 px-2.5 py-1.5 border border-slate-200 rounded-lg font-mono tabular-nums font-semibold text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                          />
                          <span className="text-xs font-medium text-slate-500">kg</span>
                        </div>
                      </td>

                      <td className="py-3 px-4 min-w-[220px]">
                        {currentMode === 'design-code' ? (
                          <div className="space-y-1">
                            <input
                              type="text"
                              value={currentCodes.join(', ')}
                              onChange={(e) => {
                                const codes = e.target.value
                                  .split(',')
                                  .map((c) => c.trim())
                                  .filter(Boolean);
                                updateProductConfig(prod.id, { availableDesignCodes: codes });
                              }}
                              placeholder="e.g. 1, 2, 3, 5, 21, 23"
                              className="w-full px-2.5 py-1.5 border border-amber-200 bg-amber-50/40 rounded-lg text-xs font-mono text-amber-950 focus:outline-none focus:border-amber-500"
                            />
                            <div className="text-[11px] text-amber-800">
                              {currentCodes.length} codes active
                            </div>
                          </div>
                        ) : currentMode === 'default-code' ? (
                          <div className="space-y-1">
                            <input
                              type="text"
                              value={currentDefaultCode}
                              onChange={(e) => {
                                updateProductConfig(prod.id, {
                                  variantMode: 'default-code',
                                  defaultCode: e.target.value
                                });
                              }}
                              placeholder={
                                detectedCode ||
                                globalDefaultCode ||
                                'Write default code (e.g. DF-01)'
                              }
                              className="w-full px-2.5 py-1.5 border border-sky-200 bg-sky-50/40 rounded-lg text-xs font-mono font-semibold text-sky-950 focus:outline-none focus:border-sky-500"
                            />
                            <div className="text-[11px] text-sky-700">
                              {currentDefaultCode.trim()
                                ? `Order shows Code: ${currentDefaultCode.trim()}`
                                : detectedCode
                                ? `Auto code: ${detectedCode}`
                                : globalDefaultCode
                                ? `Uses Global Default: ${globalDefaultCode}`
                                : 'Uses "Default" (or write custom code above)'}
                            </div>
                          </div>
                        ) : currentMode === 'color-glaze' ? (
                          <span className="text-xs text-purple-700 font-medium">
                            Uses factory color palette ({colorsList.length} shades)
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">Standard white only</span>
                        )}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap text-right">
                        {override ? (
                          <button
                            type="button"
                            onClick={() => {
                              updateProductConfig(prod.id, {
                                variantMode: defaultConfig.variantMode,
                                weightKg: defaultConfig.weightKg,
                                availableDesignCodes: defaultConfig.availableDesignCodes,
                                defaultCode: defaultConfig.defaultCode
                              });
                              showNotice(`Restored factory defaults for ${prod.name}.`);
                            }}
                            className="text-xs font-semibold text-amber-700 hover:underline cursor-pointer"
                          >
                            Reset Default
                          </button>
                        ) : (
                          <span className="text-xs text-emerald-700 font-medium">Default</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

interface AdminColorsCodesPanelProps {
  colorsList: string[];
  addColor: (color: string) => void;
  renameColor: (oldColor: string, newColor: string) => void;
  removeColor: (color: string) => void;
  resetColors: () => void;
  designCodesList: string[];
  addDesignCode: (code: string) => void;
  renameDesignCode: (oldCode: string, newCode: string) => void;
  removeDesignCode: (code: string) => void;
  resetDesignCodes: () => void;
  globalDefaultCode: string;
  onUpdateGlobalDefaultCode: (code: string) => void;
  onResetGlobalDefaultCode: () => void;
  onRequestConfirm: (config: ConfirmDialogConfig) => void;
}

export const AdminColorsCodesPanel: React.FC<AdminColorsCodesPanelProps> = ({
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
  onUpdateGlobalDefaultCode,
  onResetGlobalDefaultCode,
  onRequestConfirm
}) => {
  const [newColorInput, setNewColorInput] = useState('');
  const [newDesignCodeInput, setNewDesignCodeInput] = useState('');
  const [defaultCodeInput, setDefaultCodeInput] = useState(globalDefaultCode);
  const [editingColor, setEditingColor] = useState<string | null>(null);
  const [editingColorValue, setEditingColorValue] = useState('');
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [editingCodeValue, setEditingCodeValue] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const { toastSuccess, toastInfo } = useToast();

  const showNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3000);
    toastSuccess(msg, 'Palette Updated');
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-blue-700 mb-1">
          Catalog Setup
        </p>
        <h1 className="font-display font-bold text-2xl text-slate-900">
          Colors &amp; Design Codes
        </h1>
        <p className="text-xs text-slate-500 mt-0.5 max-w-2xl">
          Manage the factory color glazes palette, master designer numbers, and the global default code for pre-coded SKUs inside the Dealer Order Builder.
        </p>
      </div>

      {notice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-medium flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* Default Code Card (For Coded / Non-White SKUs) */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2">
            <Tag className="w-4 h-4 text-sky-600" />
            <h2 className="font-display font-bold text-sm text-slate-900">
              Default Code (For Coded SKUs — Replaces &quot;Color: White&quot;)
            </h2>
          </div>
          {globalDefaultCode && (
            <button
              type="button"
              onClick={() => {
                onResetGlobalDefaultCode();
                setDefaultCodeInput('');
                showNotice('Global default code cleared.');
              }}
              className="text-xs text-sky-700 hover:underline cursor-pointer flex items-center space-x-1 font-medium"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Clear Default</span>
            </button>
          )}
        </div>
        <p className="text-xs text-slate-500">
          Write the fallback Default Code used when a product is set to <strong>Default Code</strong> mode without an individual SKU code. Products whose name already carries a code (such as <code>DF-01</code>) automatically use their own code instead of White.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onUpdateGlobalDefaultCode(defaultCodeInput);
            showNotice(
              defaultCodeInput.trim()
                ? `Default Code updated to "${defaultCodeInput.trim()}".`
                : 'Default Code cleared.'
            );
          }}
          className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 max-w-xl"
        >
          <input
            type="text"
            value={defaultCodeInput}
            onChange={(e) => setDefaultCodeInput(e.target.value)}
            placeholder="Write default code (e.g. DF-01, STD-01, Default)..."
            className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-semibold text-slate-900 focus:outline-none focus:bg-white focus:border-sky-500"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-sky-700 hover:bg-sky-800 text-white font-semibold text-xs rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            Save Default Code
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Factory Colors */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center space-x-2">
              <Palette className="w-4 h-4 text-purple-600" />
              <h2 className="font-display font-bold text-sm text-slate-900">
                Color Glazes Palette ({colorsList.length})
              </h2>
            </div>
            <button
              type="button"
              onClick={() =>
                onRequestConfirm({
                  title: 'Reset Color Glazes Palette?',
                  message: 'Reset color palette back to the 14 standard factory shades?',
                  confirmLabel: 'Reset 14 Defaults',
                  tone: 'warning',
                  onConfirm: () => {
                    resetColors();
                    showNotice('Factory color palette restored to 14 standard shades.');
                  }
                })
              }
              className="text-xs text-purple-700 hover:underline cursor-pointer flex items-center space-x-1 font-medium"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset 14 Defaults</span>
            </button>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={newColorInput}
              onChange={(e) => setNewColorInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const val = newColorInput.trim();
                  if (val) {
                    addColor(val);
                    setNewColorInput('');
                    toastSuccess(`Added color "${val}" to factory palette.`, 'Color Added');
                  }
                }
              }}
              placeholder="Enter new color name (e.g. Royal Blue, Satin Grey)..."
              className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500"
            />
            <button
              type="button"
              onClick={() => {
                const val = newColorInput.trim();
                if (val) {
                  addColor(val);
                  setNewColorInput('');
                  toastSuccess(`Added color "${val}" to factory palette.`, 'Color Added');
                }
              }}
              className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs rounded-lg transition-colors cursor-pointer flex items-center space-x-1 whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Color</span>
            </button>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            {colorsList.map((col) =>
              editingColor === col ? (
                <form
                  key={col}
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (editingColorValue.trim()) {
                      renameColor(col, editingColorValue.trim());
                      showNotice(`Renamed color "${col}" to "${editingColorValue.trim()}".`);
                    }
                    setEditingColor(null);
                  }}
                  className="inline-flex items-center space-x-1 bg-white border border-purple-400 px-2 py-1 rounded-lg text-xs"
                >
                  <input
                    type="text"
                    autoFocus
                    value={editingColorValue}
                    onChange={(e) => setEditingColorValue(e.target.value)}
                    className="w-28 text-xs text-slate-900 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="text-emerald-600 hover:text-emerald-700 cursor-pointer p-0.5"
                    title="Save color name"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingColor(null)}
                    className="text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                    title="Cancel"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </form>
              ) : (
                <div
                  key={col}
                  className="inline-flex items-center space-x-1.5 bg-slate-50 text-slate-800 border border-slate-200 px-2.5 py-1.5 rounded-lg text-xs font-medium"
                >
                  <span>{col}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingColor(col);
                      setEditingColorValue(col);
                    }}
                    className="text-slate-400 hover:text-blue-700 transition-colors cursor-pointer"
                    title={`Edit ${col}`}
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      removeColor(col);
                      toastInfo(`Removed color "${col}" from palette.`, 'Color Removed');
                    }}
                    className="text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                    title={`Remove ${col}`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )
            )}
          </div>
        </div>

        {/* Master Designer Codes */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center space-x-2">
              <Tag className="w-4 h-4 text-amber-600" />
              <h2 className="font-display font-bold text-sm text-slate-900">
                Master Designer Codes ({designCodesList.length})
              </h2>
            </div>
            <button
              type="button"
              onClick={() =>
                onRequestConfirm({
                  title: 'Reset Design Codes?',
                  message: 'Reset master designer codes back to the standard factory number list?',
                  confirmLabel: 'Reset Defaults',
                  tone: 'warning',
                  onConfirm: () => {
                    resetDesignCodes();
                    showNotice('Design codes restored to default set.');
                  }
                })
              }
              className="text-xs text-amber-700 hover:underline cursor-pointer flex items-center space-x-1 font-medium"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Defaults</span>
            </button>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={newDesignCodeInput}
              onChange={(e) => setNewDesignCodeInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const val = newDesignCodeInput.trim();
                  if (val) {
                    addDesignCode(val);
                    setNewDesignCodeInput('');
                    toastSuccess(`Added design code "${val}".`, 'Design Code Added');
                  }
                }
              }}
              placeholder="Enter design code (e.g. 45, D-12)..."
              className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500"
            />
            <button
              type="button"
              onClick={() => {
                const val = newDesignCodeInput.trim();
                if (val) {
                  addDesignCode(val);
                  setNewDesignCodeInput('');
                  toastSuccess(`Added design code "${val}".`, 'Design Code Added');
                }
              }}
              className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs rounded-lg transition-colors cursor-pointer flex items-center space-x-1 whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Code</span>
            </button>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            {designCodesList.map((cd) =>
              editingCode === cd ? (
                <form
                  key={cd}
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (editingCodeValue.trim()) {
                      renameDesignCode(cd, editingCodeValue.trim());
                      showNotice(`Updated code "${cd}" to "${editingCodeValue.trim()}".`);
                    }
                    setEditingCode(null);
                  }}
                  className="inline-flex items-center space-x-1 bg-white border border-amber-500 px-2 py-1 rounded-lg text-xs font-mono"
                >
                  <input
                    type="text"
                    autoFocus
                    value={editingCodeValue}
                    onChange={(e) => setEditingCodeValue(e.target.value)}
                    className="w-20 text-xs text-slate-900 focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="text-emerald-600 hover:text-emerald-700 cursor-pointer p-0.5"
                    title="Save code"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingCode(null)}
                    className="text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                    title="Cancel"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </form>
              ) : (
                <div
                  key={cd}
                  className="inline-flex items-center space-x-1.5 bg-amber-50/70 text-amber-950 border border-amber-200 px-2.5 py-1.5 rounded-lg text-xs font-mono font-semibold"
                >
                  <span>Code {cd}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingCode(cd);
                      setEditingCodeValue(cd);
                    }}
                    className="text-amber-600 hover:text-blue-700 transition-colors cursor-pointer"
                    title={`Edit code ${cd}`}
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      removeDesignCode(cd);
                      toastInfo(`Removed design code "${cd}".`, 'Code Removed');
                    }}
                    className="text-amber-600 hover:text-rose-600 transition-colors cursor-pointer"
                    title={`Remove code ${cd}`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

interface AdminCollectionOrderPanelProps {
  editableCollections: CategoryMeta[];
  products: ProductItem[];
  orderSubTab: 'collections' | 'home' | 'guide';
  onOrderSubTabChange: (tab: 'collections' | 'home' | 'guide') => void;
  orderSearchQuery: string;
  onOrderSearchQueryChange: (val: string) => void;
  orderSaveStatus: string | null;
  copiedOrderSuccess: boolean;
  onCopyOrderTSV: () => void;
  onResetDefaultOrder: () => void;
  onOrderInputChange: (id: string, val: number) => void;
  onHomeToggle: (id: string) => void;
  onMoveCollection: (index: number, dir: 'up' | 'down') => void;
  onMoveHomeCollection: (homeIndex: number, dir: 'up' | 'down') => void;
  onEditCollection: (updated: CategoryMeta) => void;
}

export const AdminCollectionOrderPanel: React.FC<AdminCollectionOrderPanelProps> = ({
  editableCollections,
  products,
  orderSubTab,
  onOrderSubTabChange,
  orderSearchQuery,
  onOrderSearchQueryChange,
  orderSaveStatus,
  copiedOrderSuccess,
  onCopyOrderTSV,
  onResetDefaultOrder,
  onOrderInputChange,
  onHomeToggle,
  onMoveCollection,
  onMoveHomeCollection,
  onEditCollection
}) => {
  const [editingCollection, setEditingCollection] = useState<CategoryMeta | null>(null);
  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-700 mb-1">
            Catalog Setup
          </p>
          <h1 className="font-display font-bold text-2xl text-slate-900">
            Collection Sequence &amp; Home Showcase
          </h1>
          <p className="text-xs text-slate-500 mt-0.5 max-w-2xl">
            Reorder how collections appear on the Collections page and select which 8 collections display on the Home Page grid.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onCopyOrderTSV}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center space-x-1.5 cursor-pointer transition-colors whitespace-nowrap"
          >
            <Copy className="w-3.5 h-3.5 text-slate-500" />
            <span>{copiedOrderSuccess ? 'Copied to Clipboard!' : 'Copy for Sheets'}</span>
          </button>
          <button
            type="button"
            onClick={onResetDefaultOrder}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold flex items-center space-x-1.5 cursor-pointer transition-colors whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            <span>Reset Default</span>
          </button>
        </div>
      </div>

      {orderSaveStatus && (
        <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg flex items-center space-x-2 text-xs font-medium">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{orderSaveStatus}</span>
        </div>
      )}

      {/* Sub-Navigation + Search */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-lg">
          <button
            type="button"
            onClick={() => onOrderSubTabChange('collections')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap ${
              orderSubTab === 'collections'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Collections Order ({editableCollections.length})
          </button>
          <button
            type="button"
            onClick={() => onOrderSubTabChange('home')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap ${
              orderSubTab === 'home'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Home 8-Card Showcase
          </button>
          <button
            type="button"
            onClick={() => onOrderSubTabChange('guide')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap ${
              orderSubTab === 'guide'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Google Sheet Guide
          </button>
        </div>

        {orderSubTab !== 'guide' && (
          <div className="relative min-w-[220px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Filter collection..."
              value={orderSearchQuery}
              onChange={(e) => onOrderSearchQueryChange(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500"
            />
          </div>
        )}
      </div>

      {/* Sub-view 1: Collections Page Order */}
      {orderSubTab === 'collections' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 text-[11px] uppercase tracking-wider font-semibold">
                  <th className="py-3 px-4 w-20 text-center">Order #</th>
                  <th className="py-3 px-4">Collection Details</th>
                  <th className="py-3 px-4 whitespace-nowrap">Catalog Models</th>
                  <th className="py-3 px-4 text-center">Home Showcase</th>
                  <th className="py-3 px-4 text-center">Move</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
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
                      <tr key={cat.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 text-center">
                          <input
                            type="number"
                            min="1"
                            max="99"
                            value={cat.order ?? index + 1}
                            onChange={(e) => onOrderInputChange(cat.id, parseInt(e.target.value, 10))}
                            className="w-12 px-1.5 py-1 text-center font-bold font-mono tabular-nums text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:border-blue-500 text-slate-900"
                          />
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden shrink-0">
                              <img
                                src={normalizeImageUrl(cat.coverImage)}
                                alt={cat.title}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div>
                              <span className="font-semibold text-slate-900 block">{cat.title}</span>
                              <div className="text-[11px] text-slate-500">
                                <span>{cat.id}</span>
                                <span className="mx-1.5" aria-hidden="true">·</span>
                                <span className="truncate max-w-[220px] inline-block align-bottom">{cat.subtitle}</span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap tabular-nums text-slate-600 font-medium">
                          {count} {count === 1 ? 'Model' : 'Models'}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => onHomeToggle(cat.id)}
                            className={`px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                              cat.showOnHome
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                                : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {cat.showOnHome ? 'Visible on Home' : '+ Show on Home'}
                          </button>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="inline-flex items-center space-x-1">
                            <button
                              type="button"
                              onClick={() => setEditingCollection({ ...cat })}
                              className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                              title="Edit collection details"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onMoveCollection(index, 'up')}
                              disabled={index === 0}
                              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30 rounded-lg transition-colors cursor-pointer"
                              title="Move position up"
                            >
                              <ArrowUp className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onMoveCollection(index, 'down')}
                              disabled={index === editableCollections.length - 1}
                              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-30 rounded-lg transition-colors cursor-pointer"
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

      {/* Sub-view 2: Home Page 8-Card Showcase */}
      {orderSubTab === 'home' && (
        <div className="space-y-4">
          <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-900 leading-relaxed">
            <strong>Home Page Display:</strong> The Home Page features 8 collection cards followed by the automatic 9th card (&quot;Explore Our All Collections&quot;). Arrange those 8 slots below.
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="border border-slate-200 rounded-xl bg-white p-4 space-y-3">
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                <span className="font-bold text-slate-900 text-xs">Active Home Showcase (Slots 1–8)</span>
                <span className="text-xs text-slate-500 font-mono tabular-nums">
                  {editableCollections.filter((c) => c.showOnHome).length} of 8 filled
                </span>
              </div>

              <div className="space-y-2">
                {editableCollections
                  .filter((c) => c.showOnHome === true)
                  .sort((a, b) => (a.homeOrder ?? a.order ?? 999) - (b.homeOrder ?? b.order ?? 999))
                  .map((cat, homeIdx) => (
                    <div
                      key={cat.id}
                      className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 bg-slate-50/60"
                    >
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <span className="w-6 h-6 rounded-md bg-blue-600 text-white flex items-center justify-center font-mono font-bold text-xs shrink-0 tabular-nums">
                          {homeIdx + 1}
                        </span>
                        <div className="w-8 h-8 rounded-md bg-slate-100 border border-slate-200 overflow-hidden shrink-0">
                          <img
                            src={normalizeImageUrl(cat.coverImage)}
                            alt={cat.title}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="min-w-0">
                          <span className="font-semibold text-xs text-slate-900 block truncate">
                            {cat.title}
                          </span>
                          <span className="text-[11px] text-slate-500">Slot #{homeIdx + 1}</span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => onMoveHomeCollection(homeIdx, 'up')}
                          disabled={homeIdx === 0}
                          className="p-1.5 text-slate-600 hover:text-slate-900 disabled:opacity-25 cursor-pointer"
                          title="Move up"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onMoveHomeCollection(homeIdx, 'down')}
                          disabled={homeIdx === editableCollections.filter((c) => c.showOnHome === true).length - 1}
                          className="p-1.5 text-slate-600 hover:text-slate-900 disabled:opacity-25 cursor-pointer"
                          title="Move down"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onHomeToggle(cat.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 cursor-pointer"
                          title="Remove from Home"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}

                <div className="p-2.5 rounded-lg border border-dashed border-blue-200 bg-blue-50/40 text-slate-700 flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2.5">
                    <span className="w-6 h-6 rounded-md bg-blue-100 text-blue-700 flex items-center justify-center font-mono font-bold text-xs">
                      9
                    </span>
                    <div>
                      <span className="font-semibold block">Explore Our All Collections</span>
                      <span className="text-[11px] text-slate-500">Automatic catalog link card</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl bg-white p-4 space-y-3">
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                <span className="font-bold text-slate-900 text-xs">Available Collections</span>
                <span className="text-[11px] text-slate-500">Click to feature on Home</span>
              </div>

              <div className="space-y-2 max-h-[380px] overflow-y-auto">
                {editableCollections
                  .filter((c) => !c.showOnHome)
                  .map((cat) => (
                    <div
                      key={cat.id}
                      className="flex items-center justify-between p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-md bg-slate-100 overflow-hidden shrink-0">
                          <img
                            src={normalizeImageUrl(cat.coverImage)}
                            alt={cat.title}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="min-w-0">
                          <span className="font-semibold text-xs text-slate-900 block truncate">
                            {cat.title}
                          </span>
                          <span className="text-[11px] text-slate-500">{cat.id}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onHomeToggle(cat.id)}
                        className="px-2.5 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg cursor-pointer transition-colors whitespace-nowrap"
                      >
                        + Feature
                      </button>
                    </div>
                  ))}

                {editableCollections.filter((c) => !c.showOnHome).length === 0 && (
                  <p className="text-center text-xs text-slate-500 py-8">
                    All collections are currently featured on the Home Page.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sub-view 3: Sheet Instructions */}
      {orderSubTab === 'guide' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <span className="font-bold text-slate-900 text-sm">
              Set Collection Order in Google Sheets
            </span>
            <button
              type="button"
              onClick={onCopyOrderTSV}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>{copiedOrderSuccess ? 'Copied!' : 'Copy Template Table'}</span>
            </button>
          </div>

          <ol className="list-decimal pl-5 space-y-1.5 text-xs text-slate-700 leading-relaxed">
            <li>Open your Google Sheet and switch to the <strong>Collections</strong> tab.</li>
            <li>Add column <code>order</code> (numbers 1, 2, 3...) to set the Collections page display sequence.</li>
            <li>Add column <code>home</code> (<code>TRUE</code> or <code>YES</code>) for the 8 collections featured on Home.</li>
            <li>Optionally add <code>home_order</code> (1 to 8) for custom Home grid positioning.</li>
            <li>Return to <strong>Google Sheets &amp; Sync</strong> and click <strong>Sync Now</strong>.</li>
          </ol>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg font-mono text-[11px] overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-200/80 text-slate-800 font-bold">
                  <th className="p-2 border border-slate-300">category</th>
                  <th className="p-2 border border-slate-300">title</th>
                  <th className="p-2 border border-slate-300">order</th>
                  <th className="p-2 border border-slate-300">home</th>
                  <th className="p-2 border border-slate-300">home_order</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="p-2 border border-slate-300">one-piece</td>
                  <td className="p-2 border border-slate-300">One Piece Closets</td>
                  <td className="p-2 border border-slate-300 font-bold text-blue-700">1</td>
                  <td className="p-2 border border-slate-300 font-bold text-emerald-700">TRUE</td>
                  <td className="p-2 border border-slate-300 font-bold text-amber-700">1</td>
                </tr>
                <tr>
                  <td className="p-2 border border-slate-300">wall-hung</td>
                  <td className="p-2 border border-slate-300">Wall Hung Closets</td>
                  <td className="p-2 border border-slate-300 font-bold text-blue-700">2</td>
                  <td className="p-2 border border-slate-300 font-bold text-emerald-700">TRUE</td>
                  <td className="p-2 border border-slate-300 font-bold text-amber-700">2</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* EDIT COLLECTION MODAL */}
      {editingCollection && (
        <div className="fixed inset-0 z-60 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onEditCollection(editingCollection);
              setEditingCollection(null);
            }}
            className="w-full max-w-md max-h-[90dvh] overflow-y-auto bg-white border border-slate-200 rounded-2xl shadow-xl p-5 space-y-4"
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-display font-bold text-base text-slate-900">
                  Edit Collection ({editingCollection.id})
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Update collection title, short label, subtitle, tag, or cover image URL.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingCollection(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-slate-700">Collection Title *</label>
                <input
                  type="text"
                  required
                  value={editingCollection.title}
                  onChange={(e) => setEditingCollection({ ...editingCollection, title: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-slate-700">Short Label</label>
                  <input
                    type="text"
                    value={editingCollection.shortLabel || ''}
                    onChange={(e) => setEditingCollection({ ...editingCollection, shortLabel: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-slate-700">Tag Label</label>
                  <input
                    type="text"
                    value={editingCollection.tagBadge || ''}
                    onChange={(e) => setEditingCollection({ ...editingCollection, tagBadge: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-slate-700">Subtitle</label>
                <input
                  type="text"
                  value={editingCollection.subtitle || ''}
                  onChange={(e) => setEditingCollection({ ...editingCollection, subtitle: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-slate-700">Cover Image URL</label>
                <input
                  type="text"
                  value={editingCollection.coverImage || ''}
                  onChange={(e) => setEditingCollection({ ...editingCollection, coverImage: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-900"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingCollection(null)}
                className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                Save Collection
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
