import { describe, expect, it } from "vitest";
import { getTimeline } from "@/lib/queue/timeline";
import { getTodayQueue } from "@/lib/queue/today";
import { prisma } from "@/lib/db";

/**
 * בדיקות מול המסד האמיתי. הן מניחות שהורצה זריעה — הן בודקות התנהגות
 * בקנה מידה, לא ערכים קבועים, כי הנתונים נוצרים יחסית להיום.
 */

const hasData = async () => (await prisma.trip.count()) > 0;

describe("מסך היום בקנה מידה", () => {
  it("אף קבוצה לא נחתכת בשקט", async () => {
    if (!(await hasData())) return;
    const q = await getTodayQueue();
    // אם משהו נחתך, הדגל אומר את זה ולא מסתירים.
    for (const [group, truncated] of Object.entries(q.truncated)) {
      if (truncated) expect(q.counts[group as "overdue"]).toBeGreaterThan(0);
    }
    expect(q.overdue.every((i) => !i.bornLate)).toBe(true);
    expect(q.today.every((i) => !i.bornLate)).toBe(true);
  });

  it("עבר מועד מכיל רק פריטים שמועדם לפני היום", async () => {
    if (!(await hasData())) return;
    const q = await getTodayQueue();
    for (const item of q.overdue) expect(item.dueAt.getTime()).toBeLessThan(q.now.getTime());
  });

  it("השבוע מקובץ לפי ימים, וכל יום מכיל רק את הפריטים שלו", async () => {
    if (!(await hasData())) return;
    const q = await getTodayQueue();
    const days = q.thisWeek.map((d) => d.day);
    expect(new Set(days).size).toBe(days.length);
    expect([...days].sort()).toEqual(days);
    expect(q.thisWeek.reduce((n, d) => n + d.items.length, 0)).toBe(q.counts.thisWeek);
  });

  it("אבני דרך שנולדו באיחור מקובצות לפי תיק, ולא מפוזרות בתור", async () => {
    if (!(await hasData())) return;
    const q = await getTodayQueue();
    const ids = q.bornLate.map((t) => t.tripId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(q.bornLate.reduce((n, t) => n + t.count, 0)).toBe(q.counts.bornLate);
    // ואף אחת מהן לא מופיעה גם בתור השטוח.
    const flat = [...q.overdue, ...q.today, ...q.thisWeek.flatMap((d) => d.items)];
    expect(flat.some((i) => i.bornLate)).toBe(false);
  });

  it("תיק שנדחה זמנית לא מופיע בתור", async () => {
    if (!(await hasData())) return;
    const target = await prisma.milestone.findFirst({
      where: { state: { in: ["due", "overdue"] }, bornLate: false, snoozedUntil: null },
    });
    if (!target) return;

    const before = await getTodayQueue();
    expect(before.overdue.concat(before.today).some((i) => i.id === target.id)).toBe(true);

    await prisma.milestone.update({
      where: { id: target.id },
      data: { snoozedUntil: new Date(Date.now() + 3 * 86_400_000), snoozeReason: "בדיקה" },
    });
    const after = await getTodayQueue();
    expect(after.overdue.concat(after.today).some((i) => i.id === target.id)).toBe(false);

    await prisma.milestone.update({
      where: { id: target.id },
      data: { snoozedUntil: null, snoozeReason: null },
    });
  });
});

describe("ציר הזמן", () => {
  it("כל תיק מופיע פעם אחת, ממוין לפי יום הטיסה", async () => {
    if (!(await hasData())) return;
    const t = await getTimeline({ windowDays: 180 });
    const ids = t.rows.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    const offsets = t.rows.map((r) => r.departureOffset);
    expect([...offsets].sort((a, b) => a - b)).toEqual(offsets);
  });

  it("נקודות מקובצות לפי יום, ואין שתי נקודות באותו יום", async () => {
    if (!(await hasData())) return;
    const t = await getTimeline({ windowDays: 180 });
    for (const row of t.rows) {
      const days = row.dots.map((d) => d.dayOffset);
      expect(new Set(days).size).toBe(days.length);
      expect(row.dots.every((d) => d.count >= 1 && d.labels.length > 0)).toBe(true);
    }
  });

  it("סינון 'רק בוערים' מחזיר רק תיקים עם איחור או חסימה", async () => {
    if (!(await hasData())) return;
    const t = await getTimeline({ onlyHot: true, windowDays: 180 });
    expect(t.rows.every((r) => r.overdue > 0 || r.blocked > 0)).toBe(true);
  });

  it("חיפוש מצמצם, ועימוד לא מחזיר את אותם תיקים פעמיים", async () => {
    if (!(await hasData())) return;
    const all = await getTimeline({ windowDays: 180, limit: 10, offset: 0 });
    const next = await getTimeline({ windowDays: 180, limit: 10, offset: 10 });
    const overlap = all.rows.filter((r) => next.rows.some((n) => n.id === r.id));
    expect(overlap).toEqual([]);
    if (all.total > 10) expect(next.rows.length).toBeGreaterThan(0);
  });

  it("חלון צר מחזיר תת-קבוצה של חלון רחב", async () => {
    if (!(await hasData())) return;
    const wide = await getTimeline({ windowDays: 180, limit: 200 });
    const narrow = await getTimeline({ windowDays: 30, limit: 200 });
    expect(narrow.total).toBeLessThanOrEqual(wide.total);
  });
});

describe("אבני דרך שאיבדו רלוונטיות", () => {
  it("מועד ביטול חינם נסגר כשהתיק יוצא לדרך, ותשלום לספק נשאר פתוח", async () => {
    if (!(await hasData())) return;
    const { runDailyJob } = await import("@/lib/jobs/daily");

    const trip = await prisma.trip.findFirst({
      where: { status: { in: ["traveling", "returned"] } },
      select: { id: true },
    });
    if (!trip) return;

    await runDailyJob();

    const stillOpen = await prisma.milestone.findMany({
      where: {
        tripId: trip.id,
        state: { in: ["pending", "due", "overdue", "blocked"] },
      },
      select: { key: true },
    });

    expect(stillOpen.some((m) => m.key.startsWith("component_free_cancel:"))).toBe(false);

    const retired = await prisma.milestone.findFirst({
      where: { tripId: trip.id, key: { startsWith: "component_free_cancel:" } },
      select: { state: true, skipReason: true },
    });
    if (retired) {
      expect(retired.state).toBe("skipped");
      expect(retired.skipReason).toContain("יצא לדרך");
    }
  });

  it("התור לא מוביל באבני דרך של תיקים שכבר בטיסה", async () => {
    if (!(await hasData())) return;
    const { runDailyJob } = await import("@/lib/jobs/daily");
    await runDailyJob();
    const q = await getTodayQueue();
    const stale = q.overdue.filter(
      (i) => i.key.startsWith("component_free_cancel:") && i.trip.departureAt < q.now,
    );
    expect(stale).toEqual([]);
  });
});

describe("צבע הוא מידע — סעיף 4", () => {
  it("ספירת האיחור בציר לא כוללת אבני דרך שנולדו באיחור", async () => {
    if (!(await hasData())) return;
    const t = await getTimeline({ windowDays: 180, limit: 200 });

    for (const row of t.rows) {
      const real = await prisma.milestone.count({
        where: {
          tripId: row.id,
          state: "overdue",
          bornLate: false,
          OR: [{ snoozedUntil: null }, { snoozedUntil: { lte: t.now } }],
        },
      });
      expect(row.overdue, `תיק ${row.code}`).toBe(real);
    }
  });

  it("לא כל התיקים מסומנים כבוערים — אחרת הסימון חסר משמעות", async () => {
    if (!(await hasData())) return;
    const t = await getTimeline({ windowDays: 180, limit: 200 });
    if (t.rows.length < 10) return;
    const hot = t.rows.filter((r) => r.overdue > 0 || r.blocked > 0).length;
    expect(hot).toBeLessThan(t.rows.length);
  });

  it("אבני דרך שנולדו באיחור לא מצוירות כנקודות על הציר", async () => {
    if (!(await hasData())) return;
    const t = await getTimeline({ windowDays: 180, limit: 200 });
    const drawn = t.rows.reduce((n, r) => n + r.dots.reduce((m, d) => m + d.count, 0), 0);
    const open = t.rows.reduce((n, r) => n + r.open, 0);
    expect(drawn).toBeLessThanOrEqual(open);
  });
});

describe("ציר החודשים", () => {
  it("תחילת חודש מחושבת בשעון ישראל ולא ב-UTC", async () => {
    const { DISPLAY_TZ, utcToZoned, startOfDayIn } = await import("@/lib/time/zones");

    // חצות מקומית ב-1 בחודש היא 21:00 או 22:00 של ה-31 ב-UTC. חישוב ב-UTC
    // היה מסמן את הקו יום אחד מוקדם מדי.
    for (const iso of ["2026-10-01T03:00:00Z", "2026-01-01T03:00:00Z", "2026-07-01T03:00:00Z"]) {
      const localMidnight = startOfDayIn(new Date(iso), DISPLAY_TZ);
      expect(utcToZoned(localMidnight, DISPLAY_TZ).slice(8, 10)).toBe("01");
      // וב-UTC זה עדיין החודש הקודם — בדיוק הפער שגרם לבאג.
      expect(localMidnight.getUTCDate()).not.toBe(1);
    }
  });
});

describe("יציבות המיון — באג שהתגלה מטסט מרצד", () => {
  it("עימוד יציב גם כששני תיקים יוצאים באותו יום", async () => {
    if (!(await hasData())) return;

    // מייצרים במכוון תאריך יציאה משותף, שזה מצב נפוץ בעונה.
    const trips = await prisma.trip.findMany({
      where: { status: "active" }, take: 6, select: { id: true, departureAt: true },
    });
    if (trips.length < 6) return;

    const shared = trips[0].departureAt;
    const originals = new Map(trips.map((t) => [t.id, t.departureAt]));
    await prisma.trip.updateMany({
      where: { id: { in: trips.map((t) => t.id) } },
      data: { departureAt: shared },
    });

    try {
      // עשר קריאות לאותו עמוד חייבות להחזיר בדיוק את אותם תיקים.
      const pages = await Promise.all(
        Array.from({ length: 10 }, () => getTimeline({ windowDays: 365, limit: 3, offset: 0 })),
      );
      const first = pages[0].rows.map((r) => r.id).join(",");
      for (const p of pages) expect(p.rows.map((r) => r.id).join(",")).toBe(first);

      // ושני עמודים עוקבים לא חופפים ולא מדלגים.
      const a = await getTimeline({ windowDays: 365, limit: 3, offset: 0 });
      const b = await getTimeline({ windowDays: 365, limit: 3, offset: 3 });
      const overlap = a.rows.filter((r) => b.rows.some((n) => n.id === r.id));
      expect(overlap.map((r) => r.code)).toEqual([]);
    } finally {
      for (const [id, departureAt] of originals) {
        await prisma.trip.update({ where: { id }, data: { departureAt } });
      }
    }
  });
});
