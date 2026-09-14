/**
 * מנוע התבניות של ההודעות — סעיף 9.
 *
 * שני כללים שמנחים את המימוש:
 *   1. משתנה שאין לו ערך לא נעלם בשקט. הוא נשאר גלוי בטקסט ומדווח בנפרד,
 *      כדי שלא תישלח ללקוח הודעה עם "הצ'ק-אין נסגר בשעה ." ריקה.
 *   2. כל ערך שמוכנס לטקסט עברי עובר בידוד כיווניות, אחרת הפיסוק קופץ צד.
 */

import { anchorRtlLines, isolate } from "./bidi";
import { ENV_BACKED, VARIABLE_NAMES } from "./variables";

const TOKEN = /\{\{\s*([^}]+?)\s*\}\}/g;

export type RenderResult = {
  text: string;
  /** משתנים שהתבנית ביקשה ואין להם ערך. */
  missing: Array<{ name: string; envVar?: string }>;
  /** משתנים שהתבנית ביקשה ואינם קיימים בקטלוג — כנראה שגיאת כתיב. */
  unknown: string[];
};

export function renderTemplate(body: string, values: Record<string, string>): RenderResult {
  const missing: RenderResult["missing"] = [];
  const unknown: string[] = [];

  const text = body.replace(TOKEN, (whole, rawName: string) => {
    const name = rawName.trim();

    if (!VARIABLE_NAMES.has(name)) {
      if (!unknown.includes(name)) unknown.push(name);
      return whole;
    }

    const value = values[name];
    if (!value || !value.trim()) {
      if (!missing.some((m) => m.name === name)) {
        missing.push({ name, envVar: ENV_BACKED[name] });
      }
      return whole;
    }

    return isolate(value.trim());
  });

  return { text: anchorRtlLines(text).trim(), missing, unknown };
}

/** אילו משתנים תבנית משתמשת בהם — לתצוגה במסך התבניות. */
export function templateVariables(body: string): string[] {
  const found = new Set<string>();
  for (const match of body.matchAll(TOKEN)) found.add(match[1].trim());
  return [...found];
}
