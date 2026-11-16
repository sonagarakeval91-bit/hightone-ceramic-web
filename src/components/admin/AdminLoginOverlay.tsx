import React, { useState } from 'react';
import {
  X,
  KeyRound,
  Eye,
  EyeOff,
  AlertCircle,
  ShieldCheck,
  Cloud
} from 'lucide-react';
import { AdminSessionInfo, AdminStaffAccount } from '../../types';
import { useToast } from '../../context/ToastContext';
import { useWebsiteData } from '../../context/DataContext';

interface AdminLoginOverlayProps {
  staffAccounts?: AdminStaffAccount[];
  onLoginWithSession: (session: AdminSessionInfo) => void;
  onClose: () => void;
}

export const AdminLoginOverlay: React.FC<AdminLoginOverlayProps> = ({
  onLoginWithSession,
  onClose
}) => {
  const [userIdInput, setUserIdInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isGoogleSigningIn, setIsGoogleSigningIn] = useState(false);
  const [isCredSubmitting, setIsCredSubmitting] = useState(false);
  const { toastSuccess, toastError } = useToast();
  const { signInAdminWithGoogle, signInAdminWithCredentials } = useWebsiteData();

  const handleGoogleSignIn = async () => {
    if (isGoogleSigningIn) return;
    setAuthError(null);
    setIsGoogleSigningIn(true);
    try {
      const res = await signInAdminWithGoogle();
      if (res.success) {
        toastSuccess(res.message, 'Cloud Sync Connected');
      } else {
        setAuthError(res.message);
        toastError(res.message, 'Google Sign-In Failed');
      }
    } finally {
      setIsGoogleSigningIn(false);
    }
  };

  const handleCredentialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCredSubmitting) return;
    setAuthError(null);

    if (!userIdInput.trim()) {
      setAuthError('Please enter your User ID.');
      toastError('Please enter your User ID.', 'Missing User ID');
      return;
    }
    if (!passwordInput.trim()) {
      setAuthError('Please enter your Password.');
      toastError('Please enter your Password.', 'Missing Password');
      return;
    }

    setIsCredSubmitting(true);
    try {
      const res = await signInAdminWithCredentials(userIdInput, passwordInput);
      if (res.success && res.session) {
        toastSuccess(res.message, 'Workspace Unlocked');
        onLoginWithSession(res.session);
      } else {
        setAuthError(res.message);
        toastError(res.message, 'Sign-In Failed');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to verify credentials.';
      setAuthError(msg);
      toastError(msg, 'Sign-In Failed');
    } finally {
      setIsCredSubmitting(false);
    }
  };

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
              <div className="text-[11px] text-slate-500">Command Center · Cloud Sync &amp; RBAC</div>
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

        {/* Title */}
        <div className="space-y-1">
          <h1 id="admin-role-login-title" className="font-display font-bold text-xl text-slate-900">
            Sign in to Workspace
          </h1>
          <p className="text-xs text-slate-500 leading-relaxed">
            Sign in with Google for <strong>Live Cloud Sync</strong> across public devices, or use your assigned User ID &amp; Password below.
          </p>
        </div>

        {/* Primary Cloud Owner & Authorized Staff Sign-In */}
        <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl space-y-2.5">
          <div className="flex items-center space-x-2 text-xs font-bold text-blue-900">
            <Cloud className="w-4 h-4 text-blue-600 shrink-0" />
            <span>Google Cloud Sync (Recommended)</span>
          </div>
          <p className="text-[11px] text-blue-800/80 leading-relaxed">
            Sign in with the Owner Google account (<code>sonagarakeval91@gmail.com</code>) or an Admin-authorized Staff Google Email for live multi-device access.
          </p>
          <button
            type="button"
            disabled={isGoogleSigningIn || isCredSubmitting}
            onClick={handleGoogleSignIn}
            className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 border border-blue-300 text-slate-900 text-xs font-bold rounded-lg shadow-2xs transition-colors flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-60"
          >
            <Cloud className="w-4 h-4 text-blue-600" />
            <span>{isGoogleSigningIn ? 'Connecting Google Account...' : 'Sign in with Google (Owner / Authorized Staff)'}</span>
          </button>
        </div>

        <div className="relative flex items-center py-0.5">
          <div className="grow border-t border-slate-200" />
          <span className="shrink mx-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Or DB Staff / Owner Credentials
          </span>
          <div className="grow border-t border-slate-200" />
        </div>

        {/* User ID & Password Login Form */}
        <form onSubmit={handleCredentialSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">User ID</label>
            <input
              type="text"
              required
              value={userIdInput}
              onChange={(e) => {
                setUserIdInput(e.target.value);
                if (authError) setAuthError(null);
              }}
              placeholder="Enter Admin or Staff User ID..."
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={passwordInput}
                onChange={(e) => {
                  setPasswordInput(e.target.value);
                  if (authError) setAuthError(null);
                }}
                placeholder="Enter password..."
                className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-600/15"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {authError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{authError}</span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
            <button
              type="submit"
              disabled={isCredSubmitting || isGoogleSigningIn}
              className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-semibold rounded-lg transition-colors flex items-center justify-center space-x-2 cursor-pointer"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>{isCredSubmitting ? 'Verifying...' : 'Sign In'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="py-2.5 px-4 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              Back to Site
            </button>
          </div>
        </form>

        <div className="pt-3 border-t border-slate-100 flex items-start space-x-2 text-[11px] text-slate-500">
          <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <span>
            Admins can create and assign User IDs, Passwords, and Roles inside <strong>Admin Security</strong>.
          </span>
        </div>
      </div>
    </div>
  );
};
