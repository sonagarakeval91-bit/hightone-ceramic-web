import React from 'react';
import {
  RefreshCw,
  ExternalLink,
  Unlink,
  Link2,
  KeyRound,
  UserCheck,
  ShieldCheck,
  ListOrdered,
  MapPin,
  Check,
  Navigation,
  Lock,
  Pencil,
  X,
  BellRing,
  Mail,
  Send,
  Volume2,
  VolumeX,
  CheckCircle2,
  AlertTriangle,
  Copy
} from 'lucide-react';
import { cleanGoogleMapsEmbedUrl, DEFAULT_COMPANY_INFO, getGoogleMapsDirectionsUrl } from '../../services/googleSheetsService';
import {
  AdminEmailStatusResult,
  checkAdminEmailAlertStatus,
  notifyAdminByEmail
} from '../../services/adminNotificationService';
import { AdminSectionId } from './adminTypes';
import { useToast } from '../../context/ToastContext';

interface AdminCmsSyncPanelProps {
  sheetId: string | null;
  lastSyncTime: string | null;
  isSyncing: boolean;
  inputUrl: string;
  onInputUrlChange: (val: string) => void;
  onConnect: (e: React.FormEvent) => void;
  onRefresh: () => void;
  onDisconnect: () => void;
  onNavigateSection: (section: AdminSectionId) => void;
}

export const AdminCmsSyncPanel: React.FC<AdminCmsSyncPanelProps> = ({
  sheetId,
  lastSyncTime,
  isSyncing,
  inputUrl,
  onInputUrlChange,
  onConnect,
  onRefresh,
  onDisconnect,
  onNavigateSection
}) => {
  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-blue-700 mb-1">
          System &amp; CMS
        </p>
        <h1 className="font-display font-bold text-2xl text-slate-900">
          Google Sheets &amp; Catalog Sync
        </h1>
        <p className="text-xs text-slate-500 mt-0.5 max-w-2xl">
          Connect your master Google Sheet to synchronize product models, categories, cover images, company details, and legal pages in real time.
        </p>
      </div>

      {/* Connection Status */}
      <div className="p-4 sm:p-5 rounded-xl border border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <span className="font-bold text-slate-900 text-sm">
              {sheetId ? 'Connected to Google Sheet' : 'No Google Sheet Connected'}
            </span>
            {sheetId && (
              <span className="text-xs font-semibold text-emerald-700">· Live Sync</span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {sheetId ? (
              <>
                Sheet ID: <code className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 text-slate-800">{sheetId}</code>
                {lastSyncTime && ` · Last synced: ${lastSyncTime}`}
              </>
            ) : (
              'Paste your Google Sheet link below to enable live catalog and CMS syncing.'
            )}
          </p>
        </div>

        {sheetId && (
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onRefresh}
              disabled={isSyncing}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors flex items-center space-x-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
            </button>
            <a
              href={`https://docs.google.com/spreadsheets/d/${sheetId}/edit`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg transition-colors flex items-center space-x-1.5"
            >
              <span>Open Sheet</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <button
              type="button"
              onClick={onDisconnect}
              className="px-3 py-2 text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg transition-colors flex items-center space-x-1.5 cursor-pointer text-xs font-semibold"
            >
              <Unlink className="w-3.5 h-3.5" />
              <span>Disconnect</span>
            </button>
          </div>
        )}
      </div>

      {/* Connect Form */}
      <form onSubmit={onConnect} className="bg-white p-5 border border-slate-200 rounded-xl space-y-3">
        <label className="block font-semibold text-xs text-slate-900">
          {sheetId ? 'Replace with Another Google Sheet URL or ID' : 'Connect New Google Sheet'}
        </label>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            placeholder="https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/edit..."
            value={inputUrl}
            onChange={(e) => onInputUrlChange(e.target.value)}
            className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500"
          />
          <button
            type="submit"
            disabled={isSyncing || !inputUrl.trim()}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors flex items-center justify-center space-x-1.5 cursor-pointer whitespace-nowrap"
          >
            <Link2 className="w-3.5 h-3.5" />
            <span>{isSyncing ? 'Connecting...' : 'Connect Sheet'}</span>
          </button>
        </div>
      </form>

      {/* Sheet Schema Guide */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
        <span className="font-bold text-slate-900 block text-xs uppercase tracking-wider">
          Expected Tab Names in Your Google Sheet
        </span>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          <div className="p-3 border border-slate-200 rounded-lg space-y-1.5">
            <strong className="text-slate-900 block">1. Products (Catalog &amp; Technical Specs)</strong>
            <p className="text-slate-600">
              <code>category</code> sets subpages (<code>table-top</code>, <code>one-piece</code>, <code>wall-hung</code>, <code>pedestal</code>, <code>urinal</code>).
            </p>
            <p className="text-slate-600">
              <code>dimensions</code> / <code>size</code> supports Inch or MM. <code>trap</code> controls trap badge visibility.
            </p>
          </div>

          <div className="p-3 border border-slate-200 rounded-lg space-y-1">
            <strong className="text-slate-900 block">2. CompanyInfo &amp; Map</strong>
            <p className="text-slate-600">
              Key/value pairs: <code>factory_address</code>, <code>primary_phone</code>, <code>google_maps_embed_url</code>, and <code>google_maps_url</code>.
            </p>
          </div>

          <div className="p-3 border border-slate-200 rounded-lg space-y-1">
            <strong className="text-slate-900 block">3. SiteMedia &amp; Thumbnails</strong>
            <p className="text-slate-600">
              Keys: <code>logo</code>, <code>logo_symbol</code>, <code>logo_stacked</code>, <code>tunnel_kiln</code>, <code>dispatch_loading</code>, plus collection covers.
            </p>
          </div>

          <div className="p-3 border border-slate-200 rounded-lg space-y-1.5">
            <strong className="text-slate-900 block">4. Collections / Categories</strong>
            <p className="text-slate-600">
              Columns: <code>category</code>, <code>title</code>, <code>short_label</code>, <code>subtitle</code>, <code>image_url</code>, <code>order</code>, <code>home</code>, <code>home_order</code>, <code>seo_title</code>, <code>seo_description</code>.
            </p>
            <button
              type="button"
              onClick={() => onNavigateSection('collection-order')}
              className="inline-flex items-center space-x-1.5 text-blue-700 hover:underline font-semibold text-xs cursor-pointer"
            >
              <ListOrdered className="w-3.5 h-3.5" />
              <span>Open Collection Ordering →</span>
            </button>
          </div>

          <div className="p-3 border border-emerald-200 bg-emerald-50/40 rounded-lg space-y-1">
            <strong className="text-slate-900 flex items-center space-x-1.5">
              <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>5. Admin (User ID &amp; Password)</span>
            </strong>
            <p className="text-slate-600">
              Tab name: <code>Admin</code> with columns <code>userId</code> and <code>password</code>.
            </p>
          </div>

          <div className="p-3 border border-blue-200 bg-blue-50/40 rounded-lg space-y-1">
            <strong className="text-slate-900 flex items-center space-x-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
              <span>6. Legal &amp; Policies</span>
            </strong>
            <p className="text-slate-600">
              Tab name: <code>Legal</code> with columns <code>Heading</code>, <code>Detail</code>, and optional <code>Type</code> (Privacy or Terms).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

interface AdminLocationPanelProps {
  locAddress: string;
  locEmbedUrl: string;
  locMapsUrl: string;
  locPhone1: string;
  locPhone2: string;
  locSaveStatus: string | null;
  onLocAddressChange: (val: string) => void;
  onLocEmbedUrlChange: (val: string) => void;
  onLocMapsUrlChange: (val: string) => void;
  onLocPhone1Change: (val: string) => void;
  onLocPhone2Change: (val: string) => void;
  onSaveLocation: (e: React.FormEvent) => void;
  onRestoreAccurateLocation: () => void;
}

export const AdminLocationPanel: React.FC<AdminLocationPanelProps> = ({
  locAddress,
  locEmbedUrl,
  locMapsUrl,
  locPhone1,
  locPhone2,
  locSaveStatus,
  onLocAddressChange,
  onLocEmbedUrlChange,
  onLocMapsUrlChange,
  onLocPhone1Change,
  onLocPhone2Change,
  onSaveLocation,
  onRestoreAccurateLocation
}) => {
  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-blue-700 mb-1">
          Plant Details
        </p>
        <h1 className="font-display font-bold text-2xl text-slate-900">
          Factory Pin &amp; Google Maps Manager
        </h1>
        <p className="text-xs text-slate-500 mt-0.5 max-w-2xl">
          Configure Hightone Ceramic&apos;s manufacturing address, Google Maps pin coordinates, and factory sales phone numbers.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <form onSubmit={onSaveLocation} className="lg:col-span-7 bg-white border border-slate-200 p-5 rounded-xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <h2 className="font-display font-bold text-sm text-slate-900 flex items-center space-x-1.5">
              <MapPin className="w-4 h-4 text-rose-600" />
              <span>Coordinates &amp; Contacts</span>
            </h2>
            <button
              type="button"
              onClick={onRestoreAccurateLocation}
              className="text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
            >
              Restore Thangadh Pin
            </button>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700">
              Official Factory Street Address
            </label>
            <textarea
              rows={2}
              value={locAddress}
              onChange={(e) => onLocAddressChange(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700">
              Google Maps Embed URL or Iframe Code
            </label>
            <textarea
              rows={2}
              value={locEmbedUrl}
              onChange={(e) => onLocEmbedUrlChange(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 font-mono focus:outline-none focus:bg-white focus:border-blue-500"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700">
              Direct Google Maps Navigation Link
            </label>
            <input
              type="text"
              value={locMapsUrl}
              onChange={(e) => onLocMapsUrlChange(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 font-mono focus:outline-none focus:bg-white focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">
                Primary Sales Phone (WhatsApp)
              </label>
              <input
                type="text"
                value={locPhone1}
                onChange={(e) => onLocPhone1Change(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">
                Secondary Phone (Optional)
              </label>
              <input
                type="text"
                value={locPhone2}
                onChange={(e) => onLocPhone2Change(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center space-x-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Save &amp; Update Live</span>
            </button>
            {locSaveStatus && (
              <span className="text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg text-xs font-medium">
                {locSaveStatus}
              </span>
            )}
          </div>
        </form>

        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900">Live Map Preview</span>
              <span className="text-[11px] font-mono text-slate-400">Thangadh, Gujarat</span>
            </div>

            <div className="rounded-lg overflow-hidden border border-slate-200 bg-slate-50 aspect-4/3">
              <iframe
                title="Live Hightone Ceramic Map Preview"
                src={cleanGoogleMapsEmbedUrl(locEmbedUrl) || DEFAULT_COMPANY_INFO.google_maps_embed_url}
                className="w-full h-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
              />
            </div>

            <div className="flex items-center gap-2">
              <a
                href={locMapsUrl || getGoogleMapsDirectionsUrl({ google_maps_embed_url: locEmbedUrl, google_maps_url: locMapsUrl, factory_address: locAddress })}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-2 px-3 bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold text-xs rounded-lg border border-slate-200 flex items-center justify-center space-x-1.5"
              >
                <span>Open Maps</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              <a
                href={getGoogleMapsDirectionsUrl({ google_maps_embed_url: locEmbedUrl, google_maps_url: locMapsUrl, factory_address: locAddress })}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs rounded-lg flex items-center justify-center space-x-1.5"
              >
                <Navigation className="w-3 h-3" />
                <span>Test Directions</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface AdminSecurityPanelProps {
  customUserIdInput: string;
  customPasswordInput: string;
  credentialChangeStatus: string | null;
  staffAccounts: import('../../types').AdminStaffAccount[];
  onAddStaffAccount: (account: Omit<import('../../types').AdminStaffAccount, 'id' | 'createdAt' | 'active'>) => void;
  onUpdateStaffAccount: (id: string, updates: Partial<import('../../types').AdminStaffAccount>) => void;
  onUpdateStaffRole: (id: string, role: import('../../types').AdminRole) => void;
  onToggleStaffActive: (id: string) => void;
  onDeleteStaffAccount: (id: string) => void;
  onRequestConfirm: (config: import('./adminTypes').ConfirmDialogConfig) => void;
  onCustomUserIdChange: (val: string) => void;
  onCustomPasswordChange: (val: string) => void;
  onUpdateCredentials: (e: React.FormEvent) => void | Promise<void>;
  onLockSession: () => void;
  soundEnabled?: boolean;
  desktopEnabled?: boolean;
  desktopPermission?: NotificationPermission | 'unsupported';
  onToggleSound?: () => void;
  onEnableDesktopAlerts?: () => void;
}

export const AdminSecurityPanel: React.FC<AdminSecurityPanelProps> = ({
  customUserIdInput,
  customPasswordInput,
  credentialChangeStatus,
  staffAccounts,
  onAddStaffAccount,
  onUpdateStaffAccount,
  onUpdateStaffRole,
  onToggleStaffActive,
  onDeleteStaffAccount,
  onRequestConfirm,
  onCustomUserIdChange,
  onCustomPasswordChange,
  onUpdateCredentials,
  onLockSession,
  soundEnabled = true,
  desktopEnabled = false,
  desktopPermission = 'default',
  onToggleSound,
  onEnableDesktopAlerts
}) => {
  const [staffName, setStaffName] = React.useState('');
  const [staffUserId, setStaffUserId] = React.useState('');
  const [staffPassword, setStaffPassword] = React.useState('');
  const [staffEmail, setStaffEmail] = React.useState('');
  const [staffRole, setStaffRole] = React.useState<import('../../types').AdminRole>('sales');
  const [staffStatus, setStaffStatus] = React.useState<string | null>(null);
  const [editingStaff, setEditingStaff] = React.useState<import('../../types').AdminStaffAccount | null>(null);
  const [editStaffError, setEditStaffError] = React.useState<string | null>(null);
  const [emailStatus, setEmailStatus] = React.useState<AdminEmailStatusResult | null>(null);
  const [isCheckingEmailStatus, setIsCheckingEmailStatus] = React.useState(false);
  const [isSendingTestEmail, setIsSendingTestEmail] = React.useState(false);
  const [testEmailResult, setTestEmailResult] = React.useState<{ ok: boolean; text: string } | null>(null);
  const { toastError, toastSuccess, toastInfo } = useToast();

  const refreshEmailAlertStatus = React.useCallback(async () => {
    setIsCheckingEmailStatus(true);
    try {
      const status = await checkAdminEmailAlertStatus();
      setEmailStatus(status);
    } finally {
      setIsCheckingEmailStatus(false);
    }
  }, []);

  React.useEffect(() => {
    refreshEmailAlertStatus().catch(() => {});
  }, [refreshEmailAlertStatus]);

  const handleSendTestEmail = async () => {
    setIsSendingTestEmail(true);
    setTestEmailResult(null);
    try {
      const res = await notifyAdminByEmail({
        eventType: 'test',
        referenceId: `TEST-${Date.now().toString().slice(-5)}`,
        firmName: 'Hightone Ceramic Admin Panel',
        contactPerson: 'System Verification',
        summaryPrimary: 'Test Email Delivery Check',
        summarySecondary: 'Orders, Inquiries, Quotes & Dealer KYC Alerts',
        notes: 'This test message confirms your Vercel Gmail SMTP integration is delivering Admin alerts properly.',
        source: 'Admin Security & Alerts Panel'
      });
      setTestEmailResult({ ok: res.ok, text: res.message });
      if (res.ok) {
        toastSuccess(res.message, 'Test Email Sent');
      } else {
        toastInfo(res.message, 'Email Setup Notice');
      }
      refreshEmailAlertStatus().catch(() => {});
    } finally {
      setIsSendingTestEmail(false);
    }
  };

  const handleCopyEnvVar = async (keyName: string) => {
    try {
      await navigator.clipboard.writeText(keyName);
      toastSuccess(`Copied ${keyName} to clipboard.`, 'Copied');
    } catch {
      toastError('Could not copy variable name.', 'Copy Failed');
    }
  };

  const handleCreateStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffName.trim() || !staffUserId.trim() || !staffPassword.trim()) {
      toastError('Enter Staff Name, Login User ID, and Password.', 'Missing Fields');
      return;
    }
    if (staffAccounts.some((a) => a.userId.toLowerCase() === staffUserId.trim().toLowerCase())) {
      const msg = 'A staff account with that User ID already exists.';
      setStaffStatus(msg);
      toastError(msg, 'Duplicate User ID');
      return;
    }
    onAddStaffAccount({
      displayName: staffName.trim(),
      userId: staffUserId.trim(),
      password: staffPassword.trim(),
      staffEmail: staffEmail.trim().toLowerCase() || undefined,
      role: staffRole
    });
    setStaffName('');
    setStaffUserId('');
    setStaffPassword('');
    setStaffEmail('');
    setStaffStatus(`Staff account "${staffName.trim()}" created with role.`);
    setTimeout(() => setStaffStatus(null), 4000);
  };

  return (
    <div className="space-y-5 max-w-5xl">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-blue-700 mb-1">
          Security &amp; Role-Based Access Control
        </p>
        <h1 className="font-display font-bold text-2xl text-slate-900">
          Staff Roles, Permissions &amp; Credentials
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Assign <strong>Admin</strong>, <strong>Production Manager</strong>, or <strong>Sales</strong> roles to staff accounts so sensitive actions like order approval and deletion are strictly controlled.
        </p>
      </div>

      {/* Role Permissions Overview */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
        <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
          <ShieldCheck className="w-4 h-4 text-blue-600" />
          <span className="font-bold text-sm text-slate-900">Role Permissions Matrix</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 text-[11px] uppercase tracking-wider font-semibold">
                <th className="py-2.5 px-3">Role</th>
                <th className="py-2.5 px-3">Order Approval &amp; Deletion</th>
                <th className="py-2.5 px-3">B2B Inquiries &amp; Leads</th>
                <th className="py-2.5 px-3">Daily Production Log</th>
                <th className="py-2.5 px-3">Catalog, System &amp; Staff RBAC</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="py-2.5 px-3 font-bold text-slate-900">Admin</td>
                <td className="py-2.5 px-3 text-emerald-700 font-semibold">Accept / Reject / Edit / Complete / Delete</td>
                <td className="py-2.5 px-3 text-emerald-700 font-semibold">Full Control (Edit &amp; Delete)</td>
                <td className="py-2.5 px-3 text-emerald-700 font-semibold">Log, Edit &amp; Check Ready</td>
                <td className="py-2.5 px-3 text-emerald-700 font-semibold">Full Control</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-bold text-slate-900">Production Manager</td>
                <td className="py-2.5 px-3 text-slate-400">Restricted (Production Only)</td>
                <td className="py-2.5 px-3 text-slate-400">Restricted</td>
                <td className="py-2.5 px-3 text-emerald-700 font-semibold">Log, Edit &amp; Check Ready</td>
                <td className="py-2.5 px-3 text-slate-400">Restricted</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-bold text-slate-900">Sales</td>
                <td className="py-2.5 px-3 text-blue-700 font-semibold">Verify Orders (Stock / Production Routing) &amp; Export PDF/CSV (Contact Masked)</td>
                <td className="py-2.5 px-3 text-slate-400">Restricted</td>
                <td className="py-2.5 px-3 text-slate-500">View Progress Only</td>
                <td className="py-2.5 px-3 text-slate-400">Restricted</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Add & Manage Staff Users */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
          <UserCheck className="w-4 h-4 text-slate-700" />
          <span className="font-bold text-sm text-slate-900">
            Staff Accounts ({staffAccounts.length})
          </span>
        </div>

        <form onSubmit={handleCreateStaff} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
          <div className="sm:col-span-4 space-y-1">
            <label className="block text-[11px] font-semibold text-slate-700">Staff Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Ramesh Patel"
              value={staffName}
              onChange={(e) => setStaffName(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500"
            />
          </div>
          <div className="sm:col-span-4 space-y-1">
            <label className="block text-[11px] font-semibold text-slate-700">Login User ID *</label>
            <input
              type="text"
              required
              placeholder="e.g. order_desk"
              value={staffUserId}
              onChange={(e) => setStaffUserId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500"
            />
          </div>
          <div className="sm:col-span-4 space-y-1">
            <label className="block text-[11px] font-semibold text-slate-700">Password *</label>
            <input
              type="text"
              required
              placeholder="Passcode"
              value={staffPassword}
              onChange={(e) => setStaffPassword(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500"
            />
          </div>
          <div className="sm:col-span-5 space-y-1">
            <label className="block text-[11px] font-semibold text-slate-700">Google Sign-In Email (Optional)</label>
            <input
              type="email"
              placeholder="staff@gmail.com (for Cloud Sync Google login)"
              value={staffEmail}
              onChange={(e) => setStaffEmail(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500"
            />
          </div>
          <div className="sm:col-span-4 space-y-1">
            <label className="block text-[11px] font-semibold text-slate-700">Assigned Role *</label>
            <select
              value={staffRole}
              onChange={(e) => setStaffRole(e.target.value as import('../../types').AdminRole)}
              className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500"
            >
              <option value="sales">Sales</option>
              <option value="production-manager">Production Manager</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="sm:col-span-3">
            <button
              type="submit"
              className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg cursor-pointer"
            >
              + Add Staff
            </button>
          </div>
        </form>

        {staffStatus && (
          <p className="text-emerald-700 bg-emerald-50 border border-emerald-200 p-2.5 rounded-lg text-xs font-medium">
            {staffStatus}
          </p>
        )}

        {staffAccounts.length === 0 ? (
          <p className="text-xs text-slate-500 py-4 text-center border border-dashed border-slate-200 rounded-lg">
            No staff accounts added yet. Add a User ID, Password, Role, and optional Google Email above so each team member logs in directly with their own assigned permissions.
          </p>
        ) : (
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 text-[11px] uppercase tracking-wider font-semibold">
                  <th className="py-2.5 px-3">Name</th>
                  <th className="py-2.5 px-3">User ID</th>
                  <th className="py-2.5 px-3">Password</th>
                  <th className="py-2.5 px-3">Google Sync Email</th>
                  <th className="py-2.5 px-3">Role</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {staffAccounts.map((acc) => (
                  <tr key={acc.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-3 font-semibold text-slate-900">{acc.displayName}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-700">{acc.userId}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-500">{acc.password}</td>
                    <td className="py-2.5 px-3 text-slate-600">
                      {acc.staffEmail ? (
                        <span className="font-mono text-[11px] text-blue-700">{acc.staffEmail}</span>
                      ) : (
                        <span className="text-[11px] text-slate-400">Credential sign-in only</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <select
                        value={acc.role}
                        onChange={(e) => onUpdateStaffRole(acc.id, e.target.value as import('../../types').AdminRole)}
                        className="px-2 py-1 border border-slate-200 rounded bg-white text-xs text-slate-800 font-semibold"
                      >
                        <option value="sales">Sales</option>
                        <option value="production-manager">Production Manager</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td className="py-2.5 px-3">
                      <button
                        type="button"
                        onClick={() => onToggleStaffActive(acc.id)}
                        className={`px-2.5 py-1 rounded text-[11px] font-semibold border cursor-pointer ${
                          acc.active
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-slate-100 text-slate-500 border-slate-200'
                        }`}
                      >
                        {acc.active ? 'Active' : 'Disabled'}
                      </button>
                    </td>
                    <td className="py-2.5 px-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditStaffError(null);
                            setEditingStaff({ ...acc });
                          }}
                          className="text-xs font-semibold text-blue-700 hover:underline inline-flex items-center space-x-1 cursor-pointer"
                          title="Edit staff name, User ID, password or role"
                        >
                          <Pencil className="w-3 h-3" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onRequestConfirm({
                              title: `Remove Staff Account "${acc.displayName}"?`,
                              message: `User "${acc.userId}" will no longer be able to sign in.`,
                              confirmLabel: 'Remove Account',
                              tone: 'danger',
                              onConfirm: () => onDeleteStaffAccount(acc.id)
                            })
                          }
                          className="text-xs font-semibold text-rose-600 hover:underline cursor-pointer"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Email & Live Admin Alerts Setup */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2">
            <Mail className="w-4 h-4 text-[#0F2E52]" />
            <span className="font-bold text-sm text-slate-900">
              Admin Email &amp; Live Notification Alerts
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => refreshEmailAlertStatus()}
              disabled={isCheckingEmailStatus}
              className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg inline-flex items-center space-x-1.5 cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isCheckingEmailStatus ? 'animate-spin' : ''}`} />
              <span>Check Vercel SMTP</span>
            </button>
            <button
              type="button"
              onClick={handleSendTestEmail}
              disabled={isSendingTestEmail}
              className="px-3 py-1.5 bg-[#0F2E52] hover:bg-[#1e3a5f] text-white text-xs font-semibold rounded-lg inline-flex items-center space-x-1.5 cursor-pointer disabled:opacity-60"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSendingTestEmail ? 'Sending...' : 'Send Test Email'}</span>
            </button>
          </div>
        </div>

        {/* Live Status & Preferences */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          <div className="lg:col-span-7 space-y-3">
            <div
              className={`p-3 rounded-lg border text-xs flex items-start space-x-2.5 ${
                emailStatus?.configured
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-slate-50 border-slate-200 text-slate-800'
              }`}
            >
              {emailStatus?.configured ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              )}
              <div className="space-y-0.5">
                <div className="font-semibold">
                  {emailStatus?.configured
                    ? 'Gmail SMTP Active on Vercel'
                    : emailStatus?.reachable
                    ? 'Vercel SMTP Environment Variables Missing'
                    : 'Live Gmail Email Dispatch (Vercel Production)'}
                </div>
                <p className="text-[11px] opacity-85">
                  {emailStatus?.message ||
                    'Checking serverless /api/notify-admin delivery status...'}
                </p>
              </div>
            </div>

            {testEmailResult && (
              <div
                className={`p-3 rounded-lg border text-xs ${
                  testEmailResult.ok
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-amber-50 border-amber-200 text-amber-900'
                }`}
              >
                {testEmailResult.text}
              </div>
            )}

            <div className="text-xs text-slate-600 space-y-1.5">
              <div className="font-semibold text-slate-800">
                Events Covered Automatically:
              </div>
              <p className="text-[11px] leading-relaxed">
                New Dealer Orders · Dealer Order Edits · Wholesale Dealer Inquiries · Quote Modal Requests · Become a Verified Dealer KYC Applications
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              {onToggleSound && (
                <button
                  type="button"
                  onClick={onToggleSound}
                  className="px-3 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 inline-flex items-center space-x-1.5 cursor-pointer"
                >
                  {soundEnabled ? (
                    <Volume2 className="w-3.5 h-3.5 text-[#0F2E52]" />
                  ) : (
                    <VolumeX className="w-3.5 h-3.5 text-slate-400" />
                  )}
                  <span>Sound Chime: {soundEnabled ? 'On' : 'Muted'}</span>
                </button>
              )}

              {onEnableDesktopAlerts && desktopPermission !== 'unsupported' && (
                <button
                  type="button"
                  onClick={onEnableDesktopAlerts}
                  disabled={desktopPermission === 'granted' && desktopEnabled}
                  className="px-3 py-2 bg-slate-50 hover:bg-slate-100 disabled:opacity-70 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 inline-flex items-center space-x-1.5 cursor-pointer"
                >
                  <BellRing className="w-3.5 h-3.5 text-[#0F2E52]" />
                  <span>
                    {desktopPermission === 'granted' && desktopEnabled
                      ? 'Desktop Push Alerts: Enabled'
                      : desktopPermission === 'denied'
                      ? 'Desktop Alerts Blocked in Browser'
                      : 'Enable Desktop Push Alerts'}
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* 3-Step Gmail App Password Setup */}
          <div className="lg:col-span-5 bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2.5 text-xs">
            <div className="font-bold text-slate-900">
              One-Time Gmail SMTP Setup (Free)
            </div>
            <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-slate-600 leading-relaxed">
              <li>
                Sign into <span className="font-mono text-slate-800">hightoneceramic@gmail.com</span>, turn on 2-Step Verification, and generate a 16-character App Password at{' '}
                <span className="font-mono text-slate-800">myaccount.google.com/apppasswords</span>.
              </li>
              <li>
                In Vercel Project Settings → Environment Variables, add:
              </li>
            </ol>
            <div className="space-y-1.5 pt-0.5">
              {[
                { key: 'SMTP_USER', desc: 'hightoneceramic@gmail.com' },
                { key: 'SMTP_PASS', desc: '16-char Google App Password' },
                { key: 'ADMIN_NOTIFY_EMAIL', desc: 'Recipient Gmail (comma-separated allowed)' }
              ].map((item) => (
                <div
                  key={item.key}
                  className="flex items-center justify-between gap-2 bg-white border border-slate-200 rounded px-2.5 py-1.5"
                >
                  <div className="min-w-0">
                    <span className="font-mono font-bold text-[11px] text-[#0F2E52]">{item.key}</span>
                    <span className="text-[10px] text-slate-500 ml-1.5">· {item.desc}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopyEnvVar(item.key)}
                    className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer shrink-0"
                    title={`Copy ${item.key}`}
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-slate-500">
              3. Redeploy on Vercel, then click <strong>Send Test Email</strong> above.
            </p>
          </div>
        </div>
      </div>

      {/* Master Owner Override */}
      <form onSubmit={onUpdateCredentials} className="bg-white p-5 border border-slate-200 rounded-xl space-y-4 max-w-2xl">
        <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
          <KeyRound className="w-4 h-4 text-slate-700" />
          <span className="font-bold text-sm text-slate-900">
            Master Owner Login Credentials
          </span>
        </div>

        <p className="text-xs text-slate-500">
          Signing in with Master Admin credentials grants full <strong>Admin</strong> access. Saving here updates both local and Cloud SHA-256 owner login verification when Cloud Sync is connected.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Owner User ID</label>
            <input
              type="text"
              required
              value={customUserIdInput}
              onChange={(e) => onCustomUserIdChange(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">New Password</label>
            <input
              type="text"
              required
              placeholder="Enter new password..."
              value={customPasswordInput}
              onChange={(e) => onCustomPasswordChange(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg cursor-pointer"
          >
            Save Owner Credentials
          </button>

          <button
            type="button"
            onClick={onLockSession}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg cursor-pointer flex items-center space-x-1.5"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Lock Admin Session</span>
          </button>
        </div>

        {credentialChangeStatus && (
          <p className="text-emerald-700 bg-emerald-50 p-2.5 rounded-lg text-xs font-medium">
            {credentialChangeStatus}
          </p>
        )}
      </form>

      {/* EDIT STAFF ACCOUNT MODAL */}
      {editingStaff && (
        <div className="fixed inset-0 z-60 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const trimmedUid = editingStaff.userId.trim();
              if (!editingStaff.displayName.trim() || !trimmedUid || !editingStaff.password.trim()) {
                const msg = 'Name, User ID, and Password are required.';
                setEditStaffError(msg);
                toastError(msg, 'Missing Fields');
                return;
              }
              const duplicate = staffAccounts.some(
                (a) => a.id !== editingStaff.id && a.userId.toLowerCase() === trimmedUid.toLowerCase()
              );
              if (duplicate) {
                const msg = 'Another staff account already uses that Login User ID.';
                setEditStaffError(msg);
                toastError(msg, 'Duplicate User ID');
                return;
              }
              onUpdateStaffAccount(editingStaff.id, {
                displayName: editingStaff.displayName.trim(),
                userId: trimmedUid,
                password: editingStaff.password.trim(),
                staffEmail: editingStaff.staffEmail?.trim().toLowerCase() || undefined,
                role: editingStaff.role,
                active: editingStaff.active
              });
              setEditingStaff(null);
              setStaffStatus(`Updated staff account "${editingStaff.displayName.trim()}".`);
              setTimeout(() => setStaffStatus(null), 4000);
            }}
            className="w-full max-w-md max-h-[90dvh] overflow-y-auto bg-white border border-slate-200 rounded-2xl shadow-xl p-5 space-y-4"
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-display font-bold text-base text-slate-900">
                  Edit Staff Account
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Update display name, login User ID, password, or assigned role.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingStaff(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {editStaffError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 font-medium">
                {editStaffError}
              </div>
            )}

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-slate-700">Staff Name *</label>
                <input
                  type="text"
                  required
                  value={editingStaff.displayName}
                  onChange={(e) => setEditingStaff({ ...editingStaff, displayName: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-slate-700">Login User ID *</label>
                <input
                  type="text"
                  required
                  value={editingStaff.userId}
                  onChange={(e) => setEditingStaff({ ...editingStaff, userId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-slate-700">Password *</label>
                <input
                  type="text"
                  required
                  value={editingStaff.password}
                  onChange={(e) => setEditingStaff({ ...editingStaff, password: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-slate-700">Google Sign-In Email (Optional)</label>
                <input
                  type="email"
                  placeholder="staff@gmail.com"
                  value={editingStaff.staffEmail || ''}
                  onChange={(e) => setEditingStaff({ ...editingStaff, staffEmail: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-slate-700">Assigned Role</label>
                  <select
                    value={editingStaff.role}
                    onChange={(e) =>
                      setEditingStaff({
                        ...editingStaff,
                        role: e.target.value as import('../../types').AdminRole
                      })
                    }
                    className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-800"
                  >
                    <option value="sales">Sales</option>
                    <option value="production-manager">Production Manager</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div className="flex items-end pb-2">
                  <label className="inline-flex items-center space-x-2 text-xs font-semibold text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingStaff.active}
                      onChange={(e) => setEditingStaff({ ...editingStaff, active: e.target.checked })}
                      className="w-4 h-4 rounded border-slate-300 text-emerald-600"
                    />
                    <span>Account Active</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingStaff(null)}
                className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg cursor-pointer"
              >
                Save Staff Changes
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
