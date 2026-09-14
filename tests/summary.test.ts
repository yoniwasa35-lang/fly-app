import { describe, expect, it } from "vitest";
import { nightsBetween, summarizeTrip, PAYMENT_STATUS_HE } from "@/lib/trips/summary";
import {
  describeParty,
  headcount,
  parseChildAges,
  serializeChildAges,
  PARTY_DEFAULTS,
} from "@/lib/clients/party";
import { zonedToUtc } from "@/lib/time/zones";

const IL = "Asia/Jerusalem";

function trip(over: Partial<Parameters<typeof summarizeTrip>[0]> = {}) {
  return summarizeTrip({
    departureAt: zonedToUtc("2026-10-26T08:00", IL),
    returnAt: zonedToUtc("2026-10-29T14:15", IL),
    priceToClient: 3800,
    amountPaid: 3800,
    components: [],
    ...over,
  });
}

describe("ספירת לילות", () => {
  it("נספרת בימי לוח ולא בהפרש שעות", () => {
    // יוצאים בשש בערב, חוזרים בשמונה בבוקר שלושה ימים אחר כך: 62 שעות,
    // אבל שלושה לילות.
    expect(
      nightsBetween(zonedToUtc("2026-03-01T18:00", IL), zonedToUtc("2026-03-04T08:00", IL)),
    ).toBe(3);
  });

  it("נשארת נכונה גם כשהנסיעה חוצה מעבר לשעון קיץ", () => {
    // שעון הקיץ בישראל מתחיל ב-27 במרץ 2026. הלילה הזה קצר בשעה, וספירה
    // בהפרש מילישניות הייתה מחזירה כאן מספר שבור.
    expect(
      nightsBetween(zonedToUtc("2026-03-26T22:00", IL), zonedToUtc("2026-03-29T06:00", IL)),
    ).toBe(3);
  });

  it("יציאה וחזרה באותו יום הן אפס לילות", () => {
    expect(
      nightsBetween(zonedToUtc("2026-05-05T06:00", IL), zonedToUtc("2026-05-05T23:00", IL)),
    ).toBe(0);
  });
});

describe("סיכום הנסיעה", () => {
  it("ימים הם לילות ועוד אחד", () => {
    const s = trip();
    expect(s.nights).toBe(3);
    expect(s.days).toBe(4);
  });

  it("מזהה את טיסת ההלוך ואת החזור לפי הכיוון, לא לפי הסדר", () => {
    const s = trip({
      components: [
        {
          type: "flight", status: "confirmed", supplier: null, description: null,
          flight: {
            direction: "inbound", airlineCode: "IZ", flightNumber: "562",
            departsAtLocal: "2026-10-29T14:15", departsAirport: "BUS",
            arrivesAtLocal: "2026-10-29T16:40", arrivesAirport: "TLV",
            baggageAllowance: "23 ק״ג", checkinDone: false,
          },
        },
        {
          type: "flight", status: "confirmed", supplier: null, description: null,
          flight: {
            direction: "outbound", airlineCode: "IZ", flightNumber: "561",
            departsAtLocal: "2026-10-26T08:00", departsAirport: "TLV",
            arrivesAtLocal: null, arrivesAirport: "BUS",
            baggageAllowance: null, checkinDone: true,
          },
        },
      ],
    });

    expect(s.outbound?.flightNumber).toBe("561");
    expect(s.outbound?.checkinDone).toBe(true);
    expect(s.inbound?.flightNumber).toBe("562");
  });

  it("שעת נחיתה לא ידועה נשארת ריקה ולא מועתקת מההמראה", () => {
    const s = trip({
      components: [
        {
          type: "flight", status: "confirmed", supplier: null, description: null,
          flight: {
            direction: "outbound", airlineCode: "LY", flightNumber: "1",
            departsAtLocal: "2026-10-26T08:00", departsAirport: "TLV",
            arrivesAtLocal: null, arrivesAirport: "JFK",
            baggageAllowance: null, checkinDone: false,
          },
        },
      ],
    });
    expect(s.outbound?.arrivesTime).toBeNull();
    expect(s.outbound?.time).toBe("08:00");
  });

  it("מלון מבוטל לא מופיע בכרטיס", () => {
    const hotel = (status: string) => ({
      type: "hotel", status, supplier: "Hilton Batumi", description: "חדר זוגי", flight: null,
    });
    expect(trip({ components: [hotel("cancelled")] }).stay).toBeNull();
    expect(trip({ components: [hotel("confirmed")] }).stay?.name).toBe("Hilton Batumi");
  });

  it("סטטוס התשלום נגזר מהיתרה, ולא מוזן ידנית", () => {
    expect(trip({ amountPaid: 3800 }).money.status).toBe("paid");
    expect(trip({ amountPaid: 1000 }).money.status).toBe("partial");
    expect(trip({ amountPaid: 0 }).money.status).toBe("unpaid");
    expect(PAYMENT_STATUS_HE[trip({ amountPaid: 1000 }).money.status]).toBe("שולם חלקית");
  });

  it("תשלום יתר לא מייצר יתרה שלילית", () => {
    const s = trip({ priceToClient: 3800, amountPaid: 4000 });
    expect(s.money.balance).toBe(0);
    expect(s.money.status).toBe("paid");
  });
});

describe("הרכב נוסעים", () => {
  it("כל בחירה פותחת ברירת מחדל הגיונית", () => {
    expect(PARTY_DEFAULTS.solo.adults).toBe(1);
    expect(PARTY_DEFAULTS.couple.adults).toBe(2);
    expect(PARTY_DEFAULTS.family.children).toBeGreaterThan(0);
  });

  it("התיאור בעברית נכון ביחיד, בזוגי וברבים", () => {
    expect(describeParty({ partyType: "solo", adults: 1, children: 0, infants: 0 })).toBe("מבוגר אחד");
    expect(describeParty({ partyType: "couple", adults: 2, children: 0, infants: 0 })).toBe("שני מבוגרים");
    expect(describeParty({ partyType: "family", adults: 2, children: 3, infants: 1 })).toBe(
      "שני מבוגרים · 3 ילדים · תינוק אחד",
    );
  });

  it("ערך partyType לא מוכר מהמסד לא מפיל את התיאור", () => {
    expect(describeParty({ partyType: "whatever", adults: 0, children: 0, infants: 0 })).toBe("נוסעים");
  });

  it("תינוק נספר בנפשות", () => {
    expect(headcount({ adults: 2, children: 2, infants: 1 })).toBe(5);
  });

  it("גילאים פגומים לא מפילים את המסך", () => {
    expect(parseChildAges(null)).toEqual([]);
    expect(parseChildAges("לא JSON")).toEqual([]);
    expect(parseChildAges('{"a":1}')).toEqual([]);
    expect(parseChildAges('[3,"7",99,-1]')).toEqual([3, 7]);
  });

  it("סדרה ריקה נשמרת כ-null ולא כמערך ריק", () => {
    expect(serializeChildAges([])).toBeNull();
    expect(serializeChildAges([4, 9])).toBe("[4,9]");
  });
});
