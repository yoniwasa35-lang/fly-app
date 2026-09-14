/**
 * כניסה למערכת. סעיף 3 באפיון אומר "בלי הרשאות ובלי חלוקת תיקים" — כלומר
 * אין משתמשים ואין תפקידים. הוא לא אומר שהמערכת פתוחה לכל העולם: היא
 * מחזיקה מספרי דרכון, תאריכי לידה וטלפונים של לקוחות.
 *
 * לכן: מנעול אחד, סיסמה משותפת לשני הסוכנים, ועוגייה חתומה.
 *
 * הקוד כאן משתמש ב-Web Crypto בלבד ולא ב-node:crypto, כי הוא נקרא גם
 * מה-middleware שרץ ב-Edge.
 */

export const SESSION_COOKIE = "fly_session";
const SESSION_DAYS = 30;

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string): ArrayBuffer {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function sessionSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("חסר SESSION_SECRET");
  return s;
}

/** השוואה בזמן קבוע, כדי שלא יהיה אפשר לנחש סיסמה לפי זמן התגובה. */
export function constantTimeEqual(a: string, b: string): boolean {
  const ab = new TextEncoder().encode(a);
  const bb = new TextEncoder().encode(b);
  // האורך עצמו אינו סוד, אבל עדיין לא יוצאים מוקדם על תוכן.
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

/** אסימון בצורת "<תפוגה>.<חתימה>". אין בו מידע על המשתמש כי אין משתמשים. */
export async function createSessionToken(now: Date = new Date()): Promise<string> {
  const expires = now.getTime() + SESSION_DAYS * 24 * 3_600_000;
  const payload = String(expires);
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(sessionSecret()), new TextEncoder().encode(payload));
  return `${payload}.${b64url(new Uint8Array(sig))}`;
}

export async function verifySessionToken(token: string | undefined, now: Date = new Date()): Promise<boolean> {
  if (!token) return false;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return false;

  const payload = token.slice(0, dot);
  const expires = Number(payload);
  if (!Number.isFinite(expires) || expires <= now.getTime()) return false;

  try {
    return await crypto.subtle.verify(
      "HMAC",
      await hmacKey(sessionSecret()),
      fromB64url(token.slice(dot + 1)),
      new TextEncoder().encode(payload),
    );
  } catch {
    return false;
  }
}

export const SESSION_MAX_AGE_SECONDS = SESSION_DAYS * 24 * 3600;
