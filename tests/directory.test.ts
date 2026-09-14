import { describe, expect, it } from "vitest";
import { getClient, listClients } from "@/lib/clients/directory";
import { listTasks } from "@/lib/queue/tasks";
import { prisma } from "@/lib/db";
import { DISPLAY_TZ, endOfDayIn } from "@/lib/time/zones";

/**
 * בדיקות מול המסד האמיתי, על הנתונים שהזריעה מייצרת. הן בודקות התנהגות
 * ולא ערכים קבועים, כי הנתונים נוצרים יחסית להיום.
 */

const hasData = async () => (await prisma.client.count()) > 0;

describe("ספריית הלקוחות", () => {
  it("מחזירה כל לקוח פעם אחת, עם מספר הנסיעות שלו", async () => {
    if (!(await hasData())) return;
    const dir = await listClients();

    const ids = dir.rows.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const row of dir.rows) {
      expect(row.tripCount).toBe(await prisma.trip.count({ where: { clientId: row.id } }));
    }
  });

  it("הנסיעה שמוצגת היא הקרובה ביותר מבין הפתוחות", async () => {
    if (!(await hasData())) return;
    const dir = await listClients();

    for (const row of dir.rows) {
      if (!row.next) continue;
      const earliest = await prisma.trip.findFirst({
        where: { clientId: row.id, status: { in: ["draft", "active", "traveling"] } },
        orderBy: [{ departureAt: "asc" }, { id: "asc" }],
        select: { id: true },
      });
      expect(row.next.id).toBe(earliest?.id);
    }
  });

  it("חיפוש לפי שם מצמצם, ולא מחזיר את מי שלא תואם", async () => {
    if (!(await hasData())) return;
    const all = await listClients();
    const target = all.rows[0];
    const part = target.name.slice(0, 3);

    const found = await listClients({ query: part });
    expect(found.rows.some((r) => r.id === target.id)).toBe(true);
    for (const r of found.rows) {
      const matches = r.name.includes(part) || r.phone.includes(part);
      expect(matches).toBe(true);
    }
  });

  it("חיפוש לפי טלפון עובד גם כשמקלידים אותו עם מקפים", async () => {
    if (!(await hasData())) return;
    const target = (await listClients()).rows[0];
    const digits = target.phone.replace(/\D/g, "");
    if (digits.length < 7) return;

    // אותו מספר, מוקלד בצורה אחרת ממה ששמור במסד.
    const typed = `${digits.slice(0, 3)}-${digits.slice(3)}`;
    const found = await listClients({ query: typed });
    expect(found.rows.some((r) => r.id === target.id)).toBe(true);
  });

  it("עמוד לקוח מחזיר את הנסיעות שלו בלבד, מהאחרונה לראשונה", async () => {
    if (!(await hasData())) return;
    const first = (await listClients()).rows[0];
    const profile = await getClient(first.id);
    expect(profile).not.toBeNull();

    const dates = profile!.trips.map((t) => t.departureAt.getTime());
    expect([...dates].sort((a, b) => b - a)).toEqual(dates);

    for (const t of profile!.trips) {
      const owner = await prisma.trip.findUnique({ where: { id: t.id }, select: { clientId: true } });
      expect(owner?.clientId).toBe(first.id);
    }
  });

  it("לקוח שלא קיים מחזיר null ולא זורק", async () => {
    expect(await getClient("no-such-client-id")).toBeNull();
  });
});

describe("מסך המשימות", () => {
  it("שלוש הלשוניות זרות זו לזו — אף משימה לא מופיעה בשתיים", async () => {
    if (!(await hasData())) return;

    const [today, upcoming, done] = await Promise.all([
      listTasks({ tab: "today" }),
      listTasks({ tab: "upcoming" }),
      listTasks({ tab: "done" }),
    ]);

    const ids = [today, upcoming, done].map((l) => new Set(l.items.map((i) => i.id)));
    for (let a = 0; a < ids.length; a++) {
      for (let b = a + 1; b < ids.length; b++) {
        for (const id of ids[a]) expect(ids[b].has(id)).toBe(false);
      }
    }
  });

  it("״היום״ אינו מכיל שום דבר שמועדו אחרי סוף היום", async () => {
    if (!(await hasData())) return;
    const list = await listTasks({ tab: "today" });
    const end = endOfDayIn(list.now, DISPLAY_TZ);
    for (const item of list.items) {
      expect(item.dueAt.getTime()).toBeLessThan(end.getTime());
    }
  });

  it("״בהמשך״ אינו מכיל שום דבר שמועדו כבר עבר", async () => {
    if (!(await hasData())) return;
    const list = await listTasks({ tab: "upcoming" });
    const end = endOfDayIn(list.now, DISPLAY_TZ);
    for (const item of list.items) {
      expect(item.dueAt.getTime()).toBeGreaterThanOrEqual(end.getTime());
    }
  });

  it("״הושלמו״ מכיל רק מצבים סופיים, ומסודר מהאחרון לראשון", async () => {
    if (!(await hasData())) return;
    const list = await listTasks({ tab: "done" });
    for (const item of list.items) {
      expect(["done", "skipped"]).toContain(item.state);
    }
    const dates = list.items.map((i) => i.dueAt.getTime());
    expect([...dates].sort((a, b) => b - a)).toEqual(dates);
  });

  it("החיפוש מצמצם את הרשימה ואת המונים יחד איתה", async () => {
    if (!(await hasData())) return;
    const all = await listTasks({ tab: "today" });
    if (all.items.length === 0) return;

    const name = all.items[0].trip.clientName;
    const filtered = await listTasks({ tab: "today", query: name });

    expect(filtered.counts.today).toBeLessThanOrEqual(all.counts.today);
    for (const item of filtered.items) {
      const hit =
        item.title.includes(name) ||
        item.trip.clientName.includes(name) ||
        item.trip.destination.includes(name) ||
        item.trip.code.includes(name);
      expect(hit).toBe(true);
    }
  });
});
