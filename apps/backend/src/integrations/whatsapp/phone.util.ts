/** WhatsApp Cloud API expects a bare E.164 digit string, no leading "+". Lead phone numbers in
 * this app are India-only free-text (sometimes with a leading 0 or +91, sometimes bare 10-digit),
 * so this normalizes to the common cases rather than attempting general E.164 parsing. */
export function normalizeWhatsAppPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `91${digits.slice(1)}`;
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  return digits;
}
