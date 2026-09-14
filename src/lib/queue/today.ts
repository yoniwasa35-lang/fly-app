/**
 * מסך "היום" — סעיף 8.1. תור פעולות, לא יומן.
 *
 * שלוש קבוצות בלבד: עבר מועד, היום, עד סוף השבוע. כל מה שרחוק יותר לא מופיע.
 * השאילתה מסתמכת על dueAt שכבר חושב בכתיבה (סעיף 10) ועל אינדקס (state, dueAt),
 * כדי שהמסך ייפתח מהר גם עם מאות תיקים פתוחים.
 */

import { prisma } from "../db";
import { isOpenState, type Audience, type MilestoneState } from "../domain/types";
import { parseBlockers } from "../milestones/sync";
import type { Blocker } from "../milestones/engine";
import { DISPLAY_TZ, endOfDayIn, endOfWeekIn, startOfDayIn } from "../time/zones";

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
  /** קיים רק לאבני דרך שפונות ללקוח — הכפתור שלהן פותח הודעת וואטסאפ. */
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

export type TodayQueue = {
  now: Date;
  overdue: QueueItem[];
  today: QueueItem[];
  thisWeek: QueueItem[];
  /** אבני דרך שנולדו כבר באיחור בתיקים שנפתחו מאוחר — מקובצות, לא מוצפות (סעיף 14). */
  bornLate: QueueItem[];
  counts: { overdue: number; today: number; thisWeek: number; bornLate: number };
};

/** אבני דרך שדורשות הכרעה מפורשת — נטען מהתבנית כדי שהמסך ידע לא להציע "בוצע". */
const RESOLUTION_KEYS = new Set(["close_insurance"]);

export async function getTodayQueue(now: Date = new Date()): Promise<TodayQueue> {
  const startToday = startOfDayIn(now, DISPLAY_TZ);
  const endToday = endOfDayIn(now, DISPLAY_TZ);
  const endWeek = endOfWeekIn(now, DISPLAY_TZ);

  const rows = await prisma.milestone.findMany({
    where: {
      state: { in: ["due", "overdue", "blocked", "pending"] },
      dueAt: { lt: endWeek },
      OR: [{ snoozedUntil: null }, { snoozedUntil: { lte: now } }],
      trip: { status: { in: ["active", "traveling"] } },
    },
    orderBy: [{ dueAt: "asc" }],
    include: {
      trip: {
        select: {
          id: true, code: true, destination: true, departureAt: true,
          client: { select: { name: true, phone: true } },
        },
      },
    },
    take: 500,
  });

  const items: QueueItem[] = rows
    .filter((r) => isOpenState(r.state))
    .map((r) => ({
      id: r.id,
      key: r.key,
      title: r.title,
      audience: r.audience as Audience,
      state: r.state as MilestoneState,
      dueAt: r.dueAt,
      blockers: parseBlockers(r.blockedByJson),
      bornLate: r.bornLate,
      requiresResolution: RESOLUTION_KEYS.has(r.key),
      messageTemplateKey: r.messageTemplateKey,
      trip: {
        id: r.trip.id,
        code: r.trip.code,
        destination: r.trip.destination,
        departureAt: r.trip.departureAt,
        clientName: r.trip.client.name,
        clientPhone: r.trip.client.phone,
      },
    }));

  const queue: TodayQueue = {
    now,
    overdue: [], today: [], thisWeek: [], bornLate: [],
    counts: { overdue: 0, today: 0, thisWeek: 0, bornLate: 0 },
  };

  for (const item of items) {
    if (item.bornLate) queue.bornLate.push(item);
    else if (item.dueAt < startToday) queue.overdue.push(item);
    else if (item.dueAt < endToday) queue.today.push(item);
    else queue.thisWeek.push(item);
  }

  queue.counts = {
    overdue: queue.overdue.length,
    today: queue.today.length,
    thisWeek: queue.thisWeek.length,
    bornLate: queue.bornLate.length,
  };

  return queue;
}
