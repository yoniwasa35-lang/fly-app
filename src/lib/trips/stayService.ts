/**
 * שמירת פרטי המלון ותמונת הקאבר.
 *
 * כל כתובת חיצונית עוברת כאן ולידציה לפני שהיא נוגעת במסד. עמוד הלקוח
 * פתוח בלי התחברות, ולכן כתובת פגומה שנשמרה היא כבר בעיה — לא משהו
 * שאפשר לסנן בתצוגה.
 */

import { prisma } from "../db";
import { describeUrlProblem, isBoardBasis, safeExternalUrl } from "./stay";

export type StayInput = {
  name: string;
  roomType?: string | null;
  boardBasis?: string | null;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  officialUrl?: string | null;
  voucherUrl?: string | null;
  address?: string | null;
  stars?: number | null;
};

const TIME = /^\d{2}:\d{2}$/;

export async function saveStay(componentId: string, input: StayInput): Promise<void> {
  const name = input.name.trim();
  if (name.length < 2) throw new Error("צריך שם מלון");

  const component = await prisma.component.findUnique({
    where: { id: componentId },
    select: { id: true, type: true },
  });
  if (!component) throw new Error("הרכיב לא נמצא");
  if (component.type !== "hotel") throw new Error("פרטי מלון שייכים לרכיב מסוג מלון");

  for (const [label, raw] of [
    ["האתר הרשמי", input.officialUrl],
    ["הוואוצ׳ר", input.voucherUrl],
  ] as const) {
    const problem = raw ? describeUrlProblem(raw) : null;
    if (problem) throw new Error(`${label}: ${problem}`);
  }

  for (const [label, raw] of [
    ["שעת הצ׳ק-אין", input.checkInTime],
    ["שעת הצ׳ק-אאוט", input.checkOutTime],
  ] as const) {
    if (raw && !TIME.test(raw)) throw new Error(`${label} חייבת להיות בפורמט HH:MM`);
  }

  const stars = input.stars ?? null;
  if (stars !== null && (stars < 1 || stars > 7)) throw new Error("דירוג כוכבים הוא בין 1 ל-7");

  const board = isBoardBasis(input.boardBasis) ? input.boardBasis : null;

  const data = {
    name,
    roomType: input.roomType?.trim() || null,
    boardBasis: board,
    checkInTime: input.checkInTime || null,
    checkOutTime: input.checkOutTime || null,
    /*
     * המקור נקבע לפי מי כתב. כשהסוכן מזין ידנית זה "manual" — וזה מה
     * שמונע ממשיכה עתידית מ-Places לדרוס תיקון שנעשה ביד.
     */
    officialUrl: safeExternalUrl(input.officialUrl),
    officialUrlSource: "manual",
    voucherUrl: safeExternalUrl(input.voucherUrl),
    address: input.address?.trim() || null,
    stars,
  };

  await prisma.stay.upsert({
    where: { componentId },
    create: { componentId, ...data },
    update: data,
  });

  // שם המלון מופיע גם בכרטיס התיק ובסיכום, שקוראים אותו מהרכיב.
  await prisma.component.update({ where: { id: componentId }, data: { supplier: name } });
}

export async function saveTripCover(
  tripId: string,
  imageUrl: string | null,
  credit: string | null,
): Promise<void> {
  const url = safeExternalUrl(imageUrl);
  if (imageUrl?.trim() && !url) throw new Error("כתובת התמונה חייבת להתחיל ב-https://");

  /*
   * רישיון Unsplash מחייב ייחוס. תמונה בלי קרדיט אינה "פחות מנומסת" —
   * היא הפרת רישיון, ולכן היא לא נשמרת.
   */
  const text = credit?.trim() || null;
  if (url && !text) throw new Error("תמונה מחייבת שורת קרדיט — למשל: צילום: שם הצלם, Unsplash");

  await prisma.trip.update({
    where: { id: tripId },
    data: { coverImageUrl: url, coverCredit: url ? text : null },
  });
}
