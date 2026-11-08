// Turns the registry's "report_to" entries into call buttons.
// Phone text in the registry is written for people, e.g.
//   "705-742-7777 ext. 2802" or "311 (905-615-4311 outside city limits)",
// so we pull the dialable numbers out of it here.

import type { ReportContact } from "./registry";

export interface Call {
  label: string; // what the button shows
  tel: string; // what goes in the tel: link
}

export interface Contact {
  who: string;
  calls: Call[];
  /** Shown instead of a button when there is no number to dial. */
  note: string | null;
  isBank: boolean;
}

// (?<!\d) stops the "1" at the end of "311" being read as a country code.
const NANP = /(?<!\d)(?:\+?1[-.\s]?)?\(?(\d{3})\)?[-.\s]?(\d{3})[-.\s]?(\d{4})(?:\s*(?:ext\.?|x)\s*(\d+))?/gi;
const SHORT_CODE = /^([2-9]11)\b(?!-)/; // 211, 311, 411...

export function toCalls(phone: string): Call[] {
  const calls: Call[] = [];
  let text = phone.trim();

  const short = text.match(SHORT_CODE);
  if (short) {
    calls.push({ label: short[1], tel: short[1] });
    text = text.slice(short[0].length).replace(/^\s*\(/, "");
  }

  for (const m of text.matchAll(NANP)) {
    const [whole, area, mid, last, ext] = m;
    // A comma makes the phone wait a moment, then dial the extension.
    const tel = `+1${area}${mid}${last}${ext ? `,${ext}` : ""}`;
    // Keep words that follow inside brackets, e.g. "(905-615-4311 outside city limits)".
    const after = text.slice((m.index ?? 0) + whole.length).match(/^\s*([^)]*)\)/)?.[1]?.trim();
    const label = after ? `${whole.trim()} (${after})` : whole.trim();
    calls.push({ label, tel });
  }
  return calls;
}

export function toContacts(reportTo: ReportContact[]): Contact[] {
  const contacts = reportTo.map((r) => {
    const calls = toCalls(r.phone);
    return {
      who: r.who,
      calls,
      note: calls.length ? null : r.phone,
      isBank: /bank/i.test(r.who),
    };
  });
  // People you can call first; in-person-only entries last. The bank keeps its place.
  const rank = (c: Contact) => (c.calls.length || c.isBank ? 0 : 1);
  return contacts.map((c, i) => ({ c, i })).sort((a, b) => rank(a.c) - rank(b.c) || a.i - b.i).map((x) => x.c);
}

/** Turns what a person typed ("705 555 1234") into a tel: number. */
export function telFromInput(input: string): string | null {
  const digits = input.replace(/[^\d+]/g, "");
  if (digits.replace(/\D/g, "").length < 3) return null;
  if (/^\d{10}$/.test(digits)) return `+1${digits}`;
  if (/^1\d{10}$/.test(digits)) return `+${digits}`;
  return digits;
}
