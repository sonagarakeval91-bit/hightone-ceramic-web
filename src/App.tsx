import React, { useState } from 'react';
import { PageId, B2BInquiryPayload } from './types';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { HomePage } from './components/pages/HomePage';
import { B2BDealersPage } from './components/pages/B2BDealersPage';
import { CollectionsPage } from './components/pages/CollectionsPage';
import { AboutPage } from './components/pages/AboutPage';
import { QuoteModal } from './components/QuoteModal';
import { GoogleSheetModal } from './components/GoogleSheetModal';
import { LegalModal } from './components/LegalModal';
import { FloatingWhatsApp } from './components/FloatingWhatsApp';
import { CookieConsentBanner } from './components/CookieConsentBanner';
import { DataProvider, useWebsiteData } from './context/DataContext';
import { CheckCircle2, MapPin, X } from 'lucide-react';
import { updateDocumentSeo } from './services/seoService';
import { trackEvent, initGA4, initVisitorTracking, VisitorGeo, formatFriendlyRegion } from './services/analyticsService';

interface ToastNotification {
  id: string;
  type: 'location' | 'inquiry' | 'general';
  title?: string;
  region?: string;
  message: string;
  subtext?: string;
}

function AppLoadingScreen({ progress }: { progress: number }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#f8fafc] text-[#191c1e] select-none">
      {/* Top subtle indeterminate progress bar */}
      <div className="fixed top-0 left-0 right-0 h-[2.5px] bg-slate-200 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-[#0F2E52] via-[#0284c7] to-[#38bdf8] transition-all duration-300 ease-out"
          style={{ width: `${Math.max(6, progress)}%` }}
        />
      </div>

      {/* Center Luxury Brand & Loader Box */}
      <div className="flex flex-col items-center max-w-sm px-6 text-center space-y-6">
        {/* Brand Lockup */}
        <div className="inline-flex flex-col items-stretch space-y-1">
          <div className="relative inline-flex items-center justify-center">
            <span className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-[#0F2E52]">
              HIGHTONE
            </span>
            <span className="text-xs font-bold text-[#0284c7] absolute -right-3.5 top-0.5">®</span>
          </div>
          <div
            aria-label="CERAMIC"
            className="flex justify-between w-full text-[10px] sm:text-[11px] font-semibold text-[#515f74] uppercase select-none leading-none px-0.5"
          >
            <span>C</span>
            <span>E</span>
            <span>R</span>
            <span>A</span>
            <span>M</span>
            <span>I</span>
            <span>C</span>
          </div>
        </div>

        {/* Minimalist Ceramic Ring Spinner */}
        <div className="relative flex items-center justify-center w-14 h-14">
          <div className="absolute inset-0 rounded-full border-2 border-slate-200" />
          <div className="absolute inset-0 rounded-full border-2 border-[#0F2E52] border-t-transparent animate-spin" />
          <div className="w-2 h-2 rounded-full bg-[#0284c7] animate-pulse" />
        </div>

        {/* Dynamic Progress Bar & Percentage */}
        <div className="w-60 sm:w-72 space-y-2.5">
          <div className="h-1.5 w-full bg-slate-200/80 rounded-full overflow-hidden p-0.5">
            <div
              className="h-full bg-gradient-to-r from-[#0F2E52] via-[#0284c7] to-[#38bdf8] rounded-full transition-all duration-300 ease-out"
              style={{ width: `${Math.max(8, progress)}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono text-slate-500">
            <span className="text-slate-400 uppercase tracking-wider text-[10px]">Loading Catalog</span>
            <span className="tabular-nums font-semibold text-[#0F2E52]">{progress}%</span>
          </div>
        </div>
      </div>

      {/* Subtle bottom note for architectural precision */}
      <div className="absolute bottom-8 text-center">
        <span className="text-[11px] text-slate-400 font-sans tracking-wide">
          Direct Vitrified Sanitaryware Manufacturing
        </span>
      </div>
    </div>
  );
}

function AppContent() {
  const { isInitializing, initProgress } = useWebsiteData();
  const [currentPage, setCurrentPage] = useState<PageId>('home');
  const [collectionCategory, setCollectionCategory] = useState<string>('all');
  const [isQuoteOpen, setIsQuoteOpen] = useState(false);
  const [quoteProduct, setQuoteProduct] = useState('Complete Ceramic Sanitaryware Catalog');
  const [isSheetModalOpen, setIsSheetModalOpen] = useState(false);
  const [isLegalOpen, setIsLegalOpen] = useState(false);
  const [legalTab, setLegalTab] = useState<'privacy' | 'terms'>('privacy');

  // Unified toast notification state
  const [activeToast, setActiveToast] = useState<ToastNotification | null>(null);

  // Fullscreen catalog loading screen state
  const [showLoader, setShowLoader] = useState(true);
  const [loaderFading, setLoaderFading] = useState(false);

  React.useEffect(() => {
    if (!isInitializing) {
      setLoaderFading(true);
      const timer = setTimeout(() => {
        setShowLoader(false);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [isInitializing]);

  React.useEffect(() => {
    initGA4();
    initVisitorTracking();

    let dismissTimer: NodeJS.Timeout | null = null;

    // Listen for location access granted event and display personalized greeting
    const handleLocationGranted = (event: Event) => {
      const customEvent = event as CustomEvent<VisitorGeo>;
      const geo = customEvent.detail;
      const friendlyRegion = formatFriendlyRegion(geo);

      if (dismissTimer) clearTimeout(dismissTimer);

      setActiveToast({
        id: `loc-${Date.now()}`,
        type: 'location',
        title: 'Location Connected',
        region: friendlyRegion,
        message: `Thank you for connecting from ${friendlyRegion}!`,
        subtext: 'Your regional freight estimates and nearby authorized dealer dispatch from our Thangadh factory are now personalized for your location.'
      });

      dismissTimer = setTimeout(() => {
        setActiveToast(null);
      }, 7000);
    };

    window.addEventListener('hightone-location-granted', handleLocationGranted);

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl + Shift + S or Cmd + Shift + S opens the CMS modal for the owner
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        setIsSheetModalOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('hightone-location-granted', handleLocationGranted);
      if (dismissTimer) clearTimeout(dismissTimer);
    };
  }, []);

  // Update dynamic Head tags on top-level page changes & track silent page_view
  React.useEffect(() => {
    trackEvent('page_view', `Page: ${currentPage}`, undefined, currentPage);
    if (currentPage === 'home') {
      updateDocumentSeo({
        title: 'Hightone Ceramic - Vitrified Sanitaryware Manufacturer & B2B Wholesale',
        description: 'Direct ceramic sanitaryware manufacturer in Thangadh, Gujarat. High-performance vitreous chinaware, one-piece closets, wall-hung suites, and table top basins for wholesale dealers.',
        keywords: 'Hightone Ceramic, sanitaryware manufacturer Thangadh, ceramic sanitaryware Gujarat, one piece closet manufacturer, wall hung basin wholesale, table top wash basin factory, orissa pan supplier, ceramic sanitaryware B2B India',
        url: typeof window !== 'undefined' ? window.location.origin : undefined
      });
    } else if (currentPage === 'b2b') {
      updateDocumentSeo({
        title: 'B2B Dealership & Project Supply | Hightone Ceramic Thangadh',
        description: 'Partner directly with Hightone Ceramic for authorized distributorships, OEM contract manufacturing, container export, and direct full-truckload dispatch.',
        keywords: 'sanitaryware dealership, ceramic factory direct, b2b sanitaryware distribution, thangadh direct truckload supply, vitrified ceramic OEM',
        url: typeof window !== 'undefined' ? `${window.location.origin}/#b2b` : undefined
      });
    } else if (currentPage === 'about') {
      updateDocumentSeo({
        title: 'About Hightone Ceramic | State-of-the-Art Ceramic Plant in Thangadh',
        description: 'Learn about Hightone Ceramic\'s automated manufacturing infrastructure in Thangadh, Gujarat: 120-meter tunnel kilns, nano-glaze glazing robots, and strict ISO testing.',
        keywords: 'Hightone Ceramic plant, sanitaryware manufacturing facility, thangadh ceramic cluster, vitrified sanitaryware testing, tunnel kiln sanitaryware',
        url: typeof window !== 'undefined' ? `${window.location.origin}/#about` : undefined
      });
    }
  }, [currentPage]);

  // If DataProvider is actively performing initial sync and image preloading, show clean branded loading screen
  if (isInitializing) {
    return <AppLoadingScreen progress={initProgress} />;
  }

  const handleOpenQuote = (initialInterest?: string) => {
    trackEvent('quote_open', initialInterest || 'Catalog Quote');
    if (initialInterest) {
      setQuoteProduct(initialInterest);
    }
    setIsQuoteOpen(true);
  };

  const handleQuoteSubmitted = (payload: B2BInquiryPayload) => {
    trackEvent(
      'quote_submit',
      payload.productInterest || 'General Inquiry',
      `Firm: ${payload.businessName}, City: ${payload.cityState}`
    );
    setActiveToast({
      id: `quote-${Date.now()}`,
      type: 'inquiry',
      title: 'Inquiry Dispatched',
      message: `Inquiry for "${payload.businessName}" submitted directly to Thangadh desk.`,
      subtext: 'Our factory sales desk will contact you with wholesale pricing and direct truckload dispatch schedules.'
    });
    setTimeout(() => setActiveToast(null), 6000);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f7f9fb] text-[#191c1e] relative">
      {/* Fullscreen Initial Catalog & Media Loading Screen */}
      {showLoader && (
        <div
          className={`fixed inset-0 z-50 transition-opacity duration-400 ease-out ${
            loaderFading ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}
        >
          <AppLoadingScreen progress={initProgress} />
        </div>
      )}

      {/* Main Header */}
      <Header
        currentPage={currentPage}
        onNavigate={(page) => {
          if (page === 'collections') {
            setCollectionCategory('all');
          }
          setCurrentPage(page);
        }}
        onOpenQuote={() => handleOpenQuote()}
      />

      {/* Main Content View */}
      <main className="flex-1">
        {currentPage === 'home' && (
          <HomePage
            onNavigate={setCurrentPage}
            onOpenQuote={handleOpenQuote}
            onSelectCollectionCategory={(category) => {
              setCollectionCategory(category);
              setCurrentPage('collections');
            }}
          />
        )}

        {currentPage === 'b2b' && (
          <B2BDealersPage
            onNavigate={setCurrentPage}
            onOpenQuote={() => handleOpenQuote()}
          />
        )}

        {currentPage === 'collections' && (
          <CollectionsPage
            onNavigate={setCurrentPage}
            onOpenQuote={handleOpenQuote}
            activeCategory={collectionCategory}
            onSelectCategory={setCollectionCategory}
          />
        )}

        {currentPage === 'about' && (
          <AboutPage
            onNavigate={setCurrentPage}
            onOpenQuote={() => handleOpenQuote()}
          />
        )}
      </main>

      {/* Footer */}
      <Footer
        onNavigate={setCurrentPage}
        onOpenQuote={() => handleOpenQuote()}
        onOpenSheetModal={() => setIsSheetModalOpen(true)}
        onOpenLegal={(tab) => {
          setLegalTab(tab);
          setIsLegalOpen(true);
        }}
      />

      {/* Interactive Modals */}
      <QuoteModal
        isOpen={isQuoteOpen}
        onClose={() => setIsQuoteOpen(false)}
        initialProductInterest={quoteProduct}
        onSubmitted={handleQuoteSubmitted}
      />

      <GoogleSheetModal
        isOpen={isSheetModalOpen}
        onClose={() => setIsSheetModalOpen(false)}
      />

      <LegalModal
        isOpen={isLegalOpen}
        onClose={() => setIsLegalOpen(false)}
        defaultTab={legalTab}
      />

      {/* Floating Always-Visible WhatsApp Quick Action */}
      <FloatingWhatsApp />

      {/* Non-intrusive Cookie & Location Analytics Consent Banner */}
      <CookieConsentBanner
        onOpenPrivacyPolicy={() => {
          setLegalTab('privacy');
          setIsLegalOpen(true);
        }}
        onConsentChange={(status) => {
          if (status === 'accepted') {
            trackEvent('cookie_consent', 'Consent Accepted', 'Visitor accepted analytics and location insights');
          } else {
            trackEvent('cookie_consent', 'Essential Only', 'Visitor selected essential cookies only');
          }
        }}
      />

      {/* Personalized Toast Notification System */}
      {activeToast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-6 z-50 max-w-sm sm:max-w-md w-[calc(100vw-3rem)] bg-[#0F2E52] text-white p-4 rounded-[4px] border border-cyan-400/50 shadow-2xl flex items-start space-x-3.5 text-xs animate-in fade-in slide-in-from-bottom-4 duration-300 ring-1 ring-white/10 select-none"
        >
          {activeToast.type === 'location' ? (
            <div className="w-8 h-8 rounded-full bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center shrink-0 mt-0.5">
              <MapPin className="w-4 h-4 text-cyan-300 animate-pulse" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shrink-0 mt-0.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
          )}

          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center space-x-2">
                <span className="font-semibold text-xs text-cyan-300 uppercase tracking-wider">
                  {activeToast.title || 'Notice'}
                </span>
                {activeToast.region && (
                  <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-cyan-950/80 border border-cyan-500/40 text-cyan-200">
                    {activeToast.region}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setActiveToast(null)}
                className="text-slate-400 hover:text-white transition-colors p-0.5 cursor-pointer rounded"
                aria-label="Dismiss toast"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-white text-xs font-semibold leading-snug">
              {activeToast.message}
            </p>
            {activeToast.subtext && (
              <p className="text-slate-300 text-[11px] leading-relaxed pt-0.5">
                {activeToast.subtext}
              </p>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

export default function App() {
  return (
    <DataProvider>
      <AppContent />
    </DataProvider>
  );
}
