import React from 'react';
import { PageId, CategoryMeta } from '../../types';
import { useWebsiteData } from '../../context/DataContext';
import { CATEGORIES_META, buildMergedCategoriesList } from './CollectionsPage';
import { normalizeCategory, normalizeImageUrl } from '../../services/googleSheetsService';
import { sanitizePhoneForTel, sanitizePhoneForWhatsApp } from '../../utils/phone';
import { 
  PhoneCall, 
  ArrowRight, 
  Flame, 
  Droplet, 
  Building2, 
  Truck, 
  ShieldCheck, 
  Check, 
  MessageSquare, 
  ExternalLink, 
  ChevronRight, 
  Sparkles 
} from 'lucide-react';

interface HomePageProps {
  onNavigate: (page: PageId) => void;
  onOpenQuote: (productInterest?: string) => void;
  onSelectCollectionCategory?: (category: string) => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  onNavigate,
  onOpenQuote,
  onSelectCollectionCategory
}) => {
  const { products, siteMedia, collectionsMeta, companyInfo } = useWebsiteData();

  // Build full dynamic categories list from Google Sheet (supporting 7, 9, 12+ collections)
  const categoriesList: CategoryMeta[] = buildMergedCategoriesList(collectionsMeta, siteMedia, products);

  // Select which 8 collections to show on HomePage:
  // 1. If user flagged specific collections with home: TRUE (showOnHome: true), prioritize them and sort by homeOrder/order.
  // 2. Otherwise take the first 8 collections sorted by homeOrder/order.
  const explicitlyChosenForHome = categoriesList
    .filter((c) => c.showOnHome === true)
    .sort((a, b) => {
      const orderA = a.homeOrder ?? a.order ?? 999;
      const orderB = b.homeOrder ?? b.order ?? 999;
      return orderA - orderB;
    });

  let homeCategories: CategoryMeta[] = [];
  if (explicitlyChosenForHome.length > 0) {
    const remaining = categoriesList
      .filter((c) => c.showOnHome !== true)
      .sort((a, b) => {
        const orderA = a.homeOrder ?? a.order ?? 999;
        const orderB = b.homeOrder ?? b.order ?? 999;
        return orderA - orderB;
      });
    homeCategories = [...explicitlyChosenForHome, ...remaining].slice(0, 8);
  } else {
    homeCategories = [...categoriesList]
      .sort((a, b) => {
        const orderA = a.homeOrder ?? a.order ?? 999;
        const orderB = b.homeOrder ?? b.order ?? 999;
        return orderA - orderB;
      })
      .slice(0, 8);
  }

  return (
    <div className="space-y-16 sm:space-y-24 pb-12">
      
      {/* 1. HERO SECTION */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10">
        
        {/* Top Status Bar Tag */}
        <div className="inline-flex items-center space-x-2 px-3 py-1 bg-white/85 backdrop-blur-md border border-slate-200/90 rounded-full text-xs font-semibold text-[#0F2E52] mb-6 shadow-2xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
          <span className="tracking-wide uppercase text-[11px]">
            HIGHTONE CERAMIC PRODUCTION • THANGADH, GUJARAT
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
          
          {/* Left Column: Headline, Copy, Action */}
          <div className="lg:col-span-7 space-y-6">
            
            <div>
              <h1 className="font-display text-4xl sm:text-5xl lg:text-[3.5rem] font-bold tracking-[-0.03em] text-[#0F2E52] leading-[1.1]">
                The Future of Sanitation is Here
              </h1>
              <p className="font-display text-lg sm:text-xl font-bold tracking-tight text-[#1e3a5f] uppercase mt-2">
                PART OF YOUR LIFE!!
              </p>
            </div>

            <p className="text-sm sm:text-base text-[#515f74] leading-relaxed max-w-2xl">
              Sanitaryware manufactured in Thangadh, Gujarat, engineered for modern architectural spaces, homes, and commercial developments. Non-porous nano glazes, rigorous water conservation flushing, and approx. 100%<sup className="text-[10px] font-normal align-super text-slate-400 select-none ml-0.5">*</sup> factory inspection.
            </p>

            {/* Hero CTA Button */}
            <div className="pt-2">
              <a
                href={sanitizePhoneForTel(companyInfo.primary_phone)}
                className="inline-flex items-center space-x-2.5 px-6 py-3.5 bg-[#0F2E52] hover:bg-[#1e3a5f] text-white text-sm font-semibold rounded-[3px] border border-[#0F2E52] transition-colors focus:outline-none focus:ring-2 focus:ring-[#0F2E52] focus:ring-offset-2"
              >
                <PhoneCall className="w-4 h-4" />
                <span>Call Us</span>
              </a>
            </div>

            {/* Metrics Row */}
            <div className="grid grid-cols-3 gap-4 pt-6 border-t border-[#e2e8f0]">
              <div className="space-y-0.5">
                <span className="block font-display text-xl sm:text-2xl lg:text-3xl font-bold text-[#0F2E52]">
                  Approx. 1,200°C
                </span>
                <span className="block text-[11px] font-bold uppercase tracking-wider text-[#64748b]">
                  TUNNEL FIRING
                </span>
              </div>

              <div className="space-y-0.5">
                <span className="block font-display text-2xl sm:text-3xl font-bold text-[#0F2E52]">
                  100%<sup className="text-xs sm:text-sm font-normal align-super text-slate-400 select-none ml-0.5">*</sup>
                </span>
                <span className="block text-[11px] font-bold uppercase tracking-wider text-[#64748b]">
                  FLOW TESTED<sup className="text-[9px] font-normal align-super text-slate-400 select-none ml-0.5">*</sup>
                </span>
              </div>

              <div className="space-y-0.5">
                <span className="block font-display text-2xl sm:text-3xl font-bold text-[#0F2E52]">
                  Direct
                </span>
                <span className="block text-[11px] font-bold uppercase tracking-wider text-[#64748b]">
                  PLANT PRICING
                </span>
              </div>
            </div>

          </div>

          {/* Right Column: High Quality Ceramic Showcase Card */}
          <div className="lg:col-span-5">
            <div className="relative rounded-[4px] overflow-hidden border border-[#cbd5e1] shadow-lg bg-[#001936] aspect-4/3 sm:aspect-square flex flex-col justify-end">
              
              {/* Background Image of high-end ceramic bathroom */}
              <img
                src={siteMedia.hero_lifestyle}
                alt="Hightone Ceramic Luxury Bathroom"
                className="absolute inset-0 w-full h-full object-cover opacity-85 hover:scale-102 transition-transform duration-700"
              />

              {/* Gradient Scrim */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#001936] via-[#001936]/40 to-transparent" />

              {/* Overlay Glass/Card Details with Frosted Glass Effect */}
              <div className="relative z-10 p-4 sm:p-6 space-y-2.5">
                <div className="bg-white/15 hover:bg-white/20 backdrop-blur-md p-4 rounded-xl border border-white/30 space-y-1.5 shadow-lg transition-all">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-300 shrink-0 shadow-[0_0_6px_rgba(103,232,249,0.9)]" />
                    <span className="text-[10px] font-sans uppercase tracking-widest text-cyan-300 font-bold block">
                      CRAFTSMANSHIP AT THANGADH
                    </span>
                  </div>
                  <h3 className="font-display text-base sm:text-lg font-bold text-white leading-tight">
                    Ceramic Engineering &amp; Precision Glaze
                  </h3>
                  <p className="text-xs text-slate-200">
                    Pure White &amp; Matte Luxury Series
                  </p>
                </div>

                {/* Bottom Trust Badge with Frosted Glass Effect */}
                <div className="bg-white/15 hover:bg-white/20 backdrop-blur-md p-3 rounded-xl border border-white/30 flex items-center space-x-3 text-xs shadow-lg transition-all">
                  <div className="p-1.5 rounded-full bg-white/20 border border-white/30 shrink-0">
                    <ShieldCheck className="w-4 h-4 text-cyan-300 shrink-0" />
                  </div>
                  <div>
                    <span className="font-bold text-white block uppercase tracking-wider text-[11px]">
                      ZERO-POROSITY CERAMIC
                    </span>
                    <span className="text-slate-200 text-[10px]">
                      Gujarat Ceramic Cluster Hub
                    </span>
                  </div>
                </div>
              </div>

            </div>
          </div>

        </div>

      </section>


      {/* 2. CORE SANITARYWARE COLLECTIONS DIRECTORY */}
      <section className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        
        {/* Section Heading & Explore Link */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-6 pb-3 border-b border-[#e2e8f0]">
          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#64748b] block">
              COLLECTION CATEGORIES ({categoriesList.length})
            </span>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#0F2E52]">
              Sanitaryware Collections
            </h2>
            <p className="text-xs sm:text-sm text-[#515f74] max-w-2xl">
              Manufactured with high-purity ceramic slip and nano-coat glaze. Select any collection to view models and direct factory pricing.
            </p>
          </div>

          <button
            onClick={() => {
              onNavigate('collections');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="mt-3 md:mt-0 inline-flex items-center space-x-1.5 text-xs sm:text-sm font-semibold text-[#0F2E52] hover:text-[#1e3a5f] group cursor-pointer focus:outline-none"
          >
            <span>View All Collections</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        {/* Collection Cards Grid: 2 columns on mobile (medium/small squares), 3 columns on tablet/desktop */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-3 sm:gap-6">
          {homeCategories.map((cat) => {
            const count = products.filter((p) => {
              const pCat = normalizeCategory(p.category);
              const curCat = normalizeCategory(cat.id);
              return pCat === curCat || p.category.trim().toLowerCase() === cat.id.trim().toLowerCase();
            }).length;
            const handleCardClick = () => {
              if (onSelectCollectionCategory) {
                onSelectCollectionCategory(cat.id);
              } else {
                onNavigate('collections');
              }
              window.scrollTo({ top: 0, behavior: 'smooth' });
            };

            return (
              <div
                key={cat.id}
                className="bg-white border border-[#cbd5e1] hover:border-[#0F2E52] rounded-[4px] overflow-hidden flex flex-col justify-between shadow-2xs hover:shadow-md transition-all duration-300 group cursor-pointer"
                onClick={handleCardClick}
              >
                <div>
                  {/* Photo Area: Edge-to-edge cover in square without letterbox lines */}
                  <div className="relative aspect-4/3 sm:aspect-16/10 bg-[#f1f5f9] overflow-hidden">
                    <img
                      src={normalizeImageUrl(cat.coverImage)}
                      alt={cat.title}
                      referrerPolicy="no-referrer"
                      onError={(e) => {
                        const match = CATEGORIES_META.find(
                          (c) =>
                            c.id === cat.id ||
                            normalizeCategory(c.id) === normalizeCategory(cat.id) ||
                            normalizeCategory(c.title) === normalizeCategory(cat.title)
                        );
                        const defaultImg = match?.coverImage || 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=800&q=80';
                        if (e.currentTarget.src !== defaultImg) {
                          e.currentTarget.src = defaultImg;
                        }
                      }}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#001936]/60 via-transparent to-transparent opacity-60 pointer-events-none" />

                    {/* Tag Badge with Frosted Glass Effect (Image 1 Style) */}
                    <div className="absolute top-1.5 left-1.5 sm:top-2.5 sm:left-2.5 z-30 max-w-[calc(100%-8px)]">
                      <span className="inline-flex items-center gap-1 sm:gap-1.5 px-2 py-0.5 sm:px-3 sm:py-1 rounded-full bg-white/25 hover:bg-white/35 backdrop-blur-md text-white text-[7px] min-[360px]:text-[7.5px] sm:text-[10px] font-sans font-semibold tracking-tight sm:tracking-wider uppercase border border-white/40 shadow-sm transition-all whitespace-nowrap">
                        <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-cyan-300 shrink-0 shadow-[0_0_5px_rgba(103,232,249,0.9)]" />
                        <span className="whitespace-nowrap">{cat.tagBadge}</span>
                      </span>
                    </div>

                    {/* Model Count Badge with Frosted Glass Effect */}
                    <div className="absolute bottom-2 right-2 sm:bottom-3 sm:right-3 z-30">
                      <span className="inline-flex items-center px-2 py-0.5 sm:px-2.5 sm:py-0.5 rounded-full bg-black/40 hover:bg-black/55 backdrop-blur-md text-white text-[8.5px] sm:text-[10px] font-sans font-medium border border-white/25 shadow-xs transition-all">
                        {count > 0 ? `${count} ${count === 1 ? 'Model' : 'Models'}` : 'Catalog Ready'}
                      </span>
                    </div>
                  </div>

                  {/* Content Body */}
                  <div className="p-3 sm:p-5 space-y-1.5 sm:space-y-2">
                    <h3 className="font-display text-xs sm:text-base lg:text-lg font-bold text-[#0F2E52] group-hover:text-[#1e3a5f] transition-colors leading-snug line-clamp-2">
                      {cat.title}
                    </h3>
                    
                    <p className="text-[10px] sm:text-xs text-[#515f74] line-clamp-1 sm:line-clamp-2 leading-relaxed">
                      {cat.subtitle}
                    </p>
                  </div>
                </div>

                {/* Bottom Card Action: Direct View Collection button */}
                <div className="p-3 sm:p-5 pt-0 mt-1 sm:mt-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCardClick();
                    }}
                    className="w-full py-1.5 sm:py-2 px-2 sm:px-3 bg-[#f8fafc] group-hover:bg-[#0F2E52] text-[#0F2E52] group-hover:text-white border border-[#cbd5e1] group-hover:border-[#0F2E52] rounded-[3px] text-[10px] sm:text-xs font-bold transition-all flex items-center justify-center space-x-1 sm:space-x-1.5 cursor-pointer"
                  >
                    <span className="truncate">
                      {cat.shortLabel.trim().toLowerCase().startsWith('view')
                        ? cat.shortLabel.trim()
                        : `View ${cat.shortLabel.trim()}`}
                    </span>
                    <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform shrink-0" />
                  </button>
                </div>

              </div>
            );
          })}

          {/* 9th Grid Slot: Explore Our All Collections Card */}
          <div
            onClick={() => {
              onNavigate('collections');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="bg-gradient-to-br from-[#0F2E52] via-[#001936] to-[#071324] text-white border border-[#0F2E52] rounded-[4px] p-4 sm:p-6 flex flex-col justify-between space-y-4 shadow-sm hover:shadow-xl hover:border-cyan-400 transition-all duration-300 group cursor-pointer relative overflow-hidden col-span-2 sm:col-span-1"
          >
            {/* Ambient decorative glow */}
            <div className="absolute -top-12 -right-12 w-40 h-40 bg-cyan-500/15 rounded-full blur-2xl pointer-events-none group-hover:bg-cyan-500/25 transition-all duration-500" />

            <div className="space-y-3 relative z-10">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur-md text-white text-[10px] sm:text-[11px] font-sans font-semibold tracking-wider uppercase border border-white/30 shadow-sm transition-all">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-300 shrink-0 shadow-[0_0_6px_rgba(103,232,249,0.9)]" />
                  <span>ALL COLLECTIONS ({categoriesList.length})</span>
                </span>
                <div className="w-7 h-7 rounded-full bg-white/15 hover:bg-white/30 backdrop-blur-md border border-white/30 flex items-center justify-center transition-all shadow-sm">
                  <ArrowRight className="w-3.5 h-3.5 text-cyan-300 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>

              <h3 className="font-display text-base sm:text-xl font-bold leading-tight text-white group-hover:text-cyan-100 transition-colors">
                Explore Our All Collections
              </h3>

              <p className="text-[11px] sm:text-xs text-slate-300 leading-relaxed">
                Browse our complete vitrified sanitaryware catalog across all {categoriesList.length} collections with full technical dimensions and factory pricing.
              </p>
            </div>

            <div className="pt-3 relative z-10">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigate('collections');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="w-full py-2.5 px-3 bg-white hover:bg-cyan-50 text-[#001936] text-xs font-bold rounded-[3px] transition-all flex items-center justify-center space-x-1.5 shadow-xs group-hover:shadow-md cursor-pointer"
              >
                <span>Explore All {categoriesList.length} Collections</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>

        </div>

      </section>


      {/* 3. ENGINEERING EXCELLENCE SECTION (Manufacturing & Quality Pillars) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="text-center max-w-3xl mx-auto mb-12 space-y-2">
          <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#64748b]">
            ENGINEERING EXCELLENCE
          </span>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#0F2E52]">
            Manufacturing &amp; Quality Pillars
          </h2>
          <p className="text-xs sm:text-sm text-[#515f74] leading-relaxed">
            From the ceramic capital of Thangadh, our facilities adhere to stringent thermal, acoustic, and pressure testing cycles to deliver zero-defect ceramic sanitaryware.
          </p>
        </div>

        {/* 4 Pillars Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          
          {/* Pillar 1 */}
          <div className="bg-white border border-[#e2e8f0] p-6 rounded-[3px] flex flex-col justify-between space-y-4 hover:border-[#0F2E52] transition-colors">
            <div className="space-y-3">
              <div className="w-10 h-10 bg-[#f2f4f6] border border-[#e2e8f0] rounded-[3px] flex items-center justify-center text-[#0F2E52]">
                <Flame className="w-5 h-5 text-amber-600" />
              </div>
              <h3 className="font-display font-bold text-base text-[#0F2E52]">
                Approx. 1,200°C Tunnel Kiln
              </h3>
              <p className="text-xs text-[#515f74] leading-relaxed">
                High-temperature continuous tunnel kiln firing at approx. 1,200°C creates high-density sintering, yielding zero-porosity finishes resistant to bacterial absorption and permanent discoloration.
              </p>
            </div>
            <div className="pt-2 border-t border-[#f1f5f9] text-[10px] font-mono text-[#64748b]">
              Spec: Zero Glaze Crazing
            </div>
          </div>

          {/* Pillar 2 */}
          <div className="bg-white border border-[#e2e8f0] p-6 rounded-[3px] flex flex-col justify-between space-y-4 hover:border-[#0F2E52] transition-colors">
            <div className="space-y-3">
              <div className="w-10 h-10 bg-[#f2f4f6] border border-[#e2e8f0] rounded-[3px] flex items-center justify-center text-[#0F2E52]">
                <Droplet className="w-5 h-5 text-cyan-600" />
              </div>
              <h3 className="font-display font-bold text-base text-[#0F2E52]">
                100%<sup className="text-[10px] font-normal align-super text-slate-400 select-none ml-0.5">*</sup> Flow &amp; Acoustic Test
              </h3>
              <p className="text-xs text-[#515f74] leading-relaxed">
                Every closet undergoes hydrostatic flush simulation, ball vacuum discharge tests, and manual sonic acoustic hammer inspection prior to packaging.
              </p>
            </div>
            <div className="pt-2 border-t border-[#f1f5f9] text-[10px] font-mono text-[#64748b]">
              Spec: Approx. 100%<sup className="text-[8px] font-normal align-super text-slate-400 select-none ml-0.5">*</sup> Individual Checks
            </div>
          </div>

          {/* Pillar 3 */}
          <div className="bg-white border border-[#e2e8f0] p-6 rounded-[3px] flex flex-col justify-between space-y-4 hover:border-[#0F2E52] transition-colors">
            <div className="space-y-3">
              <div className="w-10 h-10 bg-[#f2f4f6] border border-[#e2e8f0] rounded-[3px] flex items-center justify-center text-[#0F2E52]">
                <Building2 className="w-5 h-5 text-[#0F2E52]" />
              </div>
              <h3 className="font-display font-bold text-base text-[#0F2E52]">
                Plant-Direct Pricing
              </h3>
              <p className="text-xs text-[#515f74] leading-relaxed">
                Thangadh plant-direct sourcing eliminates intermediaries, enabling regional stockists and commercial developers to obtain premium ceramics with exceptional trade margins.
              </p>
            </div>
            <div className="pt-2 border-t border-[#f1f5f9] text-[10px] font-mono text-[#64748b]">
              Spec: Factory-Direct Bill of Supply
            </div>
          </div>

          {/* Pillar 4 */}
          <div className="bg-white border border-[#e2e8f0] p-6 rounded-[3px] flex flex-col justify-between space-y-4 hover:border-[#0F2E52] transition-colors">
            <div className="space-y-3">
              <div className="w-10 h-10 bg-[#f2f4f6] border border-[#e2e8f0] rounded-[3px] flex items-center justify-center text-[#0F2E52]">
                <Truck className="w-5 h-5 text-emerald-600" />
              </div>
              <h3 className="font-display font-bold text-base text-[#0F2E52]">
                Thangadh Plant Dispatch
              </h3>
              <p className="text-xs text-[#515f74] leading-relaxed">
                Direct dispatch from our Gujarat manufacturing unit with organized truckload freight coordination across regional commercial dealer hubs.
              </p>
            </div>
            <div className="pt-2 border-t border-[#f1f5f9] text-[10px] font-mono text-[#64748b]">
              Spec: Direct Highway Corridor Dispatch
            </div>
          </div>

        </div>

      </section>


      {/* 4. PARTNERSHIP PROGRAM • GUJARAT CERAMIC BELT */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white border border-[#e2e8f0] rounded-[4px] p-6 sm:p-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            
            <div className="lg:col-span-7 space-y-4">
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#64748b] font-semibold block">
                PARTNERSHIP PROGRAM • GUJARAT CERAMIC BELT
              </span>

              <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#0F2E52]">
                Wholesale Dealerships
              </h2>

              <p className="text-xs sm:text-sm text-[#515f74] leading-relaxed">
                We invite building materials stockists, regional distributors, and large-scale residential contractors to connect directly with our Thangadh facility. Benefit from guaranteed dispatch schedules, competitive dealer trade slabs, and direct plant accountability.
              </p>

              <div className="flex flex-wrap gap-4 pt-2 text-xs font-semibold text-[#0F2E52]">
                <div className="flex items-center space-x-1.5">
                  <Truck className="w-4 h-4 text-emerald-600" />
                  <span>Consolidated Trucks</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <Building2 className="w-4 h-4 text-[#0F2E52]" />
                  <span>Direct Plant Invoicing</span>
                </div>
                <div className="flex items-center space-x-1.5">
                  <PhoneCall className="w-4 h-4 text-cyan-600" />
                  <span>Dedicated Dispatch Desk</span>
                </div>
              </div>
            </div>

            {/* Immediate Plant Desk Card */}
            <div className="lg:col-span-5 bg-[#f8fafc] border border-[#cbd5e1] p-6 rounded-[3px] space-y-4">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#64748b] font-bold block">
                  IMMEDIATE PLANT DESK
                </span>
                <p className="text-xs text-[#334155] mt-1 leading-relaxed">
                  Connect directly with factory sales managers for current price lists and stock ready for dispatch.
                </p>
              </div>

              <div className="space-y-2.5">
                <a
                  href={`https://wa.me/${sanitizePhoneForWhatsApp(companyInfo.primary_phone)}?text=${encodeURIComponent('Hello Hightone Ceramic, we are interested in becoming a dealer/stockist for sanitaryware.')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2.5 px-4 bg-[#25D366] hover:bg-[#20ba59] text-white text-xs font-bold rounded-[3px] flex items-center justify-center space-x-2 transition-colors"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>WhatsApp Inquiry</span>
                </a>

                <a
                  href={sanitizePhoneForTel(companyInfo.primary_phone)}
                  className="w-full py-2.5 px-4 bg-[#0F2E52] hover:bg-[#1e3a5f] text-white text-xs font-bold rounded-[3px] flex items-center justify-center space-x-2 transition-colors"
                >
                  <PhoneCall className="w-4 h-4" />
                  <span>Call Us</span>
                </a>
              </div>
            </div>

          </div>
        </div>
      </section>


      {/* 5. PRE-FOOTER FULL CTA BAR */}
      <section className="bg-[#001936] text-white py-12 px-4 sm:px-6 lg:px-8 border-y border-[#0F2E52]">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-3 text-center md:text-left">
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-white/15 backdrop-blur-md border border-white/25 text-white text-[10px] sm:text-[11px] font-sans font-semibold tracking-wider uppercase shadow-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-300 shrink-0 shadow-[0_0_6px_rgba(103,232,249,0.9)]" />
              <span>VAGADIYA ROAD, THANGADH PLANT</span>
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold">
              Direct Ceramic Orders &amp; Dealer Inquiries
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
              Contact our Thangadh factory directly for wholesale dealer supply, bulk dispatches, and full model range inquiries via WhatsApp or phone.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
            <a
              href={`https://wa.me/${sanitizePhoneForWhatsApp(companyInfo.primary_phone)}?text=${encodeURIComponent('Hello Hightone Ceramic, requesting wholesale dealer price list.')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto px-5 py-3 bg-[#25D366] hover:bg-[#20ba59] text-white text-xs font-bold rounded-[3px] flex items-center justify-center space-x-2 transition-colors"
            >
              <MessageSquare className="w-4 h-4" />
              <span>WhatsApp Inquiry</span>
            </a>

            <a
              href={sanitizePhoneForTel(companyInfo.primary_phone)}
              className="w-full sm:w-auto px-5 py-3 bg-white hover:bg-slate-100 text-[#001936] text-xs font-bold rounded-[3px] flex items-center justify-center space-x-2 transition-colors"
            >
              <PhoneCall className="w-4 h-4" />
              <span>Call Us</span>
            </a>
          </div>
        </div>
      </section>

    </div>
  );
};
