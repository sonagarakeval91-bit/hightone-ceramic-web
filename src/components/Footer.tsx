import React, { useState, useEffect } from 'react';
import { PageId } from '../types';
import { useWebsiteData } from '../context/DataContext';
import { cleanGoogleMapsEmbedUrl, getGoogleMapsDirectionsUrl, DEFAULT_COMPANY_INFO } from '../services/googleSheetsService';
import { HightoneBrandLogo } from './brand/HightoneBrandLogo';
import { ShieldCheck, Mail, MapPin, Phone, CheckCircle2, ExternalLink, Navigation } from 'lucide-react';
import { sanitizePhoneForTel, sanitizePhoneForWhatsApp } from '../utils/phone';

interface FooterProps {
  onNavigate: (page: PageId, category?: string) => void;
  onOpenQuote: () => void;
  onOpenSheetModal: () => void;
  onOpenLegal: (tab: 'privacy' | 'terms') => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate, onOpenQuote, onOpenSheetModal, onOpenLegal }) => {
  const { sheetId, isSyncing, companyInfo, siteMedia, inquiries } = useWebsiteData();
  const [htcClicks, setHtcClicks] = useState(0);
  const clickTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleHtcBadgeClick = () => {
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
    }

    const nextClicks = htcClicks + 1;
    if (nextClicks >= 5) {
      setHtcClicks(0);
      onOpenSheetModal();
    } else {
      setHtcClicks(nextClicks);
      clickTimerRef.current = setTimeout(() => {
        setHtcClicks(0);
      }, 3500);
    }
  };
  return (
    <footer className="bg-white border-t border-[#e2e8f0] pt-14 pb-8 text-[#515f74]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Main Footer Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8 pb-12">
          
          {/* Column 1: Brand & Origin (4 cols on lg) */}
          <div className="lg:col-span-4 space-y-4">
            {/* Stacked Brand Logo Image (HIGHTONE_CAT-43) */}
            <div className="w-full max-w-[400px] pb-2">
              {siteMedia?.logo_stacked ? (
                <img
                  src={siteMedia.logo_stacked}
                  alt="Hightone Ceramic - Part Of Your Life"
                  className="w-full max-w-[380px] h-auto object-contain object-left"
                />
              ) : siteMedia?.logo ? (
                <img
                  src={siteMedia.logo}
                  alt="Hightone Ceramic Logo"
                  className="w-full max-w-[340px] h-auto object-contain object-left"
                />
              ) : (
                <HightoneBrandLogo variant="stacked" className="w-full max-w-[380px] h-auto" />
              )}
            </div>

            <p className="text-xs text-[#64748b] leading-relaxed max-w-sm">
              Manufactured with high-purity Gujarat clay and nano-ceramic glaze in Thangadh. Supplying verified sanitaryware shipments to dealers, builders, and export clients.
            </p>

            {/* MAKE IN INDIA badge */}
            <div className="pt-2">
              <div className="inline-flex items-center space-x-2 px-3 py-1.5 border border-[#cbd5e1] rounded-[3px] bg-[#f8fafc] text-xs font-semibold text-[#0F2E52] uppercase tracking-wider">
                <ShieldCheck className="w-4 h-4 text-[#0F2E52]" />
                <span>MAKE IN INDIA</span>
              </div>
            </div>
          </div>

          {/* Column 2: Quick Links (2 cols on lg) */}
          <div className="lg:col-span-2 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-[0.1em] text-[#0F2E52]">
              QUICK LINKS
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button
                  onClick={() => { onNavigate('home'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  className="hover:text-[#0F2E52] hover:underline cursor-pointer transition-colors"
                >
                  Home &amp; Factory
                </button>
              </li>
              <li>
                <button
                  onClick={() => { onNavigate('collections'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  className="hover:text-[#0F2E52] hover:underline cursor-pointer transition-colors"
                >
                  Collections
                </button>
              </li>
              <li>
                <button
                  onClick={() => { onNavigate('b2b'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  className="hover:text-[#0F2E52] hover:underline cursor-pointer transition-colors"
                >
                  B2B Wholesale
                </button>
              </li>
              <li>
                <button
                  onClick={() => { onNavigate('about'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  className="hover:text-[#0F2E52] hover:underline cursor-pointer transition-colors"
                >
                  About Plant
                </button>
              </li>
              <li>
                <button
                  onClick={onOpenQuote}
                  className="hover:text-[#0F2E52] hover:underline cursor-pointer transition-colors font-medium text-[#0F2E52]"
                >
                  Request Quote
                </button>
              </li>
              <li>
                <button
                  onClick={() => onOpenLegal('privacy')}
                  className="hover:text-[#0F2E52] hover:underline cursor-pointer transition-colors text-slate-500"
                >
                  Privacy Policy
                </button>
              </li>
              <li>
                <button
                  onClick={() => onOpenLegal('terms')}
                  className="hover:text-[#0F2E52] hover:underline cursor-pointer transition-colors text-slate-500"
                >
                  Terms &amp; Conditions
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => {
                    if (typeof window !== 'undefined') {
                      window.dispatchEvent(new CustomEvent('open-cookie-preferences'));
                    }
                  }}
                  className="hover:text-[#0F2E52] hover:underline cursor-pointer transition-colors text-slate-500"
                >
                  Cookie Preferences
                </button>
              </li>
            </ul>
          </div>

          {/* Column 3: Contact & Desk (3 cols on lg) */}
          <div className="lg:col-span-3 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-[0.1em] text-[#0F2E52]">
              CONTACT DESK
            </h4>

            <div className="space-y-3 text-xs leading-relaxed">
              <div>
                <span className="font-semibold text-[#0F2E52] block uppercase tracking-wide text-[11px]">
                  LOCATION:
                </span>
                <span className="text-[#515f74]">
                  {companyInfo.factory_address || DEFAULT_COMPANY_INFO.factory_address}
                </span>
              </div>

              <div>
                <span className="font-semibold text-[#0F2E52] block uppercase tracking-wide text-[11px]">
                  EMAIL:
                </span>
                <a
                  href="mailto:hightoneceramic@gmail.com"
                  className="text-[#515f74] hover:text-[#0F2E52] hover:underline"
                >
                  hightoneceramic@gmail.com
                </a>
              </div>

              <div>
                <span className="font-semibold text-[#0F2E52] block uppercase tracking-wide text-[11px]">
                  PHONE &amp; WHATSAPP:
                </span>
                <div className="space-y-2 pt-1">
                  <div className="flex items-center space-x-2">
                    <a
                      href={sanitizePhoneForTel(companyInfo.primary_phone)}
                      className="text-[#0F2E52] font-bold hover:underline"
                    >
                      {companyInfo.primary_phone}
                    </a>
                    <a
                      href={`https://wa.me/${sanitizePhoneForWhatsApp(companyInfo.primary_phone)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-700 bg-emerald-50 text-[10px] px-1.5 py-0.5 rounded-[2px] font-semibold border border-emerald-200 hover:bg-emerald-100"
                    >
                      WhatsApp
                    </a>
                  </div>

                  {companyInfo.secondary_phone && (
                    <div className="flex items-center space-x-2">
                      <a
                        href={sanitizePhoneForTel(companyInfo.secondary_phone)}
                        className="text-[#0F2E52] font-bold hover:underline"
                      >
                        {companyInfo.secondary_phone}
                      </a>
                      <a
                        href={`https://wa.me/${sanitizePhoneForWhatsApp(companyInfo.secondary_phone)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-700 bg-emerald-50 text-[10px] px-1.5 py-0.5 rounded-[2px] font-semibold border border-emerald-200 hover:bg-emerald-100"
                      >
                        WhatsApp
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Column 4: Factory Location & Embedded Google Map (3 cols on lg) */}
          <div className="lg:col-span-3 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-[0.1em] text-[#0F2E52] flex items-center space-x-1.5">
              <MapPin className="w-3.5 h-3.5 text-[#0F2E52]" />
              <span>FACTORY LOCATION</span>
            </h4>

            <div className="rounded-[4px] overflow-hidden border border-[#cbd5e1] shadow-2xs bg-[#f8fafc]">
              <iframe
                title="Hightone Ceramic Thangadh Factory Location"
                src={cleanGoogleMapsEmbedUrl(companyInfo.google_maps_embed_url) || DEFAULT_COMPANY_INFO.google_maps_embed_url}
                className="w-full h-36 sm:h-32 border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
              />
              <div className="p-2.5 bg-white border-t border-[#e2e8f0] flex items-center justify-between gap-1 text-xs">
                <div className="flex items-center space-x-1.5 text-[#0F2E52] font-medium text-[11px] truncate">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  <span className="truncate font-semibold">Hightone Plant</span>
                </div>
                <div className="flex items-center space-x-1 shrink-0">
                  <a
                    href={getGoogleMapsDirectionsUrl(companyInfo)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#0F2E52] hover:text-[#1e3a5f] font-bold text-[10px] inline-flex items-center space-x-1 bg-[#f1f5f9] hover:bg-[#e2e8f0] px-1.5 py-0.5 rounded-[2px] border border-slate-200 transition-colors"
                    title="Get directions to Hightone Ceramic"
                  >
                    <span>Maps</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                  <a
                    href={getGoogleMapsDirectionsUrl(companyInfo)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white bg-[#0F2E52] hover:bg-[#1e3a5f] font-bold text-[10px] inline-flex items-center space-x-1 px-1.5 py-0.5 rounded-[2px] transition-colors shadow-2xs"
                    title="Get driving directions to Hightone Ceramic"
                  >
                    <Navigation className="w-2.5 h-2.5" />
                    <span>Route</span>
                  </a>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-[#64748b] leading-tight">
              {companyInfo.factory_address || 'Vagadiya Road, Thangadh - 363 530 (Dist. Surendranagar, Gujarat)'}
            </p>
          </div>

        </div>

        {/* Bottom Sub-bar */}
        <div className="border-t border-[#e2e8f0] pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-[#64748b]">
          <div className="flex items-center space-x-2.5">
            {/* HTC Box (Secret 5-click entry: looks like a static badge with default cursor) */}
            <button
              type="button"
              onClick={handleHtcBadgeClick}
              className="px-2.5 py-1 bg-[#f2f4f6] border border-[#cbd5e1] rounded-[3px] text-[#0F2E52] font-mono text-[10px] font-bold cursor-default select-none focus:outline-none"
            >
              HTC
            </button>
            <p>© {new Date().getFullYear()} HIGHTONE CERAMIC. Thangadh Industrial Cluster.</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => onOpenLegal('privacy')}
              className="hover:text-[#0F2E52] hover:underline cursor-pointer transition-colors text-slate-500 hover:text-[#0F2E52]"
            >
              Privacy Policy
            </button>
            <span className="text-slate-300">•</span>
            <button
              type="button"
              onClick={() => onOpenLegal('terms')}
              className="hover:text-[#0F2E52] hover:underline cursor-pointer transition-colors text-slate-500 hover:text-[#0F2E52]"
            >
              Terms &amp; Conditions
            </button>
            <span className="text-slate-300">•</span>
            <button
              type="button"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('open-cookie-preferences'));
                }
              }}
              className="hover:text-[#0F2E52] hover:underline cursor-pointer transition-colors text-slate-500 hover:text-[#0F2E52]"
            >
              Cookie Preferences
            </button>
            <span className="hidden sm:inline text-slate-300">|</span>
            <div className="font-medium tracking-wider text-[#0F2E52] uppercase text-[10px]">
              SANITARYWARE &amp; WASH BASINS
            </div>
          </div>
        </div>

      </div>
    </footer>
  );
};
