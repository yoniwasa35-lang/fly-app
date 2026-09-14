import { describe, expect, it } from "vitest";
import {
  BOARD_BASIS_HE,
  describeUrlProblem,
  isBoardBasis,
  mapUrl,
  ratingLabel,
  safeExternalUrl,
  starsLabel,
} from "@/lib/trips/stay";

/**
 * הכלל היחיד שחשוב כאן: לא ממציאים כתובת. כל השאר נגזר ממנו.
 */

describe("כתובות חיצוניות", () => {
  it("רק http ו-https מתקבלות", () => {
    expect(safeExternalUrl("https://hilton.com")).toBe("https://hilton.com/");
    expect(safeExternalUrl("http://hotel.co.il")).toBe("http://hotel.co.il/");
  });

  it("javascript: ו-data: נדחות — הן וקטור בעמוד שנפתח בלי התחברות", () => {
    expect(safeExternalUrl("javascript:alert(1)")).toBeNull();
    expect(safeExternalUrl("data:text/html,<script>")).toBeNull();
    expect(safeExternalUrl("  JavaScript:alert(1)  ")).toBeNull();
  });

  it("כתובת בלי סכימה נדחית, כי היא נפתחת כנתיב פנימי", () => {
    expect(safeExternalUrl("www.hilton.com")).toBeNull();
    expect(describeUrlProblem("www.hilton.com")).toContain("https://");
  });

  it("ריק הוא מצב תקין ולא שגיאה", () => {
    expect(safeExternalUrl("")).toBeNull();
    expect(safeExternalUrl(null)).toBeNull();
    expect(safeExternalUrl(undefined)).toBeNull();
    expect(describeUrlProblem("")).toBeNull();
    expect(describeUrlProblem("   ")).toBeNull();
  });
});

describe("קישור המפה", () => {
  it("מזהה מקום גובר על כל השאר", () => {
    const url = mapUrl({ name: "Hilton Batumi", placeId: "ChIJabc", address: "Seaside 25", lat: 41, lng: 41 });
    expect(url).toContain("query_place_id=ChIJabc");
    expect(url).toContain("query=");
  });

  it("בלי מזהה — נקודת ציון", () => {
    expect(mapUrl({ name: "Hilton", lat: 41.64, lng: 41.63 })).toContain(encodeURIComponent("41.64,41.63"));
  });

  it("בלי כלום — חיפוש לפי שם ויעד, ולא כתובת מומצאת", () => {
    const url = mapUrl({ name: "Hilton Batumi", destination: "באטומי" });
    expect(url.startsWith("https://www.google.com/maps/search/?api=1")).toBe(true);
    expect(decodeURIComponent(url)).toContain("Hilton Batumi, באטומי");
  });

  it("שם עם תווים מיוחדים לא שובר את הכתובת", () => {
    const url = mapUrl({ name: "Hôtel & Spa #1", destination: "פריז" });
    expect(() => new URL(url)).not.toThrow();
    expect(url).not.toContain(" ");
  });
});

describe("תוויות לתצוגה", () => {
  it("בסיס אירוח מתורגם, וערך לא מוכר נדחה", () => {
    expect(isBoardBasis("breakfast")).toBe(true);
    expect(BOARD_BASIS_HE.half_board).toBe("חצי פנסיון");
    expect(isBoardBasis("bed_and_breakfast")).toBe(false);
  });

  it("כוכבים מחוץ לטווח לא מוצגים", () => {
    expect(starsLabel(5)).toBe("5 כוכבים");
    expect(starsLabel(0)).toBeNull();
    expect(starsLabel(9)).toBeNull();
    expect(starsLabel(null)).toBeNull();
  });

  it("דירוג מוצג רק כשיש אחד", () => {
    expect(ratingLabel(4.6, 1280)).toBe("4.6 מתוך 5 · 1280 חוות דעת");
    expect(ratingLabel(4.6, null)).toBe("4.6 מתוך 5");
    expect(ratingLabel(0, 10)).toBeNull();
    expect(ratingLabel(null, 10)).toBeNull();
  });
});
