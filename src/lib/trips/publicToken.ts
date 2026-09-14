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
 * הכתובת הבסיסית של המערכת.
 *
 * PUBLIC_BASE_URL גובר תמיד — הוא מה שמגדירים כשיש דומיין משלכם. בלעדיו,
 * על Vercel, נלקחת כתובת הפרודקשן שהפלטפורמה מזריקה בעצמה. זה חוסך את
 * בעיית הביצה והתרנגולת: הכתובת אינה ידועה לפני הפריסה הראשונה, ובלי
 * הנפילה הזו היה צריך לפרוס, להעתיק את הכתובת, ולפרוס שוב.
 */
export function publicBaseUrl(): string {
  const explicit = process.env.PUBLIC_BASE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;

  return "";
}

/**
 * הכתובת המלאה לעמוד הלקוח. אם אין בסיס, מוחזרת מחרוזת ריקה — וההודעה
 * שמשתמשת בקישור תיחסם לפני שליחה במקום לשלוח כתובת שבורה.
 */
export function publicTripUrl(token: string): string {
  const base = publicBaseUrl();
  return base ? `${base}/c/${token}` : "";
}
