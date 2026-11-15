import { B2BInquiryPayload, SavedInquiry, DealerOrderPayload, SavedDealerOrder } from '../types';

const STORAGE_KEY_INQUIRIES = 'hightone_saved_inquiries';
const STORAGE_KEY_ORDERS = 'hightone_saved_dealer_orders';
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
 * Updates fields on an existing saved inquiry by ID.
 */
export function updateSavedInquiry(id: string, updates: Partial<SavedInquiry>): SavedInquiry[] {
  try {
    const existing = getSavedInquiries();
    const updated = existing.map((item) => (item.id === id ? { ...item, ...updates, id: item.id } : item));
    localStorage.setItem(STORAGE_KEY_INQUIRIES, JSON.stringify(updated));
    return updated;
  } catch {
    return getSavedInquiries();
  }
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

/**
 * Loads all dealer orders from persistent browser storage.
 */
export function getSavedDealerOrders(): SavedDealerOrder[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ORDERS);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch (err) {
    console.error('Failed to parse saved dealer orders:', err);
    return [];
  }
}

/**
 * Saves a new dealer order to persistent storage and transmits to Google Sheet webhook if configured.
 */
export async function recordNewDealerOrder(
  payload: DealerOrderPayload,
  source: string = 'Dealer Order Portal'
): Promise<{ success: boolean; id: string; webhookSent: boolean; message: string }> {
  const id = payload.orderId || `HTC-ORD-${Date.now().toString().slice(-6)}`;
  const timestamp = new Date().toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'medium',
    timeStyle: 'short'
  });

  const record: SavedDealerOrder = {
    ...payload,
    orderId: id,
    id,
    timestamp,
    source,
    status: 'new',
    verificationStatus: 'pending',
    completed: false
  };

  // 1. Save to local storage
  try {
    const existing = getSavedDealerOrders();
    const updated = [record, ...existing];
    localStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to write dealer order to local storage:', err);
  }

  // 2. Try sending to configured Google Sheet Webhook
  const webhookUrl = getSheetWebhookUrl();
  let webhookSent = false;

  if (webhookUrl && webhookUrl.startsWith('http')) {
    try {
      const isGoogleScript = webhookUrl.includes('script.google.com');
      const itemsSummary = record.items
        .map((i) => {
          const splitsText = i.colorSplits.map((s) => `${s.codeOrColor}: ${s.quantity}`).join(', ');
          return `${i.name} [${i.packing}] [${i.grade}] (${splitsText}) = ${i.totalQuantity} Qty`;
        })
        .join('; ');

      const payloadData = {
        id: record.id,
        timestamp: record.timestamp,
        type: 'Dealer Wholesale Order',
        firmName: record.dealerInfo.firmName || '',
        contactPerson: record.personName || record.dealerInfo.contactPerson,
        whatsappNumber: `${record.dealerInfo.phoneCode} ${record.dealerInfo.phoneNumber}`,
        cityState: record.dealerInfo.cityState,
        requiredDate: record.requiredDate || '',
        requiredPeriod: record.requiredPeriod || '',
        totalQuantity: record.totalQuantity,
        totalWeightKg: record.totalWeightKg,
        totalModels: record.totalModels,
        itemsSummary,
        notes: record.dealerInfo.notes || '',
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
          headers: { 'Content-Type': 'application/json' },
          body: requestBody
        });
      } else {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: requestBody
        });
      }
      webhookSent = true;
    } catch (webhookErr) {
      console.warn('Dealer order webhook error (data saved locally):', webhookErr);
    }
  }

  return {
    success: true,
    id,
    webhookSent,
    message: webhookSent
      ? `Dealer Order ${id} saved to Sheet & local records.`
      : `Dealer Order ${id} saved successfully in factory order records.`
  };
}

/**
 * Accepts a dealer order after verification (with optional stock/production availability tracking).
 */
export function acceptSavedDealerOrder(
  id: string,
  verifiedBy: string = 'Admin',
  options?: {
    availabilityStatus?: 'all-in-stock' | 'shortage-routed';
    productionRoutedCount?: number;
  }
): SavedDealerOrder[] {
  try {
    const existing = getSavedDealerOrders();
    const verifiedAt = new Date().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      dateStyle: 'medium',
      timeStyle: 'short'
    });
    const updated = existing.map((item) =>
      item.id === id
        ? {
            ...item,
            verificationStatus: 'accepted' as const,
            availabilityStatus: options?.availabilityStatus ?? item.availabilityStatus,
            productionRoutedCount:
              options?.productionRoutedCount !== undefined
                ? options.productionRoutedCount
                : item.productionRoutedCount,
            rejectionReason: undefined,
            verifiedBy,
            verifiedAt,
            status: item.completed ? ('completed' as const) : ('processing' as const)
          }
        : item
    );
    localStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(updated));
    return updated;
  } catch {
    return getSavedDealerOrders();
  }
}

/**
 * Rejects a dealer order with a required reason (excluded from Production).
 */
export function rejectSavedDealerOrder(
  id: string,
  rejectionReason: string,
  verifiedBy: string = 'Admin'
): SavedDealerOrder[] {
  try {
    const existing = getSavedDealerOrders();
    const verifiedAt = new Date().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      dateStyle: 'medium',
      timeStyle: 'short'
    });
    const updated = existing.map((item) =>
      item.id === id
        ? {
            ...item,
            verificationStatus: 'rejected' as const,
            rejectionReason: rejectionReason.trim(),
            verifiedBy,
            verifiedAt,
            completed: false,
            status: 'new' as const
          }
        : item
    );
    localStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(updated));
    return updated;
  } catch {
    return getSavedDealerOrders();
  }
}

/**
 * Toggles Completed status on a specific dealer order.
 */
export function toggleSavedDealerOrderCompleted(id: string): SavedDealerOrder[] {
  try {
    const existing = getSavedDealerOrders();
    const now = new Date().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      dateStyle: 'medium',
      timeStyle: 'short'
    });
    const updated = existing.map((item) => {
      if (item.id !== id) return item;
      const nextCompleted = !(Boolean(item.completed) || item.status === 'completed');
      return {
        ...item,
        completed: nextCompleted,
        completedAt: nextCompleted ? now : undefined,
        status: nextCompleted ? ('completed' as const) : ('processing' as const)
      };
    });
    localStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(updated));
    return updated;
  } catch {
    return getSavedDealerOrders();
  }
}

/**
 * Removes all orders checked as Completed.
 */
export function removeCompletedSavedDealerOrders(): SavedDealerOrder[] {
  try {
    const existing = getSavedDealerOrders();
    const updated = existing.filter((item) => !(Boolean(item.completed) || item.status === 'completed'));
    localStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(updated));
    return updated;
  } catch {
    return getSavedDealerOrders();
  }
}

/**
 * Updates an existing saved dealer order (items, delivery dates, contact details, verification status).
 */
export function updateSavedDealerOrder(
  id: string,
  updatedOrder: SavedDealerOrder
): SavedDealerOrder[] {
  try {
    const existing = getSavedDealerOrders();
    const updated = existing.map((item) => (item.id === id ? { ...updatedOrder, id: item.id } : item));
    localStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(updated));
    return updated;
  } catch {
    return getSavedDealerOrders();
  }
}

/**
 * Applies a signed-in dealer's modifications to an active (non-completed) order.
 * If the order was previously Accepted, resets verificationStatus to 'pending' so Sales/Admin
 * re-verifies revised quantities cleanly before factory manufacture.
 */
export function applyDealerOrderEdit(
  id: string,
  editedPayload: DealerOrderPayload
): { updatedOrders: SavedDealerOrder[]; wasAccepted: boolean } {
  const existing = getSavedDealerOrders();
  const target = existing.find((item) => item.id === id);
  if (!target || Boolean(target.completed) || target.status === 'completed') {
    return { updatedOrders: existing, wasAccepted: false };
  }

  const nowTime = new Date().toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'medium',
    timeStyle: 'short'
  });

  const wasAccepted = target.verificationStatus === 'accepted';
  const nextVerificationStatus =
    wasAccepted || target.verificationStatus === 'rejected' ? ('pending' as const) : target.verificationStatus || ('pending' as const);

  const updated = existing.map((item) => {
    if (item.id !== id) return item;
    return {
      ...item,
      ...editedPayload,
      id: item.id,
      orderId: item.orderId || editedPayload.orderId,
      dealerAccountId: item.dealerAccountId || editedPayload.dealerAccountId,
      dealerUserId: item.dealerUserId || editedPayload.dealerUserId,
      lastEditedAt: nowTime,
      editCount: (item.editCount || 0) + 1,
      status: 'new' as const,
      verificationStatus: nextVerificationStatus,
      availabilityStatus: wasAccepted ? undefined : item.availabilityStatus,
      productionRoutedCount: wasAccepted ? undefined : item.productionRoutedCount,
      rejectionReason: undefined
    };
  });

  try {
    localStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to persist edited dealer order:', err);
  }

  return { updatedOrders: updated, wasAccepted };
}

/**
 * Deletes a single dealer order by ID.
 */
export function removeDealerOrder(id: string): SavedDealerOrder[] {
  try {
    const existing = getSavedDealerOrders();
    const updated = existing.filter((item) => item.id !== id);
    localStorage.setItem(STORAGE_KEY_ORDERS, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

/**
 * Clears all dealer orders.
 */
export function clearAllDealerOrders(): void {
  try {
    localStorage.removeItem(STORAGE_KEY_ORDERS);
  } catch (err) {
    console.error('Failed to clear dealer orders:', err);
  }
}

/**
 * Downloads all saved dealer orders as a CSV file.
 */
export function downloadDealerOrdersCSV(options?: { hideDealerContact?: boolean }): void {
  const orders = getSavedDealerOrders();
  if (orders.length === 0) return;

  const hideContact = Boolean(options?.hideDealerContact);

  const escapeCSV = (val: string | number | undefined | null) => {
    if (val === undefined || val === null) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  const headers = [
    'Order ID',
    'Order Date & Time',
    'Verification Status',
    'Stock Routing',
    'Completed',
    'Required Delivery Date',
    'Required Period',
    'Organization / Firm Name',
    'Person Name',
    ...(hideContact ? [] : ['Mobile / WhatsApp', 'Location']),
    'Total Models',
    'Total Quantity (Units)',
    'Total Weight (kg)',
    'Items & Classification Matrix',
    'Rejection Reason',
    'Notes'
  ];

  const rows = orders.map((ord) => {
    const isCompleted = Boolean(ord.completed) || ord.status === 'completed';
    const verStatus = ord.verificationStatus || (isCompleted ? 'accepted' : 'pending');
    const stockRoutingLabel =
      verStatus === 'rejected'
        ? 'Excluded'
        : ord.availabilityStatus === 'shortage-routed'
        ? `Production (${ord.productionRoutedCount || 0} batches)`
        : ord.availabilityStatus === 'all-in-stock'
        ? 'All In Stock'
        : verStatus === 'accepted'
        ? 'Accepted'
        : 'Pending Verify';
    return [
      escapeCSV(ord.orderId || ord.id),
      escapeCSV(ord.timestamp),
      escapeCSV(verStatus.toUpperCase()),
      escapeCSV(stockRoutingLabel),
      escapeCSV(isCompleted ? 'YES' : 'NO'),
      escapeCSV(ord.requiredDate || 'Not specified'),
      escapeCSV(ord.requiredPeriod || 'Standard'),
      escapeCSV(ord.dealerInfo.firmName || ''),
      escapeCSV(ord.personName || ord.dealerInfo.contactPerson || ord.dealerInfo.firmName),
      ...(hideContact
        ? []
        : [
            escapeCSV(`${ord.dealerInfo.phoneCode} ${ord.dealerInfo.phoneNumber}`),
            escapeCSV(ord.dealerInfo.cityState)
          ]),
      escapeCSV(ord.totalModels),
      escapeCSV(ord.totalQuantity),
      escapeCSV(ord.totalWeightKg ? `${ord.totalWeightKg.toFixed(2)} kg` : '—'),
      escapeCSV(
        ord.items
          .map((i) => {
            const splits = i.colorSplits.map((s) => `${s.codeOrColor}: ${s.quantity}`).join(', ');
            return `${i.name} [${i.packing}] [${i.grade}] (${splits}) = ${i.totalQuantity} Qty`;
          })
          .join(' | ')
      ),
      escapeCSV(ord.rejectionReason || ''),
      escapeCSV(ord.dealerInfo.notes || '')
    ];
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `Hightone_Dealer_Orders_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

