import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  MapPin,
  X
} from 'lucide-react';

export type ToastTone = 'success' | 'info' | 'warning' | 'error' | 'brand';

export interface ToastOptions {
  title?: string;
  message: string;
  subtext?: string;
  tone?: ToastTone;
  badge?: string;
  icon?: 'default' | 'location';
  durationMs?: number;
}

interface ToastItem extends Required<Pick<ToastOptions, 'message' | 'tone'>> {
  id: string;
  title?: string;
  subtext?: string;
  badge?: string;
  icon?: 'default' | 'location';
  durationMs: number;
}

interface ToastContextValue {
  showToast: (options: ToastOptions) => string;
  toastSuccess: (message: string, title?: string, subtext?: string) => string;
  toastInfo: (message: string, title?: string, subtext?: string) => string;
  toastWarning: (message: string, title?: string, subtext?: string) => string;
  toastError: (message: string, title?: string, subtext?: string) => string;
  dismissToast: (id: string) => void;
  clearToasts: () => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const MAX_VISIBLE_TOASTS = 4;

const DEFAULT_DURATION_BY_TONE: Record<ToastTone, number> = {
  success: 3800,
  info: 3800,
  warning: 4800,
  error: 5500,
  brand: 6500
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const pausedRemainingRef = useRef<Map<string, { startedAt: number; remainingMs: number }>>(new Map());

  const clearTimer = useCallback((id: string) => {
    const existing = timersRef.current.get(id);
    if (existing) {
      clearTimeout(existing);
      timersRef.current.delete(id);
    }
  }, []);

  const dismissToast = useCallback(
    (id: string) => {
      clearTimer(id);
      pausedRemainingRef.current.delete(id);
      setToasts((prev) => prev.filter((t) => t.id !== id));
    },
    [clearTimer]
  );

  const scheduleDismiss = useCallback(
    (id: string, durationMs: number) => {
      clearTimer(id);
      pausedRemainingRef.current.set(id, {
        startedAt: Date.now(),
        remainingMs: durationMs
      });
      const timer = setTimeout(() => {
        dismissToast(id);
      }, durationMs);
      timersRef.current.set(id, timer);
    },
    [clearTimer, dismissToast]
  );

  const handleMouseEnter = useCallback(
    (id: string) => {
      clearTimer(id);
      const timing = pausedRemainingRef.current.get(id);
      if (timing) {
        const elapsed = Date.now() - timing.startedAt;
        pausedRemainingRef.current.set(id, {
          startedAt: Date.now(),
          remainingMs: Math.max(800, timing.remainingMs - elapsed)
        });
      }
    },
    [clearTimer]
  );

  const handleMouseLeave = useCallback(
    (id: string) => {
      const timing = pausedRemainingRef.current.get(id);
      if (timing) {
        scheduleDismiss(id, Math.max(800, timing.remainingMs));
      }
    },
    [scheduleDismiss]
  );

  const showToast = useCallback(
    (options: ToastOptions): string => {
      const tone: ToastTone = options.tone || 'info';
      const durationMs = options.durationMs ?? DEFAULT_DURATION_BY_TONE[tone];
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

      setToasts((prev) => {
        // Avoid duplicate identical messages stacked back-to-back
        const deduped = prev.filter((t) => {
          const isSame =
            t.message === options.message &&
            (t.title || '') === (options.title || '') &&
            t.tone === tone;
          if (isSame) {
            clearTimer(t.id);
            pausedRemainingRef.current.delete(t.id);
          }
          return !isSame;
        });

        const nextToast: ToastItem = {
          id,
          title: options.title,
          message: options.message,
          subtext: options.subtext,
          tone,
          badge: options.badge,
          icon: options.icon || 'default',
          durationMs
        };

        const combined = [...deduped, nextToast];
        if (combined.length > MAX_VISIBLE_TOASTS) {
          const dropped = combined.slice(0, combined.length - MAX_VISIBLE_TOASTS);
          dropped.forEach((d) => {
            clearTimer(d.id);
            pausedRemainingRef.current.delete(d.id);
          });
          return combined.slice(combined.length - MAX_VISIBLE_TOASTS);
        }
        return combined;
      });

      scheduleDismiss(id, durationMs);
      return id;
    },
    [clearTimer, scheduleDismiss]
  );

  const toastSuccess = useCallback(
    (message: string, title?: string, subtext?: string) =>
      showToast({ tone: 'success', message, title: title || 'Success', subtext }),
    [showToast]
  );

  const toastInfo = useCallback(
    (message: string, title?: string, subtext?: string) =>
      showToast({ tone: 'info', message, title: title || 'Updated', subtext }),
    [showToast]
  );

  const toastWarning = useCallback(
    (message: string, title?: string, subtext?: string) =>
      showToast({ tone: 'warning', message, title: title || 'Notice', subtext }),
    [showToast]
  );

  const toastError = useCallback(
    (message: string, title?: string, subtext?: string) =>
      showToast({ tone: 'error', message, title: title || 'Action Required', subtext }),
    [showToast]
  );

  const clearToasts = useCallback(() => {
    timersRef.current.forEach((timer) => clearTimeout(timer));
    timersRef.current.clear();
    pausedRemainingRef.current.clear();
    setToasts([]);
  }, []);

  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => clearTimeout(timer));
      timersRef.current.clear();
    };
  }, []);

  return (
    <ToastContext.Provider
      value={{
        showToast,
        toastSuccess,
        toastInfo,
        toastWarning,
        toastError,
        dismissToast,
        clearToasts
      }}
    >
      {children}

      {/* Global Toast Viewport — positioned below top action bar & above modals/floating widgets */}
      {toasts.length > 0 && (
        <div
          aria-live="polite"
          aria-relevant="additions removals"
          className="fixed top-20 right-4 sm:right-6 z-[120] flex flex-col gap-2.5 w-[calc(100vw-2rem)] sm:w-full max-w-sm pointer-events-none"
        >
          {toasts.map((toast) => {
            const isBrand = toast.tone === 'brand';
            const containerClasses = isBrand
              ? 'bg-[#0F2E52] text-white border border-cyan-400/50 ring-1 ring-white/10'
              : toast.tone === 'success'
              ? 'bg-white text-slate-900 border border-slate-200 border-l-4 border-l-emerald-600'
              : toast.tone === 'error'
              ? 'bg-white text-slate-900 border border-rose-200 border-l-4 border-l-rose-600'
              : toast.tone === 'warning'
              ? 'bg-white text-slate-900 border border-amber-200 border-l-4 border-l-amber-500'
              : 'bg-white text-slate-900 border border-slate-200 border-l-4 border-l-[#0F2E52]';

            const titleColor = isBrand
              ? 'text-cyan-300'
              : toast.tone === 'success'
              ? 'text-emerald-700'
              : toast.tone === 'error'
              ? 'text-rose-700'
              : toast.tone === 'warning'
              ? 'text-amber-700'
              : 'text-[#0F2E52]';

            return (
              <div
                key={toast.id}
                role={toast.tone === 'error' ? 'alert' : 'status'}
                onMouseEnter={() => handleMouseEnter(toast.id)}
                onMouseLeave={() => handleMouseLeave(toast.id)}
                className={`pointer-events-auto rounded-[6px] p-3.5 shadow-xl flex items-start gap-3 text-xs motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-right-4 duration-200 ${containerClasses}`}
              >
                {/* Icon */}
                <div className="shrink-0 mt-0.5">
                  {toast.icon === 'location' ? (
                    <div className="w-7 h-7 rounded-full bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center">
                      <MapPin className="w-3.5 h-3.5 text-cyan-300" />
                    </div>
                  ) : toast.tone === 'brand' ? (
                    <div className="w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    </div>
                  ) : toast.tone === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : toast.tone === 'error' ? (
                    <AlertCircle className="w-4 h-4 text-rose-600" />
                  ) : toast.tone === 'warning' ? (
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                  ) : (
                    <Info className="w-4 h-4 text-[#0F2E52]" />
                  )}
                </div>

                {/* Body */}
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                      {toast.title && (
                        <span className={`font-bold text-[11px] uppercase tracking-wider leading-tight ${titleColor}`}>
                          {toast.title}
                        </span>
                      )}
                      {toast.badge && (
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                            isBrand
                              ? 'bg-cyan-950/80 border border-cyan-500/40 text-cyan-200'
                              : 'bg-slate-100 border border-slate-200 text-slate-700'
                          }`}
                        >
                          {toast.badge}
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => dismissToast(toast.id)}
                      aria-label="Dismiss notification"
                      className={`p-0.5 rounded transition-colors cursor-pointer shrink-0 ${
                        isBrand
                          ? 'text-slate-400 hover:text-white'
                          : 'text-slate-400 hover:text-slate-700'
                      }`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <p className={`text-xs font-semibold leading-snug ${isBrand ? 'text-white' : 'text-slate-900'}`}>
                    {toast.message}
                  </p>

                  {toast.subtext && (
                    <p className={`text-[11px] leading-relaxed pt-0.5 ${isBrand ? 'text-slate-300' : 'text-slate-500'}`}>
                      {toast.subtext}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
};
