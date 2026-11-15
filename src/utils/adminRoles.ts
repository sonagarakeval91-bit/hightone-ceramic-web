import {
  AdminPermission,
  AdminRole,
  AdminStaffAccount,
  CeramicGrade,
  CeramicPacking,
  MergedOrderRequirement,
  ProductionQueueItem,
  SavedDealerOrder
} from '../types';
import { AdminSectionId } from '../components/admin/adminTypes';

export const STORAGE_KEY_STAFF_ACCOUNTS = 'hightone_admin_staff_accounts';
export const STORAGE_KEY_ADMIN_SESSION = 'htc_sheet_admin_session_info';

export interface RoleMeta {
  id: AdminRole;
  label: string;
  shortLabel: string;
  summary: string;
  permissions: AdminPermission[];
  allowedSections: AdminSectionId[];
}

export function normalizeAdminRole(role?: string): AdminRole {
  switch (role) {
    case 'admin':
    case 'owner':
      return 'admin';
    case 'production-manager':
    case 'production-supervisor':
      return 'production-manager';
    case 'sales':
    case 'order-manager':
    case 'catalog-editor':
      return 'sales';
    default:
      return 'sales';
  }
}

export const ROLE_DEFINITIONS: Record<AdminRole, RoleMeta> = {
  admin: {
    id: 'admin',
    label: 'Admin',
    shortLabel: 'Admin',
    summary:
      'Full control over dealer KYC verification & accounts, order approval/rejection, order & inquiry deletion, production logs, catalog weights, digital SEO, and staff RBAC.',
    permissions: [
      'orders:verify',
      'orders:edit',
      'orders:complete',
      'orders:delete',
      'dealers:manage',
      'inquiries:manage',
      'inquiries:delete',
      'production:log',
      'production:check',
      'production:queue',
      'catalog:edit',
      'digital:edit',
      'system:cms',
      'system:location',
      'system:security'
    ],
    allowedSections: [
      'dashboard',
      'dealer-order-dashboard',
      'dealers',
      'dealer-orders',
      'production',
      'inquiries',
      'product-config',
      'colors-codes',
      'collection-order',
      'insights',
      'seo',
      'cms',
      'location',
      'security'
    ]
  },
  'production-manager': {
    id: 'production-manager',
    label: 'Production Manager',
    shortLabel: 'Production Manager',
    summary:
      'Production Tracker only: log daily factory output, edit production entries, and check ready items.',
    permissions: ['production:log', 'production:check'],
    allowedSections: ['production']
  },
  sales: {
    id: 'sales',
    label: 'Sales',
    shortLabel: 'Sales',
    summary:
      'Dealer Orders (verify order availability, send unavailable items to Production, export PDF/CSV with contact masked) and Production Tracker (view progress only).',
    permissions: ['orders:verify'],
    allowedSections: ['dealer-orders', 'dealer-order-dashboard', 'production']
  }
};

export function hasPermission(role: AdminRole, permission: AdminPermission): boolean {
  const normalized = normalizeAdminRole(role);
  return ROLE_DEFINITIONS[normalized]?.permissions.includes(permission) ?? false;
}

export function canAccessSection(role: AdminRole, section: AdminSectionId): boolean {
  const normalized = normalizeAdminRole(role);
  return ROLE_DEFINITIONS[normalized]?.allowedSections.includes(section) ?? false;
}

export function getDefaultSectionForRole(role: AdminRole): AdminSectionId {
  const normalized = normalizeAdminRole(role);
  return ROLE_DEFINITIONS[normalized]?.allowedSections[0] ?? 'production';
}

export function getStaffAccounts(): AdminStaffAccount[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_STAFF_ACCOUNTS);
    if (!raw) return [];
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list.map((acc) => ({
      ...acc,
      role: normalizeAdminRole(acc?.role)
    }));
  } catch {
    return [];
  }
}

export function saveStaffAccounts(accounts: AdminStaffAccount[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_STAFF_ACCOUNTS, JSON.stringify(accounts));
  } catch (err) {
    console.error('Failed to save staff accounts:', err);
  }
}

export function makeProductionVariantKey(
  productId: string,
  grade: CeramicGrade | string,
  packing: CeramicPacking | string,
  codeOrColor: string
): string {
  return `${productId}::${grade || 'Uty'}::${packing || 'Box'}::${(codeOrColor || 'White').trim()}`;
}

export function getEffectiveVerificationStatus(
  order: SavedDealerOrder
): 'pending' | 'accepted' | 'rejected' {
  if (order.verificationStatus) return order.verificationStatus;
  if (order.status === 'completed' || order.completed) return 'accepted';
  return 'pending';
}

export function isOrderCompleted(order: SavedDealerOrder): boolean {
  return Boolean(order.completed) || order.status === 'completed';
}

/**
 * Consolidates all Accepted, non-completed dealer orders into a single sheet
 * grouped strictly by Product + Grade + Packing + Color/Code.
 */
export function buildMergedOrderRequirements(orders: SavedDealerOrder[]): MergedOrderRequirement[] {
  const map = new Map<string, MergedOrderRequirement>();

  orders.forEach((ord) => {
    const verStatus = getEffectiveVerificationStatus(ord);
    if (verStatus !== 'accepted' || isOrderCompleted(ord)) return;

    const personName =
      ord.personName || ord.dealerInfo?.contactPerson || ord.dealerInfo?.firmName || 'Dealer';
    const firmName = ord.dealerInfo?.firmName || '';
    const orderCode = ord.orderId || ord.id;

    (ord.items || []).forEach((item) => {
      const grade: CeramicGrade = item.grade || 'Uty';
      const packing: CeramicPacking = item.packing || 'Box';
      const unitWeightKg = item.unitWeightKg || 15;
      const splits =
        item.colorSplits && item.colorSplits.length > 0
          ? item.colorSplits
          : [{ codeOrColor: 'White', quantity: item.totalQuantity || 0 }];

      splits.forEach((split) => {
        if (!split.quantity || split.quantity <= 0) return;
        const codeOrColor = (split.codeOrColor || 'White').trim();
        const itemKey = makeProductionVariantKey(item.productId, grade, packing, codeOrColor);

        const existing = map.get(itemKey);
        const addedWeight = split.quantity * unitWeightKg;

        if (!existing) {
          map.set(itemKey, {
            itemKey,
            productId: item.productId,
            productName: item.name,
            grade,
            packing,
            codeOrColor,
            totalOrderedQty: split.quantity,
            unitWeightKg,
            totalWeightKg: addedWeight,
            earliestDueDate: ord.requiredDate || undefined,
            contributingOrders: [
              {
                id: ord.id,
                orderId: orderCode,
                firmName,
                personName,
                quantity: split.quantity,
                requiredDate: ord.requiredDate,
                requiredPeriod: ord.requiredPeriod
              }
            ]
          });
        } else {
          existing.totalOrderedQty += split.quantity;
          existing.totalWeightKg += addedWeight;
          if (ord.requiredDate) {
            if (!existing.earliestDueDate || ord.requiredDate < existing.earliestDueDate) {
              existing.earliestDueDate = ord.requiredDate;
            }
          }
          const sameOrder = existing.contributingOrders.find((c) => c.id === ord.id);
          if (sameOrder) {
            sameOrder.quantity += split.quantity;
          } else {
            existing.contributingOrders.push({
              id: ord.id,
              orderId: orderCode,
              firmName,
              personName,
              quantity: split.quantity,
              requiredDate: ord.requiredDate,
              requiredPeriod: ord.requiredPeriod
            });
          }
        }
      });
    });
  });

  return Array.from(map.values()).sort((a, b) => {
    if (a.earliestDueDate && b.earliestDueDate && a.earliestDueDate !== b.earliestDueDate) {
      return a.earliestDueDate.localeCompare(b.earliestDueDate);
    }
    if (a.earliestDueDate && !b.earliestDueDate) return -1;
    if (!a.earliestDueDate && b.earliestDueDate) return 1;
    return b.totalOrderedQty - a.totalOrderedQty;
  });
}

/**
 * Consolidates explicit Production Queue items (unavailable items routed from verified orders
 * or manually added by Admin in Production Tracker) grouped by Product + Grade + Packing + Color/Code.
 */
export function buildProductionManufactureTargets(
  queueItems: ProductionQueueItem[],
  orders: SavedDealerOrder[]
): MergedOrderRequirement[] {
  const orderById = new Map<string, SavedDealerOrder>();
  orders.forEach((o) => orderById.set(o.id, o));

  const map = new Map<string, MergedOrderRequirement>();

  queueItems.forEach((entry) => {
    if (!entry.quantityToMake || entry.quantityToMake <= 0) return;

    // If tied to an order that still exists, skip if order is rejected or marked completed
    if (entry.sourceOrderId) {
      const linked = orderById.get(entry.sourceOrderId);
      if (linked) {
        const ver = getEffectiveVerificationStatus(linked);
        if (ver === 'rejected' || isOrderCompleted(linked)) return;
      }
    }

    const grade: CeramicGrade = entry.grade || 'Uty';
    const packing: CeramicPacking = entry.packing || 'Box';
    const codeOrColor = (entry.codeOrColor || 'White').trim();
    const itemKey = entry.itemKey || makeProductionVariantKey(entry.productId, grade, packing, codeOrColor);
    const unitWeightKg = entry.unitWeightKg || 15;
    const addedWeight = entry.quantityToMake * unitWeightKg;

    const labelName =
      entry.sourceType === 'manual-catalog'
        ? entry.firmName || entry.dealerName || 'Manual Stock Build'
        : entry.firmName && entry.dealerName && entry.firmName !== entry.dealerName
        ? `${entry.firmName} (${entry.dealerName})`
        : entry.firmName || entry.dealerName || 'Dealer';

    const orderRef = entry.sourceOrderCode || (entry.sourceType === 'manual-catalog' ? 'Manual Entry' : 'Order Shortage');

    const existing = map.get(itemKey);
    if (!existing) {
      map.set(itemKey, {
        itemKey,
        productId: entry.productId,
        productName: entry.productName,
        grade,
        packing,
        codeOrColor,
        totalOrderedQty: entry.quantityToMake,
        unitWeightKg,
        totalWeightKg: addedWeight,
        earliestDueDate: entry.requiredDate || undefined,
        contributingOrders: [
          {
            id: entry.id,
            orderId: orderRef,
            firmName: entry.firmName,
            personName: labelName,
            quantity: entry.quantityToMake,
            requiredDate: entry.requiredDate,
            requiredPeriod: entry.requiredPeriod
          }
        ],
        queueEntries: [entry]
      });
    } else {
      existing.totalOrderedQty += entry.quantityToMake;
      existing.totalWeightKg += addedWeight;
      if (entry.requiredDate) {
        if (!existing.earliestDueDate || entry.requiredDate < existing.earliestDueDate) {
          existing.earliestDueDate = entry.requiredDate;
        }
      }
      existing.contributingOrders.push({
        id: entry.id,
        orderId: orderRef,
        firmName: entry.firmName,
        personName: labelName,
        quantity: entry.quantityToMake,
        requiredDate: entry.requiredDate,
        requiredPeriod: entry.requiredPeriod
      });
      existing.queueEntries = [...(existing.queueEntries || []), entry];
    }
  });

  return Array.from(map.values()).sort((a, b) => {
    if (a.earliestDueDate && b.earliestDueDate && a.earliestDueDate !== b.earliestDueDate) {
      return a.earliestDueDate.localeCompare(b.earliestDueDate);
    }
    if (a.earliestDueDate && !b.earliestDueDate) return -1;
    if (!a.earliestDueDate && b.earliestDueDate) return 1;
    return b.totalOrderedQty - a.totalOrderedQty;
  });
}

export function formatDeliveryDateLabel(dateStr?: string): string {
  if (!dateStr) return '—';
  const parsed = new Date(`${dateStr}T00:00:00`);
  if (isNaN(parsed.getTime())) return dateStr;
  return parsed.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

export function downloadMergedRequirementsCSV(requirements: MergedOrderRequirement[]): void {
  if (requirements.length === 0) return;

  const escapeCSV = (val: string | number | undefined | null) => {
    if (val === undefined || val === null) return '""';
    return `"${String(val).replace(/"/g, '""')}"`;
  };

  const headers = [
    'Sr. No.',
    'Product Name',
    'Grade',
    'Packing',
    'Color / Design Code',
    'Total Required Qty (Units)',
    'Total Weight (kg)',
    'Earliest Required Date',
    'Dealer Breakdown'
  ];

  const rows = requirements.map((req, idx) => [
    escapeCSV(idx + 1),
    escapeCSV(req.productName),
    escapeCSV(req.grade),
    escapeCSV(req.packing),
    escapeCSV(req.codeOrColor),
    escapeCSV(req.totalOrderedQty),
    escapeCSV(req.totalWeightKg.toFixed(1)),
    escapeCSV(req.earliestDueDate ? formatDeliveryDateLabel(req.earliestDueDate) : 'Not specified'),
    escapeCSV(
      req.contributingOrders
        .map(
          (c) =>
            `${c.personName} (${c.orderId}): ${c.quantity} pcs${
              c.requiredDate ? ` by ${formatDeliveryDateLabel(c.requiredDate)}` : ''
            }`
        )
        .join(' | ')
    )
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `Hightone_Merged_Order_Requirements_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function printMergedRequirementsSheet(requirements: MergedOrderRequirement[]): boolean {
  const printWindow = window.open('', '_blank', 'width=960,height=1150');
  if (!printWindow) return false;

  const totalUnits = requirements.reduce((s, r) => s + r.totalOrderedQty, 0);
  const totalWeight = requirements.reduce((s, r) => s + r.totalWeightKg, 0);

  const rowsHtml = requirements
    .map(
      (req, idx) => `
      <tr>
        <td style="border:1px solid #000;padding:6px;text-align:center;font-weight:700;">${idx + 1}</td>
        <td style="border:1px solid #000;padding:6px;font-weight:700;">${req.productName}</td>
        <td style="border:1px solid #000;padding:6px;text-align:center;">${req.grade}</td>
        <td style="border:1px solid #000;padding:6px;text-align:center;">${req.packing}</td>
        <td style="border:1px solid #000;padding:6px;text-align:center;font-weight:600;">${req.codeOrColor}</td>
        <td style="border:1px solid #000;padding:6px;text-align:right;font-family:monospace;font-weight:800;">${req.totalOrderedQty}</td>
        <td style="border:1px solid #000;padding:6px;text-align:right;font-family:monospace;">${req.totalWeightKg.toFixed(1)} kg</td>
        <td style="border:1px solid #000;padding:6px;">
          ${req.contributingOrders
            .map(
              (c) =>
                `${c.personName}: <strong>${c.quantity}</strong>${
                  c.requiredDate ? ` (${formatDeliveryDateLabel(c.requiredDate)})` : ''
                }`
            )
            .join('<br/>')}
        </td>
      </tr>`
    )
    .join('');

  const html = `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <title>Merged Order Requirements Sheet</title>
    <style>
      @page { size: A4 landscape; margin: 12mm; }
      body { font-family: Arial, sans-serif; color: #000; margin: 0; padding: 14px; font-size: 11px; }
      .header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 12px; border-bottom: 2px solid #000; padding-bottom: 8px; }
      table { width: 100%; border-collapse: collapse; }
      th { border: 1px solid #000; background: #f1f5f9; padding: 7px 6px; font-size: 10px; text-transform: uppercase; }
      .no-print { background: #0F2E52; color: #fff; padding: 10px 14px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center; border-radius: 4px; }
      .no-print button { border: none; padding: 6px 14px; font-weight: 700; font-size: 12px; border-radius: 3px; cursor: pointer; }
      @media print { .no-print { display: none !important; } body { padding: 0; } }
    </style>
  </head>
  <body>
    <div class="no-print">
      <span style="font-weight:700;">Hightone Ceramic · Merged Accepted Order Requirements</span>
      <div style="display:flex;gap:8px;">
        <button onclick="window.print()" style="background:#25D366;color:#fff;">Print / Save PDF</button>
        <button onclick="window.close()" style="background:#334155;color:#fff;">Close</button>
      </div>
    </div>
    <div class="header">
      <div>
        <strong style="font-size:15px;">MERGED ACCEPTED ORDER REQUIREMENTS SHEET</strong><br/>
        <span>Grouped by Product · Grade · Packing · Color / Design Code</span>
      </div>
      <div style="text-align:right;font-family:monospace;">
        Generated: ${new Date().toLocaleDateString('en-IN')}<br/>
        <strong>Total: ${totalUnits} Units · ${totalWeight.toFixed(1)} kg</strong>
      </div>
    </div>
    <table>
      <thead>
        <tr>
          <th>Sr.</th>
          <th style="text-align:left;">Product</th>
          <th>Grade</th>
          <th>Packing</th>
          <th>Color / Code</th>
          <th style="text-align:right;">Required Qty</th>
          <th style="text-align:right;">Weight</th>
          <th style="text-align:left;">Dealer Breakdown &amp; Target Date</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>
    <script>window.onload = function(){ setTimeout(function(){ window.print(); }, 300); };</script>
  </body>
  </html>`;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  return true;
}
