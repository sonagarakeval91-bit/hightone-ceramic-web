import React, { useEffect, useRef, useState } from 'react';
import {
  Bell,
  BellRing,
  CheckCheck,
  FileSpreadsheet,
  Package,
  Settings,
  UserPlus,
  Volume2,
  VolumeX
} from 'lucide-react';
import { AdminNotificationItem } from '../../services/adminNotificationService';
import { AdminSectionId } from './adminTypes';

interface AdminNotificationsMenuProps {
  notifications: AdminNotificationItem[];
  unreadCount: number;
  soundEnabled: boolean;
  desktopEnabled: boolean;
  desktopPermission: NotificationPermission | 'unsupported';
  canConfigureAlerts: boolean;
  onToggleSound: () => void;
  onEnableDesktopAlerts: () => void;
  onSelectNotification: (item: AdminNotificationItem) => void;
  onMarkAllRead: () => void;
  onOpenAlertSettings: (section: AdminSectionId) => void;
}

export const AdminNotificationsMenu: React.FC<AdminNotificationsMenuProps> = ({
  notifications,
  unreadCount,
  soundEnabled,
  desktopEnabled,
  desktopPermission,
  canConfigureAlerts,
  onToggleSound,
  onEnableDesktopAlerts,
  onSelectNotification,
  onMarkAllRead,
  onOpenAlertSettings
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [isOpen]);

  const renderCategoryIcon = (category: AdminNotificationItem['category']) => {
    switch (category) {
      case 'order':
      case 'order-edit':
        return <Package className="w-4 h-4 text-[#0F2E52] shrink-0 mt-0.5" />;
      case 'kyc':
        return <UserPlus className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />;
      case 'quote':
      case 'inquiry':
      default:
        return <FileSpreadsheet className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />;
    }
  };

  const formatCategoryLabel = (category: AdminNotificationItem['category']) => {
    switch (category) {
      case 'order':
        return 'New Order';
      case 'order-edit':
        return 'Order Edited';
      case 'quote':
        return 'Quote Request';
      case 'kyc':
        return 'Dealer KYC';
      case 'inquiry':
      default:
        return 'Wholesale Inquiry';
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`relative px-2.5 py-2 border rounded-lg text-xs font-semibold transition-colors flex items-center space-x-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
          unreadCount > 0
            ? 'bg-blue-50 border-blue-200 text-[#0F2E52] hover:bg-blue-100'
            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
        }`}
        aria-label={`Admin Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        title="View live orders, inquiries, and dealer KYC notifications"
      >
        {unreadCount > 0 ? (
          <BellRing className="w-3.5 h-3.5 text-[#0F2E52]" />
        ) : (
          <Bell className="w-3.5 h-3.5 text-slate-500" />
        )}
        <span className="hidden xl:inline">Alerts</span>
        {unreadCount > 0 && (
          <span className="font-mono tabular-nums font-bold text-[11px] bg-[#0F2E52] text-white px-1.5 py-0.5 rounded">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="fixed sm:absolute right-3 sm:right-0 left-3 sm:left-auto top-16 sm:top-full sm:mt-2 sm:w-96 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden">
          {/* Popover Header */}
          <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between gap-2">
            <div className="flex items-center space-x-2 min-w-0">
              <span className="font-display font-bold text-xs text-slate-900">
                Admin Notifications
              </span>
              {unreadCount > 0 && (
                <span className="text-[11px] font-mono tabular-nums text-blue-700 font-semibold">
                  · {unreadCount} unread
                </span>
              )}
            </div>

            <div className="flex items-center space-x-1 shrink-0">
              <button
                type="button"
                onClick={onToggleSound}
                className="p-1.5 rounded-md text-slate-600 hover:bg-white hover:text-slate-900 border border-transparent hover:border-slate-200 transition-colors cursor-pointer"
                title={soundEnabled ? 'Sound chime on (click to mute)' : 'Sound muted (click to enable)'}
              >
                {soundEnabled ? (
                  <Volume2 className="w-3.5 h-3.5 text-[#0F2E52]" />
                ) : (
                  <VolumeX className="w-3.5 h-3.5 text-slate-400" />
                )}
              </button>

              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={onMarkAllRead}
                  className="px-2 py-1 rounded-md text-[11px] font-semibold text-blue-700 hover:bg-white border border-transparent hover:border-slate-200 flex items-center space-x-1 cursor-pointer whitespace-nowrap"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>Mark read</span>
                </button>
              )}
            </div>
          </div>

          {/* Desktop Push Opt-in Strip */}
          {desktopPermission !== 'unsupported' &&
            (desktopPermission !== 'granted' || !desktopEnabled) && (
              <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2 text-[11px]">
                <span className="text-slate-600">
                  {desktopPermission === 'denied'
                    ? 'Desktop alerts blocked in browser settings.'
                    : 'Get browser popups for new orders & inquiries:'}
                </span>
                {desktopPermission !== 'denied' && (
                  <button
                    type="button"
                    onClick={onEnableDesktopAlerts}
                    className="px-2.5 py-1 bg-[#0F2E52] hover:bg-[#1e3a5f] text-white rounded text-[11px] font-semibold cursor-pointer whitespace-nowrap shrink-0"
                  >
                    Enable
                  </button>
                )}
              </div>
            )}

          {/* Notification Rows */}
          {notifications.length === 0 ? (
            <div className="px-5 py-8 text-center space-y-2">
              <Bell className="w-6 h-6 text-slate-300 mx-auto" />
              <div className="text-xs font-semibold text-slate-700">
                All caught up
              </div>
              <p className="text-[11px] text-slate-500">
                New dealer orders, inquiries, quotes, and KYC requests appear here automatically.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
              {notifications.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onSelectNotification(item);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors flex items-start space-x-3 cursor-pointer ${
                    item.read ? 'bg-white' : 'bg-blue-50/35'
                  }`}
                >
                  {renderCategoryIcon(item.category)}
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-[#0F2E52]">
                        {formatCategoryLabel(item.category)}
                      </span>
                      <span className="text-[10px] font-mono tabular-nums text-slate-400 shrink-0">
                        {item.timestamp}
                      </span>
                    </div>
                    <div className="text-xs font-semibold text-slate-900 truncate">
                      {item.title}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">
                      {item.subtitle}
                    </div>
                  </div>
                  {!item.read && (
                    <span
                      className="w-2 h-2 rounded-full bg-blue-600 shrink-0 mt-1.5"
                      aria-label="Unread"
                    />
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Footer Action */}
          {canConfigureAlerts && (
            <div className="px-4 py-2.5 border-t border-slate-200 bg-slate-50/70 flex items-center justify-between gap-2">
              <span className="text-[11px] text-slate-500 truncate">
                Gmail alerts active when Vercel SMTP is set
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onOpenAlertSettings('security');
                }}
                className="inline-flex items-center space-x-1 text-[11px] font-semibold text-[#0F2E52] hover:underline cursor-pointer whitespace-nowrap shrink-0"
              >
                <Settings className="w-3 h-3" />
                <span>Email Setup</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
