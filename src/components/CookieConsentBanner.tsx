import React, { useState, useEffect } from 'react';
import { ShieldCheck, MapPin, X, ChevronRight, Loader2, CheckCircle2 } from 'lucide-react';
import {
  getConsentStatus,
  setConsentStatus,
  formatLocationString,
  VisitorGeo,
  getLiveGeoFromCookie,
  notifyLocationGranted
} from '../services/analyticsService';
import { useGeoLocation } from '../hooks/useGeoLocation';

interface CookieConsentBannerProps {
  onOpenPrivacyPolicy?: () => void;
  onConsentChange?: (status: 'accepted' | 'declined') => void;
}

export const CookieConsentBanner: React.FC<CookieConsentBannerProps> = ({
  onOpenPrivacyPolicy,
  onConsentChange
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);
  const [liveLocationResult, setLiveLocationResult] = useState<VisitorGeo | null>(null);

  const { coordinates, permissionState, locationDetails, requestLocation } = useGeoLocation();

  useEffect(() => {
    if (locationDetails) {
      setLiveLocationResult(locationDetails);
    }
  }, [locationDetails]);

  useEffect(() => {
    // Check existing consent status
    const current = getConsentStatus();
    if (current === 'unspecified') {
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 700);
      return () => clearTimeout(timer);
    }
  }, []);

  // Listen for custom event to re-open from footer
  useEffect(() => {
    const handleReopen = () => {
      setIsVisible(true);
      setIsExpanded(true);
      const existing = getLiveGeoFromCookie();
      if (existing) {
        setLiveLocationResult(existing);
      }
    };
    window.addEventListener('open-cookie-preferences', handleReopen);
    return () => window.removeEventListener('open-cookie-preferences', handleReopen);
  }, []);

  const handleAllowLocationAndAccept = async () => {
    setIsRequestingLocation(true);
    // 1. Record cookie consent acceptance
    setConsentStatus('accepted');
    onConsentChange?.('accepted');

    // 2. Trigger native browser location permission prompt via useGeoLocation hook
    try {
      const coords = await requestLocation();
      if (coords) {
        const geo = getLiveGeoFromCookie();
        if (geo) {
          setLiveLocationResult(geo);
          notifyLocationGranted(geo);
        }
        // Show success confirmation briefly before closing
        setTimeout(() => {
          setIsVisible(false);
          setIsRequestingLocation(false);
        }, 1200);
        return;
      }
    } catch {
      // quiet fallback
    }

    setIsRequestingLocation(false);
    setIsVisible(false);
  };

  const handleEssentialOnly = () => {
    setConsentStatus('declined');
    setIsVisible(false);
    onConsentChange?.('declined');
  };

  if (!isVisible) return null;

  return (
    <aside
      aria-label="Live Location & Cookie Preferences"
      className="fixed bottom-3 sm:bottom-5 left-3 sm:left-6 z-45 max-w-[calc(100vw-24px)] sm:max-w-[460px] md:max-w-[480px] w-full animate-in fade-in slide-in-from-bottom-4 duration-300 pointer-events-auto"
    >
      <div className="bg-white/95 backdrop-blur-md border border-[#cbd5e1] rounded-[6px] shadow-2xl p-4 sm:p-5 text-[#191c1e] text-xs space-y-3.5 relative ring-1 ring-slate-900/5">
        {/* Top Header / Title */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-[4px] bg-[#0F2E52]/10 border border-[#0F2E52]/20 flex items-center justify-center text-[#0F2E52] shrink-0">
              <MapPin className="w-4 h-4 text-[#0F2E52] animate-pulse" />
            </div>
            <div>
              <h3 className="font-display font-bold text-[13px] text-[#0F2E52] leading-tight">
                Location Permission &amp; Cookies
              </h3>
              <p className="text-[11px] text-[#64748b]">Hightone Ceramic • Regional Dealer &amp; Freight Desk</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleEssentialOnly}
            className="text-slate-400 hover:text-slate-600 p-1 -mr-1 -mt-1 rounded transition-colors cursor-pointer"
            title="Decline & close"
            aria-label="Close cookie and location banner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Live Location Result Notice (if just detected) */}
        {liveLocationResult ? (
          <div className="p-2.5 bg-emerald-50 border border-emerald-300 rounded-[3px] text-emerald-800 text-xs flex items-center space-x-2 animate-in fade-in duration-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <div className="min-w-0">
              <span className="font-bold block">Live Location Verified &amp; Saved in Cookies:</span>
              <span className="text-[11px] font-mono truncate block">
                {formatLocationString(liveLocationResult)}
              </span>
            </div>
          </div>
        ) : (
          /* Informative Body Copy with Instructions */
          <div className="space-y-1.5 text-[11.5px] leading-relaxed text-[#475569]">
            <p>
              We request your <strong>Live Location Permission</strong> and store it in cookies to:
            </p>
            <ul className="list-disc pl-4 space-y-1 text-slate-600 text-[11px]">
              <li>Pinpoint your nearest authorized regional dealer &amp; warehouse.</li>
              <li>Calculate accurate pallet/container road transport freight from our Thangadh factory.</li>
              <li>Display real-time stock availability for your district &amp; PIN code.</li>
            </ul>
            <p className="text-[10.5px] text-slate-500 italic pt-0.5">
              Clicking <strong>&quot;Allow Location &amp; Accept&quot;</strong> will prompt your browser to allow location access.
            </p>
          </div>
        )}

        {/* Collapsible details */}
        {isExpanded && (
          <div className="bg-[#f8fafc] border border-slate-200 rounded p-3 text-[11px] text-slate-600 space-y-2 animate-in fade-in duration-150">
            <div className="flex items-start space-x-2">
              <ShieldCheck className="w-3.5 h-3.5 text-[#0F2E52] shrink-0 mt-0.5" />
              <span>
                <strong>Live Location Cookie (hightone_live_geo):</strong> Stores your verified municipal city, district, and PIN code on your device for accurate freight mapping.
              </span>
            </div>
            <div className="flex items-start space-x-2">
              <ShieldCheck className="w-3.5 h-3.5 text-[#0F2E52] shrink-0 mt-0.5" />
              <span>
                <strong>Quotation Cart Cookie:</strong> Remembers your selected items, dimensions, and inquiries across sessions.
              </span>
            </div>
            <div className="flex items-start space-x-2">
              <ShieldCheck className="w-3.5 h-3.5 text-[#0F2E52] shrink-0 mt-0.5" />
              <span>
                <strong>B2B Transparency:</strong> We never sell personal data or track your browsing outside of this ceramic portal.
              </span>
            </div>
          </div>
        )}

        {/* Action Controls */}
        <div className="pt-1 space-y-2.5">
          <div className="flex items-center justify-between text-[11px]">
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-[#0F2E52] font-semibold hover:underline inline-flex items-center cursor-pointer"
            >
              {isExpanded ? 'Hide details' : 'View cookie details'}
              <ChevronRight className={`w-3 h-3 ml-0.5 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
            </button>
            {onOpenPrivacyPolicy && (
              <button
                type="button"
                onClick={onOpenPrivacyPolicy}
                className="text-slate-500 hover:text-[#0F2E52] hover:underline cursor-pointer"
              >
                Privacy Policy
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 w-full">
            <button
              type="button"
              onClick={handleEssentialOnly}
              disabled={isRequestingLocation}
              className="w-full px-3 py-2 bg-white border border-[#cbd5e1] hover:bg-slate-50 text-slate-700 font-semibold rounded-[4px] text-[11.5px] transition-colors cursor-pointer disabled:opacity-50 text-center"
            >
              Essential Only
            </button>
            <button
              type="button"
              onClick={handleAllowLocationAndAccept}
              disabled={isRequestingLocation}
              className="w-full inline-flex items-center justify-center space-x-1.5 px-3 py-2 bg-[#0F2E52] hover:bg-[#163c68] active:bg-[#0b223d] text-white font-semibold rounded-[4px] text-[11.5px] shadow-sm transition-colors cursor-pointer disabled:opacity-60 text-center"
            >
              {isRequestingLocation ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Requesting Location...</span>
                </>
              ) : (
                <>
                  <MapPin className="w-3.5 h-3.5 text-cyan-300" />
                  <span className="truncate">Allow Location &amp; Accept</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};
