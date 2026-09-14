/**
 * מסך "משימות" — הרשימה המלאה.
 *
 * הגבול מול מסך "היום" הוא מה שמונע משני המסכים להיות אותו דבר:
 *
 *   "היום" הוא תור פעולה. הוא מציג רק מה שנדרש עכשיו, מסודר לפי קרבת
 *   הטיסה, ומסתיר בכוונה כל מה שרחוק ואת כל מה שכבר נסגר.
 *
 *   "משימות" הוא הרישום המלא. גם עתידיות, גם שהושלמו, עם חיפוש — זה
 *   המקום לענות על "מתי בעצם שלחנו לדנה את המסמכים" ועל "מה מחכה לי
 *   בשבוע הבא", שתי שאלות שאין להן בית בתור הפעולה.
 */

import { prisma } from "../db";
import { DISPLAY_TZ, endOfDayIn } from "../time/zones";
import { TRIP_SELECT, toItem, type QueueItem, type Row } from "./today";

export const TASK_TABS = ["today", "upcoming", "done"] as const;
export type TaskTab = (typeof TASK_TABS)[number];

export const TASK_TAB_HE: Record<TaskTab, string> = {
  today: "היום",
  upcoming: "בהמשך",
  done: "הושלמו",
};

export type TaskList = {
  now: Date;
  tab: TaskTab;
  items: QueueItem[];
  counts: Record<TaskTab, number>;
  more: number;
};

const PAGE = 60;

const SELECT = {
  id: true, key: true, title: true, audience: true, state: true, dueAt: true,
  blockedByJson: true, bornLate: true, messageTemplateKey: true,
  trip: { select: TRIP_SELECT },
};

/**
 * תיק סגור יורד מהרשימה: אין מה לעשות איתו, והוא היה מציף את "הושלמו"
 * בהיסטוריה של שנים. מי שמחפש נסיעה שהסתיימה מוצא אותה במסך הנסיעות.
 */
const LIVE_TRIP = { trip: { status: { in: ["draft", "active", "traveling", "returned"] } } };

function whereFor(tab: TaskTab, now: Date) {
  const endToday = endOfDayIn(now, DISPLAY_TZ);

  if (tab === "done") {
    return { ...LIVE_TRIP, state: { in: ["done", "skipped"] } };
  }

  if (tab === "upcoming") {
    return {
      ...LIVE_TRIP,
      state: { in: ["pending", "due", "blocked"] },
      dueAt: { gte: endToday },
    };
  }

  // "היום" — כל מה שנדרש עכשיו, כולל מה שנדחה ומועדו הגיע.
  return {
    ...LIVE_TRIP,
    state: { in: ["due", "overdue", "blocked", "pending"] },
    dueAt: { lt: endToday },
    OR: [{ snoozedUntil: null }, { snoozedUntil: { lte: now } }],
  };
}

function search(query?: string) {
  const q = query?.trim();
  if (!q) return {};
  return {
    OR: [
      { title: { contains: q } },
      { trip: { destination: { contains: q } } },
      { trip: { code: { contains: q } } },
      { trip: { client: { name: { contains: q } } } },
    ],
  };
}

export async function listTasks(params: {
  tab?: TaskTab;
  query?: string;
  page?: number;
  now?: Date;
} = {}): Promise<TaskList> {
  const now = params.now ?? new Date();
  const tab = TASK_TABS.includes(params.tab as TaskTab) ? (params.tab as TaskTab) : "today";
  const page = Math.max(params.page ?? 0, 0);
  const q = search(params.query);

  /*
   * "הושלמו" ממוין מהאחרון לראשון — מי שמחפש מה נסגר רוצה את האחרון
   * למעלה. שאר הלשוניות ממוינות לפי מועד, כי שם השאלה היא מה הבא בתור.
   * בשני המקרים id שובר שוויון, אחרת דפדוף מדלג על פריטים.
   */
  const orderBy =
    tab === "done"
      ? [{ dueAt: "desc" as const }, { id: "desc" as const }]
      : [{ dueAt: "asc" as const }, { id: "asc" as const }];

  const [rows, total, todayCount, upcomingCount, doneCount] = await Promise.all([
    prisma.milestone.findMany({
      where: { ...whereFor(tab, now), ...q },
      orderBy,
      skip: page * PAGE,
      take: PAGE,
      select: SELECT,
    }),
    prisma.milestone.count({ where: { ...whereFor(tab, now), ...q } }),
    prisma.milestone.count({ where: { ...whereFor("today", now), ...q } }),
    prisma.milestone.count({ where: { ...whereFor("upcoming", now), ...q } }),
    prisma.milestone.count({ where: { ...whereFor("done", now), ...q } }),
  ]);

  return {
    now,
    tab,
    items: (rows as Row[]).map(toItem),
    counts: { today: todayCount, upcoming: upcomingCount, done: doneCount },
    more: Math.max(total - (page * PAGE + rows.length), 0),
  };
}
