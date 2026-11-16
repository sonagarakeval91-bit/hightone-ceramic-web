import {
  collection,
  doc,
  getDocFromServer,
  getDocsFromServer,
  limit,
  query
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  auth,
  db,
  getActiveFirestoreIdentity,
  OperationType,
  OWNER_ADMIN_EMAIL
} from '../firebase';
import {
  COLLECTION_ANALYTICS_EVENTS,
  COLLECTION_APP_SETTINGS,
  COLLECTION_B2B_INQUIRIES,
  COLLECTION_DAILY_PRODUCTION_LOGS,
  COLLECTION_DEALER_ACCOUNTS,
  COLLECTION_DEALER_APPLICATIONS,
  COLLECTION_DEALER_ORDERS,
  COLLECTION_PRODUCTION_QUEUE,
  COLLECTION_STAFF_ACCOUNTS,
  getAuthorizedCloudUserProfile
} from '../services/firestoreSyncService';
import { AdminRole } from '../types';

export type BackendConnectionState =
  | 'connected'
  | 'connecting'
  | 'local-only'
  | 'error'
  | 'offline';

export interface CollectionDiagnosticResult {
  collection: string;
  status: 'ok' | 'permission-denied' | 'offline' | 'error' | 'skipped';
  latencyMs: number;
  fromCache?: boolean;
  sampleDocCount?: number;
  error?: string;
}

export interface FirestoreDiagnosticReport {
  checkedAt: string;
  expectedProjectId: string;
  expectedDatabaseId: string;
  activeProjectId: string | null;
  activeDatabaseId: string | null;
  configMatches: boolean;
  backendConnected: boolean;
  isAuthenticatedAdmin: boolean;
  cloudRole: AdminRole | null;
  authEmail: string | null;
  overallLatencyMs: number;
  collections: CollectionDiagnosticResult[];
  summary: string;
}

export const GOOGLESHEET_MODAL_ADMIN_COLLECTIONS = [
  COLLECTION_DEALER_APPLICATIONS,
  COLLECTION_DEALER_ACCOUNTS,
  COLLECTION_DEALER_ORDERS,
  COLLECTION_B2B_INQUIRIES,
  COLLECTION_PRODUCTION_QUEUE,
  COLLECTION_DAILY_PRODUCTION_LOGS,
  COLLECTION_STAFF_ACCOUNTS,
  COLLECTION_ANALYTICS_EVENTS
] as const;

export const GOOGLESHEET_MODAL_COLLECTIONS = [
  ...GOOGLESHEET_MODAL_ADMIN_COLLECTIONS,
  COLLECTION_APP_SETTINGS
] as const;

function getRoleDiagnosticCollections(role: AdminRole | null): readonly string[] {
  if (role === 'admin') return GOOGLESHEET_MODAL_ADMIN_COLLECTIONS;
  if (role === 'sales') {
    return [
      COLLECTION_DEALER_ORDERS,
      COLLECTION_PRODUCTION_QUEUE,
      COLLECTION_DAILY_PRODUCTION_LOGS
    ];
  }
  if (role === 'production-manager') {
    return [COLLECTION_PRODUCTION_QUEUE, COLLECTION_DAILY_PRODUCTION_LOGS];
  }
  return [];
}

function classifyFirestoreProbeError(
  error: unknown,
  collectionPath: string
): { status: 'permission-denied' | 'offline' | 'error'; message: string } {
  const code = (error as { code?: string })?.code || '';
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  if (code === 'permission-denied' || lower.includes('missing or insufficient permissions')) {
    console.error(
      'Firestore Error: ',
      JSON.stringify({
        error: message,
        operationType: OperationType.LIST,
        path: collectionPath,
        authInfo: {
          userId: auth.currentUser?.uid,
          email: auth.currentUser?.email,
          emailVerified: auth.currentUser?.emailVerified
        }
      })
    );
    return { status: 'permission-denied', message };
  }

  if (
    code === 'unavailable' ||
    lower.includes('the client is offline') ||
    lower.includes('failed to get document because the client is offline') ||
    lower.includes('network')
  ) {
    return { status: 'offline', message };
  }

  return { status: 'error', message };
}

/**
 * Diagnostic utility to verify that GoogleSheetModal queries target the exact
 * Firestore project & database ID defined in firebase-applet-config.json and
 * confirm live server reachability across monitored collections.
 */
export async function verifyGoogleSheetModalFirestoreConnection(): Promise<FirestoreDiagnosticReport> {
  const startedAt = performance.now();
  const checkedAt = new Date().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  const expectedProjectId = firebaseConfig.projectId;
  const expectedDatabaseId = firebaseConfig.firestoreDatabaseId;
  const activeIdentity = getActiveFirestoreIdentity();

  const configMatches =
    activeIdentity.projectId === expectedProjectId &&
    activeIdentity.databaseId === expectedDatabaseId;

  const currentUser = auth.currentUser;
  const authEmail = currentUser?.email ?? null;
  const cloudProfile = currentUser
    ? await getAuthorizedCloudUserProfile(
        currentUser.uid,
        currentUser.email,
        currentUser.emailVerified
      )
    : null;
  const isAuthenticatedAdmin = Boolean(cloudProfile?.allowed);
  const cloudRole: AdminRole | null = cloudProfile?.allowed ? cloudProfile.role : null;

  const isBrowserOnline =
    typeof navigator === 'undefined' ? true : navigator.onLine;

  const collections: CollectionDiagnosticResult[] = [];

  if (!isBrowserOnline) {
    for (const col of GOOGLESHEET_MODAL_COLLECTIONS) {
      collections.push({
        collection: col,
        status: 'offline',
        latencyMs: 0,
        error: 'Browser is currently offline.'
      });
    }
    return {
      checkedAt,
      expectedProjectId,
      expectedDatabaseId,
      activeProjectId: activeIdentity.projectId,
      activeDatabaseId: activeIdentity.databaseId,
      configMatches,
      backendConnected: false,
      isAuthenticatedAdmin,
      cloudRole,
      authEmail,
      overallLatencyMs: Math.round(performance.now() - startedAt),
      collections,
      summary: 'Browser is offline — cannot reach Firestore backend.'
    };
  }

  // 1. Verify live backend server connectivity on publicly readable app_settings CMS docs
  const settingsProbeStart = performance.now();
  let publicServerReachable = false;
  try {
    const publicSettingDocs = ['catalog_config', 'cms_products', 'cms_media_company', 'cms_seo_legal'];
    const snaps = await Promise.all(
      publicSettingDocs.map((docId) => getDocFromServer(doc(db, COLLECTION_APP_SETTINGS, docId)))
    );
    publicServerReachable = true;
    const existingCount = snaps.filter((s) => s.exists()).length;
    collections.push({
      collection: COLLECTION_APP_SETTINGS,
      status: 'ok',
      latencyMs: Math.round(performance.now() - settingsProbeStart),
      fromCache: snaps.some((s) => s.metadata.fromCache),
      sampleDocCount: existingCount
    });
  } catch (err) {
    const classified = classifyFirestoreProbeError(
      err,
      `${COLLECTION_APP_SETTINGS}/catalog_config`
    );
    collections.push({
      collection: COLLECTION_APP_SETTINGS,
      status: classified.status,
      latencyMs: Math.round(performance.now() - settingsProbeStart),
      error: classified.message
    });
  }

  // 2. Verify role-authorized collections queried by GoogleSheetModal
  const roleCols = getRoleDiagnosticCollections(cloudRole);
  if (isAuthenticatedAdmin && roleCols.length > 0) {
    const roleSet = new Set(roleCols);
    const adminChecks = await Promise.all(
      GOOGLESHEET_MODAL_ADMIN_COLLECTIONS.map(async (colName): Promise<CollectionDiagnosticResult> => {
        if (!roleSet.has(colName)) {
          return {
            collection: colName,
            status: 'skipped',
            latencyMs: 0,
            error: `Restricted to higher role (${cloudRole} does not require this collection).`
          };
        }
        const probeStart = performance.now();
        try {
          const snap = await getDocsFromServer(
            query(collection(db, colName), limit(1))
          );
          return {
            collection: colName,
            status: 'ok',
            latencyMs: Math.round(performance.now() - probeStart),
            fromCache: snap.metadata.fromCache,
            sampleDocCount: snap.size
          };
        } catch (err) {
          const classified = classifyFirestoreProbeError(err, colName);
          return {
            collection: colName,
            status: classified.status,
            latencyMs: Math.round(performance.now() - probeStart),
            error: classified.message
          };
        }
      })
    );
    collections.unshift(...adminChecks);
  } else {
    for (const colName of GOOGLESHEET_MODAL_ADMIN_COLLECTIONS.slice().reverse()) {
      collections.unshift({
        collection: colName,
        status: 'skipped',
        latencyMs: 0,
        error: `Sign in with Google (${OWNER_ADMIN_EMAIL} or authorized staff email) to verify role collection queries.`
      });
    }
  }

  const failingResults = collections.filter(
    (c) => c.status === 'permission-denied' || c.status === 'offline' || c.status === 'error'
  );
  const backendConnected =
    configMatches && publicServerReachable && failingResults.length === 0;

  let summary = '';
  if (!configMatches) {
    summary = `Database mismatch: active (${activeIdentity.projectId}/${activeIdentity.databaseId}) differs from firebase-applet-config.json (${expectedProjectId}/${expectedDatabaseId}).`;
  } else if (failingResults.length > 0) {
    summary = `${failingResults.length} Firestore check(s) failed (${failingResults.map((f) => f.collection).join(', ')}).`;
  } else if (isAuthenticatedAdmin) {
    const okCount = collections.filter((c) => c.status === 'ok').length;
    const expectedCount = roleCols.length + 1;
    summary = `Verified ${okCount}/${expectedCount} collections (${cloudRole}) on database ${expectedDatabaseId}.`;
  } else if (publicServerReachable) {
    summary = `Backend database ${expectedDatabaseId} is reachable; Google sign-in required for private role collections.`;
  } else {
    summary = `Could not reach backend database ${expectedDatabaseId}.`;
  }

  return {
    checkedAt,
    expectedProjectId,
    expectedDatabaseId,
    activeProjectId: activeIdentity.projectId,
    activeDatabaseId: activeIdentity.databaseId,
    configMatches,
    backendConnected,
    isAuthenticatedAdmin,
    cloudRole,
    authEmail,
    overallLatencyMs: Math.round(performance.now() - startedAt),
    collections,
    summary
  };
}

declare global {
  interface Window {
    __htcVerifyFirestore?: () => Promise<FirestoreDiagnosticReport>;
  }
}

if (typeof window !== 'undefined') {
  window.__htcVerifyFirestore = verifyGoogleSheetModalFirestoreConnection;
}
