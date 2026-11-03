/**
 * Centralized utility functions for phone numbers, dial links, and WhatsApp links.
 * Works seamlessly with mobile numbers added or updated in Google Sheets.
 */

export const DEFAULT_PRIMARY_PHONE = '+91 84859 59884';
export const DEFAULT_SECONDARY_PHONE = '+91 76003 41434';

/**
 * Extracts clean digits and returns a standardized tel: protocol string.
 * Example: "+91 84859 59884" -> "tel:+918485959884"
 * Example: "8485959884" -> "tel:+918485959884"
 */
export function sanitizePhoneForTel(phone?: string, fallback = DEFAULT_PRIMARY_PHONE): string {
  const target = (phone && phone.trim()) ? phone.trim() : fallback;
  // If multiple numbers are in the same string, take the first one
  const first = target.split(/[/,;|\n]|(\sand\s)/i)[0].trim();
  const digits = first.replace(/\D/g, '');

  if (!digits) return `tel:+918485959884`;

  // Standardize Indian and International formats
  if (first.startsWith('+')) {
    return `tel:+${digits}`;
  }
  if (digits.length === 10) {
    return `tel:+91${digits}`;
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return `tel:+91${digits.slice(1)}`;
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    return `tel:+${digits}`;
  }
  return `tel:+${digits}`;
}

/**
 * Extracts clean digits for WhatsApp wa.me links (without plus sign or spaces).
 * Example: "+91 84859 59884" -> "918485959884"
 * Example: "8485959884" -> "918485959884"
 */
export function sanitizePhoneForWhatsApp(phone?: string, fallback = DEFAULT_PRIMARY_PHONE): string {
  const target = (phone && phone.trim()) ? phone.trim() : fallback;
  const first = target.split(/[/,;|\n]|(\sand\s)/i)[0].trim();
  const digits = first.replace(/\D/g, '');

  if (!digits) return '918485959884';

  if (digits.length === 10) {
    return `91${digits}`;
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return `91${digits.slice(1)}`;
  }
  return digits;
}

/**
 * Formats a phone number for user-friendly display in UI labels and buttons.
 * Example: "918485959884" -> "+91 84859 59884"
 */
export function formatDisplayPhone(phone?: string, fallback = DEFAULT_PRIMARY_PHONE): string {
  const target = (phone && phone.trim()) ? phone.trim() : fallback;
  const digits = target.replace(/\D/g, '');

  // If already formatted nicely with spaces or international code
  if (target.includes(' ') || target.includes('-')) {
    return target;
  }

  // Format 10 digit Indian number: 8485959884 -> +91 84859 59884
  if (digits.length === 10) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }

  // Format 12 digit with 91: 918485959884 -> +91 84859 59884
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }

  return target;
}
