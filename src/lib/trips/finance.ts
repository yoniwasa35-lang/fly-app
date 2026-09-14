/**
 * כלכלת התיק.
 *
 * מודל ההכנסה, כפי שאומת מול הסוכנים:
 *   1. מתמחרים מעל עלות הספק ומרוויחים את ההפרש. לכן הרווח אינו שדה שמזינים
 *      אלא חישוב — שדה כזה היה מקור אמת שני שמתפצל מהראשון ברגע שמישהו
 *      מעדכן מחיר ושוכח לעדכן עמלה.
 *   2. הסוכנות המארחת גובה נתח מההפרש הזה. מה שנשאר בכיס הוא נטו, ולכן
 *      הנטו הוא המספר הראשי — ברוטו בלי הנתח הוא מספר שמשקר כלפי מעלה.
 *
 * מה שכן משתנה אחרי הנסיעה הוא העלות: ספק מוסיף חיוב, רכיב מבוטל, שער
 * מטבע זז. זו הסיבה שיש בסעיף 7א אבן דרך שנפתחת 30 יום אחרי החזרה —
 * ומה שמזינים בה הוא העלות בפועל, לא הרווח.
 *
 * זו לא הנהלת חשבונות. סעיף 3 מוציא אותה מ-v1 במפורש: אין חשבוניות ואין
 * מע"מ, רק מעקב סכומים.
 */

/** ברירת מחדל לנתח הסוכנות המארחת. נשמרת על כל תיק בעת יצירתו. */
export const DEFAULT_HOST_FEE_RATE = 0.01;

export function configuredHostFeeRate(): number {
  const raw = process.env.HOST_AGENCY_FEE_RATE;
  if (!raw?.trim()) return DEFAULT_HOST_FEE_RATE;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new Error(`HOST_AGENCY_FEE_RATE לא תקין: "${raw}". צריך מספר בין 0 ל-1, למשל 0.01`);
  }
  return value;
}

export function hostAgencyName(): string {
  return process.env.HOST_AGENCY_NAME?.trim() || "הסוכנות המארחת";
}

export type TripFinanceInput = {
  priceToClient: number;
  supplierCost: number;
  actualSupplierCost: number | null;
  amountPaid: number;
  hostFeeRate: number;
};

/** שלב אחד בשרשרת: ברוטו, נתח הסוכנות, ומה שנשאר. */
export type MarginBreakdown = {
  gross: number;
  hostFee: number;
  net: number;
  netPct: number;
};

export type TripFinance = {
  priceToClient: number;
  amountPaid: number;
  balance: number;
  supplierCost: number;
  actualSupplierCost: number | null;
  hostFeeRate: number;
  expected: MarginBreakdown;
  /** רק אחרי שהעלות האמיתית נסגרה. */
  actual: MarginBreakdown | null;
  /** ההפרש בנטו בין הצפוי למה שיצא. שלילי = הרווח נשחק. */
  netGap: number | null;
  settled: boolean;
};

function breakdown(gross: number, price: number, rate: number): MarginBreakdown {
  // על הפסד אין נתח לגבות. חישוב נאיבי היה מקטין את ההפסד, וזה פשוט לא נכון.
  const hostFee = gross > 0 ? gross * rate : 0;
  const net = gross - hostFee;
  return {
    gross,
    hostFee,
    net,
    netPct: price > 0 ? (net / price) * 100 : 0,
  };
}

export function tripFinance(trip: TripFinanceInput): TripFinance {
  const rate = trip.hostFeeRate;
  const expected = breakdown(trip.priceToClient - trip.supplierCost, trip.priceToClient, rate);
  const settled = trip.actualSupplierCost !== null;
  const actual = settled
    ? breakdown(trip.priceToClient - (trip.actualSupplierCost as number), trip.priceToClient, rate)
    : null;

  return {
    priceToClient: trip.priceToClient,
    amountPaid: trip.amountPaid,
    balance: trip.priceToClient - trip.amountPaid,
    supplierCost: trip.supplierCost,
    actualSupplierCost: trip.actualSupplierCost,
    hostFeeRate: rate,
    expected,
    actual,
    netGap: actual ? actual.net - expected.net : null,
    settled,
  };
}

export const shekels = (n: number) => `${Math.round(n).toLocaleString("he-IL")} ₪`;

/** "1%" או "1.5%" — בלי אפסים מיותרים. */
export const ratePct = (rate: number) => `${Number((rate * 100).toFixed(2))}%`;
