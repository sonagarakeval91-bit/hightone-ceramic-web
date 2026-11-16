import React, { useState, useEffect } from 'react';
import { PageId, B2BInquiryPayload, SavedDealerOrder } from '../../types';
import { useWebsiteData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import { 
  PhoneCall, 
  Truck, 
  Package, 
  LayoutGrid, 
  Clock, 
  ShieldCheck, 
  FileText, 
  Send, 
  MessageSquare, 
  MapPin, 
  Mail, 
  ChevronDown, 
  ChevronUp, 
  CheckCircle2, 
  AlertCircle,
  ExternalLink,
  Navigation,
  UserCheck,
  UserPlus,
  LogIn
} from 'lucide-react';
import { sanitizePhoneForTel, sanitizePhoneForWhatsApp, formatDisplayPhone } from '../../utils/phone';
import { DEFAULT_COMPANY_INFO, getGoogleMapsDirectionsUrl } from '../../services/googleSheetsService';
import {
  COUNTRY_DIAL_CODES,
  COUNTRIES,
  INDIAN_STATES,
  getDistrictsForState,
  getCitiesForDistrict
} from '../../data/locationData';
import { DealerOrderBuilder } from '../b2b/DealerOrderBuilder';
import { BecomeDealerForm } from '../b2b/BecomeDealerForm';
import { DealerPortalWorkspace } from '../b2b/DealerPortalWorkspace';

interface B2BDealersPageProps {
  onNavigate: (page: PageId) => void;
  onOpenQuote: () => void;
}

type B2BTabId = 'portal' | 'order' | 'become-dealer' | 'inquiry';

export const B2BDealersPage: React.FC<B2BDealersPageProps> = ({
  onNavigate,
  onOpenQuote
}) => {
  const { faqs, siteMedia, recordInquiry, companyInfo, dealerSession } = useWebsiteData();
  const { toastError, toastInfo, toastSuccess } = useToast();
  const addressText = companyInfo.factory_address || DEFAULT_COMPANY_INFO.factory_address;
  const directionsUrl = getGoogleMapsDirectionsUrl(companyInfo);
  const mapsUrl = directionsUrl;

  const resolveTabFromHash = (): B2BTabId => {
    if (typeof window === 'undefined') return 'portal';
    const h = window.location.hash;
    if (h === '#order' || h === '#create-order') return 'order';
    if (h === '#become-dealer') return 'become-dealer';
    if (h === '#dealer-portal' || h === '#portal') return 'portal';
    return 'inquiry';
  };

  // Active Tab: 'portal' | 'order' | 'become-dealer' | 'inquiry'
  const [b2bTab, setB2bTab] = useState<B2BTabId>(resolveTabFromHash);
  const [editingOrder, setEditingOrder] = useState<SavedDealerOrder | null>(null);
  const [reorderSource, setReorderSource] = useState<SavedDealerOrder | null>(null);

  useEffect(() => {
    const handleHash = () => {
      const h = window.location.hash;
      if (h === '#order' || h === '#create-order') setB2bTab('order');
      else if (h === '#become-dealer') setB2bTab('become-dealer');
      else if (h === '#dealer-portal' || h === '#portal') setB2bTab('portal');
    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const switchB2bTab = (nextTab: B2BTabId, scrollToTabs: boolean = false) => {
    setB2bTab(nextTab);
    if (typeof window !== 'undefined') {
      if (nextTab === 'order') window.location.hash = '#order';
      else if (nextTab === 'become-dealer') window.location.hash = '#become-dealer';
      else if (nextTab === 'portal') window.location.hash = '#dealer-portal';
      else if (window.location.hash) window.history.pushState(null, '', window.location.pathname);
    }
    if (scrollToTabs) {
      const target = document.getElementById('b2b-portal-tabs');
      if (target) target.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Accordion state
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  // Form Field States
  const [businessName, setBusinessName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phoneCode, setPhoneCode] = useState('+91');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [country, setCountry] = useState('India');
  const [state, setState] = useState('');
  const [district, setDistrict] = useState('');
  const [city, setCity] = useState('');
  const [customCity, setCustomCity] = useState('');
  const [volume, setVolume] = useState('');
  const [productInterest, setProductInterest] = useState('');
  const [notes, setNotes] = useState('');

  const [formSubmitted, setFormSubmitted] = useState(false);
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [savedInquiryId, setSavedInquiryId] = useState<string>('');

  const toggleFaq = (index: number) => {
    setOpenFaqIndex(openFaqIndex === index ? null : index);
  };

  // Track which inputs have been interacted with or blurred
  const [touched, setTouched] = useState<Record<string, boolean>>({
    businessName: false,
    contactPerson: false,
    whatsappNumber: false,
    country: false,
    state: false,
    district: false,
    city: false,
    customCity: false,
    volume: false,
    productInterest: false,
    notes: false
  });

  const markAllTouched = () => {
    setTouched({
      businessName: true,
      contactPerson: true,
      whatsappNumber: true,
      country: true,
      state: true,
      district: true,
      city: true,
      customCity: true,
      volume: true,
      productInterest: true,
      notes: true
    });
  };

  const handleCountryChange = (newCountry: string) => {
    setCountry(newCountry);
    if (!touched.country) setTouched((prev) => ({ ...prev, country: true }));

    if (newCountry === 'India') {
      setPhoneCode('+91');
    } else {
      const match = COUNTRY_DIAL_CODES.find((c) => c.country.toLowerCase() === newCountry.toLowerCase());
      if (match) {
        setPhoneCode(match.code);
      }
    }
    setState('');
    setDistrict('');
    setCity('');
    setCustomCity('');
  };

  const handleStateChange = (newState: string) => {
    setState(newState);
    if (!touched.state) setTouched((prev) => ({ ...prev, state: true }));
    setDistrict('');
    setCity('');
    setCustomCity('');
  };

  const handleDistrictChange = (newDistrict: string) => {
    setDistrict(newDistrict);
    if (!touched.district) setTouched((prev) => ({ ...prev, district: true }));
    setCity('');
    setCustomCity('');
  };

  const cleanPhone = whatsappNumber.replace(/\D/g, '');
  const isPhoneValid = country === 'India' ? cleanPhone.length === 10 : cleanPhone.length >= 7;
  const isCityValid = city === 'Other City' ? customCity.trim().length > 0 : Boolean(city.trim());
  const isDistrictValid = country === 'India' ? Boolean(district.trim()) : true;

  const effectiveCity = city === 'Other City' ? customCity.trim() : city;
  const fullLocation = [effectiveCity, district, state, country].filter(Boolean).join(', ');

  const isFormComplete = Boolean(
    businessName.trim() &&
    contactPerson.trim() &&
    isPhoneValid &&
    country.trim() &&
    state.trim() &&
    isDistrictValid &&
    isCityValid &&
    volume.trim() &&
    productInterest.trim() &&
    notes.trim()
  );

  const fieldErrors = {
    businessName: touched.businessName && !businessName.trim()
      ? 'Firm or business name is required (e.g. Apex Sanitary & Ceramics)'
      : null,
    contactPerson: touched.contactPerson && !contactPerson.trim()
      ? 'Contact person name is required (e.g. Rajesh Patel)'
      : null,
    whatsappNumber: (() => {
      const raw = whatsappNumber.trim();
      if (touched.whatsappNumber && !raw) return 'Mobile number is required';
      if (raw && !isPhoneValid) {
        return country === 'India'
          ? `Please enter a valid 10-digit mobile number (${cleanPhone.length}/10 digits)`
          : `Please enter a valid phone number (${cleanPhone.length} digits)`;
      }
      return null;
    })(),
    country: touched.country && !country.trim() ? 'Please select your country' : null,
    state: touched.state && !state.trim() ? 'Please select your destination state' : null,
    district: touched.district && country === 'India' && !district.trim() ? 'Please select your destination district' : null,
    city: touched.city && !city.trim() ? 'Please select your destination city' : null,
    customCity: touched.customCity && city === 'Other City' && !customCity.trim()
      ? 'Please specify your city or town name'
      : null,
    volume: touched.volume && !volume.trim() ? 'Please select an estimated batch or volume requirement' : null,
    productInterest: touched.productInterest && !productInterest.trim() ? 'Please select your primary product interest' : null,
    notes: touched.notes && !notes.trim() ? 'Specific model details, finishes, or dispatch schedule are required' : null
  };

  const constructPayload = (): B2BInquiryPayload => ({
    businessName: businessName.trim(),
    contactPerson: contactPerson.trim(),
    phoneCode,
    whatsappNumber: whatsappNumber.trim(),
    country: country.trim(),
    state: state.trim(),
    district: district.trim(),
    city: effectiveCity,
    cityState: fullLocation,
    volume,
    productInterest,
    notes: notes.trim(),
    timestamp: new Date().toISOString()
  });

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    markAllTouched();
    setFormError('');

    if (!isFormComplete) {
      const msg = 'Please complete all required fields highlighted in red.';
      setFormError(msg);
      toastError(msg, 'Incomplete Inquiry Form');
      return;
    }

    setIsSubmitting(true);
    const payload = constructPayload();
    try {
      const res = await recordInquiry(payload, 'B2B Wholesale Portal Page');
      setSavedInquiryId(res.id);
      setIsSubmitting(false);
      setFormSubmitted(true);
      toastSuccess(
        `Inquiry ${res.id} logged for "${payload.businessName}". Factory sales will reply within 4 hours.`,
        'Wholesale Inquiry Submitted'
      );
    } catch (err) {
      console.error('Failed to record inquiry:', err);
      const msg =
        err instanceof Error
          ? err.message
          : 'Unable to submit inquiry to server. Please check your connection and try again.';
      setIsSubmitting(false);
      setFormError(msg);
      toastError(msg, 'Submission Failed');
    }
  };

  const getWhatsAppLink = () => {
    const text = `*Hightone Ceramic - B2B Wholesale Portal Inquiry*\n\n` +
      `*Showroom/Firm:* ${businessName.trim() || 'N/A'}\n` +
      `*Contact Person:* ${contactPerson.trim() || 'N/A'}\n` +
      `*Phone:* ${phoneCode} ${whatsappNumber.trim() || 'N/A'}\n` +
      `*Destination:* ${fullLocation || 'N/A'}\n` +
      `*Volume Needed:* ${volume}\n` +
      `*Product Segment:* ${productInterest}\n` +
      `*Notes & Models:* ${notes.trim() || 'N/A'}\n\n` +
      `Please share latest ex-factory price slabs and dispatch schedule.`;

    return `https://wa.me/${sanitizePhoneForWhatsApp(companyInfo.primary_phone)}?text=${encodeURIComponent(text)}`;
  };

  const handleWhatsAppClick = () => {
    markAllTouched();
    if (!isFormComplete) {
      const msg = 'Cannot start WhatsApp chat yet. Please complete all required fields.';
      setFormError(msg);
      toastError(msg, 'Incomplete Inquiry Form');
      return;
    }

    const payload = constructPayload();
    try {
      recordInquiry(payload, 'B2B Wholesale Portal WhatsApp').catch(() => {});
    } catch {}

    toastInfo(`Opening Factory WhatsApp for "${payload.businessName}".`, 'WhatsApp Dispatch');
    const link = getWhatsAppLink();
    window.open(link, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="space-y-10 sm:space-y-14 pb-12">
      
      {/* 1. BREADCRUMB BAR */}
      <div className="border-b border-[#e2e8f0] bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          
          {/* Breadcrumb path */}
          <div className="flex items-center space-x-1.5 text-[#64748b] font-mono uppercase text-[11px]">
            <button
              onClick={() => { onNavigate('home'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              className="hover:text-[#0F2E52] cursor-pointer"
            >
              HOME
            </button>
            <span>/</span>
            <span className="text-[#0F2E52] font-semibold">B2B DEALERS &amp; WHOLESALE</span>
          </div>

          {/* Operational Status Pill */}
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 bg-white/85 backdrop-blur-md text-[#0F2E52] rounded-full font-mono text-[10px] sm:text-[11px] font-medium border border-slate-200/90 shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-semibold uppercase">
              FACTORY DISPATCH OPERATIONAL • THANGADH, GUJARAT
            </span>
          </div>

        </div>
      </div>


      {/* 2. HERO SECTION */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          
          {/* Left Column */}
          <div className="lg:col-span-7 space-y-5">
            <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#64748b] block">
              DIRECT MANUFACTURING LOGISTICS
            </span>

            <h1 className="font-display text-3xl sm:text-4xl lg:text-[3.25rem] font-bold tracking-[-0.03em] text-[#0F2E52] leading-[1.12]">
              Partner With Hightone Ceramic
            </h1>

            <h2 className="font-display text-base sm:text-lg font-semibold text-[#1e3a5f] leading-snug">
              Simple Wholesale Supply &amp; Dealership Inquiries Direct From Our Thangadh Factory
            </h2>

            <p className="text-xs sm:text-sm text-[#515f74] leading-relaxed max-w-xl">
              Direct factory pricing, verified stock availability, and reliable truckload dispatches for sanitaryware dealers, distributors, showroom owners, and plumbing contractors across India.
            </p>

            {/* CTA Buttons */}
            <div className="pt-1 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setEditingOrder(null);
                  setReorderSource(null);
                  switchB2bTab('order', true);
                }}
                className="inline-flex items-center space-x-2 px-5 py-3 bg-[#0F2E52] hover:bg-[#1e3a5f] text-white rounded-[3px] text-xs font-bold transition-colors shadow-xs cursor-pointer"
              >
                <Package className="w-4 h-4 text-sky-300" />
                <span>Create Dealer Order</span>
              </button>

              <button
                type="button"
                onClick={() => switchB2bTab('portal', true)}
                className="inline-flex items-center space-x-2 px-4 py-3 bg-white hover:bg-slate-50 text-[#0F2E52] border border-[#0F2E52] rounded-[3px] text-xs font-bold transition-colors shadow-xs cursor-pointer"
              >
                {dealerSession ? (
                  <>
                    <UserCheck className="w-4 h-4 text-emerald-600" />
                    <span>My Dealer Orders ({dealerSession.firmName})</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>Dealer Sign In</span>
                  </>
                )}
              </button>

              {!dealerSession && (
                <button
                  type="button"
                  onClick={() => switchB2bTab('become-dealer', true)}
                  className="inline-flex items-center space-x-2 px-4 py-3 bg-[#f8fafc] hover:bg-slate-100 text-[#0F2E52] border border-[#cbd5e1] rounded-[3px] text-xs font-semibold transition-colors shadow-xs cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Want to Become a Dealer</span>
                </button>
              )}
            </div>

            {/* 3 Metrics Row */}
            <div className="grid grid-cols-3 gap-4 pt-6 border-t border-[#e2e8f0]">
              <div>
                <span className="block font-display text-2xl sm:text-3xl font-bold text-[#0F2E52]">
                  100%
                </span>
                <span className="block text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[#64748b]">
                  PLANT DIRECT SUPPLY
                </span>
              </div>

              <div>
                <span className="block font-display text-2xl sm:text-3xl font-bold text-[#0F2E52]">
                  4 Hours
                </span>
                <span className="block text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[#64748b]">
                  RAPID DIRECT QUOTE
                </span>
              </div>

              <div>
                <span className="block font-display text-2xl sm:text-3xl font-bold text-[#0F2E52]">
                  Zero
                </span>
                <span className="block text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[#64748b]">
                  MIDDLEMAN MARGINS
                </span>
              </div>
            </div>

          </div>

          {/* Right Column: Warehouse Graphic & Plant Status Card */}
          <div className="lg:col-span-5">
            <div className="border border-[#cbd5e1] rounded-[4px] overflow-hidden bg-white shadow-md">
              
              {/* Photo Area with Direct Loading Scene */}
              <div className="relative aspect-4/3 bg-[#f1f5f9] overflow-hidden">
                <img
                  src={siteMedia.dispatch_loading}
                  alt="Hightone Thangadh Warehouse and Factory Loading"
                  className="w-full h-full object-cover"
                />
                
                {/* Warehouse Tag Markers with Frosted Glass Effect */}
                <div className="absolute top-3 left-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md text-white text-[10px] sm:text-[11px] font-sans font-semibold tracking-wider uppercase border border-white/35 shadow-sm transition-all">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-300 shrink-0 shadow-[0_0_6px_rgba(103,232,249,0.9)]" />
                  <span>THANGADH - A1</span>
                </div>

                <div className="absolute top-3 right-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md text-white text-[10px] sm:text-[11px] font-sans font-semibold tracking-wider uppercase border border-white/35 shadow-sm transition-all">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 shadow-[0_0_6px_rgba(52,211,153,0.9)]" />
                  <span>HIGHTONE DISPATCH</span>
                </div>
              </div>

              {/* Bottom Strip: Dispatch Facility Status */}
              <div className="p-4 bg-white border-t border-[#e2e8f0] flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-[#64748b] block font-bold">
                    DISPATCH FACILITY STATUS
                  </span>
                  <span className="font-display font-bold text-[#0F2E52] text-sm">
                    Thangadh Plant Operational
                  </span>
                </div>
                <div className="w-8 h-8 rounded-[2px] bg-[#f2f4f6] border border-[#e2e8f0] flex items-center justify-center text-[#0F2E52]">
                  <Truck className="w-4 h-4 text-[#0F2E52]" />
                </div>
              </div>

            </div>
          </div>

        </div>
      </section>

      {/* 2.5 B2B WORKSPACE MODE BUTTONS */}
      <section id="b2b-portal-tabs" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div
          role="tablist"
          aria-label="Dealer Workspace Sections"
          className="bg-[#f8fafc] border border-[#e2e8f0] rounded-[4px] p-1.5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-1.5 shadow-2xs"
        >
          <button
            type="button"
            role="tab"
            aria-selected={b2bTab === 'portal'}
            onClick={() => switchB2bTab('portal')}
            className={`px-3.5 py-2.5 rounded-[3px] font-semibold text-xs flex items-center justify-center sm:justify-start gap-2 transition-all cursor-pointer whitespace-nowrap ${
              b2bTab === 'portal'
                ? 'bg-[#0F2E52] text-white shadow-xs'
                : 'bg-white text-[#0F2E52] border border-[#e2e8f0] hover:border-[#0F2E52]/40 hover:bg-slate-50'
            }`}
          >
            {dealerSession ? (
              <UserCheck className={`w-4 h-4 shrink-0 ${b2bTab === 'portal' ? 'text-sky-300' : 'text-[#0F2E52]'}`} />
            ) : (
              <LogIn className={`w-4 h-4 shrink-0 ${b2bTab === 'portal' ? 'text-sky-300' : 'text-[#0F2E52]'}`} />
            )}
            <span className="truncate">{dealerSession ? 'My Dealer Orders' : 'Dealer Sign In'}</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={b2bTab === 'order'}
            onClick={() => {
              setEditingOrder(null);
              setReorderSource(null);
              switchB2bTab('order');
            }}
            className={`px-3.5 py-2.5 rounded-[3px] font-semibold text-xs flex items-center justify-center sm:justify-start gap-2 transition-all cursor-pointer whitespace-nowrap ${
              b2bTab === 'order'
                ? 'bg-[#0F2E52] text-white shadow-xs'
                : 'bg-white text-[#0F2E52] border border-[#e2e8f0] hover:border-[#0F2E52]/40 hover:bg-slate-50'
            }`}
          >
            <Package className={`w-4 h-4 shrink-0 ${b2bTab === 'order' ? 'text-sky-300' : 'text-[#0F2E52]'}`} />
            <span className="truncate">{editingOrder ? 'Edit Active Order' : 'Create Dealer Order'}</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={b2bTab === 'become-dealer'}
            onClick={() => switchB2bTab('become-dealer')}
            className={`px-3.5 py-2.5 rounded-[3px] font-semibold text-xs flex items-center justify-center sm:justify-start gap-2 transition-all cursor-pointer whitespace-nowrap ${
              b2bTab === 'become-dealer'
                ? 'bg-[#0F2E52] text-white shadow-xs'
                : 'bg-white text-[#0F2E52] border border-[#e2e8f0] hover:border-[#0F2E52]/40 hover:bg-slate-50'
            }`}
          >
            <UserPlus className={`w-4 h-4 shrink-0 ${b2bTab === 'become-dealer' ? 'text-sky-300' : 'text-[#0F2E52]'}`} />
            <span className="truncate">Become a Dealer</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={b2bTab === 'inquiry'}
            onClick={() => switchB2bTab('inquiry')}
            className={`px-3.5 py-2.5 rounded-[3px] font-semibold text-xs flex items-center justify-center sm:justify-start gap-2 transition-all cursor-pointer whitespace-nowrap ${
              b2bTab === 'inquiry'
                ? 'bg-[#0F2E52] text-white shadow-xs'
                : 'bg-white text-[#0F2E52] border border-[#e2e8f0] hover:border-[#0F2E52]/40 hover:bg-slate-50'
            }`}
          >
            <FileText className={`w-4 h-4 shrink-0 ${b2bTab === 'inquiry' ? 'text-sky-300' : 'text-[#0F2E52]'}`} />
            <span className="truncate">Wholesale Inquiry</span>
          </button>
        </div>
      </section>

      {/* CONDITIONAL CONTENT BASED ON ACTIVE TAB */}
      {b2bTab === 'portal' ? (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <DealerPortalWorkspace
            onCreateNewOrder={() => {
              setEditingOrder(null);
              setReorderSource(null);
              switchB2bTab('order', true);
            }}
            onEditActiveOrder={(order) => {
              setReorderSource(null);
              setEditingOrder(order);
              switchB2bTab('order', true);
            }}
            onReorderOrder={(order) => {
              setEditingOrder(null);
              setReorderSource(order);
              switchB2bTab('order', true);
            }}
            onGoToBecomeDealer={() => switchB2bTab('become-dealer', true)}
          />
        </section>
      ) : b2bTab === 'order' ? (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {dealerSession ? (
            <DealerOrderBuilder
              editingOrder={editingOrder}
              reorderSource={reorderSource}
              onCancelEdit={() => {
                setEditingOrder(null);
                switchB2bTab('portal', true);
              }}
              onOrderSaved={(_payload, isEdit) => {
                if (isEdit) {
                  setEditingOrder(null);
                }
                setReorderSource(null);
              }}
              onRequireSignIn={() => switchB2bTab('portal', true)}
            />
          ) : (
            <DealerPortalWorkspace
              gateTitle="Sign In to Create a Dealer Order"
              gateSubtitle="Only Admin-verified dealers can access the factory order builder and submit orders. Sign in with your User ID & Password below, or submit a Want to Become a Dealer application first."
              onCreateNewOrder={() => switchB2bTab('order', true)}
              onEditActiveOrder={(order) => {
                setEditingOrder(order);
                switchB2bTab('order', true);
              }}
              onReorderOrder={(order) => {
                setReorderSource(order);
                switchB2bTab('order', true);
              }}
              onGoToBecomeDealer={() => switchB2bTab('become-dealer', true)}
            />
          )}
        </section>
      ) : b2bTab === 'become-dealer' ? (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <BecomeDealerForm onGoToSignIn={() => switchB2bTab('portal', true)} />
        </section>
      ) : (
        <>
          {/* 3. COMPETITIVE EDGE (Why Partner With Hightone) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 pb-4 border-b border-[#e2e8f0] gap-4">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#64748b] block">
              COMPETITIVE EDGE
            </span>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#0F2E52]">
              Why Partner With Hightone
            </h2>
            <p className="text-xs sm:text-sm text-[#515f74] max-w-2xl mt-0.5">
              Direct-from-plant advantages designed for wholesale efficiency, resilient transport, and showroom commercial viability.
            </p>
          </div>

          <a
            href={sanitizePhoneForTel(companyInfo.primary_phone)}
            className="px-4 py-2 bg-[#0F2E52] hover:bg-[#1e3a5f] text-white text-xs font-semibold rounded-[2px] flex items-center space-x-1.5 self-start sm:self-auto transition-colors"
          >
            <PhoneCall className="w-3.5 h-3.5" />
            <span>Call Us</span>
          </a>
        </div>

        {/* 4 Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          
          {/* Card 1 */}
          <div className="bg-white border border-[#e2e8f0] p-6 rounded-[3px] flex flex-col justify-between space-y-5 hover:border-[#0F2E52] transition-colors">
            <div className="space-y-3">
              <div className="w-9 h-9 bg-[#f2f4f6] border border-[#e2e8f0] rounded-[2px] flex items-center justify-center text-[#0F2E52]">
                <Package className="w-4 h-4 text-[#0F2E52]" />
              </div>
              <h3 className="font-display font-bold text-base text-[#0F2E52]">
                Direct Kiln Pricing
              </h3>
              <p className="text-xs text-[#515f74] leading-relaxed">
                Factory-direct commercial margins with zero intermediary markups, ensuring maximal retail viability for regional showroom stockists.
              </p>
            </div>
            <div className="pt-2 border-t border-[#f1f5f9] text-[10px] font-mono text-[#64748b]">
              PRICING TIER: LEVEL 1 EX-FACTORY
            </div>
          </div>

          {/* Card 2 */}
          <div className="bg-white border border-[#e2e8f0] p-6 rounded-[3px] flex flex-col justify-between space-y-5 hover:border-[#0F2E52] transition-colors">
            <div className="space-y-3">
              <div className="w-9 h-9 bg-[#f2f4f6] border border-[#e2e8f0] rounded-[2px] flex items-center justify-center text-[#0F2E52]">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
              </div>
              <h3 className="font-display font-bold text-base text-[#0F2E52]">
                High-Grade Ceramic Glaze
              </h3>
              <p className="text-xs text-[#515f74] leading-relaxed">
                High-temperature kiln-fired vitrified body with smooth nano-glaze finish, engineered for lasting stain resistance and effortless cleaning.
              </p>
            </div>
            <div className="pt-2 border-t border-[#f1f5f9] text-[10px] font-mono text-[#64748b]">
              MANUFACTURING: 1,200°C KILN FIRED
            </div>
          </div>

          {/* Card 3 */}
          <div className="bg-white border border-[#e2e8f0] p-6 rounded-[3px] flex flex-col justify-between space-y-5 hover:border-[#0F2E52] transition-colors">
            <div className="space-y-3">
              <div className="w-9 h-9 bg-[#f2f4f6] border border-[#e2e8f0] rounded-[2px] flex items-center justify-center text-[#0F2E52]">
                <LayoutGrid className="w-4 h-4 text-[#0F2E52]" />
              </div>
              <h3 className="font-display font-bold text-base text-[#0F2E52]">
                Complete Catalog Supply
              </h3>
              <p className="text-xs text-[#515f74] leading-relaxed">
                One-piece closets, wall-hung suites, designer table-top wash basins, pedestals, and commercial urinals ready in aggregate bulk volume.
              </p>
            </div>
            <div className="pt-2 border-t border-[#f1f5f9] text-[10px] font-mono text-[#64748b]">
              CATEGORIES: 5 CORE SANITARY RANGES
            </div>
          </div>

          {/* Card 4 */}
          <div className="bg-white border border-[#e2e8f0] p-6 rounded-[3px] flex flex-col justify-between space-y-5 hover:border-[#0F2E52] transition-colors">
            <div className="space-y-3">
              <div className="w-9 h-9 bg-[#f2f4f6] border border-[#e2e8f0] rounded-[2px] flex items-center justify-center text-[#0F2E52]">
                <Truck className="w-4 h-4 text-cyan-600" />
              </div>
              <h3 className="font-display font-bold text-base text-[#0F2E52]">
                Responsive Factory Dispatch
              </h3>
              <p className="text-xs text-[#515f74] leading-relaxed">
                Direct access to Thangadh road freight networks, facilitating rapid truckload dispatches straight to your designated hub.
              </p>
            </div>
            <div className="pt-2 border-t border-[#f1f5f9] text-[10px] font-mono text-[#64748b]">
              TRANSIT: ROAD &amp; FREIGHT DIRECT
            </div>
          </div>

        </div>

      </section>


      {/* 4. WORKFLOW PROTOCOL (Streamlined 3-Step Partnership Process) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 pb-4 border-b border-[#e2e8f0] gap-4">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#64748b] block">
              WORKFLOW PROTOCOL
            </span>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#0F2E52]">
              Streamlined 3–Step Partnership Process
            </h2>
            <p className="text-xs sm:text-sm text-[#515f74] max-w-2xl mt-0.5">
              A frictionless procurement cycle connecting your order demand directly to the Thangadh plant floor.
            </p>
          </div>

          <a
            href={sanitizePhoneForTel(companyInfo.primary_phone)}
            className="px-4 py-2 bg-[#0F2E52] hover:bg-[#1e3a5f] text-white text-xs font-semibold rounded-[2px] flex items-center space-x-1.5 self-start sm:self-auto transition-colors"
          >
            <PhoneCall className="w-3.5 h-3.5" />
            <span>Call Us</span>
          </a>
        </div>

        {/* 3 Step Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Step 01 */}
          <div className="bg-white border border-[#e2e8f0] p-6 rounded-[3px] flex flex-col justify-between space-y-6 hover:border-[#0F2E52] transition-colors">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-[#0F2E52] uppercase px-2 py-0.5 bg-[#f2f4f6] rounded-[2px]">
                  STEP 01
                </span>
                <FileText className="w-4 h-4 text-[#64748b]" />
              </div>
              <h3 className="font-display font-bold text-lg text-[#0F2E52]">
                Submit Wholesale Requirement
              </h3>
              <p className="text-xs text-[#515f74] leading-relaxed">
                Specify requested sanitaryware models, piece quantities, and your destination PIN code via WhatsApp or the direct inquiry form.
              </p>
            </div>
            <div className="pt-2 border-t border-[#f1f5f9] text-[10px] font-mono text-[#64748b]">
              AVERAGE INPUT TIME: 2 MINUTES
            </div>
          </div>

          {/* Step 02 */}
          <div className="bg-white border border-[#e2e8f0] p-6 rounded-[3px] flex flex-col justify-between space-y-6 hover:border-[#0F2E52] transition-colors">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-[#0F2E52] uppercase px-2 py-0.5 bg-[#f2f4f6] rounded-[2px]">
                  STEP 02
                </span>
                <Clock className="w-4 h-4 text-[#64748b]" />
              </div>
              <h3 className="font-display font-bold text-lg text-[#0F2E52]">
                Instant Factory Quotation
              </h3>
              <p className="text-xs text-[#515f74] leading-relaxed">
                Receive competitive container or truckload pricing along with stock readiness confirmation directly from plant sales within 4 hours.
              </p>
            </div>
            <div className="pt-2 border-t border-[#f1f5f9] text-[10px] font-mono text-[#64748b]">
              RESPONSE WINDOW: WITHIN 4 HOURS
            </div>
          </div>

          {/* Step 03 */}
          <div className="bg-white border border-[#e2e8f0] p-6 rounded-[3px] flex flex-col justify-between space-y-6 hover:border-[#0F2E52] transition-colors">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-[#0F2E52] uppercase px-2 py-0.5 bg-[#f2f4f6] rounded-[2px]">
                  STEP 03
                </span>
                <Truck className="w-4 h-4 text-[#64748b]" />
              </div>
              <h3 className="font-display font-bold text-lg text-[#0F2E52]">
                Direct Factory Dispatch
              </h3>
              <p className="text-xs text-[#515f74] leading-relaxed">
                Direct factory loading and tracked freight coordination from our Thangadh unit directly to your showroom or regional godown.
              </p>
            </div>
            <div className="pt-2 border-t border-[#f1f5f9] text-[10px] font-mono text-[#64748b]">
              HANDOFF: DOORSTEP ROAD FREIGHT
            </div>
          </div>

        </div>

      </section>


      {/* 5. OFFICIAL PORTAL (Wholesale Dealer Inquiry) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 pb-4 border-b border-[#e2e8f0] gap-4">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#64748b] block">
              OFFICIAL PORTAL
            </span>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#0F2E52]">
              Wholesale Dealer Inquiry
            </h2>
            <p className="text-xs sm:text-sm text-[#515f74] max-w-2xl mt-0.5">
              Send your business specifics for customized commercial proposals or connect straight with Thangadh plant management.
            </p>
          </div>

          <a
            href={sanitizePhoneForTel(companyInfo.primary_phone)}
            className="px-4 py-2 bg-[#0F2E52] hover:bg-[#1e3a5f] text-white text-xs font-semibold rounded-[2px] flex items-center space-x-1.5 self-start sm:self-auto transition-colors"
          >
            <PhoneCall className="w-3.5 h-3.5" />
            <span>Call Us</span>
          </a>
        </div>

        {/* Portal Grid: Left Form, Right Contact & Map */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left: Interactive Inquiry Form (7 cols on lg) */}
          <div className="lg:col-span-7 bg-white border border-[#e2e8f0] p-6 sm:p-8 rounded-[3px] shadow-xs">
            {formSubmitted ? (
              <div className="py-8 text-center space-y-4">
                <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto border border-emerald-300">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="font-display font-bold text-xl text-[#0F2E52]">
                  Requirement Successfully Transmitted
                </h3>
                {savedInquiryId && (
                  <div className="flex items-center justify-center">
                    <span className="text-[11px] font-mono text-[#0F2E52] bg-slate-100 px-2.5 py-0.5 rounded border border-slate-200">
                      Reference ID: {savedInquiryId}
                    </span>
                  </div>
                )}
                <p className="text-xs text-[#515f74] max-w-md mx-auto leading-relaxed">
                  Thank you, <strong>{contactPerson}</strong>! Thangadh factory sales has logged your requirement for <strong>{businessName}</strong> in our dispatch records and will send direct commercial dealer slabs within 4 hours.
                </p>
                <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                  <a
                    href={getWhatsAppLink()}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-[2px] flex items-center space-x-2"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>Send Copy to Plant WhatsApp</span>
                  </a>
                  <button
                    onClick={() => {
                      setFormSubmitted(false);
                      setBusinessName('');
                      setContactPerson('');
                      setPhoneCode('+91');
                      setWhatsappNumber('');
                      setCountry('India');
                      setState('');
                      setDistrict('');
                      setCity('');
                      setCustomCity('');
                      setVolume('');
                      setProductInterest('');
                      setNotes('');
                      setTouched({
                        businessName: false,
                        contactPerson: false,
                        whatsappNumber: false,
                        country: false,
                        state: false,
                        district: false,
                        city: false,
                        customCity: false,
                        volume: false,
                        productInterest: false,
                        notes: false
                      });
                    }}
                    className="px-4 py-2 border border-[#cbd5e1] text-[#0F2E52] text-xs font-semibold rounded-[2px]"
                  >
                    Submit Another Inquiry
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleFormSubmit} className="space-y-4 text-xs">
                {formError && (
                  <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-[2px]">
                    {formError}
                  </div>
                )}

                {/* 1. Firm & Contact Person */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[#475569] mb-1">
                      BUSINESS / SHOWROOM NAME *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Apex Sanitary &amp; Ceramics"
                      value={businessName}
                      onBlur={() => setTouched((prev) => ({ ...prev, businessName: true }))}
                      onChange={(e) => {
                        setBusinessName(e.target.value);
                        if (!touched.businessName) setTouched((prev) => ({ ...prev, businessName: true }));
                      }}
                      className={`w-full px-3 py-2 bg-white border rounded-[2px] text-[#0F172A] text-xs transition-colors focus:outline-none ${
                        fieldErrors.businessName
                          ? 'border-red-500 bg-red-50/20 focus:border-red-600 focus:ring-1 focus:ring-red-400'
                          : businessName.trim()
                          ? 'border-emerald-400 focus:border-emerald-600'
                          : 'border-[#cbd5e1] focus:border-[#0F2E52]'
                      }`}
                    />
                    {fieldErrors.businessName && (
                      <p className="text-[10.5px] text-red-600 mt-1 flex items-center space-x-1 font-medium animate-in fade-in">
                        <AlertCircle className="w-3 h-3 text-red-500 shrink-0" />
                        <span>{fieldErrors.businessName}</span>
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[#475569] mb-1">
                      CONTACT PERSON *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Rajesh Patel"
                      value={contactPerson}
                      onBlur={() => setTouched((prev) => ({ ...prev, contactPerson: true }))}
                      onChange={(e) => {
                        setContactPerson(e.target.value);
                        if (!touched.contactPerson) setTouched((prev) => ({ ...prev, contactPerson: true }));
                      }}
                      className={`w-full px-3 py-2 bg-white border rounded-[2px] text-[#0F172A] text-xs transition-colors focus:outline-none ${
                        fieldErrors.contactPerson
                          ? 'border-red-500 bg-red-50/20 focus:border-red-600 focus:ring-1 focus:ring-red-400'
                          : contactPerson.trim()
                          ? 'border-emerald-400 focus:border-emerald-600'
                          : 'border-[#cbd5e1] focus:border-[#0F2E52]'
                      }`}
                    />
                    {fieldErrors.contactPerson && (
                      <p className="text-[10.5px] text-red-600 mt-1 flex items-center space-x-1 font-medium animate-in fade-in">
                        <AlertCircle className="w-3 h-3 text-red-500 shrink-0" />
                        <span>{fieldErrors.contactPerson}</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* 2. Mobile Dial Code & WhatsApp Mobile Number (Separated) */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#475569] mb-1">
                    WHATSAPP MOBILE NUMBER *
                  </label>
                  <div className="grid grid-cols-12 gap-2">
                    <div className="col-span-5 sm:col-span-4">
                      <select
                        value={phoneCode}
                        onChange={(e) => setPhoneCode(e.target.value)}
                        title="Select Country Mobile Code"
                        className="w-full px-2.5 py-2 bg-slate-50 border border-[#cbd5e1] rounded-[2px] text-[#0F172A] text-xs font-semibold focus:outline-none focus:border-[#0F2E52]"
                      >
                        {COUNTRY_DIAL_CODES.map((item) => (
                          <option key={`${item.code}-${item.country}`} value={item.code}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-7 sm:col-span-8">
                      <input
                        type="tel"
                        required
                        placeholder="e.g. 98765 43210"
                        value={whatsappNumber}
                        onBlur={() => setTouched((prev) => ({ ...prev, whatsappNumber: true }))}
                        onChange={(e) => {
                          setWhatsappNumber(e.target.value);
                          if (!touched.whatsappNumber) setTouched((prev) => ({ ...prev, whatsappNumber: true }));
                        }}
                        className={`w-full px-3 py-2 bg-white border rounded-[2px] text-[#0F172A] text-xs transition-colors focus:outline-none ${
                          fieldErrors.whatsappNumber
                            ? 'border-red-500 bg-red-50/20 focus:border-red-600 focus:ring-1 focus:ring-red-400'
                            : isPhoneValid
                            ? 'border-emerald-400 focus:border-emerald-600'
                            : 'border-[#cbd5e1] focus:border-[#0F2E52]'
                        }`}
                      />
                    </div>
                  </div>
                  {fieldErrors.whatsappNumber && (
                    <p className="text-[10.5px] text-red-600 mt-1 flex items-center space-x-1 font-medium animate-in fade-in">
                      <AlertCircle className="w-3 h-3 text-red-500 shrink-0" />
                      <span>{fieldErrors.whatsappNumber}</span>
                    </p>
                  )}
                </div>

                {/* 3. Prebuilt Dropdown: Country & State */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[#475569] mb-1">
                      COUNTRY *
                    </label>
                    <select
                      value={country}
                      onBlur={() => setTouched((prev) => ({ ...prev, country: true }))}
                      onChange={(e) => handleCountryChange(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-[#cbd5e1] rounded-[2px] text-[#0F172A] text-xs focus:outline-none focus:border-[#0F2E52]"
                    >
                      {COUNTRIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[#475569] mb-1">
                      STATE / PROVINCE *
                    </label>
                    {country === 'India' ? (
                      <select
                        required
                        value={state}
                        onBlur={() => setTouched((prev) => ({ ...prev, state: true }))}
                        onChange={(e) => handleStateChange(e.target.value)}
                        className={`w-full px-3 py-2 bg-white border rounded-[2px] text-xs focus:outline-none ${
                          !state ? 'text-slate-400' : 'text-[#0F172A]'
                        } ${fieldErrors.state ? 'border-red-500' : 'border-[#cbd5e1] focus:border-[#0F2E52]'}`}
                      >
                        <option value="">-- Select State / Province --</option>
                        {INDIAN_STATES.map((s) => (
                          <option key={s} value={s} className="text-[#0F172A]">
                            {s}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        required
                        placeholder="e.g. Dubai, Riyadh, London, California..."
                        value={state}
                        onBlur={() => setTouched((prev) => ({ ...prev, state: true }))}
                        onChange={(e) => {
                          setState(e.target.value);
                          if (!touched.state) setTouched((prev) => ({ ...prev, state: true }));
                        }}
                        className="w-full px-3 py-2 bg-white border border-[#cbd5e1] rounded-[2px] text-[#0F172A] text-xs focus:outline-none focus:border-[#0F2E52]"
                      />
                    )}
                    {fieldErrors.state && (
                      <p className="text-[10.5px] text-red-600 mt-1 flex items-center space-x-1 font-medium animate-in fade-in">
                        <AlertCircle className="w-3 h-3 text-red-500 shrink-0" />
                        <span>{fieldErrors.state}</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* 4. Prebuilt Dropdown: District & City */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[#475569] mb-1">
                      DISTRICT *
                    </label>
                    {country === 'India' ? (
                      <select
                        required
                        disabled={!state}
                        value={district}
                        onBlur={() => setTouched((prev) => ({ ...prev, district: true }))}
                        onChange={(e) => handleDistrictChange(e.target.value)}
                        className={`w-full px-3 py-2 bg-white border rounded-[2px] text-xs focus:outline-none disabled:bg-slate-50 disabled:text-slate-400 ${
                          !district ? 'text-slate-400' : 'text-[#0F172A]'
                        } ${fieldErrors.district ? 'border-red-500' : 'border-[#cbd5e1] focus:border-[#0F2E52]'}`}
                      >
                        <option value="">{state ? '-- Select District --' : '-- Select State First --'}</option>
                        {(country === 'India' && state ? getDistrictsForState(state) : []).map((d) => (
                          <option key={d} value={d} className="text-[#0F172A]">
                            {d}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        placeholder="e.g. Region or District"
                        value={district}
                        onBlur={() => setTouched((prev) => ({ ...prev, district: true }))}
                        onChange={(e) => {
                          setDistrict(e.target.value);
                          if (!touched.district) setTouched((prev) => ({ ...prev, district: true }));
                        }}
                        className="w-full px-3 py-2 bg-white border border-[#cbd5e1] rounded-[2px] text-[#0F172A] text-xs focus:outline-none focus:border-[#0F2E52]"
                      />
                    )}
                    {fieldErrors.district && (
                      <p className="text-[10.5px] text-red-600 mt-1 flex items-center space-x-1 font-medium animate-in fade-in">
                        <AlertCircle className="w-3 h-3 text-red-500 shrink-0" />
                        <span>{fieldErrors.district}</span>
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[#475569] mb-1">
                      CITY / TOWN *
                    </label>
                    {country === 'India' ? (
                      <select
                        required
                        disabled={!district}
                        value={city}
                        onBlur={() => setTouched((prev) => ({ ...prev, city: true }))}
                        onChange={(e) => {
                          setCity(e.target.value);
                          if (!touched.city) setTouched((prev) => ({ ...prev, city: true }));
                        }}
                        className={`w-full px-3 py-2 bg-white border rounded-[2px] text-xs focus:outline-none disabled:bg-slate-50 disabled:text-slate-400 ${
                          !city ? 'text-slate-400' : 'text-[#0F172A]'
                        } ${fieldErrors.city ? 'border-red-500' : 'border-[#cbd5e1] focus:border-[#0F2E52]'}`}
                      >
                        <option value="">{district ? '-- Select City / Town --' : '-- Select District First --'}</option>
                        {(country === 'India' && district ? getCitiesForDistrict(district, state) : []).map((c) => (
                          <option key={c} value={c} className="text-[#0F172A]">
                            {c}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        required
                        placeholder="e.g. City or Port Name"
                        value={city}
                        onBlur={() => setTouched((prev) => ({ ...prev, city: true }))}
                        onChange={(e) => {
                          setCity(e.target.value);
                          if (!touched.city) setTouched((prev) => ({ ...prev, city: true }));
                        }}
                        className="w-full px-3 py-2 bg-white border border-[#cbd5e1] rounded-[2px] text-[#0F172A] text-xs focus:outline-none focus:border-[#0F2E52]"
                      />
                    )}
                    {fieldErrors.city && (
                      <p className="text-[10.5px] text-red-600 mt-1 flex items-center space-x-1 font-medium animate-in fade-in">
                        <AlertCircle className="w-3 h-3 text-red-500 shrink-0" />
                        <span>{fieldErrors.city}</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* If "Other City" is selected in dropdown, allow typing custom city */}
                {city === 'Other City' && (
                  <div className="animate-in fade-in duration-200">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[#0F2E52] mb-1">
                      SPECIFY YOUR CITY / TOWN NAME *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Dhrangadhra, Chotila, Halvad, Barshi..."
                      value={customCity}
                      onBlur={() => setTouched((prev) => ({ ...prev, customCity: true }))}
                      onChange={(e) => {
                        setCustomCity(e.target.value);
                        if (!touched.customCity) setTouched((prev) => ({ ...prev, customCity: true }));
                      }}
                      className={`w-full px-3 py-2 bg-white border rounded-[2px] text-[#0F172A] text-xs transition-colors focus:outline-none ${
                        fieldErrors.customCity
                          ? 'border-red-500 bg-red-50/20 focus:border-red-600'
                          : customCity.trim()
                          ? 'border-emerald-400 focus:border-emerald-600'
                          : 'border-[#cbd5e1] focus:border-[#0F2E52]'
                      }`}
                    />
                    {fieldErrors.customCity && (
                      <p className="text-[10.5px] text-red-600 mt-1 flex items-center space-x-1 font-medium animate-in fade-in">
                        <AlertCircle className="w-3 h-3 text-red-500 shrink-0" />
                        <span>{fieldErrors.customCity}</span>
                      </p>
                    )}
                  </div>
                )}

                {/* 5. Volume & Product Interest */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[#475569] mb-1">
                      ESTIMATED VOLUME / REQUIREMENT *
                    </label>
                    <select
                      required
                      value={volume}
                      onBlur={() => setTouched((prev) => ({ ...prev, volume: true }))}
                      onChange={(e) => {
                        setVolume(e.target.value);
                        if (!touched.volume) setTouched((prev) => ({ ...prev, volume: true }));
                      }}
                      className={`w-full px-3 py-2 bg-white border rounded-[2px] text-xs focus:outline-none ${
                        !volume ? 'text-slate-400' : 'text-[#0F172A]'
                      } ${fieldErrors.volume ? 'border-red-500' : 'border-[#cbd5e1] focus:border-[#0F2E52]'}`}
                    >
                      <option value="">-- Select Estimated Volume --</option>
                      <option value="Trial Batch (50 - 100 Units)" className="text-[#0F172A]">Trial Batch (50 - 100 Units)</option>
                      <option value="Half Truckload (150 - 250 Units)" className="text-[#0F172A]">Half Truckload (150 - 250 Units)</option>
                      <option value="Full Truckload (300+ Units)" className="text-[#0F172A]">Full Truckload (300+ Units)</option>
                      <option value="Container Export Batch" className="text-[#0F172A]">Container Export Batch</option>
                      <option value="Regular Monthly Distributorship" className="text-[#0F172A]">Regular Monthly Distributorship</option>
                    </select>
                    {fieldErrors.volume && (
                      <p className="text-[10.5px] text-red-600 mt-1 flex items-center space-x-1 font-medium animate-in fade-in">
                        <AlertCircle className="w-3 h-3 text-red-500 shrink-0" />
                        <span>{fieldErrors.volume}</span>
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[#475569] mb-1">
                      PRODUCT INTEREST *
                    </label>
                    <select
                      required
                      value={productInterest}
                      onBlur={() => setTouched((prev) => ({ ...prev, productInterest: true }))}
                      onChange={(e) => {
                        setProductInterest(e.target.value);
                        if (!touched.productInterest) setTouched((prev) => ({ ...prev, productInterest: true }));
                      }}
                      className={`w-full px-3 py-2 bg-white border rounded-[2px] text-xs focus:outline-none ${
                        !productInterest ? 'text-slate-400' : 'text-[#0F172A]'
                      } ${fieldErrors.productInterest ? 'border-red-500' : 'border-[#cbd5e1] focus:border-[#0F2E52]'}`}
                    >
                      <option value="">-- Select Product Interest --</option>
                      <option value="Complete Ceramic Sanitaryware Catalog" className="text-[#0F172A]">Complete Ceramic Sanitaryware Catalog</option>
                      <option value="One Piece Closets" className="text-[#0F172A]">One Piece Closets</option>
                      <option value="Wall Hung Closets" className="text-[#0F172A]">Wall Hung Closets</option>
                      <option value="Table Top Basins" className="text-[#0F172A]">Table Top Basins</option>
                      <option value="Wash Basin with Pedestal" className="text-[#0F172A]">Wash Basin with Pedestal</option>
                      <option value="Commercial Urinals" className="text-[#0F172A]">Commercial Urinals</option>
                    </select>
                    {fieldErrors.productInterest && (
                      <p className="text-[10.5px] text-red-600 mt-1 flex items-center space-x-1 font-medium animate-in fade-in">
                        <AlertCircle className="w-3 h-3 text-red-500 shrink-0" />
                        <span>{fieldErrors.productInterest}</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* 6. Specific Notes */}
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#475569] mb-1">
                    SPECIFIC NOTES OR MODELS NEEDED *
                  </label>
                  <textarea
                    rows={3}
                    required
                    placeholder="Provide details regarding target schedule, required models, or delivery hub..."
                    value={notes}
                    onBlur={() => setTouched((prev) => ({ ...prev, notes: true }))}
                    onChange={(e) => {
                      setNotes(e.target.value);
                      if (!touched.notes) setTouched((prev) => ({ ...prev, notes: true }));
                    }}
                    className={`w-full px-3 py-2 bg-white border rounded-[2px] text-[#0F172A] text-xs transition-colors focus:outline-none ${
                      fieldErrors.notes
                        ? 'border-red-500 bg-red-50/20 focus:border-red-600 focus:ring-1 focus:ring-red-400'
                        : notes.trim()
                        ? 'border-emerald-400 focus:border-emerald-600'
                        : 'border-[#cbd5e1] focus:border-[#0F2E52]'
                    }`}
                  />
                  {fieldErrors.notes && (
                    <p className="text-[10.5px] text-red-600 mt-1 flex items-center space-x-1 font-medium animate-in fade-in">
                      <AlertCircle className="w-3 h-3 text-red-500 shrink-0" />
                      <span>{fieldErrors.notes}</span>
                    </p>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="pt-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 border-t border-slate-100 mt-2">
                  <button
                    type="submit"
                    disabled={!isFormComplete || isSubmitting}
                    title={!isFormComplete ? 'Please complete all required fields above' : undefined}
                    className={`w-full sm:flex-1 py-3 px-4 font-semibold rounded-[3px] border transition-all flex items-center justify-center space-x-2 ${
                      !isFormComplete || isSubmitting
                        ? 'bg-slate-100 border-slate-300 text-slate-400 cursor-not-allowed opacity-60'
                        : 'bg-[#0F2E52] hover:bg-[#1e3a5f] text-white border-[#0F2E52] cursor-pointer shadow-xs active:scale-[0.99]'
                    }`}
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isSubmitting ? 'Saving to Factory Sheet...' : 'Submit Wholesale Inquiry'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleWhatsAppClick}
                    disabled={!isFormComplete}
                    title={!isFormComplete ? 'Please complete all required fields above' : undefined}
                    className={`w-full sm:flex-1 py-3 px-4 font-bold rounded-[3px] transition-all flex items-center justify-center space-x-2 text-center ${
                      !isFormComplete
                        ? 'border-2 border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed opacity-60'
                        : 'border-2 border-emerald-600 hover:bg-emerald-50 bg-white text-emerald-700 cursor-pointer shadow-xs active:scale-[0.99]'
                    }`}
                  >
                    <MessageSquare className="w-4 h-4 text-emerald-600 fill-emerald-100 shrink-0" />
                    <span>Quick Chat on WhatsApp</span>
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Right: Direct Manufacturing Hub Card & Schematic Map (5 cols on lg) */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Manufacturing Hub Card */}
            <div className="bg-[#f8fafc] border border-[#e2e8f0] p-6 rounded-[3px] space-y-4">
              <div className="flex items-center justify-between border-b border-[#e2e8f0] pb-3">
                <div>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-[#64748b] font-bold block">
                    DIRECT MANUFACTURING HUB
                  </span>
                  <h3 className="font-display font-bold text-base text-[#0F2E52]">
                    Thangadh Production Unit
                  </h3>
                </div>
                <div className="w-8 h-8 rounded-[2px] bg-white border border-[#cbd5e1] flex items-center justify-center text-[#0F2E52]">
                  <Navigation className="w-4 h-4" />
                </div>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="font-semibold text-[#0F2E52] block uppercase text-[10px] tracking-wide">
                    FACTORY LOCATION
                  </span>
                  <p className="text-[#515f74]">
                    {addressText}
                  </p>
                  <div className="flex items-center space-x-3 pt-1.5 text-[11px]">
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center space-x-1 text-[#0F2E52] font-semibold hover:underline"
                    >
                      <span>Open Maps</span>
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
                      <span>Directions</span>
                    </a>
                  </div>
                </div>

                <div>
                  <span className="font-semibold text-[#0F2E52] block uppercase text-[10px] tracking-wide">
                    DIRECT PHONE
                  </span>
                  <a href={sanitizePhoneForTel(companyInfo.primary_phone)} className="text-[#0F2E52] font-bold hover:underline">
                    {formatDisplayPhone(companyInfo.primary_phone)}
                  </a>
                </div>

                <div>
                  <span className="font-semibold text-[#0F2E52] block uppercase text-[10px] tracking-wide">
                    EMAIL
                  </span>
                  <a href="mailto:hightoneceramic@gmail.com" className="text-[#515f74] hover:underline">
                    hightoneceramic@gmail.com
                  </a>
                </div>

                <div>
                  <span className="font-semibold text-[#0F2E52] block uppercase text-[10px] tracking-wide">
                    DISPATCH DESK HOURS
                  </span>
                  <p className="text-[#515f74]">
                    Mon – Sat: 9:00 AM – 7:00 PM
                  </p>
                </div>
              </div>

              <div className="pt-2">
                <a
                  href={sanitizePhoneForTel(companyInfo.primary_phone)}
                  className="w-full py-2.5 px-4 bg-white border border-[#cbd5e1] hover:border-[#0F2E52] text-[#0F2E52] text-xs font-semibold rounded-[2px] flex items-center justify-center space-x-1.5 transition-colors text-center"
                >
                  <PhoneCall className="w-3.5 h-3.5" />
                  <span>Call Us</span>
                </a>
              </div>
            </div>



          </div>

        </div>

      </section>


      {/* 6. COMMERCIAL CLARITY (Wholesale FAQ) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 pb-4 border-b border-[#e2e8f0] gap-4">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#64748b] block">
              COMMERCIAL CLARITY
            </span>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#0F2E52]">
              Wholesale FAQ
            </h2>
            <p className="text-xs sm:text-sm text-[#515f74] max-w-2xl mt-0.5">
              Direct operational guidelines for showroom sample requests and physical catalogues.
            </p>
          </div>

          <a
            href={sanitizePhoneForTel(companyInfo.primary_phone)}
            className="px-4 py-2 bg-[#0F2E52] hover:bg-[#1e3a5f] text-white text-xs font-semibold rounded-[2px] flex items-center space-x-1.5 self-start sm:self-auto transition-colors"
          >
            <PhoneCall className="w-3.5 h-3.5" />
            <span>Call Us</span>
          </a>
        </div>

        {/* Accordions */}
        <div className="space-y-3 max-w-4xl">
          {faqs.map((faq, idx) => {
            const isOpen = openFaqIndex === idx;
            return (
              <div
                key={idx}
                className="bg-white border border-[#e2e8f0] rounded-[2px] overflow-hidden transition-colors"
              >
                <button
                  onClick={() => toggleFaq(idx)}
                  className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-4 cursor-pointer hover:bg-[#f8fafc] transition-colors"
                >
                  <span className="font-display font-semibold text-xs sm:text-sm text-[#0F2E52]">
                    {faq.question}
                  </span>
                  {isOpen ? (
                    <ChevronUp className="w-4 h-4 text-[#64748b] shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-[#64748b] shrink-0" />
                  )}
                </button>

                {isOpen && (
                  <div className="px-4 sm:px-5 pb-5 pt-1 text-xs text-[#515f74] leading-relaxed border-t border-[#f1f5f9] bg-[#f8fafc]">
                    {faq.answer}
                  </div>
                )}
              </div>
            );
          })}
        </div>

      </section>
        </>
      )}

      {/* 7. PRE-FOOTER FULL CTA BAR */}
      <section className="bg-[#001936] text-white py-12 px-4 sm:px-6 lg:px-8 border-y border-[#0F2E52]">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center md:text-left">
            <span className="text-[10px] font-mono uppercase tracking-widest text-cyan-300 font-semibold block">
              EX-FACTORY SUPPLY DIRECT
            </span>
            <h2 className="font-display text-2xl sm:text-3xl font-bold">
              Direct Ceramic Orders &amp; Dealer Inquiries
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-xl">
              Connect directly with our Thangadh factory team today. Secure priority wholesale quotations, prompt stock verification, and dependable freight solutions.
            </p>
          </div>

          <div>
            <a
              href={sanitizePhoneForTel(companyInfo.primary_phone)}
              className="px-6 py-3 bg-white hover:bg-slate-100 text-[#001936] text-xs font-bold rounded-[3px] flex items-center space-x-2 transition-colors"
            >
              <PhoneCall className="w-3.5 h-3.5" />
              <span>Call Us</span>
            </a>
          </div>
        </div>
      </section>

    </div>
  );
};
