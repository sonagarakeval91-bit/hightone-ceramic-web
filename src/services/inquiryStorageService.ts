import { B2BInquiryPayload, SavedInquiry } from '../types';

const STORAGE_KEY_INQUIRIES = 'hightone_saved_inquiries';
const STORAGE_KEY_WEBHOOK = 'hightone_sheet_webhook_url';

/**
 * Loads all inquiries from persistent browser storage.
 */
export function getSavedInquiries(): SavedInquiry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_INQUIRIES);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch (err) {
    console.error('Failed to parse saved inquiries:', err);
    return [];
  }
}

/**
 * Gets the configured Google Sheet Webhook URL (if user set up Google Apps Script).
 */
export function getSheetWebhookUrl(): string {
  try {
    const envUrl = (import.meta as any).env?.VITE_GOOGLE_SHEET_WEBHOOK_URL;
    return localStorage.getItem(STORAGE_KEY_WEBHOOK) || envUrl || '';
  } catch {
    return '';
  }
}

/**
 * Saves or updates the Google Sheet Webhook URL.
 */
export function saveSheetWebhookUrl(url: string): void {
  try {
    localStorage.setItem(STORAGE_KEY_WEBHOOK, url.trim());
  } catch (err) {
    console.error('Failed to save webhook URL:', err);
  }
}

/**
 * Generates an inquiry reference code e.g. "HTC-20261011-4821".
 */
function generateInquiryId(): string {
  const d = new Date();
  const dateStr = d.toISOString().slice(0, 10).replace(/-/g, '');
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `HTC-${dateStr}-${randomSuffix}`;
}

/**
 * Saves a new inquiry to persistent storage and transmits to Google Sheet webhook if configured.
 */
export async function recordNewInquiry(
  payload: B2BInquiryPayload,
  source: string = 'Website Form'
): Promise<{ success: boolean; id: string; webhookSent: boolean; message: string }> {
  const id = generateInquiryId();
  const timestamp = new Date().toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'medium',
    timeStyle: 'short'
  });

  const record: SavedInquiry = {
    ...payload,
    id,
    timestamp,
    source,
    status: 'new'
  };

  // 1. Save to persistent storage
  try {
    const existing = getSavedInquiries();
    const updated = [record, ...existing];
    localStorage.setItem(STORAGE_KEY_INQUIRIES, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to write inquiry to local storage:', err);
  }

  // 2. Try sending to configured Google Sheet Webhook (Apps Script)
  const webhookUrl = getSheetWebhookUrl();
  let webhookSent = false;

  if (webhookUrl && webhookUrl.startsWith('http')) {
    try {
      const isGoogleScript = webhookUrl.includes('script.google.com');
      const payloadData = {
        id: record.id,
        timestamp: record.timestamp,
        businessName: record.businessName,
        contactPerson: record.contactPerson,
        whatsappNumber: record.whatsappNumber,
        cityState: record.cityState,
        volume: record.volume,
        productInterest: record.productInterest,
        notes: record.notes,
        source: record.source
      };

      const requestBody = JSON.stringify({
        ...payloadData,
        data: [payloadData]
      });

      if (isGoogleScript) {
        await fetch(webhookUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: {
            'Content-Type': 'application/json'
          },
          body: requestBody
        });
      } else {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: requestBody
        });
      }
      webhookSent = true;
    } catch (webhookErr) {
      console.warn('Webhook transmission encountered error (data saved locally):', webhookErr);
    }
  }

  return {
    success: true,
    id,
    webhookSent,
    message: webhookSent
      ? `Inquiry ${id} saved to Sheet & local records.`
      : `Inquiry ${id} recorded successfully in factory inquiries log.`
  };
}

/**
 * Deletes a single inquiry by ID.
 */
export function removeInquiry(id: string): SavedInquiry[] {
  try {
    const existing = getSavedInquiries();
    const updated = existing.filter((item) => item.id !== id);
    localStorage.setItem(STORAGE_KEY_INQUIRIES, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

/**
 * Clears all inquiries.
 */
export function clearAllSavedInquiries(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_INQUIRIES);
  } catch (err) {
    console.error('Failed to clear inquiries:', err);
  }
}

/**
 * Converts all saved inquiries into CSV format and triggers a browser file download.
 */
export function downloadInquiriesCSV(): void {
  const inquiries = getSavedInquiries();
  if (inquiries.length === 0) return;

  const headers = [
    'Inquiry ID',
    'Date & Time',
    'Source Form',
    'Business / Firm Name',
    'Contact Person',
    'WhatsApp / Phone',
    'City & State',
    'Volume Required',
    'Product Interest',
    'Notes / Details'
  ];

  const escapeCSV = (val: string | undefined | null) => {
    if (!val) return '""';
    const s = String(val).replace(/"/g, '""');
    return `"${s}"`;
  };

  const rows = inquiries.map((inq) => [
    escapeCSV(inq.id),
    escapeCSV(inq.timestamp),
    escapeCSV(inq.source),
    escapeCSV(inq.businessName),
    escapeCSV(inq.contactPerson),
    escapeCSV(inq.whatsappNumber),
    escapeCSV(inq.cityState),
    escapeCSV(inq.volume),
    escapeCSV(inq.productInterest),
    escapeCSV(inq.notes)
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `Hightone_Inquiries_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Formats inquiries as TSV (Tab Separated Values) and copies to clipboard,
 * enabling immediate Ctrl+V paste into Google Sheets.
 */
export async function copyInquiriesForGoogleSheets(): Promise<boolean> {
  const inquiries = getSavedInquiries();
  if (inquiries.length === 0) return false;

  const headers = [
    'Inquiry ID',
    'Date & Time',
    'Source',
    'Business / Firm',
    'Contact Person',
    'WhatsApp / Phone',
    'City & State',
    'Volume',
    'Product Interest',
    'Notes'
  ];

  const clean = (val: string | undefined | null) => (val || '').replace(/[\t\r\n]/g, ' ');

  const rows = inquiries.map((inq) => [
    clean(inq.id),
    clean(inq.timestamp),
    clean(inq.source),
    clean(inq.businessName),
    clean(inq.contactPerson),
    clean(inq.whatsappNumber),
    clean(inq.cityState),
    clean(inq.volume),
    clean(inq.productInterest),
    clean(inq.notes)
  ]);

  const tsv = [headers.join('\t'), ...rows.map((r) => r.join('\t'))].join('\n');

  try {
    await navigator.clipboard.writeText(tsv);
    return true;
  } catch {
    return false;
  }
}
