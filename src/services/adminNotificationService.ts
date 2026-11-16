import { AdminSectionId } from '../components/admin/adminTypes';

export type AdminNotificationEventType =
  | 'new_order'
  | 'edited_order'
  | 'inquiry'
  | 'quote'
  | 'dealer_kyc'
  | 'test';

export interface AdminEmailNotificationPayload {
  eventType: AdminNotificationEventType;
  referenceId: string;
  firmName: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  location?: string;
  summaryPrimary?: string;
  summarySecondary?: string;
  notes?: string;
  source?: string;
  submittedAt?: string;
}

export interface AdminEmailDispatchResult {
  ok: boolean;
  configured: boolean;
  reachable: boolean;
  message: string;
}

export interface AdminEmailStatusResult {
  reachable: boolean;
  configured: boolean;
  hasUser?: boolean;
  hasPass?: boolean;
  recipientHint?: string;
  message: string;
}

export interface AdminNotificationItem {
  id: string;
  category: 'order' | 'order-edit' | 'inquiry' | 'quote' | 'kyc';
  title: string;
  subtitle: string;
  timestamp: string;
  targetSection: AdminSectionId;
  searchHint?: string;
  read: boolean;
}

const STORAGE_KEY_SOUND = 'hightone_admin_alert_sound';
const STORAGE_KEY_DESKTOP = 'hightone_admin_alert_desktop';
const STORAGE_KEY_READ_IDS = 'hightone_admin_read_notif_ids';

const dispatchedEmailKeys = new Set<string>();

export function getNotificationSoundEnabled(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SOUND);
    return raw === null ? true : raw === 'true';
  } catch {
    return true;
  }
}

export function setNotificationSoundEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_SOUND, enabled ? 'true' : 'false');
  } catch {
    // Ignore storage quota errors
  }
}

export function getDesktopAlertsEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(STORAGE_KEY_DESKTOP) === 'true';
  } catch {
    return false;
  }
}

export function setDesktopAlertsEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_DESKTOP, enabled ? 'true' : 'false');
  } catch {
    // Ignore storage quota errors
  }
}

export function getReadNotificationIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY_READ_IDS);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return new Set(parsed.filter((v): v is string => typeof v === 'string'));
    }
  } catch {
    // Ignore malformed cache
  }
  return new Set();
}

export function markNotificationIdsRead(ids: string[]): Set<string> {
  const existing = getReadNotificationIds();
  ids.forEach((id) => {
    if (id) existing.add(id);
  });
  const trimmed = Array.from(existing).slice(-250);
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY_READ_IDS, JSON.stringify(trimmed));
    } catch {
      // Ignore storage quota errors
    }
  }
  return new Set(trimmed);
}

export function unmarkNotificationIdRead(id: string): Set<string> {
  const existing = getReadNotificationIds();
  existing.delete(id);
  const trimmed = Array.from(existing).slice(-250);
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY_READ_IDS, JSON.stringify(trimmed));
    } catch {
      // Ignore storage quota errors
    }
  }
  return new Set(trimmed);
}

/**
 * Play a gentle, two-tone Web Audio chime for incoming live Admin alerts.
 */
export function playAdminAlertChime(kind: 'order' | 'inquiry' | 'kyc' = 'order'): void {
  if (typeof window === 'undefined' || !getNotificationSoundEnabled()) return;
  try {
    const AudioCtx =
      window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    const notes =
      kind === 'order'
        ? [587.33, 880.0] // D5 -> A5 (crisp two-tone chime for orders)
        : kind === 'kyc'
        ? [523.25, 783.99] // C5 -> G5
        : [523.25, 659.25]; // C5 -> E5

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.11);

      gain.gain.setValueAtTime(0.0001, now + idx * 0.11);
      gain.gain.exponentialRampToValueAtTime(0.11, now + idx * 0.11 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.11 + 0.24);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.11);
      osc.stop(now + idx * 0.11 + 0.26);
    });

    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 650);
  } catch {
    // Browser blocked autoplay or Web Audio unsupported
  }
}

export async function requestDesktopAlertPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  try {
    const perm = await window.Notification.requestPermission();
    if (perm === 'granted') {
      setDesktopAlertsEnabled(true);
    }
    return perm;
  } catch {
    return window.Notification.permission;
  }
}

export function showDesktopAdminNotification(
  title: string,
  body: string,
  tag?: string,
  onClick?: () => void
): void {
  if (
    typeof window === 'undefined' ||
    !('Notification' in window) ||
    window.Notification.permission !== 'granted' ||
    !getDesktopAlertsEnabled()
  ) {
    return;
  }
  try {
    const notif = new window.Notification(title, {
      body,
      tag: tag || `hightone-admin-${Date.now()}`
    });
    notif.onclick = () => {
      window.focus();
      onClick?.();
      notif.close();
    };
  } catch {
    // Ignore unsupported platform contexts
  }
}

export async function checkAdminEmailAlertStatus(): Promise<AdminEmailStatusResult> {
  if (typeof window === 'undefined') {
    return {
      reachable: false,
      configured: false,
      message: 'Browser environment required.'
    };
  }
  try {
    const res = await fetch('/api/notify-admin', {
      method: 'GET',
      headers: { Accept: 'application/json' }
    });
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return {
        reachable: false,
        configured: false,
        message: 'Serverless email route is only active on your deployed Vercel site (not Vite dev preview).'
      };
    }
    const data = await res.json();
    const providerLabel = data?.provider === 'resend' ? 'Resend Email API' : 'Gmail SMTP';
    return {
      reachable: true,
      configured: Boolean(data?.configured),
      hasUser: Boolean(data?.hasUser),
      hasPass: Boolean(data?.hasPass),
      recipientHint: typeof data?.recipientHint === 'string' ? data.recipientHint : undefined,
      message: data?.configured
        ? `${providerLabel} active on Vercel · Delivering to ${data.recipientHint || 'Admin email'}`
        : 'Vercel endpoint reached, but SMTP_USER / SMTP_PASS env vars are not set yet.'
    };
  } catch {
    return {
      reachable: false,
      configured: false,
      message: 'Could not reach /api/notify-admin endpoint.'
    };
  }
}

export async function notifyAdminByEmail(
  payload: AdminEmailNotificationPayload
): Promise<AdminEmailDispatchResult> {
  if (typeof window === 'undefined') {
    return { ok: false, configured: false, reachable: false, message: 'Unavailable outside browser.' };
  }

  const dedupeKey =
    payload.eventType === 'test'
      ? ''
      : `${payload.eventType}:${payload.referenceId}:${payload.summaryPrimary || ''}`;

  if (dedupeKey && dispatchedEmailKeys.has(dedupeKey)) {
    return {
      ok: true,
      configured: true,
      reachable: true,
      message: 'Notification already dispatched for this submission.'
    };
  }
  if (dedupeKey) {
    dispatchedEmailKeys.add(dedupeKey);
  }

  try {
    const res = await fetch('/api/notify-admin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return {
        ok: false,
        configured: false,
        reachable: false,
        message: 'Email alerts activate once deployed to Vercel with SMTP_USER and SMTP_PASS configured.'
      };
    }

    const data = await res.json();
    return {
      ok: Boolean(data?.ok),
      configured: Boolean(data?.configured),
      reachable: true,
      message:
        typeof data?.message === 'string'
          ? data.message
          : data?.ok
          ? 'Email notification delivered.'
          : 'Email notification did not send.'
    };
  } catch {
    return {
      ok: false,
      configured: false,
      reachable: false,
      message: 'Network error contacting /api/notify-admin.'
    };
  }
}
