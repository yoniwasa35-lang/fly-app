/**
 * מנוע אבני הדרך — סעיף 6 באפיון. הלב של המערכת.
 *
 * כל מה שכאן טהור: מקבל תמונת מצב של תיק ומחזיר את אבני הדרך הרצויות ואת
 * מצביהן. אין כאן גישה למסד נתונים ואין תופעות לוואי, כדי שאפשר יהיה לבדוק
 * את החישוב בלי להפעיל אפליקציה. השכבה שמדברת עם המסד היא sync.ts.
 */

import {
  DISPLAY_TZ,
  utcToZoned,
  zonedToUtc,
  zonedParts,
} from "../time/zones";
import { isComponentResolved, type Audience, type Anchor, type MilestoneState } from "../domain/types";
import {
  getTemplate,
  isDayGrained,
  offsetToMinutes,
  type AutoCompleteRule,
  type BlockRule,
  type MilestoneTemplateEntry,
} from "./template";

/** ברירת מחדל לדרישת תוקף דרכון ביעד — סעיף 5. */
export const DEFAULT_PASSPORT_VALIDITY_MONTHS = 6;

/** חלון ההתראה כשהתבנית לא מציינת אחרת. */
const DEFAULT_LEAD_MINUTES = 0;

/** חלון ההתראה לדדליינים של ספקים: שלושה ימים לפני. */
const SUPPLIER_DEADLINE_LEAD_MINUTES = 3 * 24 * 60;

export type FlightSnapshot = {
  direction: "outbound" | "inbound";
  airlineCode: string;
  departsAtUtc: Date;
  checkinOpensAt: Date | null;
  checkinClosesAt: Date | null;
  checkinDone: boolean;
};

export type ComponentSnapshot = {
  id: string;
  type: string;
  status: string;
  supplier: string | null;
  description: string | null;
  freeCancelUntil: Date | null;
  supplierPaymentDue: Date | null;
  isUpsell: boolean;
  clientResponse: string | null;
  flight: FlightSnapshot | null;
};

export type TravelerSnapshot = {
  id: string;
  name: string;
  passportExpiry: Date | null;
  hasPassportNumber: boolean;
};

export type TripSnapshot = {
  id: string;
  code: string;
  templateId: string;
  bookedAt: Date;
  departureAt: Date;
  returnAt: Date;
  eventAt: Date | null;
  priceToClient: number;
  amountPaid: number;
  /** null = העלות בפועל עדיין לא נסגרה. */
  actualSupplierCost: number | null;
  passportValidityMonths?: number;
  components: ComponentSnapshot[];
  travelers: TravelerSnapshot[];
};

export type DesiredMilestone = {
  key: string;
  title: string;
  audience: Audience;
  anchor: Anchor;
  anchorRef: string | null;
  anchorField: string | null;
  offsetMinutes: number;
  leadMinutes: number;
  dueAt: Date;
  blockRules: BlockRule[];
  autoCompleteRule: AutoCompleteRule | null;
  messageTemplateKey: string | null;
  requiresResolution: string[] | null;
  notSkippable: boolean;
  sortHint: number;
};

export type Blocker = {
  kind: "components" | "milestone";
  label: string;
  /** מזהים לקפיצה למקור החסימה — סעיף 6.4. */
  componentIds?: string[];
  milestoneKey?: string;
};

// ---------------------------------------------------------------------------
// חישוב מועדים
// ---------------------------------------------------------------------------

/** מצמיד רגע לשעה נתונה באותו יום קלנדרי, באזור התצוגה. */
export function snapToTimeOfDay(instant: Date, timeOfDay: string, timeZone = DISPLAY_TZ): Date {
  const local = utcToZoned(instant, timeZone);
  const day = local.slice(0, 10);
  return zonedToUtc(`${day}T${timeOfDay}`, timeZone);
}

function flightFor(trip: TripSnapshot, direction: "outbound" | "inbound"): FlightSnapshot | null {
  for (const c of trip.components) {
    if (c.flight && c.flight.direction === direction && c.status !== "cancelled") return c.flight;
  }
  return null;
}

export type AnchorResolution =
  | { ok: true; at: Date }
  | { ok: false; reason: string };

/** עוגן → רגע בזמן. מחזיר כישלון מפורש כשהעוגן עדיין לא קיים בתיק. */
export function resolveAnchor(trip: TripSnapshot, entry: MilestoneTemplateEntry): AnchorResolution {
  switch (entry.anchor) {
    case "booking":
      return { ok: true, at: trip.bookedAt };
    case "departure":
      return { ok: true, at: trip.departureAt };
    case "return":
      return { ok: true, at: trip.returnAt };
    case "event":
      return trip.eventAt
        ? { ok: true, at: trip.eventAt }
        : { ok: false, reason: "לתיק אין מועד אירוע" };
    case "flight_outbound":
    case "flight_inbound": {
      const direction = entry.anchor === "flight_outbound" ? "outbound" : "inbound";
      const flight = flightFor(trip, direction);
      if (!flight) {
        return {
          ok: false,
          reason: direction === "outbound" ? "טרם הוזנה טיסת הלוך" : "טרם הוזנה טיסת חזור",
        };
      }
      const field = entry.anchor_field ?? "departs_at";
      const at =
        field === "checkin_opens_at" ? flight.checkinOpensAt
        : field === "checkin_closes_at" ? flight.checkinClosesAt
        : flight.departsAtUtc;
      if (!at) return { ok: false, reason: "חלון הצ'ק-אין של הטיסה לא חושב" };
      return { ok: true, at };
    }
    default:
      return { ok: false, reason: `עוגן לא נתמך בתבנית: ${entry.anchor}` };
  }
}

// ---------------------------------------------------------------------------
// בניית אבני הדרך הרצויות
// ---------------------------------------------------------------------------

export type BuildResult = {
  milestones: DesiredMilestone[];
  /** אבני דרך שלא נוצרו כי העוגן שלהן עדיין חסר — לתצוגה בתיק. */
  pendingAnchors: Array<{ key: string; title: string; reason: string }>;
};

export function buildDesiredMilestones(trip: TripSnapshot): BuildResult {
  const template = getTemplate(trip.templateId);
  const out: DesiredMilestone[] = [];
  const pendingAnchors: BuildResult["pendingAnchors"] = [];

  template.milestones.forEach((entry, index) => {
    const anchor = resolveAnchor(trip, entry);
    if (!anchor.ok) {
      pendingAnchors.push({ key: entry.key, title: entry.title, reason: anchor.reason });
      return;
    }
    const offsetMinutes = offsetToMinutes(entry.offset);
    let dueAt = new Date(anchor.at.getTime() + offsetMinutes * 60_000);

    // אבני דרך ברזולוציית ימים מוצמדות לשעת עבודה, אחרת התור מתמלא
    // בפריטים ב-23:40 רק כי כך יצא מחישוב ההיסט.
    if (isDayGrained(entry.offset) || entry.at) {
      const snapped = snapToTimeOfDay(dueAt, entry.at ?? template.default_time_of_day);
      // ההצמדה לא רשאית להקדים את העוגן עצמו כשההיסט אינו שלילי: תיק שנפתח
      // ב-13:00 לא אמור להיוולד עם "הפקת אסמכתא" שעברה את מועדה ב-09:00,
      // ו"ברוכים השבים" לא נשלח לפני שהמטוס נחת.
      dueAt = offsetMinutes >= 0 && snapped.getTime() < anchor.at.getTime() ? anchor.at : snapped;
    }

    out.push({
      key: entry.key,
      title: entry.title,
      audience: entry.audience,
      anchor: entry.anchor,
      anchorRef: null,
      anchorField: entry.anchor_field ?? null,
      offsetMinutes,
      leadMinutes: entry.lead ? Math.abs(offsetToMinutes(entry.lead)) : DEFAULT_LEAD_MINUTES,
      dueAt,
      blockRules: entry.blocked_by ?? [],
      autoCompleteRule: entry.auto_complete ?? null,
      messageTemplateKey: entry.message_template_key ?? null,
      requiresResolution: entry.requires_resolution ?? null,
      notSkippable: entry.not_skippable ?? false,
      sortHint: index,
    });
  });

  out.push(...componentDeadlineMilestones(trip, template.milestones.length));
  out.push(...passportMilestones(trip, template.milestones.length + 500));

  return { milestones: out, pendingAnchors };
}

function componentLabel(c: ComponentSnapshot): string {
  return c.description?.trim() || c.supplier?.trim() || c.type;
}

/** סעיף 6.1 — כל free_cancel_until וכל supplier_payment_due יוצרים אבן דרך. */
function componentDeadlineMilestones(trip: TripSnapshot, baseSort: number): DesiredMilestone[] {
  const out: DesiredMilestone[] = [];
  trip.components.forEach((c, i) => {
    if (c.status === "cancelled" || c.status === "declined_by_client") return;

    if (c.freeCancelUntil) {
      out.push({
        key: `component_free_cancel:${c.id}`,
        title: `מועד ביטול חינם — ${componentLabel(c)}`,
        audience: "agent",
        anchor: "component_deadline",
        anchorRef: c.id,
        anchorField: "free_cancel_until",
        offsetMinutes: 0,
        leadMinutes: SUPPLIER_DEADLINE_LEAD_MINUTES,
        dueAt: c.freeCancelUntil,
        blockRules: [],
        autoCompleteRule: null,
        messageTemplateKey: null,
        requiresResolution: null,
        notSkippable: false,
        sortHint: baseSort + i * 2,
      });
    }

    if (c.supplierPaymentDue) {
      out.push({
        key: `component_payment_due:${c.id}`,
        title: `תשלום לספק — ${componentLabel(c)}`,
        audience: "agent",
        anchor: "component_deadline",
        anchorRef: c.id,
        anchorField: "supplier_payment_due",
        offsetMinutes: 0,
        leadMinutes: SUPPLIER_DEADLINE_LEAD_MINUTES,
        dueAt: c.supplierPaymentDue,
        blockRules: [],
        autoCompleteRule: null,
        messageTemplateKey: null,
        requiresResolution: null,
        notSkippable: false,
        sortHint: baseSort + i * 2 + 1,
      });
    }
  });
  return out;
}

export function passportValidUntilRequirement(trip: TripSnapshot): Date {
  const months = trip.passportValidityMonths ?? DEFAULT_PASSPORT_VALIDITY_MONTHS;
  // החישוב נעשה על התאריך המקומי ולא על ה-UTC: "שישה חודשים מיום החזרה"
  // הוא אמירה על התאריך בלוח השנה, לא על רגע בזמן.
  const p = zonedParts(trip.returnAt, DISPLAY_TZ);
  const shifted = new Date(Date.UTC(p.year, p.month - 1 + months, p.day));
  const pad = (n: number) => String(n).padStart(2, "0");
  const localDate = `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
  return zonedToUtc(`${localDate}T${pad(p.hour)}:${pad(p.minute)}`, DISPLAY_TZ);
}

/** סעיף 5 — דרכון שלא עומד בדרישת היעד מייצר אבן דרך אדומה, מיד. */
function passportMilestones(trip: TripSnapshot, baseSort: number): DesiredMilestone[] {
  const required = passportValidUntilRequirement(trip);
  const months = trip.passportValidityMonths ?? DEFAULT_PASSPORT_VALIDITY_MONTHS;
  const out: DesiredMilestone[] = [];

  trip.travelers.forEach((t, i) => {
    if (!t.passportExpiry) return;
    if (t.passportExpiry.getTime() >= required.getTime()) return;
    out.push({
      key: `passport_expiry:${t.id}`,
      title: `תוקף דרכון קצר מדי — ${t.name}`,
      audience: "agent",
      anchor: "booking",
      anchorRef: t.id,
      anchorField: null,
      offsetMinutes: 0,
      leadMinutes: 0,
      // נולדת כבר במועד שעבר, כדי שתופיע אדומה בראש התור.
      dueAt: trip.bookedAt,
      blockRules: [],
      autoCompleteRule: null,
      messageTemplateKey: null,
      requiresResolution: null,
      notSkippable: true,
      sortHint: baseSort + i,
    });
  });

  if (out.length > 0) {
    // הדרישה נשמרת בכותרת כדי שהסוכן יראה אותה בלי לפתוח כלום, אבל קצר:
    // כותרת בת שלוש שורות הורסת את הצפיפות של מסך היום.
    const until = utcToZoned(required, DISPLAY_TZ).slice(0, 10).split("-").reverse().join("/");
    for (const m of out) m.title += `, נדרש עד ${until}`;
  }
  return out;
}

/**
 * אבני דרך שלעולם לא מקובצות לקבוצת "נולדו באיחור" של סעיף 14.
 * שתי הקטגוריות כאן הן בדיוק הכשלים הכספיים והמשפטיים מסעיף 2:
 * דרכון שלא יעבור בגבול, ומועד ביטול חינם שכבר עבר. אלה חייבים להיות גלויים.
 */
export function isNeverCollapsed(key: string): boolean {
  return key.startsWith("passport_expiry:") || key.startsWith("component_free_cancel:");
}

// ---------------------------------------------------------------------------
// חסימות — סעיף 6.4
// ---------------------------------------------------------------------------

export function evaluateBlockers(
  trip: TripSnapshot,
  rules: BlockRule[],
  milestoneStateByKey: ReadonlyMap<string, MilestoneState>,
): Blocker[] {
  const blockers: Blocker[] = [];

  for (const rule of rules) {
    if (rule.rule === "all_components_resolved") {
      const unresolved = trip.components.filter((c) => !isComponentResolved(c.status));
      if (unresolved.length > 0) {
        blockers.push({
          kind: "components",
          label:
            unresolved.length === 1
              ? `רכיב אחד עדיין לא אושר: ${componentLabel(unresolved[0])}`
              : `${unresolved.length} רכיבים עדיין לא אושרו: ${unresolved.map(componentLabel).join(", ")}`,
          componentIds: unresolved.map((c) => c.id),
        });
      }
    } else if (rule.rule === "component_type_confirmed") {
      const relevant = trip.components.filter((c) => c.type === rule.type);
      const confirmed = relevant.some((c) => c.status === "confirmed");
      if (!confirmed) {
        blockers.push({
          kind: "components",
          label: `אין רכיב מאושר מסוג ${rule.type}`,
          componentIds: relevant.map((c) => c.id),
        });
      }
    } else if (rule.rule === "milestone_done") {
      const state = milestoneStateByKey.get(rule.key);
      if (state !== "done" && state !== "skipped") {
        blockers.push({
          kind: "milestone",
          label: `תלוי באבן דרך קודמת`,
          milestoneKey: rule.key,
        });
      }
    }
  }

  return blockers;
}

// ---------------------------------------------------------------------------
// השלמה אוטומטית — סעיף 6.3
// ---------------------------------------------------------------------------

export function evaluateAutoComplete(trip: TripSnapshot, rule: AutoCompleteRule | null): boolean {
  if (!rule) return false;
  switch (rule.rule) {
    case "all_components_resolved":
      return trip.components.length > 0 && trip.components.every((c) => isComponentResolved(c.status));
    case "all_components_confirmed":
      return (
        trip.components.length > 0 &&
        trip.components
          .filter((c) => c.status !== "cancelled" && c.status !== "declined_by_client")
          .every((c) => c.status === "confirmed")
      );
    case "balance_zero":
      return trip.priceToClient > 0 && trip.amountPaid + 0.001 >= trip.priceToClient;
    case "supplier_cost_settled":
      // הרווח בפועל נגזר מהעלות בפועל, ולכן ברגע שהיא הוזנה אין מה לסגור.
      return trip.actualSupplierCost !== null;
    case "all_travelers_have_passport":
      return trip.travelers.length > 0 && trip.travelers.every((t) => t.hasPassportNumber && !!t.passportExpiry);
    case "flight_checkin_done": {
      const flight = flightFor(trip, rule.direction);
      return !!flight && flight.checkinDone;
    }
    case "component_type_confirmed":
      return trip.components.some((c) => c.type === rule.type && c.status === "confirmed");
    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// מכונת המצבים — סעיף 6.3
// ---------------------------------------------------------------------------

export function deriveState(params: {
  currentState: MilestoneState;
  dueAt: Date;
  leadMinutes: number;
  hasBlockers: boolean;
  autoCompleted: boolean;
  now: Date;
}): MilestoneState {
  const { currentState, dueAt, leadMinutes, hasBlockers, autoCompleted, now } = params;

  // מצבים סופיים לא משתנים מעצמם.
  if (currentState === "done" || currentState === "skipped") return currentState;

  if (autoCompleted) return "done";
  if (hasBlockers) return "blocked";

  if (now.getTime() > dueAt.getTime()) return "overdue";
  if (now.getTime() >= dueAt.getTime() - leadMinutes * 60_000) return "due";
  return "pending";
}

/** האם אבן הדרך אמורה להופיע בתור, בהתחשב בדחייה זמנית. */
export function isActionable(m: { state: MilestoneState; snoozedUntil: Date | null }, now: Date): boolean {
  if (m.state === "done" || m.state === "skipped") return false;
  if (m.snoozedUntil && m.snoozedUntil.getTime() > now.getTime()) return false;
  return m.state === "due" || m.state === "overdue" || m.state === "blocked";
}
