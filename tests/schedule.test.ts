import { describe, expect, it } from "vitest";
import { describeSchedule, templateSchedules } from "@/lib/messages/schedule";

/**
 * התיאור בעברית של מתי הודעה יוצאת.
 *
 * זו הנקודה שבה שפת המנוע (anchor="departure", offset="-14d") הופכת למשהו
 * שסוכן קורא. שגיאה כאן לא מפילה כלום — היא פשוט אומרת לסוכן דבר לא נכון
 * על מה שהלקוח יקבל, וזה גרוע יותר.
 */

const AT = "09:00";

describe("תיאור מועד השליחה", () => {
  it("פתיחת תיק בלי היסט היא מיידית", () => {
    expect(describeSchedule("booking", "+0d", null, AT).when).toBe("מיד עם פתיחת התיק");
  });

  it("היסט שלילי מהטיסה נקרא כ״לפני״", () => {
    expect(describeSchedule("departure", "-14d", null, AT).when).toBe(
      "14 ימים לפני הטיסה בשעה 09:00",
    );
  });

  it("יום אחד ויומיים מקבלים את הצורה העברית הנכונה", () => {
    expect(describeSchedule("departure", "-1d", null, AT).when).toBe("יום לפני הטיסה בשעה 09:00");
    expect(describeSchedule("departure", "+2d", null, AT).when).toBe(
      "יומיים אחרי היציאה בשעה 09:00",
    );
  });

  it("היסט בשעות לא מקבל שעה קבועה, כי הוא נצמד לשעת הטיסה", () => {
    const d = describeSchedule("departure", "-3h", null, AT);
    expect(d.when).toBe("3 שעות לפני הטיסה");
    expect(d.when).not.toContain("09:00");
  });

  it("חזרה ביום עצמו נקראת ״ביום החזרה״", () => {
    expect(describeSchedule("return", "+0d", null, AT).when).toBe("ביום החזרה בשעה 09:00");
    expect(describeSchedule("return", "+4d", null, AT).when).toBe(
      "4 ימים אחרי החזרה בשעה 09:00",
    );
  });

  it("עוגני צ׳ק-אין מתוארים לפי השדה ולא לפי היסט", () => {
    expect(describeSchedule("flight_outbound", "+0m", "checkin_opens_at", AT).when).toBe(
      "ברגע שנפתח הצ׳ק-אין לטיסת הלוך",
    );
    expect(describeSchedule("flight_inbound", "+0m", "checkin_opens_at", AT).when).toBe(
      "ברגע שנפתח הצ׳ק-אין לטיסת החזור",
    );
    expect(describeSchedule("flight_outbound", "+0m", "checkin_closes_at", AT).when).toContain(
      "להיסגר",
    );
  });

  it("לכל עוגן יש גם הסבר מה מזיז אותו", () => {
    expect(describeSchedule("departure", "-1d", null, AT).basis).toContain("תאריך הטיסה");
    expect(describeSchedule("booking", "+0d", null, AT).basis).toContain("תאריך התשלום");
  });
});

describe("מיפוי התבניות", () => {
  it("כל תבנית שמופיעה בתבנית הנופש מקבלת שם בעברית ותיאור מועד", () => {
    const map = templateSchedules();
    expect(map.size).toBeGreaterThan(0);

    for (const [key, s] of map) {
      // השם חייב להיות הכותרת בעברית ולא המפתח באנגלית, אחרת המסך חוזר
      // להיות רשימת מזהים.
      expect(s.title).not.toBe(key);
      expect(s.title).toMatch(/[֐-׿]/);
      expect(s.when.length).toBeGreaterThan(3);
      expect(s.when).not.toContain("undefined");
    }
  });

  it("הודעת ערב היציאה יוצאת יום לפני הטיסה", () => {
    expect(templateSchedules().get("eve_of_departure")?.when).toBe("יום לפני הטיסה בשעה 09:00");
  });
});
