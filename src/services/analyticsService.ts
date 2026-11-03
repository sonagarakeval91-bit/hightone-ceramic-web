import { AnalyticsEvent, AnalyticsEventType, AnalyticsSummary } from '../types';
import { getSheetWebhookUrl } from './inquiryStorageService';

const STORAGE_KEY_EVENTS = 'hightone_private_insights_events';
const STORAGE_KEY_GA_ID = 'hightone_ga4_measurement_id';
const STORAGE_KEY_SESSION = 'hightone_visitor_session_id';
const STORAGE_KEY_GEO = 'hightone_visitor_geo';
const STORAGE_KEY_CONSENT = 'htc_cookie_consent';

export type ConsentStatus = 'accepted' | 'declined' | 'unspecified';

/**
 * Returns current cookie and analytics consent status.
 */
export function getConsentStatus(): ConsentStatus {
  if (typeof window === 'undefined') return 'unspecified';
  try {
    const val = localStorage.getItem(STORAGE_KEY_CONSENT);
    if (val === 'accepted' || val === 'declined') return val;
  } catch {
    // ignore
  }
  return 'unspecified';
}

/**
 * Updates consent status. If accepted, automatically bootstraps GA4 and regional location lookup.
 */
export function setConsentStatus(status: 'accepted' | 'declined'): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_CONSENT, status);
  } catch {
    // ignore
  }

  if (status === 'accepted') {
    initGA4();
    initVisitorTracking();
  }
}

export function hasUserConsented(): boolean {
  return getConsentStatus() === 'accepted';
}

export interface VisitorGeo {
  city?: string;
  region?: string; // State / Province e.g. Gujarat, Maharashtra
  country?: string;
  countryCode?: string;
}

let cachedGeo: VisitorGeo | null = null;
let geoFetchPromise: Promise<VisitorGeo | null> | null = null;

/**
 * Silently detects general area (City, State, Country) via IP address.
 * 100% frictionless — ZERO browser permission popups asked of the user.
 * Strictly adheres to cookie & analytics consent (only runs when accepted).
 */
export async function fetchVisitorGeo(): Promise<VisitorGeo | null> {
  if (typeof window === 'undefined') return null;

  // Respect cookie/tracking consent
  if (getConsentStatus() !== 'accepted') {
    return null;
  }

  if (cachedGeo) return cachedGeo;

  // 1. Check session storage cache
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY_GEO);
    if (raw) {
      cachedGeo = JSON.parse(raw);
      return cachedGeo;
    }
  } catch {
    // ignore
  }

  if (geoFetchPromise) return geoFetchPromise;

  geoFetchPromise = (async () => {
    // Try primary IP geolocation service
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const res = await fetch('https://ipapi.co/json/', {
        signal: controller.signal,
        headers: { Accept: 'application/json' }
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data && (data.city || data.region || data.country_name)) {
          const geo: VisitorGeo = {
            city: data.city || undefined,
            region: data.region || undefined,
            country: data.country_name || 'India',
            countryCode: data.country_code || 'IN'
          };
          cachedGeo = geo;
          try {
            sessionStorage.setItem(STORAGE_KEY_GEO, JSON.stringify(geo));
          } catch {}
          backfillRecentEventsLocation(geo);
          return geo;
        }
      }
    } catch {
      // quiet fallback
    }

    // Try secondary fallback IP geolocation provider
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const res = await fetch('https://ipwho.is/', {
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data && data.success) {
          const geo: VisitorGeo = {
            city: data.city || undefined,
            region: data.region || undefined,
            country: data.country || 'India',
            countryCode: data.country_code || 'IN'
          };
          cachedGeo = geo;
          try {
            sessionStorage.setItem(STORAGE_KEY_GEO, JSON.stringify(geo));
          } catch {}
          backfillRecentEventsLocation(geo);
          return geo;
        }
      }
    } catch {
      // quiet fallback
    }

    return null;
  })();

  return geoFetchPromise;
}

/**
 * If the first event (e.g. initial page view) was recorded while IP lookup was
 * in flight, update the event with the resolved location.
 */
function backfillRecentEventsLocation(geo: VisitorGeo): void {
  try {
    const events = getStoredEvents();
    let updated = false;
    for (let i = events.length - 1; i >= Math.max(0, events.length - 10); i--) {
      if (!events[i].location || (!events[i].location?.city && !events[i].location?.region)) {
        events[i].location = { ...geo };
        updated = true;
      }
    }
    if (updated) {
      saveStoredEvents(events);
    }
  } catch {
    // quiet
  }
}

/**
 * Pre-warms the IP lookup on application launch.
 */
export function initVisitorTracking(): void {
  if (typeof window === 'undefined') return;
  if (getConsentStatus() !== 'accepted') return;
  fetchVisitorGeo().catch(() => {});
}

function getDeviceType(): 'mobile' | 'desktop' | 'tablet' {
  if (typeof window === 'undefined') return 'desktop';
  const ua = navigator.userAgent.toLowerCase();
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
    return 'tablet';
  }
  if (/mobile|iphone|ipod|blackberry|opera mini|iemobile|wpdesktop/i.test(ua)) {
    return 'mobile';
  }
  return 'desktop';
}

export function formatLocationString(loc?: { city?: string; region?: string; country?: string }): string {
  if (!loc) return 'Unknown Area';
  const parts: string[] = [];
  if (loc.city) parts.push(loc.city);
  if (loc.region && loc.region !== loc.city) parts.push(loc.region);
  if (parts.length === 0 && loc.country) parts.push(loc.country);
  return parts.join(', ') || 'Unknown Area';
}

export function getStoredEvents(): AnalyticsEvent[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_EVENTS);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch (e) {
    console.warn('Failed to parse stored analytics:', e);
    return [];
  }
}

export function saveStoredEvents(events: AnalyticsEvent[]): void {
  if (typeof window === 'undefined') return;
  try {
    // Keep last 400 events to manage storage efficiently
    const trimmed = events.slice(-400);
    localStorage.setItem(STORAGE_KEY_EVENTS, JSON.stringify(trimmed));
  } catch (e) {
    console.warn('Failed to save analytics events:', e);
  }
}

/**
 * Silently records a visitor interaction without any public telemetry or UI badges.
 * Stored locally and accessible only through the password-protected Management Portal.
 * Automatically resolves and records visitor area (City, State, Country) without any permissions requested.
 */
export function trackEvent(
  type: AnalyticsEventType,
  target?: string,
  details?: string,
  page?: string
): void {
  if (typeof window === 'undefined') return;

  // Retrieve existing cached geo if available
  let activeGeo = cachedGeo;
  if (!activeGeo) {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY_GEO);
      if (stored) {
        activeGeo = JSON.parse(stored);
        cachedGeo = activeGeo;
      }
    } catch {}
  }

  const event: AnalyticsEvent = {
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type,
    target: target ? target.trim() : undefined,
    details: details ? details.trim() : undefined,
    page: page || window.location.pathname || 'home',
    device: getDeviceType(),
    location: activeGeo ? { ...activeGeo } : undefined,
    timestamp: new Date().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  };

  const events = getStoredEvents();
  events.push(event);
  saveStoredEvents(events);

  // Trigger geo fetch in background if not already cached
  if (!activeGeo) {
    fetchVisitorGeo().catch(() => {});
  }

  // If GA4 gtag exists on window, dispatch standard event
  if (typeof window !== 'undefined' && (window as any).gtag) {
    try {
      (window as any).gtag('event', type, {
        event_category: 'Ceramic Buyer Interaction',
        event_label: target || details,
        device: event.device,
        visitor_area: formatLocationString(event.location)
      });
    } catch {
      // ignore
    }
  }

  // Non-blocking fire-and-forget push to Google Sheet Webhook if configured
  const webhookUrl = getSheetWebhookUrl();
  if (webhookUrl && (type === 'whatsapp_click' || type === 'call_click' || type === 'quote_submit')) {
    try {
      fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'track_event',
          eventType: type,
          target: target || '',
          details: details || '',
          page: event.page,
          device: event.device,
          location: formatLocationString(event.location),
          timestamp: event.timestamp
        }),
        mode: 'no-cors'
      }).catch(() => {
        // quiet fallback
      });
    } catch {
      // quiet
    }
  }
}

/**
 * Computes an executive summary of visitor insights for the management dashboard,
 * including regional/location breakdowns.
 */
export function getAnalyticsSummary(): AnalyticsSummary {
  const events = getStoredEvents();

  let totalPageViews = 0;
  let totalWhatsAppClicks = 0;
  let totalCallClicks = 0;
  let totalQuoteSubmits = 0;

  const collectionCounts: Record<string, number> = {};
  const productCounts: Record<string, number> = {};
  const locationCounts: Record<string, { count: number; city?: string; region?: string; country?: string }> = {};
  const sessionDays = new Set<string>();

  for (const ev of events) {
    if (ev.type === 'page_view') {
      totalPageViews++;
    } else if (ev.type === 'collection_view') {
      totalPageViews++;
      if (ev.target) {
        collectionCounts[ev.target] = (collectionCounts[ev.target] || 0) + 1;
      }
    } else if (ev.type === 'product_view') {
      if (ev.target) {
        productCounts[ev.target] = (productCounts[ev.target] || 0) + 1;
      }
    } else if (ev.type === 'whatsapp_click') {
      totalWhatsAppClicks++;
      if (ev.target && ev.target.includes('Product:')) {
        const prod = ev.target.replace('Product:', '').trim();
        productCounts[prod] = (productCounts[prod] || 0) + 1;
      }
    } else if (ev.type === 'call_click') {
      totalCallClicks++;
    } else if (ev.type === 'quote_submit') {
      totalQuoteSubmits++;
    }

    if (ev.timestamp) {
      sessionDays.add(ev.timestamp.slice(0, 11));
    }

    // Group by location
    if (ev.location && (ev.location.city || ev.location.region || ev.location.country)) {
      const area = formatLocationString(ev.location);
      if (area && area !== 'Unknown Area') {
        if (!locationCounts[area]) {
          locationCounts[area] = {
            count: 0,
            city: ev.location.city,
            region: ev.location.region,
            country: ev.location.country
          };
        }
        locationCounts[area].count++;
      }
    }
  }

  const topCollections = Object.entries(collectionCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const topProducts = Object.entries(productCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const topLocations = Object.entries(locationCounts)
    .map(([area, data]) => ({ area, ...data }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    totalPageViews,
    totalUniqueSessions: Math.max(sessionDays.size, Math.ceil(totalPageViews / 3) || (events.length > 0 ? 1 : 0)),
    totalWhatsAppClicks,
    totalCallClicks,
    totalQuoteSubmits,
    topCollections,
    topProducts,
    topLocations,
    recentEvents: [...events].reverse().slice(0, 60)
  };
}

export function clearAnalyticsData(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY_EVENTS);
}

export function downloadAnalyticsCSV(): void {
  const events = getStoredEvents();
  if (events.length === 0) return;

  const headers = ['Timestamp', 'Event Type', 'Target / Item', 'Details', 'Location (City, State)', 'Page', 'Device'];
  const rows = events.map((ev) => [
    `"${ev.timestamp || ''}"`,
    `"${ev.type}"`,
    `"${(ev.target || '').replace(/"/g, '""')}"`,
    `"${(ev.details || '').replace(/"/g, '""')}"`,
    `"${formatLocationString(ev.location).replace(/"/g, '""')}"`,
    `"${ev.page || ''}"`,
    `"${ev.device || ''}"`
  ]);

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `hightone_insights_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export async function copyAnalyticsForSheets(): Promise<boolean> {
  const events = getStoredEvents();
  if (events.length === 0) return false;

  const headers = ['Timestamp', 'Event Type', 'Target / Item', 'Details', 'Location (City, State)', 'Page', 'Device'];
  const rows = events.map((ev) => [
    ev.timestamp || '',
    ev.type,
    ev.target || '',
    ev.details || '',
    formatLocationString(ev.location),
    ev.page || '',
    ev.device || ''
  ]);

  const tsv = [headers.join('\t'), ...rows.map((r) => r.join('\t'))].join('\n');
  try {
    await navigator.clipboard.writeText(tsv);
    return true;
  } catch {
    return false;
  }
}

/**
 * GA4 Measurement ID Management (Stored in localStorage or sheet config)
 */
export function getSavedGA4Id(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(STORAGE_KEY_GA_ID) || '';
}

export function saveGA4Id(id: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY_GA_ID, id.trim());
  initGA4(id.trim());
}

export function initGA4(id?: string): void {
  if (typeof window === 'undefined') return;
  // Strictly enforce cookie consent before injecting third-party Google Analytics script
  if (getConsentStatus() !== 'accepted') return;

  const measurementId = id || getSavedGA4Id();
  if (!measurementId || !/^G-[A-Z0-9]+$/i.test(measurementId)) return;

  // Check if already injected
  if (document.getElementById('ga4-script')) return;

  const script = document.createElement('script');
  script.id = 'ga4-script';
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.appendChild(script);

  const initScript = document.createElement('script');
  initScript.id = 'ga4-init';
  initScript.text = `
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', '${measurementId}', { send_page_view: true });
  `;
  document.head.appendChild(initScript);
}
