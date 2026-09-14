/**
 * החלפת משתני סביבה בבדיקה.
 *
 * שחזור על ידי `process.env = snapshot` נראה תמים אבל מחליף את האובייקט
 * כולו, ואז תמונת מצב ישנה מוחקת משתנה שקובץ בדיקות אחר הגדיר בינתיים.
 * זה מייצר בדיקה מרצדת — וכזו גרועה מבדיקה שלא קיימת, כי היא מלמדת
 * להתעלם ממנה.
 *
 * כאן משחזרים מפתח-מפתח, ורק את מה שבאמת נגענו בו.
 */
export function withEnv(overrides: Record<string, string | undefined>, fn: () => void): void {
  const previous = new Map<string, string | undefined>();

  for (const [key, value] of Object.entries(overrides)) {
    previous.set(key, process.env[key]);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  try {
    fn();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}
