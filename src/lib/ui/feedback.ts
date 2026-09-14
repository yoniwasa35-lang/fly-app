/**
 * משוב מישושי.
 *
 * אמת לא נוחה: **באייפון אין לזה תמיכה.** ל-Safari ב-iOS אין Vibration
 * API ואין דרך אחרת מדפדפן להפעיל רטט. אנדרואיד כן תומך. לכן זו פונקציה
 * שמתנהגת כמו כלום היכן שאין תמיכה, במקום תלות שמבטיחה משהו שלא יקרה.
 *
 * הרטט קצר בכוונה — עשר אלפיות שנייה. אישור, לא התראה.
 */
export function tap(pattern: number | number[] = 10): void {
  if (typeof navigator === "undefined") return;

  /*
   * חתימה משלנו ולא חיתוך עם Navigator: ההגדרה המובנית מצרה את הטיפוס
   * ל-VibratePattern, וחיתוך איתה נותן טיפוס שאי אפשר לקרוא לו.
   */
  type Vibrator = { vibrate?: (p: number | number[]) => boolean };
  const v = (navigator as unknown as Vibrator).vibrate;
  if (typeof v !== "function") return;

  try {
    // מי שביקש מהמערכת פחות תנועה ביקש גם פחות מזה.
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    v.call(navigator, pattern);
  } catch {
    // דפדפנים חוסמים רטט ללא מחווה קודמת של המשתמש. זו לא תקלה.
  }
}
