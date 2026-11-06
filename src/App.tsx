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
import { DataProvider } from './context/DataContext';
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

function parseInitialRoute(): { page: PageId; category: string } {
  if (typeof window === 'undefined') return { page: 'home', category: 'all' };

  try {
    const rawHash = (window.location.hash || '').toLowerCase();
    // Normalize hash: remove leading "#/" to "#"
    const hash = rawHash.replace(/^#\/?/, '#');
    const searchParams = new URLSearchParams(window.location.search);
    const colParam = searchParams.get('collection') || searchParams.get('category');
    const pageParam = searchParams.get('page') as PageId | null;

    if (colParam) {
      return { page: 'collections', category: colParam };
    }

    if (pageParam && ['home', 'collections', 'b2b', 'about'].includes(pageParam)) {
      return { page: pageParam, category: colParam || 'all' };
    }

    if (hash.startsWith('#collections/') || hash.startsWith('#collection/')) {
      const parts = hash.split('/');
      const rawCat = parts[1]?.trim() || 'all';
      const cleanCat = rawCat.split('?')[0].split('#')[0].replace(/\/+$/, '');
      return { page: 'collections', category: cleanCat || 'all' };
    }

    if (hash === '#collections' || hash === '#collection') {
      return { page: 'collections', category: 'all' };
    }

    if (hash === '#b2b' || hash === '#dealers' || hash === '#dealership') {
      return { page: 'b2b', category: 'all' };
    }

    if (hash === '#about' || hash === '#plant' || hash === '#factory') {
      return { page: 'about', category: 'all' };
    }
  } catch {}

  return { page: 'home', category: 'all' };
}

function AppContent() {
  const initialRoute = React.useMemo(() => parseInitialRoute(), []);
  const [currentPage, setCurrentPage] = useState<PageId>(initialRoute.page);
  const [collectionCategory, setCollectionCategory] = useState<string>(initialRoute.category);
  const [isQuoteOpen, setIsQuoteOpen] = useState(false);
  const [quoteProduct, setQuoteProduct] = useState('Complete Ceramic Sanitaryware Catalog');
  const [isSheetModalOpen, setIsSheetModalOpen] = useState(false);
  const [isLegalOpen, setIsLegalOpen] = useState(false);
  const [legalTab, setLegalTab] = useState<'privacy' | 'terms'>('privacy');

  // Unified toast notification state
  const [activeToast, setActiveToast] = useState<ToastNotification | null>(null);

  // Sync state with browser URL navigation and history
  const navigateTo = React.useCallback((page: PageId, category: string = 'all') => {
    setCurrentPage(page);
    setCollectionCategory(category);
    if (typeof window !== 'undefined') {
      let targetHash = '';
      if (page === 'collections') {
        targetHash = category && category !== 'all' ? `#collections/${category}` : '#collections';
      } else if (page !== 'home') {
        targetHash = `#${page}`;
      }
      
      const newUrl = `${window.location.pathname}${window.location.search}${targetHash}`;
      if (window.location.hash !== targetHash) {
        window.history.pushState(null, '', newUrl);
      }
    }
  }, []);

  React.useEffect(() => {
    const handleUrlChange = () => {
      const route = parseInitialRoute();
      setCurrentPage(route.page);
      setCollectionCategory(route.category);
    };

    window.addEventListener('hashchange', handleUrlChange);
    window.addEventListener('popstate', handleUrlChange);
    return () => {
      window.removeEventListener('hashchange', handleUrlChange);
      window.removeEventListener('popstate', handleUrlChange);
    };
  }, []);

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
        title: 'Hightone Ceramic - "Part of your life!"',
        description: 'Direct ceramic sanitaryware manufacturer in Thangadh, Gujarat. High-performance ceramic, one-piece closets, wall-hung suites, and table top basins for wholesale dealers.',
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
      {/* Main Header */}
      <Header
        currentPage={currentPage}
        onNavigate={(page) => navigateTo(page, page === 'collections' ? 'all' : undefined)}
        onOpenQuote={() => handleOpenQuote()}
      />

      {/* Main Content View */}
      <main className="flex-1">
        {currentPage === 'home' && (
          <HomePage
            onNavigate={(page) => navigateTo(page)}
            onOpenQuote={handleOpenQuote}
            onSelectCollectionCategory={(category) => navigateTo('collections', category)}
          />
        )}

        {currentPage === 'b2b' && (
          <B2BDealersPage
            onNavigate={(page) => navigateTo(page)}
            onOpenQuote={() => handleOpenQuote()}
          />
        )}

        {currentPage === 'collections' && (
          <CollectionsPage
            onNavigate={(page) => navigateTo(page)}
            onOpenQuote={handleOpenQuote}
            activeCategory={collectionCategory}
            onSelectCategory={(category) => navigateTo('collections', category)}
          />
        )}

        {currentPage === 'about' && (
          <AboutPage
            onNavigate={(page) => navigateTo(page)}
            onOpenQuote={() => handleOpenQuote()}
          />
        )}
      </main>

      {/* Footer */}
      <Footer
        onNavigate={(page, category) => navigateTo(page, category)}
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
