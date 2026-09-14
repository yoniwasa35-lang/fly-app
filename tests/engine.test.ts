import { describe, expect, it } from "vitest";
import {
  buildDesiredMilestones,
  deriveState,
  evaluateAutoComplete,
  evaluateBlockers,
  isActionable,
  passportValidUntilRequirement,
  resolveAnchor,
  snapToTimeOfDay,
} from "@/lib/milestones/engine";
import { getTemplate, offsetToMinutes } from "@/lib/milestones/template";
import { utcToZoned, zonedToUtc } from "@/lib/time/zones";
import type { MilestoneState } from "@/lib/domain/types";
import { byKey, makeFlightComponent, makeTrip } from "./fixtures";

describe("פרסור היסטים", () => {
  it("מפענח יחידות וסימנים", () => {
    expect(offsetToMinutes("+0d")).toBe(0);
    expect(offsetToMinutes("-60d")).toBe(-86400);
    expect(offsetToMinutes("-6h")).toBe(-360);
    expect(offsetToMinutes("+30m")).toBe(30);
    expect(offsetToMinutes("4h")).toBe(240);
    expect(offsetToMinutes("-2w")).toBe(-20160);
  });

  it("היסט לא תקין נופל עם שגיאה ולא בשקט", () => {
    expect(() => offsetToMinutes("שבועיים")).toThrow(/לא תקין/);
  });
});

describe("buildDesiredMilestones — סעיף 6.1", () => {
  it("יוצר את כל אבני הדרך של התבנית פלוס הנגזרות מהרכיבים", () => {
    const trip = makeTrip();
    const { milestones } = buildDesiredMilestones(trip);
    const keys = byKey(milestones);

    expect(keys.size).toBe(getTemplate("leisure_package").milestones.length + 2);
    expect(keys.has("send_documents")).toBe(true);
    expect(keys.has("component_free_cancel:c_hotel")).toBe(true);
    expect(keys.has("component_payment_due:c_hotel")).toBe(true);
  });

  it("מועד נגזר מהעוגן הנכון בהיסט הנכון", () => {
    const trip = makeTrip();
    const keys = byKey(buildDesiredMilestones(trip).milestones);

    // departure-14d, מוצמד ל-09:00 שעון ישראל
    expect(utcToZoned(keys.get("send_documents")!.dueAt, "Asia/Jerusalem")).toBe("2026-07-27T09:00");
    // departure-3h — רזולוציית שעות, בלי הצמדה
    expect(utcToZoned(keys.get("departure_message")!.dueAt, "Asia/Jerusalem")).toBe("2026-08-10T03:20");
    // return+4d
    expect(utcToZoned(keys.get("request_review")!.dueAt, "Asia/Jerusalem")).toBe("2026-08-21T09:00");
  });

  it("אבן דרך ברזולוציית ימים לא נוחתת בשעה אקראית", () => {
    const trip = makeTrip({ bookedAt: zonedToUtc("2026-03-01T23:40", "Asia/Jerusalem") });
    const keys = byKey(buildDesiredMilestones(trip).milestones);
    expect(utcToZoned(keys.get("check_visa_requirements")!.dueAt, "Asia/Jerusalem")).toBe("2026-03-03T09:00");
  });

  it("צ'ק-אין נגזר משעון השדה, לא משעון ישראל", () => {
    const trip = makeTrip();
    const keys = byKey(buildDesiredMilestones(trip).milestones);

    // A3: נפתח 48 שעות לפני, נסגר שעה לפני.
    expect(utcToZoned(keys.get("checkin_outbound_opens")!.dueAt, "Asia/Jerusalem")).toBe("2026-08-08T06:20");
    expect(utcToZoned(keys.get("checkin_outbound_closes")!.dueAt, "Asia/Jerusalem")).toBe("2026-08-10T05:20");

    // חלון הצ'ק-אין לחזרה נמדד משעון אתונה. באוגוסט אתונה וישראל באותו היסט,
    // ולכן השעה המוצגת זהה — מה שמסתיר את הבאג אם מחשבים בשעון ישראל.
    expect(utcToZoned(keys.get("checkin_inbound_reminder")!.dueAt, "Europe/Athens")).toBe("2026-08-15T21:40");
    expect(utcToZoned(keys.get("checkin_inbound_reminder")!.dueAt, "Asia/Jerusalem")).toBe("2026-08-15T21:40");
  });

  it("יעד רחוק חושף חישוב שנעשה בטעות בשעון ישראל", () => {
    const trip = makeTrip({
      returnAt: zonedToUtc("2026-08-18T01:20", "Asia/Bangkok"),
      components: [
        makeFlightComponent({
          id: "c_in", direction: "inbound", airlineCode: "A3",
          departsAtLocal: "2026-08-18T01:20", departsTz: "Asia/Bangkok",
        }),
      ],
    });
    const keys = byKey(buildDesiredMilestones(trip).milestones);
    // 48 שעות לפני ההמראה בשעון בנגקוק = 16 באוגוסט 01:20 בבנגקוק,
    // שהן 15 באוגוסט 21:20 בשעון ישראל. חישוב בשעון ישראל היה נותן 01:20.
    const dueAt = keys.get("checkin_inbound_reminder")!.dueAt;
    expect(utcToZoned(dueAt, "Asia/Bangkok")).toBe("2026-08-16T01:20");
    expect(utcToZoned(dueAt, "Asia/Jerusalem")).toBe("2026-08-15T21:20");
  });

  it("לואו-קוסט מקבלת חלון צ'ק-אין אחר מחברה רגילה", () => {
    const trip = makeTrip({
      components: [
        makeFlightComponent({
          id: "c_out",
          direction: "outbound",
          airlineCode: "FR",
          departsAtLocal: "2026-08-10T06:20",
          departsTz: "Asia/Jerusalem",
        }),
      ],
    });
    const keys = byKey(buildDesiredMilestones(trip).milestones);
    // FR: נפתח 24 שעות לפני, נסגר שעתיים לפני.
    expect(utcToZoned(keys.get("checkin_outbound_opens")!.dueAt, "Asia/Jerusalem")).toBe("2026-08-09T06:20");
    expect(utcToZoned(keys.get("checkin_outbound_closes")!.dueAt, "Asia/Jerusalem")).toBe("2026-08-10T04:20");
  });

  it("אבן דרך שהעוגן שלה חסר לא נוצרת, אבל מדווחת", () => {
    const trip = makeTrip({ components: [] });
    const { milestones, pendingAnchors } = buildDesiredMilestones(trip);
    expect(byKey(milestones).has("checkin_outbound_opens")).toBe(false);
    expect(pendingAnchors.map((p) => p.key)).toContain("checkin_outbound_opens");
    expect(pendingAnchors.find((p) => p.key === "checkin_outbound_opens")!.reason).toMatch(/הלוך/);
  });

  it("סגירת צ'ק-אין מקבלת חלון התראה של 4 שעות", () => {
    const keys = byKey(buildDesiredMilestones(makeTrip()).milestones);
    expect(keys.get("checkin_outbound_closes")!.leadMinutes).toBe(240);
  });

  it("רכיב שבוטל לא מייצר יותר דדליינים", () => {
    const trip = makeTrip();
    trip.components[2].status = "cancelled";
    const keys = byKey(buildDesiredMilestones(trip).milestones);
    expect(keys.has("component_free_cancel:c_hotel")).toBe(false);
    expect(keys.has("component_payment_due:c_hotel")).toBe(false);
  });
});

describe("בדיקת תוקף דרכון — סעיף 5", () => {
  it("דורש 6 חודשים מיום החזרה", () => {
    const trip = makeTrip();
    expect(utcToZoned(passportValidUntilRequirement(trip), "Asia/Jerusalem").slice(0, 10)).toBe("2027-02-17");
  });

  it("דרכון שלא עומד בדרישה מייצר אבן דרך במועד שכבר עבר", () => {
    const trip = makeTrip();
    trip.travelers[0].passportExpiry = zonedToUtc("2026-10-01T00:00", "Asia/Jerusalem");
    const keys = byKey(buildDesiredMilestones(trip).milestones);
    const m = keys.get("passport_expiry:t_1");
    expect(m).toBeDefined();
    expect(m!.title).toContain("דנה כהן");
    expect(m!.dueAt.getTime()).toBe(trip.bookedAt.getTime());
    expect(m!.notSkippable).toBe(true);
  });

  it("דרכון תקין לא מייצר כלום", () => {
    const keys = byKey(buildDesiredMilestones(makeTrip()).milestones);
    expect(keys.has("passport_expiry:t_1")).toBe(false);
  });

  it("נוסע בלי תאריך תוקף לא מייצר התראת שווא", () => {
    const trip = makeTrip();
    trip.travelers[0].passportExpiry = null;
    expect(byKey(buildDesiredMilestones(trip).milestones).has("passport_expiry:t_1")).toBe(false);
  });
});

describe("חסימות — סעיף 6.4", () => {
  const stateMap = (entries: Array<[string, MilestoneState]> = []) => new Map(entries);

  it("שליחת מסמכים חסומה כל עוד רכיב אחד לא סגור", () => {
    const trip = makeTrip(); // המלון ב-requested
    const blockers = evaluateBlockers(trip, [{ rule: "all_components_resolved" }], stateMap());
    expect(blockers).toHaveLength(1);
    expect(blockers[0].label).toContain("מלון באתונה");
    expect(blockers[0].componentIds).toEqual(["c_hotel"]);
  });

  it("החסימה משתחררת כשהרכיב מאושר", () => {
    const trip = makeTrip();
    trip.components[2].status = "confirmed";
    expect(evaluateBlockers(trip, [{ rule: "all_components_resolved" }], stateMap())).toHaveLength(0);
  });

  it("רכיב שהלקוח סירב לו לא חוסם מסמכים לנצח", () => {
    const trip = makeTrip();
    trip.components[2].status = "confirmed";
    trip.components.push({
      id: "c_ins", type: "insurance", status: "declined_by_client", supplier: null,
      description: "ביטוח", freeCancelUntil: null, supplierPaymentDue: null,
      isUpsell: true, clientResponse: "declined", flight: null,
    });
    expect(evaluateBlockers(trip, [{ rule: "all_components_resolved" }], stateMap())).toHaveLength(0);
  });

  it("תלות באבן דרך אחרת מצביעה על המפתח שלה", () => {
    const trip = makeTrip();
    const blockers = evaluateBlockers(
      trip,
      [{ rule: "milestone_done", key: "collect_passport_details" }],
      stateMap([["collect_passport_details", "due"]]),
    );
    expect(blockers[0].milestoneKey).toBe("collect_passport_details");

    expect(
      evaluateBlockers(trip, [{ rule: "milestone_done", key: "collect_passport_details" }],
        stateMap([["collect_passport_details", "done"]])),
    ).toHaveLength(0);
  });
});

describe("השלמה אוטומטית — סעיף 6.3", () => {
  it("יתרה שהתאפסה סוגרת את גביית התשלום", () => {
    expect(evaluateAutoComplete(makeTrip(), { rule: "balance_zero" })).toBe(false);
    expect(evaluateAutoComplete(makeTrip({ amountPaid: 12000 }), { rule: "balance_zero" })).toBe(true);
  });

  it("אישור כל הרכיבים סוגר את מעקב הספקים", () => {
    const trip = makeTrip();
    expect(evaluateAutoComplete(trip, { rule: "all_components_resolved" })).toBe(false);
    trip.components[2].status = "confirmed";
    expect(evaluateAutoComplete(trip, { rule: "all_components_resolved" })).toBe(true);
  });

  it("צ'ק-אין שבוצע סוגר את אבן הדרך של אותו כיוון בלבד", () => {
    const trip = makeTrip();
    trip.components[0].flight!.checkinDone = true;
    expect(evaluateAutoComplete(trip, { rule: "flight_checkin_done", direction: "outbound" })).toBe(true);
    expect(evaluateAutoComplete(trip, { rule: "flight_checkin_done", direction: "inbound" })).toBe(false);
  });
});

describe("מכונת המצבים — סעיף 6.3", () => {
  const due = new Date("2026-08-01T06:00:00Z");
  const base = { dueAt: due, leadMinutes: 0, hasBlockers: false, autoCompleted: false };

  it("pending עד שמגיע חלון ההתראה", () => {
    expect(deriveState({ ...base, currentState: "pending", now: new Date("2026-07-31T06:00:00Z") })).toBe("pending");
  });

  it("pending → due בתוך חלון ההתראה", () => {
    expect(
      deriveState({ ...base, leadMinutes: 240, currentState: "pending", now: new Date("2026-08-01T03:00:00Z") }),
    ).toBe("due");
  });

  it("due → overdue אחרי המועד", () => {
    expect(deriveState({ ...base, currentState: "due", now: new Date("2026-08-01T06:01:00Z") })).toBe("overdue");
  });

  it("חסימה גוברת על מועד", () => {
    expect(
      deriveState({ ...base, hasBlockers: true, currentState: "overdue", now: new Date("2026-08-02T00:00:00Z") }),
    ).toBe("blocked");
  });

  it("blocked → due כשהתלות מסופקת", () => {
    expect(deriveState({ ...base, currentState: "blocked", now: new Date("2026-08-01T06:00:00Z") })).toBe("due");
    // אותה אבן דרך, אם מועדה עדיין רחוק, חוזרת ל-pending ולא קופצת לתור.
    expect(deriveState({ ...base, currentState: "blocked", now: new Date("2026-08-01T05:00:00Z") })).toBe("pending");
  });

  it("done ו-skipped הם מצבים סופיים", () => {
    expect(deriveState({ ...base, currentState: "done", now: new Date("2027-01-01T00:00:00Z") })).toBe("done");
    expect(deriveState({ ...base, currentState: "skipped", hasBlockers: true, now: due })).toBe("skipped");
  });

  it("השלמה אוטומטית גוברת על חסימה", () => {
    expect(
      deriveState({ ...base, autoCompleted: true, hasBlockers: true, currentState: "blocked", now: due }),
    ).toBe("done");
  });

  it("דחייה זמנית מוציאה מהתור אבל לא מוחקת", () => {
    const now = new Date("2026-08-02T00:00:00Z");
    expect(isActionable({ state: "overdue", snoozedUntil: null }, now)).toBe(true);
    expect(isActionable({ state: "overdue", snoozedUntil: new Date("2026-08-03T00:00:00Z") }, now)).toBe(false);
    expect(isActionable({ state: "overdue", snoozedUntil: new Date("2026-08-01T00:00:00Z") }, now)).toBe(true);
  });
});

describe("עוגנים", () => {
  it("עוגן אירוע חסר מדווח במפורש", () => {
    const entry = { ...getTemplate("leisure_package").milestones[0], anchor: "event" as const };
    const res = resolveAnchor(makeTrip(), entry);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/אירוע/);
  });

  it("snapToTimeOfDay מצמיד לשעה מקומית ולא ל-UTC", () => {
    const snapped = snapToTimeOfDay(new Date("2026-08-10T22:30:00Z"), "09:00", "Asia/Jerusalem");
    expect(utcToZoned(snapped, "Asia/Jerusalem")).toBe("2026-08-11T09:00");
  });
});
