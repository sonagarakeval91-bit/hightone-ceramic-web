import {
  DealerAccount,
  DealerApplication,
  DealerSession,
  DealerVerificationChecklist
} from '../types';
import { sanitizePhoneForWhatsApp } from '../utils/phone';

export const STORAGE_KEY_DEALER_APPLICATIONS = 'hightone_dealer_applications';
export const STORAGE_KEY_DEALER_ACCOUNTS = 'hightone_dealer_accounts';
export const STORAGE_KEY_DEALER_SESSION = 'hightone_active_dealer_session';

function nowFormattedIST(): string {
  return new Date().toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'medium',
    timeStyle: 'short'
  });
}

export function isValidIndianGstFormat(gst: string): boolean {
  const clean = (gst || '').trim().toUpperCase();
  if (!clean) return false;
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(clean);
}

export function getDealerApplications(): DealerApplication[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DEALER_APPLICATIONS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Failed to parse dealer applications:', err);
    return [];
  }
}

export function saveDealerApplications(applications: DealerApplication[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_DEALER_APPLICATIONS, JSON.stringify(applications));
  } catch (err) {
    console.error('Failed to save dealer applications:', err);
  }
}

export interface NewDealerApplicationInput {
  firmName: string;
  contactPerson: string;
  businessType: string;
  gstNumber: string;
  phoneCode: string;
  whatsappNumber: string;
  email: string;
  streetAddress: string;
  pincode: string;
  country: string;
  state: string;
  district: string;
  city: string;
  cityState: string;
  estimatedVolume: string;
  preferredCategories: string;
  notes: string;
}

export function createDealerApplication(input: NewDealerApplicationInput): DealerApplication {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const id = `HDA-${datePart}-${randomSuffix}`;
  const createdAt = nowFormattedIST();

  const record: DealerApplication = {
    id,
    firmName: input.firmName.trim(),
    contactPerson: input.contactPerson.trim(),
    businessType: input.businessType.trim() || 'Sanitaryware Showroom',
    gstNumber: input.gstNumber.trim().toUpperCase(),
    phoneCode: input.phoneCode || '+91',
    whatsappNumber: input.whatsappNumber.replace(/\D/g, ''),
    email: input.email.trim().toLowerCase(),
    streetAddress: input.streetAddress.trim(),
    pincode: input.pincode.trim(),
    country: input.country.trim() || 'India',
    state: input.state.trim(),
    district: input.district.trim(),
    city: input.city.trim(),
    cityState: input.cityState.trim(),
    estimatedVolume: input.estimatedVolume.trim(),
    preferredCategories: input.preferredCategories.trim(),
    notes: input.notes.trim(),
    status: 'pending',
    verification: {
      addressVerified: false,
      gstVerified: false,
      callVerified: false,
      businessVerified: false,
      adminNotes: ''
    },
    createdAt
  };

  const existing = getDealerApplications();
  saveDealerApplications([record, ...existing]);
  return record;
}

export function updateApplicationVerificationChecklist(
  appId: string,
  updates: Partial<DealerVerificationChecklist>,
  verifiedBy: string
): DealerApplication[] {
  const existing = getDealerApplications();
  const timestamp = nowFormattedIST();

  const updated = existing.map((app) => {
    if (app.id !== appId) return app;
    const prev = app.verification || {
      addressVerified: false,
      gstVerified: false,
      callVerified: false
    };

    const nextChecklist: DealerVerificationChecklist = {
      ...prev,
      ...updates
    };

    if (updates.addressVerified !== undefined) {
      nextChecklist.addressVerifiedBy = updates.addressVerified ? verifiedBy : undefined;
      nextChecklist.addressVerifiedAt = updates.addressVerified ? timestamp : undefined;
    }
    if (updates.gstVerified !== undefined) {
      nextChecklist.gstVerifiedBy = updates.gstVerified ? verifiedBy : undefined;
      nextChecklist.gstVerifiedAt = updates.gstVerified ? timestamp : undefined;
    }
    if (updates.callVerified !== undefined) {
      nextChecklist.callVerifiedBy = updates.callVerified ? verifiedBy : undefined;
      nextChecklist.callVerifiedAt = updates.callVerified ? timestamp : undefined;
    }

    return {
      ...app,
      verification: nextChecklist
    };
  });

  saveDealerApplications(updated);
  return updated;
}

export function isApplicationKycReady(app: DealerApplication): boolean {
  const v = app.verification;
  return Boolean(v?.addressVerified && v?.gstVerified && v?.callVerified);
}

export function getDealerAccounts(): DealerAccount[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DEALER_ACCOUNTS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Failed to parse dealer accounts:', err);
    return [];
  }
}

export function saveDealerAccounts(accounts: DealerAccount[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_DEALER_ACCOUNTS, JSON.stringify(accounts));
  } catch (err) {
    console.error('Failed to save dealer accounts:', err);
  }
}

export function generateSuggestedDealerUserId(
  firmName: string,
  existingAccounts: DealerAccount[]
): string {
  const taken = new Set(existingAccounts.map((a) => a.userId.trim().toLowerCase()));
  const slug = (firmName || 'dealer')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 14) || 'dealer';

  const base = slug.startsWith('htc_') ? slug : `htc_${slug}`;
  if (!taken.has(base)) return base;

  let counter = 2;
  while (taken.has(`${base}_${counter}`)) {
    counter++;
  }
  return `${base}_${counter}`;
}

export function generateDealerPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 6; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `HTC-${suffix}`;
}

export function buildSessionFromAccount(account: DealerAccount): DealerSession {
  return {
    accountId: account.id,
    userId: account.userId,
    credHash: account.credHash,
    firmName: account.firmName,
    contactPerson: account.contactPerson,
    businessType: account.businessType,
    gstNumber: account.gstNumber,
    phoneCode: account.phoneCode,
    whatsappNumber: account.whatsappNumber,
    email: account.email,
    streetAddress: account.streetAddress,
    pincode: account.pincode,
    country: account.country,
    state: account.state,
    district: account.district,
    city: account.city,
    cityState: account.cityState,
    signedInAt: nowFormattedIST()
  };
}

export function getActiveDealerSession(): DealerSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DEALER_SESSION);
    if (!raw) return null;
    const session = JSON.parse(raw) as DealerSession;
    if (!session || !session.accountId) return null;
    const accounts = getDealerAccounts();
    const matched = accounts.find((a) => a.id === session.accountId);
    if (matched) {
      if (!matched.active) {
        localStorage.removeItem(STORAGE_KEY_DEALER_SESSION);
        return null;
      }
      return {
        ...buildSessionFromAccount(matched),
        credHash: session.credHash || matched.credHash
      };
    }
    // On public dealer devices, local dealer_accounts is empty; return cloud session and validate asynchronously
    if (session.credHash) {
      return session;
    }
    localStorage.removeItem(STORAGE_KEY_DEALER_SESSION);
    return null;
  } catch {
    return null;
  }
}

export function saveActiveDealerSession(session: DealerSession | null): void {
  try {
    if (!session) {
      localStorage.removeItem(STORAGE_KEY_DEALER_SESSION);
    } else {
      localStorage.setItem(STORAGE_KEY_DEALER_SESSION, JSON.stringify(session));
    }
  } catch (err) {
    console.error('Failed to persist dealer session:', err);
  }
}

export function buildDealerCredentialsMessage(params: {
  firmName: string;
  contactPerson: string;
  userId: string;
  password: string;
  portalUrl?: string;
}): string {
  const originUrl =
    params.portalUrl ||
    (typeof window !== 'undefined' ? `${window.location.origin}/#order` : '');

  return (
    `Hello ${params.contactPerson || params.firmName},\n\n` +
    `Your dealership registration with *Hightone Ceramic* has been verified and approved!\n\n` +
    `*Firm / Showroom:* ${params.firmName}\n` +
    `*Dealer User ID:* ${params.userId}\n` +
    `*Password:* ${params.password}\n` +
    (originUrl ? `*Dealer Portal Link:* ${originUrl}\n` : '') +
    `\nYou can now sign in to place new factory orders, view pending & past orders, and edit active orders before completion.\n\n` +
    `Regards,\nHightone Ceramic Factory Dispatch`
  );
}

export function buildDealerCredentialsWhatsAppUrl(params: {
  phoneCode: string;
  whatsappNumber: string;
  firmName: string;
  contactPerson: string;
  userId: string;
  password: string;
}): string {
  const fullNumber = `${params.phoneCode || '+91'}${params.whatsappNumber || ''}`;
  const digits = sanitizePhoneForWhatsApp(fullNumber);
  const message = buildDealerCredentialsMessage({
    firmName: params.firmName,
    contactPerson: params.contactPerson,
    userId: params.userId,
    password: params.password
  });
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export function buildDealerCredentialsMailtoUrl(params: {
  email: string;
  firmName: string;
  contactPerson: string;
  userId: string;
  password: string;
}): string {
  const subject = `Hightone Ceramic Dealership Approved — Your Dealer Login Credentials (${params.firmName})`;
  const body = buildDealerCredentialsMessage({
    firmName: params.firmName,
    contactPerson: params.contactPerson,
    userId: params.userId,
    password: params.password
  }).replace(/\*/g, '');
  return `mailto:${encodeURIComponent(params.email || '')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function downloadDealersCSV(
  applications: DealerApplication[],
  accounts: DealerAccount[]
): void {
  const escapeCSV = (val: string | number | boolean | undefined | null) => {
    if (val === undefined || val === null) return '""';
    return `"${String(val).replace(/"/g, '""')}"`;
  };

  const headers = [
    'Record Type',
    'Ref / Account ID',
    'Status',
    'Firm / Showroom Name',
    'Contact Person',
    'Business Type',
    'GST Number',
    'WhatsApp / Mobile',
    'Email ID',
    'Street Address',
    'Pincode',
    'City / District / State',
    'Address Verified',
    'GST Verified',
    'Call Verified',
    'Dealer User ID',
    'Rejection Reason / Notes',
    'Date Created'
  ];

  const appRows = applications.map((app) => [
    escapeCSV('Application'),
    escapeCSV(app.id),
    escapeCSV(app.status.toUpperCase()),
    escapeCSV(app.firmName),
    escapeCSV(app.contactPerson),
    escapeCSV(app.businessType),
    escapeCSV(app.gstNumber),
    escapeCSV(`${app.phoneCode} ${app.whatsappNumber}`),
    escapeCSV(app.email),
    escapeCSV(app.streetAddress),
    escapeCSV(app.pincode),
    escapeCSV(app.cityState),
    escapeCSV(app.verification?.addressVerified ? 'YES' : 'NO'),
    escapeCSV(app.verification?.gstVerified ? 'YES' : 'NO'),
    escapeCSV(app.verification?.callVerified ? 'YES' : 'NO'),
    escapeCSV(app.issuedUserId || ''),
    escapeCSV(app.rejectionReason || app.verification?.adminNotes || app.notes),
    escapeCSV(app.createdAt)
  ]);

  const accRows = accounts.map((acc) => [
    escapeCSV('Dealer Account'),
    escapeCSV(acc.id),
    escapeCSV(acc.active ? 'ACTIVE' : 'DISABLED'),
    escapeCSV(acc.firmName),
    escapeCSV(acc.contactPerson),
    escapeCSV(acc.businessType),
    escapeCSV(acc.gstNumber),
    escapeCSV(`${acc.phoneCode} ${acc.whatsappNumber}`),
    escapeCSV(acc.email),
    escapeCSV(acc.streetAddress),
    escapeCSV(acc.pincode),
    escapeCSV(acc.cityState),
    escapeCSV('YES'),
    escapeCSV('YES'),
    escapeCSV('YES'),
    escapeCSV(acc.userId),
    escapeCSV(acc.verificationSummary || ''),
    escapeCSV(acc.createdAt)
  ]);

  const csvContent =
    '\uFEFF' + [headers.join(','), ...appRows.map((r) => r.join(',')), ...accRows.map((r) => r.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `Hightone_Dealers_KYC_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
