/**
 * ניהול נוסעים. בלי זה שרשרת שלמה באפיון לא יכולה לפעול: בדיקת תוקף
 * הדרכון (סעיף 5), אבן הדרך של קליטת הפרטים, והמשתנה {{נוסעים}} בערכת
 * מסמכי הנסיעה.
 *
 * מספר הדרכון מוצפן במנוחה ולא חוזר לדפדפן בשגרה — רק ארבע ספרות אחרונות.
 * מי שצריך את המספר המלא מבקש אותו במפורש, וזה נשאר פעולה מודעת.
 */

import { prisma } from "../db";
import { decryptPassport, encryptPassport, passportLast4 } from "../crypto/passport";
import { DISPLAY_TZ, zonedToUtc } from "../time/zones";
import { syncTrip } from "../milestones/sync";

export type TravelerInput = {
  firstNameLatin: string;
  lastNameLatin: string;
  displayNameHe?: string | null;
  /** ריק = לא לשנות. null מפורש = למחוק. */
  passportNumber?: string | null;
  passportExpiry?: string | null;
  passportCountry?: string | null;
  dateOfBirth?: string | null;
  phone?: string | null;
  isLead?: boolean;
};

const LATIN_NAME = /^[A-Za-z][A-Za-z '\-]{0,48}$/;

function normalizeLatin(value: string, field: string): string {
  const clean = value.trim().replace(/\s+/g, " ").toUpperCase();
  if (!LATIN_NAME.test(clean)) {
    throw new Error(
      `${field} חייב להיות באותיות לטיניות, בדיוק כמו בדרכון. התקבל: "${value}"`,
    );
  }
  return clean;
}

function parseDate(value: string | null | undefined, field: string): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value.trim() === "") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) throw new Error(`${field} אינו תאריך תקין`);
  // חצות מקומית הייתה עלולה ליפול ליום הקודם באזורי זמן מסוימים. צהריים בטוח.
  return zonedToUtc(`${value.trim()}T12:00`, DISPLAY_TZ);
}

async function ensureSingleLead(tripId: string, travelerId: string): Promise<void> {
  await prisma.traveler.updateMany({
    where: { tripId, id: { not: travelerId } },
    data: { isLead: false },
  });
}

export async function addTraveler(tripId: string, input: TravelerInput): Promise<string> {
  const existing = await prisma.traveler.count({ where: { tripId } });
  const passport = input.passportNumber?.trim();

  const traveler = await prisma.traveler.create({
    data: {
      tripId,
      firstNameLatin: normalizeLatin(input.firstNameLatin, "שם פרטי"),
      lastNameLatin: normalizeLatin(input.lastNameLatin, "שם משפחה"),
      displayNameHe: input.displayNameHe?.trim() || null,
      passportNumberEnc: passport ? encryptPassport(passport) : null,
      passportLast4: passport ? passportLast4(passport) : null,
      passportExpiry: parseDate(input.passportExpiry, "תוקף דרכון") ?? null,
      passportCountry: input.passportCountry?.trim() || "IL",
      dateOfBirth: parseDate(input.dateOfBirth, "תאריך לידה") ?? null,
      phone: input.phone?.trim() || null,
      // הראשון הוא איש הקשר כברירת מחדל, אחרת אין למי לשלוח.
      isLead: input.isLead ?? existing === 0,
    },
  });

  if (traveler.isLead) await ensureSingleLead(tripId, traveler.id);
  await syncTrip(tripId);
  return traveler.id;
}

export async function updateTraveler(travelerId: string, input: TravelerInput): Promise<void> {
  const current = await prisma.traveler.findUniqueOrThrow({
    where: { id: travelerId },
    select: { tripId: true },
  });

  const passport = input.passportNumber?.trim();
  const expiry = parseDate(input.passportExpiry, "תוקף דרכון");
  const dob = parseDate(input.dateOfBirth, "תאריך לידה");

  await prisma.traveler.update({
    where: { id: travelerId },
    data: {
      firstNameLatin: normalizeLatin(input.firstNameLatin, "שם פרטי"),
      lastNameLatin: normalizeLatin(input.lastNameLatin, "שם משפחה"),
      displayNameHe: input.displayNameHe?.trim() || null,
      // שדה ריק פירושו "לא נגעתי", ולא "מחק את הדרכון".
      ...(passport ? { passportNumberEnc: encryptPassport(passport), passportLast4: passportLast4(passport) } : {}),
      ...(expiry !== undefined ? { passportExpiry: expiry } : {}),
      ...(dob !== undefined ? { dateOfBirth: dob } : {}),
      passportCountry: input.passportCountry?.trim() || "IL",
      phone: input.phone?.trim() || null,
      ...(input.isLead ? { isLead: true } : {}),
    },
  });

  if (input.isLead) await ensureSingleLead(current.tripId, travelerId);
  await syncTrip(current.tripId);
}

export async function removeTraveler(travelerId: string): Promise<void> {
  const traveler = await prisma.traveler.delete({
    where: { id: travelerId },
    select: { tripId: true, isLead: true },
  });

  // אם נמחק איש הקשר, הראשון שנשאר תופס את מקומו — תיק בלי איש קשר הוא
  // תיק שאי אפשר לשלוח אליו כלום.
  if (traveler.isLead) {
    const next = await prisma.traveler.findFirst({
      where: { tripId: traveler.tripId },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (next) await prisma.traveler.update({ where: { id: next.id }, data: { isLead: true } });
  }

  await syncTrip(traveler.tripId);
}

/** פענוח מספר דרכון לבקשה מפורשת של הסוכן. */
export async function revealPassport(travelerId: string): Promise<string> {
  const t = await prisma.traveler.findUniqueOrThrow({
    where: { id: travelerId },
    select: { passportNumberEnc: true },
  });
  if (!t.passportNumberEnc) throw new Error("לא הוזן מספר דרכון לנוסע הזה");
  return decryptPassport(t.passportNumberEnc);
}
