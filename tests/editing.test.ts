import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { saveFlight } from "@/lib/trips/flights";
import {
  duplicateTrip, closeTrip, updateClient } from "@/lib/trips/service";
import { getPublicTrip } from "@/lib/trips/publicView";
import { addTraveler } from "@/lib/trips/travelers";

const someTrip = () =>
  prisma.trip.findFirst({ where: { status: "active" }, select: { id: true, publicToken: true, departureLocal: true } });

describe("הזנת טיסה אחרי פתיחת התיק", () => {
  it("טיסה חדשה יוצרת את אבני הדרך של הצ'ק-אין", async () => {
    const trip = await someTrip();
    if (!trip) return;

    const c = await prisma.component.create({
      data: { tripId: trip.id, type: "flight", status: "requested", description: "בדיקה", sortOrder: 99 },
    });

    // לפני ההזנה אין חלון צ'ק-אין, ולכן אין אבני דרך שנגזרות ממנו.
    const date = trip.departureLocal.slice(0, 10);
    await saveFlight(c.id, {
      direction: "outbound", airlineCode: "W6", flightNumber: "4351",
      departsAirport: "TLV", departsDate: date, departsTime: "07:40",
      arrivesAirport: "BCN", arrivesTime: "11:20",
    });

    const flight = await prisma.flight.findUniqueOrThrow({ where: { componentId: c.id } });
    expect(flight.checkinOpensAt).not.toBeNull();
    expect(flight.checkinClosesAt).not.toBeNull();
    // W6 סוגרת שלוש שעות לפני ההמראה.
    expect(
      (flight.departsAtUtc!.getTime() - flight.checkinClosesAt!.getTime()) / 3_600_000,
    ).toBe(3);

    await prisma.component.delete({ where: { id: c.id } });
  });

  it("שעת נחיתה לפני ההמראה נדחית עם הסבר", async () => {
    const trip = await someTrip();
    if (!trip) return;
    const c = await prisma.component.create({
      data: { tripId: trip.id, type: "flight", status: "requested", sortOrder: 98 },
    });

    await expect(
      saveFlight(c.id, {
        direction: "outbound", airlineCode: "A3", flightNumber: "1",
        departsAirport: "TLV", departsDate: "2027-05-01", departsTime: "10:00",
        arrivesAirport: "ATH", arrivesTime: "09:00",
      }),
    ).rejects.toThrow(/לפני ההמראה/);

    await prisma.component.delete({ where: { id: c.id } });
  });

  it("שדה תעופה לא מוכר נחסם, כדי שלא תיווצר הנחת אזור זמן שגויה", async () => {
    const trip = await someTrip();
    if (!trip) return;
    const c = await prisma.component.create({
      data: { tripId: trip.id, type: "flight", status: "requested", sortOrder: 97 },
    });

    await expect(
      saveFlight(c.id, {
        direction: "outbound", airlineCode: "A3", flightNumber: "1",
        departsAirport: "TLV", departsDate: "2027-05-01", departsTime: "10:00",
        arrivesAirport: "ZZZ",
      }),
    ).rejects.toThrow(/לא מוכר/);

    await prisma.component.delete({ where: { id: c.id } });
  });
});

describe("עריכת פרטי לקוח", () => {
  it("טלפון לא תקין נדחה", async () => {
    const trip = await someTrip();
    if (!trip) return;
    await expect(
      updateClient(trip.id, { name: "בדיקה", phone: "לא מספר" }),
    ).rejects.toThrow(/לא נראה תקין/);
  });

  it("עדכון טלפון משנה את היעד של ההודעות", async () => {
    const trip = await prisma.trip.findFirst({
      where: { status: "active" },
      select: { id: true, client: { select: { name: true, phone: true, email: true } } },
    });
    if (!trip) return;

    const original = trip.client;
    await updateClient(trip.id, { name: original.name, phone: "052-9998877" });
    const after = await prisma.trip.findUniqueOrThrow({
      where: { id: trip.id }, select: { client: { select: { phone: true } } },
    });
    expect(after.client.phone).toBe("052-9998877");

    await updateClient(trip.id, { name: original.name, phone: original.phone, email: original.email });
  });
});

describe("סגירת תיק — סעיף 10", () => {
  it("מוחקת מספרי דרכון, משאירה תוקף, ומכבה את הקישור ללקוח", async () => {
    const trip = await prisma.trip.findFirst({
      where: { status: "active" },
      select: { id: true, status: true, publicToken: true },
    });
    if (!trip) return;

    const travelerId = await addTraveler(trip.id, {
      firstNameLatin: "CLOSE", lastNameLatin: "TEST",
      passportNumber: "77778888", passportExpiry: "2033-01-01",
    });

    expect(await getPublicTrip(trip.publicToken)).not.toBeNull();

    await closeTrip(trip.id);

    const t = await prisma.traveler.findUniqueOrThrow({ where: { id: travelerId } });
    expect(t.passportNumberEnc).toBeNull();
    expect(t.passportLast4).toBeNull();
    // התוקף נשאר: הוא נדרש להזמנה הבאה ואינו מזהה כשלעצמו.
    expect(t.passportExpiry).not.toBeNull();
    expect(t.firstNameLatin).toBe("CLOSE");

    // הקישור של הלקוח מת מעצמו.
    expect(await getPublicTrip(trip.publicToken)).toBeNull();

    await prisma.traveler.delete({ where: { id: travelerId } });
    await prisma.trip.update({ where: { id: trip.id }, data: { status: trip.status } });
  });
});

describe("שכפול נסיעה", () => {
  it("מעתיק יעד ומחיר, מתחיל גבייה מאפס, ולא מעתיק מספרי דרכון", async () => {
    const source = await prisma.trip.findFirst({
      where: { travelers: { some: {} } },
      include: { travelers: true, client: true },
    });
    if (!source) return;

    const dep = "2027-04-11";
    const ret = "2027-04-18";

    const created = await duplicateTrip({
      sourceTripId: source.id,
      departureDate: dep,
      returnDate: ret,
      copyTravelers: true,
    });

    const copy = await prisma.trip.findUniqueOrThrow({
      where: { id: created.id },
      include: { travelers: true },
    });

    try {
      expect(copy.id).not.toBe(source.id);
      expect(copy.clientId).toBe(source.clientId);
      expect(copy.destination).toBe(source.destination);
      expect(copy.priceToClient).toBe(source.priceToClient);

      // גבייה מתחילה מאפס — נסיעה חדשה לא שולמה.
      expect(copy.amountPaid).toBe(0);

      expect(copy.departureLocal.slice(0, 10)).toBe(dep);
      expect(copy.returnLocal.slice(0, 10)).toBe(ret);
      // שעות היום נשמרות: מי ששכפל טיסת בוקר מצפה לטיסת בוקר.
      expect(copy.departureLocal.slice(11, 16)).toBe(source.departureLocal.slice(11, 16));

      expect(copy.travelers.length).toBe(source.travelers.length);
      // השמות עוברים, הדרכונים לא — הם עשויים לפוג בין נסיעה לנסיעה.
      for (const t of copy.travelers) {
        expect(t.passportNumberEnc).toBeNull();
        expect(t.passportExpiry).toBeNull();
      }
      expect(copy.travelers.map((t) => t.lastNameLatin).sort()).toEqual(
        source.travelers.map((t) => t.lastNameLatin).sort(),
      );
    } finally {
      await prisma.trip.delete({ where: { id: copy.id } });
    }
  });

  it("חזרה לפני היציאה נדחית", async () => {
    const source = await prisma.trip.findFirst({ select: { id: true } });
    if (!source) return;

    await expect(
      duplicateTrip({ sourceTripId: source.id, departureDate: "2027-05-10", returnDate: "2027-05-03" }),
    ).rejects.toThrow();
  });
});
