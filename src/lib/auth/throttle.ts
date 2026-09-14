/**
 * האטה על ניסיונות כניסה כושלים.
 *
 * נשמרת במסד ולא בזיכרון התהליך. בפריסה ללא שרת כל instance מקבל זיכרון
 * משלו, ולכן תוקף שפוגע במספיק instances מקבל את מלוא הניסיונות בכל אחד
 * מהם — והאטה כזו היא בעיקר תחושה של הגנה. זה המנעול היחיד שמגן על מספרי
 * דרכון ופרטי לקוחות, ולכן הוא צריך להיות משותף לכל המופעים.
 *
 * ההאטה היא לפי כתובת. תוקף שמחליף כתובות יעקוף אותה, אבל חסימה גלובלית
 * הייתה מאפשרת לו לנעול את הסוכנים עצמם מחוץ למערכת. ההגנה האמיתית היא
 * אורך הסיסמה, ולכן בפרודקשן נדרשים 12 תווים לפחות.
 */

import { prisma } from "../db";

const MAX_FAILURES = 5;
/** השהיות מצטברות אחרי חציית הסף, בדקות. */
const BACKOFF_MINUTES = [1, 5, 15, 60];

export type ThrottleState = { blocked: false } | { blocked: true; secondsLeft: number };

export async function checkThrottle(key: string, now = new Date()): Promise<ThrottleState> {
  const record = await prisma.loginAttempt.findUnique({ where: { key } });
  if (!record?.blockedUntil || record.blockedUntil <= now) return { blocked: false };
  return {
    blocked: true,
    secondsLeft: Math.ceil((record.blockedUntil.getTime() - now.getTime()) / 1000),
  };
}

export async function recordFailure(key: string, now = new Date()): Promise<ThrottleState> {
  const record = await prisma.loginAttempt.findUnique({ where: { key } });
  const failures = (record?.failures ?? 0) + 1;

  let blockedUntil: Date | null = null;
  if (failures >= MAX_FAILURES) {
    const step = Math.min(failures - MAX_FAILURES, BACKOFF_MINUTES.length - 1);
    blockedUntil = new Date(now.getTime() + BACKOFF_MINUTES[step] * 60_000);
  }

  await prisma.loginAttempt.upsert({
    where: { key },
    create: { key, failures, blockedUntil },
    update: { failures, blockedUntil },
  });

  return blockedUntil
    ? { blocked: true, secondsLeft: Math.ceil((blockedUntil.getTime() - now.getTime()) / 1000) }
    : { blocked: false };
}

export async function clearFailures(key: string): Promise<void> {
  await prisma.loginAttempt.deleteMany({ where: { key } });
}

/** ניקוי רשומות ישנות. נקרא מה-job היומי. */
export async function pruneAttempts(now = new Date()): Promise<number> {
  const { count } = await prisma.loginAttempt.deleteMany({
    where: { updatedAt: { lt: new Date(now.getTime() - 7 * 86_400_000) } },
  });
  return count;
}
