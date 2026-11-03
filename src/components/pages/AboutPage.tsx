import React from 'react';
import { PageId } from '../../types';
import { useWebsiteData } from '../../context/DataContext';
import { 
  MapPin, 
  Truck, 
  PhoneCall, 
  Factory,
  ExternalLink,
  Navigation
} from 'lucide-react';
import { sanitizePhoneForTel, formatDisplayPhone } from '../../utils/phone';
import { DEFAULT_COMPANY_INFO, getGoogleMapsDirectionsUrl } from '../../services/googleSheetsService';

interface AboutPageProps {
  onNavigate: (page: PageId) => void;
  onOpenQuote: () => void;
}

export const AboutPage: React.FC<AboutPageProps> = ({ onNavigate, onOpenQuote }) => {
  const { siteMedia, companyInfo } = useWebsiteData();
  const addressText = companyInfo.factory_address || DEFAULT_COMPANY_INFO.factory_address;
  const directionsUrl = getGoogleMapsDirectionsUrl(companyInfo);
  const mapsUrl = directionsUrl;

  return (
    <div className="space-y-16 sm:space-y-24 pb-12">
      
      {/* 1. Header Banner */}
      <section className="bg-white border-b border-[#e2e8f0] py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
          <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#64748b]">
            PLANT LEGACY &amp; MANUFACTURING INFRASTRUCTURE
          </span>
          <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold text-[#0F2E52]">
            Crafted in the Ceramic Capital of Saurashtra
          </h1>
          <p className="text-sm sm:text-base text-[#515f74] max-w-3xl leading-relaxed">
            Hightone Ceramic operates directly out of Thangadh, Gujarat. For decades, Thangadh clay deposits, mineral reserves, and specialized ceramic artisans have supplied India and overseas markets with benchmark sanitaryware.
          </p>
        </div>
      </section>

      {/* 2. Key Pillars */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          <div className="bg-white border border-[#e2e8f0] p-6 rounded-[3px] space-y-3">
            <div className="w-10 h-10 bg-[#f2f4f6] text-[#0F2E52] rounded-[2px] flex items-center justify-center">
              <Factory className="w-5 h-5 text-[#0F2E52]" />
            </div>
            <h3 className="font-display font-bold text-lg text-[#0F2E52]">
              Continuous Tunnel Firing
            </h3>
            <p className="text-xs text-[#515f74] leading-relaxed">
              Our continuous kilns maintain uniform thermal curves at approx. 1,200°C, ensuring that every basin and closet achieves zero crazing and non-porous high density.
            </p>
          </div>

          <div className="bg-white border border-[#e2e8f0] p-6 rounded-[3px] space-y-3">
            <div className="w-10 h-10 bg-[#f2f4f6] text-[#0F2E52] rounded-[2px] flex items-center justify-center">
              <Truck className="w-5 h-5 text-[#0F2E52]" />
            </div>
            <h3 className="font-display font-bold text-lg text-[#0F2E52]">
              Road Despatch
            </h3>
            <p className="text-xs text-[#515f74] leading-relaxed">
              Positioned on the Surendranagar–Rajkot highway corridor, we coordinate full truckloads (FTL) and road freight despatches to stockists across all states.
            </p>
          </div>

        </div>
      </section>

      {/* 3. Plant Visit & Contact Info */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white border border-[#e2e8f0] rounded-[3px] p-6 sm:p-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            
            <div className="space-y-4">
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#64748b] font-bold block">
                SHOWROOM &amp; GODOWN INVITATION
              </span>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#0F2E52]">
                Visit Our Thangadh Production Unit
              </h2>
              <p className="text-xs sm:text-sm text-[#515f74] leading-relaxed">
                We warmly welcome sanitaryware stockists, procurement managers, and commercial developers to tour our kilns, review finished inventory, and discuss customized dealer margin slabs.
              </p>

              <div className="space-y-3 pt-2 text-xs">
                <div className="flex items-start space-x-2.5">
                  <MapPin className="w-4 h-4 text-[#0F2E52] shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-[#0F2E52] block">Factory Address:</strong>
                    <span className="text-[#515f74] block">{addressText}</span>
                    <div className="flex items-center space-x-3 pt-1 text-[11px]">
                      <a
                        href={mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center space-x-1 text-[#0F2E52] font-semibold hover:underline"
                      >
                        <span>Open in Google Maps</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                      <span className="text-slate-300">•</span>
                      <a
                        href={directionsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center space-x-1 text-[#0F2E52] font-semibold hover:underline"
                      >
                        <Navigation className="w-3 h-3" />
                        <span>Get Directions</span>
                      </a>
                    </div>
                  </div>
                </div>

                <div className="flex items-start space-x-2.5">
                  <PhoneCall className="w-4 h-4 text-[#0F2E52] shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-[#0F2E52] block">Direct Sales Desk:</strong>
                    <a href={sanitizePhoneForTel(companyInfo.primary_phone)} className="text-[#0F2E52] font-bold hover:underline">
                      {formatDisplayPhone(companyInfo.primary_phone)}
                    </a>
                  </div>
                </div>
              </div>

              <div className="pt-4 flex flex-wrap gap-3">
                <button
                  onClick={onOpenQuote}
                  className="px-5 py-2.5 bg-[#0F2E52] hover:bg-[#1e3a5f] text-white text-xs font-semibold rounded-[3px] transition-colors"
                >
                  Request Dealership Proposal
                </button>
                <button
                  onClick={() => onNavigate('b2b')}
                  className="px-5 py-2.5 border border-[#cbd5e1] hover:border-[#0F2E52] text-[#0F2E52] text-xs font-semibold rounded-[3px] transition-colors"
                >
                  View B2B Dealership Process
                </button>
              </div>
            </div>

            {/* Plant Facility Image: Tunnel Kiln */}
            <div className="relative aspect-4/3 rounded-[3px] overflow-hidden border border-[#cbd5e1] bg-[#001936]">
              <img
                src={siteMedia.tunnel_kiln}
                alt="Hightone Thangadh Continuous Ceramic Tunnel Kiln"
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md text-white text-[10px] sm:text-xs font-sans font-semibold tracking-wider uppercase border border-white/35 shadow-sm transition-all">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 shadow-[0_0_6px_rgba(251,191,36,0.9)] animate-pulse" />
                <span>CONTINUOUS TUNNEL KILN • 1,200°C ACTIVE FIRING</span>
              </div>
            </div>

          </div>
        </div>
      </section>

    </div>
  );
};
