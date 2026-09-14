/**
 * כלכלת התיק.
 *
 * מודל ההכנסה: הסוכנים מתמחרים מעל עלות הספק ומרוויחים את ההפרש. לכן
 * הרווח אינו שדה שמזינים אלא חישוב — שדה כזה היה מקור אמת שני שמתפצל
 * מהראשון ברגע שמישהו מעדכן מחיר ושוכח לעדכן עמלה.
 *
 * מה שכן משתנה אחרי הנסיעה הוא העלות: ספק מוסיף חיוב, רכיב מבוטל, שער
 * מטבע זז. זו הסיבה שיש בסעיף 7א אבן דרך שנפתחת 30 יום אחרי החזרה —
 * ומה שמזינים בה הוא העלות בפועל, לא הרווח.
 *
 * זו לא הנהלת חשבונות. סעיף 3 מוציא אותה מ-v1 במפורש: אין חשבוניות ואין
 * מע"מ, רק מעקב סכומים.
 */

export type TripFinanceInput = {
  priceToClient: number;
  supplierCost: number;
  actualSupplierCost: number | null;
  amountPaid: number;
};

export type TripFinance = {
  priceToClient: number;
  amountPaid: number;
  balance: number;
  /** עלות משוערת, כפי שהוזנה בהזמנה. */
  supplierCost: number;
  /** עלות בפועל, אם כבר נסגרה. */
  actualSupplierCost: number | null;
  /** הרווח הצפוי: מחיר פחות עלות משוערת. */
  expectedMargin: number;
  expectedMarginPct: number;
  /** הרווח בפועל, רק אחרי שהעלות האמיתית נסגרה. */
  actualMargin: number | null;
  actualMarginPct: number | null;
  /** ההפרש בין מה שהיה צפוי למה שיצא. שלילי = הרווח נשחק. */
  marginGap: number | null;
  settled: boolean;
};

const pct = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : 0);

export function tripFinance(trip: TripFinanceInput): TripFinance {
  const expectedMargin = trip.priceToClient - trip.supplierCost;
  const settled = trip.actualSupplierCost !== null;
  const actualMargin = settled ? trip.priceToClient - (trip.actualSupplierCost as number) : null;

  return {
    priceToClient: trip.priceToClient,
    amountPaid: trip.amountPaid,
    balance: trip.priceToClient - trip.amountPaid,
    supplierCost: trip.supplierCost,
    actualSupplierCost: trip.actualSupplierCost,
    expectedMargin,
    expectedMarginPct: pct(expectedMargin, trip.priceToClient),
    actualMargin,
    actualMarginPct: actualMargin === null ? null : pct(actualMargin, trip.priceToClient),
    marginGap: actualMargin === null ? null : actualMargin - expectedMargin,
    settled,
  };
}

export const shekels = (n: number) => `${Math.round(n).toLocaleString("he-IL")} ₪`;
