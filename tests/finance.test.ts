import { describe, expect, it } from "vitest";
import {
  configuredHostFeeRate,
  ratePct,
  shekels,
  tripFinance,
  type TripFinanceInput,
} from "@/lib/trips/finance";
import { evaluateAutoComplete } from "@/lib/milestones/engine";
import { makeTrip } from "./fixtures";
import { withEnv as withEnvKeys } from "./env-helper";

/**
 * מודל ההכנסה: מתמחרים מעל עלות הספק ומרוויחים את ההפרש, והסוכנות המארחת
 * גובה נתח מההפרש. הרווח נגזר ואינו שדה, כדי שלא יהיו שני מספרים שמתפצלים.
 */

const base: TripFinanceInput = {
  priceToClient: 14200,
  supplierCost: 11100,
  actualSupplierCost: null,
  amountPaid: 4000,
  hostFeeRate: 0.01,
};

describe("רווח התיק", () => {
  it("ברוטו הוא ההפרש, והנטו הוא אחרי נתח הסוכנות", () => {
    const f = tripFinance(base);
    expect(f.expected.gross).toBe(3100);
    expect(f.expected.hostFee).toBe(31); // 1% מההפרש, לא מהמחזור
    expect(f.expected.net).toBe(3069);
    expect(f.balance).toBe(10200);
  });

  it("הנתח נגבה מההפרש ולא מהמחיר ללקוח", () => {
    const f = tripFinance(base);
    // 1% מהמחזור היה 142 שקל — פי יותר מארבעה מהנכון.
    expect(f.expected.hostFee).not.toBe(base.priceToClient * 0.01);
    expect(f.expected.hostFee).toBe((base.priceToClient - base.supplierCost) * 0.01);
  });

  it("הרווח בפועל לא קיים עד שהעלות האמיתית נסגרת", () => {
    const f = tripFinance(base);
    expect(f.settled).toBe(false);
    expect(f.actual).toBeNull();
    expect(f.netGap).toBeNull();
  });

  it("עלות שגדלה שוחקת גם את הנטו וגם את הנתח", () => {
    const f = tripFinance({ ...base, actualSupplierCost: 11900 });
    expect(f.settled).toBe(true);
    expect(f.actual!.gross).toBe(2300);
    expect(f.actual!.hostFee).toBe(23);
    expect(f.actual!.net).toBe(2277);
    expect(f.netGap).toBe(2277 - 3069);
  });

  it("על הפסד לא נגבה נתח", () => {
    const f = tripFinance({ ...base, priceToClient: 5000, supplierCost: 5400 });
    expect(f.expected.gross).toBe(-400);
    expect(f.expected.hostFee).toBe(0);
    expect(f.expected.net).toBe(-400);
  });

  it("עלות אפס היא מצב תקין, לא 'לא נסגר'", () => {
    const f = tripFinance({ ...base, actualSupplierCost: 0 });
    expect(f.settled).toBe(true);
    expect(f.actual!.gross).toBe(14200);
  });

  it("תיק בלי מחיר לא מתפוצץ על חלוקה באפס", () => {
    const f = tripFinance({ ...base, priceToClient: 0, supplierCost: 0 });
    expect(f.expected.netPct).toBe(0);
    expect(Number.isFinite(f.expected.net)).toBe(true);
  });

  it("שיעור אחר על אותו תיק נותן נטו אחר", () => {
    expect(tripFinance({ ...base, hostFeeRate: 0.05 }).expected.net).toBe(3100 - 155);
    expect(tripFinance({ ...base, hostFeeRate: 0 }).expected.net).toBe(3100);
  });
});

describe("שיעור הנתח מהסביבה", () => {
  const withEnv = (value: string | undefined, fn: () => void) =>
    withEnvKeys({ HOST_AGENCY_FEE_RATE: value }, fn);

  it("ברירת מחדל 1%", () => withEnv(undefined, () => expect(configuredHostFeeRate()).toBe(0.01)));
  it("ערך תקין נקרא", () => withEnv("0.025", () => expect(configuredHostFeeRate()).toBe(0.025)));

  it("ערך לא תקין נופל עם שגיאה ולא בשקט", () => {
    for (const bad of ["אחוז", "-0.1", "1", "5"]) {
      withEnv(bad, () => expect(() => configuredHostFeeRate()).toThrow(/HOST_AGENCY_FEE_RATE/));
    }
  });
});

describe("עיצוב", () => {
  it("סכומים בעברית", () => {
    expect(shekels(14200)).toBe("14,200 ₪");
    expect(shekels(0)).toBe("0 ₪");
    // מספר שלילי מקבל סימן כיווניות בלתי נראה מהמעצב של he-IL, וזו התנהגות
    // רצויה: בלעדיו המינוס עלול להופיע בצד השגוי בתוך טקסט עברי.
    expect(shekels(-400)).toContain("-400 ₪");
    expect(shekels(-400).charCodeAt(0)).toBe(0x200e);
  });

  it("שיעור בלי אפסים מיותרים", () => {
    expect(ratePct(0.01)).toBe("1%");
    expect(ratePct(0.015)).toBe("1.5%");
    expect(ratePct(0)).toBe("0%");
  });
});

describe("סגירה אוטומטית של אבן דרך הרווח — סעיף 6.3", () => {
  it("נסגרת ברגע שהעלות בפועל הוזנה", () => {
    expect(evaluateAutoComplete(makeTrip(), { rule: "supplier_cost_settled" })).toBe(false);
    expect(
      evaluateAutoComplete(makeTrip({ actualSupplierCost: 9000 }), { rule: "supplier_cost_settled" }),
    ).toBe(true);
  });

  it("אפס הוא ערך תקין שסוגר, כי null זה 'לא הוזן'", () => {
    expect(
      evaluateAutoComplete(makeTrip({ actualSupplierCost: 0 }), { rule: "supplier_cost_settled" }),
    ).toBe(true);
  });
});
