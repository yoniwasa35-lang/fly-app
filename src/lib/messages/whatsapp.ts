/**
 * בניית קישור wa.me. סעיף 9: אין אינטגרציה ל-WhatsApp Business API ב-v1.
 * המערכת מכינה את ההודעה, הסוכן לוחץ שלח. עלות אפס, ושליטה מלאה אצל הסוכן.
 */

import { normalizePhone } from "./phone";

export type WhatsAppLink =
  | { ok: true; url: string; phoneDisplay: string }
  | { ok: false; reason: string };

/**
 * הטקסט מקודד ב-encodeURIComponent, שמייצר UTF-8 תקין לעברית ולתווי הבקרה
 * הבלתי נראים של הכיווניות. זו הנקודה שסעיף 14 מזהיר ממנה.
 */
export function whatsAppLink(phone: string, text: string): WhatsAppLink {
  const normalized = normalizePhone(phone);
  if (!normalized.ok) return { ok: false, reason: normalized.reason };

  const encoded = encodeURIComponent(text);

  // וואטסאפ חותך הודעות ארוכות מאוד בקישור. 4096 הוא גבול ההודעה עצמה.
  if (text.length > 4000) {
    return { ok: false, reason: `ההודעה ארוכה מדי (${text.length} תווים, המקסימום 4000)` };
  }

  return {
    ok: true,
    url: `https://wa.me/${normalized.e164}?text=${encoded}`,
    phoneDisplay: normalized.display,
  };
}
