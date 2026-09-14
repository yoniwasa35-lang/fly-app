import crypto from "node:crypto";

/**
 * הטוקן של עמוד הלקוח. הקישור עצמו הוא הסוד (סעיף 8.4: ללא התחברות),
 * ולכן הוא חייב להיות אקראי קריפטוגרפית ולא נגזר מה-id של התיק —
 * מזהה רץ או cuid היו מאפשרים לנחש תיקים של לקוחות אחרים.
 *
 * 24 בתים = 192 ביט, ב-base64url כדי שיהיה בטוח בכתובת ובוואטסאפ.
 */
export function newPublicToken(): string {
  return crypto.randomBytes(24).toString("base64url");
}

export function looksLikePublicToken(value: string): boolean {
  return /^[A-Za-z0-9_-]{22,64}$/.test(value);
}

/**
 * הכתובת המלאה לעמוד הלקוח. בלי PUBLIC_BASE_URL אין דרך לדעת תחת איזה
 * דומיין המערכת רצה, ולכן מוחזרת מחרוזת ריקה — וההודעה שמשתמשת בקישור
 * תיחסם לפני שליחה במקום לשלוח כתובת שבורה.
 */
export function publicTripUrl(token: string): string {
  const base = process.env.PUBLIC_BASE_URL?.trim().replace(/\/+$/, "");
  return base ? `${base}/c/${token}` : "";
}
