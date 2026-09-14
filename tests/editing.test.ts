import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { saveFlight } from "@/lib/trips/flights";
import { closeTrip, updateClient } from "@/lib/trips/service";
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
