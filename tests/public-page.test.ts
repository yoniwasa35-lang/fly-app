import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { getPublicTrip } from "@/lib/trips/publicView";
import { looksLikePublicToken, newPublicToken } from "@/lib/trips/publicToken";
import { decryptPassport } from "@/lib/crypto/passport";

/**
 * עמוד הלקוח יושב על URL פתוח בלי התחברות. הבדיקות כאן הן בעיקר על מה
 * שאסור שייצא ממנו, לא על מה שכן.
 */

const anyTrip = () =>
  prisma.trip.findFirst({
    where: { status: { in: ["active", "traveling"] } },
    include: { travelers: true, client: true },
  });

describe("הטוקן", () => {
  it("אקראי, ארוך, ובטוח לכתובת", () => {
    const a = newPublicToken();
    expect(a.length).toBeGreaterThanOrEqual(30);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(encodeURIComponent(a)).toBe(a);
    expect(looksLikePublicToken(a)).toBe(true);
  });

  it("לא חוזר על עצמו", () => {
    const tokens = new Set(Array.from({ length: 500 }, newPublicToken));
    expect(tokens.size).toBe(500);
  });

  it("טוקן קצר או ריק נדחה בלי לגעת במסד", async () => {
    for (const bad of ["", "abc", "123456789"]) {
      expect(await getPublicTrip(bad)).toBeNull();
    }
  });

  it("טוקן שלא קיים מחזיר null ולא שגיאה", async () => {
    expect(await getPublicTrip(newPublicToken())).toBeNull();
  });
});

describe("מה אסור שיצא החוצה", () => {
  it("שום שדה רגיש לא מופיע בתשובה", async () => {
    const trip = await anyTrip();
    if (!trip) return;

    const view = await getPublicTrip(trip.publicToken);
    expect(view).not.toBeNull();

    const json = JSON.stringify(view);

    // כסף פנימי
    expect(json).not.toContain(String(trip.supplierCost));
    expect(json).not.toContain("supplierCost");
    expect(json).not.toContain("hostFeeRate");
    expect(json).not.toContain("margin");

    // זהות. הבדיקה היא על מספר הדרכון המפוענח עצמו, לא על ארבע ספרות
    // אחרונות — מחרוזת בת ארבע ספרות מתנגשת במקרה עם מספרי טלפון ותאריכים,
    // ובדיקה שנופלת על התנגשות כזו היא בדיקה שמישהו יבטל.
    expect(json).not.toContain("passportNumber");
    expect(json).not.toContain("passportLast4");
    expect(json).not.toContain("dateOfBirth");
    for (const t of trip.travelers) {
      if (t.passportNumberEnc) {
        expect(json).not.toContain(t.passportNumberEnc);
        expect(json).not.toContain(decryptPassport(t.passportNumberEnc));
      }
      if (t.firstNameLatin) expect(json).not.toContain(t.firstNameLatin);
    }

    // פנימי
    expect(json).not.toContain("internalNotes");
    expect(json).not.toContain("skipReason");
    expect(json).not.toContain("blockedBy");
  });

  it("מודל התצוגה חושף רק את המפתחות המותרים", async () => {
    const trip = await anyTrip();
    if (!trip) return;
    const view = (await getPublicTrip(trip.publicToken))!;

    expect(Object.keys(view).sort()).toEqual(
      [
        "agent", "booked", "clientName", "code", "countdown", "departureAt",
        "departureLabel", "destination", "flights", "inbound", "phase", "returnAt",
        "returnLabel", "status", "traveling", "travelerCount", "todos", "upsells",
      ].sort(),
    );
  });

  it("הטוקן עצמו לא מוחזר בתוך מודל התצוגה", async () => {
    const trip = await anyTrip();
    if (!trip) return;
    const view = (await getPublicTrip(trip.publicToken))!;
    expect(JSON.stringify(view)).not.toContain(trip.publicToken);
  });

  it("תיק סגור מפסיק להציג — הקישור מת מעצמו", async () => {
    const trip = await anyTrip();
    if (!trip) return;

    const original = trip.status;
    await prisma.trip.update({ where: { id: trip.id }, data: { status: "closed" } });
    expect(await getPublicTrip(trip.publicToken)).toBeNull();
    await prisma.trip.update({ where: { id: trip.id }, data: { status: original } });
  });
});

describe("מה כן מוצג", () => {
  it("ספירה לאחור, יעד ומועדים", async () => {
    const trip = await anyTrip();
    if (!trip) return;
    const view = (await getPublicTrip(trip.publicToken))!;
    expect(view.destination).toBe(trip.destination);
    expect(view.clientName).toBe(trip.client.name);
    expect(view.countdown).toMatch(/בעוד|לפני|עכשיו/);
    expect(view.code).toBe(trip.code);
  });

  it("רק רכיבים מאושרים מופיעים כ'מה סגור'", async () => {
    const trip = await prisma.trip.findFirst({
      where: { status: { in: ["active", "traveling"] }, components: { some: { status: "requested" } } },
      include: { components: { include: { flight: true } } },
    });
    if (!trip) return;

    const view = (await getPublicTrip(trip.publicToken))!;
    const unresolved = trip.components.filter((c) => c.status === "requested" && !c.flight);
    for (const c of unresolved) {
      if (c.description) {
        expect(view.booked.some((b) => b.description === c.description)).toBe(false);
      }
    }
  });

  it("שעות הטיסה הן בשעון השדה ולא בשעון ישראל", async () => {
    const trip = await prisma.trip.findFirst({
      where: { status: { in: ["active", "traveling"] }, components: { some: { flight: { isNot: null } } } },
      include: { components: { include: { flight: true } } },
    });
    if (!trip) return;

    const view = (await getPublicTrip(trip.publicToken))!;
    for (const f of view.flights) {
      const source = trip.components.find(
        (c) => c.flight && `${c.flight.airlineCode} ${c.flight.flightNumber}`.trim() === f.flightNumber,
      );
      if (source?.flight) {
        expect(f.departsTime).toBe(source.flight.departsAtLocal.slice(11, 16));
      }
    }
  });

  it("כשהתיק בנסיעה, טיסת החזור זמינה לראש העמוד", async () => {
    const trip = await prisma.trip.findFirst({
      where: { status: "traveling", components: { some: { flight: { direction: "inbound" } } } },
    });
    if (!trip) return;
    const view = (await getPublicTrip(trip.publicToken))!;
    expect(view.traveling).toBe(true);
    expect(view.inbound).not.toBeNull();
  });
});

describe("שלב הנסיעה נגזר מהזמן, לא רק מהסטטוס", () => {
  it("תיק שכבר המריא מוצג כבנסיעה גם לפני שה-job עדכן אותו", async () => {
    const trip = await prisma.trip.findFirst({ where: { status: "active" } });
    if (!trip) return;

    const original = { departureAt: trip.departureAt, returnAt: trip.returnAt };
    const now = new Date();
    await prisma.trip.update({
      where: { id: trip.id },
      data: {
        departureAt: new Date(now.getTime() - 2 * 86_400_000),
        returnAt: new Date(now.getTime() + 3 * 86_400_000),
      },
    });

    const view = (await getPublicTrip(trip.publicToken))!;
    // הסטטוס במסד עדיין active, אבל הלקוח באוויר.
    expect(view.status).toBe("active");
    expect(view.phase).toBe("traveling");
    expect(view.traveling).toBe(true);

    await prisma.trip.update({ where: { id: trip.id }, data: original });
  });

  it("תיק שחזר מוצג כחזר, בלי ספירה לאחור", async () => {
    const trip = await prisma.trip.findFirst({ where: { status: "active" } });
    if (!trip) return;

    const original = { departureAt: trip.departureAt, returnAt: trip.returnAt };
    const now = new Date();
    await prisma.trip.update({
      where: { id: trip.id },
      data: {
        departureAt: new Date(now.getTime() - 10 * 86_400_000),
        returnAt: new Date(now.getTime() - 3 * 86_400_000),
      },
    });

    expect((await getPublicTrip(trip.publicToken))!.phase).toBe("returned");

    await prisma.trip.update({ where: { id: trip.id }, data: original });
  });

  it("תיק עתידי נשאר בשלב 'לפני'", async () => {
    const trip = await prisma.trip.findFirst({
      where: { status: "active", departureAt: { gt: new Date(Date.now() + 86_400_000) } },
    });
    if (!trip) return;
    const view = (await getPublicTrip(trip.publicToken))!;
    expect(view.phase).toBe("before");
    expect(view.countdown).toMatch(/^בעוד/);
  });
});

describe("שעת נחיתה", () => {
  it("לא מומצאת: טיסה בלי שעת נחיתה מחזירה null ולא את שעת ההמראה", async () => {
    const flight = await prisma.flight.findFirst({
      where: { arrivesAtLocal: null },
      select: { componentId: true, component: { select: { trip: { select: { publicToken: true } } } } },
    });
    if (!flight) return;

    const view = (await getPublicTrip(flight.component.trip.publicToken))!;
    for (const f of view.flights) {
      // אם היא קיימת, היא חייבת להיות אמיתית ולא שכפול של ההמראה.
      if (f.arrivesTime !== null) expect(f.arrivesTime).not.toBe(f.departsTime);
    }
  });

  it("אין בנתונים טיסה שנוחתת בדיוק כשהיא ממריאה", async () => {
    const flights = await prisma.flight.findMany({
      select: { departsAtLocal: true, arrivesAtLocal: true },
    });
    const suspicious = flights.filter((f) => f.arrivesAtLocal && f.arrivesAtLocal === f.departsAtLocal);
    expect(suspicious).toEqual([]);
  });
});
