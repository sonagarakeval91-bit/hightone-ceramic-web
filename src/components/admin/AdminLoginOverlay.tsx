import React, { useState } from 'react';
import {
  X,
  AlertCircle,
  ShieldCheck,
  Cloud,
  RefreshCw,
  CheckCircle2
} from 'lucide-react';
import { AdminSessionInfo, AdminStaffAccount } from '../../types';
import { useToast } from '../../context/ToastContext';
import { useWebsiteData } from '../../context/DataContext';
import { OWNER_ADMIN_EMAIL } from '../../firebase';

interface AdminLoginOverlayProps {
  staffAccounts?: AdminStaffAccount[];
  onLoginWithSession?: (session: AdminSessionInfo) => void;
  onClose: () => void;
}

export const AdminLoginOverlay: React.FC<AdminLoginOverlayProps> = ({
  onClose
}) => {
  const [authError, setAuthError] = useState<string | null>(null);
  const [isGoogleSigningIn, setIsGoogleSigningIn] = useState(false);
  const { toastSuccess, toastError } = useToast();
  const { signInAdminWithGoogle, cloudSyncError } = useWebsiteData();

  const handleGoogleSignIn = async () => {
    if (isGoogleSigningIn) return;
    setAuthError(null);
    setIsGoogleSigningIn(true);
    try {
      const res = await signInAdminWithGoogle();
      if (res.success) {
        toastSuccess(res.message, 'Live Cloud Sync Active');
      } else {
        setAuthError(res.message);
        toastError(res.message, 'Access Not Authorized');
      }
    } finally {
      setIsGoogleSigningIn(false);
    }
  };

  const displayError = authError || cloudSyncError;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-role-login-title"
    >
      <div className="w-full max-w-md max-h-[92dvh] overflow-y-auto bg-white border border-slate-200 rounded-2xl shadow-xl p-6 sm:p-8 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-display font-bold text-base shrink-0">
              H
            </div>
            <div>
              <div className="font-display font-bold text-base text-slate-900">Hightone Admin</div>
              <div className="text-[11px] text-slate-500">Live Multi-Admin Cloud Workspace</div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg transition-colors cursor-pointer"
            aria-label="Close Admin Login"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Title & Context */}
        <div className="space-y-1.5">
          <h1 id="admin-role-login-title" className="font-display font-bold text-xl text-slate-900">
            Sign in with Google
          </h1>
          <p className="text-xs text-slate-600 leading-relaxed">
            Every Admin, Production Manager, and Sales login connects automatically to{' '}
            <strong className="text-slate-900">Live Cloud Sync</strong> so orders, dealers, production logs, blog guides, and settings stay identical across all team devices in real time.
          </p>
        </div>

        {/* Primary Google Cloud Sign-In Card */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
          <div className="space-y-1.5 text-[11px] text-slate-600">
            <div className="flex items-center space-x-2 text-slate-900 font-semibold text-xs">
              <Cloud className="w-4 h-4 text-blue-600 shrink-0" />
              <span>Automatic Real-Time Cloud Sync</span>
            </div>
            <div className="flex items-start space-x-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                Owner account (<span className="font-mono text-slate-800">{OWNER_ADMIN_EMAIL}</span>) gets instant full Admin access.
              </span>
            </div>
            <div className="flex items-start space-x-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                Team members sign in with their authorized Google Email added inside <strong>Admin Security</strong>.
              </span>
            </div>
          </div>

          <button
            type="button"
            disabled={isGoogleSigningIn}
            onClick={handleGoogleSignIn}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center justify-center space-x-2 cursor-pointer"
          >
            {isGoogleSigningIn ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Cloud className="w-4 h-4" />
            )}
            <span>
              {isGoogleSigningIn ? 'Connecting to Cloud Sync...' : 'Continue with Google'}
            </span>
          </button>
        </div>

        {displayError && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
            <span className="leading-relaxed">{displayError}</span>
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-slate-100 gap-3">
          <div className="flex items-start space-x-2 text-[11px] text-slate-500">
            <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <span>
              Need access? Ask the Owner to authorize your Gmail in <strong>Admin Security</strong>.
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer shrink-0"
          >
            Back to Site
          </button>
        </div>
      </div>
    </div>
  );
};
