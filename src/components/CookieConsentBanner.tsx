import React, { useState, useEffect } from 'react';
import { ShieldCheck, Cookie, X, ChevronRight } from 'lucide-react';
import { getConsentStatus, setConsentStatus, ConsentStatus } from '../services/analyticsService';

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

  useEffect(() => {
    // Check existing consent status
    const current = getConsentStatus();
    if (current === 'unspecified') {
      // Small 800ms delay so it doesn't aggressively flash on initial page load
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, []);

  // Listen for custom event to re-open from footer
  useEffect(() => {
    const handleReopen = () => {
      setIsVisible(true);
      setIsExpanded(true);
    };
    window.addEventListener('open-cookie-preferences', handleReopen);
    return () => window.removeEventListener('open-cookie-preferences', handleReopen);
  }, []);

  const handleAcceptAll = () => {
    setConsentStatus('accepted');
    setIsVisible(false);
    onConsentChange?.('accepted');
  };

  const handleEssentialOnly = () => {
    setConsentStatus('declined');
    setIsVisible(false);
    onConsentChange?.('declined');
  };

  if (!isVisible) return null;

  return (
    <aside
      aria-label="Privacy & Cookie Preferences"
      className="fixed bottom-3 sm:bottom-5 left-3 sm:left-6 z-45 max-w-[calc(100vw-24px)] sm:max-w-md w-full animate-in fade-in slide-in-from-bottom-4 duration-300 pointer-events-auto"
    >
      <div className="bg-white/95 backdrop-blur-md border border-[#cbd5e1] rounded-[6px] shadow-2xl p-4 sm:p-5 text-[#191c1e] text-xs space-y-3.5 relative ring-1 ring-slate-900/5">
        {/* Top Header / Title */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-[4px] bg-[#0F2E52]/10 border border-[#0F2E52]/20 flex items-center justify-center text-[#0F2E52] shrink-0">
              <Cookie className="w-4 h-4 text-[#0F2E52]" />
            </div>
            <div>
              <h3 className="font-display font-bold text-[13px] text-[#0F2E52] leading-tight flex items-center gap-1.5">
                Privacy &amp; Data Transparency
                <span className="text-[10px] font-mono font-medium px-1.5 py-0.2 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xs">
                  B2B
                </span>
              </h3>
              <p className="text-[11px] text-[#64748b]">Hightone Ceramic Plant Desk</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleEssentialOnly}
            className="text-slate-400 hover:text-slate-600 p-1 -mr-1 -mt-1 rounded transition-colors cursor-pointer"
            title="Decline non-essential & close"
            aria-label="Close cookie consent banner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Informative Body Copy */}
        <p className="text-[11.5px] leading-relaxed text-[#475569]">
          We use cookies and anonymous regional analytics (approximate city/state) to optimize catalog performance and connect your inquiries with local authorized dealers. No invasive browser permissions or personal tracking files are used.
        </p>

        {/* Collapsible details for high-trust B2B buyers */}
        {isExpanded && (
          <div className="bg-[#f8fafc] border border-slate-200 rounded p-3 text-[11px] text-slate-600 space-y-2 animate-in fade-in duration-150">
            <div className="flex items-start space-x-2">
              <ShieldCheck className="w-3.5 h-3.5 text-[#0F2E52] shrink-0 mt-0.5" />
              <span>
                <strong>Essential Storage:</strong> Remembers your active quotation cart and UI preferences.
              </span>
            </div>
            <div className="flex items-start space-x-2">
              <ShieldCheck className="w-3.5 h-3.5 text-[#0F2E52] shrink-0 mt-0.5" />
              <span>
                <strong>Regional Market Insights:</strong> Anonymous IP lookup determines dealer coverage for your city without triggering GPS permission prompts.
              </span>
            </div>
            <div className="flex items-start space-x-2">
              <ShieldCheck className="w-3.5 h-3.5 text-[#0F2E52] shrink-0 mt-0.5" />
              <span>
                <strong>Google Analytics 4:</strong> Measures catalog interaction speed and popular sanitaryware series.
              </span>
            </div>
          </div>
        )}

        {/* Action Controls */}
        <div className="pt-1 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <div className="flex items-center space-x-3 text-[11px]">
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-[#0F2E52] font-medium hover:underline inline-flex items-center cursor-pointer"
            >
              {isExpanded ? 'Hide details' : 'View data practices'}
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

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleEssentialOnly}
              className="flex-1 sm:flex-none px-3 py-1.5 bg-white border border-[#cbd5e1] hover:bg-slate-50 text-slate-700 font-medium rounded-[3px] text-[11px] transition-colors cursor-pointer"
            >
              Essential Only
            </button>
            <button
              type="button"
              onClick={handleAcceptAll}
              className="flex-1 sm:flex-none px-3.5 py-1.5 bg-[#0F2E52] hover:bg-[#163e6e] text-white font-medium rounded-[3px] text-[11px] shadow-sm transition-colors cursor-pointer"
            >
              Accept All
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};
