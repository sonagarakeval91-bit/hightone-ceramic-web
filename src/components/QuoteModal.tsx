import React, { useState } from 'react';
import { X, Send, CheckCircle2, MessageSquare, AlertCircle } from 'lucide-react';
import { B2BInquiryPayload } from '../types';
import { useWebsiteData } from '../context/DataContext';
import { sanitizePhoneForWhatsApp, formatDisplayPhone } from '../utils/phone';

interface QuoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialProductInterest?: string;
  onSubmitted?: (payload: B2BInquiryPayload) => void;
}

export const QuoteModal: React.FC<QuoteModalProps> = ({
  isOpen,
  onClose,
  initialProductInterest = 'Complete Ceramic Sanitaryware Catalog',
  onSubmitted
}) => {
  const { recordInquiry, companyInfo } = useWebsiteData();

  const [formData, setFormData] = useState<B2BInquiryPayload>({
    businessName: '',
    contactPerson: '',
    whatsappNumber: '',
    cityState: '',
    volume: 'Trial Batch (50 - 100 Units)',
    productInterest: initialProductInterest,
    notes: ''
  });

  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [savedInquiryId, setSavedInquiryId] = useState<string>('');

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
  if (!formData.volume.trim()) missingDetails.push('Required Volume / Batch Size');
  if (!formData.notes.trim()) missingDetails.push('Specific Notes or Models Needed');

  const isFormComplete = missingDetails.length === 0;

  // Inline field-level validation errors (shown before submission upon interaction/blur)
  const fieldErrors = {
    businessName: touched.businessName && !formData.businessName.trim()
      ? 'Firm or business name is required (e.g. Apex Ceramics & Bath)'
      : null,
    contactPerson: touched.contactPerson && !formData.contactPerson.trim()
      ? 'Contact person name is required (e.g. Rajesh Shah)'
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
      ? 'Destination city & state is required (e.g. Indore, Madhya Pradesh)'
      : null,
    volume: touched.volume && !formData.volume.trim()
      ? 'Please select your required batch or order volume'
      : null,
    notes: touched.notes && !formData.notes.trim()
      ? 'Please specify required models, finishes, or target schedule'
      : null
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    markAllTouched();
    setErrorMsg('');

    if (!isFormComplete) {
      setErrorMsg(`Please complete all highlighted fields: ${missingDetails.join(', ')}`);
      return;
    }

    setLoading(true);

    try {
      const res = await recordInquiry(formData, `Quote Modal: ${formData.productInterest}`);
      setSavedInquiryId(res.id);
      setLoading(false);
      setSubmitted(true);
      if (onSubmitted) {
        onSubmitted({ ...formData, timestamp: new Date().toISOString() });
      }
    } catch (err) {
      console.error('Error submitting inquiry:', err);
      setLoading(false);
      setSubmitted(true);
    }
  };

  const getWhatsAppDirectLink = () => {
    const text = `*New Factory Wholesale Inquiry - Hightone Ceramic*\n\n` +
      `*Business:* ${formData.businessName || 'N/A'}\n` +
      `*Contact Person:* ${formData.contactPerson || 'N/A'}\n` +
      `*WhatsApp Phone:* ${formData.whatsappNumber || 'N/A'}\n` +
      `*City/State:* ${formData.cityState || 'N/A'}\n` +
      `*Volume:* ${formData.volume}\n` +
      `*Interest:* ${formData.productInterest}\n` +
      `*Notes & Models:* ${formData.notes || 'N/A'}\n\n` +
      `Please provide ex-factory quotation and stock availability.`;

    return `https://wa.me/${sanitizePhoneForWhatsApp(companyInfo.primary_phone)}?text=${encodeURIComponent(text)}`;
  };

  const handleWhatsAppClick = () => {
    markAllTouched();
    if (!isFormComplete) {
      setErrorMsg(`Cannot start WhatsApp chat yet. Please fill highlighted details: ${missingDetails.join(', ')}`);
      return;
    }

    // Auto-record in desk sheet so inquiry is never lost
    try {
      recordInquiry(formData, `Quote Modal WhatsApp: ${formData.productInterest}`).catch(() => {});
    } catch {}

    const link = getWhatsAppDirectLink();
    window.open(link, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 md:p-6 bg-[#001936]/65 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white border border-[#cbd5e1] rounded-[4px] max-w-xl w-full max-h-[92dvh] sm:max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Modal Header (Fixed at top) */}
        <div className="px-5 py-3.5 sm:px-6 sm:py-4 bg-[#0F2E52] text-white flex items-center justify-between shrink-0 border-b border-[#1e3a5f]">
          <div>
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-cyan-300">
                Direct Plant Procurement
              </span>
            </div>
            <h2 className="text-base sm:text-xl font-display font-bold leading-tight mt-0.5">
              Request Factory Wholesale Quote
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-[3px] text-slate-300 hover:text-white hover:bg-[#1e3a5f] transition-colors cursor-pointer"
            aria-label="Close quote modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body (Scrollable on mobile & tablet) */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 overscroll-contain">
          {submitted ? (
            <div className="text-center py-4 sm:py-6 space-y-4">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto border border-emerald-300 shadow-xs">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              
              <div className="space-y-1">
                <h3 className="text-lg sm:text-xl font-display font-bold text-[#0F2E52]">
                  Inquiry Transmitted to Thangadh Plant Desk
                </h3>
                {savedInquiryId && (
                  <p className="text-[11px] font-mono text-slate-500">
                    Reference ID: <strong className="text-[#0F2E52]">{savedInquiryId}</strong>
                  </p>
                )}
              </div>

              <div className="bg-[#f8fafc] border border-[#e2e8f0] rounded-[3px] p-3.5 max-w-md mx-auto text-left text-xs space-y-1.5 text-[#334155]">
                <p>
                  <strong>Firm:</strong> {formData.businessName} ({formData.contactPerson})
                </p>
                <p>
                  <strong>WhatsApp:</strong> {formData.whatsappNumber} | <strong>City:</strong> {formData.cityState || 'India'}
                </p>
                <p>
                  <strong>Item:</strong> {formData.productInterest}
                </p>
                <p className="text-[11px] text-[#64748b] pt-1 border-t border-[#e2e8f0]">
                  Our commercial sales desk will evaluate stock availability and send direct ex-factory rates within 4 hours.
                </p>
              </div>

              {/* Action Buttons in Confirmation */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-2.5">
                <a
                  href={getWhatsAppDirectLink()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-[3px] flex items-center justify-center space-x-2 transition-colors shadow-xs"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Send Copy on WhatsApp ({formatDisplayPhone(companyInfo.primary_phone)})</span>
                </a>
                <button
                  onClick={onClose}
                  className="w-full sm:w-auto px-5 py-2.5 border border-[#cbd5e1] text-[#0F2E52] text-xs font-semibold rounded-[3px] hover:bg-[#f8fafc] transition-colors cursor-pointer"
                >
                  Close Window
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              {errorMsg && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-[3px]">
                  {errorMsg}
                </div>
              )}

              {/* Product Reference */}
              <div className="bg-[#f8fafc] p-3 rounded-[3px] border border-[#e2e8f0]">
                <span className="block text-[10px] font-mono text-[#64748b] uppercase tracking-wider mb-1">
                  Product / Series Reference
                </span>
                <p className="font-bold text-[#0F2E52] text-xs sm:text-sm">
                  {formData.productInterest}
                </p>
              </div>

              {/* 2-Column Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#475569] mb-1">
                    Firm / Business Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Apex Ceramics &amp; Bath"
                    value={formData.businessName}
                    onBlur={() => setTouched((prev) => ({ ...prev, businessName: true }))}
                    onChange={(e) => {
                      setFormData({ ...formData, businessName: e.target.value });
                      if (!touched.businessName) setTouched((prev) => ({ ...prev, businessName: true }));
                    }}
                    className={`w-full px-3 py-2 bg-white border rounded-[3px] text-[#0F172A] text-xs transition-colors focus:outline-none ${
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
                    Contact Person Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rajesh Shah"
                    value={formData.contactPerson}
                    onBlur={() => setTouched((prev) => ({ ...prev, contactPerson: true }))}
                    onChange={(e) => {
                      setFormData({ ...formData, contactPerson: e.target.value });
                      if (!touched.contactPerson) setTouched((prev) => ({ ...prev, contactPerson: true }));
                    }}
                    className={`w-full px-3 py-2 bg-white border rounded-[3px] text-[#0F172A] text-xs transition-colors focus:outline-none ${
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#475569] mb-1">
                    WhatsApp Number *
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
                    className={`w-full px-3 py-2 bg-white border rounded-[3px] text-[#0F172A] text-xs transition-colors focus:outline-none ${
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
                    Destination City &amp; State *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Indore, Madhya Pradesh"
                    value={formData.cityState}
                    onBlur={() => setTouched((prev) => ({ ...prev, cityState: true }))}
                    onChange={(e) => {
                      setFormData({ ...formData, cityState: e.target.value });
                      if (!touched.cityState) setTouched((prev) => ({ ...prev, cityState: true }));
                    }}
                    className={`w-full px-3 py-2 bg-white border rounded-[3px] text-[#0F172A] text-xs transition-colors focus:outline-none ${
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

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#475569] mb-1">
                  Required Volume / Batch Size *
                </label>
                <select
                  required
                  value={formData.volume}
                  onBlur={() => setTouched((prev) => ({ ...prev, volume: true }))}
                  onChange={(e) => {
                    setFormData({ ...formData, volume: e.target.value });
                    if (!touched.volume) setTouched((prev) => ({ ...prev, volume: true }));
                  }}
                  className={`w-full px-3 py-2 bg-white border rounded-[3px] text-[#0F172A] text-xs focus:outline-none ${
                    fieldErrors.volume
                      ? 'border-red-500 bg-red-50/20 focus:border-red-600'
                      : 'border-[#cbd5e1] focus:border-[#0F2E52]'
                  }`}
                >
                  <option value="Trial Batch (50 - 100 Units)">Trial Batch (50 - 100 Units)</option>
                  <option value="Half Truckload (~250 - 400 Units)">Half Truckload (~250 - 400 Units)</option>
                  <option value="Full Truckload FTL (600 - 800 Units)">Full Truckload FTL (600 - 800 Units)</option>
                  <option value="Export Container 20ft / 40ft HQ">Export Container 20ft / 40ft HQ</option>
                  <option value="Showroom Display Display Samples Only">Showroom Display Samples Only</option>
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
                  Specific Notes or Models Needed *
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="e.g. Need 100 pcs Edge One-Piece &amp; 50 pcs Wall-Hung in Glossy White for Gujarat project..."
                  value={formData.notes}
                  onBlur={() => setTouched((prev) => ({ ...prev, notes: true }))}
                  onChange={(e) => {
                    setFormData({ ...formData, notes: e.target.value });
                    if (!touched.notes) setTouched((prev) => ({ ...prev, notes: true }));
                  }}
                  className={`w-full px-3 py-2 bg-white border rounded-[3px] text-[#0F172A] text-xs transition-colors focus:outline-none ${
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
                <div className="p-2.5 sm:p-3 bg-amber-50/90 border border-amber-300/80 rounded-[3px] text-xs space-y-1.5 text-amber-950 animate-in fade-in">
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
                    All details completed! You can now submit your inquiry or start a quick WhatsApp chat.
                  </span>
                </div>
              )}

              {/* Action Buttons: Visible and Sticky on Mobile/Tablet */}
              <div className="pt-3 sticky bottom-0 bg-white/95 backdrop-blur-xs pb-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 border-t border-slate-100 mt-2">
                <button
                  type="submit"
                  disabled={!isFormComplete || loading}
                  title={!isFormComplete ? 'Please fill in all required details above' : undefined}
                  className={`w-full sm:flex-1 py-3 px-4 font-semibold text-xs sm:text-sm rounded-[3px] border transition-all flex items-center justify-center space-x-2 shrink-0 ${
                    !isFormComplete || loading
                      ? 'bg-slate-100 border-slate-300 text-slate-400 cursor-not-allowed opacity-60'
                      : 'bg-[#0F2E52] hover:bg-[#1e3a5f] text-white border-[#0F2E52] cursor-pointer shadow-xs active:scale-[0.99]'
                  }`}
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{loading ? 'Saving to Factory Sheet...' : 'Submit Wholesale Inquiry'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleWhatsAppClick}
                  disabled={!isFormComplete}
                  title={!isFormComplete ? 'Please fill in all required details above' : undefined}
                  className={`w-full sm:flex-1 py-3 px-4 font-bold text-xs sm:text-sm rounded-[3px] transition-all flex items-center justify-center space-x-2 text-center shrink-0 ${
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

      </div>
    </div>
  );
};
