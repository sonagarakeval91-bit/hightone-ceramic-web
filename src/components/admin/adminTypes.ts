export type AdminSectionId =
  | 'dashboard'
  | 'dealer-order-dashboard'
  | 'dealers'
  | 'dealer-orders'
  | 'production'
  | 'inquiries'
  | 'product-config'
  | 'colors-codes'
  | 'collection-order'
  | 'insights'
  | 'seo'
  | 'blog'
  | 'cms'
  | 'location'
  | 'security';

export interface AdminNavItem {
  id: AdminSectionId;
  label: string;
  group: 'Overview' | 'Sales & Orders' | 'Catalog Setup' | 'Digital & Insights' | 'System & Plant';
  description: string;
  count?: number;
}

export interface ConfirmDialogConfig {
  title: string;
  message: string;
  confirmLabel: string;
  tone?: 'danger' | 'warning' | 'primary';
  onConfirm: () => void;
}
