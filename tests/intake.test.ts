import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import {
  copyTravelersFromLastTrip,
  createTrip,
  findClients,
} from "@/lib/trips/service";
import { addTraveler } from "@/lib/trips/travelers";
import { decryptPassport } from "@/lib/crypto/passport";

const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

async function makeClientWithTravelers() {
  const trip = await createTrip({
    client: { name: "משפחת חוזרת", phone: "0543332211" },
    destination: "רודוס",
    templateId: "leisure_package",
    departureLocal: `${inDays(30)}T06:20`,
    departureAirport: "TLV",
    returnLocal: `${inDays(37)}T21:15`,
    returnAirport: "RHO",
    travelers: [],
    priceToClient: 9000,
  });
  await addTraveler(trip.id, {
    firstNameLatin: "REPEAT", lastNameLatin: "ONE",
    passportNumber: "91919191", passportExpiry: "2032-08-01", isLead: true,
  });
  await addTraveler(trip.id, {
    firstNameLatin: "REPEAT", lastNameLatin: "TWO",
    passportNumber: "92929292", passportExpiry: "2033-02-01",
  });
  const full = await prisma.trip.findUniqueOrThrow({ where: { id: trip.id }, select: { clientId: true } });
  return { tripId: trip.id, clientId: full.clientId };
}

describe("לקוח חוזר", () => {
  it("נמצא בחיפוש לפי שם ולפי טלפון", async () => {
    const { clientId } = await makeClientWithTravelers();

    const byName = await findClients("חוזרת");
    expect(byName.some((c) => c.id === clientId)).toBe(true);

    const found = byName.find((c) => c.id === clientId)!;
    expect(found.travelerCount).toBe(2);
    expect(found.lastDestination).toBe("רודוס");

    const byPhone = await findClients("0543332211");
    expect(byPhone.some((c) => c.id === clientId)).toBe(true);

    await prisma.client.delete({ where: { id: clientId } });
  });

  it("חיפוש קצר מדי לא מחזיר כלום, ולא סורק את כל המסד", async () => {
    expect(await findClients("א")).toEqual([]);
    expect(await findClients("")).toEqual([]);
  });

  it("תיק שני ללקוח קיים לא יוצר לקוח כפול", async () => {
    const { clientId } = await makeClientWithTravelers();
    const before = await prisma.client.count();

    const second = await createTrip({
      client: { name: "לא בשימוש", phone: "0500000000" },
      existingClientId: clientId,
      destination: "אתונה",
      templateId: "leisure_package",
      departureLocal: `${inDays(70)}T09:00`,
      departureAirport: "TLV",
      returnLocal: `${inDays(75)}T18:00`,
      returnAirport: "ATH",
      travelers: [],
    });

    expect(await prisma.client.count()).toBe(before);
    const t = await prisma.trip.findUniqueOrThrow({ where: { id: second.id }, select: { clientId: true } });
    expect(t.clientId).toBe(clientId);

    await prisma.client.delete({ where: { id: clientId } });
  });

  it("העתקת נוסעים מביאה גם את הדרכונים, ולא רק את השמות", async () => {
    const { clientId } = await makeClientWithTravelers();

    const second = await createTrip({
      client: { name: "x", phone: "0500000000" },
      existingClientId: clientId,
      destination: "אתונה",
      templateId: "leisure_package",
      departureLocal: `${inDays(70)}T09:00`,
      departureAirport: "TLV",
      returnLocal: `${inDays(75)}T18:00`,
      returnAirport: "ATH",
      travelers: [],
    });

    const result = await copyTravelersFromLastTrip(clientId, second.id);
    expect(result.copied).toBe(2);
    expect(result.withoutPassport).toBe(0);

    const copied = await prisma.traveler.findMany({
      where: { tripId: second.id }, orderBy: { lastNameLatin: "asc" },
    });
    expect(copied.map((t) => t.lastNameLatin)).toEqual(["ONE", "TWO"]);
    expect(decryptPassport(copied[0].passportNumberEnc!)).toBe("91919191");
    // ואיש קשר אחד עבר איתם.
    expect(copied.filter((t) => t.isLead)).toHaveLength(1);

    await prisma.client.delete({ where: { id: clientId } });
  });

  it("תיק קודם שנסגר מעביר שמות ותוקף בלי מספרי דרכון", async () => {
    const { tripId, clientId } = await makeClientWithTravelers();
    const { closeTrip } = await import("@/lib/trips/service");
    await closeTrip(tripId);

    const second = await createTrip({
      client: { name: "x", phone: "0500000000" },
      existingClientId: clientId,
      destination: "אתונה",
      templateId: "leisure_package",
      departureLocal: `${inDays(70)}T09:00`,
      departureAirport: "TLV",
      returnLocal: `${inDays(75)}T18:00`,
      returnAirport: "ATH",
      travelers: [],
    });

    const result = await copyTravelersFromLastTrip(clientId, second.id);
    expect(result.copied).toBe(2);
    expect(result.withoutPassport).toBe(2);

    const copied = await prisma.traveler.findMany({ where: { tripId: second.id } });
    expect(copied.every((t) => t.passportNumberEnc === null)).toBe(true);
    // התוקף כן נשמר, והוא מה שנדרש לבדיקה מול היעד החדש.
    expect(copied.every((t) => t.passportExpiry !== null)).toBe(true);

    await prisma.client.delete({ where: { id: clientId } });
  });
});

describe("שדות שאינם חובה בפתיחה", () => {
  it("תיק נפתח בלי שעות טיסה ובלי חברת תעופה", async () => {
    const trip = await createTrip({
      client: { name: "בלי פרטים", phone: "0521110000" },
      destination: "פראג",
      templateId: "leisure_package",
      departureLocal: `${inDays(60)}T08:00`,
      departureAirport: "TLV",
      returnLocal: `${inDays(65)}T20:00`,
      returnAirport: "PRG",
      travelers: [],
    });

    const full = await prisma.trip.findUniqueOrThrow({
      where: { id: trip.id },
      select: { clientId: true, components: true, milestones: { select: { key: true } } },
    });

    // בלי טיסה אין אבני דרך של צ'ק-אין, אבל כל השאר נוצר כרגיל.
    expect(full.components).toHaveLength(0);
    expect(full.milestones.some((m) => m.key === "send_documents")).toBe(true);
    expect(full.milestones.some((m) => m.key.startsWith("checkin_"))).toBe(false);

    await prisma.client.delete({ where: { id: full.clientId } });
  });
});
