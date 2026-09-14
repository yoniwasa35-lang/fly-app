import { describe, expect, it } from "vitest";
import { normalizePhone } from "@/lib/messages/phone";
import { FSI, PDI, RLM, isolate, stripBidi } from "@/lib/messages/bidi";
import { renderTemplate, templateVariables } from "@/lib/messages/render";
import { whatsAppLink } from "@/lib/messages/whatsapp";
import { buildVariableValues, firstNameOf, VARIABLES, type MessageContext } from "@/lib/messages/variables";
import { zonedToUtc } from "@/lib/time/zones";
import { checkinWindow } from "@/lib/airlines/checkin";

describe("נרמול טלפון", () => {
  const ok = (raw: string) => {
    const r = normalizePhone(raw);
    return r.ok ? r.e164 : `שגיאה: ${r.reason}`;
  };

  it("מספר ישראלי בכל צורה שהסוכן יקליד", () => {
    expect(ok("0501234567")).toBe("972501234567");
    expect(ok("050-123-4567")).toBe("972501234567");
    expect(ok("050 123 4567")).toBe("972501234567");
    expect(ok("(050) 1234567")).toBe("972501234567");
    expect(ok("+972501234567")).toBe("972501234567");
    expect(ok("00972501234567")).toBe("972501234567");
    expect(ok("972501234567")).toBe("972501234567");
    expect(ok("501234567")).toBe("972501234567");
  });

  it("מספר זר עם פלוס נשמר כמו שהוא", () => {
    expect(ok("+44 7700 900123")).toBe("447700900123");
    expect(ok("+1 (415) 555-0134")).toBe("14155550134");
  });

  it("קלט לא תקין מדווח ולא מומצא", () => {
    expect(normalizePhone("").ok).toBe(false);
    expect(normalizePhone("לא מספר").ok).toBe(false);
    expect(normalizePhone("123").ok).toBe(false);
    const r = normalizePhone("123");
    if (!r.ok) expect(r.reason).toMatch(/לא נראה תקין/);
  });
});

describe("כיווניות טקסט — סעיף 14", () => {
  it("ערך לטיני או מספרי מבודד", () => {
    expect(isolate("A3 971")).toBe(`${FSI}A3 971${PDI}`);
    expect(isolate("05:20")).toBe(`${FSI}05:20${PDI}`);
  });

  it("ערך בעברית בלבד לא מלוכלך בתווי בקרה", () => {
    expect(isolate("רודוס")).toBe("רודוס");
    expect(isolate("משפחת לוי")).toBe("משפחת לוי");
  });

  it("שורה שמסתיימת בפיסוק אחרי מספר מקבלת עוגן ימני", () => {
    const out = renderTemplate("הצ'ק-אין נסגר בשעה {{שעת_סגירת_צקאין}}.", {
      "שעת_סגירת_צקאין": "05:20",
    });
    expect(out.text.endsWith(RLM)).toBe(true);
    // בלי תווי הבקרה זה בדיוק מה שהלקוח אמור לקרוא.
    expect(stripBidi(out.text)).toBe("הצ'ק-אין נסגר בשעה 05:20.");
  });

  it("שורה באנגלית בלבד לא מקבלת עוגן ימני", () => {
    const out = renderTemplate("Flight {{מספר_טיסה}}.", { "מספר_טיסה": "A3 971" });
    expect(out.text.includes(RLM)).toBe(false);
  });

  it("התוכן הנקרא זהה לתבנית, רק עם הערכים במקום", () => {
    const out = renderTemplate("היי {{שם_פרטי}}, טיסה {{מספר_טיסה}} ל{{יעד}} יוצאת ב-{{שעת_יציאה}}!", {
      "שם_פרטי": "דנה", "מספר_טיסה": "W6 4351", "יעד": "ברצלונה", "שעת_יציאה": "07:40",
    });
    expect(stripBidi(out.text)).toBe("היי דנה, טיסה W6 4351 לברצלונה יוצאת ב-07:40!");
  });
});

describe("מנוע התבניות", () => {
  it("משתנה בלי ערך נשאר גלוי ומדווח, ולא נעלם בשקט", () => {
    const out = renderTemplate("הצ'ק-אין נסגר ב{{שעת_סגירת_צקאין}}", { "שעת_סגירת_צקאין": "" });
    expect(out.text).toContain("{{שעת_סגירת_צקאין}}");
    expect(out.missing.map((m) => m.name)).toEqual(["שעת_סגירת_צקאין"]);
  });

  it("משתנה סביבה חסר מדווח בשם המשתנה, כדי שיהיה ברור מה להגדיר", () => {
    const out = renderTemplate("בברכה, {{שם_סוכן}}", { "שם_סוכן": "" });
    expect(out.missing[0]).toEqual({ name: "שם_סוכן", envVar: "AGENT_NAME" });
  });

  it("שגיאת כתיב במשתנה מדווחת בנפרד מערך חסר", () => {
    const out = renderTemplate("היי {{שם_פרטיי}}", { "שם_פרטי": "דנה" });
    expect(out.unknown).toEqual(["שם_פרטיי"]);
    expect(out.missing).toEqual([]);
  });

  it("רווחים בתוך הסוגריים לא שוברים כלום", () => {
    const out = renderTemplate("היי {{ שם_פרטי }}", { "שם_פרטי": "דנה" });
    expect(stripBidi(out.text)).toBe("היי דנה");
  });

  it("אותו משתנה פעמיים מוחלף פעמיים", () => {
    const out = renderTemplate("{{יעד}} ... {{יעד}}", { "יעד": "רודוס" });
    expect(out.text).toBe("רודוס ... רודוס");
  });

  it("templateVariables מוצא את מה שהתבנית משתמשת בו", () => {
    expect(templateVariables("היי {{שם_פרטי}}, ל{{יעד}} ושוב {{יעד}}").sort()).toEqual(["יעד", "שם_פרטי"]);
  });
});

describe("קישור wa.me", () => {
  it("עברית מקודדת כ-UTF-8 ומתפענחת חזרה במדויק", () => {
    const text = "היי דנה, הצ'ק-אין נסגר ב-05:20.";
    const link = whatsAppLink("050-1234567", text);
    expect(link.ok).toBe(true);
    if (!link.ok) return;
    expect(link.url.startsWith("https://wa.me/972501234567?text=")).toBe(true);
    // אף תו עברי לא נשאר גולמי בכתובת.
    expect(/[֐-׿]/.test(link.url)).toBe(false);
    const decoded = decodeURIComponent(link.url.split("?text=")[1]);
    expect(decoded).toBe(text);
  });

  it("תווי הבידוד שורדים את הקידוד", () => {
    const text = `טיסה ${FSI}A3 971${PDI} יוצאת`;
    const link = whatsAppLink("0501234567", text);
    if (!link.ok) throw new Error(link.reason);
    expect(decodeURIComponent(link.url.split("?text=")[1])).toBe(text);
  });

  it("שורות חדשות נשמרות", () => {
    const text = "שורה ראשונה\nשורה שנייה\n\nפסקה";
    const link = whatsAppLink("0501234567", text);
    if (!link.ok) throw new Error(link.reason);
    expect(link.url).toContain("%0A");
    expect(decodeURIComponent(link.url.split("?text=")[1])).toBe(text);
  });

  it("תווים בעייתיים בכתובת מקודדים", () => {
    const link = whatsAppLink("0501234567", "מחיר 100% & עוד #דבר +תוספת");
    if (!link.ok) throw new Error(link.reason);
    for (const raw of ["%25", "%26", "%23", "%2B"]) expect(link.url).toContain(raw);
  });

  it("טלפון לא תקין מחזיר שגיאה ולא קישור שבור", () => {
    const link = whatsAppLink("לא מספר", "שלום");
    expect(link.ok).toBe(false);
  });

  it("הודעה ארוכה מדי נחסמת", () => {
    expect(whatsAppLink("0501234567", "א".repeat(4001)).ok).toBe(false);
  });
});

describe("ערכי המשתנים מתיק אמיתי", () => {
  const flight = checkinWindow({
    airlineCode: "A3",
    departsAtLocal: "2026-08-17T21:40",
    departsTz: "Europe/Athens",
  });

  const ctx: MessageContext = {
    trip: {
      code: "2608-101",
      destination: "אתונה",
      departureAt: zonedToUtc("2026-08-10T06:20", "Asia/Jerusalem"),
      departureLocal: "2026-08-10T06:20",
      departureAirport: "TLV",
      returnAt: zonedToUtc("2026-08-17T21:40", "Europe/Athens"),
      returnLocal: "2026-08-17T21:40",
      priceToClient: 14200,
      amountPaid: 4000,
    },
    clientName: "משפחת לוי",
    travelerNames: ["YOSSI LEVI", "MAYA LEVI"],
    components: [{ type: "flight", status: "confirmed" }, { type: "hotel", status: "requested" }],
    flight: {
      airlineCode: "A3", flightNumber: "972", departsTz: "Europe/Athens",
      checkinOpensAt: flight.opensAt, checkinClosesAt: flight.closesAt,
    },
    now: zonedToUtc("2026-07-20T09:00", "Asia/Jerusalem"),
  };

  it("מחשב את כל השדות הבסיסיים", () => {
    const v = buildVariableValues(ctx);
    expect(v["שם_פרטי"]).toBe("משפחת לוי");
    expect(v["מספר_תיק"]).toBe("2608-101");
    expect(v["תאריך_יציאה"]).toBe("10 באוגוסט");
    expect(v["שעת_יציאה"]).toBe("06:20");
    expect(v["שדה_יציאה"]).toContain("TLV");
    expect(v["ימים_ליציאה"]).toBe("בעוד 3 שבועות");
    expect(v["יתרה"]).toBe("10,200 ₪");
    expect(v["נוסעים"]).toBe("YOSSI LEVI, MAYA LEVI");
    expect(v["חברת_תעופה"]).toBe("אגאן");
    expect(v["רכיבים"]).toBe("טיסה");
  });

  it("שעת סגירת הצ'ק-אין היא בשעון השדה, לא בשעון ישראל", () => {
    // טיסת חזור מאתונה ב-21:40 מקומי, A3 סוגרת צ'ק-אין שעה לפני.
    // הלקוח נמצא באתונה, ולכן 20:40 זו השעה שרלוונטית לו.
    expect(buildVariableValues(ctx)["שעת_סגירת_צקאין"]).toBe("20:40");
  });

  it("בלי טיסה בתיק, שדות הטיסה ריקים ולא ממציאים ערך", () => {
    const v = buildVariableValues({ ...ctx, flight: null });
    expect(v["מספר_טיסה"]).toBe("");
    expect(v["שעת_סגירת_צקאין"]).toBe("");
    expect(v["יעד"]).toBe("אתונה");
  });

  it("כל משתנה בקטלוג מקבל ערך או מחרוזת ריקה, אף פעם לא undefined", () => {
    const v = buildVariableValues(ctx);
    for (const doc of VARIABLES) {
      expect(typeof v[doc.name], `המשתנה ${doc.name} חסר במימוש`).toBe("string");
    }
  });
});

describe("פנייה בשם", () => {
  it("שם פרטי רגיל נחתך למילה הראשונה", () => {
    expect(firstNameOf("דנה כהן")).toBe("דנה");
    expect(firstNameOf("אבי ושרית מזרחי")).toBe("אבי");
  });

  it('שם משפחה או תואר לא נחתך — "היי משפחת" זו לא פנייה', () => {
    expect(firstNameOf("משפחת לוי")).toBe("משפחת לוי");
    expect(firstNameOf("מר כהן")).toBe("מר כהן");
    expect(firstNameOf('ד"ר שרון אבידן')).toBe('ד"ר שרון אבידן');
  });

  it("שם בודד נשאר כמו שהוא", () => {
    expect(firstNameOf("דנה")).toBe("דנה");
    expect(firstNameOf("")).toBe("");
  });
});

describe("תווי כיווניות רק במקום שצריך", () => {
  it("שורה בעברית טהורה לא מקבלת RLM", () => {
    const out = renderTemplate("קיבלנו את התשלום והתיק שלכם ל{{יעד}} נפתח.", { "יעד": "רודוס" });
    expect(out.text.includes(RLM)).toBe(false);
    expect(out.text).toBe("קיבלנו את התשלום והתיק שלכם לרודוס נפתח.");
  });

  it("שורה שנגמרת במספר ואחריו פיסוק כן מקבלת RLM", () => {
    const out = renderTemplate("מספר התיק שלכם הוא {{מספר_תיק}}.", { "מספר_תיק": "2609-114" });
    expect(out.text.endsWith(RLM)).toBe(true);
  });

  it("פסיק אחרי שם עברי לא מקבל RLM", () => {
    const out = renderTemplate("היי {{שם_פרטי}},", { "שם_פרטי": "דנה" });
    expect(out.text).toBe("היי דנה,");
  });

  it("ההודעה כולה נשארת קריאה בלי תווי הבקרה", () => {
    const out = renderTemplate(
      "היי {{שם_פרטי}},\nהטיסה {{מספר_טיסה}} יוצאת ב-{{שעת_יציאה}}.\nנתראה.",
      { "שם_פרטי": "דנה", "מספר_טיסה": "W6 4351", "שעת_יציאה": "07:40" },
    );
    expect(stripBidi(out.text)).toBe("היי דנה,\nהטיסה W6 4351 יוצאת ב-07:40.\nנתראה.");
  });
});
