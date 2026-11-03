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
import { CheckCircle2, Loader2 } from 'lucide-react';
import { updateDocumentSeo } from './services/seoService';
import { trackEvent, initGA4, initVisitorTracking } from './services/analyticsService';

function AppLoadingSkeleton() {
  return (
    <div className="min-h-screen flex flex-col bg-[#f7f9fb] text-[#191c1e] relative select-none animate-in fade-in duration-200">
      {/* Top subtle indeterminate progress bar */}
      <div className="fixed top-0 left-0 right-0 z-50 h-[2.5px] bg-slate-100 overflow-hidden">
        <div className="h-full w-full bg-gradient-to-r from-transparent via-[#0F2E52] to-[#2563EB] animate-pulse" />
      </div>

      {/* Skeleton Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200/80 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-18">
            {/* Brand Logo placeholder */}
            <div className="flex items-center space-x-3">
              <div className="flex flex-col space-y-1">
                <div className="h-5 w-28 sm:w-36 bg-slate-200 rounded animate-pulse" />
                <div className="h-2.5 w-16 sm:w-20 bg-slate-100 rounded animate-pulse" />
              </div>
            </div>

            {/* Navigation pills skeleton (desktop) */}
            <div className="hidden md:flex items-center space-x-7">
              <div className="h-3.5 w-12 bg-slate-200 rounded animate-pulse" />
              <div className="h-3.5 w-18 bg-slate-200 rounded animate-pulse" />
              <div className="h-3.5 w-20 bg-slate-200 rounded animate-pulse" />
              <div className="h-3.5 w-14 bg-slate-200 rounded animate-pulse" />
            </div>

            {/* Right Action buttons skeleton */}
            <div className="flex items-center space-x-3">
              <div className="hidden sm:block h-9 w-20 bg-slate-100 border border-slate-200 rounded-[3px] animate-pulse" />
              <div className="h-9 w-24 sm:w-28 bg-[#0F2E52]/15 rounded-[3px] animate-pulse" />
            </div>
          </div>
        </div>
      </header>

      {/* Floating Subtle Status Pill */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 w-full">
        <div className="inline-flex items-center space-x-2 px-3 py-1.5 bg-white/80 backdrop-blur-xs border border-slate-200/80 rounded-full shadow-2xs text-[11px] font-mono text-[#0F2E52]">
          <Loader2 className="w-3.5 h-3.5 text-[#0F2E52] animate-spin shrink-0" />
          <span className="font-medium tracking-tight">Syncing Thangadh Sanitaryware Catalog...</span>
        </div>
      </div>

      {/* Skeleton Hero Section */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-16 w-full space-y-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          {/* Left Column */}
          <div className="lg:col-span-7 space-y-5">
            {/* Category Pill */}
            <div className="h-5 w-52 bg-slate-200 rounded-sm animate-pulse" />

            {/* Headline */}
            <div className="space-y-2.5">
              <div className="h-9 sm:h-12 w-11/12 bg-slate-200 rounded-sm animate-pulse" />
              <div className="h-6 sm:h-8 w-2/3 bg-slate-100 rounded-sm animate-pulse" />
            </div>

            {/* Subtitle / paragraph */}
            <div className="space-y-2 max-w-2xl pt-1">
              <div className="h-3.5 w-full bg-slate-200 rounded-sm animate-pulse" />
              <div className="h-3.5 w-4/5 bg-slate-200 rounded-sm animate-pulse" />
            </div>

            {/* Button */}
            <div className="pt-2">
              <div className="h-11 w-32 bg-[#0F2E52]/20 rounded-[3px] animate-pulse" />
            </div>

            {/* 3 Metrics Row */}
            <div className="grid grid-cols-3 gap-4 pt-6 border-t border-slate-200">
              {[1, 2, 3].map((i) => (
                <div key={i} className="space-y-1.5">
                  <div className="h-6 sm:h-7 w-20 sm:w-24 bg-slate-200 rounded-sm animate-pulse" />
                  <div className="h-2.5 w-16 bg-slate-100 rounded-sm animate-pulse" />
                </div>
              ))}
            </div>
          </div>

          {/* Right Column / Hero Image Placeholder */}
          <div className="lg:col-span-5 hidden lg:block">
            <div className="aspect-4/3 rounded-[4px] bg-slate-200 border border-slate-300 animate-pulse relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-tr from-slate-300/40 via-transparent to-white/40" />
            </div>
          </div>
        </div>

        {/* Skeleton Collection Cards Grid */}
        <div className="space-y-4 pt-6">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
            <div className="h-3.5 w-44 bg-slate-200 rounded animate-pulse" />
            <div className="h-3 w-28 bg-slate-100 rounded animate-pulse" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-6">
            {[1, 2, 3, 4, 5, 6].map((idx) => (
              <div
                key={idx}
                className="bg-white border border-slate-200 rounded-[4px] overflow-hidden shadow-2xs space-y-3"
              >
                <div className="aspect-4/3 sm:aspect-16/10 bg-slate-200 animate-pulse relative">
                  <div className="absolute top-2 left-2 h-4 w-20 bg-slate-300 rounded-xs" />
                  <div className="absolute bottom-2 right-2 h-4 w-14 bg-white/70 rounded-xs" />
                </div>
                <div className="p-3 sm:p-4 space-y-2">
                  <div className="h-4 w-3/4 bg-slate-200 rounded-xs animate-pulse" />
                  <div className="h-3 w-1/2 bg-slate-100 rounded-xs animate-pulse" />
                  <div className="pt-2">
                    <div className="h-8 w-full bg-slate-100 border border-slate-200 rounded-[3px] animate-pulse" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

function AppContent() {
  const { isInitializing } = useWebsiteData();
  const [currentPage, setCurrentPage] = useState<PageId>('home');
  const [collectionCategory, setCollectionCategory] = useState<string>('all');
  const [isQuoteOpen, setIsQuoteOpen] = useState(false);
  const [quoteProduct, setQuoteProduct] = useState('Complete Ceramic Sanitaryware Catalog');
  const [isSheetModalOpen, setIsSheetModalOpen] = useState(false);
  const [isLegalOpen, setIsLegalOpen] = useState(false);
  const [legalTab, setLegalTab] = useState<'privacy' | 'terms'>('privacy');

  // Success toast for inquiries
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  React.useEffect(() => {
    initGA4();
    initVisitorTracking();
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl + Shift + S or Cmd + Shift + S opens the CMS modal for the owner
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        setIsSheetModalOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
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

  // If DataProvider is actively performing initial sync, show subtle skeleton screen (called after all hooks)
  if (isInitializing) {
    return <AppLoadingSkeleton />;
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
    setToastMessage(`Inquiry for "${payload.businessName}" submitted directly to Thangadh desk.`);
    setTimeout(() => setToastMessage(null), 5000);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f7f9fb] text-[#191c1e] relative">

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

      {/* Global Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 left-6 z-50 bg-[#0F2E52] text-white px-4 py-3 rounded-[3px] border border-cyan-500/40 shadow-2xl flex items-center space-x-2 text-xs animate-in fade-in slide-in-from-bottom duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
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
