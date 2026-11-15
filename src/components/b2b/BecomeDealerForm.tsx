import React, { useState } from 'react';
import { useWebsiteData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import { DealerApplication } from '../../types';
import {
  COUNTRY_DIAL_CODES,
  COUNTRIES,
  INDIAN_STATES,
  getDistrictsForState,
  getCitiesForDistrict
} from '../../data/locationData';
import { isValidIndianGstFormat } from '../../services/dealerPortalService';
import { sanitizePhoneForWhatsApp } from '../../utils/phone';
import {
  Building2,
  User,
  Phone,
  Mail,
  MapPin,
  FileCheck2,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  ShieldCheck,
  ArrowRight,
  LogIn
} from 'lucide-react';

interface BecomeDealerFormProps {
  onGoToSignIn: () => void;
}

const BUSINESS_TYPES = [
  'Sanitaryware Showroom / Retailer',
  'Wholesale Distributor / Stockist',
  'Building Materials Dealer',
  'Plumbing Contractor / Builder',
  'Export / International Buyer'
];

const MONTHLY_VOLUME_SLABS = [
  'Trial Batch (50 - 150 Units / Month)',
  'Regular Tempo Load (150 - 400 Units / Month)',
  'Full Truckload (400 - 1,000+ Units / Month)',
  'Regional Super-Stockist / Multiple Trucks',
  'Export Container (20ft / 40ft)'
];

export const BecomeDealerForm: React.FC<BecomeDealerFormProps> = ({ onGoToSignIn }) => {
  const { submitDealerApplication, companyInfo } = useWebsiteData();
  const { toastError, toastSuccess } = useToast();

  const [firmName, setFirmName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [businessType, setBusinessType] = useState(BUSINESS_TYPES[0]);
  const [gstNumber, setGstNumber] = useState('');
  const [phoneCode, setPhoneCode] = useState('+91');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [email, setEmail] = useState('');
  const [streetAddress, setStreetAddress] = useState('');
  const [pincode, setPincode] = useState('');
  const [country, setCountry] = useState('India');
  const [state, setState] = useState('Gujarat');
  const [district, setDistrict] = useState('Surendranagar');
  const [city, setCity] = useState('Thangadh');
  const [customCity, setCustomCity] = useState('');
  const [estimatedVolume, setEstimatedVolume] = useState(MONTHLY_VOLUME_SLABS[1]);
  const [preferredCategories, setPreferredCategories] = useState('Complete Ceramic Sanitaryware Catalog');
  const [notes, setNotes] = useState('');

  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [formError, setFormError] = useState('');
  const [submittedApp, setSubmittedApp] = useState<DealerApplication | null>(null);

  const handleCountryChange = (newCountry: string) => {
    setCountry(newCountry);
    if (newCountry === 'India') {
      setPhoneCode('+91');
      setState('Gujarat');
      const dists = getDistrictsForState('Gujarat');
      const firstDist = dists[0] || '';
      setDistrict(firstDist);
      const cities = getCitiesForDistrict(firstDist, 'Gujarat');
      setCity(cities[0] || '');
      setCustomCity('');
    } else {
      const match = COUNTRY_DIAL_CODES.find(
        (c) => c.country.toLowerCase() === newCountry.toLowerCase()
      );
      if (match) setPhoneCode(match.code);
      setState('');
      setDistrict('');
      setCity('');
      setCustomCity('');
    }
  };

  const handleStateChange = (newState: string) => {
    setState(newState);
    const dists = getDistrictsForState(newState);
    const firstDist = dists[0] || '';
    setDistrict(firstDist);
    const cities = getCitiesForDistrict(firstDist, newState);
    setCity(cities[0] || '');
    setCustomCity('');
  };

  const handleDistrictChange = (newDist: string) => {
    setDistrict(newDist);
    const cities = getCitiesForDistrict(newDist, state);
    setCity(cities[0] || '');
    setCustomCity('');
  };

  const cleanPhone = whatsappNumber.replace(/\D/g, '');
  const isPhoneValid = country === 'India' ? cleanPhone.length === 10 : cleanPhone.length >= 7;
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const cleanGst = gstNumber.trim().toUpperCase();
  const isGstIndianMatch = isValidIndianGstFormat(cleanGst);
  const isGstValid = country === 'India' ? cleanGst.length >= 10 : cleanGst.length >= 5;
  const isAddressValid = streetAddress.trim().length >= 8;
  const isPincodeValid = country === 'India' ? /^\d{6}$/.test(pincode.trim()) : pincode.trim().length >= 3;
  const effectiveCity = city === 'Other City' ? customCity.trim() : city;
  const isCityValid = effectiveCity.length > 0;
  const fullCityState = [effectiveCity, district, state, country].filter(Boolean).join(', ');

  const canSubmit = Boolean(
    firmName.trim().length >= 2 &&
      contactPerson.trim().length >= 2 &&
      isGstValid &&
      isPhoneValid &&
      isEmailValid &&
      isAddressValid &&
      isPincodeValid &&
      isCityValid
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({
      firmName: true,
      contactPerson: true,
      gstNumber: true,
      whatsappNumber: true,
      email: true,
      streetAddress: true,
      pincode: true,
      customCity: true
    });

    if (!canSubmit) {
      const msg = 'Please fill in all required firm, GST, WhatsApp, Email, and showroom address fields.';
      setFormError(msg);
      toastError(msg, 'Incomplete Application');
      return;
    }

    setFormError('');
    const created = submitDealerApplication({
      firmName,
      contactPerson,
      businessType,
      gstNumber: cleanGst,
      phoneCode,
      whatsappNumber: cleanPhone,
      email,
      streetAddress,
      pincode,
      country,
      state,
      district,
      city: effectiveCity,
      cityState: fullCityState,
      estimatedVolume,
      preferredCategories,
      notes
    });

    setSubmittedApp(created);
    toastSuccess(
      `Application ${created.id} submitted for "${created.firmName}". Admin will verify address, GST & call.`,
      'Dealer KYC Submitted'
    );
  };

  const resetForm = () => {
    setSubmittedApp(null);
    setFirmName('');
    setContactPerson('');
    setGstNumber('');
    setWhatsappNumber('');
    setEmail('');
    setStreetAddress('');
    setPincode('');
    setNotes('');
    setTouched({});
    setFormError('');
  };

  if (submittedApp) {
    const waText =
      `*Hightone Ceramic - New Dealer Verification Request*\n` +
      `Application ID: *${submittedApp.id}*\n` +
      `Firm: *${submittedApp.firmName}*\n` +
      `Contact: ${submittedApp.contactPerson}\n` +
      `GST No: ${submittedApp.gstNumber}\n` +
      `Address: ${submittedApp.streetAddress}, ${submittedApp.cityState} - ${submittedApp.pincode}\n` +
      `Email: ${submittedApp.email}\n\n` +
      `Kindly verify my KYC details and share my Dealer User ID & Password.`;

    return (
      <div className="bg-white border border-slate-200 rounded-lg p-6 sm:p-8 max-w-3xl mx-auto space-y-6">
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-emerald-700">
              APPLICATION SUBMITTED FOR ADMIN KYC
            </span>
            <h3 className="font-display text-xl sm:text-2xl font-bold text-[#0F2E52]">
              Dealership Verification Request Logged
            </h3>
          </div>
          <div className="px-3 py-1 bg-slate-100 border border-slate-200 rounded font-mono text-xs font-bold text-[#0F2E52] tabular-nums">
            Reference ID: {submittedApp.id}
          </div>
          <p className="text-xs sm:text-sm text-[#515f74] max-w-xl leading-relaxed">
            Thank you, <strong>{submittedApp.contactPerson}</strong>. Your firm{' '}
            <strong>{submittedApp.firmName}</strong> has been added to our Admin verification queue.
            Our team will verify your <strong>Address</strong>, <strong>GST Number</strong>, and{' '}
            <strong>Phone Contact</strong>, then send your <strong>Dealer User ID &amp; Password</strong> directly to:
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#f7f9fb] border border-slate-200 rounded-lg p-4 text-xs">
          <div className="flex items-start space-x-2.5">
            <MessageSquare className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-slate-500 text-[10px] uppercase">WhatsApp Mobile</div>
              <div className="font-mono font-bold text-slate-900">
                {submittedApp.phoneCode} {submittedApp.whatsappNumber}
              </div>
            </div>
          </div>
          <div className="flex items-start space-x-2.5">
            <Mail className="w-4 h-4 text-[#0F2E52] shrink-0 mt-0.5" />
            <div className="min-w-0">
              <div className="font-semibold text-slate-500 text-[10px] uppercase">Email Address</div>
              <div className="font-mono font-bold text-slate-900 break-all">
                {submittedApp.email}
              </div>
            </div>
          </div>
          <div className="flex items-start space-x-2.5">
            <FileCheck2 className="w-4 h-4 text-[#0F2E52] shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-slate-500 text-[10px] uppercase">GST / Tax Number</div>
              <div className="font-mono font-bold text-slate-900">{submittedApp.gstNumber}</div>
            </div>
          </div>
          <div className="flex items-start space-x-2.5">
            <MapPin className="w-4 h-4 text-[#0F2E52] shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-slate-500 text-[10px] uppercase">Showroom Address</div>
              <div className="text-slate-800 font-medium">
                {submittedApp.streetAddress}, {submittedApp.cityState} - {submittedApp.pincode}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
          <a
            href={`https://wa.me/${sanitizePhoneForWhatsApp(companyInfo.primary_phone)}?text=${encodeURIComponent(waText)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center space-x-2 px-4 py-2.5 bg-[#25D366] hover:bg-emerald-600 text-white rounded-[3px] text-xs font-bold transition-colors"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Ping Admin on WhatsApp for Fast Approval</span>
          </a>

          <button
            type="button"
            onClick={onGoToSignIn}
            className="inline-flex items-center space-x-2 px-4 py-2.5 bg-[#0F2E52] hover:bg-[#1e3a5f] text-white rounded-[3px] text-xs font-semibold transition-colors cursor-pointer"
          >
            <LogIn className="w-4 h-4" />
            <span>Go to Dealer Sign In</span>
          </button>

          <button
            type="button"
            onClick={resetForm}
            className="px-4 py-2.5 border border-slate-300 text-slate-700 hover:bg-slate-50 rounded-[3px] text-xs font-semibold cursor-pointer"
          >
            Submit Another Registration
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* Left: Registration Form (8 cols) */}
      <div className="lg:col-span-8 bg-white border border-slate-200 rounded-lg p-6 sm:p-8 space-y-6">
        <div className="border-b border-slate-200 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#64748b] block">
              PARTNER ONBOARDING &amp; KYC
            </span>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-[#0F2E52]">
              Want to Become a Verified Dealer
            </h2>
            <p className="text-xs text-[#515f74] mt-1">
              Register your showroom details once. After Admin verifies your address, GST, and phone call, you will receive your personal Dealer User ID &amp; Password via WhatsApp and Email.
            </p>
          </div>
          <button
            type="button"
            onClick={onGoToSignIn}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 border border-slate-300 hover:border-[#0F2E52] text-[#0F2E52] rounded-[3px] text-xs font-semibold shrink-0 cursor-pointer whitespace-nowrap"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Already Approved? Sign In</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 text-xs">
          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Section A: Firm & GST Identity */}
          <div className="space-y-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#0F2E52] flex items-center space-x-1.5">
              <Building2 className="w-3.5 h-3.5" />
              <span>1. Firm &amp; GST Identity</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Organization / Showroom Firm Name *
                </label>
                <input
                  type="text"
                  value={firmName}
                  onBlur={() => setTouched((p) => ({ ...p, firmName: true }))}
                  onChange={(e) => setFirmName(e.target.value)}
                  placeholder="e.g. Apex Ceramics & Bath Studio"
                  className={`w-full px-3 py-2 bg-white border rounded-[3px] text-slate-900 focus:outline-none ${
                    touched.firmName && firmName.trim().length < 2
                      ? 'border-red-500'
                      : 'border-slate-300 focus:border-[#0F2E52]'
                  }`}
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Authorized Contact Person *
                </label>
                <div className="relative">
                  <User className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={contactPerson}
                    onBlur={() => setTouched((p) => ({ ...p, contactPerson: true }))}
                    onChange={(e) => setContactPerson(e.target.value)}
                    placeholder="e.g. Rajesh Patel"
                    className={`w-full pl-8 pr-3 py-2 bg-white border rounded-[3px] text-slate-900 focus:outline-none ${
                      touched.contactPerson && contactPerson.trim().length < 2
                        ? 'border-red-500'
                        : 'border-slate-300 focus:border-[#0F2E52]'
                    }`}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  GST / Business Tax Number *
                </label>
                <input
                  type="text"
                  value={gstNumber}
                  onBlur={() => setTouched((p) => ({ ...p, gstNumber: true }))}
                  onChange={(e) => setGstNumber(e.target.value.toUpperCase())}
                  placeholder={country === 'India' ? 'e.g. 24AABCH1234F1Z5' : 'Business Tax / VAT ID'}
                  className={`w-full px-3 py-2 bg-white border rounded-[3px] font-mono uppercase text-slate-900 focus:outline-none ${
                    touched.gstNumber && !isGstValid
                      ? 'border-red-500'
                      : isGstIndianMatch
                      ? 'border-emerald-500'
                      : 'border-slate-300 focus:border-[#0F2E52]'
                  }`}
                />
                {country === 'India' && cleanGst.length > 0 && (
                  <p className={`text-[10px] mt-1 font-medium ${isGstIndianMatch ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {isGstIndianMatch
                      ? 'Valid 15-character GSTIN format detected (pending Admin verification).'
                      : 'Enter full 15-character GSTIN for faster Admin GST verification.'}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Business Category *
                </label>
                <select
                  value={businessType}
                  onChange={(e) => setBusinessType(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-[3px] text-slate-900 focus:outline-none focus:border-[#0F2E52]"
                >
                  {BUSINESS_TYPES.map((bt) => (
                    <option key={bt} value={bt}>{bt}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Section B: Contact Channels (WhatsApp + Email for Credentials) */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#0F2E52] flex items-center space-x-1.5">
              <Phone className="w-3.5 h-3.5" />
              <span>2. Direct Contact Channels (For Call Verification &amp; Credentials Delivery)</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  WhatsApp / Calling Mobile Number *
                </label>
                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-5">
                    <select
                      value={phoneCode}
                      onChange={(e) => setPhoneCode(e.target.value)}
                      className="w-full px-2 py-2 bg-slate-50 border border-slate-300 rounded-[3px] text-xs font-mono text-slate-900"
                    >
                      {COUNTRY_DIAL_CODES.map((c) => (
                        <option key={`${c.country}-${c.code}`} value={c.code}>
                          {c.code} ({c.country})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-7">
                    <input
                      type="tel"
                      value={whatsappNumber}
                      onBlur={() => setTouched((p) => ({ ...p, whatsappNumber: true }))}
                      onChange={(e) => setWhatsappNumber(e.target.value)}
                      placeholder="e.g. 98765 43210"
                      className={`w-full px-3 py-2 bg-white border rounded-[3px] font-mono text-slate-900 focus:outline-none ${
                        touched.whatsappNumber && !isPhoneValid
                          ? 'border-red-500'
                          : 'border-slate-300 focus:border-[#0F2E52]'
                      }`}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Official Email ID (For User ID &amp; Password) *
                </label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    value={email}
                    onBlur={() => setTouched((p) => ({ ...p, email: true }))}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. orders@apexceramics.com"
                    className={`w-full pl-8 pr-3 py-2 bg-white border rounded-[3px] text-slate-900 focus:outline-none ${
                      touched.email && !isEmailValid
                        ? 'border-red-500'
                        : 'border-slate-300 focus:border-[#0F2E52]'
                    }`}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section C: Physical Showroom / Godown Address */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[#0F2E52] flex items-center space-x-1.5">
              <MapPin className="w-3.5 h-3.5" />
              <span>3. Physical Address &amp; Dispatch Territory</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
              <div className="sm:col-span-8">
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Full Showroom / Godown Street Address *
                </label>
                <input
                  type="text"
                  value={streetAddress}
                  onBlur={() => setTouched((p) => ({ ...p, streetAddress: true }))}
                  onChange={(e) => setStreetAddress(e.target.value)}
                  placeholder="Shop/Plot No., Market/Road Name, Landmark"
                  className={`w-full px-3 py-2 bg-white border rounded-[3px] text-slate-900 focus:outline-none ${
                    touched.streetAddress && !isAddressValid
                      ? 'border-red-500'
                      : 'border-slate-300 focus:border-[#0F2E52]'
                  }`}
                />
              </div>
              <div className="sm:col-span-4">
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  PIN / Postal Code *
                </label>
                <input
                  type="text"
                  value={pincode}
                  onBlur={() => setTouched((p) => ({ ...p, pincode: true }))}
                  onChange={(e) => setPincode(e.target.value)}
                  placeholder={country === 'India' ? '6-digit Pincode' : 'Postal Code'}
                  className={`w-full px-3 py-2 bg-white border rounded-[3px] font-mono text-slate-900 focus:outline-none ${
                    touched.pincode && !isPincodeValid
                      ? 'border-red-500'
                      : 'border-slate-300 focus:border-[#0F2E52]'
                  }`}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">Country *</label>
                <select
                  value={country}
                  onChange={(e) => handleCountryChange(e.target.value)}
                  className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-[3px] text-slate-900"
                >
                  {COUNTRIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">State *</label>
                {country === 'India' ? (
                  <select
                    value={state}
                    onChange={(e) => handleStateChange(e.target.value)}
                    className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-[3px] text-slate-900"
                  >
                    {INDIAN_STATES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    placeholder="State / Province"
                    className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-[3px] text-slate-900"
                  />
                )}
              </div>

              {country === 'India' && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">District *</label>
                  <select
                    value={district}
                    onChange={(e) => handleDistrictChange(e.target.value)}
                    className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-[3px] text-slate-900"
                  >
                    {getDistrictsForState(state).map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">City / Hub *</label>
                {country === 'India' ? (
                  <>
                    <select
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-[3px] text-slate-900"
                    >
                      {getCitiesForDistrict(district, state).map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    {city === 'Other City' && (
                      <input
                        type="text"
                        value={customCity}
                        onChange={(e) => setCustomCity(e.target.value)}
                        placeholder="Type city name"
                        className="w-full mt-1.5 px-2.5 py-1.5 bg-white border border-slate-300 rounded-[3px] text-xs"
                      />
                    )}
                  </>
                ) : (
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="City"
                    className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded-[3px] text-slate-900"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Section D: Monthly Volume & Notes */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Estimated Monthly Volume
                </label>
                <select
                  value={estimatedVolume}
                  onChange={(e) => setEstimatedVolume(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-[3px] text-slate-900"
                >
                  {MONTHLY_VOLUME_SLABS.map((slab) => (
                    <option key={slab} value={slab}>{slab}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Primary Product Categories
                </label>
                <input
                  type="text"
                  value={preferredCategories}
                  onChange={(e) => setPreferredCategories(e.target.value)}
                  placeholder="e.g. One-Piece Closets, Table Top Basins, Urinals"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-[3px] text-slate-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Showroom Details / Current Brands / Notes (Optional)
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Share transport hub preference, showroom years in operation, or initial requirement..."
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-[3px] text-slate-900"
              />
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <span className="text-[11px] text-slate-500">
              All submissions undergo quick Address, GST, and Phone verification by Hightone Admin.
            </span>
            <button
              type="submit"
              className="inline-flex items-center justify-center space-x-2 px-6 py-3 bg-[#0F2E52] hover:bg-[#1e3a5f] text-white rounded-[3px] text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
            >
              <span>Submit Dealership Application</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>

      {/* Right: Verification Process Explanation (4 cols) */}
      <aside className="lg:col-span-4 space-y-4">
        <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-4">
          <div className="flex items-center space-x-2.5 text-[#0F2E52]">
            <ShieldCheck className="w-5 h-5" />
            <h3 className="font-display font-bold text-base">How Dealer Approval Works</h3>
          </div>

          <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
            <div className="p-3 bg-[#f7f9fb] border border-slate-200 rounded">
              <div className="font-bold text-[#0F2E52]">1. Submit Business &amp; KYC Info</div>
              <p className="mt-0.5 text-[11px]">
                Provide accurate GST number, showroom street address, WhatsApp mobile, and Email ID.
              </p>
            </div>
            <div className="p-3 bg-[#f7f9fb] border border-slate-200 rounded">
              <div className="font-bold text-[#0F2E52]">2. Admin Multi-Step Verification</div>
              <p className="mt-0.5 text-[11px]">
                Our Thangadh plant Admin verifies your physical address, GST registration, and completes a quick confirmation call.
              </p>
            </div>
            <div className="p-3 bg-[#f7f9fb] border border-slate-200 rounded">
              <div className="font-bold text-[#0F2E52]">3. Receive User ID &amp; Password</div>
              <p className="mt-0.5 text-[11px]">
                Once confirmed, Admin sends your personal User ID &amp; Password to your WhatsApp and Email so you can order &amp; edit orders anytime.
              </p>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
};
