import React, { useState } from 'react';
import {
  X,
  KeyRound,
  Eye,
  EyeOff,
  AlertCircle,
  ShieldCheck
} from 'lucide-react';
import { AdminSessionInfo, AdminStaffAccount } from '../../types';
import { normalizeAdminRole } from '../../utils/adminRoles';
import { useToast } from '../../context/ToastContext';

interface AdminLoginOverlayProps {
  staffAccounts: AdminStaffAccount[];
  onLoginWithSession: (session: AdminSessionInfo) => void;
  onClose: () => void;
}

export const AdminLoginOverlay: React.FC<AdminLoginOverlayProps> = ({
  staffAccounts,
  onLoginWithSession,
  onClose
}) => {
  const [userIdInput, setUserIdInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const { toastSuccess, toastError } = useToast();

  const handleCredentialSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    const enteredUser = userIdInput.trim().toLowerCase();
    const enteredPass = passwordInput.trim();

    if (!enteredUser) {
      setAuthError('Please enter your User ID.');
      toastError('Please enter your User ID.', 'Missing User ID');
      return;
    }
    if (!enteredPass) {
      setAuthError('Please enter your Password.');
      toastError('Please enter your Password.', 'Missing Password');
      return;
    }

    const sheetUser = (localStorage.getItem('hightone_sheet_admin_user') || '').trim().toLowerCase();
    const sheetPass = (localStorage.getItem('hightone_sheet_admin_pass') || '').trim();
    const savedCustomUser = (localStorage.getItem('hightone_admin_user') || '').trim().toLowerCase();
    const savedCustomPass = (localStorage.getItem('hightone_admin_password') || '').trim();
    const defaultUserIds = ['sonagarakeval91@gmail.com', 'admin', 'htc', 'htc-admin'];
    const defaultPasswords = ['HTC@2025', 'Hightone2025', 'htc2025', 'htc1234', 'HTC2025'];

    const matchesSheet = Boolean(sheetUser && sheetPass && enteredUser === sheetUser && enteredPass === sheetPass);
    const matchesCustom = Boolean(savedCustomUser && savedCustomPass && enteredUser === savedCustomUser && enteredPass === savedCustomPass);
    const matchesDefault = defaultUserIds.includes(enteredUser) && defaultPasswords.includes(enteredPass);

    if (matchesSheet || matchesCustom || matchesDefault) {
      toastSuccess('Signed in as Admin (Master Owner).', 'Admin Workspace Unlocked');
      onLoginWithSession({
        userId: userIdInput.trim(),
        displayName: 'Admin',
        role: 'admin',
        isMasterOwner: true
      });
      return;
    }

    const matchedStaff = staffAccounts.find(
      (acc) => acc.userId.trim().toLowerCase() === enteredUser && acc.password === enteredPass
    );
    if (matchedStaff) {
      if (!matchedStaff.active) {
        setAuthError('This staff account is currently disabled. Contact Admin.');
        toastError('This staff account is currently disabled. Contact Admin.', 'Account Disabled');
        return;
      }
      toastSuccess(`Signed in as ${matchedStaff.displayName}.`, 'Workspace Unlocked');
      onLoginWithSession({
        userId: matchedStaff.userId,
        displayName: matchedStaff.displayName,
        role: normalizeAdminRole(matchedStaff.role),
        isMasterOwner: false
      });
      return;
    }

    setAuthError('Invalid User ID or Password. Please check your credentials and try again.');
    toastError('Invalid User ID or Password.', 'Sign-In Failed');
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
              <div className="text-[11px] text-slate-500">Command Center · Credential Sign-In</div>
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
            Enter your User ID and Password. Your workspace opens automatically with the role permissions (<strong>Admin</strong>, <strong>Production Manager</strong>, or <strong>Sales</strong>) assigned to your account.
          </p>
        </div>

        {/* User ID & Password Login Form */}
        <form onSubmit={handleCredentialSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">User ID</label>
            <input
              type="text"
              autoFocus
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
              className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center justify-center space-x-2 cursor-pointer"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Sign In</span>
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
