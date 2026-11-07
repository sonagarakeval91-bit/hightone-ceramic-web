import React, { useState } from 'react';
import { PageId, B2BInquiryPayload } from '../../types';
import { useWebsiteData } from '../../context/DataContext';
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
  Navigation
} from 'lucide-react';
import { sanitizePhoneForTel, sanitizePhoneForWhatsApp, formatDisplayPhone } from '../../utils/phone';
import { DEFAULT_COMPANY_INFO, getGoogleMapsDirectionsUrl } from '../../services/googleSheetsService';

interface B2BDealersPageProps {
  onNavigate: (page: PageId) => void;
  onOpenQuote: () => void;
}

export const B2BDealersPage: React.FC<B2BDealersPageProps> = ({
  onNavigate,
  onOpenQuote
}) => {
  const { faqs, siteMedia, recordInquiry, companyInfo } = useWebsiteData();
  const addressText = companyInfo.factory_address || DEFAULT_COMPANY_INFO.factory_address;
  const directionsUrl = getGoogleMapsDirectionsUrl(companyInfo);
  const mapsUrl = directionsUrl;
  // Accordion state
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  // Form state
  const [formData, setFormData] = useState<B2BInquiryPayload>({
    businessName: '',
    contactPerson: '',
    whatsappNumber: '',
    cityState: '',
    volume: 'Trial Batch (50 - 100 Units)',
    productInterest: 'Complete Ceramic Sanitaryware Catalog',
    notes: ''
  });

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
    cityState: false,
    volume: false,
    notes: false
  });

  const markAllTouched = () => {
    setTouched({
      businessName: true,
      contactPerson: true,
      whatsappNumber: true,
      cityState: true,
      volume: true,
      notes: true
    });
  };

  // Real-time calculation of missing required details
  const cleanPhone = formData.whatsappNumber.replace(/\D/g, '');
  const missingDetails: string[] = [];
  if (!formData.businessName.trim()) missingDetails.push('Firm / Business Name');
  if (!formData.contactPerson.trim()) missingDetails.push('Contact Person Name');
  if (!formData.whatsappNumber.trim()) {
    missingDetails.push('WhatsApp Number');
  } else if (cleanPhone.length < 10) {
    missingDetails.push('Valid 10-Digit WhatsApp Number');
  }
  if (!formData.cityState.trim()) missingDetails.push('Destination City & State');
  if (!formData.volume.trim()) missingDetails.push('Requirement / Volume');
  if (!formData.notes.trim()) missingDetails.push('Specific Notes or Models Needed');

  const isFormComplete = missingDetails.length === 0;

  // Inline field-level validation errors (shown before submission upon interaction/blur)
  const fieldErrors = {
    businessName: touched.businessName && !formData.businessName.trim()
      ? 'Firm or business name is required (e.g. Apex Sanitary & Ceramics)'
      : null,
    contactPerson: touched.contactPerson && !formData.contactPerson.trim()
      ? 'Contact person name is required (e.g. Rajesh Patel)'
      : null,
    whatsappNumber: (() => {
      const raw = formData.whatsappNumber.trim();
      if (touched.whatsappNumber && !raw) return 'WhatsApp number is required';
      if (raw && cleanPhone.length < 10) {
        return `Please enter a valid 10-digit number (currently ${cleanPhone.length}/10 digits)`;
      }
      return null;
    })(),
    cityState: touched.cityState && !formData.cityState.trim()
      ? 'City & state is required (e.g. Ahmedabad, Gujarat)'
      : null,
    volume: touched.volume && !formData.volume.trim()
      ? 'Please select an estimated batch or volume requirement'
      : null,
    notes: touched.notes && !formData.notes.trim()
      ? 'Specific model details, finishes, or dispatch schedule are required'
      : null
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    markAllTouched();
    setFormError('');

    if (!isFormComplete) {
      setFormError(`Please complete all highlighted fields before submitting: ${missingDetails.join(', ')}`);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await recordInquiry(formData, 'B2B Wholesale Portal Page');
      setSavedInquiryId(res.id);
      setIsSubmitting(false);
      setFormSubmitted(true);
    } catch (err) {
      console.error('Failed to record inquiry:', err);
      setIsSubmitting(false);
      setFormSubmitted(true);
    }
  };

  const getWhatsAppLink = () => {
    const text = `*Hightone Ceramic - B2B Wholesale Portal Inquiry*\n\n` +
      `*Showroom/Firm:* ${formData.businessName || 'N/A'}\n` +
      `*Contact Person:* ${formData.contactPerson || 'N/A'}\n` +
      `*Location:* ${formData.cityState || 'N/A'}\n` +
      `*Volume Needed:* ${formData.volume}\n` +
      `*Product Segment:* ${formData.productInterest}\n` +
      `*Notes & Models:* ${formData.notes || 'N/A'}\n\n` +
      `Please share latest ex-factory price slabs and dispatch schedule.`;

    return `https://wa.me/${sanitizePhoneForWhatsApp(companyInfo.primary_phone)}?text=${encodeURIComponent(text)}`;
  };

  const handleWhatsAppClick = () => {
    markAllTouched();
    if (!isFormComplete) {
      setFormError(`Cannot start WhatsApp chat yet. Please fill highlighted details: ${missingDetails.join(', ')}`);
      return;
    }

    try {
      recordInquiry(formData, 'B2B Wholesale Portal WhatsApp').catch(() => {});
    } catch {}

    const link = getWhatsAppLink();
    window.open(link, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="space-y-16 sm:space-y-24 pb-12">
      
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

            {/* CTA Button */}
            <div className="pt-1">
              <a
                href={sanitizePhoneForTel(companyInfo.primary_phone)}
                className="inline-flex items-center space-x-2 px-5 py-3 bg-[#f8fafc] hover:bg-[#0F2E52] hover:text-white text-[#0F2E52] border border-[#cbd5e1] rounded-[3px] text-xs font-semibold transition-colors shadow-xs"
              >
                <PhoneCall className="w-3.5 h-3.5" />
                <span>Call Us</span>
              </a>
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
                  Thank you, <strong>{formData.contactPerson}</strong>! Thangadh factory sales has logged your requirement for <strong>{formData.businessName}</strong> in our dispatch records and will send direct commercial dealer slabs within 4 hours.
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
                      setFormData({
                        businessName: '',
                        contactPerson: '',
                        whatsappNumber: '',
                        cityState: '',
                        volume: 'Trial Batch (50 - 100 Units)',
                        productInterest: 'Complete Ceramic Sanitaryware Catalog',
                        notes: ''
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[#475569] mb-1">
                      BUSINESS / SHOWROOM NAME *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Apex Sanitary &amp; Ceramics"
                      value={formData.businessName}
                      onBlur={() => setTouched((prev) => ({ ...prev, businessName: true }))}
                      onChange={(e) => {
                        setFormData({ ...formData, businessName: e.target.value });
                        if (!touched.businessName) setTouched((prev) => ({ ...prev, businessName: true }));
                      }}
                      className={`w-full px-3 py-2 bg-white border rounded-[2px] text-[#0F172A] text-xs transition-colors focus:outline-none ${
                        fieldErrors.businessName
                          ? 'border-red-500 bg-red-50/20 focus:border-red-600 focus:ring-1 focus:ring-red-400'
                          : formData.businessName.trim()
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
                      value={formData.contactPerson}
                      onBlur={() => setTouched((prev) => ({ ...prev, contactPerson: true }))}
                      onChange={(e) => {
                        setFormData({ ...formData, contactPerson: e.target.value });
                        if (!touched.contactPerson) setTouched((prev) => ({ ...prev, contactPerson: true }));
                      }}
                      className={`w-full px-3 py-2 bg-white border rounded-[2px] text-[#0F172A] text-xs transition-colors focus:outline-none ${
                        fieldErrors.contactPerson
                          ? 'border-red-500 bg-red-50/20 focus:border-red-600 focus:ring-1 focus:ring-red-400'
                          : formData.contactPerson.trim()
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[#475569] mb-1">
                      WHATSAPP NUMBER *
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="+91 98765 43210"
                      value={formData.whatsappNumber}
                      onBlur={() => setTouched((prev) => ({ ...prev, whatsappNumber: true }))}
                      onChange={(e) => {
                        setFormData({ ...formData, whatsappNumber: e.target.value });
                        if (!touched.whatsappNumber) setTouched((prev) => ({ ...prev, whatsappNumber: true }));
                      }}
                      className={`w-full px-3 py-2 bg-white border rounded-[2px] text-[#0F172A] text-xs transition-colors focus:outline-none ${
                        fieldErrors.whatsappNumber
                          ? 'border-red-500 bg-red-50/20 focus:border-red-600 focus:ring-1 focus:ring-red-400'
                          : cleanPhone.length >= 10
                          ? 'border-emerald-400 focus:border-emerald-600'
                          : 'border-[#cbd5e1] focus:border-[#0F2E52]'
                      }`}
                    />
                    {fieldErrors.whatsappNumber && (
                      <p className="text-[10.5px] text-red-600 mt-1 flex items-center space-x-1 font-medium animate-in fade-in">
                        <AlertCircle className="w-3 h-3 text-red-500 shrink-0" />
                        <span>{fieldErrors.whatsappNumber}</span>
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[#475569] mb-1">
                      CITY &amp; STATE *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Ahmedabad, Gujarat"
                      value={formData.cityState}
                      onBlur={() => setTouched((prev) => ({ ...prev, cityState: true }))}
                      onChange={(e) => {
                        setFormData({ ...formData, cityState: e.target.value });
                        if (!touched.cityState) setTouched((prev) => ({ ...prev, cityState: true }));
                      }}
                      className={`w-full px-3 py-2 bg-white border rounded-[2px] text-[#0F172A] text-xs transition-colors focus:outline-none ${
                        fieldErrors.cityState
                          ? 'border-red-500 bg-red-50/20 focus:border-red-600 focus:ring-1 focus:ring-red-400'
                          : formData.cityState.trim()
                          ? 'border-emerald-400 focus:border-emerald-600'
                          : 'border-[#cbd5e1] focus:border-[#0F2E52]'
                      }`}
                    />
                    {fieldErrors.cityState && (
                      <p className="text-[10.5px] text-red-600 mt-1 flex items-center space-x-1 font-medium animate-in fade-in">
                        <AlertCircle className="w-3 h-3 text-red-500 shrink-0" />
                        <span>{fieldErrors.cityState}</span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-[#475569] mb-1">
                      ESTIMATED VOLUME / REQUIREMENT *
                    </label>
                    <select
                      required
                      value={formData.volume}
                      onBlur={() => setTouched((prev) => ({ ...prev, volume: true }))}
                      onChange={(e) => {
                        setFormData({ ...formData, volume: e.target.value });
                        if (!touched.volume) setTouched((prev) => ({ ...prev, volume: true }));
                      }}
                      className={`w-full px-3 py-2 bg-white border rounded-[2px] text-[#0F172A] text-xs focus:outline-none ${
                        fieldErrors.volume
                          ? 'border-red-500 bg-red-50/20 focus:border-red-600'
                          : 'border-[#cbd5e1] focus:border-[#0F2E52]'
                      }`}
                    >
                      <option value="Trial Batch (50 - 100 Units)">Trial Batch (50 - 100 Units)</option>
                      <option value="Half Truckload (150 - 250 Units)">Half Truckload (150 - 250 Units)</option>
                      <option value="Full Truckload (300+ Units)">Full Truckload (300+ Units)</option>
                      <option value="Container Export Batch">Container Export Batch</option>
                      <option value="Regular Monthly Distributorship">Regular Monthly Distributorship</option>
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
                      value={formData.productInterest}
                      onChange={(e) => setFormData({ ...formData, productInterest: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-[#cbd5e1] rounded-[2px] text-[#0F172A] text-xs focus:outline-none focus:border-[#0F2E52]"
                    >
                      <option value="Complete Ceramic Sanitaryware Catalog">Complete Ceramic Sanitaryware Catalog</option>
                      <option value="One Piece Closets">One Piece Closets</option>
                      <option value="Wall Hung Closets">Wall Hung Closets</option>
                      <option value="Table Top Basins">Table Top Basins</option>
                      <option value="Wash Basin with Pedestal">Wash Basin with Pedestal</option>
                      <option value="Commercial Urinals">Commercial Urinals</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#475569] mb-1">
                    SPECIFIC NOTES OR MODELS NEEDED *
                  </label>
                  <textarea
                    rows={3}
                    required
                    placeholder="Provide details regarding target schedule, required models, or delivery hub..."
                    value={formData.notes}
                    onBlur={() => setTouched((prev) => ({ ...prev, notes: true }))}
                    onChange={(e) => {
                      setFormData({ ...formData, notes: e.target.value });
                      if (!touched.notes) setTouched((prev) => ({ ...prev, notes: true }));
                    }}
                    className={`w-full px-3 py-2 bg-white border rounded-[2px] text-[#0F172A] text-xs transition-colors focus:outline-none ${
                      fieldErrors.notes
                        ? 'border-red-500 bg-red-50/20 focus:border-red-600 focus:ring-1 focus:ring-red-400'
                        : formData.notes.trim()
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

                {/* Dynamic Missing Details Suggestion & Completion Box */}
                {!isFormComplete ? (
                  <div className="p-3 bg-amber-50/90 border border-amber-300/80 rounded-[3px] text-xs space-y-1.5 text-amber-950 animate-in fade-in">
                    <div className="flex items-center space-x-1.5 font-semibold text-amber-900">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Please fill in all details to unlock Submit &amp; WhatsApp:</span>
                    </div>
                    <p className="text-[11px] text-amber-800 leading-snug">
                      Missing {missingDetails.length} required {missingDetails.length === 1 ? 'detail' : 'details'}:
                    </p>
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {missingDetails.map((field) => (
                        <span
                          key={field}
                          className="inline-flex items-center px-2 py-0.5 bg-white border border-amber-300 rounded text-[10.5px] font-semibold text-amber-900 shadow-2xs"
                        >
                          • {field}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="p-2.5 bg-emerald-50 border border-emerald-300/80 rounded-[3px] text-xs text-emerald-900 flex items-center space-x-2 animate-in fade-in">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="font-semibold text-[11.5px]">
                      All details completed! You can now submit your wholesale inquiry or chat on WhatsApp.
                    </span>
                  </div>
                )}

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
