/**
 * מסך "כל התיקים" — סעיף 8.2.
 *
 * תצוגת ציר זמן אופקית: כל תיק הוא שורה, ממוקם ביחס ליום הטיסה שלו, ואבני
 * הדרך הפתוחות מסומנות כנקודות צבועות על הציר. המסך אמור לענות במבט אחד
 * על "מי עומד איפה ומי בוער".
 *
 * הסוכן אמר שבשיא העונה יש 100+ תיקים פעילים, ולכן יש כאן סינון, עימוד,
 * וקיבוץ נקודות לפי יום — אחרת הציר הופך לרצף נקודות חופפות.
 */

import { prisma } from "../db";
import { isOpenState, type MilestoneState, type TripStatus } from "../domain/types";
import { DISPLAY_TZ, startOfDayIn } from "../time/zones";

export type TimelineDot = {
  /** מספר הימים מתחילת חלון הציר. */
  dayOffset: number;
  /** המצב החמור ביותר מבין אבני הדרך של אותו יום. */
  state: MilestoneState;
  count: number;
  labels: string[];
};

export type TimelineRow = {
  id: string;
  code: string;
  clientName: string;
  destination: string;
  status: TripStatus;
  departureAt: Date;
  returnAt: Date;
  /** מיקום היציאה והחזרה על הציר, בימים מתחילת החלון. */
  departureOffset: number;
  returnOffset: number;
  dots: TimelineDot[];
  /** איחור אמיתי שדורש טיפול. לא כולל אבני דרך שנולדו באיחור. */
  overdue: number;
  blocked: number;
  open: number;
  /**
   * אבני דרך שנולדו באיחור — תיק שנפתח קרוב ליציאה. הן מוצגות בנפרד
   * ובצבע שקט, כי אחרת כל שורה בציר נצבעת אדום וסעיף 4 מתרוקן מתוכן:
   * כשהכל אדום, שום דבר לא אדום.
   */
  late: number;
};

export type TimelineFilters = {
  query?: string;
  windowDays?: number;
  onlyHot?: boolean;
  status?: "open" | "traveling" | "all";
  limit?: number;
  offset?: number;
};

export type Timeline = {
  now: Date;
  windowStart: Date;
  windowDays: number;
  rows: TimelineRow[];
  total: number;
  /** כמה תיקים נותרו מעבר לעמוד הנוכחי. */
  more: number;
  counts: { hot: number; travelingSoon: number };
};

export const WINDOW_OPTIONS = [30, 90, 180] as const;
const DEFAULT_WINDOW = 90;
const DEFAULT_LIMIT = 40;

/** כמה ימים אחורה הציר מציג, כדי שתיקים שכבר יצאו לא ייעלמו מיד. */
const PAST_DAYS = 7;

const SEVERITY: Record<string, number> = { overdue: 4, blocked: 3, due: 2, pending: 1 };

function mostSevere(a: MilestoneState, b: MilestoneState): MilestoneState {
  return (SEVERITY[a] ?? 0) >= (SEVERITY[b] ?? 0) ? a : b;
}

export async function getTimeline(filters: TimelineFilters = {}): Promise<Timeline> {
  const now = new Date();
  const windowDays = filters.windowDays ?? DEFAULT_WINDOW;
  const limit = filters.limit ?? DEFAULT_LIMIT;
  const offset = filters.offset ?? 0;

  const windowStart = new Date(startOfDayIn(now, DISPLAY_TZ).getTime() - PAST_DAYS * 86_400_000);
  const windowEnd = new Date(windowStart.getTime() + (windowDays + PAST_DAYS) * 86_400_000);

  const statuses: TripStatus[] =
    filters.status === "traveling" ? ["traveling"]
    : filters.status === "all" ? ["draft", "active", "traveling", "returned"]
    : ["active", "traveling"];

  const query = filters.query?.trim();
  const where = {
    status: { in: statuses },
    // תיק שכבר חזר מזמן לא שייך לציר. תיק שיוצא אחרי סוף החלון גם לא.
    departureAt: { lt: windowEnd },
    returnAt: { gte: windowStart },
    ...(query
      ? {
          OR: [
            { code: { contains: query, mode: "insensitive" as const } },
            { destination: { contains: query, mode: "insensitive" as const } },
            { client: { name: { contains: query, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };

  const [total, trips] = await Promise.all([
    prisma.trip.count({ where }),
    prisma.trip.findMany({
      where,
      // המיון חייב להיות מלא, לא רק לפי תאריך. שני תיקים שיוצאים באותו יום
      // הם מצב נפוץ בעונה, ובלי שובר שוויון הסדר בין שתי שאילתות אינו
      // מובטח — אותו תיק היה יכול להופיע בשני עמודים ותיק אחר להיעלם.
      orderBy: [{ departureAt: "asc" }, { id: "asc" }],
      skip: offset,
      take: limit,
      select: {
        id: true, code: true, destination: true, status: true,
        departureAt: true, returnAt: true,
        client: { select: { name: true } },
        milestones: {
          where: { state: { in: ["due", "overdue", "blocked", "pending"] } },
          select: { id: true, title: true, dueAt: true, state: true, bornLate: true },
          orderBy: { dueAt: "asc" },
        },
      },
    }),
  ]);

  const dayOffset = (d: Date) => Math.floor((d.getTime() - windowStart.getTime()) / 86_400_000);

  let rows: TimelineRow[] = trips.map((trip) => {
    const allOpen = trip.milestones.filter((m) => isOpenState(m.state));
    const late = allOpen.filter((m) => m.bornLate).length;
    // אבני דרך שנולדו באיחור לא מצוירות על הציר: מועדן הוא ארטיפקט של
    // מועד פתיחת התיק, לא נקודת זמן שמשמעותית לתכנון.
    const open = allOpen.filter((m) => !m.bornLate);
    const byDay = new Map<number, TimelineDot>();

    for (const m of open) {
      const offsetDays = dayOffset(m.dueAt);
      // מה שמועדו לפני תחילת החלון נדחף לקצה הימני במקום להיעלם.
      if (offsetDays < 0) {
        const edge = byDay.get(0);
        if (edge) {
          edge.count++;
          edge.state = mostSevere(edge.state, m.state as MilestoneState);
          if (edge.labels.length < 4) edge.labels.push(m.title);
        } else {
          byDay.set(0, { dayOffset: 0, state: m.state as MilestoneState, count: 1, labels: [m.title] });
        }
        continue;
      }
      if (offsetDays > windowDays + PAST_DAYS) continue;

      const existing = byDay.get(offsetDays);
      if (existing) {
        existing.count++;
        existing.state = mostSevere(existing.state, m.state as MilestoneState);
        if (existing.labels.length < 4) existing.labels.push(m.title);
      } else {
        byDay.set(offsetDays, {
          dayOffset: offsetDays,
          state: m.state as MilestoneState,
          count: 1,
          labels: [m.title],
        });
      }
    }

    return {
      id: trip.id,
      code: trip.code,
      clientName: trip.client.name,
      destination: trip.destination,
      status: trip.status as TripStatus,
      departureAt: trip.departureAt,
      returnAt: trip.returnAt,
      departureOffset: dayOffset(trip.departureAt),
      returnOffset: dayOffset(trip.returnAt),
      dots: [...byDay.values()].sort((a, b) => a.dayOffset - b.dayOffset),
      overdue: open.filter((m) => m.state === "overdue").length,
      blocked: open.filter((m) => m.state === "blocked").length,
      open: open.length,
      late,
    };
  });

  if (filters.onlyHot) rows = rows.filter((r) => r.overdue > 0 || r.blocked > 0);

  return {
    now,
    windowStart,
    windowDays: windowDays + PAST_DAYS,
    rows,
    total,
    more: Math.max(0, total - offset - trips.length),
    counts: {
      hot: rows.filter((r) => r.overdue > 0 || r.blocked > 0).length,
      travelingSoon: rows.filter((r) => r.departureOffset >= PAST_DAYS && r.departureOffset <= PAST_DAYS + 7).length,
    },
  };
}

export const PAST_WINDOW_DAYS = PAST_DAYS;
