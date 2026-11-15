import React, { useMemo, useState } from 'react';
import { useWebsiteData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import { SavedDealerOrder } from '../../types';
import {
  formatDeliveryDateLabel,
  getEffectiveVerificationStatus,
  isOrderCompleted
} from '../../utils/adminRoles';
import { downloadDealerOrderPDF, printDealerOrderPDF } from '../../utils/orderPdf';
import {
  LogIn,
  LogOut,
  Eye,
  EyeOff,
  ShieldCheck,
  UserPlus,
  Package,
  Search,
  Pencil,
  RotateCcw,
  Download,
  Printer,
  ChevronDown,
  ChevronUp,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Plus,
  Lock
} from 'lucide-react';

interface DealerPortalWorkspaceProps {
  gateTitle?: string;
  gateSubtitle?: string;
  onCreateNewOrder: () => void;
  onEditActiveOrder: (order: SavedDealerOrder) => void;
  onReorderOrder: (order: SavedDealerOrder) => void;
  onGoToBecomeDealer: () => void;
}

type DealerOrderFilter = 'all' | 'pending' | 'accepted' | 'completed' | 'rejected';

export const DealerPortalWorkspace: React.FC<DealerPortalWorkspaceProps> = ({
  gateTitle,
  gateSubtitle,
  onCreateNewOrder,
  onEditActiveOrder,
  onReorderOrder,
  onGoToBecomeDealer
}) => {
  const { dealerSession, dealerSignIn, dealerSignOut, dealerOrders, companyInfo } = useWebsiteData();
  const { toastError, toastInfo, toastSuccess } = useToast();

  // Sign-In Form State
  const [userIdInput, setUserIdInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Signed-In Orders View State
  const [statusFilter, setStatusFilter] = useState<DealerOrderFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  const handleSignInSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userIdInput.trim() || !passwordInput) {
      const msg = 'Please enter both your Dealer User ID and Password.';
      setLoginError(msg);
      toastError(msg, 'Sign-In Required');
      return;
    }
    const res = dealerSignIn(userIdInput, passwordInput);
    if (!res.success) {
      setLoginError(res.message);
      toastError(res.message, 'Sign-In Failed');
      return;
    }
    toastSuccess(`Signed in to dealer account (${userIdInput.trim()}).`, 'Dealer Portal Unlocked');
    setLoginError('');
    setUserIdInput('');
    setPasswordInput('');
  };

  // Orders belonging strictly to the signed-in dealer account
  const myOrders = useMemo(() => {
    if (!dealerSession) return [];
    return dealerOrders.filter(
      (ord) =>
        ord.dealerAccountId === dealerSession.accountId ||
        (ord.dealerUserId &&
          ord.dealerUserId.toLowerCase() === dealerSession.userId.toLowerCase())
    );
  }, [dealerOrders, dealerSession]);

  const counts = useMemo(() => {
    let pending = 0;
    let accepted = 0;
    let completed = 0;
    let rejected = 0;
    myOrders.forEach((ord) => {
      if (isOrderCompleted(ord)) {
        completed++;
        return;
      }
      const ver = getEffectiveVerificationStatus(ord);
      if (ver === 'pending') pending++;
      else if (ver === 'accepted') accepted++;
      else if (ver === 'rejected') rejected++;
    });
    return {
      all: myOrders.length,
      pending,
      accepted,
      completed,
      rejected
    };
  }, [myOrders]);

  const filteredOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return myOrders.filter((ord) => {
      const completed = isOrderCompleted(ord);
      const ver = getEffectiveVerificationStatus(ord);

      if (statusFilter === 'completed' && !completed) return false;
      if (statusFilter === 'pending' && (completed || ver !== 'pending')) return false;
      if (statusFilter === 'accepted' && (completed || ver !== 'accepted')) return false;
      if (statusFilter === 'rejected' && (completed || ver !== 'rejected')) return false;

      if (!q) return true;
      const inId = (ord.orderId || ord.id).toLowerCase().includes(q);
      const inItems = (ord.items || []).some((i) => i.name.toLowerCase().includes(q));
      const inNotes = (ord.dealerInfo?.notes || '').toLowerCase().includes(q);
      return inId || inItems || inNotes;
    });
  }, [myOrders, statusFilter, searchQuery]);

  // SIGNED-OUT VIEW: Existing Dealer Sign-In + Want to Become a Dealer Verification Gate
  if (!dealerSession) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left: Existing Dealer Sign In */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-6 sm:p-8 flex flex-col justify-between space-y-6">
          <div className="space-y-2 border-b border-slate-100 pb-4">
            <div className="flex items-center space-x-2 text-[#0F2E52]">
              <Lock className="w-4 h-4" />
              <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-[#64748b]">
                VERIFIED DEALER ACCESS
              </span>
            </div>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-[#0F2E52]">
              {gateTitle || 'Sign In as Existing Dealer'}
            </h2>
            <p className="text-xs sm:text-sm text-[#515f74]">
              {gateSubtitle ||
                'Enter the Dealer User ID and Password issued by Hightone Ceramic Admin to place factory orders, view previous & pending orders, and edit active orders.'}
            </p>
          </div>

          <form onSubmit={handleSignInSubmit} className="space-y-4 text-xs">
            {loginError && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                Dealer User ID *
              </label>
              <input
                type="text"
                value={userIdInput}
                onChange={(e) => setUserIdInput(e.target.value)}
                placeholder="e.g. htc_apex_ceramics"
                autoComplete="username"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-[3px] font-mono text-sm text-slate-900 focus:outline-none focus:border-[#0F2E52]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                Password *
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Enter your factory-issued password"
                  autoComplete="current-password"
                  className="w-full pl-3.5 pr-10 py-2.5 bg-white border border-slate-300 rounded-[3px] font-mono text-sm text-slate-900 focus:outline-none focus:border-[#0F2E52]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full inline-flex items-center justify-center space-x-2 px-5 py-3 bg-[#0F2E52] hover:bg-[#1e3a5f] text-white rounded-[3px] text-xs font-bold transition-colors cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              <span>Sign In to Dealer Workspace</span>
            </button>
          </form>
        </div>

        {/* Right: Want to Become a Dealer Gate */}
        <div className="lg:col-span-5 bg-[#f7f9fb] border border-slate-200 rounded-lg p-6 sm:p-8 flex flex-col justify-between space-y-5">
          <div className="space-y-3">
            <div className="w-10 h-10 rounded bg-white border border-slate-200 flex items-center justify-center text-[#0F2E52]">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="font-display text-lg sm:text-xl font-bold text-[#0F2E52]">
              New Showroom or Distributor?
            </h3>
            <p className="text-xs text-[#515f74] leading-relaxed">
              Only Admin-verified dealers can submit factory orders to Hightone Ceramic. Register once with your showroom address, GST number, WhatsApp number, and Email ID.
            </p>
            <ul className="space-y-2 text-xs text-slate-700 pt-1">
              <li className="flex items-start space-x-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span>Admin verifies Address, GST &amp; Phone Call</span>
              </li>
              <li className="flex items-start space-x-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span>User ID &amp; Password delivered on WhatsApp &amp; Email</span>
              </li>
              <li className="flex items-start space-x-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span>Track pending orders &amp; edit active orders before completion</span>
              </li>
            </ul>
          </div>

          <button
            type="button"
            onClick={onGoToBecomeDealer}
            className="w-full inline-flex items-center justify-center space-x-2 px-5 py-3 bg-white hover:bg-[#0F2E52] text-[#0F2E52] hover:text-white border border-[#0F2E52] rounded-[3px] text-xs font-bold transition-colors cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Want to Become a Dealer</span>
          </button>
        </div>
      </div>
    );
  }

  // SIGNED-IN VIEW: Dealer Self-Service Dashboard & Order History
  return (
    <div className="space-y-6">
      {/* Dealer Account Header Strip */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-emerald-700">
              VERIFIED DEALER ACCOUNT
            </span>
            <span className="text-slate-300">·</span>
            <span className="text-[11px] font-mono text-slate-500">
              ID: <strong className="text-slate-800">{dealerSession.userId}</strong>
            </span>
          </div>
          <h2 className="font-display text-xl sm:text-2xl font-bold text-[#0F2E52]">
            {dealerSession.firmName}
          </h2>
          <p className="text-xs text-slate-600">
            {dealerSession.contactPerson} · {dealerSession.phoneCode} {dealerSession.whatsappNumber} ·{' '}
            {dealerSession.email} · {dealerSession.cityState}
            {dealerSession.gstNumber ? ` · GST: ${dealerSession.gstNumber}` : ''}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onCreateNewOrder}
            className="inline-flex items-center space-x-1.5 px-4 py-2.5 bg-[#0F2E52] hover:bg-[#1e3a5f] text-white rounded-[3px] text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Order</span>
          </button>

          <button
            type="button"
            onClick={() => {
              dealerSignOut();
              toastInfo('Signed out of your Dealer workspace.', 'Signed Out');
            }}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2.5 bg-white hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-300 rounded-[3px] text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {/* KPI Metrics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Total Orders
          </div>
          <div className="font-display text-2xl font-bold text-[#0F2E52] mt-1 tabular-nums">
            {counts.all}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-700">
            Pending Verification
          </div>
          <div className="font-display text-2xl font-bold text-amber-600 mt-1 tabular-nums">
            {counts.pending}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">
            Accepted &amp; Active
          </div>
          <div className="font-display text-2xl font-bold text-emerald-600 mt-1 tabular-nums">
            {counts.accepted}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Completed Orders
          </div>
          <div className="font-display text-2xl font-bold text-slate-800 mt-1 tabular-nums">
            {counts.completed}
          </div>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: 'all', label: `All (${counts.all})` },
              { id: 'pending', label: `Pending (${counts.pending})` },
              { id: 'accepted', label: `Accepted (${counts.accepted})` },
              { id: 'completed', label: `Completed (${counts.completed})` },
              { id: 'rejected', label: `Rejected (${counts.rejected})` }
            ] as Array<{ id: DealerOrderFilter; label: string }>
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                statusFilter === tab.id
                  ? 'bg-[#0F2E52] text-white border-[#0F2E52]'
                  : 'bg-[#f7f9fb] text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Order ID or model..."
            className="w-full pl-9 pr-3 py-2 bg-[#f7f9fb] border border-slate-200 rounded text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-[#0F2E52]"
          />
        </div>
      </div>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-10 text-center space-y-3">
          <Package className="w-8 h-8 text-slate-300 mx-auto" />
          <div className="font-display font-bold text-base text-[#0F2E52]">
            {myOrders.length === 0
              ? 'No Orders Placed Yet Under This Account'
              : 'No Orders Match Your Current Filter'}
          </div>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {myOrders.length === 0
              ? 'Place your first wholesale order using our visual catalog builder—your firm profile and territory details are already pre-filled.'
              : 'Try switching status tabs or clearing the search input.'}
          </p>
          {myOrders.length === 0 && (
            <button
              type="button"
              onClick={onCreateNewOrder}
              className="inline-flex items-center space-x-2 px-5 py-2.5 bg-[#0F2E52] hover:bg-[#1e3a5f] text-white rounded-[3px] text-xs font-bold cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create First Dealer Order</span>
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-200 overflow-hidden">
          {filteredOrders.map((ord) => {
            const completed = isOrderCompleted(ord);
            const verStatus = getEffectiveVerificationStatus(ord);
            const isExpanded = expandedOrderId === ord.id;
            const orderCode = ord.orderId || ord.id;

            return (
              <div key={ord.id} className="p-4 sm:p-5 space-y-3 hover:bg-slate-50/50 transition-colors">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
                      <span className="font-mono font-bold text-[#0F2E52] text-sm tabular-nums">
                        {orderCode}
                      </span>
                      <span className="text-slate-300">·</span>
                      <span className="text-slate-500 font-mono text-[11px] tabular-nums">
                        {ord.timestamp || 'Recent'}
                      </span>
                      {ord.lastEditedAt && (
                        <>
                          <span className="text-slate-300">·</span>
                          <span className="text-[11px] font-semibold text-blue-700">
                            Edited ({ord.editCount || 1}x) on {ord.lastEditedAt}
                          </span>
                        </>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                      {completed ? (
                        <span className="inline-flex items-center space-x-1 font-bold text-slate-700">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Completed</span>
                        </span>
                      ) : verStatus === 'accepted' ? (
                        <span className="inline-flex items-center space-x-1 font-bold text-emerald-700">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>
                            Accepted &amp; Active
                            {ord.availabilityStatus === 'shortage-routed'
                              ? ` (${ord.productionRoutedCount || 0} shortage line(s) in Production)`
                              : ord.availabilityStatus === 'all-in-stock'
                              ? ' (Ready In Stock)'
                              : ''}
                          </span>
                        </span>
                      ) : verStatus === 'rejected' ? (
                        <span className="inline-flex items-center space-x-1 font-bold text-red-700">
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Rejected — Edit &amp; Resubmit Available</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1 font-bold text-amber-700">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Pending Factory Verification</span>
                        </span>
                      )}

                      <span className="text-slate-300">·</span>
                      <span className="font-mono font-semibold text-slate-800 tabular-nums">
                        {ord.totalQuantity} Units ({ord.totalModels} Models) ·{' '}
                        {(ord.totalWeightKg || 0).toFixed(1)} kg
                      </span>
                      {ord.requiredDate && (
                        <>
                          <span className="text-slate-300">·</span>
                          <span className="text-[11px] font-mono text-slate-600 tabular-nums">
                            Target: {formatDeliveryDateLabel(ord.requiredDate)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Row Actions */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {!completed && (
                      <button
                        type="button"
                        onClick={() => onEditActiveOrder(ord)}
                        className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-[#0F2E52] hover:bg-[#1e3a5f] text-white rounded text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
                        title="Modify quantities, grades, packings, or delivery schedule"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span>Edit Order</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => onReorderOrder(ord)}
                      className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
                      title="Load these items as a fresh new order"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reorder</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        downloadDealerOrderPDF(ord, companyInfo);
                        toastSuccess(`Downloaded PDF copy for order ${orderCode}.`, 'PDF Downloaded');
                      }}
                      className="inline-flex items-center space-x-1 px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-semibold cursor-pointer whitespace-nowrap"
                      title="Download PDF copy"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>PDF</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        printDealerOrderPDF(ord, companyInfo);
                        toastInfo(`Opening printable sheet for order ${orderCode}.`, 'Print Order Sheet');
                      }}
                      className="inline-flex items-center space-x-1 px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 rounded text-xs font-semibold cursor-pointer whitespace-nowrap"
                      title="Print Order Sheet"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Print</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setExpandedOrderId(isExpanded ? null : ord.id)}
                      className="inline-flex items-center space-x-1 px-2.5 py-1.5 text-slate-600 hover:text-[#0F2E52] text-xs font-semibold cursor-pointer"
                    >
                      <span>{isExpanded ? 'Hide' : 'Details'}</span>
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {ord.rejectionReason && (
                  <div className="p-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-800">
                    <strong>Rejection Reason:</strong> {ord.rejectionReason}
                  </div>
                )}

                {isExpanded && (
                  <div className="pt-3 border-t border-slate-200 space-y-3">
                    <div className="overflow-x-auto border border-slate-200 rounded">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100 text-slate-600 text-[11px] uppercase">
                          <tr>
                            <th className="py-2 px-3">Sr.</th>
                            <th className="py-2 px-3">Model &amp; Color/Code Split</th>
                            <th className="py-2 px-3">Grade · Packing</th>
                            <th className="py-2 px-3 text-right">Qty</th>
                            <th className="py-2 px-3 text-right">Weight</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {ord.items.map((item, idx) => (
                            <tr key={`${item.productId}-${item.grade}-${item.packing}-${idx}`}>
                              <td className="py-2 px-3 text-slate-400 font-mono">{idx + 1}</td>
                              <td className="py-2 px-3">
                                <div className="font-semibold text-slate-900">{item.name}</div>
                                <div className="text-[11px] font-mono text-slate-600 mt-0.5">
                                  {(item.colorSplits || [])
                                    .map((s) => `${s.codeOrColor}: ${s.quantity}`)
                                    .join(' · ')}
                                </div>
                              </td>
                              <td className="py-2 px-3 text-slate-700 font-medium whitespace-nowrap">
                                {item.grade} · {item.packing}
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-[#0F2E52] tabular-nums">
                                {item.totalQuantity}
                              </td>
                              <td className="py-2 px-3 text-right font-mono text-slate-600 tabular-nums">
                                {(item.totalWeightKg || 0).toFixed(1)} kg
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {ord.dealerInfo?.notes && (
                      <div className="text-xs text-slate-600">
                        <strong className="text-slate-800">Order Notes:</strong> {ord.dealerInfo.notes}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
