/**
 * נתוני עומס. הסוכן אמר 100+ תיקים פעילים בשיא העונה (סעיף 13.1), וציר
 * הזמן חייב להיבדק מול המספר הזה ולא מול שלושה תיקים.
 *
 * הרצה: npm run db:seed:bulk -- 120
 */

import { prisma } from "../src/lib/db";
import { createTrip, recordPayment, setComponentStatus } from "../src/lib/trips/service";
import { syncTrip } from "../src/lib/milestones/sync";
import { DISPLAY_TZ, utcToZoned } from "../src/lib/time/zones";

const FIRST = ["דנה", "יוסי", "מיכל", "אבי", "נועה", "רון", "שירה", "עמית", "טל", "הילה", "גיא", "אורית", "ליאור", "מאיה", "אסף"];
const LAST = ["כהן", "לוי", "מזרחי", "פרץ", "ביטון", "אברהם", "דהן", "אזולאי", "שמעוני", "גולן", "ברק", "נחום"];
const DESTINATIONS: Array<[string, string, string]> = [
  ["רודוס", "RHO", "A3"], ["אתונה", "ATH", "A3"], ["ברצלונה", "BCN", "W6"],
  ["רומא", "FCO", "AZ"], ["לרנקה", "LCA", "IZ"], ["פראג", "PRG", "W6"],
  ["בודפשט", "BUD", "W6"], ["לונדון", "LGW", "U2"], ["מילאנו", "MXP", "W6"],
  ["טביליסי", "TBS", "A9"], ["בנגקוק", "BKK", "TK"], ["דובאי", "DXB", "FZ"],
  ["ורשה", "WAW", "W6"], ["וינה", "VIE", "OS"], ["פאפוס", "PFO", "IZ"],
];
const SOURCES = ["המלצה", "פרסום", "לקוח חוזר", "אינסטגרם"];

const pick = <T,>(arr: T[], i: number) => arr[i % arr.length];
const rand = (seed: number) => {
  const x = Math.sin(seed * 9973) * 10000;
  return x - Math.floor(x);
};

function localAt(daysFromNow: number, time: string): string {
  const d = new Date(Date.now() + daysFromNow * 86_400_000);
  return `${utcToZoned(d, DISPLAY_TZ).slice(0, 10)}T${time}`;
}

async function main() {
  const count = Number(process.argv[2]) || 120;
  console.log(`מייצר ${count} תיקים...`);
  const started = Date.now();

  for (let i = 0; i < count; i++) {
    const r = rand(i);
    const [destination, airport, airline] = pick(DESTINATIONS, i);
    // פיזור לאורך העונה: מהשבוע הקרוב ועד חצי שנה קדימה, עם כמה שכבר בנסיעה.
    const daysOut = Math.round(-4 + r * 175);
    const nights = 3 + Math.round(rand(i + 500) * 9);
    const price = 4000 + Math.round(rand(i + 900) * 16000);

    // תיקים אמיתיים נסגרים לאורך חודשים, לא באותה שנייה. בלי זה כל אבני
    // הדרך שעוגנן בהזמנה נוחתות באותו יום, והמדידה מול העומס משקרת.
    const leadDays = 8 + Math.round(rand(i + 61) * 160);
    const bookedAt = new Date(
      Math.min(Date.now() - 60_000, Date.now() + (daysOut - leadDays) * 86_400_000),
    );

    const trip = await createTrip({
      bookedAt,
      client: {
        name: `${pick(FIRST, i)} ${pick(LAST, i * 7 + 3)}`,
        phone: `05${(i % 9) + 1}${String(1000000 + i).slice(-7)}`,
      },
      destination,
      templateId: "leisure_package",
      departureLocal: localAt(daysOut, r > 0.5 ? "06:20" : "14:35"),
      departureAirport: "TLV",
      returnLocal: localAt(daysOut + nights, r > 0.5 ? "21:15" : "18:40"),
      returnAirport: airport,
      outboundAirline: airline,
      outboundFlightNumber: String(900 + (i % 90)),
      inboundAirline: airline,
      inboundFlightNumber: String(901 + (i % 90)),
      travelers: [
        {
          firstNameLatin: "TRAVELER",
          lastNameLatin: `NUM${i}`,
          displayNameHe: `${pick(FIRST, i)} ${pick(LAST, i * 7 + 3)}`,
          passportNumber: String(30000000 + i),
          // חלק קטן מהתיקים עם דרכון שפג מוקדם מדי, כדי שיהיו גם אדומים אמיתיים.
          passportExpiry: rand(i + 77) > 0.9 ? "2026-12-01" : "2031-06-15",
          isLead: true,
        },
      ],
      priceToClient: price,
      supplierCost: Math.round(price * 0.78),
      expectedCommission: Math.round(price * 0.12),
      amountPaid: rand(i + 200) > 0.45 ? price : Math.round(price * 0.3),
      source: pick(SOURCES, i),
    });

    // רוב הרכיבים מאושרים; חלק נשארים תקועים on request, כמו במציאות.
    const stuck = rand(i + 31) > 0.75;
    for (const [j, c] of (await prisma.component.findMany({ where: { tripId: trip.id } })).entries()) {
      if (stuck && j === 0) continue;
      await setComponentStatus(c.id, "confirmed");
    }

    await prisma.component.create({
      data: {
        tripId: trip.id,
        type: "hotel",
        supplier: "Hotelbeds",
        description: `מלון ב${destination}, ${nights} לילות`,
        status: stuck ? "requested" : "confirmed",
        freeCancelUntil: new Date(Date.now() + (daysOut - 14) * 86_400_000),
        supplierPaymentDue: new Date(Date.now() + (daysOut - 21) * 86_400_000),
        cost: Math.round(price * 0.5),
        price: Math.round(price * 0.62),
        sortOrder: 5,
      },
    });

    await syncTrip(trip.id);
    if (rand(i + 200) > 0.45) await recordPayment(trip.id, price);

    if ((i + 1) % 20 === 0) console.log(`  ${i + 1}/${count}`);
  }

  const [trips, milestones] = await Promise.all([prisma.trip.count(), prisma.milestone.count()]);
  console.log(`נוצרו ${trips} תיקים ו-${milestones} אבני דרך תוך ${((Date.now() - started) / 1000).toFixed(1)} שניות.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
