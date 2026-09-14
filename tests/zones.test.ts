import { describe, expect, it } from "vitest";
import {
  DISPLAY_TZ,
  endOfWeekIn,
  formatRelativeHe,
  offsetMsAt,
  startOfDayIn,
  utcToZoned,
  zonedToUtc,
} from "@/lib/time/zones";

describe("zonedToUtc — סעיף 6.2", () => {
  it("שעה מקומית בישראל בחורף = UTC+2", () => {
    expect(zonedToUtc("2026-01-15T08:00", "Asia/Jerusalem").toISOString()).toBe("2026-01-15T06:00:00.000Z");
  });

  it("שעה מקומית בישראל בקיץ = UTC+3", () => {
    expect(zonedToUtc("2026-07-15T08:00", "Asia/Jerusalem").toISOString()).toBe("2026-07-15T05:00:00.000Z");
  });

  it("שעת טיסה בבנגקוק היא שעון בנגקוק ולא שעון ישראל", () => {
    // המלכודת: 01:20 המראה מבנגקוק היא 20:20 אתמול בישראל.
    const utc = zonedToUtc("2026-03-10T01:20", "Asia/Bangkok");
    expect(utc.toISOString()).toBe("2026-03-09T18:20:00.000Z");
    expect(utcToZoned(utc, "Asia/Jerusalem")).toBe("2026-03-09T20:20");
  });

  it("אותה שעה נאיבית בשני שדות נותנת שני רגעים שונים", () => {
    const tlv = zonedToUtc("2026-06-01T10:00", "Asia/Jerusalem");
    const jfk = zonedToUtc("2026-06-01T10:00", "America/New_York");
    expect(jfk.getTime() - tlv.getTime()).toBe(7 * 3_600_000);
  });

  it("הלוך-חזור שומר על השעה המקומית", () => {
    for (const [local, tz] of [
      ["2026-03-27T02:30", "Europe/London"],
      ["2026-11-01T01:30", "America/New_York"],
      ["2026-12-31T23:59", "Pacific/Auckland"],
      ["2026-08-15T14:45", "Asia/Kolkata"],
    ] as const) {
      expect(utcToZoned(zonedToUtc(local, tz), tz)).toBe(local);
    }
  });

  it("שעה שאינה קיימת בקפיצת שעון קיץ נדחפת קדימה ולא מתרסקת", () => {
    // בישראל 2026 השעון קופץ מ-02:00 ל-03:00 ב-27 במרץ.
    const utc = zonedToUtc("2026-03-27T02:30", "Asia/Jerusalem");
    expect(Number.isFinite(utc.getTime())).toBe(true);
    expect(utcToZoned(utc, "Asia/Jerusalem")).toBe("2026-03-27T03:30");
  });

  it("offsetMsAt מחזיר את ההיסט הנכון בשני צידי מעבר השעון", () => {
    expect(offsetMsAt(new Date("2026-01-15T12:00:00Z"), "Asia/Jerusalem")).toBe(2 * 3_600_000);
    expect(offsetMsAt(new Date("2026-07-15T12:00:00Z"), "Asia/Jerusalem")).toBe(3 * 3_600_000);
  });

  it("שעה מקומית לא תקינה זורקת שגיאה מפורשת", () => {
    expect(() => zonedToUtc("15/01/2026 08:00", "Asia/Jerusalem")).toThrow(/לא תקינה/);
  });
});

describe("startOfDayIn / endOfWeekIn", () => {
  it("תחילת היום היא חצות מקומית, לא חצות UTC", () => {
    const noonSummer = new Date("2026-07-15T12:00:00Z"); // 15:00 בישראל
    expect(startOfDayIn(noonSummer, DISPLAY_TZ).toISOString()).toBe("2026-07-14T21:00:00.000Z");
  });

  it("רגע אחרי חצות מקומית כבר שייך ליום החדש", () => {
    const justAfterMidnight = new Date("2026-07-14T21:05:00Z"); // 00:05 ב-15 ביולי
    expect(utcToZoned(startOfDayIn(justAfterMidnight, DISPLAY_TZ), DISPLAY_TZ)).toBe("2026-07-15T00:00");
  });

  it("סוף השבוע הוא סוף שבת", () => {
    const wednesday = new Date("2026-07-15T09:00:00Z");
    const end = endOfWeekIn(wednesday, DISPLAY_TZ);
    expect(utcToZoned(end, DISPLAY_TZ)).toBe("2026-07-19T00:00"); // חצות במוצאי שבת
  });
});

describe("formatRelativeHe — סוכן חושב במרחק מהטיסה", () => {
  const now = new Date("2026-07-15T09:00:00Z");
  const rel = (iso: string) => formatRelativeHe(new Date(iso), now).text;

  it("מנסח יחיד, זוגי ורבים נכון", () => {
    expect(rel("2026-07-16T09:00:00Z")).toBe("בעוד יום");
    expect(rel("2026-07-17T09:00:00Z")).toBe("בעוד יומיים");
    expect(rel("2026-07-18T09:00:00Z")).toBe("בעוד 3 ימים");
    expect(rel("2026-07-15T10:00:00Z")).toBe("בעוד שעה");
    expect(rel("2026-07-15T11:00:00Z")).toBe("בעוד שעתיים");
    expect(rel("2026-07-15T09:30:00Z")).toBe("בעוד 30 דקות");
  });

  it("עבר מנוסח כעבר", () => {
    expect(rel("2026-07-13T09:00:00Z")).toBe("לפני יומיים");
    expect(formatRelativeHe(new Date("2026-07-13T09:00:00Z"), now).direction).toBe("past");
  });

  it("מרחקים גדולים עוברים לשבועות וחודשים", () => {
    expect(rel("2026-08-05T09:00:00Z")).toBe("בעוד 3 שבועות");
    expect(rel("2026-10-15T09:00:00Z")).toBe("בעוד 3 חודשים");
  });
});
