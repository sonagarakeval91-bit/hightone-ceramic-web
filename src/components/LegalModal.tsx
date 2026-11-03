import React, { useState } from 'react';
import { X, ShieldCheck, FileText, Lock, Building2 } from 'lucide-react';
import { useWebsiteData } from '../context/DataContext';
import { formatDisplayPhone } from '../utils/phone';

interface LegalModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'privacy' | 'terms';
}

export const LegalModal: React.FC<LegalModalProps> = ({
  isOpen,
  onClose,
  defaultTab = 'privacy'
}) => {
  const [activeTab, setActiveTab] = useState<'privacy' | 'terms'>(defaultTab);
  const { legalPolicies, companyInfo } = useWebsiteData();

  if (!isOpen) return null;

  // Helper to retrieve custom keys case-insensitively
  const getPolicyVal = (...aliases: string[]): string => {
    for (const a of aliases) {
      if (legalPolicies[a]) return legalPolicies[a]!;
      const cleanTarget = a.toLowerCase().replace(/[\s_-]/g, '');
      for (const [k, v] of Object.entries(legalPolicies)) {
        if (k.toLowerCase().replace(/[\s_-]/g, '') === cleanTarget && v) {
          return v;
        }
      }
      for (const [k, v] of Object.entries(companyInfo)) {
        if (k.toLowerCase().replace(/[\s_-]/g, '') === cleanTarget && v) {
          return v;
        }
      }
    }
    return '';
  };

  // Privacy values (Sheet overrides or Defaults)
  const privacyNotice = getPolicyVal('privacy_notice', 'privacy_header', 'privacy_banner') || 
    'All wholesale form fills, catalog requests, and dealership inquiries submitted on this platform are automatically recorded in our secure commercial inquiries sheet and transmitted directly to the Hightone Ceramic plant sales desk in Thangadh (Gujarat).';
  const privacyCollect = getPolicyVal('privacy_collect', 'privacy_information', 'privacy_data') || 
    'When you submit a quote request or dealership inquiry, we collect your business/firm name, designated contact person, phone and WhatsApp contact number, destination city and state, required wholesale batch volume, and chosen ceramic sanitaryware product series.';
  const privacyPurpose = getPolicyVal('privacy_purpose', 'privacy_usage') || '';
  const privacyThirdParty = getPolicyVal('privacy_thirdparty', 'privacy_broker', 'privacy_confidentiality') || 
    'Hightone Ceramic treats all B2B dealer communications with stringent commercial confidentiality. We do not sell, rent, license, or disclose your contact details to third-party advertising brokers, lead vendors, or external marketing agencies.';
  const privacySecurity = getPolicyVal('privacy_security', 'privacy_protection') || 
    `Internal inquiry records are password-protected and accessible exclusively by authorized Hightone Ceramic management. If you wish to update, modify, or remove your contact details from our active dealer registry, you may notify our dispatch desk directly at ${formatDisplayPhone(companyInfo.primary_phone)}.`;
  const privacyFullCustom = getPolicyVal('privacy_full', 'privacy_text', 'privacy_content', 'privacy_policy');

  // Terms values (Sheet overrides or Defaults)
  const termsNotice = getPolicyVal('terms_notice', 'terms_banner', 'terms_header') || 
    `Hightone Ceramic operates an industrial vitreous sanitaryware manufacturing plant in ${companyInfo.location || 'Thangadh (Surendranagar, Gujarat)'}. All quotes and wholesale orders are governed by the following commercial terms.`;
  const termsPricing = getPolicyVal('terms_pricing', 'terms_price', 'price_structure') || 
    `All quotation rates provided through our sales desk or proforma invoices are strictly Ex-Factory Thangadh (Gujarat) unless explicitly stated as CIF or delivered pricing. Applicable Goods and Services Tax (GST) and freight charges are charged as per prevailing statutory rates.`;
  const termsMoq = getPolicyVal('terms_moq', 'terms_order_quantity', 'moq_terms') || '';
  const termsQuality = getPolicyVal('terms_quality', 'terms_specifications', 'terms_standards') || 
    'All sanitaryware units undergo 100% pneumatic air testing for flush cavity integrity and vacuum glaze inspection. Minor dimensional tolerances of ±2% are standard for ceramic products fired at 1,200°C as per IS 2556 sanitaryware standards.';
  const termsTransit = getPolicyVal('terms_transit', 'terms_logistics', 'terms_inspection') || 
    'Consignments are handed over to authorized road freight carriers. Receivers must inspect strapping and seals upon doorstep delivery and notify our commercial desk within 48 hours in the rare event of transit damage accompanied by unboxing photographs.';
  const termsFullCustom = getPolicyVal('terms_full', 'terms_text', 'terms_content', 'terms_and_conditions');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-[#001936]/65 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="bg-white w-full max-w-3xl max-h-[92dvh] sm:max-h-[88vh] rounded-[4px] shadow-2xl border border-[#cbd5e1] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#001936] text-white px-5 py-4 flex items-center justify-between border-b border-[#0F2E52] shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-bold text-base tracking-wide">
                {companyInfo.brand_name || 'Hightone Ceramic'} — Commercial Governance
              </h3>
              <p className="text-[11px] text-slate-300">
                Thangadh Industrial Cluster • Manufacturer Terms &amp; Data Policy
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-[3px] text-slate-300 hover:text-white hover:bg-[#1e3a5f] transition-colors cursor-pointer"
            aria-label="Close legal terms window"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Bar */}
        <div className="flex border-b border-slate-200 bg-[#f8fafc] px-4 pt-2.5 shrink-0 space-x-2">
          <button
            onClick={() => setActiveTab('privacy')}
            className={`flex items-center space-x-2 px-4 py-2 text-xs font-semibold rounded-t-[3px] border-t border-l border-r transition-all cursor-pointer ${
              activeTab === 'privacy'
                ? 'bg-white text-[#0F2E52] border-slate-300 border-b-white -mb-px'
                : 'text-slate-500 hover:text-[#0F2E52] border-transparent'
            }`}
          >
            <Lock className="w-3.5 h-3.5 text-cyan-700" />
            <span>Privacy &amp; Data Logging Policy</span>
          </button>
          <button
            onClick={() => setActiveTab('terms')}
            className={`flex items-center space-x-2 px-4 py-2 text-xs font-semibold rounded-t-[3px] border-t border-l border-r transition-all cursor-pointer ${
              activeTab === 'terms'
                ? 'bg-white text-[#0F2E52] border-slate-300 border-b-white -mb-px'
                : 'text-slate-500 hover:text-[#0F2E52] border-transparent'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-cyan-700" />
            <span>Commercial Terms &amp; Conditions</span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-5 sm:p-7 overflow-y-auto flex-1 text-xs text-[#334155] leading-relaxed space-y-5">
          {activeTab === 'privacy' ? (
            <div className="space-y-4">
              {legalPolicies.privacySections && legalPolicies.privacySections.length > 0 ? (
                <div className="space-y-4">
                  {legalPolicies.privacySections.map((sec, idx) => (
                    <section key={idx} className="space-y-1.5 p-3.5 bg-slate-50/70 border border-slate-200/80 rounded-[3px]">
                      {sec.badge && (
                        <span className="text-[10px] font-bold tracking-wider text-cyan-800 bg-cyan-100/70 px-2 py-0.5 rounded-[2px] uppercase inline-block mb-1">
                          {sec.badge}
                        </span>
                      )}
                      <h4 className="font-display font-bold text-sm text-[#0F2E52]">
                        {sec.heading}
                      </h4>
                      <p className="whitespace-pre-line text-slate-700 leading-relaxed text-xs">
                        {sec.body}
                      </p>
                    </section>
                  ))}
                </div>
              ) : privacyFullCustom ? (
                <div className="whitespace-pre-line text-xs leading-relaxed space-y-3">
                  {privacyFullCustom}
                </div>
              ) : (
                <>
                  <div className="bg-[#f0f9ff] border border-[#bae6fd] p-3.5 rounded-[3px] text-[11px] text-[#0369a1] space-y-1">
                    <span className="font-bold uppercase tracking-wider block">B2B INQUIRY LOGGING &amp; SHEET TRANSMISSION</span>
                    <p>{privacyNotice}</p>
                  </div>

                  <section className="space-y-1.5">
                    <h4 className="font-display font-bold text-sm text-[#0F2E52]">
                      1. Information We Collect
                    </h4>
                    <p>{privacyCollect}</p>
                  </section>

                  <section className="space-y-1.5">
                    <h4 className="font-display font-bold text-sm text-[#0F2E52]">
                      2. Purpose &amp; Use of Inquired Information
                    </h4>
                    {privacyPurpose ? (
                      <p>{privacyPurpose}</p>
                    ) : (
                      <>
                        <p>Your information is utilized strictly to:</p>
                        <ul className="list-disc list-inside space-y-1 pl-1 text-[11.5px]">
                          <li>Verify genuine business credentials and eligibility for ex-factory dealer wholesale rate slabs.</li>
                          <li>Calculate precise transportation logistics, truckload requirements (FTL/half-truckload), and transit timelines.</li>
                          <li>Send personalized commercial rate lists, technical specification drawings, and proforma invoices directly to your WhatsApp or phone.</li>
                          <li>Maintain an authorized factory dispatch record in our protected Google Sheet and internal enterprise logs.</li>
                        </ul>
                      </>
                    )}
                  </section>

                  <section className="space-y-1.5">
                    <h4 className="font-display font-bold text-sm text-[#0F2E52]">
                      3. Zero Third-Party Selling or Broker Distribution
                    </h4>
                    <p>{privacyThirdParty}</p>
                  </section>

                  <section className="space-y-1.5">
                    <h4 className="font-display font-bold text-sm text-[#0F2E52]">
                      4. Security &amp; Access Controls
                    </h4>
                    <p>{privacySecurity}</p>
                  </section>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {legalPolicies.termsSections && legalPolicies.termsSections.length > 0 ? (
                <div className="space-y-4">
                  {legalPolicies.termsSections.map((sec, idx) => (
                    <section key={idx} className="space-y-1.5 p-3.5 bg-slate-50/70 border border-slate-200/80 rounded-[3px]">
                      {sec.badge && (
                        <span className="text-[10px] font-bold tracking-wider text-cyan-800 bg-cyan-100/70 px-2 py-0.5 rounded-[2px] uppercase inline-block mb-1">
                          {sec.badge}
                        </span>
                      )}
                      <h4 className="font-display font-bold text-sm text-[#0F2E52]">
                        {sec.heading}
                      </h4>
                      <p className="whitespace-pre-line text-slate-700 leading-relaxed text-xs">
                        {sec.body}
                      </p>
                    </section>
                  ))}
                </div>
              ) : termsFullCustom ? (
                <div className="whitespace-pre-line text-xs leading-relaxed space-y-3">
                  {termsFullCustom}
                </div>
              ) : (
                <>
                  <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-[3px] text-[11px] text-slate-700 space-y-1">
                    <span className="font-bold uppercase tracking-wider block text-[#0F2E52]">WHOLESALE PROCUREMENT &amp; PLANT DISPATCH TERMS</span>
                    <p>{termsNotice}</p>
                  </div>

                  <section className="space-y-1.5">
                    <h4 className="font-display font-bold text-sm text-[#0F2E52]">
                      1. Price Structure &amp; Ex-Factory Terms
                    </h4>
                    <p>{termsPricing}</p>
                  </section>

                  <section className="space-y-1.5">
                    <h4 className="font-display font-bold text-sm text-[#0F2E52]">
                      2. Minimum Order Quantity (MOQ) &amp; Packaging
                    </h4>
                    {termsMoq ? (
                      <p>{termsMoq}</p>
                    ) : (
                      <>
                        <p>
                          Direct plant supply is structured for regional sanitaryware distributors, showrooms, infrastructure contractors, and institutional buyers. Standard packaging includes heavy 5-ply export-grade strapped master cartons with corner guards. MOQ parameters:
                        </p>
                        <ul className="list-disc list-inside space-y-1 pl-1 text-[11.5px]">
                          <li>Trial Dealership Batch: 50 to 100 units (assorted models).</li>
                          <li>Regional Hub Lot: Half truckload (~250 to 400 units).</li>
                          <li>Direct Ex-Factory FTL: Full truckload (~600 to 800 units) with maximum slab discounts.</li>
                        </ul>
                      </>
                    )}
                  </section>

                  <section className="space-y-1.5">
                    <h4 className="font-display font-bold text-sm text-[#0F2E52]">
                      3. Quality Assurance &amp; Ceramic Tolerance
                    </h4>
                    <p>{termsQuality}</p>
                  </section>

                  <section className="space-y-1.5">
                    <h4 className="font-display font-bold text-sm text-[#0F2E52]">
                      4. Transit &amp; Inspection
                    </h4>
                    <p>{termsTransit}</p>
                  </section>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-[#f8fafc] border-t border-slate-200 px-5 py-3.5 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2 text-[11px] text-slate-500 font-mono">
            <Building2 className="w-3.5 h-3.5 text-slate-400" />
            <span>Hightone Ceramic • Thangadh Plant Desk</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#0F2E52] hover:bg-[#1e3a5f] text-white text-xs font-semibold rounded-[3px] transition-colors cursor-pointer"
          >
            I Understand &amp; Close
          </button>
        </div>
      </div>
    </div>
  );
};
