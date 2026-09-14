import { describe, expect, it } from "vitest";
import { shekels, tripFinance } from "@/lib/trips/finance";
import { evaluateAutoComplete } from "@/lib/milestones/engine";
import { makeTrip } from "./fixtures";

/**
 * מודל ההכנסה: מתמחרים מעל עלות הספק ומרוויחים את ההפרש. הרווח נגזר
 * ואינו שדה, כדי שלא יהיו שני מספרים שמתפצלים.
 */

const base = { priceToClient: 14200, supplierCost: 11100, amountPaid: 4000 };

describe("רווח התיק", () => {
  it("הרווח הצפוי הוא ההפרש בין המחיר לעלות המשוערת", () => {
    const f = tripFinance({ ...base, actualSupplierCost: null });
    expect(f.expectedMargin).toBe(3100);
    expect(Math.round(f.expectedMarginPct)).toBe(22);
    expect(f.balance).toBe(10200);
  });

  it("הרווח בפועל לא קיים עד שהעלות האמיתית נסגרת", () => {
    const f = tripFinance({ ...base, actualSupplierCost: null });
    expect(f.settled).toBe(false);
    expect(f.actualMargin).toBeNull();
    expect(f.marginGap).toBeNull();
  });

  it("עלות שגדלה שוחקת את הרווח, והפער מדווח", () => {
    // הספק חייב 800 שקל מעבר להערכה.
    const f = tripFinance({ ...base, actualSupplierCost: 11900 });
    expect(f.settled).toBe(true);
    expect(f.actualMargin).toBe(2300);
    expect(f.marginGap).toBe(-800);
  });

  it("עלות שקטנה מגדילה את הרווח", () => {
    const f = tripFinance({ ...base, actualSupplierCost: 10600 });
    expect(f.actualMargin).toBe(3600);
    expect(f.marginGap).toBe(500);
  });

  it("עלות אפס היא מצב תקין, לא 'לא נסגר'", () => {
    const f = tripFinance({ ...base, actualSupplierCost: 0 });
    expect(f.settled).toBe(true);
    expect(f.actualMargin).toBe(14200);
  });

  it("תיק בלי מחיר לא מתפוצץ על חלוקה באפס", () => {
    const f = tripFinance({ priceToClient: 0, supplierCost: 0, actualSupplierCost: null, amountPaid: 0 });
    expect(f.expectedMarginPct).toBe(0);
    expect(Number.isFinite(f.expectedMargin)).toBe(true);
  });

  it("רווח שלילי מוצג כמו שהוא ולא מתעגל למעלה", () => {
    const f = tripFinance({ priceToClient: 5000, supplierCost: 5400, actualSupplierCost: null, amountPaid: 5000 });
    expect(f.expectedMargin).toBe(-400);
  });

  it("עיצוב סכומים בעברית", () => {
    expect(shekels(14200)).toBe("14,200 ₪");
    expect(shekels(0)).toBe("0 ₪");
    // מספר שלילי מקבל סימן כיווניות בלתי נראה מהמעצב של he-IL, וזו התנהגות
    // רצויה: בלעדיו המינוס עלול להופיע בצד השגוי של המספר בטקסט עברי.
    expect(shekels(-400)).toContain("-400 ₪");
    expect(shekels(-400).charCodeAt(0)).toBe(0x200e);
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
