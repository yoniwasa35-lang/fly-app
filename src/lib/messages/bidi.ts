/**
 * טקסט דו-כיווני — המלכודת האחרונה בסעיף 14.
 *
 * כשמכניסים ערך לטיני או מספרי לתוך משפט בעברית, אלגוריתם הכיווניות של
 * מערכת ההפעלה עלול להזיז סימני פיסוק וסוגריים לצד הלא נכון. הדוגמה
 * הקלאסית: "טיסה W6 4351 יוצאת ב-06:20." — הנקודה קופצת לתחילת השורה.
 *
 * הפתרון בטקסט נטו, בלי HTML ובלי CSS, הוא תווי בקרה בלתי נראים של יוניקוד.
 * FSI מבודד את הערך ומזהה את כיוונו לבד, ו-PDI סוגר את הבידוד. וואטסאפ
 * מעביר אותם כמו שהם למנוע הטקסט של המכשיר.
 */

/** First Strong Isolate — U+2068 */
export const FSI = "⁨";
/** Pop Directional Isolate — U+2069 */
export const PDI = "⁩";
/** Right-to-Left Mark — U+200F */
export const RLM = "‏";

const HAS_LATIN_OR_DIGIT = /[A-Za-z0-9]/;

/**
 * עוטף ערך בבידוד כיווניות, אבל רק אם הוא באמת עלול לשבש את השורה.
 * ערך בעברית בלבד נשאר נקי, כדי שלא נזהם כל הודעה בתווים מיותרים.
 */
export function isolate(value: string): string {
  if (!value) return value;
  if (!HAS_LATIN_OR_DIGIT.test(value)) return value;
  return `${FSI}${value}${PDI}`;
}

/** מסיר את תווי הבקרה — לתצוגה, להשוואה ולספירת תווים. */
export function stripBidi(text: string): string {
  return text.replace(/[⁦-⁩‎‏‪-‮]/g, "");
}

/**
 * שורה שמסתיימת בערך לטיני או מספרי ואחריו סימן פיסוק — הפיסוק עלול
 * להיראות בצד השמאלי. סימן RLM בסוף מקבע את השורה כימנית-לשמאלית.
 *
 * מוסיפים אותו רק כשיש באמת סיכון, כלומר כשהתו שלפני הפיסוק הוא סוף בידוד
 * או תו לטיני או ספרה. שורה בעברית טהורה לא צריכה אותו, ואין טעם לזהם
 * בתווים בלתי נראים טקסט שהסוכן עוד עשוי להעתיק ולערוך.
 */
export function anchorRtlLines(text: string): string {
  const trailingPunctuation = /([.!?:,;)\]}»"']+)$/;

  return text
    .split("\n")
    .map((line) => {
      const trimmed = line.trimEnd();
      if (!trimmed || !/[\u0590-\u05FF]/.test(trimmed)) return line;

      const match = trailingPunctuation.exec(trimmed);
      if (!match) return line;

      const before = trimmed.slice(0, match.index);
      const lastChar = before.at(-1);
      if (!lastChar) return line;

      const atRisk = lastChar === PDI || /[A-Za-z0-9]/.test(lastChar);
      return atRisk ? `${trimmed}${RLM}` : line;
    })
    .join("\n");
}
