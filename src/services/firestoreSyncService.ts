import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc
} from 'firebase/firestore';
import { signInWithPopup, signOut } from 'firebase/auth';
import {
  auth,
  computeCredentialHash,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
  OWNER_ADMIN_EMAIL,
  stripUndefinedDeep
} from '../firebase';
import {
  AdminRole,
  AdminStaffAccount,
  AnalyticsEvent,
  CategoryMeta,
  CollectionSeoMeta,
  DailyProductionEntry,
  DealerAccount,
  DealerApplication,
  ProductConfigOverride,
  ProductItem,
  ProductionQueueItem,
  SavedDealerOrder,
  SavedInquiry
} from '../types';
import { CompanyInfoMap, LegalPoliciesMap, SiteMediaMap } from './googleSheetsService';
import { normalizeAdminRole } from '../utils/adminRoles';

export const COLLECTION_DEALER_APPLICATIONS = 'dealer_applications';
export const COLLECTION_DEALER_ACCOUNTS = 'dealer_accounts';
export const COLLECTION_DEALER_AUTH_TOKENS = 'dealer_auth_tokens';
export const COLLECTION_DEALER_ORDERS = 'dealer_orders';
export const COLLECTION_DEALER_ORDER_FEEDS = 'dealer_order_feeds';
export const COLLECTION_B2B_INQUIRIES = 'b2b_inquiries';
export const COLLECTION_PRODUCTION_QUEUE = 'production_queue';
export const COLLECTION_DAILY_PRODUCTION_LOGS = 'daily_production_logs';
export const COLLECTION_APP_SETTINGS = 'app_settings';
export const COLLECTION_ADMINS = 'admins';
export const COLLECTION_STAFF_ACCOUNTS = 'staff_accounts';
export const COLLECTION_STAFF_AUTH_TOKENS = 'staff_auth_tokens';
export const COLLECTION_ADMINS_BY_EMAIL = 'admins_by_email';
export const COLLECTION_ANALYTICS_EVENTS = 'analytics_events';

export interface CloudAuthorizedProfile {
  allowed: boolean;
  role: AdminRole;
  isMasterOwner: boolean;
  displayName: string;
  email: string;
}

export async function signInFirebaseAdminWithGoogle() {
  const credential = await signInWithPopup(auth, googleProvider);
  return credential.user;
}

export async function signOutFirebaseUser() {
  await signOut(auth);
}

export async function getAuthorizedCloudUserProfile(
  uid: string,
  email?: string | null,
  emailVerified?: boolean
): Promise<CloudAuthorizedProfile | null> {
  if (!uid || !emailVerified) return null;
  const cleanEmail = (email || '').trim().toLowerCase();
  if (cleanEmail === OWNER_ADMIN_EMAIL.toLowerCase()) {
    return {
      allowed: true,
      role: 'admin',
      isMasterOwner: true,
      displayName: 'Admin',
      email: cleanEmail
    };
  }
  try {
    const adminSnap = await getDoc(doc(db, COLLECTION_ADMINS, uid));
    if (adminSnap.exists()) {
      return {
        allowed: true,
        role: 'admin',
        isMasterOwner: true,
        displayName: 'Admin',
        email: cleanEmail
      };
    }
  } catch {
    // proceed to email invite check
  }
  if (cleanEmail) {
    try {
      const inviteSnap = await getDoc(doc(db, COLLECTION_ADMINS_BY_EMAIL, cleanEmail));
      if (inviteSnap.exists()) {
        const data = inviteSnap.data();
        if (data?.active === true) {
          return {
            allowed: true,
            role: normalizeAdminRole(data.role),
            isMasterOwner: false,
            displayName: cleanStr(data.displayName, cleanEmail, 120),
            email: cleanEmail
          };
        }
      }
    } catch {
      // unauthorized email
    }
  }
  return null;
}

export async function checkIsFirebaseAdminUser(
  uid: string,
  email?: string | null,
  emailVerified?: boolean
): Promise<boolean> {
  const profile = await getAuthorizedCloudUserProfile(uid, email, emailVerified);
  return Boolean(profile?.allowed);
}

function cleanStr(val: unknown, fallback = '', maxLen = 300): string {
  if (typeof val !== 'string') {
    if (val === undefined || val === null) return fallback;
    return String(val).trim().slice(0, maxLen);
  }
  const trimmed = val.trim();
  return trimmed ? trimmed.slice(0, maxLen) : fallback;
}

function cleanMinStr(val: unknown, minLen: number, fallback: string, maxLen = 300): string {
  const s = cleanStr(val, '', maxLen);
  return s.length >= minLen ? s : fallback;
}

/**
 * Public: Submit a new "Want to Become a Dealer" application to Firestore.
 */
export async function submitPublicDealerApplication(app: DealerApplication): Promise<void> {
  const path = `${COLLECTION_DEALER_APPLICATIONS}/${app.id}`;
  const cleanPayload = stripUndefinedDeep({
    id: cleanMinStr(app.id, 3, `HDA-${Date.now()}`, 64),
    firmName: cleanMinStr(app.firmName, 2, 'Dealer Firm', 160),
    contactPerson: cleanMinStr(app.contactPerson, 2, 'Primary Contact', 120),
    businessType: cleanStr(app.businessType, 'Sanitaryware Showroom', 120),
    gstNumber: cleanMinStr(app.gstNumber, 3, 'N/A', 40),
    phoneCode: cleanMinStr(app.phoneCode, 1, '+91', 12),
    whatsappNumber: cleanMinStr(app.whatsappNumber, 6, '000000', 30),
    email: cleanMinStr(app.email, 5, 'na@hightone.local', 160),
    streetAddress: cleanMinStr(app.streetAddress, 5, 'Address Pending', 300),
    pincode: cleanMinStr(app.pincode, 3, '000000', 20),
    country: cleanStr(app.country, 'India', 80),
    state: cleanStr(app.state, '', 80),
    district: cleanStr(app.district, '', 80),
    city: cleanStr(app.city, '', 80),
    cityState: cleanStr(app.cityState, '', 200),
    estimatedVolume: cleanStr(app.estimatedVolume, '', 120),
    preferredCategories: cleanStr(app.preferredCategories, '', 300),
    notes: cleanStr(app.notes, '', 1000),
    status: 'pending',
    verification: {
      addressVerified: false,
      gstVerified: false,
      callVerified: false,
      businessVerified: false,
      adminNotes: ''
    },
    createdAt: cleanStr(app.createdAt, new Date().toISOString(), 80),
    createdAtTs: serverTimestamp()
  });

  try {
    await setDoc(doc(db, COLLECTION_DEALER_APPLICATIONS, cleanPayload.id), cleanPayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

/**
 * Admin: Update or migrate application document in Firestore (KYC checks, approve, reject).
 */
export async function saveDealerApplicationToCloud(app: DealerApplication): Promise<void> {
  const cleanId = cleanMinStr(app?.id, 3, '', 64);
  if (!cleanId || !/^[a-zA-Z0-9_-]+$/.test(cleanId)) return;
  const path = `${COLLECTION_DEALER_APPLICATIONS}/${cleanId}`;
  const v = app.verification;
  const cleanRecord = stripUndefinedDeep({
    id: cleanId,
    firmName: cleanMinStr(app.firmName, 2, 'Dealer Firm', 160),
    contactPerson: cleanMinStr(app.contactPerson, 2, 'Primary Contact', 120),
    businessType: cleanStr(app.businessType, 'Sanitaryware Showroom', 120),
    gstNumber: cleanMinStr(app.gstNumber, 3, 'N/A', 40),
    phoneCode: cleanMinStr(app.phoneCode, 1, '+91', 12),
    whatsappNumber: cleanMinStr(app.whatsappNumber, 6, '000000', 30),
    email: cleanMinStr(app.email, 5, 'na@hightone.local', 160),
    streetAddress: cleanMinStr(app.streetAddress, 5, 'Address Pending', 300),
    pincode: cleanMinStr(app.pincode, 3, '000000', 20),
    country: cleanStr(app.country, 'India', 80),
    state: cleanStr(app.state, '', 80),
    district: cleanStr(app.district, '', 80),
    city: cleanStr(app.city, '', 80),
    cityState: cleanStr(app.cityState, '', 200),
    estimatedVolume: cleanStr(app.estimatedVolume, '', 120),
    preferredCategories: cleanStr(app.preferredCategories, '', 300),
    notes: cleanStr(app.notes, '', 1000),
    status: (['pending', 'approved', 'rejected'].includes(app.status) ? app.status : 'pending') as DealerApplication['status'],
    verification: {
      addressVerified: Boolean(v?.addressVerified),
      ...(v?.addressVerifiedBy ? { addressVerifiedBy: cleanStr(v.addressVerifiedBy, '', 120) } : {}),
      ...(v?.addressVerifiedAt ? { addressVerifiedAt: cleanStr(v.addressVerifiedAt, '', 80) } : {}),
      gstVerified: Boolean(v?.gstVerified),
      ...(v?.gstVerifiedBy ? { gstVerifiedBy: cleanStr(v.gstVerifiedBy, '', 120) } : {}),
      ...(v?.gstVerifiedAt ? { gstVerifiedAt: cleanStr(v.gstVerifiedAt, '', 80) } : {}),
      callVerified: Boolean(v?.callVerified),
      ...(v?.callVerifiedBy ? { callVerifiedBy: cleanStr(v.callVerifiedBy, '', 120) } : {}),
      ...(v?.callVerifiedAt ? { callVerifiedAt: cleanStr(v.callVerifiedAt, '', 80) } : {}),
      businessVerified: Boolean(v?.businessVerified),
      adminNotes: cleanStr(v?.adminNotes, '', 2000)
    },
    ...(app.rejectionReason ? { rejectionReason: cleanStr(app.rejectionReason, '', 500) } : {}),
    ...(app.generatedAccountId ? { generatedAccountId: cleanStr(app.generatedAccountId, '', 64) } : {}),
    ...(app.issuedUserId ? { issuedUserId: cleanStr(app.issuedUserId, '', 64) } : {}),
    ...(app.reviewedBy ? { reviewedBy: cleanStr(app.reviewedBy, '', 120) } : {}),
    ...(app.reviewedAt ? { reviewedAt: cleanStr(app.reviewedAt, '', 80) } : {}),
    createdAt: cleanStr(app.createdAt, new Date().toISOString(), 80),
    updatedAtTs: serverTimestamp()
  });
  try {
    await setDoc(doc(db, COLLECTION_DEALER_APPLICATIONS, cleanId), cleanRecord, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteDealerApplicationFromCloud(appId: string): Promise<void> {
  const path = `${COLLECTION_DEALER_APPLICATIONS}/${appId}`;
  try {
    await deleteDoc(doc(db, COLLECTION_DEALER_APPLICATIONS, appId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Admin: Save dealer account + sync SHA-256 auth token for cross-device Dealer Portal login.
 */
export async function saveDealerAccountToCloud(
  account: DealerAccount,
  previousCredHash?: string
): Promise<string> {
  const cleanId = cleanMinStr(account.id, 3, `DLR-${Date.now()}`, 64);
  const cleanUserId = cleanMinStr(account.userId, 3, cleanId, 64);
  const cleanPassword = cleanMinStr(account.password, 4, 'HTC0', 64);
  const credHash = await computeCredentialHash(cleanUserId, cleanPassword);
  const accountPath = `${COLLECTION_DEALER_ACCOUNTS}/${cleanId}`;
  const tokenPath = `${COLLECTION_DEALER_AUTH_TOKENS}/${credHash}`;

  const cleanAccount = stripUndefinedDeep({
    id: cleanId,
    firmName: cleanMinStr(account.firmName, 2, 'Dealer Firm', 160),
    contactPerson: cleanMinStr(account.contactPerson, 2, 'Primary Contact', 120),
    businessType: cleanStr(account.businessType, 'Sanitaryware Showroom', 120),
    gstNumber: cleanStr(account.gstNumber, '', 40),
    phoneCode: cleanStr(account.phoneCode, '+91', 12),
    whatsappNumber: cleanStr(account.whatsappNumber, '', 30),
    email: cleanStr(account.email, '', 160),
    streetAddress: cleanStr(account.streetAddress, '', 300),
    pincode: cleanStr(account.pincode, '', 20),
    country: cleanStr(account.country, 'India', 80),
    state: cleanStr(account.state, '', 80),
    district: cleanStr(account.district, '', 80),
    city: cleanStr(account.city, '', 80),
    cityState: cleanStr(account.cityState, '', 200),
    userId: cleanUserId,
    password: cleanPassword,
    active: Boolean(account.active),
    ...(account.applicationId ? { applicationId: cleanStr(account.applicationId, '', 64) } : {}),
    ...(account.verificationSummary ? { verificationSummary: cleanStr(account.verificationSummary, '', 300) } : {}),
    createdAt: cleanStr(account.createdAt, new Date().toISOString(), 80),
    ...(account.updatedAt ? { updatedAt: cleanStr(account.updatedAt, '', 80) } : {}),
    ...(account.lastLoginAt ? { lastLoginAt: cleanStr(account.lastLoginAt, '', 80) } : {}),
    credHash,
    updatedAtTs: serverTimestamp()
  });

  const cleanToken = stripUndefinedDeep({
    credHash,
    accountId: cleanId,
    userId: cleanUserId,
    active: Boolean(account.active),
    firmName: cleanMinStr(account.firmName, 2, 'Dealer Firm', 160),
    contactPerson: cleanStr(account.contactPerson, '', 120),
    businessType: cleanStr(account.businessType, '', 120),
    gstNumber: cleanStr(account.gstNumber, '', 40),
    phoneCode: cleanStr(account.phoneCode, '+91', 12),
    whatsappNumber: cleanStr(account.whatsappNumber, '', 30),
    email: cleanStr(account.email, '', 160),
    streetAddress: cleanStr(account.streetAddress, '', 300),
    pincode: cleanStr(account.pincode, '', 20),
    country: cleanStr(account.country, 'India', 80),
    state: cleanStr(account.state, '', 80),
    district: cleanStr(account.district, '', 80),
    city: cleanStr(account.city, '', 80),
    cityState: cleanStr(account.cityState, '', 200),
    updatedAtTs: serverTimestamp()
  });

  try {
    await setDoc(doc(db, COLLECTION_DEALER_ACCOUNTS, cleanId), cleanAccount, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, accountPath);
  }

  try {
    await setDoc(doc(db, COLLECTION_DEALER_AUTH_TOKENS, credHash), cleanToken);
    if (previousCredHash && previousCredHash !== credHash) {
      await deleteDoc(doc(db, COLLECTION_DEALER_AUTH_TOKENS, previousCredHash)).catch(() => {});
      const prevFeedSnap = await getDoc(doc(db, COLLECTION_DEALER_ORDER_FEEDS, previousCredHash)).catch(() => null);
      if (prevFeedSnap && prevFeedSnap.exists()) {
        const feedData = prevFeedSnap.data();
        await setDoc(doc(db, COLLECTION_DEALER_ORDER_FEEDS, credHash), {
          credHash,
          accountId: cleanId,
          orders: Array.isArray(feedData?.orders) ? feedData.orders : [],
          updatedAtTs: serverTimestamp()
        });
        await deleteDoc(doc(db, COLLECTION_DEALER_ORDER_FEEDS, previousCredHash)).catch(() => {});
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, tokenPath);
  }

  return credHash;
}

export async function deleteDealerAccountFromCloud(account: DealerAccount): Promise<void> {
  const accountPath = `${COLLECTION_DEALER_ACCOUNTS}/${account.id}`;
  try {
    await deleteDoc(doc(db, COLLECTION_DEALER_ACCOUNTS, account.id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, accountPath);
  }

  const credHash = account.credHash || (await computeCredentialHash(account.userId, account.password));
  try {
    await deleteDoc(doc(db, COLLECTION_DEALER_AUTH_TOKENS, credHash));
    await deleteDoc(doc(db, COLLECTION_DEALER_ORDER_FEEDS, credHash)).catch(() => {});
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${COLLECTION_DEALER_AUTH_TOKENS}/${credHash}`);
  }
}

/**
 * Public Dealer Sign-In via SHA-256 credential token lookup.
 */
export async function authenticateDealerFromCloud(
  userId: string,
  password: string
): Promise<{
  found: boolean;
  active: boolean;
  credHash: string;
  tokenData?: {
    accountId: string;
    userId: string;
    active: boolean;
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
  };
}> {
  const credHash = await computeCredentialHash(userId, password);
  const path = `${COLLECTION_DEALER_AUTH_TOKENS}/${credHash}`;
  try {
    const snap = await getDoc(doc(db, COLLECTION_DEALER_AUTH_TOKENS, credHash));
    if (!snap.exists()) {
      return { found: false, active: false, credHash };
    }
    const data = snap.data();
    return {
      found: true,
      active: Boolean(data?.active),
      credHash,
      tokenData: {
        accountId: String(data.accountId || ''),
        userId: String(data.userId || userId.trim()),
        active: Boolean(data.active),
        firmName: String(data.firmName || ''),
        contactPerson: String(data.contactPerson || ''),
        businessType: String(data.businessType || ''),
        gstNumber: String(data.gstNumber || ''),
        phoneCode: String(data.phoneCode || '+91'),
        whatsappNumber: String(data.whatsappNumber || ''),
        email: String(data.email || ''),
        streetAddress: String(data.streetAddress || ''),
        pincode: String(data.pincode || ''),
        country: String(data.country || 'India'),
        state: String(data.state || ''),
        district: String(data.district || ''),
        city: String(data.city || ''),
        cityState: String(data.cityState || '')
      }
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

/**
 * Sync per-dealer order feed document so verified dealers see updated statuses across devices.
 */
export async function syncDealerOrderFeedToCloud(
  credHash: string,
  accountId: string,
  dealerOrders: SavedDealerOrder[]
): Promise<void> {
  if (!credHash || !accountId) return;
  const path = `${COLLECTION_DEALER_ORDER_FEEDS}/${credHash}`;
  const filtered = dealerOrders
    .filter((o) => o.dealerAccountId === accountId || o.dealerCredHash === credHash)
    .slice(0, 150)
    .map((o) => stripUndefinedDeep(o));

  try {
    await setDoc(doc(db, COLLECTION_DEALER_ORDER_FEEDS, credHash), {
      credHash,
      accountId,
      orders: filtered,
      updatedAtTs: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function fetchDealerOrderFeedFromCloud(credHash: string): Promise<SavedDealerOrder[]> {
  if (!credHash) return [];
  const path = `${COLLECTION_DEALER_ORDER_FEEDS}/${credHash}`;
  try {
    const snap = await getDoc(doc(db, COLLECTION_DEALER_ORDER_FEEDS, credHash));
    if (!snap.exists()) return [];
    const data = snap.data();
    return Array.isArray(data?.orders) ? (data.orders as SavedDealerOrder[]) : [];
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

/**
 * Save or update a dealer order in /dealer_orders/{orderId}.
 */
export async function saveDealerOrderToCloud(
  order: SavedDealerOrder,
  isCreate: boolean
): Promise<void> {
  const cleanId = cleanMinStr(order?.id || order?.orderId, 3, '', 64);
  if (!cleanId || !/^[a-zA-Z0-9_-]+$/.test(cleanId)) return;
  const path = `${COLLECTION_DEALER_ORDERS}/${cleanId}`;

  const rawInfo = order.dealerInfo && typeof order.dealerInfo === 'object' ? order.dealerInfo : undefined;
  const safeDealerInfo = {
    firmName: cleanStr(rawInfo?.firmName, '', 160),
    contactPerson: cleanStr(rawInfo?.contactPerson ?? order.personName, '', 120),
    phoneCode: cleanStr(rawInfo?.phoneCode, '+91', 12),
    phoneNumber: cleanStr(rawInfo?.phoneNumber, '', 30),
    country: cleanStr(rawInfo?.country, 'India', 80),
    state: cleanStr(rawInfo?.state, '', 80),
    district: cleanStr(rawInfo?.district, '', 80),
    city: cleanStr(rawInfo?.city, '', 80),
    cityState: cleanStr(rawInfo?.cityState, '', 200),
    ...(rawInfo?.transporterHub ? { transporterHub: cleanStr(rawInfo.transporterHub, '', 200) } : {}),
    ...(rawInfo?.notes ? { notes: cleanStr(rawInfo.notes, '', 1000) } : {})
  };

  const validStatus: SavedDealerOrder['status'] =
    ['new', 'processing', 'dispatched', 'completed'].includes(order.status)
      ? order.status
      : (order.completed ? 'completed' : 'new');

  const validVerStatus =
    order.verificationStatus && ['pending', 'accepted', 'rejected'].includes(order.verificationStatus)
      ? order.verificationStatus
      : undefined;

  const cleanOrder = stripUndefinedDeep({
    id: cleanId,
    orderId: cleanMinStr(order.orderId || cleanId, 3, cleanId, 64),
    dispatchNo: cleanStr(order.dispatchNo, '', 64),
    ...(order.vehicleNo ? { vehicleNo: cleanStr(order.vehicleNo, '', 64) } : {}),
    personName: cleanStr(order.personName || safeDealerInfo.contactPerson, '', 120),
    ...(order.requiredDate ? { requiredDate: cleanStr(order.requiredDate, '', 40) } : {}),
    ...(order.requiredPeriod ? { requiredPeriod: cleanStr(order.requiredPeriod, '', 80) } : {}),
    ...(order.dealerAccountId ? { dealerAccountId: cleanStr(order.dealerAccountId, '', 64) } : {}),
    ...(order.dealerUserId ? { dealerUserId: cleanStr(order.dealerUserId, '', 64) } : {}),
    ...(order.dealerCredHash ? { dealerCredHash: cleanStr(order.dealerCredHash, '', 64) } : {}),
    ...(order.dealerEmail ? { dealerEmail: cleanStr(order.dealerEmail, '', 160) } : {}),
    ...(order.dealerGst ? { dealerGst: cleanStr(order.dealerGst, '', 40) } : {}),
    ...(order.dealerAddress ? { dealerAddress: cleanStr(order.dealerAddress, '', 300) } : {}),
    ...(order.lastEditedAt ? { lastEditedAt: cleanStr(order.lastEditedAt, '', 80) } : {}),
    ...(typeof order.editCount === 'number' && Number.isFinite(order.editCount) ? { editCount: order.editCount } : {}),
    dealerInfo: safeDealerInfo,
    items: Array.isArray(order.items) ? order.items.slice(0, 250) : [],
    totalQuantity: Number.isFinite(Number(order.totalQuantity)) ? Math.max(0, Number(order.totalQuantity)) : 0,
    totalModels: Number.isFinite(Number(order.totalModels)) ? Math.max(0, Number(order.totalModels)) : 0,
    ...(typeof order.totalBatches === 'number' && Number.isFinite(order.totalBatches) ? { totalBatches: order.totalBatches } : {}),
    totalWeightKg: Number.isFinite(Number(order.totalWeightKg)) ? Math.max(0, Number(order.totalWeightKg)) : 0,
    ...(order.timestamp ? { timestamp: cleanStr(order.timestamp, '', 80) } : {}),
    source: cleanStr(order.source, 'Dealer Order Portal', 120),
    status: validStatus,
    ...(validVerStatus ? { verificationStatus: validVerStatus } : {}),
    ...(order.availabilityStatus ? { availabilityStatus: cleanStr(order.availabilityStatus, '', 40) } : {}),
    ...(typeof order.productionRoutedCount === 'number' && Number.isFinite(order.productionRoutedCount)
      ? { productionRoutedCount: order.productionRoutedCount }
      : {}),
    ...(order.rejectionReason ? { rejectionReason: cleanStr(order.rejectionReason, '', 500) } : {}),
    ...(order.verifiedBy ? { verifiedBy: cleanStr(order.verifiedBy, '', 120) } : {}),
    ...(order.verifiedAt ? { verifiedAt: cleanStr(order.verifiedAt, '', 80) } : {}),
    completed: Boolean(order.completed),
    ...(order.completedAt ? { completedAt: cleanStr(order.completedAt, '', 80) } : {}),
    ...(isCreate ? { createdAtTs: serverTimestamp() } : {}),
    updatedAtTs: serverTimestamp()
  });

  try {
    if (isCreate) {
      await setDoc(doc(db, COLLECTION_DEALER_ORDERS, cleanId), cleanOrder);
    } else {
      await setDoc(doc(db, COLLECTION_DEALER_ORDERS, cleanId), cleanOrder, { merge: true });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteDealerOrderFromCloud(orderId: string): Promise<void> {
  const path = `${COLLECTION_DEALER_ORDERS}/${orderId}`;
  try {
    await deleteDoc(doc(db, COLLECTION_DEALER_ORDERS, orderId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Public: Record B2B inquiry to Firestore.
 */
export async function submitPublicInquiryToCloud(inquiry: SavedInquiry): Promise<void> {
  const cleanId = cleanMinStr(inquiry.id, 3, `HTC-${Date.now()}`, 64);
  const path = `${COLLECTION_B2B_INQUIRIES}/${cleanId}`;
  const clean = stripUndefinedDeep({
    id: cleanId,
    businessName: cleanMinStr(inquiry.businessName, 2, 'Business Inquiry', 160),
    contactPerson: cleanMinStr(inquiry.contactPerson, 2, 'Contact', 120),
    phoneCode: cleanStr(inquiry.phoneCode, '+91', 12),
    whatsappNumber: cleanMinStr(inquiry.whatsappNumber, 6, '000000', 30),
    country: cleanStr(inquiry.country, 'India', 80),
    state: cleanStr(inquiry.state, '', 80),
    district: cleanStr(inquiry.district, '', 80),
    city: cleanStr(inquiry.city, '', 80),
    cityState: cleanStr(inquiry.cityState, '', 200),
    volume: cleanStr(inquiry.volume, '', 120),
    productInterest: cleanStr(inquiry.productInterest, '', 300),
    notes: cleanStr(inquiry.notes, '', 1000),
    ...(inquiry.timestamp ? { timestamp: cleanStr(inquiry.timestamp, '', 80) } : {}),
    source: cleanStr(inquiry.source, 'Website Form', 120),
    status: 'new',
    createdAtTs: serverTimestamp()
  });
  try {
    await setDoc(doc(db, COLLECTION_B2B_INQUIRIES, cleanId), clean);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function saveInquiryToCloud(inquiry: SavedInquiry): Promise<void> {
  const cleanId = cleanMinStr(inquiry?.id, 3, '', 64);
  if (!cleanId || !/^[a-zA-Z0-9_-]+$/.test(cleanId)) return;
  const path = `${COLLECTION_B2B_INQUIRIES}/${cleanId}`;
  const validStatus: SavedInquiry['status'] =
    ['new', 'contacted', 'quoted'].includes(inquiry.status) ? inquiry.status : 'new';
  const clean = stripUndefinedDeep({
    id: cleanId,
    businessName: cleanMinStr(inquiry.businessName, 2, 'Business Inquiry', 160),
    contactPerson: cleanMinStr(inquiry.contactPerson, 2, 'Contact', 120),
    phoneCode: cleanStr(inquiry.phoneCode, '+91', 12),
    whatsappNumber: cleanMinStr(inquiry.whatsappNumber, 6, '000000', 30),
    country: cleanStr(inquiry.country, 'India', 80),
    state: cleanStr(inquiry.state, '', 80),
    district: cleanStr(inquiry.district, '', 80),
    city: cleanStr(inquiry.city, '', 80),
    cityState: cleanStr(inquiry.cityState, '', 200),
    volume: cleanStr(inquiry.volume, '', 120),
    productInterest: cleanStr(inquiry.productInterest, '', 300),
    notes: cleanStr(inquiry.notes, '', 1000),
    ...(inquiry.timestamp ? { timestamp: cleanStr(inquiry.timestamp, '', 80) } : {}),
    source: cleanStr(inquiry.source, 'Website Form', 120),
    status: validStatus,
    updatedAtTs: serverTimestamp()
  });
  try {
    await setDoc(doc(db, COLLECTION_B2B_INQUIRIES, cleanId), clean, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteInquiryFromCloud(inquiryId: string): Promise<void> {
  const path = `${COLLECTION_B2B_INQUIRIES}/${inquiryId}`;
  try {
    await deleteDoc(doc(db, COLLECTION_B2B_INQUIRIES, inquiryId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Production Queue & Daily Logs Sync (Admin / Production Manager)
 */
export async function saveProductionQueueItemToCloud(item: ProductionQueueItem): Promise<void> {
  const cleanId = cleanMinStr(item?.id, 3, '', 64);
  if (!cleanId || !/^[a-zA-Z0-9_-]+$/.test(cleanId)) return;
  const path = `${COLLECTION_PRODUCTION_QUEUE}/${cleanId}`;
  const cleanItem = stripUndefinedDeep({
    id: cleanId,
    itemKey: cleanStr(item.itemKey, '', 200),
    productId: cleanStr(item.productId, '', 80),
    productName: cleanStr(item.productName, '', 160),
    grade: item.grade,
    packing: item.packing,
    codeOrColor: cleanStr(item.codeOrColor, '', 80),
    quantityToMake: Number.isFinite(Number(item.quantityToMake)) ? Math.max(0, Number(item.quantityToMake)) : 0,
    unitWeightKg: Number.isFinite(Number(item.unitWeightKg)) ? Math.max(0, Number(item.unitWeightKg)) : 0,
    sourceType: item.sourceType,
    ...(item.sourceOrderId ? { sourceOrderId: cleanStr(item.sourceOrderId, '', 64) } : {}),
    ...(item.sourceOrderCode ? { sourceOrderCode: cleanStr(item.sourceOrderCode, '', 64) } : {}),
    ...(item.firmName ? { firmName: cleanStr(item.firmName, '', 160) } : {}),
    ...(item.dealerName ? { dealerName: cleanStr(item.dealerName, '', 120) } : {}),
    ...(item.requiredDate ? { requiredDate: cleanStr(item.requiredDate, '', 40) } : {}),
    ...(item.requiredPeriod ? { requiredPeriod: cleanStr(item.requiredPeriod, '', 80) } : {}),
    ...(item.notes ? { notes: cleanStr(item.notes, '', 1000) } : {}),
    addedBy: cleanStr(item.addedBy, 'Admin', 120),
    createdAt: cleanStr(item.createdAt, new Date().toISOString(), 80),
    updatedAtTs: serverTimestamp()
  });
  try {
    await setDoc(doc(db, COLLECTION_PRODUCTION_QUEUE, cleanId), cleanItem, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteProductionQueueItemFromCloud(id: string): Promise<void> {
  const path = `${COLLECTION_PRODUCTION_QUEUE}/${id}`;
  try {
    await deleteDoc(doc(db, COLLECTION_PRODUCTION_QUEUE, id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveDailyProductionLogToCloud(entry: DailyProductionEntry): Promise<void> {
  const cleanId = cleanMinStr(entry?.id, 3, '', 64);
  if (!cleanId || !/^[a-zA-Z0-9_-]+$/.test(cleanId)) return;
  const path = `${COLLECTION_DAILY_PRODUCTION_LOGS}/${cleanId}`;
  const cleanEntry = stripUndefinedDeep({
    id: cleanId,
    date: cleanStr(entry.date, new Date().toISOString().slice(0, 10), 20),
    itemKey: cleanStr(entry.itemKey, '', 200),
    productId: cleanStr(entry.productId, '', 80),
    productName: cleanStr(entry.productName, '', 160),
    grade: entry.grade,
    packing: entry.packing,
    codeOrColor: cleanStr(entry.codeOrColor, '', 80),
    quantityMade: Number.isFinite(Number(entry.quantityMade)) ? Math.max(0, Number(entry.quantityMade)) : 0,
    recordedBy: cleanStr(entry.recordedBy, 'Admin', 120),
    ...(entry.notes ? { notes: cleanStr(entry.notes, '', 1000) } : {}),
    createdAt: cleanStr(entry.createdAt, new Date().toISOString(), 80),
    updatedAtTs: serverTimestamp()
  });
  try {
    await setDoc(doc(db, COLLECTION_DAILY_PRODUCTION_LOGS, cleanId), cleanEntry, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteDailyProductionLogFromCloud(id: string): Promise<void> {
  const path = `${COLLECTION_DAILY_PRODUCTION_LOGS}/${id}`;
  try {
    await deleteDoc(doc(db, COLLECTION_DAILY_PRODUCTION_LOGS, id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Shared App Settings & CMS Persistence (/app_settings/*)
 */
export interface CloudCatalogSettingsPayload {
  productConfigs?: Record<string, ProductConfigOverride>;
  colorsList?: string[];
  designCodesList?: string[];
  globalDefaultCode?: string;
  collectionsMeta?: Record<string, Partial<CategoryMeta>>;
  companyInfo?: CompanyInfoMap;
  sheetId?: string | null;
  productionCheckedKeys?: Record<string, boolean>;
}

export interface CloudCmsProductsPayload {
  products?: ProductItem[];
  sheetId?: string | null;
  lastSyncTime?: string | null;
}

export interface CloudCmsMediaAndCompanyPayload {
  siteMedia?: SiteMediaMap;
  companyInfo?: CompanyInfoMap;
  faqs?: { question: string; answer: string }[];
  sheetWebhookUrl?: string;
  ga4MeasurementId?: string;
}

export interface CloudCmsSeoAndLegalPayload {
  legalPolicies?: LegalPoliciesMap;
  collectionSeoMap?: Record<string, CollectionSeoMeta>;
}

export interface CloudProductionStatePayload {
  productionCheckedKeys?: Record<string, boolean>;
}

export interface PublicCmsBundle {
  catalogConfig: CloudCatalogSettingsPayload | null;
  cmsProducts: CloudCmsProductsPayload | null;
  cmsMediaCompany: CloudCmsMediaAndCompanyPayload | null;
  cmsSeoLegal: CloudCmsSeoAndLegalPayload | null;
  productionState: CloudProductionStatePayload | null;
}

export async function saveCatalogSettingsToCloud(partial: CloudCatalogSettingsPayload): Promise<void> {
  const path = `${COLLECTION_APP_SETTINGS}/catalog_config`;
  try {
    await setDoc(
      doc(db, COLLECTION_APP_SETTINGS, 'catalog_config'),
      stripUndefinedDeep({
        ...partial,
        updatedAtTs: serverTimestamp()
      }),
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveCmsProductsToCloud(partial: CloudCmsProductsPayload): Promise<void> {
  const path = `${COLLECTION_APP_SETTINGS}/cms_products`;
  try {
    await setDoc(
      doc(db, COLLECTION_APP_SETTINGS, 'cms_products'),
      stripUndefinedDeep({
        ...partial,
        updatedAtTs: serverTimestamp()
      }),
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveCmsMediaAndCompanyToCloud(partial: CloudCmsMediaAndCompanyPayload): Promise<void> {
  const path = `${COLLECTION_APP_SETTINGS}/cms_media_company`;
  try {
    await setDoc(
      doc(db, COLLECTION_APP_SETTINGS, 'cms_media_company'),
      stripUndefinedDeep({
        ...partial,
        updatedAtTs: serverTimestamp()
      }),
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveCmsSeoAndLegalToCloud(partial: CloudCmsSeoAndLegalPayload): Promise<void> {
  const path = `${COLLECTION_APP_SETTINGS}/cms_seo_legal`;
  try {
    await setDoc(
      doc(db, COLLECTION_APP_SETTINGS, 'cms_seo_legal'),
      stripUndefinedDeep({
        ...partial,
        updatedAtTs: serverTimestamp()
      }),
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveProductionStateToCloud(
  productionCheckedKeys: Record<string, boolean>
): Promise<void> {
  const path = `${COLLECTION_APP_SETTINGS}/production_state`;
  try {
    await setDoc(
      doc(db, COLLECTION_APP_SETTINGS, 'production_state'),
      stripUndefinedDeep({
        productionCheckedKeys,
        updatedAtTs: serverTimestamp()
      }),
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function fetchPublicCatalogSettings(): Promise<CloudCatalogSettingsPayload | null> {
  try {
    const snap = await getDoc(doc(db, COLLECTION_APP_SETTINGS, 'catalog_config'));
    if (!snap.exists()) return null;
    return snap.data() as CloudCatalogSettingsPayload;
  } catch (error) {
    console.warn('Could not fetch catalog_config from cloud:', error);
    return null;
  }
}

export async function fetchAllPublicCmsFromCloud(): Promise<PublicCmsBundle> {
  const readDoc = async <T,>(id: string): Promise<T | null> => {
    try {
      const snap = await getDoc(doc(db, COLLECTION_APP_SETTINGS, id));
      return snap.exists() ? (snap.data() as T) : null;
    } catch {
      return null;
    }
  };

  const [catalogConfig, cmsProducts, cmsMediaCompany, cmsSeoLegal, productionState] =
    await Promise.all([
      readDoc<CloudCatalogSettingsPayload>('catalog_config'),
      readDoc<CloudCmsProductsPayload>('cms_products'),
      readDoc<CloudCmsMediaAndCompanyPayload>('cms_media_company'),
      readDoc<CloudCmsSeoAndLegalPayload>('cms_seo_legal'),
      readDoc<CloudProductionStatePayload>('production_state')
    ]);

  return {
    catalogConfig,
    cmsProducts,
    cmsMediaCompany,
    cmsSeoLegal,
    productionState
  };
}

export function subscribePublicCmsDocs(callbacks: {
  onCatalogSettings?: (data: CloudCatalogSettingsPayload) => void;
  onCmsProducts?: (data: CloudCmsProductsPayload) => void;
  onCmsMediaCompany?: (data: CloudCmsMediaAndCompanyPayload) => void;
  onCmsSeoLegal?: (data: CloudCmsSeoAndLegalPayload) => void;
}): () => void {
  const unsubscribers: Array<() => void> = [];
  if (callbacks.onCatalogSettings) {
    unsubscribers.push(
      onSnapshot(
        doc(db, COLLECTION_APP_SETTINGS, 'catalog_config'),
        (snap) => {
          if (snap.exists()) callbacks.onCatalogSettings?.(snap.data() as CloudCatalogSettingsPayload);
        },
        () => {}
      )
    );
  }
  if (callbacks.onCmsProducts) {
    unsubscribers.push(
      onSnapshot(
        doc(db, COLLECTION_APP_SETTINGS, 'cms_products'),
        (snap) => {
          if (snap.exists()) callbacks.onCmsProducts?.(snap.data() as CloudCmsProductsPayload);
        },
        () => {}
      )
    );
  }
  if (callbacks.onCmsMediaCompany) {
    unsubscribers.push(
      onSnapshot(
        doc(db, COLLECTION_APP_SETTINGS, 'cms_media_company'),
        (snap) => {
          if (snap.exists()) callbacks.onCmsMediaCompany?.(snap.data() as CloudCmsMediaAndCompanyPayload);
        },
        () => {}
      )
    );
  }
  if (callbacks.onCmsSeoLegal) {
    unsubscribers.push(
      onSnapshot(
        doc(db, COLLECTION_APP_SETTINGS, 'cms_seo_legal'),
        (snap) => {
          if (snap.exists()) callbacks.onCmsSeoLegal?.(snap.data() as CloudCmsSeoAndLegalPayload);
        },
        () => {}
      )
    );
  }
  return () => unsubscribers.forEach((u) => u());
}

/**
 * Staff Accounts, SHA-256 Staff Auth Tokens & Google Email Role Grants
 */
function normalizeValidEmail(email?: string): string | undefined {
  const clean = (email || '').trim().toLowerCase();
  if (!clean) return undefined;
  return /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(clean) ? clean : undefined;
}

export async function saveStaffAccountToCloud(
  account: AdminStaffAccount,
  previousCredHash?: string,
  previousEmail?: string
): Promise<string> {
  const cleanId = cleanMinStr(account.id, 3, `STF-${Date.now()}`, 64);
  const cleanUserId = cleanMinStr(account.userId, 3, cleanId, 64);
  const cleanPassword = cleanMinStr(account.password, 4, 'HTC0', 64);
  const cleanDisplay = cleanMinStr(account.displayName, 2, cleanUserId, 120);
  const role = normalizeAdminRole(account.role);
  const cleanEmail = normalizeValidEmail(account.staffEmail);
  const credHash = await computeCredentialHash(cleanUserId, cleanPassword);

  const accountPath = `${COLLECTION_STAFF_ACCOUNTS}/${cleanId}`;
  const tokenPath = `${COLLECTION_STAFF_AUTH_TOKENS}/${credHash}`;

  const cleanStaffDoc = stripUndefinedDeep({
    id: cleanId,
    displayName: cleanDisplay,
    userId: cleanUserId,
    password: cleanPassword,
    role,
    ...(cleanEmail ? { staffEmail: cleanEmail } : {}),
    credHash,
    active: Boolean(account.active),
    createdAt: cleanStr(account.createdAt, new Date().toISOString(), 80),
    updatedAtTs: serverTimestamp()
  });

  const cleanTokenDoc = stripUndefinedDeep({
    credHash,
    staffId: cleanId,
    displayName: cleanDisplay,
    userId: cleanUserId,
    role,
    isMasterOwner: false,
    ...(cleanEmail ? { staffEmail: cleanEmail } : {}),
    active: Boolean(account.active),
    updatedAtTs: serverTimestamp()
  });

  try {
    await setDoc(doc(db, COLLECTION_STAFF_ACCOUNTS, cleanId), cleanStaffDoc, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, accountPath);
  }

  try {
    await setDoc(doc(db, COLLECTION_STAFF_AUTH_TOKENS, credHash), cleanTokenDoc);
    if (previousCredHash && previousCredHash !== credHash) {
      await deleteDoc(doc(db, COLLECTION_STAFF_AUTH_TOKENS, previousCredHash)).catch(() => {});
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, tokenPath);
  }

  const normalizedPrevEmail = normalizeValidEmail(previousEmail);
  if (normalizedPrevEmail && normalizedPrevEmail !== cleanEmail) {
    await deleteDoc(doc(db, COLLECTION_ADMINS_BY_EMAIL, normalizedPrevEmail)).catch(() => {});
  }
  if (cleanEmail) {
    const emailPath = `${COLLECTION_ADMINS_BY_EMAIL}/${cleanEmail}`;
    try {
      await setDoc(doc(db, COLLECTION_ADMINS_BY_EMAIL, cleanEmail), {
        email: cleanEmail,
        displayName: cleanDisplay,
        role,
        staffId: cleanId,
        active: Boolean(account.active),
        updatedAtTs: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, emailPath);
    }
  }

  return credHash;
}

export async function deleteStaffAccountFromCloud(account: AdminStaffAccount): Promise<void> {
  const path = `${COLLECTION_STAFF_ACCOUNTS}/${account.id}`;
  try {
    await deleteDoc(doc(db, COLLECTION_STAFF_ACCOUNTS, account.id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
  const credHash = account.credHash || (await computeCredentialHash(account.userId, account.password));
  await deleteDoc(doc(db, COLLECTION_STAFF_AUTH_TOKENS, credHash)).catch(() => {});
  const cleanEmail = normalizeValidEmail(account.staffEmail);
  if (cleanEmail) {
    await deleteDoc(doc(db, COLLECTION_ADMINS_BY_EMAIL, cleanEmail)).catch(() => {});
  }
}

export async function saveMasterOwnerTokenToCloud(
  userId: string,
  password: string,
  previousCredHash?: string
): Promise<string> {
  const cleanUserId = cleanMinStr(userId, 3, 'admin', 64);
  const cleanPassword = cleanMinStr(password, 4, 'HTC0', 64);
  const credHash = await computeCredentialHash(cleanUserId, cleanPassword);
  const path = `${COLLECTION_STAFF_AUTH_TOKENS}/${credHash}`;
  try {
    await setDoc(doc(db, COLLECTION_STAFF_AUTH_TOKENS, credHash), {
      credHash,
      staffId: 'master_owner',
      displayName: 'Admin',
      userId: cleanUserId,
      role: 'admin',
      isMasterOwner: true,
      active: true,
      updatedAtTs: serverTimestamp()
    });
    if (previousCredHash && previousCredHash !== credHash) {
      await deleteDoc(doc(db, COLLECTION_STAFF_AUTH_TOKENS, previousCredHash)).catch(() => {});
    }
    return credHash;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function authenticateStaffFromCloud(
  userId: string,
  password: string
): Promise<{
  found: boolean;
  active: boolean;
  credHash: string;
  tokenData?: {
    staffId: string;
    displayName: string;
    userId: string;
    role: AdminRole;
    isMasterOwner: boolean;
    staffEmail?: string;
    active: boolean;
  };
}> {
  const credHash = await computeCredentialHash(userId, password);
  const path = `${COLLECTION_STAFF_AUTH_TOKENS}/${credHash}`;
  try {
    const snap = await getDoc(doc(db, COLLECTION_STAFF_AUTH_TOKENS, credHash));
    if (!snap.exists()) {
      return { found: false, active: false, credHash };
    }
    const data = snap.data();
    return {
      found: true,
      active: Boolean(data?.active),
      credHash,
      tokenData: {
        staffId: String(data.staffId || ''),
        displayName: String(data.displayName || 'Staff'),
        userId: String(data.userId || userId.trim()),
        role: normalizeAdminRole(data.role),
        isMasterOwner: Boolean(data.isMasterOwner),
        ...(data.staffEmail ? { staffEmail: String(data.staffEmail) } : {}),
        active: Boolean(data.active)
      }
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

/**
 * Cloud Visitor Analytics Events
 */
export async function recordAnalyticsEventToCloud(event: AnalyticsEvent): Promise<void> {
  const cleanId = cleanMinStr(event?.id, 3, `evt-${Date.now()}`, 64);
  if (!/^[a-zA-Z0-9_-]+$/.test(cleanId)) return;
  try {
    const payload = stripUndefinedDeep({
      id: cleanId,
      type: event.type,
      ...(event.target ? { target: cleanStr(event.target, '', 200) } : {}),
      ...(event.details ? { details: cleanStr(event.details, '', 300) } : {}),
      ...(event.page ? { page: cleanStr(event.page, '', 120) } : {}),
      ...(event.device ? { device: event.device } : {}),
      ...(typeof event.durationSeconds === 'number' && Number.isFinite(event.durationSeconds)
        ? { durationSeconds: Math.min(86400, Math.max(0, Math.round(event.durationSeconds))) }
        : {}),
      ...(event.location && typeof event.location === 'object' ? { location: event.location } : {}),
      timestamp: cleanStr(event.timestamp, new Date().toISOString(), 80),
      createdAtTs: serverTimestamp()
    });
    await setDoc(doc(db, COLLECTION_ANALYTICS_EVENTS, cleanId), payload);
  } catch {
    // Public telemetry failures stay silent to keep visitor browsing fast & clean
  }
}

export async function fetchCloudAnalyticsEvents(maxEvents = 400): Promise<AnalyticsEvent[]> {
  const path = COLLECTION_ANALYTICS_EVENTS;
  try {
    const snap = await getDocs(
      query(collection(db, COLLECTION_ANALYTICS_EVENTS), orderBy('createdAtTs', 'desc'), limit(maxEvents))
    );
    const list = snap.docs.map((d) => {
      const data = d.data() as AnalyticsEvent & { createdAtTs?: unknown };
      const { createdAtTs: _ignored, ...rest } = data;
      return { ...rest, id: rest.id || d.id } as AnalyticsEvent;
    });
    return list.reverse();
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function clearCloudAnalyticsEvents(): Promise<void> {
  const path = COLLECTION_ANALYTICS_EVENTS;
  try {
    const snap = await getDocs(collection(db, COLLECTION_ANALYTICS_EVENTS));
    await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Role-Aware Admin & Staff Real-Time Subscriptions
 */
export function subscribeAdminCollections(
  role: AdminRole,
  callbacks: {
    onApplications?: (apps: DealerApplication[]) => void;
    onAccounts?: (accounts: DealerAccount[]) => void;
    onOrders?: (orders: SavedDealerOrder[]) => void;
    onInquiries?: (inquiries: SavedInquiry[]) => void;
    onProductionQueue?: (queue: ProductionQueueItem[]) => void;
    onDailyLogs?: (logs: DailyProductionEntry[]) => void;
    onStaffAccounts?: (staff: AdminStaffAccount[]) => void;
    onCatalogSettings?: (settings: CloudCatalogSettingsPayload) => void;
    onCmsProducts?: (data: CloudCmsProductsPayload) => void;
    onCmsMediaCompany?: (data: CloudCmsMediaAndCompanyPayload) => void;
    onCmsSeoLegal?: (data: CloudCmsSeoAndLegalPayload) => void;
    onProductionState?: (data: CloudProductionStatePayload) => void;
    onServerSync?: (collectionName: string, fromCache: boolean) => void;
    onError?: (err: unknown) => void;
  }
): () => void {
  const unsubscribers: Array<() => void> = [];
  const normalizedRole = normalizeAdminRole(role);

  const getTimestampMs = (docData: Record<string, unknown>): number => {
    const ts = docData?.createdAtTs as { toMillis?: () => number; seconds?: number } | undefined;
    if (ts && typeof ts.toMillis === 'function') return ts.toMillis();
    if (ts && typeof ts.seconds === 'number') return ts.seconds * 1000;
    return 0;
  };

  // Full Admin only collections
  if (normalizedRole === 'admin') {
    if (callbacks.onApplications) {
      unsubscribers.push(
        onSnapshot(
          collection(db, COLLECTION_DEALER_APPLICATIONS),
          (snap) => {
            callbacks.onServerSync?.(COLLECTION_DEALER_APPLICATIONS, snap.metadata.fromCache);
            const list = snap.docs
              .map((d) => {
                const raw = d.data() as DealerApplication & Record<string, unknown>;
                return {
                  item: { ...raw, id: raw.id || d.id } as DealerApplication,
                  ms: getTimestampMs(raw)
                };
              })
              .sort((a, b) => (b.ms !== a.ms ? b.ms - a.ms : b.item.id > a.item.id ? 1 : -1))
              .map((entry) => entry.item);
            callbacks.onApplications?.(list);
          },
          (error) => {
            callbacks.onError?.(error);
            handleFirestoreError(error, OperationType.LIST, COLLECTION_DEALER_APPLICATIONS);
          }
        )
      );
    }

    if (callbacks.onAccounts) {
      unsubscribers.push(
        onSnapshot(
          collection(db, COLLECTION_DEALER_ACCOUNTS),
          (snap) => {
            callbacks.onServerSync?.(COLLECTION_DEALER_ACCOUNTS, snap.metadata.fromCache);
            const list = snap.docs.map((d) => {
              const data = d.data() as DealerAccount;
              return { ...data, id: data.id || d.id };
            });
            callbacks.onAccounts?.(list);
          },
          (error) => {
            callbacks.onError?.(error);
            handleFirestoreError(error, OperationType.LIST, COLLECTION_DEALER_ACCOUNTS);
          }
        )
      );
    }

    if (callbacks.onInquiries) {
      unsubscribers.push(
        onSnapshot(
          collection(db, COLLECTION_B2B_INQUIRIES),
          (snap) => {
            callbacks.onServerSync?.(COLLECTION_B2B_INQUIRIES, snap.metadata.fromCache);
            const list = snap.docs
              .map((d) => {
                const raw = d.data() as SavedInquiry & Record<string, unknown>;
                return {
                  item: { ...raw, id: raw.id || d.id } as SavedInquiry,
                  ms: getTimestampMs(raw)
                };
              })
              .sort((a, b) => (b.ms !== a.ms ? b.ms - a.ms : b.item.id > a.item.id ? 1 : -1))
              .map((entry) => entry.item);
            callbacks.onInquiries?.(list);
          },
          (error) => {
            callbacks.onError?.(error);
            handleFirestoreError(error, OperationType.LIST, COLLECTION_B2B_INQUIRIES);
          }
        )
      );
    }

    if (callbacks.onStaffAccounts) {
      unsubscribers.push(
        onSnapshot(
          collection(db, COLLECTION_STAFF_ACCOUNTS),
          (snap) => {
            callbacks.onServerSync?.(COLLECTION_STAFF_ACCOUNTS, snap.metadata.fromCache);
            const list = snap.docs.map((d) => {
              const data = d.data() as AdminStaffAccount;
              return {
                ...data,
                id: data.id || d.id,
                role: normalizeAdminRole(data.role)
              };
            });
            callbacks.onStaffAccounts?.(list);
          },
          (error) => {
            callbacks.onError?.(error);
            handleFirestoreError(error, OperationType.LIST, COLLECTION_STAFF_ACCOUNTS);
          }
        )
      );
    }
  }

  // Dealer orders: Admin & Sales
  if ((normalizedRole === 'admin' || normalizedRole === 'sales') && callbacks.onOrders) {
    unsubscribers.push(
      onSnapshot(
        collection(db, COLLECTION_DEALER_ORDERS),
        (snap) => {
          callbacks.onServerSync?.(COLLECTION_DEALER_ORDERS, snap.metadata.fromCache);
          const list = snap.docs
            .map((d) => {
              const raw = d.data() as SavedDealerOrder & Record<string, unknown>;
              return {
                item: { ...raw, id: raw.id || d.id } as SavedDealerOrder,
                ms: getTimestampMs(raw)
              };
            })
            .sort((a, b) => (b.ms !== a.ms ? b.ms - a.ms : b.item.id > a.item.id ? 1 : -1))
            .map((entry) => entry.item);
          callbacks.onOrders?.(list);
        },
        (error) => {
          callbacks.onError?.(error);
          handleFirestoreError(error, OperationType.LIST, COLLECTION_DEALER_ORDERS);
        }
      )
    );
  }

  // Production Queue & Daily Logs: Admin, Sales, Production Manager
  if (callbacks.onProductionQueue) {
    unsubscribers.push(
      onSnapshot(
        collection(db, COLLECTION_PRODUCTION_QUEUE),
        (snap) => {
          callbacks.onServerSync?.(COLLECTION_PRODUCTION_QUEUE, snap.metadata.fromCache);
          const list = snap.docs.map((d) => {
            const data = d.data() as ProductionQueueItem;
            return { ...data, id: data.id || d.id };
          });
          callbacks.onProductionQueue?.(list);
        },
        (error) => {
          callbacks.onError?.(error);
          handleFirestoreError(error, OperationType.LIST, COLLECTION_PRODUCTION_QUEUE);
        }
      )
    );
  }

  if (callbacks.onDailyLogs) {
    unsubscribers.push(
      onSnapshot(
        collection(db, COLLECTION_DAILY_PRODUCTION_LOGS),
        (snap) => {
          callbacks.onServerSync?.(COLLECTION_DAILY_PRODUCTION_LOGS, snap.metadata.fromCache);
          const list = snap.docs.map((d) => {
            const data = d.data() as DailyProductionEntry;
            return { ...data, id: data.id || d.id };
          });
          callbacks.onDailyLogs?.(list);
        },
        (error) => {
          callbacks.onError?.(error);
          handleFirestoreError(error, OperationType.LIST, COLLECTION_DAILY_PRODUCTION_LOGS);
        }
      )
    );
  }

  // Shared Settings & CMS docs
  if (callbacks.onCatalogSettings) {
    unsubscribers.push(
      onSnapshot(
        doc(db, COLLECTION_APP_SETTINGS, 'catalog_config'),
        (snap) => {
          callbacks.onServerSync?.(COLLECTION_APP_SETTINGS, snap.metadata.fromCache);
          if (snap.exists()) {
            callbacks.onCatalogSettings?.(snap.data() as CloudCatalogSettingsPayload);
          }
        },
        (error) => {
          callbacks.onError?.(error);
        }
      )
    );
  }

  if (callbacks.onProductionState) {
    unsubscribers.push(
      onSnapshot(
        doc(db, COLLECTION_APP_SETTINGS, 'production_state'),
        (snap) => {
          if (snap.exists()) {
            callbacks.onProductionState?.(snap.data() as CloudProductionStatePayload);
          }
        },
        () => {}
      )
    );
  }

  if (callbacks.onCmsProducts) {
    unsubscribers.push(
      onSnapshot(
        doc(db, COLLECTION_APP_SETTINGS, 'cms_products'),
        (snap) => {
          if (snap.exists()) {
            callbacks.onCmsProducts?.(snap.data() as CloudCmsProductsPayload);
          }
        },
        () => {}
      )
    );
  }

  if (normalizedRole === 'admin' && callbacks.onCmsMediaCompany) {
    unsubscribers.push(
      onSnapshot(
        doc(db, COLLECTION_APP_SETTINGS, 'cms_media_company'),
        (snap) => {
          if (snap.exists()) {
            callbacks.onCmsMediaCompany?.(snap.data() as CloudCmsMediaAndCompanyPayload);
          }
        },
        () => {}
      )
    );
  }

  if (normalizedRole === 'admin' && callbacks.onCmsSeoLegal) {
    unsubscribers.push(
      onSnapshot(
        doc(db, COLLECTION_APP_SETTINGS, 'cms_seo_legal'),
        (snap) => {
          if (snap.exists()) {
            callbacks.onCmsSeoLegal?.(snap.data() as CloudCmsSeoAndLegalPayload);
          }
        },
        () => {}
      )
    );
  }

  return () => {
    unsubscribers.forEach((u) => u());
  };
}

/**
 * Subscribe to a signed-in dealer's order feed in real time.
 */
export function subscribeDealerOrderFeed(
  credHash: string,
  onOrders: (orders: SavedDealerOrder[]) => void
): () => void {
  if (!credHash) return () => {};
  const path = `${COLLECTION_DEALER_ORDER_FEEDS}/${credHash}`;
  return onSnapshot(
    doc(db, COLLECTION_DEALER_ORDER_FEEDS, credHash),
    (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      if (Array.isArray(data?.orders)) {
        onOrders(data.orders as SavedDealerOrder[]);
      }
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}
