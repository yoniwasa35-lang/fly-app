/**
 * ה-job היומי — סעיף 10. מעדכן מצבי אבני דרך, מחשב חסימות מחדש,
 * ומקדם סטטוס תיקים. אין כאן real-time, ואין בו צורך.
 */

import { prisma } from "../db";
import { refreshTripStates } from "../milestones/sync";

export type DailyJobResult = {
  ranAt: Date;
  tripsScanned: number;
  milestonesChanged: number;
  statusChanges: Array<{ code: string; from: string; to: string }>;
  /** אבני דרך שאיבדו רלוונטיות כי התיק יצא לדרך. */
  retired: number;
  errors: Array<{ tripId: string; message: string }>;
};

/**
 * מועד ביטול חינם הוא חסר משמעות ברגע שהמטוס המריא — אי אפשר לבטל נסיעה
 * שנמצאת באוויר. אבן דרך כזו שנשארה פתוחה היא רעש בראש התור, ובדיוק הסוג
 * של רעש שסעיף 14 מזהיר ממנו.
 *
 * היא נסגרת כ"נדחתה" ולא נמחקת, כי החשיפה הכספית היא חלק מההיסטוריה של
 * התיק. מועד תשלום לספק לעומת זאת נשאר פתוח: החוב לא נעלם עם ההמראה.
 */
const RETIRE_ON_DEPARTURE = "component_free_cancel:";
const RETIRE_REASON = "התיק יצא לדרך — מועד הביטול כבר לא רלוונטי";

async function retireStaleDeadlines(now: Date): Promise<number> {
  const { count } = await prisma.milestone.updateMany({
    where: {
      key: { startsWith: RETIRE_ON_DEPARTURE },
      state: { in: ["pending", "due", "overdue", "blocked"] },
      trip: { status: { in: ["traveling", "returned", "closed"] } },
    },
    data: { state: "skipped", skipReason: RETIRE_REASON, completedAt: now },
  });
  return count;
}

export async function runDailyJob(now: Date = new Date()): Promise<DailyJobResult> {
  const result: DailyJobResult = {
    ranAt: now,
    tripsScanned: 0,
    milestonesChanged: 0,
    statusChanges: [],
    retired: 0,
    errors: [],
  };

  const trips = await prisma.trip.findMany({
    where: { status: { in: ["active", "traveling", "returned"] } },
    select: { id: true, code: true, status: true, departureAt: true, returnAt: true },
  });

  for (const trip of trips) {
    result.tripsScanned++;
    try {
      result.milestonesChanged += await refreshTripStates(trip.id, now);

      // קידום סטטוס לפי מיקום בזמן. סגירת תיק נשארת פעולה ידנית, כי היא
      // מוחקת מספרי דרכון.
      let next = trip.status;
      if (trip.status === "active" && now >= trip.departureAt) next = "traveling";
      if ((trip.status === "traveling" || next === "traveling") && now >= trip.returnAt) next = "returned";

      if (next !== trip.status) {
        await prisma.trip.update({ where: { id: trip.id }, data: { status: next } });
        result.statusChanges.push({ code: trip.code, from: trip.status, to: next });
      }
    } catch (e) {
      result.errors.push({ tripId: trip.id, message: e instanceof Error ? e.message : String(e) });
    }
  }

  // אחרי קידום הסטטוסים, כדי שתיקים שיצאו היום ייתפסו באותה ריצה.
  result.retired = await retireStaleDeadlines(now);

  return result;
}
