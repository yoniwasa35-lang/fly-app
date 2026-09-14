/**
 * מספרי דרכון מוצפנים במנוחה — סעיף 10 באפיון.
 * AES-256-GCM. המפתח מגיע מהסביבה ולא נשמר במסד.
 * בסגירת תיק הערך המוצפן נמחק (ראו closeTrip ב-src/lib/trips/service.ts).
 */

import crypto from "node:crypto";

const ALGO = "aes-256-gcm";
const VERSION = "v1";

function key(): Buffer {
  const raw = process.env.PASSPORT_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "חסר PASSPORT_ENCRYPTION_KEY. ליצירה: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\"",
    );
  }
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) throw new Error("PASSPORT_ENCRYPTION_KEY חייב להיות 32 בתים ב-base64");
  return buf;
}

export function encryptPassport(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key(), iv);
  const enc = Buffer.concat([cipher.update(plain.trim(), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64"), tag.toString("base64"), enc.toString("base64")].join(".");
}

export function decryptPassport(payload: string): string {
  const [version, ivB64, tagB64, dataB64] = payload.split(".");
  if (version !== VERSION) throw new Error(`גרסת הצפנה לא מוכרת: ${version}`);
  const decipher = crypto.createDecipheriv(ALGO, key(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
}

export function passportLast4(plain: string): string {
  const clean = plain.replace(/\s+/g, "");
  return clean.slice(-4);
}

/** האם ההצפנה מוגדרת. מאפשר להריץ את המערכת בלי לאחסן מספרי דרכון כלל. */
export function passportStorageEnabled(): boolean {
  return !!process.env.PASSPORT_ENCRYPTION_KEY;
}
