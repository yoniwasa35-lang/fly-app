/**
 * מתי כל הודעה יוצאת, בעברית.
 *
 * בתבנית זה כתוב כ-anchor="departure", offset="-14d" — שפה שנכונה למנוע
 * ולא לסוכן. הסוכן שואל שאלה אחרת לגמרי: "מתי הלקוח מקבל את זה?".
 * הפונקציה הזו מתרגמת בין השתיים, כדי שמסך התבניות יגיד "שבועיים לפני
 * הטיסה, בשעה 09:00" במקום להציג ביטוי שצריך לפענח.
 */

import { getTemplate, isDayGrained, offsetToMinutes } from "../milestones/template";

const DAY = 60 * 24;

/** "יום / יומיים / N ימים" — עברית תקינה גם בזוגי. */
function days(n: number): string {
  if (n === 1) return "יום";
  if (n === 2) return "יומיים";
  return `${n} ימים`;
}

function hours(n: number): string {
  if (n === 1) return "שעה";
  if (n === 2) return "שעתיים";
  return `${n} שעות`;
}

function span(minutes: number): string {
  const abs = Math.abs(minutes);
  if (abs === 0) return "";
  if (abs % DAY === 0) return days(abs / DAY);
  if (abs % 60 === 0) return hours(abs / 60);
  return `${abs} דקות`;
}

export type ScheduleDescription = {
  /** מתי, במשפט אחד. */
  when: string;
  /** מה מזיז את המועד — כדי שיהיה ברור שזה לא תאריך קבוע. */
  basis: string;
};

export function describeSchedule(
  anchor: string,
  offset: string,
  anchorField: string | null,
  timeOfDay: string,
): ScheduleDescription {
  const minutes = offsetToMinutes(offset || "+0m");
  const amount = span(minutes);
  const atTime = isDayGrained(offset || "") ? ` בשעה ${timeOfDay}` : "";

  if (anchor === "flight_outbound" || anchor === "flight_inbound") {
    const leg = anchor === "flight_outbound" ? "הלוך" : "החזור";
    if (anchorField === "checkin_opens_at") return {
      when: `ברגע שנפתח הצ׳ק-אין לטיסת ${leg}`,
      basis: "נגזר משעת הטיסה ומכללי חברת התעופה",
    };
    if (anchorField === "checkin_closes_at") return {
      when: `כשהצ׳ק-אין לטיסת ${leg} עומד להיסגר`,
      basis: "נגזר משעת הטיסה ומכללי חברת התעופה",
    };
    return { when: `סביב טיסת ${leg}`, basis: "נגזר משעת הטיסה" };
  }

  if (anchor === "booking") {
    return {
      when: minutes === 0 ? "מיד עם פתיחת התיק" : `${amount} אחרי פתיחת התיק${atTime}`,
      basis: "נספר מתאריך התשלום שרשום בתיק",
    };
  }

  if (anchor === "departure") {
    return {
      when:
        minutes === 0 ? `ביום הטיסה${atTime}`
        : minutes < 0 ? `${amount} לפני הטיסה${atTime}`
        : `${amount} אחרי היציאה${atTime}`,
      basis: "זז לבד אם תאריך הטיסה משתנה",
    };
  }

  if (anchor === "return") {
    return {
      when:
        minutes === 0 ? `ביום החזרה${atTime}`
        : minutes < 0 ? `${amount} לפני החזרה${atTime}`
        : `${amount} אחרי החזרה${atTime}`,
      basis: "זז לבד אם תאריך החזרה משתנה",
    };
  }

  return { when: "לפי מועד אבן הדרך", basis: "" };
}

export type TemplateSchedule = {
  /** השם שהסוכן מזהה — כותרת אבן הדרך, לא המפתח באנגלית. */
  title: string;
  toClient: boolean;
} & ScheduleDescription;

/** מיפוי מפתח תבנית → מתי היא יוצאת ואיך קוראים לה. */
export function templateSchedules(): Map<string, TemplateSchedule> {
  const tpl = getTemplate("leisure_package");
  const timeOfDay = tpl.default_time_of_day ?? "09:00";
  const map = new Map<string, TemplateSchedule>();

  for (const m of tpl.milestones) {
    if (!m.message_template_key) continue;
    map.set(m.message_template_key, {
      title: m.title,
      toClient: m.audience !== "agent",
      ...describeSchedule(m.anchor, m.offset ?? "+0m", m.anchor_field ?? null, timeOfDay),
    });
  }

  return map;
}
