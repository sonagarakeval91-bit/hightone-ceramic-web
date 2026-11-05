import { AnalyticsEvent, AnalyticsEventType, AnalyticsSummary, LocationMarketInsight } from '../types';
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

    // Check document.cookie
    const cookies = document.cookie.split(';');
    for (const c of cookies) {
      const [k, v] = c.trim().split('=');
      if (k === STORAGE_KEY_CONSENT && (v === 'accepted' || v === 'declined')) {
        return v as ConsentStatus;
      }
    }
  } catch {
    // ignore
  }
  return 'unspecified';
}

/**
 * Updates consent status in both localStorage and document.cookie.
 * If accepted, automatically bootstraps GA4 and visitor location tracking.
 */
export function setConsentStatus(status: 'accepted' | 'declined'): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY_CONSENT, status);
    const d = new Date();
    d.setTime(d.getTime() + (365 * 24 * 60 * 60 * 1000));
    document.cookie = `${STORAGE_KEY_CONSENT}=${status};expires=${d.toUTCString()};path=/;SameSite=Lax`;
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

export function getLiveGeoFromCookie(): VisitorGeo | null {
  if (typeof window === 'undefined') return null;
  try {
    const cookies = document.cookie.split(';');
    for (const c of cookies) {
      const [k, v] = c.trim().split('=');
      if (k === 'hightone_live_geo' && v) {
        return JSON.parse(decodeURIComponent(v));
      }
    }
  } catch {}
  return null;
}

export interface VisitorGeo {
  city?: string;
  district?: string;
  region?: string; // State / Province e.g. Gujarat, Maharashtra
  postal?: string; // PIN code
  country?: string;
  countryCode?: string;
  precision?: 'gps' | 'network';
  isp?: string;
  latitude?: number;
  longitude?: number;
}

let cachedGeo: VisitorGeo | null = null;
let geoFetchPromise: Promise<VisitorGeo | null> | null = null;

/**
 * Requests high-accuracy GPS browser location (with district & postal PIN code).
 * Reverse-geocodes via OpenStreetMap Nominatim for exact municipality/district.
 */
export async function requestPreciseLocation(force = false): Promise<VisitorGeo | null> {
  if (typeof window === 'undefined' || !navigator.geolocation) {
    return null;
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;

          // Reverse geocode via OpenStreetMap Nominatim
          let city: string | undefined = undefined;
          let district: string | undefined = undefined;
          let region: string | undefined = undefined;
          let postal: string | undefined = undefined;
          let country = 'India';
          let countryCode = 'IN';

          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 4000);
            const res = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=14&addressdetails=1`,
              { signal: controller.signal, headers: { 'Accept-Language': 'en' } }
            );
            clearTimeout(timeoutId);
            if (res.ok) {
              const data = await res.json();
              const addr = data.address || {};
              city = addr.city || addr.town || addr.village || addr.municipality || addr.suburb || addr.hamlet;
              district = addr.state_district || addr.county || addr.district;
              region = addr.state;
              postal = addr.postcode;
              country = addr.country || 'India';
              countryCode = (addr.country_code || 'IN').toUpperCase();
            }
          } catch {
            // fallback if Nominatim has rate limits: use BigDataCloud
            try {
              const bRes = await fetch(
                `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`
              );
              if (bRes.ok) {
                const bData = await bRes.json();
                city = bData.locality || bData.city;
                district = bData.localityInfo?.administrative?.[2]?.name || bData.principalSubdivision;
                region = bData.principalSubdivision;
                postal = bData.postcode;
                country = bData.countryName || 'India';
                countryCode = bData.countryCode || 'IN';
              }
            } catch {}
          }

          const geo: VisitorGeo = {
            city: city || district || 'Local Center',
            district: district !== city ? district : undefined,
            region: region || 'Gujarat',
            postal,
            country,
            countryCode,
            precision: 'gps',
            latitude: lat,
            longitude: lon
          };

          cachedGeo = geo;
          try {
            sessionStorage.setItem(STORAGE_KEY_GEO, JSON.stringify(geo));
            localStorage.setItem(STORAGE_KEY_GEO, JSON.stringify(geo));
            const d = new Date();
            d.setTime(d.getTime() + (365 * 24 * 60 * 60 * 1000));
            document.cookie = `hightone_live_geo=${encodeURIComponent(JSON.stringify(geo))};expires=${d.toUTCString()};path=/;SameSite=Lax`;
          } catch {}

          backfillRecentEventsLocation(geo);
          trackEvent('precision_location_granted', formatLocationString(geo), 'Live GPS location verified');
          resolve(geo);
        } catch {
          resolve(null);
        }
      },
      (err) => {
        console.warn('Geolocation permission not granted or unavailable:', err.message);
        resolve(null);
      },
      {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 120000
      }
    );
  });
}

/**
 * Detects visitor area.
 * 1. Checks if high-precision GPS was previously granted (in cookies or storage).
 * 2. Otherwise runs multi-tier IP geolocation that captures City, District, State, and PIN code.
 */
export async function fetchVisitorGeo(): Promise<VisitorGeo | null> {
  if (typeof window === 'undefined') return null;

  // Respect cookie/tracking consent
  if (getConsentStatus() !== 'accepted') {
    return null;
  }

  if (cachedGeo) return cachedGeo;

  // 1. Check live geo stored in cookies
  const cookieGeo = getLiveGeoFromCookie();
  if (cookieGeo) {
    cachedGeo = cookieGeo;
    return cachedGeo;
  }

  // 2. Check storage cache (prioritize GPS if stored)
  try {
    const rawLocal = localStorage.getItem(STORAGE_KEY_GEO);
    if (rawLocal) {
      const parsed: VisitorGeo = JSON.parse(rawLocal);
      if (parsed.precision === 'gps') {
        cachedGeo = parsed;
        return cachedGeo;
      }
    }

    const rawSession = sessionStorage.getItem(STORAGE_KEY_GEO);
    if (rawSession) {
      cachedGeo = JSON.parse(rawSession);
      return cachedGeo;
    }
  } catch {
    // ignore
  }

  if (geoFetchPromise) return geoFetchPromise;

  geoFetchPromise = (async () => {
    // Tier 1: BigDataCloud client reverse geocoding (excellent for Indian district & locality)
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const res = await fetch('https://api.bigdatacloud.net/data/reverse-geocode-client', {
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data && (data.city || data.locality || data.principalSubdivision)) {
          const district = data.localityInfo?.administrative?.[2]?.name;
          const city = data.locality || data.city;
          const geo: VisitorGeo = {
            city: city || district,
            district: district && district !== city ? district : undefined,
            region: data.principalSubdivision || undefined,
            postal: data.postcode || undefined,
            country: data.countryName || 'India',
            countryCode: data.countryCode || 'IN',
            precision: 'network',
            latitude: data.latitude,
            longitude: data.longitude
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

    // Tier 2: IPAPI.co
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
            postal: data.postal || undefined,
            country: data.country_name || 'India',
            countryCode: data.country_code || 'IN',
            isp: data.org || undefined,
            precision: 'network',
            latitude: data.latitude,
            longitude: data.longitude
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

    // Tier 3: ipwho.is
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
            postal: data.postal || undefined,
            country: data.country || 'India',
            countryCode: data.country_code || 'IN',
            isp: data.connection?.isp || undefined,
            precision: 'network',
            latitude: data.latitude,
            longitude: data.longitude
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
 * If the first event was recorded while IP lookup was in flight,
 * update the event with the resolved location.
 */
function backfillRecentEventsLocation(geo: VisitorGeo): void {
  try {
    const events = getStoredEvents();
    let updated = false;
    for (let i = events.length - 1; i >= Math.max(0, events.length - 15); i--) {
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
 * Formats a clean, readable, professional location string.
 * Example: "Pune (District), Maharashtra [PIN 411001]" or "Surendranagar / Thangadh, Gujarat 📍GPS"
 */
export function formatLocationString(loc?: VisitorGeo | null): string {
  if (!loc) return 'Unknown Area';
  const parts: string[] = [];
  if (loc.city) parts.push(loc.city);
  if (loc.district && loc.district !== loc.city) parts.push(loc.district);
  if (loc.region && loc.region !== loc.city && loc.region !== loc.district) parts.push(loc.region);
  if (parts.length === 0 && loc.country) parts.push(loc.country);

  let base = parts.join(', ') || 'Unknown Area';
  if (loc.postal) {
    base += ` [PIN ${loc.postal}]`;
  }
  if (loc.precision === 'gps') {
    base += ' (GPS Verified)';
  }
  return base;
}

/**
 * Formats seconds into human-friendly time: e.g. "45s", "8m 20s", "1h 14m"
 */
export function formatDwellTime(seconds?: number): string {
  if (!seconds || seconds <= 0) return '0s';
  const s = Math.round(seconds);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const remS = s % 60;
  if (m < 60) {
    return remS > 0 ? `${m}m ${remS}s` : `${m}m`;
  }
  const h = Math.floor(m / 60);
  const remM = m % 60;
  return `${h}h ${remM}m`;
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

/**
 * Prompts for device location permission and pre-warms location tracking on launch.
 */
export function initVisitorTracking(): void {
  if (typeof window === 'undefined') return;

  // Immediately request device location permission via browser GPS API.
  // This automatically asks the device/browser for location permission:
  // "Allow hightone-ceramic-web.vercel.app to access this device's location?"
  requestPreciseLocation(true)
    .then((geo) => {
      if (geo) {
        cachedGeo = geo;
      } else {
        fetchVisitorGeo().catch(() => {});
      }
    })
    .catch(() => {
      fetchVisitorGeo().catch(() => {});
    });
}

/**
 * Silently records a visitor interaction without any public telemetry or UI badges.
 * Stored locally and accessible only through the password-protected Management Portal.
 * Automatically resolves and records visitor area (City, District, State, Country) without any permissions requested.
 */
export function trackEvent(
  type: AnalyticsEventType,
  target?: string,
  details?: string,
  page?: string,
  durationSeconds?: number
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
    durationSeconds: durationSeconds && durationSeconds > 0 ? Math.round(durationSeconds) : undefined,
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
        visitor_area: formatLocationString(event.location),
        dwell_seconds: event.durationSeconds
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
          durationSeconds: event.durationSeconds,
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
 * Tracks active dwell time spent in a specific collection or product modal.
 */
export function trackDwellTime(
  type: 'collection_dwell' | 'product_dwell',
  target: string,
  durationSeconds: number,
  details?: string
): void {
  if (durationSeconds < 2) return; // filter accidental flashes (< 2 seconds)
  trackEvent(
    type,
    target,
    details || `${formatDwellTime(durationSeconds)} active viewing`,
    undefined,
    durationSeconds
  );
}

/**
 * Computes an executive summary of visitor insights for the management dashboard,
 * including regional/location breakdowns and location-to-collection dwell time matrix.
 */
export function getAnalyticsSummary(): AnalyticsSummary {
  const events = getStoredEvents();

  let totalPageViews = 0;
  let totalWhatsAppClicks = 0;
  let totalCallClicks = 0;
  let totalQuoteSubmits = 0;
  let totalDwellSeconds = 0;

  const collectionStats: Record<string, { count: number; seconds: number }> = {};
  const productStats: Record<string, { count: number; seconds: number }> = {};
  const locationCounts: Record<string, {
    count: number;
    city?: string;
    district?: string;
    region?: string;
    postal?: string;
    country?: string;
    precision?: 'gps' | 'network';
  }> = {};
  const sessionDays = new Set<string>();

  // Location Market Insights map: key = location area string
  const locationMarketMap: Record<string, {
    area: string;
    city: string;
    district?: string;
    region: string;
    postal?: string;
    country: string;
    precision: 'gps' | 'network';
    isp?: string;
    totalVisits: number;
    totalDwellSeconds: number;
    collections: Record<string, { seconds: number; views: number }>;
    products: Record<string, { seconds: number; views: number }>;
    whatsappClicks: number;
    callClicks: number;
    quoteSubmits: number;
  }> = {};

  for (const ev of events) {
    const dwell = ev.durationSeconds || 0;
    if (dwell > 0) {
      totalDwellSeconds += dwell;
    }

    if (ev.type === 'page_view') {
      totalPageViews++;
    } else if (ev.type === 'collection_view') {
      totalPageViews++;
      if (ev.target) {
        if (!collectionStats[ev.target]) collectionStats[ev.target] = { count: 0, seconds: 0 };
        collectionStats[ev.target].count++;
      }
    } else if (ev.type === 'collection_dwell') {
      if (ev.target) {
        if (!collectionStats[ev.target]) collectionStats[ev.target] = { count: 0, seconds: 0 };
        collectionStats[ev.target].seconds += dwell;
      }
    } else if (ev.type === 'product_view') {
      if (ev.target) {
        if (!productStats[ev.target]) productStats[ev.target] = { count: 0, seconds: 0 };
        productStats[ev.target].count++;
      }
    } else if (ev.type === 'product_dwell') {
      if (ev.target) {
        if (!productStats[ev.target]) productStats[ev.target] = { count: 0, seconds: 0 };
        productStats[ev.target].seconds += dwell;
      }
    } else if (ev.type === 'whatsapp_click') {
      totalWhatsAppClicks++;
      if (ev.target && ev.target.includes('Product:')) {
        const prod = ev.target.replace('Product:', '').trim();
        if (!productStats[prod]) productStats[prod] = { count: 0, seconds: 0 };
        productStats[prod].count++;
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
        const cleanCity = ev.location.city || ev.location.district || 'Regional Center';
        const cleanRegion = ev.location.region || ev.location.country || 'India';

        if (!locationCounts[area]) {
          locationCounts[area] = {
            count: 0,
            city: ev.location.city,
            district: ev.location.district,
            region: ev.location.region,
            postal: ev.location.postal,
            country: ev.location.country,
            precision: ev.location.precision
          };
        }
        locationCounts[area].count++;

        // Initialize location market insight bucket
        if (!locationMarketMap[area]) {
          locationMarketMap[area] = {
            area,
            city: cleanCity,
            district: ev.location.district,
            region: cleanRegion,
            postal: ev.location.postal,
            country: ev.location.country || 'India',
            precision: ev.location.precision || 'network',
            isp: ev.location.isp,
            totalVisits: 0,
            totalDwellSeconds: 0,
            collections: {},
            products: {},
            whatsappClicks: 0,
            callClicks: 0,
            quoteSubmits: 0
          };
        }

        const mItem = locationMarketMap[area];
        mItem.totalVisits++;
        if (dwell > 0) {
          mItem.totalDwellSeconds += dwell;
        }

        if (ev.type === 'collection_view' && ev.target) {
          if (!mItem.collections[ev.target]) mItem.collections[ev.target] = { seconds: 0, views: 0 };
          mItem.collections[ev.target].views++;
        } else if (ev.type === 'collection_dwell' && ev.target) {
          if (!mItem.collections[ev.target]) mItem.collections[ev.target] = { seconds: 0, views: 0 };
          mItem.collections[ev.target].seconds += dwell;
        } else if (ev.type === 'product_view' && ev.target) {
          if (!mItem.products[ev.target]) mItem.products[ev.target] = { seconds: 0, views: 0 };
          mItem.products[ev.target].views++;
        } else if (ev.type === 'product_dwell' && ev.target) {
          if (!mItem.products[ev.target]) mItem.products[ev.target] = { seconds: 0, views: 0 };
          mItem.products[ev.target].seconds += dwell;
        } else if (ev.type === 'whatsapp_click') {
          mItem.whatsappClicks++;
        } else if (ev.type === 'call_click') {
          mItem.callClicks++;
        } else if (ev.type === 'quote_submit') {
          mItem.quoteSubmits++;
        }
      }
    }
  }

  const topCollections = Object.entries(collectionStats)
    .map(([name, data]) => ({ name, count: data.count, totalSeconds: data.seconds }))
    .sort((a, b) => (b.totalSeconds || 0) - (a.totalSeconds || 0) || b.count - a.count)
    .slice(0, 10);

  const topProducts = Object.entries(productStats)
    .map(([name, data]) => ({ name, count: data.count, totalSeconds: data.seconds }))
    .sort((a, b) => (b.totalSeconds || 0) - (a.totalSeconds || 0) || b.count - a.count)
    .slice(0, 10);

  const topLocations = Object.entries(locationCounts)
    .map(([area, data]) => ({ area, ...data }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  // Synthesize Location Market Insights
  const locationMarketInsights: LocationMarketInsight[] = Object.values(locationMarketMap).map((item) => {
    const collectionList = Object.entries(item.collections)
      .map(([collectionName, d]) => ({ collectionName, seconds: d.seconds, views: d.views }))
      .sort((a, b) => b.seconds - a.seconds || b.views - a.views);

    const productList = Object.entries(item.products)
      .map(([productName, d]) => ({ productName, seconds: d.seconds, views: d.views }))
      .sort((a, b) => b.seconds - a.seconds || b.views - a.views);

    const topCol = collectionList[0];
    const topProd = productList[0];
    const topDemandedCategory = topCol ? topCol.collectionName : (topProd ? topProd.productName : 'General Catalog');

    // Generate commercial takeaway
    let commercialTakeaway = '';
    const locLabel = `${item.city}${item.district && item.district !== item.city ? ` (${item.district})` : ''}, ${item.region}`;

    if (topCol && topCol.seconds > 10) {
      commercialTakeaway = `Visitors from ${locLabel} spent ${formatDwellTime(topCol.seconds)} exploring "${topCol.collectionName}". High regional commercial affinity for this sanitaryware category — prioritize dispatching dealer catalogs & bulk carton quotes to ${item.city} accounts.`;
    } else if (topCol) {
      commercialTakeaway = `Active buyer interest in "${topCol.collectionName}" (${topCol.views} views) from ${locLabel}. Follow up with pallet MOQ & factory pricing.`;
    } else if (topProd) {
      commercialTakeaway = `High interest in model "${topProd.productName}" from ${locLabel}.`;
    } else {
      commercialTakeaway = `Active general browsing from ${locLabel}.`;
    }

    return {
      area: item.area,
      city: item.city,
      district: item.district,
      region: item.region,
      postal: item.postal,
      country: item.country,
      precision: item.precision,
      isp: item.isp,
      totalVisits: item.totalVisits,
      totalDwellSeconds: item.totalDwellSeconds,
      collectionTimeSpent: collectionList,
      productTimeSpent: productList,
      whatsappClicks: item.whatsappClicks,
      callClicks: item.callClicks,
      quoteSubmits: item.quoteSubmits,
      topDemandedCategory,
      commercialTakeaway
    };
  }).sort((a, b) => b.totalDwellSeconds - a.totalDwellSeconds || b.totalVisits - a.totalVisits);

  return {
    totalPageViews,
    totalUniqueSessions: Math.max(sessionDays.size, Math.ceil(totalPageViews / 3) || (events.length > 0 ? 1 : 0)),
    totalWhatsAppClicks,
    totalCallClicks,
    totalQuoteSubmits,
    totalDwellSeconds,
    topCollections,
    topProducts,
    topLocations,
    locationMarketInsights,
    recentEvents: [...events].reverse().slice(0, 80)
  };
}



export function clearAnalyticsData(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY_EVENTS);
}

export function downloadAnalyticsCSV(): void {
  const events = getStoredEvents();
  if (events.length === 0) return;

  const headers = ['Timestamp', 'Event Type', 'Target / Item', 'Dwell Time', 'Details', 'Location (City, District, State, PIN)', 'Accuracy', 'Page', 'Device'];
  const rows = events.map((ev) => [
    `"${ev.timestamp || ''}"`,
    `"${ev.type}"`,
    `"${(ev.target || '').replace(/"/g, '""')}"`,
    `"${formatDwellTime(ev.durationSeconds)}"`,
    `"${(ev.details || '').replace(/"/g, '""')}"`,
    `"${formatLocationString(ev.location).replace(/"/g, '""')}"`,
    `"${ev.location?.precision === 'gps' ? 'GPS' : 'Network'}"`,
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

export function downloadLocationMarketCSV(): void {
  const summary = getAnalyticsSummary();
  if (summary.locationMarketInsights.length === 0) return;

  const headers = [
    'Location Center',
    'City',
    'District',
    'State / Region',
    'PIN Code',
    'Accuracy Mode',
    'Total Visits',
    'Total Dwell Time',
    'Top Demanded Category',
    'Collections Explored & Dwell Time',
    'Products Inspected',
    'WhatsApp Inquiries',
    'Direct Calls',
    'Quotation Submits',
    'Commercial Actionable Insight'
  ];

  const rows = summary.locationMarketInsights.map((item) => [
    `"${item.area.replace(/"/g, '""')}"`,
    `"${item.city.replace(/"/g, '""')}"`,
    `"${(item.district || '').replace(/"/g, '""')}"`,
    `"${item.region.replace(/"/g, '""')}"`,
    `"${item.postal || ''}"`,
    `"${item.precision === 'gps' ? 'GPS Pinpoint' : 'Regional Network IP'}"`,
    item.totalVisits,
    `"${formatDwellTime(item.totalDwellSeconds)}"`,
    `"${item.topDemandedCategory.replace(/"/g, '""')}"`,
    `"${item.collectionTimeSpent.map((c) => `${c.collectionName} (${formatDwellTime(c.seconds)}, ${c.views} views)`).join('; ').replace(/"/g, '""')}"`,
    `"${item.productTimeSpent.map((p) => `${p.productName} (${formatDwellTime(p.seconds)}, ${p.views} views)`).join('; ').replace(/"/g, '""')}"`,
    item.whatsappClicks,
    item.callClicks,
    item.quoteSubmits,
    `"${item.commercialTakeaway.replace(/"/g, '""')}"`
  ]);

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `hightone_regional_demand_matrix_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export async function copyAnalyticsForSheets(): Promise<boolean> {
  const events = getStoredEvents();
  if (events.length === 0) return false;

  const headers = ['Timestamp', 'Event Type', 'Target / Item', 'Dwell Time', 'Details', 'Location', 'Page', 'Device'];
  const rows = events.map((ev) => [
    ev.timestamp || '',
    ev.type,
    ev.target || '',
    formatDwellTime(ev.durationSeconds),
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
