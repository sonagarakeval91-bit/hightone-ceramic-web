import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ProductItem, CategoryMeta } from '../types';
import { useWebsiteData } from '../context/DataContext';
import { trackEvent } from '../services/analyticsService';
import { normalizeImageUrl } from '../utils/imageUrl';
import { sanitizePhoneForWhatsApp, sanitizePhoneForTel, formatDisplayPhone } from '../utils/phone';
import {
  X,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  PhoneCall
} from 'lucide-react';

interface ProductDetailModalProps {
  product: ProductItem | null;
  allProducts?: ProductItem[];
  categoryMeta?: CategoryMeta | null;
  isOpen: boolean;
  onClose: () => void;
  onSelectProduct?: (product: ProductItem) => void;
  onOpenQuote: (productInterest?: string) => void;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  allProducts = [],
  categoryMeta,
  isOpen,
  onClose,
  onSelectProduct,
  onOpenQuote
}) => {
  const { companyInfo } = useWebsiteData();

  // Zoom and Pan states
  const [zoomScale, setZoomScale] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [imageError, setImageError] = useState<boolean>(false);

  const imageContainerRef = useRef<HTMLDivElement | null>(null);

  // Reset zoom & pan when product changes
  useEffect(() => {
    setZoomScale(1);
    setPanOffset({ x: 0, y: 0 });
    setIsDragging(false);
    setImageError(false);
  }, [product?.id]);

  // Lock background scroll when modal is active
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Keyboard navigation & escape listener
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight') {
        handleNextProduct();
      } else if (e.key === 'ArrowLeft') {
        handlePrevProduct();
      } else if (e.key === '+' || e.key === '=') {
        handleZoomIn();
      } else if (e.key === '-' || e.key === '_') {
        handleZoomOut();
      } else if (e.key === '0') {
        handleResetZoom();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, product, allProducts]);

  // Current index in collection
  const currentIndex = product && allProducts.length > 0
    ? allProducts.findIndex((p) => p.id === product.id)
    : -1;

  const handleNextProduct = useCallback(() => {
    if (currentIndex >= 0 && currentIndex < allProducts.length - 1 && onSelectProduct) {
      onSelectProduct(allProducts[currentIndex + 1]);
    } else if (allProducts.length > 1 && onSelectProduct) {
      // Loop to beginning
      onSelectProduct(allProducts[0]);
    }
  }, [currentIndex, allProducts, onSelectProduct]);

  const handlePrevProduct = useCallback(() => {
    if (currentIndex > 0 && onSelectProduct) {
      onSelectProduct(allProducts[currentIndex - 1]);
    } else if (allProducts.length > 1 && onSelectProduct) {
      // Loop to end
      onSelectProduct(allProducts[allProducts.length - 1]);
    }
  }, [currentIndex, allProducts, onSelectProduct]);

  // Zoom Controls
  const handleZoomIn = () => {
    setZoomScale((prev) => {
      const next = Math.min(prev + 0.5, 4);
      return Math.round(next * 10) / 10;
    });
  };

  const handleZoomOut = () => {
    setZoomScale((prev) => {
      const next = Math.max(prev - 0.5, 1);
      if (next <= 1) {
        setPanOffset({ x: 0, y: 0 });
      }
      return Math.round(next * 10) / 10;
    });
  };

  const handleResetZoom = () => {
    setZoomScale(1);
    setPanOffset({ x: 0, y: 0 });
  };

  const handleToggleZoom = (e: React.MouseEvent) => {
    // Only toggle if not actively dragging
    if (zoomScale > 1) {
      handleResetZoom();
    } else {
      // Center zoom around click position if possible
      if (imageContainerRef.current) {
        const rect = imageContainerRef.current.getBoundingClientRect();
        const offsetX = (e.clientX - rect.left - rect.width / 2) * -0.5;
        const offsetY = (e.clientY - rect.top - rect.height / 2) * -0.5;
        setPanOffset({ x: offsetX, y: offsetY });
      }
      setZoomScale(2.2);
    }
  };

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      // Zoom in
      setZoomScale((prev) => Math.min(prev + 0.25, 4));
    } else {
      // Zoom out
      setZoomScale((prev) => {
        const next = Math.max(prev - 0.25, 1);
        if (next <= 1) setPanOffset({ x: 0, y: 0 });
        return next;
      });
    }
  };

  // Mouse drag panning
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoomScale <= 1) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || zoomScale <= 1) return;
    const maxBound = (zoomScale - 1) * 350;
    const newX = Math.max(Math.min(e.clientX - dragStart.x, maxBound), -maxBound);
    const newY = Math.max(Math.min(e.clientY - dragStart.y, maxBound), -maxBound);
    setPanOffset({ x: newX, y: newY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch drag panning for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    if (zoomScale <= 1 || e.touches.length !== 1) return;
    setIsDragging(true);
    const touch = e.touches[0];
    setDragStart({ x: touch.clientX - panOffset.x, y: touch.clientY - panOffset.y });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || zoomScale <= 1 || e.touches.length !== 1) return;
    const touch = e.touches[0];
    const maxBound = (zoomScale - 1) * 300;
    const newX = Math.max(Math.min(touch.clientX - dragStart.x, maxBound), -maxBound);
    const newY = Math.max(Math.min(touch.clientY - dragStart.y, maxBound), -maxBound);
    setPanOffset({ x: newX, y: newY });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  if (!isOpen || !product) return null;

  const rawImage = product.imageUrl || categoryMeta?.coverImage || '';
  const displayImage = normalizeImageUrl(rawImage);
  const primaryPhone = companyInfo.primary_phone;

  const displayTitle = product.series && !product.name.toLowerCase().includes(product.series.toLowerCase())
    ? `${product.series} – ${product.name}`
    : product.name;

  const formattedDimension = product.dimensions?.formatted || (
    product.dimensions && product.dimensions.length > 0 && product.dimensions.width > 0
      ? `${product.dimensions.length} X ${product.dimensions.width}${
          product.dimensions.height > 0 ? ` X ${product.dimensions.height}` : ''
        } ${product.dimensions.unit || (product.dimensions.length <= 50 ? 'mm' : 'mm')}`
      : '660 X 380 X 650mm'
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-[#000c1d]/85 backdrop-blur-md animate-fadeIn select-none"
      onClick={onClose}
    >
      {/* Modal Container */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-6xl max-h-[92vh] bg-white rounded-[6px] shadow-2xl border border-white/20 overflow-hidden flex flex-col lg:flex-row"
      >
        {/* Top Floating Controls Bar */}
        <div className="absolute top-3 right-3 z-30 flex items-center gap-2">
          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="p-2 sm:p-2.5 rounded-full bg-white/80 hover:bg-white text-[#0F2E52] backdrop-blur-md border border-white/60 transition-all cursor-pointer shadow-md hover:scale-105 active:scale-95"
            title="Close large view (Esc)"
            aria-label="Close"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* ================= LEFT / TOP: CLEAN WHITE INTERACTIVE ZOOM CANVAS (NO BLACK SPACE) ================= */}
        <div className="relative flex-1 bg-white flex flex-col justify-between overflow-hidden min-h-[300px] sm:min-h-[400px] lg:min-h-[560px]">
          
          {/* Top Carousel Model Indicator with Frosted Glass Effect */}
          {allProducts.length > 1 && currentIndex >= 0 && (
            <div className="absolute top-3.5 left-3.5 z-20">
              <span className="px-3.5 py-1 rounded-full bg-white/80 hover:bg-white/90 backdrop-blur-md text-[#0F2E52] text-[11px] sm:text-xs font-sans font-semibold tracking-wide border border-white/60 shadow-sm transition-all">
                Model {currentIndex + 1} of {allProducts.length}
              </span>
            </div>
          )}

          {/* Interactive Zoom Canvas */}
          <div
            ref={imageContainerRef}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onDoubleClick={handleToggleZoom}
            className={`relative flex-1 w-full h-full flex items-center justify-center overflow-hidden cursor-${
              zoomScale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in'
            }`}
            style={{ touchAction: 'none' }}
          >
            {/* Transformable Image */}
            <div
              className="relative transition-transform duration-100 ease-out flex items-center justify-center max-w-full max-h-full p-2 sm:p-6"
              style={{
                transform: `scale(${zoomScale}) translate(${panOffset.x / zoomScale}px, ${panOffset.y / zoomScale}px)`,
                transformOrigin: 'center center'
              }}
            >
              <img
                src={imageError ? (categoryMeta?.coverImage || 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=1200&q=80') : displayImage}
                alt={product.name}
                referrerPolicy="no-referrer"
                loading="eager"
                draggable={false}
                onError={() => setImageError(true)}
                className="max-w-full max-h-[48vh] sm:max-h-[58vh] lg:max-h-[72vh] w-auto h-auto object-contain select-none pointer-events-none"
              />
            </div>

            {/* Left Carousel Arrow */}
            {allProducts.length > 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handlePrevProduct();
                }}
                className="absolute left-2.5 sm:left-4 top-1/2 -translate-y-1/2 z-20 p-2 sm:p-2.5 rounded-full bg-white/80 hover:bg-white text-[#0F2E52] backdrop-blur-md border border-white/70 transition-all cursor-pointer shadow-md hover:scale-110 active:scale-95"
                title="Previous model in collection (Left Arrow)"
                aria-label="Previous model"
              >
                <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            )}

            {/* Right Carousel Arrow */}
            {allProducts.length > 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleNextProduct();
                }}
                className="absolute right-2.5 sm:right-4 top-1/2 -translate-y-1/2 z-20 p-2 sm:p-2.5 rounded-full bg-white/80 hover:bg-white text-[#0F2E52] backdrop-blur-md border border-white/70 transition-all cursor-pointer shadow-md hover:scale-110 active:scale-95"
                title="Next model in collection (Right Arrow)"
                aria-label="Next model"
              >
                <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            )}

            {/* Simple & Aesthetic Floating Zoom Control with Frosted Glass Effect */}
            <div className="absolute bottom-3.5 right-3.5 z-20 flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleToggleZoom}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/80 hover:bg-white active:scale-95 text-[#0F2E52] backdrop-blur-md border border-white/70 text-[11px] sm:text-xs font-sans font-semibold shadow-md transition-all cursor-pointer"
                title={zoomScale > 1 ? "Click to reset view (1x)" : "Click to zoom in (2.2x)"}
              >
                <ZoomIn className={`w-3.5 h-3.5 transition-transform duration-200 ${zoomScale > 1 ? 'rotate-90 text-cyan-600' : 'text-[#0F2E52]'}`} />
                <span>{zoomScale > 1 ? `${Math.round(zoomScale * 100)}% • Reset` : 'Zoom'}</span>
              </button>

              {zoomScale > 1 && (
                <div className="inline-flex items-center bg-white/85 backdrop-blur-md rounded-full border border-white/70 p-0.5 shadow-md">
                  <button
                    type="button"
                    onClick={handleZoomOut}
                    className="p-1 rounded-full text-[#0F2E52] hover:bg-slate-100 transition-colors cursor-pointer"
                    title="Zoom Out"
                    aria-label="Zoom Out"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleZoomIn}
                    disabled={zoomScale >= 4}
                    className="p-1 rounded-full text-[#0F2E52] hover:bg-slate-100 disabled:opacity-40 transition-colors cursor-pointer"
                    title="Zoom In"
                    aria-label="Zoom In"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

          </div>

        </div>

        {/* ================= RIGHT / BOTTOM: SPECIFICATIONS & B2B ACTIONS (MATCHING IMAGE 2) ================= */}
        <div className="w-full lg:w-[460px] xl:w-[500px] bg-white flex flex-col justify-between p-5 sm:p-7 lg:p-8 border-t lg:border-t-0 lg:border-l border-[#e2e8f0]">
          
          <div className="space-y-4 sm:space-y-6 pt-1 sm:pt-4">
            
            {/* Title: 162 – Crayon style */}
            <div className="space-y-1 sm:space-y-2">
              <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-bold text-[#191c1e] tracking-tight leading-tight">
                {displayTitle}
              </h1>

              {/* Category : One Piece style */}
              <div className="text-sm sm:text-base font-semibold text-[#8B5E3C]">
                Category : <span className="text-[#515f74] font-medium">{categoryMeta?.title || product.category || 'Sanitaryware'}</span>
              </div>
            </div>

            {/* Single Detail Box: Dimension (exact match to Image 2) */}
            <div className="pt-2 sm:pt-4">
              <div className="border border-[#1e293b]/70 rounded-[2px] overflow-hidden inline-flex max-w-full text-xs sm:text-sm font-sans shadow-2xs">
                <div className="bg-white text-[#191c1e] font-semibold px-4 sm:px-5 py-2.5 sm:py-3 border-r border-[#1e293b]/70 shrink-0">
                  Dimension
                </div>
                <div className="bg-white text-[#191c1e] font-medium px-4 sm:px-6 py-2.5 sm:py-3">
                  {formattedDimension}
                </div>
              </div>
            </div>

          </div>

          {/* Bottom Actions: Both Buttons & Direct Call Desk */}
          <div className="pt-6 sm:pt-8 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
              {/* WhatsApp Quote */}
              <a
                href={`https://wa.me/${sanitizePhoneForWhatsApp(primaryPhone)}?text=${encodeURIComponent(
                  `Hello Hightone Ceramic, I need ex-factory price and dispatch schedule for ${displayTitle}.`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackEvent('whatsapp_click', `LargeView: ${product.name}`, `Series: ${product.series}`)}
                className="py-3 px-4 bg-[#25D366] hover:bg-[#20ba59] text-white text-xs sm:text-sm font-bold rounded-[3px] flex items-center justify-center space-x-2 transition-colors text-center shadow-xs cursor-pointer"
              >
                <MessageSquare className="w-4 h-4 shrink-0" />
                <span className="truncate">Inquire WhatsApp</span>
              </a>

              {/* Request Dealer Quote Modal */}
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenQuote(`${product.name} (${product.series})`);
                }}
                className="py-3 px-4 bg-[#0F2E52] hover:bg-[#1e3a5f] text-white text-xs sm:text-sm font-bold rounded-[3px] flex items-center justify-center space-x-2 transition-colors cursor-pointer shadow-xs"
              >
                <span className="truncate">Request B2B Quote</span>
              </button>
            </div>

            {/* Direct Phone Call Desk */}
            <div className="flex items-center justify-between text-xs text-[#515f74] pt-2 border-t border-[#f1f5f9]">
              <span>Direct Sales Desk:</span>
              <a
                href={sanitizePhoneForTel(primaryPhone)}
                className="text-[#0F2E52] font-bold hover:underline inline-flex items-center space-x-1"
              >
                <PhoneCall className="w-3.5 h-3.5 text-[#0F2E52]" />
                <span>{formatDisplayPhone(primaryPhone)}</span>
              </a>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
