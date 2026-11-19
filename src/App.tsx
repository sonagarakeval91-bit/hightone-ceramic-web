import React, { useState } from 'react';
import { PageId, B2BInquiryPayload } from './types';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { HomePage } from './components/pages/HomePage';
import { B2BDealersPage } from './components/pages/B2BDealersPage';
import { CollectionsPage } from './components/pages/CollectionsPage';
import { BlogPage } from './components/pages/BlogPage';
import { AboutPage } from './components/pages/AboutPage';
import { QuoteModal } from './components/QuoteModal';
import { GoogleSheetModal } from './components/GoogleSheetModal';
import { LegalModal } from './components/LegalModal';
import { FloatingWhatsApp } from './components/FloatingWhatsApp';
import { CookieConsentBanner } from './components/CookieConsentBanner';
import { DataProvider, useWebsiteData } from './context/DataContext';
import { ToastProvider, useToast } from './context/ToastContext';
import { updateDocumentSeo } from './services/seoService';
import { trackEvent, initGA4, initVisitorTracking, VisitorGeo, formatFriendlyRegion } from './services/analyticsService';

interface RouteState {
  page: PageId;
  category: string;
  blogSlug: string | null;
  isAdminOpen: boolean;
}

const ROUTE_SLUG_ALIASES: Record<string, string> = {
  onepiece: 'one-piece',
  'one-piece-closet': 'one-piece',
  'one-piece-closets': 'one-piece',
  wallhung: 'wall-hung',
  'wall-hung-closet': 'wall-hung',
  'wall-hung-closets': 'wall-hung',
  floormount: 'floor-mount',
  'floor-mount-closet': 'floor-mount',
  orissapan: 'orissa-pan',
  tabletop: 'table-top',
  'table-top-basin': 'table-top',
  'table-top-basins': 'table-top',
  'pedestal-basin': 'pedestal',
  'pedestal-basins': 'pedestal',
  urinals: 'urinal'
};

function normalizeRouteCategory(rawCat: string): string {
  const clean = (rawCat || '').split('?')[0].split('#')[0].replace(/\/+$/, '').trim().toLowerCase();
  if (!clean) return 'all';
  return ROUTE_SLUG_ALIASES[clean] || clean;
}

function parseCurrentRoute(): RouteState {
  if (typeof window === 'undefined') {
    return { page: 'home', category: 'all', blogSlug: null, isAdminOpen: false };
  }

  try {
    const rawPath = window.location.pathname.toLowerCase().replace(/\/+$/, '') || '/';
    const rawHash = (window.location.hash || '').toLowerCase();
    const hash = rawHash.replace(/^#\/?/, '#').replace(/\/+$/, '');
    const searchParams = new URLSearchParams(window.location.search);
    const colParam = searchParams.get('collection') || searchParams.get('category');
    const pageParam = searchParams.get('page') as PageId | null;
    const postParam = searchParams.get('post') || searchParams.get('slug');

    // Check for admin route directly (e.g. /admin, /admin/, #admin, #/admin)
    const isAdmin =
      rawPath === '/admin' ||
      rawPath === '/sheet' ||
      rawPath === '/admin-panel' ||
      hash === '#admin' ||
      hash === '#/admin' ||
      hash === '#sheet' ||
      pageParam === ('admin' as any) ||
      searchParams.has('admin');

    if (isAdmin) {
      return { page: 'home', category: 'all', blogSlug: null, isAdminOpen: true };
    }

    // 1. Path-based routing: /blog/:slug, /blog, /collections/:category, /collections
    if (rawPath.startsWith('/blog/')) {
      const slug = decodeURIComponent(rawPath.slice('/blog/'.length).split('/')[0] || '').trim();
      return { page: 'blog', category: 'all', blogSlug: slug || null, isAdminOpen: false };
    }

    if (rawPath === '/blog' || rawPath === '/guides' || rawPath === '/journal') {
      return {
        page: 'blog',
        category: 'all',
        blogSlug: postParam ? postParam.trim().toLowerCase() : null,
        isAdminOpen: false
      };
    }

    if (rawPath.startsWith('/collections/') || rawPath.startsWith('/collection/')) {
      const parts = rawPath.split('/');
      return { page: 'collections', category: normalizeRouteCategory(parts[2] || ''), blogSlug: null, isAdminOpen: false };
    }

    if (rawPath === '/collections' || rawPath === '/collection') {
      return {
        page: 'collections',
        category: colParam ? normalizeRouteCategory(colParam) : 'all',
        blogSlug: null,
        isAdminOpen: false
      };
    }

    if (rawPath === '/b2b' || rawPath === '/dealers' || rawPath === '/dealership') {
      return { page: 'b2b', category: 'all', blogSlug: null, isAdminOpen: false };
    }

    if (rawPath === '/about' || rawPath === '/plant' || rawPath === '/factory') {
      return { page: 'about', category: 'all', blogSlug: null, isAdminOpen: false };
    }

    // 2. Hash-based fallback: #blog/:slug, #collections/:category
    if (hash.startsWith('#blog/')) {
      const slug = decodeURIComponent(hash.slice('#blog/'.length).split('/')[0] || '').trim();
      return { page: 'blog', category: 'all', blogSlug: slug || null, isAdminOpen: isAdmin };
    }

    if (hash === '#blog' || hash === '#guides') {
      return { page: 'blog', category: 'all', blogSlug: null, isAdminOpen: isAdmin };
    }

    if (hash.startsWith('#collections/') || hash.startsWith('#collection/')) {
      const parts = hash.split('/');
      return { page: 'collections', category: normalizeRouteCategory(parts[1] || ''), blogSlug: null, isAdminOpen: isAdmin };
    }

    if (hash === '#collections' || hash === '#collection') {
      return {
        page: 'collections',
        category: colParam ? normalizeRouteCategory(colParam) : 'all',
        blogSlug: null,
        isAdminOpen: isAdmin
      };
    }

    if (
      hash === '#b2b' ||
      hash === '#dealers' ||
      hash === '#dealership' ||
      hash === '#order' ||
      hash === '#create-order' ||
      hash === '#dealer-portal' ||
      hash === '#portal' ||
      hash === '#become-dealer'
    ) {
      return { page: 'b2b', category: 'all', blogSlug: null, isAdminOpen: isAdmin };
    }

    if (hash === '#about' || hash === '#plant' || hash === '#factory') {
      return { page: 'about', category: 'all', blogSlug: null, isAdminOpen: isAdmin };
    }

    // 3. Query param fallback: ?page=...
    if (colParam) {
      return { page: 'collections', category: normalizeRouteCategory(colParam), blogSlug: null, isAdminOpen: isAdmin };
    }

    if (pageParam && ['home', 'collections', 'blog', 'b2b', 'about'].includes(pageParam)) {
      return {
        page: pageParam,
        category: colParam ? normalizeRouteCategory(colParam) : 'all',
        blogSlug: pageParam === 'blog' && postParam ? postParam.trim().toLowerCase() : null,
        isAdminOpen: isAdmin
      };
    }
  } catch (err) {
    console.error('Routing parse error:', err);
  }

  return { page: 'home', category: 'all', blogSlug: null, isAdminOpen: false };
}

function AppContent() {
  const { siteMedia } = useWebsiteData();
  const { showToast, toastInfo, toastSuccess } = useToast();
  const initialRoute = React.useMemo(() => parseCurrentRoute(), []);
  const [currentPage, setCurrentPage] = useState<PageId>(initialRoute.page);
  const [collectionCategory, setCollectionCategory] = useState<string>(initialRoute.category);
  const [blogSlug, setBlogSlug] = useState<string | null>(initialRoute.blogSlug);
  const [isQuoteOpen, setIsQuoteOpen] = useState(false);
  const [quoteProduct, setQuoteProduct] = useState('');
  const [isSheetModalOpen, setIsSheetModalOpen] = useState<boolean>(initialRoute.isAdminOpen);
  const [isLegalOpen, setIsLegalOpen] = useState(false);
  const [legalTab, setLegalTab] = useState<'privacy' | 'terms'>('privacy');

  // Sync state with browser clean URL navigation and HTML5 history
  const navigateTo = React.useCallback((page: PageId, category: string = 'all', nextBlogSlug: string | null = null) => {
    setCurrentPage(page);
    setCollectionCategory(category);
    setBlogSlug(page === 'blog' ? nextBlogSlug : null);
    if (typeof window !== 'undefined') {
      let targetPath = '/';
      if (page === 'collections') {
        targetPath = category && category !== 'all' ? `/collections/${category}` : '/collections';
      } else if (page === 'blog') {
        targetPath = nextBlogSlug ? `/blog/${encodeURIComponent(nextBlogSlug)}` : '/blog';
      } else if (page === 'b2b') {
        targetPath = '/b2b';
      } else if (page === 'about') {
        targetPath = '/about';
      } else {
        targetPath = '/';
      }
      
      if (window.location.pathname !== targetPath) {
        window.history.pushState(null, '', targetPath);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  const handleOpenAdmin = React.useCallback(() => {
    setIsSheetModalOpen(true);
    if (typeof window !== 'undefined' && window.location.pathname !== '/admin') {
      window.history.pushState(null, '', '/admin');
    }
  }, []);

  const handleCloseAdmin = React.useCallback(() => {
    setIsSheetModalOpen(false);
    if (typeof window !== 'undefined' && (window.location.pathname === '/admin' || window.location.hash === '#admin')) {
      let targetPath = '/';
      if (currentPage === 'collections') {
        targetPath = collectionCategory && collectionCategory !== 'all' ? `/collections/${collectionCategory}` : '/collections';
      } else if (currentPage === 'blog') {
        targetPath = blogSlug ? `/blog/${encodeURIComponent(blogSlug)}` : '/blog';
      } else if (currentPage === 'b2b') {
        targetPath = '/b2b';
      } else if (currentPage === 'about') {
        targetPath = '/about';
      }
      window.history.pushState(null, '', targetPath);
    }
  }, [currentPage, collectionCategory, blogSlug]);

  React.useEffect(() => {
    const handleUrlChange = () => {
      const route = parseCurrentRoute();
      setCurrentPage(route.page);
      setCollectionCategory(route.category);
      setBlogSlug(route.blogSlug);
      setIsSheetModalOpen(route.isAdminOpen);
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

    // Listen for location access granted event and display personalized greeting
    const handleLocationGranted = (event: Event) => {
      const customEvent = event as CustomEvent<VisitorGeo>;
      const geo = customEvent.detail;
      const friendlyRegion = formatFriendlyRegion(geo);

      showToast({
        tone: 'brand',
        icon: 'location',
        title: 'Location Connected',
        badge: friendlyRegion,
        message: `Thank you for connecting from ${friendlyRegion}!`,
        subtext:
          'Your regional freight estimates and nearby authorized dealer dispatch from our Thangadh factory are now personalized for your location.',
        durationMs: 7000
      });
    };

    window.addEventListener('hightone-location-granted', handleLocationGranted);

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl + Shift + S or Cmd + Shift + S opens the CMS modal for the owner
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (isSheetModalOpen) {
          handleCloseAdmin();
        } else {
          handleOpenAdmin();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('hightone-location-granted', handleLocationGranted);
    };
  }, [isSheetModalOpen, handleOpenAdmin, handleCloseAdmin, showToast]);

  // Update dynamic Head tags on top-level page changes & track silent page_view
  React.useEffect(() => {
    trackEvent('page_view', `Page: ${currentPage}`, undefined, currentPage);
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://hightoneceramic.com';

    if (currentPage === 'home') {
      updateDocumentSeo({
        title: 'Hightone Ceramic - "Part of your life!"',
        description: 'Direct ceramic sanitaryware manufacturer in Thangadh, Gujarat. High-performance ceramic, one-piece closets, wall-hung suites, and table top basins for wholesale dealers.',
        keywords: 'Hightone Ceramic, sanitaryware manufacturer Thangadh, ceramic sanitaryware Gujarat, one piece closet manufacturer, wall hung basin wholesale, table top wash basin factory, orissa pan supplier, ceramic sanitaryware B2B India',
        url: `${origin}/`
      });
    } else if (currentPage === 'b2b') {
      updateDocumentSeo({
        title: 'B2B Dealership & Project Supply | Hightone Ceramic Thangadh',
        description: 'Partner directly with Hightone Ceramic for authorized distributorships, OEM contract manufacturing, container export, and direct full-truckload dispatch.',
        keywords: 'sanitaryware dealership, ceramic factory direct, b2b sanitaryware distribution, thangadh direct truckload supply, vitrified ceramic OEM',
        url: `${origin}/b2b`
      });
    } else if (currentPage === 'about') {
      updateDocumentSeo({
        title: 'About Hightone Ceramic | State-of-the-Art Ceramic Plant in Thangadh',
        description: 'Learn about Hightone Ceramic\'s automated manufacturing infrastructure in Thangadh, Gujarat: 120-meter tunnel kilns, nano-glaze glazing robots, and strict ISO testing.',
        keywords: 'Hightone Ceramic plant, sanitaryware manufacturing facility, thangadh ceramic cluster, vitrified sanitaryware testing, tunnel kiln sanitaryware',
        url: `${origin}/about`
      });
    } else if (currentPage === 'collections') {
      const colUrl = collectionCategory && collectionCategory !== 'all'
        ? `${origin}/collections/${collectionCategory}`
        : `${origin}/collections`;
      updateDocumentSeo({
        url: colUrl
      });
    }
  }, [currentPage, collectionCategory]);

  const handleOpenQuote = (initialInterest?: string) => {
    trackEvent('quote_open', initialInterest || 'Catalog Quote');
    setQuoteProduct(initialInterest || '');
    setIsQuoteOpen(true);
  };

  const handleQuoteSubmitted = (payload: B2BInquiryPayload) => {
    trackEvent(
      'quote_submit',
      payload.productInterest || 'General Inquiry',
      `Firm: ${payload.businessName}, City: ${payload.cityState}`
    );
    showToast({
      tone: 'brand',
      title: 'Inquiry Dispatched',
      message: `Inquiry for "${payload.businessName}" submitted directly to Thangadh desk.`,
      subtext: 'Our factory sales desk will contact you with wholesale pricing and direct truckload dispatch schedules.',
      durationMs: 6000
    });
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

        {currentPage === 'blog' && (
          <BlogPage
            activeSlug={blogSlug}
            onSelectPost={(slug) => navigateTo('blog', 'all', slug)}
            onNavigate={(page, category) => navigateTo(page, category)}
            onOpenQuote={handleOpenQuote}
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
        onOpenSheetModal={handleOpenAdmin}
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
        onClose={handleCloseAdmin}
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
            toastSuccess('Regional dispatch & analytics insights enabled.', 'Preferences Saved');
          } else {
            trackEvent('cookie_consent', 'Essential Only', 'Visitor selected essential cookies only');
            toastInfo('Essential session cookies active only.', 'Preferences Saved');
          }
        }}
      />

    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <DataProvider>
        <AppContent />
      </DataProvider>
    </ToastProvider>
  );
}
