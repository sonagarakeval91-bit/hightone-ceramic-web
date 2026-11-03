import React, { useState } from 'react';
import { useWebsiteData } from '../context/DataContext';
import { sanitizePhoneForWhatsApp, formatDisplayPhone } from '../utils/phone';
import { trackEvent } from '../services/analyticsService';

export const FloatingWhatsApp: React.FC = () => {
  const { companyInfo } = useWebsiteData();
  const [isHovered, setIsHovered] = useState(false);

  const whatsAppNumber = sanitizePhoneForWhatsApp(companyInfo.primary_phone);
  const displayPhone = formatDisplayPhone(companyInfo.primary_phone);

  const defaultMessage = 'Hello Hightone Ceramic, I would like to inquire about wholesale dealership, product catalog, and ex-factory pricing.';
  const whatsappUrl = `https://wa.me/${whatsAppNumber}?text=${encodeURIComponent(defaultMessage)}`;

  const handleWhatsAppClick = () => {
    trackEvent('whatsapp_click', 'Floating Quick Chat');
  };

  return (
    <aside 
      aria-label="Quick WhatsApp Contact" 
      className="fixed bottom-6 right-5 sm:bottom-8 sm:right-6 md:bottom-10 md:right-8 z-40 flex items-center space-x-2.5 select-none pointer-events-auto"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Label Badge with Frosted Glass Effect */}
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleWhatsAppClick}
        className="hidden md:inline-flex items-center space-x-2 bg-white/85 hover:bg-white/95 backdrop-blur-md text-[#0F2E52] border border-white/70 rounded-full pl-3 pr-3.5 py-1.5 shadow-lg shadow-black/5 text-xs font-semibold hover:border-emerald-500 hover:text-emerald-700 transition-all duration-200"
      >
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <span>Quick Chat on WhatsApp</span>
      </a>

      {/* Main WhatsApp Floating Action Button: Precise circular 56px / 60px badge */}
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleWhatsAppClick}
        aria-label={`Quick Chat on WhatsApp (${displayPhone})`}
        className="relative flex items-center justify-center w-14 h-14 sm:w-14 sm:h-14 md:w-15 md:h-15 rounded-full bg-[#25D366] hover:bg-[#20bd5a] active:scale-95 text-white shadow-xl shadow-emerald-900/25 transition-all duration-200 border-2 border-white focus:outline-none focus:ring-4 focus:ring-emerald-300 shrink-0 cursor-pointer"
      >
        {/* Subtle breathing ripple */}
        <span className="absolute inset-0 rounded-full bg-[#25D366] opacity-25 animate-ping -z-10 pointer-events-none" />

        {/* Pixel-perfect Authentic WhatsApp SVG Logo */}
        <svg
          viewBox="0 0 48 48"
          className="w-8 h-8 sm:w-8 sm:h-8 md:w-8.5 md:h-8.5 transition-transform duration-200 group-hover:scale-105"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Circular speech bubble backing with tail */}
          <path
            fill="#ffffff"
            fillRule="evenodd"
            clipRule="evenodd"
            d="M24 4.5C13.23 4.5 4.5 13.23 4.5 24c0 3.44.89 6.78 2.58 9.71L4.5 43.5l10.15-2.66c2.81 1.54 6 2.36 9.35 2.36 10.77 0 19.5-8.73 19.5-19.5S34.77 4.5 24 4.5zm11.4 27.42c-.48 1.34-2.77 2.56-3.89 2.74-1 .15-2.27.21-3.66-.23-.85-.27-1.93-.63-3.32-1.23-5.83-2.51-9.64-8.38-9.93-8.77-.29-.39-2.37-3.15-2.37-6.01 0-2.86 1.51-4.27 2.04-4.85.53-.58 1.16-.73 1.55-.73.39 0 .78 0 1.12.02.35.01.84-.14 1.31.99.49 1.16 1.64 4.01 1.79 4.3.15.29.24.63.05 1.02-.19.39-.29.63-.58.97-.29.34-.61.76-.87 1.02-.29.29-.59.6-.25 1.18.34.58 1.51 2.48 3.23 4.01 2.21 1.97 4.08 2.58 4.66 2.87.58.29.92.24 1.26-.15.34-.39 1.45-1.69 1.84-2.27.38-.58.77-.48 1.3-.29.53.2 3.36 1.59 3.94 1.88.58.29.97.43 1.11.66.14.23.14 1.39-.34 2.74z"
          />
        </svg>

        <span className="sr-only">Quick Chat on WhatsApp</span>
      </a>
    </aside>
  );
};
