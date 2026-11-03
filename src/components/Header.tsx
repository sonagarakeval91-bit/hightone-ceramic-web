import React, { useState } from 'react';
import { PageId } from '../types';
import { useWebsiteData } from '../context/DataContext';
import { Menu, X, PhoneCall, ChevronRight, MessageSquare } from 'lucide-react';
import { sanitizePhoneForTel, sanitizePhoneForWhatsApp, formatDisplayPhone } from '../utils/phone';
import { trackEvent } from '../services/analyticsService';

interface HeaderProps {
  currentPage: PageId;
  onNavigate: (page: PageId) => void;
  onOpenQuote: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentPage,
  onNavigate,
  onOpenQuote
}) => {
  const { siteMedia, companyInfo } = useWebsiteData();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks: { id: PageId; label: string }[] = [
    { id: 'home', label: 'Home' },
    { id: 'collections', label: 'Collections' },
    { id: 'b2b', label: 'B2B Dealers' },
    { id: 'about', label: 'About Us' }
  ];

  const handleNavClick = (page: PageId) => {
    onNavigate(page);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200/80 shadow-2xs transition-all duration-200 supports-[backdrop-filter]:bg-white/75">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-18">
          
          {/* Brand Logo */}
          <button
            onClick={() => handleNavClick('home')}
            className="flex items-center space-x-3 cursor-pointer group focus:outline-none"
            aria-label="Hightone Ceramic Home"
          >
            {siteMedia?.logo ? (
              <img
                src={siteMedia.logo}
                alt="Hightone Ceramic"
                className="h-10 sm:h-12 w-auto max-w-[200px] object-contain"
              />
            ) : (
              <div className="flex flex-col items-start text-left">
                <span className="font-display text-xl sm:text-2xl font-bold tracking-tight text-[#0F2E52] leading-none group-hover:text-[#1e3a5f] transition-colors">
                  HIGHTONE
                </span>
                <span className="text-[10px] sm:text-[11px] font-semibold tracking-[0.25em] text-[#515f74] uppercase leading-tight mt-0.5">
                  CERAMIC
                </span>
              </div>
            )}
          </button>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center space-x-8">
            {navLinks.map((link) => {
              const isActive = currentPage === link.id;
              return (
                <button
                  key={link.id}
                  onClick={() => handleNavClick(link.id)}
                  className={`relative text-sm font-medium transition-colors py-1 cursor-pointer focus:outline-none ${
                    isActive
                      ? 'text-[#0F2E52] font-semibold'
                      : 'text-[#515f74] hover:text-[#0F2E52]'
                  }`}
                >
                  {link.label}
                  {isActive && (
                    <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#0F2E52] -mb-1" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right Action Buttons */}
          <div className="hidden md:flex items-center space-x-3">
            {/* Call Us Button */}
            <a
              href={sanitizePhoneForTel(companyInfo.primary_phone)}
              onClick={() => trackEvent('call_click', 'Header Call Us')}
              className="text-xs font-semibold text-[#0F2E52] hover:text-[#1e3a5f] bg-white/70 backdrop-blur-xs border border-slate-300/80 hover:bg-white hover:border-[#0F2E52] rounded-[3px] flex items-center space-x-1.5 px-3.5 py-2 transition-all shadow-2xs"
            >
              <PhoneCall className="w-3.5 h-3.5" />
              <span>Call Us</span>
            </a>

            {/* Primary Action Button: "Get a Quote" */}
            <button
              onClick={onOpenQuote}
              className="bg-[#0F2E52] hover:bg-[#1e3a5f] text-white text-sm font-semibold px-5 py-2.5 rounded-[3px] border border-[#0F2E52] transition-colors shadow-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#0F2E52] focus:ring-offset-1"
            >
              Get a Quote
            </button>
          </div>

          {/* Mobile Actions: WhatsApp Icon + Menu Toggle */}
          <div className="flex md:hidden items-center space-x-2">
            <a
              href={`https://wa.me/${sanitizePhoneForWhatsApp(companyInfo.primary_phone)}?text=${encodeURIComponent('Hello Hightone Ceramic, I would like to inquire about wholesale dealership.')}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackEvent('whatsapp_click', 'Mobile Header WhatsApp')}
              className="p-2 bg-emerald-50 text-emerald-700 border border-emerald-300 rounded-[3px] flex items-center space-x-1 text-xs font-bold"
              aria-label="Quick WhatsApp Chat"
            >
              <MessageSquare className="w-4 h-4 text-emerald-600 fill-emerald-100" />
              <span className="text-[11px]">WhatsApp</span>
            </a>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-[#0F2E52] rounded-[3px] hover:bg-slate-100/70 focus:outline-none transition-colors cursor-pointer"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200/80 bg-white/95 backdrop-blur-xl px-4 pt-3 pb-5 space-y-2 shadow-xl animate-in fade-in slide-in-from-top-1 duration-150">
          {navLinks.map((link) => (
            <button
              key={link.id}
              onClick={() => handleNavClick(link.id)}
              className={`w-full text-left py-2.5 px-3 rounded-[3px] text-sm font-medium flex items-center justify-between ${
                currentPage === link.id
                  ? 'bg-[#f2f4f6] text-[#0F2E52] font-semibold'
                  : 'text-[#515f74] hover:bg-[#f8fafc]'
              }`}
            >
              <span>{link.label}</span>
              {currentPage === link.id && <ChevronRight className="w-4 h-4 text-[#0F2E52]" />}
            </button>
          ))}
          <div className="pt-2 border-t border-[#e2e8f0] flex flex-col space-y-2">
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenQuote();
              }}
              className="w-full bg-[#0F2E52] text-white py-2.5 text-center text-sm font-semibold rounded-[3px] cursor-pointer"
            >
              Get a Quote
            </button>
            <a
              href={`https://wa.me/${sanitizePhoneForWhatsApp(companyInfo.primary_phone)}?text=${encodeURIComponent('Hello Hightone Ceramic, I would like to inquire about wholesale dealership.')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-[3px] flex items-center justify-center space-x-2 text-center"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Quick Chat on WhatsApp</span>
            </a>
            <a
              href={sanitizePhoneForTel(companyInfo.primary_phone)}
              className="w-full text-center py-2 text-xs font-semibold text-[#0F2E52] border border-[#cbd5e1] rounded-[3px] flex items-center justify-center space-x-1.5"
            >
              <PhoneCall className="w-3.5 h-3.5" />
              <span>Call Us ({formatDisplayPhone(companyInfo.primary_phone)})</span>
            </a>
          </div>
        </div>
      )}
    </header>
  );
};
