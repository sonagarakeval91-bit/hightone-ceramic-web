import React, { useMemo, useState } from 'react';
import {
  DealerAccount,
  DealerApplication,
  DealerVerificationChecklist,
  SavedDealerOrder
} from '../../types';
import {
  buildDealerCredentialsMailtoUrl,
  buildDealerCredentialsMessage,
  buildDealerCredentialsWhatsAppUrl,
  downloadDealersCSV,
  generateDealerPassword,
  generateSuggestedDealerUserId,
  isApplicationKycReady,
  isValidIndianGstFormat
} from '../../services/dealerPortalService';
import {
  COUNTRY_DIAL_CODES,
  COUNTRIES,
  INDIAN_STATES,
  getDistrictsForState,
  getCitiesForDistrict
} from '../../data/locationData';
import { sanitizePhoneForTel, sanitizePhoneForWhatsApp } from '../../utils/phone';
import { ConfirmDialogConfig } from './adminTypes';
import { useToast } from '../../context/ToastContext';
import {
  Search,
  Download,
  UserPlus,
  CheckCircle2,
  XCircle,
  Clock,
  PhoneCall,
  MessageSquare,
  Mail,
  MapPin,
  FileCheck2,
  ShieldCheck,
  KeyRound,
  Copy,
  Check,
  RefreshCw,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Power,
  X,
  AlertCircle,
  Cloud
} from 'lucide-react';

interface AdminDealersPanelProps {
  dealerApplications: DealerApplication[];
  dealerAccounts: DealerAccount[];
  dealerOrders: SavedDealerOrder[];
  adminDisplayName: string;
  onUpdateKyc: (appId: string, updates: Partial<DealerVerificationChecklist>, verifiedBy: string) => void;
  onApproveApplication: (
    appId: string,
    credentials: { userId: string; password: string },
    reviewedBy: string
  ) => { success: boolean; message: string; account?: DealerAccount };
  onRejectApplication: (appId: string, reason: string, reviewedBy: string) => void;
  onDeleteApplication: (appId: string) => void;
  onCreateManualAccount: (
    data: Omit<DealerAccount, 'id' | 'createdAt' | 'active'>
  ) => { success: boolean; message: string; account?: DealerAccount };
  onUpdateAccount: (id: string, updates: Partial<DealerAccount>) => { success: boolean; message: string };
  onToggleAccountActive: (id: string) => void;
  onDeleteAccount: (id: string) => void;
  onRequestConfirm: (config: ConfirmDialogConfig) => void;
  isCloudSyncActive?: boolean;
  cloudSyncEmail?: string | null;
  backendSyncStatus?: 'connected' | 'connecting' | 'local-only' | 'error' | 'offline';
  cloudSyncError?: string | null;
  backendDatabaseId?: string | null;
  isVerifyingBackend?: boolean;
  onVerifyBackend?: () => void;
  onConnectCloudSync?: () => Promise<{ success: boolean; message: string }>;
}

const REJECTION_REASON_PRESETS = [
  'GST Number Verification Failed',
  'Unreachable / No Response on Verification Call',
  'Incomplete or Invalid Showroom Address',
  'Outside Current Dispatch Territory',
  'Duplicate or Unverified Business Profile'
];

export const AdminDealersPanel: React.FC<AdminDealersPanelProps> = ({
  dealerApplications,
  dealerAccounts,
  dealerOrders,
  adminDisplayName,
  onUpdateKyc,
  onApproveApplication,
  onRejectApplication,
  onDeleteApplication,
  onCreateManualAccount,
  onUpdateAccount,
  onToggleAccountActive,
  onDeleteAccount,
  onRequestConfirm,
  isCloudSyncActive = false,
  cloudSyncEmail,
  backendSyncStatus,
  cloudSyncError,
  backendDatabaseId,
  isVerifyingBackend = false,
  onVerifyBackend,
  onConnectCloudSync
}) => {
  const effectiveSyncState =
    backendSyncStatus || (isCloudSyncActive ? 'connected' : 'local-only');
  const [subTab, setSubTab] = useState<'applications' | 'accounts'>('applications');
  const [appStatusFilter, setAppStatusFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [accountStatusFilter, setAccountStatusFilter] = useState<'all' | 'active' | 'disabled'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Notes local draft per application
  const [notesDraftMap, setNotesDraftMap] = useState<Record<string, string>>({});
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { toastSuccess, toastInfo, toastError } = useToast();

  // Approve & Issue Credentials Modal State
  const [approveTargetApp, setApproveTargetApp] = useState<DealerApplication | null>(null);
  const [issueUserId, setIssueUserId] = useState('');
  const [issuePassword, setIssuePassword] = useState('');
  const [approveError, setApproveError] = useState('');
  const [issuedResultAccount, setIssuedResultAccount] = useState<DealerAccount | null>(null);

  // Reject Modal State
  const [rejectTargetApp, setRejectTargetApp] = useState<DealerApplication | null>(null);
  const [rejectReasonInput, setRejectReasonInput] = useState('');

  // Create / Edit Account Modal State
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<DealerAccount | null>(null);
  const [accFirmName, setAccFirmName] = useState('');
  const [accContactPerson, setAccContactPerson] = useState('');
  const [accBusinessType, setAccBusinessType] = useState('');
  const [accGst, setAccGst] = useState('');
  const [accPhoneCode, setAccPhoneCode] = useState('+91');
  const [accMobile, setAccMobile] = useState('');
  const [accEmail, setAccEmail] = useState('');
  const [accStreetAddress, setAccStreetAddress] = useState('');
  const [accPincode, setAccPincode] = useState('');
  const [accCountry, setAccCountry] = useState('India');
  const [accState, setAccState] = useState('');
  const [accDistrict, setAccDistrict] = useState('');
  const [accCity, setAccCity] = useState('');
  const [accUserId, setAccUserId] = useState('');
  const [accPassword, setAccPassword] = useState('');
  const [accModalError, setAccModalError] = useState('');

  const pendingAppCount = useMemo(
    () => dealerApplications.filter((a) => a.status === 'pending').length,
    [dealerApplications]
  );

  const orderCountByAccountId = useMemo(() => {
    const map: Record<string, number> = {};
    dealerOrders.forEach((ord) => {
      if (ord.dealerAccountId) {
        map[ord.dealerAccountId] = (map[ord.dealerAccountId] || 0) + 1;
      }
    });
    return map;
  }, [dealerOrders]);

  const filteredApplications = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return dealerApplications.filter((app) => {
      if (appStatusFilter !== 'all' && app.status !== appStatusFilter) return false;
      if (!q) return true;
      return (
        app.firmName.toLowerCase().includes(q) ||
        app.contactPerson.toLowerCase().includes(q) ||
        app.gstNumber.toLowerCase().includes(q) ||
        app.whatsappNumber.toLowerCase().includes(q) ||
        app.email.toLowerCase().includes(q) ||
        app.cityState.toLowerCase().includes(q) ||
        app.id.toLowerCase().includes(q)
      );
    });
  }, [dealerApplications, appStatusFilter, searchQuery]);

  const filteredAccounts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return dealerAccounts.filter((acc) => {
      if (accountStatusFilter === 'active' && !acc.active) return false;
      if (accountStatusFilter === 'disabled' && acc.active) return false;
      if (!q) return true;
      return (
        acc.firmName.toLowerCase().includes(q) ||
        acc.contactPerson.toLowerCase().includes(q) ||
        acc.userId.toLowerCase().includes(q) ||
        acc.gstNumber.toLowerCase().includes(q) ||
        acc.whatsappNumber.toLowerCase().includes(q) ||
        acc.email.toLowerCase().includes(q) ||
        acc.cityState.toLowerCase().includes(q)
      );
    });
  }, [dealerAccounts, accountStatusFilter, searchQuery]);

  const handleCopyText = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedId(key);
      setTimeout(() => setCopiedId(null), 2200);
      toastSuccess('Copied to clipboard.', 'Copied');
    } catch {
      toastError('Could not copy to clipboard.', 'Copy Failed');
    }
  };

  const openApproveModal = (app: DealerApplication) => {
    setApproveTargetApp(app);
    setIssuedResultAccount(null);
    setApproveError('');
    setIssueUserId(generateSuggestedDealerUserId(app.firmName, dealerAccounts));
    setIssuePassword(generateDealerPassword());
  };

  const handleConfirmApprove = (e: React.FormEvent) => {
    e.preventDefault();
    if (!approveTargetApp) return;
    const res = onApproveApplication(
      approveTargetApp.id,
      { userId: issueUserId, password: issuePassword },
      adminDisplayName
    );
    if (!res.success || !res.account) {
      setApproveError(res.message);
      return;
    }
    setApproveError('');
    setIssuedResultAccount(res.account);
  };

  const handleConfirmReject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectTargetApp) return;
    if (!rejectReasonInput.trim()) {
      toastError('Please enter a reason before rejecting.', 'Reason Required');
      return;
    }
    onRejectApplication(rejectTargetApp.id, rejectReasonInput, adminDisplayName);
    setRejectTargetApp(null);
    setRejectReasonInput('');
  };

  const openCreateAccountModal = () => {
    setEditingAccount(null);
    setAccFirmName('');
    setAccContactPerson('');
    setAccBusinessType('');
    setAccGst('');
    setAccPhoneCode('+91');
    setAccMobile('');
    setAccEmail('');
    setAccStreetAddress('');
    setAccPincode('');
    setAccCountry('India');
    setAccState('');
    setAccDistrict('');
    setAccCity('');
    setAccUserId(generateSuggestedDealerUserId('dealer', dealerAccounts));
    setAccPassword(generateDealerPassword());
    setAccModalError('');
    setIsAccountModalOpen(true);
  };

  const openEditAccountModal = (acc: DealerAccount) => {
    setEditingAccount(acc);
    setAccFirmName(acc.firmName);
    setAccContactPerson(acc.contactPerson);
    setAccBusinessType(acc.businessType);
    setAccGst(acc.gstNumber);
    setAccPhoneCode(acc.phoneCode);
    setAccMobile(acc.whatsappNumber);
    setAccEmail(acc.email);
    setAccStreetAddress(acc.streetAddress);
    setAccPincode(acc.pincode);
    setAccCountry(acc.country || 'India');
    setAccState(acc.state || '');
    setAccDistrict(acc.district || '');
    setAccCity(acc.city || '');
    setAccUserId(acc.userId);
    setAccPassword(acc.password);
    setAccModalError('');
    setIsAccountModalOpen(true);
  };

  const handleSaveAccountModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accFirmName.trim() || !accContactPerson.trim() || !accMobile.trim() || !accUserId.trim() || !accPassword.trim()) {
      const msg = 'Firm Name, Contact Person, Mobile, User ID, and Password are required.';
      setAccModalError(msg);
      toastError(msg, 'Missing Fields');
      return;
    }
    const cityState = [accCity, accDistrict, accState, accCountry].filter(Boolean).join(', ');
    if (editingAccount) {
      const res = onUpdateAccount(editingAccount.id, {
        firmName: accFirmName.trim(),
        contactPerson: accContactPerson.trim(),
        businessType: accBusinessType.trim(),
        gstNumber: accGst.trim().toUpperCase(),
        phoneCode: accPhoneCode,
        whatsappNumber: accMobile.replace(/\D/g, ''),
        email: accEmail.trim().toLowerCase(),
        streetAddress: accStreetAddress.trim(),
        pincode: accPincode.trim(),
        country: accCountry,
        state: accState,
        district: accDistrict,
        city: accCity,
        cityState,
        userId: accUserId.trim(),
        password: accPassword.trim()
      });
      if (!res.success) {
        setAccModalError(res.message);
        return;
      }
      setIsAccountModalOpen(false);
    } else {
      const res = onCreateManualAccount({
        firmName: accFirmName.trim(),
        contactPerson: accContactPerson.trim(),
        businessType: accBusinessType.trim(),
        gstNumber: accGst.trim().toUpperCase(),
        phoneCode: accPhoneCode,
        whatsappNumber: accMobile.replace(/\D/g, ''),
        email: accEmail.trim().toLowerCase(),
        streetAddress: accStreetAddress.trim(),
        pincode: accPincode.trim(),
        country: accCountry,
        state: accState,
        district: accDistrict,
        city: accCity,
        cityState,
        userId: accUserId.trim(),
        password: accPassword.trim(),
        verificationSummary: `Created manually by ${adminDisplayName}`
      });
      if (!res.success) {
        setAccModalError(res.message);
        return;
      }
      setIsAccountModalOpen(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Live Cloud Sync Indicator */}
      <div
        className={`rounded-xl px-4 py-2.5 border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs ${
          effectiveSyncState === 'connected'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
            : effectiveSyncState === 'connecting'
            ? 'bg-sky-50 border-sky-200 text-sky-900'
            : effectiveSyncState === 'error'
            ? 'bg-rose-50 border-rose-200 text-rose-900'
            : effectiveSyncState === 'offline'
            ? 'bg-amber-50 border-amber-200 text-amber-900'
            : 'bg-slate-50 border-slate-200 text-slate-700'
        }`}
      >
        <div className="flex items-center space-x-2">
          <Cloud
            className={`w-4 h-4 shrink-0 ${
              effectiveSyncState === 'connected'
                ? 'text-emerald-600'
                : effectiveSyncState === 'connecting'
                ? 'text-sky-600 animate-pulse'
                : effectiveSyncState === 'error'
                ? 'text-rose-600'
                : effectiveSyncState === 'offline'
                ? 'text-amber-600'
                : 'text-slate-400'
            }`}
          />
          <span>
            {effectiveSyncState === 'connected' ? (
              <>
                <strong>Live Cloud Sync Active</strong> ({cloudSyncEmail || 'Verified Owner'})
                {backendDatabaseId ? ` · DB verified` : ''} — Public &ldquo;Want to Become a Dealer&rdquo; submissions appear automatically in real time.
              </>
            ) : effectiveSyncState === 'connecting' ? (
              <>
                <strong>Verifying Backend Connection</strong> ({cloudSyncEmail || 'Verified Owner'}) — Checking live Firestore server sync...
              </>
            ) : effectiveSyncState === 'offline' ? (
              <>
                <strong>Offline — Backend Unreachable</strong> — Changes are saved locally until your internet connection resumes.
              </>
            ) : effectiveSyncState === 'error' ? (
              <>
                <strong>Backend Sync Error</strong> — {cloudSyncError || 'Could not confirm live Firestore connection.'}
              </>
            ) : (
              <>
                <strong>Local Browser Storage Only</strong> — Connect Google Cloud Sync to receive public &ldquo;Want to Become a Dealer&rdquo; applications from other devices.
              </>
            )}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {effectiveSyncState === 'local-only' && onConnectCloudSync && (
            <button
              type="button"
              onClick={() => onConnectCloudSync()}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-[#0F2E52] hover:bg-[#1e3a5f] text-white rounded-lg text-[11px] font-bold cursor-pointer"
            >
              <Cloud className="w-3.5 h-3.5" />
              <span>Connect Cloud Sync</span>
            </button>
          )}
          {effectiveSyncState !== 'local-only' && onVerifyBackend && (
            <button
              type="button"
              disabled={isVerifyingBackend}
              onClick={() => onVerifyBackend()}
              className="inline-flex items-center space-x-1 px-2.5 py-1 bg-white/80 hover:bg-white border border-current/20 rounded text-[11px] font-semibold cursor-pointer disabled:opacity-60"
            >
              <span>{isVerifyingBackend ? 'Checking...' : effectiveSyncState === 'connected' ? 'Verify' : 'Retry'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Top KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-700">
            Pending Dealer KYC
          </div>
          <div className="font-display text-2xl font-bold text-amber-600 mt-1 tabular-nums">
            {pendingAppCount}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Awaiting Address, GST &amp; Call Verification
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">
            Active Approved Dealers
          </div>
          <div className="font-display text-2xl font-bold text-emerald-600 mt-1 tabular-nums">
            {dealerAccounts.filter((a) => a.active).length}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Authorized to sign in &amp; submit orders
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Total Applications Logged
          </div>
          <div className="font-display text-2xl font-bold text-slate-900 mt-1 tabular-nums">
            {dealerApplications.length}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            Approved &amp; rejected onboarding records
          </div>
        </div>
      </div>

      {/* Main Container Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Sub-Tabs */}
          <div className="inline-flex p-1 bg-slate-100 rounded-lg border border-slate-200 self-start">
            <button
              type="button"
              onClick={() => setSubTab('applications')}
              className={`px-3.5 py-2 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                subTab === 'applications'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Dealer Applications &amp; KYC ({dealerApplications.length})
            </button>
            <button
              type="button"
              onClick={() => setSubTab('accounts')}
              className={`px-3.5 py-2 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                subTab === 'accounts'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Registered Dealer Accounts ({dealerAccounts.length})
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={openCreateAccountModal}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-[#0F2E52] hover:bg-[#1e3a5f] text-white rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Add Dealer Account</span>
            </button>
            <button
              type="button"
              onClick={() => {
                downloadDealersCSV(dealerApplications, dealerAccounts);
                toastSuccess('Exported dealers & KYC CSV.', 'CSV Downloaded');
              }}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Filter Pills + Search */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-2 border-t border-slate-100">
          {subTab === 'applications' ? (
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: 'pending', label: `Pending (${dealerApplications.filter((a) => a.status === 'pending').length})` },
                  { id: 'approved', label: `Approved (${dealerApplications.filter((a) => a.status === 'approved').length})` },
                  { id: 'rejected', label: `Rejected (${dealerApplications.filter((a) => a.status === 'rejected').length})` },
                  { id: 'all', label: `All (${dealerApplications.length})` }
                ] as const
              ).map((pill) => (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => setAppStatusFilter(pill.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer whitespace-nowrap ${
                    appStatusFilter === pill.id
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: 'all', label: `All (${dealerAccounts.length})` },
                  { id: 'active', label: `Active (${dealerAccounts.filter((a) => a.active).length})` },
                  { id: 'disabled', label: `Disabled (${dealerAccounts.filter((a) => !a.active).length})` }
                ] as const
              ).map((pill) => (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => setAccountStatusFilter(pill.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer whitespace-nowrap ${
                    accountStatusFilter === pill.id
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>
          )}

          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search firm, GST, mobile, email, User ID..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500"
            />
          </div>
        </div>
      </div>

      {/* TAB 1 CONTENT: APPLICATIONS & KYC CHECKLIST */}
      {subTab === 'applications' && (
        <div className="space-y-4">
          {filteredApplications.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-10 text-center text-xs text-slate-500 space-y-2">
              <ShieldCheck className="w-8 h-8 text-slate-300 mx-auto" />
              <div className="font-bold text-sm text-slate-700">No Matching Dealer Applications</div>
              <p>
                New showroom/dealer registrations from the website &ldquo;Want to Become a Dealer&rdquo; form will appear here for Address, GST &amp; Call verification.
              </p>
            </div>
          ) : (
            filteredApplications.map((app) => {
              const v = app.verification || {
                addressVerified: false,
                gstVerified: false,
                callVerified: false
              };
              const checksCompleted =
                (v.addressVerified ? 1 : 0) + (v.gstVerified ? 1 : 0) + (v.callVerified ? 1 : 0);
              const kycReady = isApplicationKycReady(app);
              const gstSyntaxOk = isValidIndianGstFormat(app.gstNumber);
              const notesValue =
                notesDraftMap[app.id] !== undefined ? notesDraftMap[app.id] : v.adminNotes || '';
              const linkedAccount = app.generatedAccountId
                ? dealerAccounts.find((a) => a.id === app.generatedAccountId)
                : undefined;

              return (
                <div
                  key={app.id}
                  className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"
                >
                  {/* Header Row */}
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3 border-b border-slate-100 pb-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-mono font-bold text-slate-700">{app.id}</span>
                        <span className="text-slate-300">·</span>
                        <span className="text-slate-500 font-mono text-[11px]">{app.createdAt}</span>
                        <span className="text-slate-300">·</span>
                        {app.status === 'pending' ? (
                          <span className="inline-flex items-center space-x-1 font-bold text-amber-700">
                            <Clock className="w-3.5 h-3.5" />
                            <span>Pending KYC Verification</span>
                          </span>
                        ) : app.status === 'approved' ? (
                          <span className="inline-flex items-center space-x-1 font-bold text-emerald-700">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Approved ({app.issuedUserId || 'Issued'})</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 font-bold text-rose-700">
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Rejected</span>
                          </span>
                        )}
                      </div>

                      <h3 className="font-display font-bold text-lg text-slate-900">
                        {app.firmName}
                      </h3>
                      <div className="text-xs text-slate-600">
                        Authorized Person: <strong className="text-slate-900">{app.contactPerson}</strong> ·{' '}
                        {app.businessType} · Est. Volume: <strong>{app.estimatedVolume}</strong>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <a
                        href={sanitizePhoneForTel(`${app.phoneCode}${app.whatsappNumber}`)}
                        className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 rounded-lg text-xs font-semibold"
                      >
                        <PhoneCall className="w-3.5 h-3.5 text-blue-600" />
                        <span>Call {app.phoneCode} {app.whatsappNumber}</span>
                      </a>
                      <a
                        href={`https://wa.me/${sanitizePhoneForWhatsApp(`${app.phoneCode}${app.whatsappNumber}`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-semibold"
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                        <span>WhatsApp</span>
                      </a>
                      <button
                        type="button"
                        onClick={() =>
                          onRequestConfirm({
                            title: `Delete Application ${app.id}?`,
                            message: `Remove dealership application for ${app.firmName}?`,
                            confirmLabel: 'Delete Application',
                            tone: 'danger',
                            onConfirm: () => onDeleteApplication(app.id)
                          })
                        }
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer"
                        title="Delete Application"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Applicant Details Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1">
                        <MapPin className="w-3 h-3" />
                        <span>Showroom / Godown Address</span>
                      </div>
                      <div className="font-medium text-slate-900">
                        {app.streetAddress}
                      </div>
                      <div className="text-slate-600 font-mono text-[11px]">
                        {app.cityState} · PIN: <strong>{app.pincode}</strong>
                      </div>
                    </div>

                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                        <span className="flex items-center space-x-1">
                          <FileCheck2 className="w-3 h-3" />
                          <span>GST / Tax Number</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyText(`gst-${app.id}`, app.gstNumber)}
                          className="text-blue-600 hover:underline flex items-center space-x-1 cursor-pointer"
                        >
                          {copiedId === `gst-${app.id}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedId === `gst-${app.id}` ? 'Copied' : 'Copy'}</span>
                        </button>
                      </div>
                      <div className="font-mono font-bold text-sm text-slate-900">{app.gstNumber || 'Not Provided'}</div>
                      <div className={`text-[11px] font-medium ${gstSyntaxOk ? 'text-emerald-700' : 'text-amber-700'}`}>
                        {gstSyntaxOk
                          ? '15-char GSTIN format valid'
                          : 'Manual GST / Tax check required'}
                      </div>
                    </div>

                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center space-x-1">
                        <Mail className="w-3 h-3" />
                        <span>Email &amp; Preferences</span>
                      </div>
                      <div className="font-mono font-semibold text-slate-900 break-all">{app.email}</div>
                      <div className="text-[11px] text-slate-600">
                        Focus: {app.preferredCategories || 'Full Catalog'}
                      </div>
                    </div>
                  </div>

                  {app.notes && (
                    <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                      <strong className="text-slate-800">Applicant Notes:</strong> {app.notes}
                    </div>
                  )}

                  {/* Admin KYC Verification Checklist */}
                  <div className="border border-slate-200 rounded-lg p-4 bg-[#f8fafc] space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs font-bold text-slate-900 flex items-center space-x-1.5">
                        <ShieldCheck className="w-4 h-4 text-blue-600" />
                        <span>Admin Verification Checklist (Required Before Approval)</span>
                      </div>
                      <span
                        className={`text-[11px] font-mono font-bold tabular-nums ${
                          kycReady ? 'text-emerald-700' : 'text-amber-700'
                        }`}
                      >
                        {checksCompleted} / 3 Required Checks Complete
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs">
                      <label
                        className={`p-3 rounded-lg border flex items-start space-x-2.5 cursor-pointer transition-colors ${
                          v.addressVerified
                            ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={v.addressVerified}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            onUpdateKyc(app.id, { addressVerified: checked }, adminDisplayName);
                            toastInfo(checked ? 'Address marked verified.' : 'Address verification unchecked.', 'KYC Updated');
                          }}
                          className="mt-0.5 rounded cursor-pointer"
                        />
                        <div className="min-w-0">
                          <div className="font-bold">Verify Address *</div>
                          <div className="text-[11px] text-slate-600">
                            {v.addressVerified
                              ? `Verified by ${v.addressVerifiedBy || 'Admin'} (${v.addressVerifiedAt || ''})`
                              : 'Confirm street address & pincode'}
                          </div>
                        </div>
                      </label>

                      <label
                        className={`p-3 rounded-lg border flex items-start space-x-2.5 cursor-pointer transition-colors ${
                          v.gstVerified
                            ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={v.gstVerified}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            onUpdateKyc(app.id, { gstVerified: checked }, adminDisplayName);
                            toastInfo(checked ? 'GST Number marked verified.' : 'GST verification unchecked.', 'KYC Updated');
                          }}
                          className="mt-0.5 rounded cursor-pointer"
                        />
                        <div className="min-w-0">
                          <div className="font-bold">Verify GST Number *</div>
                          <div className="text-[11px] text-slate-600">
                            {v.gstVerified
                              ? `Verified by ${v.gstVerifiedBy || 'Admin'} (${v.gstVerifiedAt || ''})`
                              : 'Verify GSTIN matches firm name'}
                          </div>
                        </div>
                      </label>

                      <label
                        className={`p-3 rounded-lg border flex items-start space-x-2.5 cursor-pointer transition-colors ${
                          v.callVerified
                            ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={v.callVerified}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            onUpdateKyc(app.id, { callVerified: checked }, adminDisplayName);
                            toastInfo(checked ? 'Verification call confirmed.' : 'Call verification unchecked.', 'KYC Updated');
                          }}
                          className="mt-0.5 rounded cursor-pointer"
                        />
                        <div className="min-w-0">
                          <div className="font-bold">Verify Call *</div>
                          <div className="text-[11px] text-slate-600">
                            {v.callVerified
                              ? `Verified by ${v.callVerifiedBy || 'Admin'} (${v.callVerifiedAt || ''})`
                              : 'Spoken with authorized contact'}
                          </div>
                        </div>
                      </label>
                    </div>

                    {/* Optional Admin Review Notes */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                      <input
                        type="text"
                        value={notesValue}
                        onChange={(e) =>
                          setNotesDraftMap((prev) => ({ ...prev, [app.id]: e.target.value }))
                        }
                        placeholder="Internal Admin KYC notes (e.g., GST verified on portal, transport line confirmed)..."
                        className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          onUpdateKyc(app.id, { adminNotes: notesValue.trim() }, adminDisplayName);
                          toastSuccess('Admin KYC note saved.', 'KYC Note Saved');
                        }}
                        className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap"
                      >
                        Save KYC Note
                      </button>
                    </div>
                  </div>

                  {/* Decision / Outcome Strip */}
                  {app.status === 'pending' && (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                      <div className="text-[11px] text-slate-600">
                        {kycReady ? (
                          <span className="text-emerald-700 font-semibold">
                            All 3 required verification checks passed. Ready to confirm dealer and issue User ID &amp; Password.
                          </span>
                        ) : (
                          <span>
                            Complete <strong>Verify Address</strong>, <strong>Verify GST Number</strong>, and{' '}
                            <strong>Verify Call</strong> above to unlock Confirm &amp; Approve.
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setRejectTargetApp(app);
                            setRejectReasonInput(app.rejectionReason || '');
                          }}
                          className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-white hover:bg-rose-50 text-rose-700 border border-rose-300 rounded-lg text-xs font-semibold cursor-pointer"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Reject with Reason</span>
                        </button>

                        <button
                          type="button"
                          disabled={!kycReady}
                          onClick={() => openApproveModal(app)}
                          className="inline-flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer"
                          title={
                            kycReady
                              ? 'Confirm dealer and generate User ID & Password'
                              : 'Complete Address, GST, and Call checks first'
                          }
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Confirm &amp; Approve Dealer</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {app.status === 'approved' && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <div className="text-emerald-950">
                        <strong>Approved by {app.reviewedBy || 'Admin'}</strong> ({app.reviewedAt}) · Issued User ID:{' '}
                        <span className="font-mono font-bold">{app.issuedUserId}</span>
                      </div>
                      {linkedAccount && (
                        <div className="flex flex-wrap items-center gap-2">
                          <a
                            href={buildDealerCredentialsWhatsAppUrl({
                              phoneCode: linkedAccount.phoneCode,
                              whatsappNumber: linkedAccount.whatsappNumber,
                              firmName: linkedAccount.firmName,
                              contactPerson: linkedAccount.contactPerson,
                              userId: linkedAccount.userId,
                              password: linkedAccount.password
                            })}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center space-x-1 px-2.5 py-1 bg-[#25D366] text-white rounded text-[11px] font-bold"
                          >
                            <MessageSquare className="w-3 h-3" />
                            <span>Send on WhatsApp</span>
                          </a>
                          <a
                            href={buildDealerCredentialsMailtoUrl({
                              email: linkedAccount.email,
                              firmName: linkedAccount.firmName,
                              contactPerson: linkedAccount.contactPerson,
                              userId: linkedAccount.userId,
                              password: linkedAccount.password
                            })}
                            className="inline-flex items-center space-x-1 px-2.5 py-1 bg-blue-600 text-white rounded text-[11px] font-bold"
                          >
                            <Mail className="w-3 h-3" />
                            <span>Send on Email</span>
                          </a>
                        </div>
                      )}
                    </div>
                  )}

                  {app.status === 'rejected' && (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-900 space-y-0.5">
                      <div>
                        <strong>Rejected by {app.reviewedBy || 'Admin'}</strong> ({app.reviewedAt})
                      </div>
                      <div>
                        <strong>Rejection Reason:</strong> {app.rejectionReason || 'Not specified'}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* TAB 2 CONTENT: REGISTERED DEALER ACCOUNTS DIRECTORY */}
      {subTab === 'accounts' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {filteredAccounts.length === 0 ? (
            <div className="p-10 text-center text-xs text-slate-500 space-y-2">
              <KeyRound className="w-8 h-8 text-slate-300 mx-auto" />
              <div className="font-bold text-sm text-slate-700">No Registered Dealer Accounts Yet</div>
              <p>
                Approve verified dealer applications or click &ldquo;Add Dealer Account&rdquo; to create login credentials manually.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {filteredAccounts.map((acc) => {
                const isPwdShown = Boolean(revealedPasswords[acc.id]);
                const orderCount = orderCountByAccountId[acc.id] || 0;
                const credsText = buildDealerCredentialsMessage({
                  firmName: acc.firmName,
                  contactPerson: acc.contactPerson,
                  userId: acc.userId,
                  password: acc.password
                });

                return (
                  <div key={acc.id} className="p-4 sm:p-5 space-y-3 hover:bg-slate-50/50 transition-colors">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="font-mono text-[11px] font-bold text-slate-500">{acc.id}</span>
                          <span className="text-slate-300">·</span>
                          <span
                            className={`font-bold ${
                              acc.active ? 'text-emerald-700' : 'text-rose-700'
                            }`}
                          >
                            {acc.active ? 'Active Access' : 'Disabled'}
                          </span>
                          <span className="text-slate-300">·</span>
                          <span className="font-mono text-[11px] text-slate-600 tabular-nums">
                            {orderCount} {orderCount === 1 ? 'Order' : 'Orders'} Placed
                          </span>
                          {acc.lastLoginAt && (
                            <>
                              <span className="text-slate-300">·</span>
                              <span className="text-[11px] text-slate-500">
                                Last Sign-In: {acc.lastLoginAt}
                              </span>
                            </>
                          )}
                        </div>

                        <h4 className="font-display font-bold text-base text-slate-900">
                          {acc.firmName}
                        </h4>
                        <div className="text-xs text-slate-600">
                          {acc.contactPerson} · {acc.phoneCode} {acc.whatsappNumber} · {acc.email} ·{' '}
                          {acc.gstNumber ? `GST: ${acc.gstNumber} · ` : ''}
                          {acc.cityState}
                        </div>
                        {acc.streetAddress && (
                          <div className="text-[11px] text-slate-500">
                            Address: {acc.streetAddress} {acc.pincode ? `(${acc.pincode})` : ''}
                          </div>
                        )}
                      </div>

                      {/* Credentials Box + Quick Send Actions */}
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 shrink-0">
                        <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono space-y-0.5">
                          <div>
                            <span className="text-slate-500">User ID: </span>
                            <strong className="text-slate-900">{acc.userId}</strong>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="text-slate-500">Password: </span>
                            <strong className="text-slate-900">
                              {isPwdShown ? acc.password : '••••••••'}
                            </strong>
                            <button
                              type="button"
                              onClick={() =>
                                setRevealedPasswords((p) => ({ ...p, [acc.id]: !p[acc.id] }))
                              }
                              className="text-slate-400 hover:text-slate-700 cursor-pointer"
                            >
                              {isPwdShown ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
                          <a
                            href={buildDealerCredentialsWhatsAppUrl({
                              phoneCode: acc.phoneCode,
                              whatsappNumber: acc.whatsappNumber,
                              firmName: acc.firmName,
                              contactPerson: acc.contactPerson,
                              userId: acc.userId,
                              password: acc.password
                            })}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center space-x-1 px-2.5 py-1.5 bg-[#25D366] hover:bg-emerald-600 text-white rounded-lg text-xs font-bold"
                            title="Send User ID & Password to dealer's WhatsApp"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>WhatsApp</span>
                          </a>

                          <a
                            href={buildDealerCredentialsMailtoUrl({
                              email: acc.email,
                              firmName: acc.firmName,
                              contactPerson: acc.contactPerson,
                              userId: acc.userId,
                              password: acc.password
                            })}
                            className="inline-flex items-center space-x-1 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold"
                            title="Send User ID & Password to dealer's Email"
                          >
                            <Mail className="w-3.5 h-3.5" />
                            <span>Email</span>
                          </a>

                          <button
                            type="button"
                            onClick={() => handleCopyText(`cred-${acc.id}`, credsText)}
                            className="inline-flex items-center space-x-1 px-2.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
                          >
                            {copiedId === `cred-${acc.id}` ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>{copiedId === `cred-${acc.id}` ? 'Copied' : 'Copy'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => openEditAccountModal(acc)}
                            className="p-1.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-lg cursor-pointer"
                            title="Edit profile or reset password"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => onToggleAccountActive(acc.id)}
                            className={`p-1.5 border rounded-lg cursor-pointer ${
                              acc.active
                                ? 'bg-white border-amber-300 text-amber-700 hover:bg-amber-50'
                                : 'bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100'
                            }`}
                            title={acc.active ? 'Disable Dealer Login' : 'Enable Dealer Login'}
                          >
                            <Power className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              onRequestConfirm({
                                title: `Delete Dealer Account (${acc.firmName})?`,
                                message: `Revoke login access and delete dealer account "${acc.userId}"? Existing orders will remain in order history.`,
                                confirmLabel: 'Delete Account',
                                tone: 'danger',
                                onConfirm: () => onDeleteAccount(acc.id)
                              })
                            }
                            className="p-1.5 bg-white hover:bg-rose-50 border border-slate-300 text-rose-600 rounded-lg cursor-pointer"
                            title="Delete Account"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: APPROVE & ISSUE CREDENTIALS (WITH WHATSAPP & EMAIL DISPATCH) */}
      {approveTargetApp && (
        <div className="fixed inset-0 z-60 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg max-h-[90dvh] overflow-y-auto bg-white border border-slate-200 rounded-2xl shadow-xl p-6 space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-display font-bold text-base text-slate-900">
                  {issuedResultAccount
                    ? 'Dealer Approved — Send Credentials'
                    : `Approve & Issue Credentials (${approveTargetApp.firmName})`}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {approveTargetApp.contactPerson} · {approveTargetApp.phoneCode} {approveTargetApp.whatsappNumber} · {approveTargetApp.email}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setApproveTargetApp(null);
                  setIssuedResultAccount(null);
                }}
                className="text-slate-400 hover:text-slate-700 p-1 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {issuedResultAccount ? (
              <div className="space-y-4 text-xs">
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
                  <div className="flex items-center space-x-2 text-emerald-800 font-bold text-sm">
                    <CheckCircle2 className="w-5 h-5" />
                    <span>Dealer Account Activated Successfully</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1 font-mono bg-white p-3 rounded border border-emerald-200">
                    <div>
                      <div className="text-[10px] uppercase text-slate-500">Dealer User ID</div>
                      <div className="font-bold text-slate-900 text-sm">{issuedResultAccount.userId}</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase text-slate-500">Password</div>
                      <div className="font-bold text-slate-900 text-sm">{issuedResultAccount.password}</div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="font-bold text-slate-800">Send Credentials to Dealer Now:</div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <a
                      href={buildDealerCredentialsWhatsAppUrl({
                        phoneCode: issuedResultAccount.phoneCode,
                        whatsappNumber: issuedResultAccount.whatsappNumber,
                        firmName: issuedResultAccount.firmName,
                        contactPerson: issuedResultAccount.contactPerson,
                        userId: issuedResultAccount.userId,
                        password: issuedResultAccount.password
                      })}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center space-x-1.5 px-3 py-2.5 bg-[#25D366] hover:bg-emerald-600 text-white rounded-lg font-bold"
                    >
                      <MessageSquare className="w-4 h-4" />
                      <span>Send WhatsApp</span>
                    </a>

                    <a
                      href={buildDealerCredentialsMailtoUrl({
                        email: issuedResultAccount.email,
                        firmName: issuedResultAccount.firmName,
                        contactPerson: issuedResultAccount.contactPerson,
                        userId: issuedResultAccount.userId,
                        password: issuedResultAccount.password
                      })}
                      className="inline-flex items-center justify-center space-x-1.5 px-3 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold"
                    >
                      <Mail className="w-4 h-4" />
                      <span>Send Email</span>
                    </a>

                    <button
                      type="button"
                      onClick={() =>
                        handleCopyText(
                          'issued-modal',
                          buildDealerCredentialsMessage({
                            firmName: issuedResultAccount.firmName,
                            contactPerson: issuedResultAccount.contactPerson,
                            userId: issuedResultAccount.userId,
                            password: issuedResultAccount.password
                          })
                        )
                      }
                      className="inline-flex items-center justify-center space-x-1.5 px-3 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold cursor-pointer"
                    >
                      {copiedId === 'issued-modal' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      <span>{copiedId === 'issued-modal' ? 'Copied!' : 'Copy Details'}</span>
                    </button>
                  </div>
                </div>

                <div className="flex justify-end pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setApproveTargetApp(null);
                      setIssuedResultAccount(null);
                    }}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg font-semibold cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleConfirmApprove} className="space-y-4 text-xs">
                {approveError && (
                  <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{approveError}</span>
                  </div>
                )}

                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-900">
                  Address, GST Number, and Call checks are verified. Customize or keep the auto-generated login credentials below.
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Dealer User ID *
                    </label>
                    <input
                      type="text"
                      value={issueUserId}
                      onChange={(e) => setIssueUserId(e.target.value)}
                      required
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-sm text-slate-900"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-semibold text-slate-700">Dealer Password *</label>
                      <button
                        type="button"
                        onClick={() => setIssuePassword(generateDealerPassword())}
                        className="inline-flex items-center space-x-1 text-blue-600 hover:underline font-semibold cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Regenerate</span>
                      </button>
                    </div>
                    <input
                      type="text"
                      value={issuePassword}
                      onChange={(e) => setIssuePassword(e.target.value)}
                      required
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-sm text-slate-900"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setApproveTargetApp(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold cursor-pointer"
                  >
                    Confirm Approval &amp; Create Account
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL 2: REJECT DEALER APPLICATION WITH REASON */}
      {rejectTargetApp && (
        <div className="fixed inset-0 z-60 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleConfirmReject}
            className="w-full max-w-md max-h-[90dvh] overflow-y-auto bg-white border border-slate-200 rounded-2xl shadow-xl p-5 space-y-4 text-xs"
          >
            <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-display font-bold text-sm text-slate-900">
                  Reject Dealer Application ({rejectTargetApp.firmName})
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Ref: {rejectTargetApp.id} · Contact: {rejectTargetApp.contactPerson}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setRejectTargetApp(null);
                  setRejectReasonInput('');
                }}
                className="text-slate-400 hover:text-slate-700 p-1 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <div className="font-semibold text-slate-700">Quick Rejection Reasons:</div>
              <div className="flex flex-wrap gap-1.5">
                {REJECTION_REASON_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setRejectReasonInput(preset)}
                    className={`px-2.5 py-1 rounded border text-[11px] cursor-pointer ${
                      rejectReasonInput === preset
                        ? 'bg-rose-50 border-rose-300 text-rose-800 font-semibold'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Rejection Reason *
              </label>
              <textarea
                rows={3}
                required
                value={rejectReasonInput}
                onChange={(e) => setRejectReasonInput(e.target.value)}
                placeholder="Explain why this dealership application was rejected..."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setRejectTargetApp(null);
                  setRejectReasonInput('');
                }}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!rejectReasonInput.trim()}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-bold disabled:opacity-50 cursor-pointer"
              >
                Confirm Rejection
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL 3: CREATE OR EDIT DEALER ACCOUNT */}
      {isAccountModalOpen && (
        <div className="fixed inset-0 z-60 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveAccountModal}
            className="w-full max-w-2xl max-h-[90dvh] overflow-y-auto bg-white border border-slate-200 rounded-2xl shadow-xl p-6 space-y-4 text-xs"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-display font-bold text-base text-slate-900">
                {editingAccount
                  ? `Edit Dealer Account (${editingAccount.firmName})`
                  : 'Create Dealer Account Manually'}
              </h3>
              <button
                type="button"
                onClick={() => setIsAccountModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {accModalError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg">
                {accModalError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Firm / Showroom Name *</label>
                <input
                  type="text"
                  required
                  value={accFirmName}
                  onChange={(e) => setAccFirmName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Contact Person *</label>
                <input
                  type="text"
                  required
                  value={accContactPerson}
                  onChange={(e) => setAccContactPerson(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">GST Number</label>
                <input
                  type="text"
                  value={accGst}
                  onChange={(e) => setAccGst(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono uppercase"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  value={accEmail}
                  onChange={(e) => setAccEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">WhatsApp / Mobile *</label>
                <div className="grid grid-cols-12 gap-1.5">
                  <select
                    value={accPhoneCode}
                    onChange={(e) => setAccPhoneCode(e.target.value)}
                    className="col-span-4 px-2 py-2 border border-slate-300 rounded-lg font-mono"
                  >
                    {COUNTRY_DIAL_CODES.map((c) => (
                      <option key={`${c.country}-${c.code}`} value={c.code}>
                        {c.code}
                      </option>
                    ))}
                  </select>
                  <input
                    type="tel"
                    required
                    value={accMobile}
                    onChange={(e) => setAccMobile(e.target.value)}
                    className="col-span-8 px-3 py-2 border border-slate-300 rounded-lg font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Business Type</label>
                <input
                  type="text"
                  value={accBusinessType}
                  onChange={(e) => setAccBusinessType(e.target.value)}
                  placeholder="e.g. Sanitaryware Showroom / Retailer"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">Showroom Street Address</label>
                <div className="grid grid-cols-12 gap-2">
                  <input
                    type="text"
                    value={accStreetAddress}
                    onChange={(e) => setAccStreetAddress(e.target.value)}
                    placeholder="Street address"
                    className="col-span-8 px-3 py-2 border border-slate-300 rounded-lg"
                  />
                  <input
                    type="text"
                    value={accPincode}
                    onChange={(e) => setAccPincode(e.target.value)}
                    placeholder="Pincode"
                    className="col-span-4 px-3 py-2 border border-slate-300 rounded-lg font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Country</label>
                <select
                  value={accCountry}
                  onChange={(e) => {
                    const nextC = e.target.value;
                    setAccCountry(nextC);
                    if (nextC === 'India') {
                      setAccPhoneCode('+91');
                    } else {
                      const match = COUNTRY_DIAL_CODES.find(
                        (c) => c.country.toLowerCase() === nextC.toLowerCase()
                      );
                      if (match) setAccPhoneCode(match.code);
                    }
                    setAccState('');
                    setAccDistrict('');
                    setAccCity('');
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white"
                >
                  {COUNTRIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">State</label>
                {accCountry === 'India' ? (
                  <select
                    value={accState}
                    onChange={(e) => {
                      const nextS = e.target.value;
                      setAccState(nextS);
                      setAccDistrict('');
                      setAccCity('');
                    }}
                    className={`w-full px-3 py-2 border border-slate-300 rounded-lg bg-white ${
                      !accState ? 'text-slate-400' : 'text-slate-900'
                    }`}
                  >
                    <option value="">-- Select State --</option>
                    {INDIAN_STATES.map((s) => (
                      <option key={s} value={s} className="text-slate-900">{s}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={accState}
                    onChange={(e) => setAccState(e.target.value)}
                    placeholder="State / Province"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                )}
              </div>

              {accCountry === 'India' && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">District</label>
                  <select
                    value={accDistrict}
                    disabled={!accState}
                    onChange={(e) => {
                      const nextD = e.target.value;
                      setAccDistrict(nextD);
                      setAccCity('');
                    }}
                    className={`w-full px-3 py-2 border border-slate-300 rounded-lg ${
                      !accState
                        ? 'bg-slate-50 text-slate-400 cursor-not-allowed'
                        : !accDistrict
                        ? 'bg-white text-slate-400'
                        : 'bg-white text-slate-900'
                    }`}
                  >
                    <option value="">{accState ? '-- Select District --' : '-- Select State First --'}</option>
                    {getDistrictsForState(accState).map((d) => (
                      <option key={d} value={d} className="text-slate-900">{d}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">City</label>
                <input
                  type="text"
                  value={accCity}
                  onChange={(e) => setAccCity(e.target.value)}
                  placeholder="City / Hub"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>

              {/* Login Credentials */}
              <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold text-slate-700">Dealer User ID *</label>
                    <button
                      type="button"
                      onClick={() =>
                        setAccUserId(generateSuggestedDealerUserId(accFirmName || 'dealer', dealerAccounts))
                      }
                      className="text-blue-600 hover:underline font-semibold cursor-pointer"
                    >
                      Auto-Generate
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    value={accUserId}
                    onChange={(e) => setAccUserId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold text-slate-700">Password *</label>
                    <button
                      type="button"
                      onClick={() => setAccPassword(generateDealerPassword())}
                      className="text-blue-600 hover:underline font-semibold cursor-pointer"
                    >
                      Generate
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    value={accPassword}
                    onChange={(e) => setAccPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsAccountModalOpen(false)}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-[#0F2E52] hover:bg-[#1e3a5f] text-white rounded-lg font-bold cursor-pointer"
              >
                {editingAccount ? 'Save Dealer Account' : 'Create Dealer Account'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
