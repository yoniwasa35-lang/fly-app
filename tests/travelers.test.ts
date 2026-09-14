import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import {
  addTraveler,
  removeTraveler,
  revealPassport,
  updateTraveler,
} from "@/lib/trips/travelers";
import { getPublicTrip } from "@/lib/trips/publicView";

const someTrip = () => prisma.trip.findFirst({ where: { status: "active" }, select: { id: true, publicToken: true } });

async function withScratchTraveler<T>(fn: (tripId: string, travelerId: string) => Promise<T>): Promise<T | undefined> {
  const trip = await someTrip();
  if (!trip) return;
  const id = await addTraveler(trip.id, {
    firstNameLatin: "test", lastNameLatin: "case", passportNumber: "98765432",
    passportExpiry: "2033-04-01",
  });
  try {
    return await fn(trip.id, id);
  } finally {
    await prisma.traveler.deleteMany({ where: { id } });
  }
}

describe("הזנת נוסעים", () => {
  it("שם לטיני מנורמל לאותיות גדולות, כמו בדרכון", async () => {
    await withScratchTraveler(async (_trip, id) => {
      const t = await prisma.traveler.findUniqueOrThrow({ where: { id } });
      expect(t.firstNameLatin).toBe("TEST");
      expect(t.lastNameLatin).toBe("CASE");
    });
  });

  it("שם בעברית בשדה הלטיני נדחה עם הסבר", async () => {
    const trip = await someTrip();
    if (!trip) return;
    await expect(
      addTraveler(trip.id, { firstNameLatin: "דנה", lastNameLatin: "COHEN" }),
    ).rejects.toThrow(/אותיות לטיניות/);
  });

  it("מספר הדרכון נשמר מוצפן, ולא בטקסט גלוי", async () => {
    await withScratchTraveler(async (_trip, id) => {
      const t = await prisma.traveler.findUniqueOrThrow({ where: { id } });
      expect(t.passportNumberEnc).not.toContain("98765432");
      expect(t.passportLast4).toBe("5432");
      expect(await revealPassport(id)).toBe("98765432");
    });
  });

  it("עריכה בלי מספר דרכון לא מוחקת את הקיים", async () => {
    await withScratchTraveler(async (_trip, id) => {
      await updateTraveler(id, {
        firstNameLatin: "TEST", lastNameLatin: "CASE", passportNumber: "",
      });
      expect(await revealPassport(id)).toBe("98765432");
    });
  });

  it("מספר דרכון חדש מחליף את הישן", async () => {
    await withScratchTraveler(async (_trip, id) => {
      await updateTraveler(id, {
        firstNameLatin: "TEST", lastNameLatin: "CASE", passportNumber: "11112222",
      });
      expect(await revealPassport(id)).toBe("11112222");
      const t = await prisma.traveler.findUniqueOrThrow({ where: { id } });
      expect(t.passportLast4).toBe("2222");
    });
  });
});

describe("איש הקשר", () => {
  it("תמיד יש בדיוק אחד", async () => {
    const trip = await someTrip();
    if (!trip) return;

    const a = await addTraveler(trip.id, { firstNameLatin: "AAA", lastNameLatin: "AAA", isLead: true });
    const b = await addTraveler(trip.id, { firstNameLatin: "BBB", lastNameLatin: "BBB", isLead: true });

    const leads = await prisma.traveler.count({ where: { tripId: trip.id, isLead: true } });
    expect(leads).toBe(1);
    expect((await prisma.traveler.findUniqueOrThrow({ where: { id: b } })).isLead).toBe(true);

    // מחיקת איש הקשר מעבירה את התפקיד הלאה — תיק בלי איש קשר לא ניתן לתקשורת.
    await removeTraveler(b);
    expect(await prisma.traveler.count({ where: { tripId: trip.id, isLead: true } })).toBe(1);

    await prisma.traveler.deleteMany({ where: { id: { in: [a, b] } } });
  });
});

describe("השרשרת שנפתחה בזכות הזנת נוסעים", () => {
  it("דרכון שפג מוקדם מדי מייצר אבן דרך אדומה", async () => {
    const trip = await someTrip();
    if (!trip) return;

    const id = await addTraveler(trip.id, {
      firstNameLatin: "SHORT", lastNameLatin: "PASSPORT",
      passportNumber: "55554444",
      // תוקף שבוודאות לא עומד בדרישה של חצי שנה מהחזרה.
      passportExpiry: "2026-10-01",
    });

    const milestone = await prisma.milestone.findFirst({
      where: { tripId: trip.id, key: `passport_expiry:${id}` },
    });
    expect(milestone).not.toBeNull();
    expect(milestone!.title).toContain("SHORT");

    await removeTraveler(id);
    expect(
      await prisma.milestone.findFirst({ where: { tripId: trip.id, key: `passport_expiry:${id}` } }),
    ).toBeNull();
  });

  it("עמוד הלקוח מציג 'חסרים פרטי דרכון' רק כשהם באמת חסרים", async () => {
    const trip = await someTrip();
    if (!trip) return;

    const id = await addTraveler(trip.id, { firstNameLatin: "NODOC", lastNameLatin: "YET" });
    let view = (await getPublicTrip(trip.publicToken))!;
    expect(view.todos.some((t) => t.kind === "passports")).toBe(true);

    await updateTraveler(id, {
      firstNameLatin: "NODOC", lastNameLatin: "YET",
      passportNumber: "12312312", passportExpiry: "2033-01-01",
    });
    view = (await getPublicTrip(trip.publicToken))!;
    const stillMissing = await prisma.traveler.count({
      where: { tripId: trip.id, OR: [{ passportNumberEnc: null }, { passportExpiry: null }] },
    });
    expect(view.todos.some((t) => t.kind === "passports")).toBe(stillMissing > 0);

    await removeTraveler(id);
  });
});
