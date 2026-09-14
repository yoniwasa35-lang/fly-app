/**
 * טיפול באזורי זמן — סעיף 6.2 ו-14 באפיון.
 *
 * הכלל היחיד במערכת: זמן שנתון בשעון מקומי של שדה תעופה נשמר תמיד כזוג
 * (שעה מקומית נאיבית, אזור זמן IANA), וה-UTC נגזר מהם. לעולם לא הפוך.
 * כל מה שכתוב למסד נשמר ב-UTC; כל מה שמוצג מומר לאזור התצוגה.
 */

export const DISPLAY_TZ = "Asia/Jerusalem";

/** "YYYY-MM-DDTHH:mm" או "YYYY-MM-DD HH:mm" — שעה מקומית נאיבית, בלי סיומת אזור. */
export type NaiveLocal = string;

const NAIVE_RE = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/;

export function parseNaive(local: NaiveLocal): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  const m = NAIVE_RE.exec(local.trim());
  if (!m) {
    throw new Error(`שעה מקומית לא תקינה: "${local}". פורמט נדרש: YYYY-MM-DDTHH:mm`);
  }
  return {
    year: Number(m[1]),
    month: Number(m[2]),
    day: Number(m[3]),
    hour: Number(m[4]),
    minute: Number(m[5]),
    second: m[6] ? Number(m[6]) : 0,
  };
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatterCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatterCache.set(timeZone, f);
  }
  return f;
}

/** רכיבי השעון המקומי באזור נתון, עבור רגע נתון בזמן. */
export function zonedParts(instant: Date, timeZone: string) {
  const parts = partsFormatter(timeZone).formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes) => {
    const p = parts.find((x) => x.type === type);
    if (!p) throw new Error(`Intl לא החזיר ${type} עבור ${timeZone}`);
    return Number(p.value);
  };
  const hour = get("hour");
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    // חלק מהמנועים מחזירים 24 לחצות. מנרמלים.
    hour: hour === 24 ? 0 : hour,
    minute: get("minute"),
    second: get("second"),
  };
}

/** ההיסט של אזור הזמן מ-UTC, במילישניות, ברגע נתון. חיובי = מזרחית ל-UTC. */
export function offsetMsAt(instant: Date, timeZone: string): number {
  const p = zonedParts(instant, timeZone);
  const asIfUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  // עיגול לשנייה כדי לנטרל רעש מילישניות
  return asIfUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/**
 * שעה מקומית נאיבית באזור נתון → רגע ב-UTC.
 *
 * שתי איטרציות כי ההיסט עצמו תלוי ברגע. באיטרציה הראשונה מנחשים לפי ההיסט
 * ב"שעה הנאיבית כאילו היא UTC", ובשנייה מתקנים לפי ההיסט האמיתי. זה מטפל
 * נכון במעברי שעון קיץ פרט לשעה שאינה קיימת, שבה נבחר הרגע שאחרי הקפיצה.
 */
export function zonedToUtc(local: NaiveLocal, timeZone: string): Date {
  const p = parseNaive(local);
  const naiveAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);

  const first = naiveAsUtc - offsetMsAt(new Date(naiveAsUtc), timeZone);
  const ts = naiveAsUtc - offsetMsAt(new Date(first), timeZone);

  // שתי מקרי קצה, שניהם מטופלים על ידי שתי האיטרציות עצמן ומתועדים כאן:
  // שעה שאינה קיימת (קפיצת שעון קיץ) מתורגמת לרגע שמיד אחרי הקפיצה, ושעה
  // כפולה (חזרה מקיץ לחורף) מתורגמת להיקרות הראשונה.
  return new Date(ts);
}

/** רגע ב-UTC → שעה מקומית נאיבית באזור נתון. */
export function utcToZoned(instant: Date, timeZone: string): NaiveLocal {
  const p = zonedParts(instant, timeZone);
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${pad(p.year, 4)}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

const HE_DAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
const HE_MONTHS = [
  "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
  "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר",
];

/** תאריך מוחלט לתצוגה, בעברית, באזור התצוגה. */
export function formatAbsoluteHe(
  instant: Date,
  opts: { timeZone?: string; withTime?: boolean; withWeekday?: boolean } = {},
): string {
  const tz = opts.timeZone ?? DISPLAY_TZ;
  const p = zonedParts(instant, tz);
  const pad = (n: number) => String(n).padStart(2, "0");
  const weekdayIdx = new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay();
  const parts: string[] = [];
  if (opts.withWeekday) parts.push(`יום ${HE_DAYS[weekdayIdx]}`);
  parts.push(`${p.day} ב${HE_MONTHS[p.month - 1]}`);
  if (opts.withTime !== false) parts.push(`${pad(p.hour)}:${pad(p.minute)}`);
  return parts.join(", ");
}

function heCount(n: number, one: string, two: string, many: string): string {
  if (n === 1) return one;
  if (n === 2) return two;
  return `${n} ${many}`;
}

/**
 * מרחק זמן בעברית. סוכן חושב במרחק מהטיסה, לא בתאריכים — סעיף 6.2.
 * מחזיר גם את הטקסט וגם את הכיוון, כדי שהתצוגה תוכל לצבוע לפי זה.
 */
export function formatRelativeHe(
  target: Date,
  now: Date = new Date(),
): { text: string; direction: "past" | "future" | "now"; minutes: number } {
  const diffMs = target.getTime() - now.getTime();
  const absMin = Math.round(Math.abs(diffMs) / 60_000);

  if (absMin < 1) return { text: "עכשיו", direction: "now", minutes: 0 };

  let magnitude: string;
  if (absMin < 60) {
    magnitude = heCount(absMin, "דקה", "שתי דקות", "דקות");
  } else if (absMin < 60 * 24) {
    const hours = Math.round(absMin / 60);
    magnitude = heCount(hours, "שעה", "שעתיים", "שעות");
  } else {
    const days = Math.round(absMin / (60 * 24));
    if (days < 14) {
      magnitude = heCount(days, "יום", "יומיים", "ימים");
    } else if (days < 60) {
      const weeks = Math.round(days / 7);
      magnitude = heCount(weeks, "שבוע", "שבועיים", "שבועות");
    } else {
      const months = Math.round(days / 30);
      magnitude = heCount(months, "חודש", "חודשיים", "חודשים");
    }
  }

  return diffMs >= 0
    ? { text: `בעוד ${magnitude}`, direction: "future", minutes: Math.round(diffMs / 60_000) }
    : { text: `לפני ${magnitude}`, direction: "past", minutes: Math.round(diffMs / 60_000) };
}

/** תחילת היום (00:00) באזור התצוגה, כרגע UTC. */
export function startOfDayIn(instant: Date, timeZone: string = DISPLAY_TZ): Date {
  const p = zonedParts(instant, timeZone);
  const pad = (n: number) => String(n).padStart(2, "0");
  return zonedToUtc(`${p.year}-${pad(p.month)}-${pad(p.day)}T00:00`, timeZone);
}

export function endOfDayIn(instant: Date, timeZone: string = DISPLAY_TZ): Date {
  return new Date(startOfDayIn(instant, timeZone).getTime() + 24 * 3_600_000);
}

/**
 * סוף "השבוע" למסך היום: סוף יום שישי הקרוב. אם היום שישי או שבת —
 * סוף שבת, כדי שלא תיווצר קבוצה ריקה.
 */
export function endOfWeekIn(instant: Date, timeZone: string = DISPLAY_TZ): Date {
  const p = zonedParts(instant, timeZone);
  const weekday = new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay(); // 0=ראשון
  const daysToSaturday = 6 - weekday;
  const start = startOfDayIn(instant, timeZone);
  return new Date(start.getTime() + (daysToSaturday + 1) * 24 * 3_600_000);
}

export function addMinutes(instant: Date, minutes: number): Date {
  return new Date(instant.getTime() + minutes * 60_000);
}

export const MINUTES = { hour: 60, day: 60 * 24 } as const;
