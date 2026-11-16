import React, { useState } from 'react';
import { X, Send, CheckCircle2, MessageSquare, AlertCircle, Globe, MapPin } from 'lucide-react';
import { B2BInquiryPayload } from '../types';
import { useWebsiteData } from '../context/DataContext';
import { useToast } from '../context/ToastContext';
import { sanitizePhoneForWhatsApp, formatDisplayPhone } from '../utils/phone';
import {
  COUNTRY_DIAL_CODES,
  COUNTRIES,
  INDIAN_STATES,
  getDistrictsForState,
  getCitiesForDistrict
} from '../data/locationData';

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
  const { toastError, toastInfo, toastSuccess } = useToast();

  // Form Field States
  const [businessName, setBusinessName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phoneCode, setPhoneCode] = useState('+91');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [country, setCountry] = useState('India');
  const [state, setState] = useState('Gujarat');
  const [district, setDistrict] = useState('Surendranagar');
  const [city, setCity] = useState('Thangadh');
  const [customCity, setCustomCity] = useState('');
  const [volume, setVolume] = useState('Trial Batch (50 - 100 Units)');
  const [productInterest] = useState(initialProductInterest);
  const [notes, setNotes] = useState('');

  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [savedInquiryId, setSavedInquiryId] = useState<string>('');

  // Track field blur/interaction for inline validation
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
      notes: true
    });
  };

  // Handle Country changes
  const handleCountryChange = (newCountry: string) => {
    setCountry(newCountry);
    if (!touched.country) setTouched((prev) => ({ ...prev, country: true }));

    if (newCountry === 'India') {
      setPhoneCode('+91');
      setState('Gujarat');
      const dists = getDistrictsForState('Gujarat');
      setDistrict(dists[0] || '');
      const cities = getCitiesForDistrict(dists[0] || '', 'Gujarat');
      setCity(cities[0] || '');
      setCustomCity('');
    } else {
      // Find matching dial code
      const match = COUNTRY_DIAL_CODES.find((c) => c.country.toLowerCase() === newCountry.toLowerCase());
      if (match) {
        setPhoneCode(match.code);
      }
      setState('');
      setDistrict('');
      setCity('');
      setCustomCity('');
    }
  };

  // Handle State changes
  const handleStateChange = (newState: string) => {
    setState(newState);
    if (!touched.state) setTouched((prev) => ({ ...prev, state: true }));
    const dists = getDistrictsForState(newState);
    const firstDist = dists[0] || '';
    setDistrict(firstDist);
    const cities = getCitiesForDistrict(firstDist, newState);
    setCity(cities[0] || '');
    setCustomCity('');
  };

  // Handle District changes
  const handleDistrictChange = (newDistrict: string) => {
    setDistrict(newDistrict);
    if (!touched.district) setTouched((prev) => ({ ...prev, district: true }));
    const cities = getCitiesForDistrict(newDistrict, state);
    setCity(cities[0] || '');
    setCustomCity('');
  };

  // Calculations for validation
  const cleanPhone = whatsappNumber.replace(/\D/g, '');
  const isPhoneValid = country === 'India' ? cleanPhone.length === 10 : cleanPhone.length >= 7;
  const isCityValid = city === 'Other City' ? customCity.trim().length > 0 : Boolean(city.trim());

  const effectiveCity = city === 'Other City' ? customCity.trim() : city;
  const fullLocation = [effectiveCity, district, state, country].filter(Boolean).join(', ');
  const fullPhone = `${phoneCode} ${whatsappNumber.trim()}`;

  const isFormComplete = Boolean(
    businessName.trim() &&
    contactPerson.trim() &&
    isPhoneValid &&
    country.trim() &&
    state.trim() &&
    district.trim() &&
    isCityValid &&
    volume.trim() &&
    notes.trim()
  );

  // Inline field errors
  const fieldErrors = {
    businessName: touched.businessName && !businessName.trim()
      ? 'Firm or business name is required (e.g. Apex Ceramics & Bath)'
      : null,
    contactPerson: touched.contactPerson && !contactPerson.trim()
      ? 'Contact person name is required (e.g. Rajesh Shah)'
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
    district: touched.district && !district.trim() ? 'Please select your destination district' : null,
    city: touched.city && !city.trim() ? 'Please select your destination city' : null,
    customCity: touched.customCity && city === 'Other City' && !customCity.trim()
      ? 'Please specify your city or town name'
      : null,
    volume: touched.volume && !volume.trim() ? 'Please select batch volume requirement' : null,
    notes: touched.notes && !notes.trim() ? 'Please specify required models, finishes, or target schedule' : null
  };

  if (!isOpen) return null;

  const currentDistricts = country === 'India' ? getDistrictsForState(state) : [];
  const currentCities = country === 'India' && district ? getCitiesForDistrict(district, state) : [];

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    markAllTouched();
    setErrorMsg('');

    if (!isFormComplete) {
      const msg = 'Please complete all required fields highlighted in red.';
      setErrorMsg(msg);
      toastError(msg, 'Incomplete Quote Form');
      return;
    }

    setLoading(true);
    const payload = constructPayload();

    try {
      const res = await recordInquiry(payload, `Quote Modal: ${productInterest}`);
      setSavedInquiryId(res.id);
      setLoading(false);
      setSubmitted(true);
      if (onSubmitted) {
        onSubmitted(payload);
      } else {
        toastSuccess(`Inquiry "${payload.businessName}" submitted.`, 'Quote Sent');
      }
    } catch (err) {
      console.error('Error submitting inquiry:', err);
      const msg =
        err instanceof Error
          ? err.message
          : 'Unable to submit inquiry to server. Please check your connection and try again.';
      setLoading(false);
      setErrorMsg(msg);
      toastError(msg, 'Submission Failed');
    }
  };

  const getWhatsAppDirectLink = () => {
    const text = `*New Factory Wholesale Inquiry - Hightone Ceramic*\n\n` +
      `*Firm / Business:* ${businessName.trim() || 'N/A'}\n` +
      `*Contact Person:* ${contactPerson.trim() || 'N/A'}\n` +
      `*Phone:* ${phoneCode} ${whatsappNumber.trim() || 'N/A'}\n` +
      `*Destination:* ${fullLocation || 'N/A'}\n` +
      `*Required Volume:* ${volume}\n` +
      `*Product Interest:* ${productInterest}\n` +
      `*Notes & Models:* ${notes.trim() || 'N/A'}\n\n` +
      `Please provide ex-factory quotation and stock availability.`;

    return `https://wa.me/${sanitizePhoneForWhatsApp(companyInfo.primary_phone)}?text=${encodeURIComponent(text)}`;
  };

  const handleWhatsAppClick = () => {
    markAllTouched();
    if (!isFormComplete) {
      const msg = 'Cannot start WhatsApp chat yet. Please complete all required fields.';
      setErrorMsg(msg);
      toastError(msg, 'Incomplete Quote Form');
      return;
    }

    const payload = constructPayload();
    // Auto-record in desk sheet so inquiry is never lost
    try {
      recordInquiry(payload, `Quote Modal WhatsApp: ${productInterest}`).catch(() => {});
    } catch {}

    toastInfo(`Opening WhatsApp dispatch for ${payload.businessName}.`, 'WhatsApp Dispatch');
    const link = getWhatsAppDirectLink();
    window.open(link, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 md:p-6 bg-[#001936]/65 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white border border-[#cbd5e1] rounded-[4px] max-w-xl w-full max-h-[94dvh] sm:max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="px-5 py-3.5 sm:px-6 sm:py-4 bg-[#0F2E52] text-white flex items-center justify-between shrink-0 border-b border-[#1e3a5f]">
          <div>
            <span className="text-[10px] font-mono uppercase tracking-widest text-cyan-300">
              Direct Plant Procurement
            </span>
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

        {/* Modal Body */}
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
                  <strong>Firm:</strong> {businessName} ({contactPerson})
                </p>
                <p>
                  <strong>Phone:</strong> {phoneCode} {whatsappNumber}
                </p>
                <p>
                  <strong>Destination:</strong> {fullLocation}
                </p>
                <p>
                  <strong>Item:</strong> {productInterest}
                </p>
                <p className="text-[11px] text-[#64748b] pt-1 border-t border-[#e2e8f0]">
                  Our commercial sales desk will evaluate stock availability and send direct ex-factory rates within 4 hours.
                </p>
              </div>

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
                  {productInterest}
                </p>
              </div>

              {/* 1. Firm & Contact Person */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#475569] mb-1">
                    Firm / Business Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Apex Ceramics &amp; Bath"
                    value={businessName}
                    onBlur={() => setTouched((prev) => ({ ...prev, businessName: true }))}
                    onChange={(e) => {
                      setBusinessName(e.target.value);
                      if (!touched.businessName) setTouched((prev) => ({ ...prev, businessName: true }));
                    }}
                    className={`w-full px-3 py-2 bg-white border rounded-[3px] text-[#0F172A] text-xs transition-colors focus:outline-none ${
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
                    Contact Person Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rajesh Shah"
                    value={contactPerson}
                    onBlur={() => setTouched((prev) => ({ ...prev, contactPerson: true }))}
                    onChange={(e) => {
                      setContactPerson(e.target.value);
                      if (!touched.contactPerson) setTouched((prev) => ({ ...prev, contactPerson: true }));
                    }}
                    className={`w-full px-3 py-2 bg-white border rounded-[3px] text-[#0F172A] text-xs transition-colors focus:outline-none ${
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
                  WhatsApp Mobile Number *
                </label>
                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-5 sm:col-span-4">
                    <select
                      value={phoneCode}
                      onChange={(e) => setPhoneCode(e.target.value)}
                      title="Select Country Mobile Code"
                      className="w-full px-2.5 py-2 bg-slate-50 border border-[#cbd5e1] rounded-[3px] text-[#0F172A] text-xs font-semibold focus:outline-none focus:border-[#0F2E52]"
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
                      className={`w-full px-3 py-2 bg-white border rounded-[3px] text-[#0F172A] text-xs transition-colors focus:outline-none ${
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#475569] mb-1">
                    Country *
                  </label>
                  <select
                    value={country}
                    onBlur={() => setTouched((prev) => ({ ...prev, country: true }))}
                    onChange={(e) => handleCountryChange(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#cbd5e1] rounded-[3px] text-[#0F172A] text-xs focus:outline-none focus:border-[#0F2E52]"
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
                    State / Province *
                  </label>
                  {country === 'India' ? (
                    <select
                      value={state}
                      onBlur={() => setTouched((prev) => ({ ...prev, state: true }))}
                      onChange={(e) => handleStateChange(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-[#cbd5e1] rounded-[3px] text-[#0F172A] text-xs focus:outline-none focus:border-[#0F2E52]"
                    >
                      {INDIAN_STATES.map((s) => (
                        <option key={s} value={s}>
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
                      className="w-full px-3 py-2 bg-white border border-[#cbd5e1] rounded-[3px] text-[#0F172A] text-xs focus:outline-none focus:border-[#0F2E52]"
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#475569] mb-1">
                    District *
                  </label>
                  {country === 'India' ? (
                    <select
                      value={district}
                      onBlur={() => setTouched((prev) => ({ ...prev, district: true }))}
                      onChange={(e) => handleDistrictChange(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-[#cbd5e1] rounded-[3px] text-[#0F172A] text-xs focus:outline-none focus:border-[#0F2E52]"
                    >
                      {currentDistricts.map((d) => (
                        <option key={d} value={d}>
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
                      className="w-full px-3 py-2 bg-white border border-[#cbd5e1] rounded-[3px] text-[#0F172A] text-xs focus:outline-none focus:border-[#0F2E52]"
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
                    City / Town *
                  </label>
                  {country === 'India' ? (
                    <select
                      value={city}
                      onBlur={() => setTouched((prev) => ({ ...prev, city: true }))}
                      onChange={(e) => {
                        setCity(e.target.value);
                        if (!touched.city) setTouched((prev) => ({ ...prev, city: true }));
                      }}
                      className="w-full px-3 py-2 bg-white border border-[#cbd5e1] rounded-[3px] text-[#0F172A] text-xs focus:outline-none focus:border-[#0F2E52]"
                    >
                      {currentCities.map((c) => (
                        <option key={c} value={c}>
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
                      className="w-full px-3 py-2 bg-white border border-[#cbd5e1] rounded-[3px] text-[#0F172A] text-xs focus:outline-none focus:border-[#0F2E52]"
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
                    Specify Your City / Town Name *
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
                    className={`w-full px-3 py-2 bg-white border rounded-[3px] text-[#0F172A] text-xs transition-colors focus:outline-none ${
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

              {/* 5. Required Volume */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#475569] mb-1">
                  Required Volume / Batch Size *
                </label>
                <select
                  required
                  value={volume}
                  onBlur={() => setTouched((prev) => ({ ...prev, volume: true }))}
                  onChange={(e) => {
                    setVolume(e.target.value);
                    if (!touched.volume) setTouched((prev) => ({ ...prev, volume: true }));
                  }}
                  className="w-full px-3 py-2 bg-white border border-[#cbd5e1] rounded-[3px] text-[#0F172A] text-xs focus:outline-none focus:border-[#0F2E52]"
                >
                  <option value="Trial Batch (50 - 100 Units)">Trial Batch (50 - 100 Units)</option>
                  <option value="Half Truckload (~250 - 400 Units)">Half Truckload (~250 - 400 Units)</option>
                  <option value="Full Truckload FTL (600 - 800 Units)">Full Truckload FTL (600 - 800 Units)</option>
                  <option value="Export Container 20ft / 40ft HQ">Export Container 20ft / 40ft HQ</option>
                  <option value="Showroom Display Samples Only">Showroom Display Samples Only</option>
                </select>
                {fieldErrors.volume && (
                  <p className="text-[10.5px] text-red-600 mt-1 flex items-center space-x-1 font-medium animate-in fade-in">
                    <AlertCircle className="w-3 h-3 text-red-500 shrink-0" />
                    <span>{fieldErrors.volume}</span>
                  </p>
                )}
              </div>

              {/* 6. Specific Notes */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#475569] mb-1">
                  Specific Notes or Models Needed *
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="e.g. Need 100 pcs Edge One-Piece &amp; 50 pcs Wall-Hung in Glossy White for Gujarat project..."
                  value={notes}
                  onBlur={() => setTouched((prev) => ({ ...prev, notes: true }))}
                  onChange={(e) => {
                    setNotes(e.target.value);
                    if (!touched.notes) setTouched((prev) => ({ ...prev, notes: true }));
                  }}
                  className={`w-full px-3 py-2 bg-white border rounded-[3px] text-[#0F172A] text-xs transition-colors focus:outline-none ${
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

              {/* Action Buttons: Visible and Sticky at bottom */}
              <div className="pt-3 sticky bottom-0 bg-white/95 backdrop-blur-xs pb-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 border-t border-slate-100 mt-2">
                <button
                  type="submit"
                  disabled={!isFormComplete || loading}
                  title={!isFormComplete ? 'Please fill in all required fields above' : undefined}
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
                  title={!isFormComplete ? 'Please fill in all required fields above' : undefined}
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
