/**
 * פרטי המלון.
 *
 * הכלל שמנהל את הקובץ הזה: **לא ממציאים כלום**. כתובת אתר שלא הוזנה
 * ולא הוחזרה ממקור אמין נשארת ריקה, ובעמוד הלקוח פשוט אין כפתור. לקוח
 * שילחץ על אתר שגוי שדקה לפני הנחיתה — זה נזק, לא אי-נוחות קטנה.
 *
 * קישור המפה הוא היחיד שנבנה כאן, והוא לא המצאה: הוא חיפוש בגוגל מפות
 * לפי מה שידוע — מזהה מקום אם יש, אחרת כתובת, אחרת שם המלון והיעד. גם
 * כשאין כלום, מה שנפתח הוא חיפוש ולא כתובת שקרית.
 */

export const BOARD_BASES = [
  "room_only",
  "breakfast",
  "half_board",
  "full_board",
  "all_inclusive",
] as const;

export type BoardBasis = (typeof BOARD_BASES)[number];

export const BOARD_BASIS_HE: Record<BoardBasis, string> = {
  room_only: "לינה בלבד",
  breakfast: "ארוחת בוקר",
  half_board: "חצי פנסיון",
  full_board: "פנסיון מלא",
  all_inclusive: "הכול כלול",
};

export function isBoardBasis(v: unknown): v is BoardBasis {
  return typeof v === "string" && (BOARD_BASES as readonly string[]).includes(v);
}

/**
 * כתובת חיצונית מתקבלת רק אם היא http(s) מלאה.
 *
 * javascript: ו-data: הם וקטור אמיתי בעמוד שנפתח בלי התחברות, ו"www.x.com"
 * בלי סכימה נפתח כנתיב יחסי בתוך האתר שלנו ומוביל לשום מקום. שניהם
 * נדחים כאן ולא בתצוגה, כדי שלא יישמרו מלכתחילה.
 */
export function safeExternalUrl(raw: string | null | undefined): string | null {
  const v = raw?.trim();
  if (!v) return null;
  try {
    const u = new URL(v);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** האם המחרוזת ראויה לשמירה ככתובת אתר. הודעת שגיאה לסוכן, לא השתקה. */
export function describeUrlProblem(raw: string): string | null {
  if (!raw.trim()) return null;
  if (safeExternalUrl(raw)) return null;
  if (!/^https?:\/\//i.test(raw.trim())) {
    return "כתובת האתר חייבת להתחיל ב-https://";
  }
  return "כתובת האתר לא תקינה";
}

export type MapTarget = {
  name: string;
  address?: string | null;
  placeId?: string | null;
  lat?: number | null;
  lng?: number | null;
  /** נופלים אליו כשאין כתובת — "Hilton Batumi, באטומי" הוא חיפוש טוב. */
  destination?: string | null;
};

export function mapUrl(t: MapTarget): string {
  const base = "https://www.google.com/maps/search/?api=1";

  // מזהה מקום הוא התשובה המדויקת ביותר, וגוגל דורש לצידו גם query.
  if (t.placeId) {
    return `${base}&query=${encodeURIComponent(t.name)}&query_place_id=${encodeURIComponent(t.placeId)}`;
  }

  if (typeof t.lat === "number" && typeof t.lng === "number") {
    return `${base}&query=${encodeURIComponent(`${t.lat},${t.lng}`)}`;
  }

  const query = [t.name, t.address || t.destination].filter(Boolean).join(", ");
  return `${base}&query=${encodeURIComponent(query)}`;
}

/** כוכבים כטקסט נגיש. אין אמוג׳י — קורא מסך מקריא אותם אחד-אחד. */
export function starsLabel(stars: number | null | undefined): string | null {
  if (!stars || stars < 1 || stars > 7) return null;
  return `${stars} כוכבים`;
}

export function ratingLabel(
  rating: number | null | undefined,
  count: number | null | undefined,
): string | null {
  if (typeof rating !== "number" || rating <= 0) return null;
  const score = rating.toFixed(1);
  return count && count > 0 ? `${score} מתוך 5 · ${count} חוות דעת` : `${score} מתוך 5`;
}
