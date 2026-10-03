/** Pure money helpers for invoices: line/total maths, the GST split and the amount in words.
 * Kept free of Nest/Prisma so they can be unit-tested directly. */

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export interface InvoiceLineInput {
  quantity: number;
  unitRate: number;
  taxPercent: number;
}

export function computeLine(item: InvoiceLineInput) {
  const lineAmount = round2(item.quantity * item.unitRate);
  const lineTax = round2((lineAmount * item.taxPercent) / 100);
  return { lineAmount, lineTax, lineTotal: round2(lineAmount + lineTax) };
}

/** Same rules as the quotation: GST per line, grand total rounded to the rupee (the difference is
 * "roundoff"), advance rounded to the rupee and the balance is whatever remains. */
export function computeTotals(lines: { lineAmount: number; lineTax: number }[], advancePercent: number) {
  const subtotal = round2(lines.reduce((s, l) => s + l.lineAmount, 0));
  const gstAmount = round2(lines.reduce((s, l) => s + l.lineTax, 0));
  const rawTotal = subtotal + gstAmount;
  const totalAmount = Math.round(rawTotal);
  const roundoff = round2(totalAmount - rawTotal);
  const advanceAmount = Math.round((totalAmount * advancePercent) / 100);
  return { subtotal, gstAmount, roundoff, totalAmount, advanceAmount, beforeDispatchAmount: totalAmount - advanceAmount };
}

const norm = (state: string) => state.trim().toLowerCase().replace(/\s+/g, " ");

/** GST rule: seller and buyer in the same state -> CGST + SGST (half each); otherwise IGST. */
export function gstSplit(gstAmount: number, sellerState: string, buyerState: string) {
  const isIntraState = norm(sellerState) === norm(buyerState);
  if (!isIntraState) return { isIntraState, cgst: 0, sgst: 0, igst: gstAmount };
  const cgst = round2(gstAmount / 2);
  return { isIntraState, cgst, sgst: round2(gstAmount - cgst), igst: 0 };
}

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function below1000(n: number): string {
  const parts: string[] = [];
  if (n >= 100) {
    parts.push(`${ONES[Math.floor(n / 100)]} Hundred`);
    n %= 100;
  }
  if (n >= 20) parts.push(TENS[Math.floor(n / 10)] + (n % 10 ? ` ${ONES[n % 10]}` : ""));
  else if (n > 0) parts.push(ONES[n]);
  return parts.join(" ");
}

/** Indian numbering (thousand / lakh / crore): 123456.5 -> "Rupees One Lakh Twenty Three Thousand Four
 * Hundred Fifty Six and Fifty Paise Only". */
export function amountInWords(amount: number): string {
  const paiseTotal = Math.round(Math.abs(amount) * 100);
  const rupees = Math.floor(paiseTotal / 100);
  const paise = paiseTotal % 100;

  let n = rupees;
  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  const lakh = Math.floor(n / 100000);
  n %= 100000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;

  const parts: string[] = [];
  if (crore) parts.push(`${below1000(crore)} Crore`);
  if (lakh) parts.push(`${below1000(lakh)} Lakh`);
  if (thousand) parts.push(`${below1000(thousand)} Thousand`);
  if (n) parts.push(below1000(n));

  const rupeeWords = parts.length ? parts.join(" ") : "Zero";
  const paiseWords = paise ? ` and ${below1000(paise)} Paise` : "";
  return `Rupees ${rupeeWords}${paiseWords} Only`;
}
