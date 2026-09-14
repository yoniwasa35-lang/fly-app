/**
 * נרמול מספרי טלפון לפורמט שקישור wa.me מבין: ספרות בלבד, עם קידומת מדינה
 * ובלי סימן פלוס. ברירת המחדל היא ישראל, כי זה מה שהסוכן מקליד.
 */

const DEFAULT_COUNTRY = "972";

export type NormalizedPhone =
  | { ok: true; e164: string; display: string }
  | { ok: false; reason: string };

export function normalizePhone(raw: string, defaultCountry = DEFAULT_COUNTRY): NormalizedPhone {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) return { ok: false, reason: "לא הוזן טלפון" };

  // משאירים רק ספרות ופלוס מוביל. רווחים, מקפים, סוגריים ונקודות נעלמים.
  const hasPlus = trimmed.startsWith("+");
  let digits = trimmed.replace(/\D/g, "");

  if (!digits) return { ok: false, reason: `לא נמצאו ספרות במספר "${trimmed}"` };

  if (!hasPlus) {
    if (digits.startsWith("00")) {
      digits = digits.slice(2); // חיוג בינלאומי בסגנון 00972
    } else if (digits.startsWith("0")) {
      digits = defaultCountry + digits.slice(1); // 050... → 97250...
    } else if (digits.length === 9 && defaultCountry === "972") {
      digits = defaultCountry + digits; // 50... בלי אפס מוביל
    }
  }

  if (digits.length < 8 || digits.length > 15) {
    return { ok: false, reason: `המספר "${trimmed}" לא נראה תקין (${digits.length} ספרות)` };
  }

  return { ok: true, e164: digits, display: `+${digits}` };
}
