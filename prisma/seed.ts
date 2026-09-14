/**
 * נתוני הדגמה. שלושה תיקים שמראים את שלושת הכשלים מסעיף 2:
 * הזמנה תקועה, מועד ביטול שעבר, וצ'ק-אין שנסגר.
 * הרצה: npm run db:seed
 */

import { prisma } from "../src/lib/db";
import { createTrip, recordPayment, setComponentStatus } from "../src/lib/trips/service";
import { syncTrip } from "../src/lib/milestones/sync";
import { DISPLAY_TZ, utcToZoned } from "../src/lib/time/zones";

function inDays(days: number, time = "08:30"): string {
  const d = new Date(Date.now() + days * 24 * 3_600_000);
  return `${utcToZoned(d, DISPLAY_TZ).slice(0, 10)}T${time}`;
}

async function main() {
  await prisma.loginAttempt.deleteMany();
  await prisma.messageTemplate.deleteMany();
  await prisma.milestone.deleteMany();
  await prisma.flight.deleteMany();
  await prisma.component.deleteMany();
  await prisma.traveler.deleteMany();
  await prisma.trip.deleteMany();
  await prisma.client.deleteMany();

  // 1. תיק בריא, רחוק. אמור להיות שקט.
  const calm = await createTrip({
    client: { name: "משפחת לוי", phone: "0501234567" },
    destination: "רודוס",
    templateId: "leisure_package",
    departureLocal: inDays(95, "06:20"),
    departureAirport: "TLV",
    returnLocal: inDays(102, "21:15"),
    returnAirport: "RHO",
    outboundAirline: "A3",
    outboundFlightNumber: "971",
    inboundAirline: "A3",
    inboundFlightNumber: "972",
    travelers: [
      { firstNameLatin: "YOSSI", lastNameLatin: "LEVI", displayNameHe: "יוסי לוי", passportNumber: "12345678", passportExpiry: "2031-05-04", isLead: true },
      { firstNameLatin: "MAYA", lastNameLatin: "LEVI", displayNameHe: "מאיה לוי", passportNumber: "87654321", passportExpiry: "2030-11-20" },
    ],
    priceToClient: 14200,
    supplierCost: 11100,
    amountPaid: 4000,
    source: "המלצה",
  });

  // 2. הזמנה תקועה + מועד ביטול שעבר. הכשל הקלאסי מסעיף 2.
  const stuck = await createTrip({
    client: { name: "דנה כהן", phone: "0529876543" },
    destination: "ברצלונה",
    templateId: "leisure_package",
    departureLocal: inDays(11, "07:40"),
    departureAirport: "TLV",
    returnLocal: inDays(16, "19:05"),
    returnAirport: "BCN",
    outboundAirline: "W6",
    outboundFlightNumber: "4351",
    inboundAirline: "W6",
    inboundFlightNumber: "4352",
    travelers: [
      { firstNameLatin: "DANA", lastNameLatin: "COHEN", displayNameHe: "דנה כהן", passportNumber: "55512345", passportExpiry: "2026-12-01", isLead: true },
    ],
    priceToClient: 9800,
    supplierCost: 7900,
    amountPaid: 2500,
    source: "פרסום",
  });

  await prisma.component.create({
    data: {
      tripId: stuck.id,
      type: "hotel",
      supplier: "Hotelbeds",
      description: "מלון בברצלונה, 5 לילות",
      status: "requested", // תקוע on request — חוסם את שליחת המסמכים
      freeCancelUntil: new Date(Date.now() - 2 * 24 * 3_600_000), // עבר לפני יומיים
      supplierPaymentDue: new Date(Date.now() + 2 * 24 * 3_600_000),
      cost: 4200,
      price: 5600,
      sortOrder: 5,
    },
  });
  await syncTrip(stuck.id);

  // 3. תיק שנוצר מאוחר, שבוע לפני הטיסה. חצי מאבני הדרך נולדות באיחור.
  const late = await createTrip({
    client: { name: "אבי ושרית מזרחי", phone: "0547778899" },
    destination: "לרנקה",
    templateId: "leisure_package",
    departureLocal: inDays(3, "09:10"),
    departureAirport: "TLV",
    returnLocal: inDays(6, "22:30"),
    returnAirport: "LCA",
    outboundAirline: "IZ",
    outboundFlightNumber: "561",
    inboundAirline: "IZ",
    inboundFlightNumber: "562",
    travelers: [
      { firstNameLatin: "AVI", lastNameLatin: "MIZRAHI", displayNameHe: "אבי מזרחי", passportNumber: "33344455", passportExpiry: "2026-11-15", isLead: true },
      { firstNameLatin: "SARIT", lastNameLatin: "MIZRAHI", displayNameHe: "שרית מזרחי", passportNumber: "33344456", passportExpiry: "2032-03-09" },
    ],
    priceToClient: 6400,
    supplierCost: 5050,
    amountPaid: 6400,
    source: "לקוח חוזר",
  });

  for (const c of await prisma.component.findMany({ where: { tripId: calm.id } })) {
    await setComponentStatus(c.id, "confirmed");
  }
  for (const c of await prisma.component.findMany({ where: { tripId: late.id } })) {
    await setComponentStatus(c.id, "confirmed");
  }
  await recordPayment(calm.id, 4000);

  const counts = await prisma.milestone.groupBy({ by: ["state"], _count: true });
  console.log("נוצרו 3 תיקים.");
  for (const c of counts) console.log(`  ${c.state}: ${c._count}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
