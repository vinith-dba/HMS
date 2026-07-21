/**
 * Rupees in words, Indian numbering (lakh / crore) — every printed GST bill
 * in India carries this line. "₹1,234.50" -> "One Thousand Two Hundred and
 * Thirty Four Rupees and Fifty Paise Only".
 */
const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n];
  return `${TENS[Math.floor(n / 10)]}${n % 10 ? " " + ONES[n % 10] : ""}`;
}
function threeDigits(n: number): string {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  return `${h ? ONES[h] + " Hundred" : ""}${h && rest ? " and " : ""}${rest ? twoDigits(rest) : ""}`;
}

export function amountInWords(value: string | number): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (!isFinite(num) || num < 0) return "";
  const rupees = Math.floor(num);
  const paise = Math.round((num - rupees) * 100);

  if (rupees === 0 && paise === 0) return "Zero Rupees Only";

  // Indian grouping: crore (1e7), lakh (1e5), thousand (1e3), then hundreds.
  const crore = Math.floor(rupees / 1e7);
  const lakh = Math.floor((rupees % 1e7) / 1e5);
  const thousand = Math.floor((rupees % 1e5) / 1e3);
  const below = rupees % 1e3;

  const parts: string[] = [];
  if (crore) parts.push(`${twoDigits(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (below) parts.push(threeDigits(below));

  let words = parts.join(" ").trim();
  words = words ? `${words} Rupees` : "";
  if (paise) words += `${words ? " and " : ""}${twoDigits(paise)} Paise`;
  return `${words} Only`;
}
