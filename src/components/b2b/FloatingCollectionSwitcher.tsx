import React, { useEffect, useRef, useState } from 'react';
import { Check, Layers, X } from 'lucide-react';

export interface CollectionMenuItem {
  id: string;
  label: string;
  modelCount: number;
  selectedQty: number;
}

interface FloatingCollectionSwitcherProps {
  collections: CollectionMenuItem[];
  selectedCategory: string;
  onSelectCategory: (categoryId: string) => void;
  hasOrderTray: boolean;
  hidden?: boolean;
}

export const FloatingCollectionSwitcher: React.FC<FloatingCollectionSwitcherProps> = ({
  collections,
  selectedCategory,
  onSelectCategory,
  hasOrderTray,
  hidden = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const closeTimerRef = useRef<number | null>(null);

  const clearCloseTimer = () => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const scheduleClose = () => {
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      setIsOpen(false);
      setIsHovered(false);
    }, 150);
  };

  useEffect(() => {
    return () => clearCloseTimer();
  }, []);

  useEffect(() => {
    if (hidden && isOpen) {
      setIsOpen(false);
      setIsHovered(false);
    }
  }, [hidden, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDownOutside = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setIsHovered(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        setIsHovered(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDownOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDownOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  if (hidden) return null;

  const activeCollection =
    collections.find((c) => c.id === selectedCategory) || collections[0];
  const totalSelectedQty = collections[0]?.selectedQty || 0;

  const handlePointerEnter = (e: React.PointerEvent<HTMLElement>) => {
    if (e.pointerType !== 'mouse') return;
    clearCloseTimer();
    setIsHovered(true);
    setIsOpen(true);
  };

  const handlePointerLeave = (e: React.PointerEvent<HTMLElement>) => {
    if (e.pointerType !== 'mouse') return;
    scheduleClose();
  };

  const handleSelect = (categoryId: string) => {
    clearCloseTimer();
    onSelectCategory(categoryId);
    setIsOpen(false);
    setIsHovered(false);
  };

  return (
    <aside
      ref={containerRef}
      aria-label="Quick Collection Switcher"
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      className={`fixed ${
        hasOrderTray
          ? 'bottom-[168px] sm:bottom-[184px] md:bottom-[188px]'
          : 'bottom-[96px] sm:bottom-[104px] md:bottom-[116px]'
      } right-5 sm:right-6 md:right-8 z-[45] flex flex-col items-end select-none pointer-events-auto transition-all duration-300 ease-in-out`}
    >
      {/* Popup Menu Opening Upward Above Trigger */}
      {isOpen && (
        <div
          role="menu"
          aria-label="Product Collections"
          className="mb-2.5 w-72 sm:w-80 max-w-[calc(100vw-2.5rem)] bg-white border border-slate-200 rounded-xl shadow-2xl shadow-slate-950/20 overflow-hidden origin-bottom-right animate-in fade-in slide-in-from-bottom-2 duration-150"
        >
          <div className="px-3.5 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-xs font-bold text-[#0F2E52] truncate">
                Switch Collection
              </div>
              <div className="text-[11px] text-slate-500 truncate">
                Open any category without losing order items
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                clearCloseTimer();
                setIsOpen(false);
                setIsHovered(false);
              }}
              className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer shrink-0"
              aria-label="Close collection menu"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="max-h-[50vh] overflow-y-auto divide-y divide-slate-100">
            {collections.map((item) => {
              const isSelected = item.id === selectedCategory;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={isSelected}
                  onClick={() => handleSelect(item.id)}
                  className={`w-full px-3.5 py-2.5 text-left flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-[#0F2E52] text-white'
                      : 'bg-white text-slate-800 hover:bg-slate-50'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {isSelected && (
                        <Check className="w-3.5 h-3.5 text-sky-300 shrink-0" />
                      )}
                      <span className="text-xs font-semibold truncate">
                        {item.label}
                      </span>
                    </div>
                    <div
                      className={`text-[11px] mt-0.5 tabular-nums ${
                        isSelected ? 'text-slate-300' : 'text-slate-500'
                      }`}
                    >
                      {item.modelCount} {item.modelCount === 1 ? 'model' : 'models'}
                    </div>
                  </div>

                  <div
                    className={`text-[11px] font-mono font-bold tabular-nums shrink-0 whitespace-nowrap ${
                      item.selectedQty > 0
                        ? isSelected
                          ? 'text-emerald-300'
                          : 'text-emerald-700'
                        : isSelected
                        ? 'text-slate-300'
                        : 'text-slate-400'
                    }`}
                  >
                    {item.selectedQty} qty
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Floating Trigger Row (Matches FloatingWhatsApp Symmetry) */}
      <div className="flex items-center space-x-2.5">
        {(!hasOrderTray || isHovered || isOpen) && (
          <button
            type="button"
            onClick={() => setIsOpen((prev) => !prev)}
            className="hidden md:inline-flex items-center space-x-2 bg-white/90 hover:bg-white backdrop-blur-md text-[#0F2E52] border border-slate-200/90 rounded-full pl-3 pr-3.5 py-1.5 shadow-lg shadow-black/5 text-xs font-semibold hover:border-[#0F2E52] transition-all duration-150 cursor-pointer max-w-[230px]"
          >
            <span className="truncate">
              {activeCollection ? activeCollection.label : 'All Collections'}
            </span>
            {totalSelectedQty > 0 && (
              <span className="text-[11px] font-mono text-emerald-700 shrink-0 tabular-nums">
                · {totalSelectedQty}
              </span>
            )}
          </button>
        )}

        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-expanded={isOpen}
          aria-haspopup="menu"
          aria-label={`Change Collection (Current: ${activeCollection?.label || 'All Collections'})`}
          className={`relative flex items-center justify-center w-14 h-14 sm:w-14 sm:h-14 md:w-15 md:h-15 rounded-full transition-all duration-200 border-2 border-white shadow-xl shadow-slate-900/25 focus:outline-none focus:ring-4 focus:ring-sky-300 shrink-0 cursor-pointer active:scale-95 ${
            isOpen
              ? 'bg-sky-600 text-white'
              : 'bg-[#0F2E52] hover:bg-[#1e3a5f] text-white'
          }`}
        >
          <Layers className="w-6 h-6 sm:w-6 sm:h-6" />
          {totalSelectedQty > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[22px] h-[22px] px-1 rounded-full bg-emerald-600 border-2 border-white text-white text-[10px] font-mono font-bold flex items-center justify-center tabular-nums shadow-xs">
              {totalSelectedQty > 999 ? '999+' : totalSelectedQty}
            </span>
          )}
        </button>
      </div>
    </aside>
  );
};
