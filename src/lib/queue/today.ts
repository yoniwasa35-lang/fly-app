/**
 * מסך "היום" — סעיף 8.1. תור פעולות, לא יומן.
 *
 * שלוש קבוצות: עבר מועד, היום, עד סוף השבוע. מה שרחוק יותר לא מופיע.
 *
 * ההחלטות כאן נגזרות ממה שקורה בפועל ב-100+ תיקים פעילים, ולא מהתיאוריה:
 *
 *   1. "עבר מועד" ו"היום" הם התור האמיתי, ולכן שטוחים. בקצב יציב הם
 *      עשרות בודדות ביום — גודל שאפשר לעבוד איתו.
 *   2. "עד סוף השבוע" מגיע למאות פריטים, כי כל תיק מייצר אבן דרך כל כמה
 *      ימים. הוא מקובץ לפי יום ומתקפל, כדי שיישאר תצוגה מקדימה ולא קיר.
 *      סעיף 14 מזהיר במפורש: מסך עם 30 פריטים ייעלם מהעיניים.
 *   3. אבני דרך שנולדו באיחור מקובצות לפי תיק ולא לפי אבן דרך. ככה באמת
 *      סוגרים אותן — פותחים את התיק פעם אחת ועוברים על כולן בהקשר.
 *   4. התור ממוין לפי קרבת הטיסה ולא לפי מועד אבן הדרך. מיון לפי מועד
 *      מעלה לראש את הישן ביותר, שזו לרוב הצעת ביטוח לתיק שיוצא בעוד
 *      חודשיים — בזמן שמה שבאמת בוער הוא דרכון של מי שטס בעוד שלושה ימים.
 *      עלות הפספוס גדלה ככל שמתקרבים ליציאה, ולכן זה סדר העבודה הנכון.
 *
 * שום קבוצה לא נחתכת בשקט. אם הגענו לתקרה, המסך אומר את זה.
 */

import { Prisma } from "@prisma/client";
import { prisma } from "../db";
import { isOpenState, type Audience, type MilestoneState } from "../domain/types";
import { parseBlockers } from "../milestones/sync";
import type { Blocker } from "../milestones/engine";
import { DISPLAY_TZ, endOfDayIn, endOfWeekIn, startOfDayIn, utcToZoned } from "../time/zones";

const OPEN_STATES = ["due", "overdue", "blocked", "pending"] as const;

/** תקרה לכל קבוצה בנפרד. חציית התקרה מדווחת למסך ולא מוסתרת. */
const GROUP_LIMIT = 200;

/**
 * סדר הטיפול: קודם התיקים שהטיסה שלהם קרובה, ובתוך אותו תיק לפי מועד.
 * אם נגמר לסוכן היום, מה שנשאר למטה הוא מה שיש עליו עוד זמן.
 */
const URGENCY_ORDER: Prisma.MilestoneOrderByWithRelationInput[] = [
  { trip: { departureAt: "asc" } },
  { dueAt: "asc" },
  // שובר שוויון. בלעדיו הסדר בין פריטים שווי-ערך אינו מובטח, ומאחר
  // שהקבוצות חסומות בתקרה — פריט היה יכול להיעלם מתחת לה בהרצה אחת
  // ולהופיע באחרת.
  { id: "asc" },
];

export type QueueItem = {
  id: string;
  key: string;
  title: string;
  audience: Audience;
  state: MilestoneState;
  dueAt: Date;
  blockers: Blocker[];
  bornLate: boolean;
  requiresResolution: boolean;
  /** אבן דרך שהפעולה שלה היא הזנת מספר — כרגע רק סגירת הרווח בפועל. */
  requiresAmount: boolean;
  messageTemplateKey: string | null;
  trip: {
    id: string;
    code: string;
    destination: string;
    departureAt: Date;
    clientName: string;
    clientPhone: string;
  };
};

export type DayGroup = {
  /** "YYYY-MM-DD" בשעון ישראל. */
  day: string;
  date: Date;
  items: QueueItem[];
};

export type LateTripGroup = {
  tripId: string;
  code: string;
  clientName: string;
  destination: string;
  departureAt: Date;
  count: number;
  /** כותרות של כמה מהן, כדי שיהיה מושג בלי לפתוח. */
  sample: string[];
};

export type TodayQueue = {
  now: Date;
  overdue: QueueItem[];
  today: QueueItem[];
  /** מקובץ לפי יום, ומתקפל במסך. */
  thisWeek: DayGroup[];
  /** מקובץ לפי תיק — סעיף 14. */
  bornLate: LateTripGroup[];
  counts: { overdue: number; today: number; thisWeek: number; bornLate: number; bornLateTrips: number };
  truncated: { overdue: boolean; today: boolean; thisWeek: boolean };
};

/** אבני דרך שדורשות הכרעה מפורשת ולא סתם "בוצע" — סעיף 5, ביטוח. */
const RESOLUTION_KEYS = new Set(["close_insurance"]);

/** אבני דרך שהפעולה שלהן היא הזנת סכום, ולא סימון שבוצעו. */
const AMOUNT_KEYS = new Set(["close_actual_commission"]);

export const TRIP_SELECT = {
  id: true, code: true, destination: true, departureAt: true,
  client: { select: { name: true, phone: true } },
} as const;

export type Row = {
  id: string; key: string; title: string; audience: string; state: string;
  dueAt: Date; blockedByJson: string | null; bornLate: boolean;
  messageTemplateKey: string | null;
  trip: { id: string; code: string; destination: string; departureAt: Date; client: { name: string; phone: string } };
};

/** ממפה שורה מהמסד לפריט תור. מיוצא כדי שמסך המשימות ישתמש
 * באותו מיפוי בדיוק — שני מיפויים לאותו דבר נפרדים ביום הראשון. */
export function toItem(r: Row): QueueItem {
  return {
    id: r.id,
    key: r.key,
    title: r.title,
    audience: r.audience as Audience,
    state: r.state as MilestoneState,
    dueAt: r.dueAt,
    blockers: parseBlockers(r.blockedByJson),
    bornLate: r.bornLate,
    requiresResolution: RESOLUTION_KEYS.has(r.key),
    requiresAmount: AMOUNT_KEYS.has(r.key),
    messageTemplateKey: r.messageTemplateKey,
    trip: {
      id: r.trip.id,
      code: r.trip.code,
      destination: r.trip.destination,
      departureAt: r.trip.departureAt,
      clientName: r.trip.client.name,
      clientPhone: r.trip.client.phone,
    },
  };
}

export async function getTodayQueue(now: Date = new Date()): Promise<TodayQueue> {
  const startToday = startOfDayIn(now, DISPLAY_TZ);
  const endToday = endOfDayIn(now, DISPLAY_TZ);
  const endWeek = endOfWeekIn(now, DISPLAY_TZ);

  const visible = {
    state: { in: [...OPEN_STATES] },
    OR: [{ snoozedUntil: null }, { snoozedUntil: { lte: now } }],
    trip: { status: { in: ["active", "traveling"] } },
  };

  const select = {
    id: true, key: true, title: true, audience: true, state: true, dueAt: true,
    blockedByJson: true, bornLate: true, messageTemplateKey: true,
    trip: { select: TRIP_SELECT },
  };

  // שאילתה נפרדת לכל קבוצה. כך אף קבוצה לא נדחקת החוצה על ידי אחרת,
  // ובפרט "עבר מועד" לא נעלם מתחת להר של פריטים עתידיים.
  const [overdueRows, todayRows, weekRows, lateRows, counts] = await Promise.all([
    prisma.milestone.findMany({
      where: { ...visible, bornLate: false, dueAt: { lt: startToday } },
      orderBy: URGENCY_ORDER, take: GROUP_LIMIT + 1, select,
    }),
    prisma.milestone.findMany({
      where: { ...visible, bornLate: false, dueAt: { gte: startToday, lt: endToday } },
      orderBy: URGENCY_ORDER, take: GROUP_LIMIT + 1, select,
    }),
    prisma.milestone.findMany({
      where: { ...visible, bornLate: false, dueAt: { gte: endToday, lt: endWeek } },
      orderBy: [{ dueAt: "asc" }, { id: "asc" }], take: GROUP_LIMIT + 1, select,
    }),
    prisma.milestone.findMany({
      where: { ...visible, bornLate: true },
      orderBy: [{ dueAt: "asc" }, { id: "asc" }],
      select: { title: true, trip: { select: TRIP_SELECT } },
    }),
    prisma.milestone.groupBy({
      by: ["bornLate"],
      where: { ...visible, dueAt: { lt: endWeek } },
      _count: true,
    }),
  ]);

  const cut = (rows: Row[]) => ({
    items: rows.slice(0, GROUP_LIMIT).filter((r) => isOpenState(r.state)).map(toItem),
    truncated: rows.length > GROUP_LIMIT,
  });

  const overdue = cut(overdueRows);
  const today = cut(todayRows);
  const week = cut(weekRows);

  // קיבוץ השבוע לפי יום בשעון ישראל.
  const byDay = new Map<string, DayGroup>();
  for (const item of week.items) {
    const day = utcToZoned(item.dueAt, DISPLAY_TZ).slice(0, 10);
    const group = byDay.get(day);
    if (group) group.items.push(item);
    else byDay.set(day, { day, date: item.dueAt, items: [item] });
  }

  // קיבוץ "נולדו באיחור" לפי תיק.
  const byTrip = new Map<string, LateTripGroup>();
  for (const row of lateRows) {
    const t = row.trip;
    const group = byTrip.get(t.id);
    if (group) {
      group.count++;
      if (group.sample.length < 3) group.sample.push(row.title);
    } else {
      byTrip.set(t.id, {
        tripId: t.id, code: t.code, clientName: t.client.name,
        destination: t.destination, departureAt: t.departureAt,
        count: 1, sample: [row.title],
      });
    }
  }

  const bornLateTotal = counts.find((c) => c.bornLate)?._count ?? 0;

  return {
    now,
    overdue: overdue.items,
    today: today.items,
    thisWeek: [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day)),
    bornLate: [...byTrip.values()].sort((a, b) => a.departureAt.getTime() - b.departureAt.getTime()),
    counts: {
      overdue: overdue.items.length,
      today: today.items.length,
      thisWeek: week.items.length,
      bornLate: bornLateTotal,
      bornLateTrips: byTrip.size,
    },
    truncated: {
      overdue: overdue.truncated,
      today: today.truncated,
      thisWeek: week.truncated,
    },
  };
}
