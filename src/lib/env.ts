/**
 * בדיקת סביבה בעלייה. עדיף שהשרת לא יעלה בכלל מאשר שיעלה בלי מנעול על
 * מסד שמחזיק מספרי דרכון, או בלי מפתח הצפנה — ואז ייכשל רק כשמישהו ינסה
 * לשמור נוסע.
 */

const REQUIRED = [
  ["DATABASE_URL", "כתובת מסד הנתונים"],
  ["APP_PASSCODE", "הסיסמה המשותפת לכניסה"],
  ["SESSION_SECRET", "מפתח חתימת עוגיית ההתחברות"],
  ["PASSPORT_ENCRYPTION_KEY", "מפתח הצפנת מספרי דרכון"],
  ["DAILY_JOB_TOKEN", "הטוקן להרצת ה-job היומי"],
] as const;

function isBase32Bytes(value: string): boolean {
  try {
    return Buffer.from(value, "base64").length === 32;
  } catch {
    return false;
  }
}

export function checkEnv(): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const [key, description] of REQUIRED) {
    if (!process.env[key]?.trim()) errors.push(`חסר ${key} — ${description}`);
  }

  for (const key of ["SESSION_SECRET", "PASSPORT_ENCRYPTION_KEY"]) {
    const value = process.env[key];
    if (value?.trim() && !isBase32Bytes(value)) {
      errors.push(`${key} חייב להיות 32 בתים ב-base64`);
    }
  }

  const passcode = process.env.APP_PASSCODE ?? "";
  if (passcode && passcode.length < 12 && process.env.NODE_ENV === "production") {
    errors.push("APP_PASSCODE קצר מ-12 תווים. זו הסיסמה היחידה שמגנה על פרטי הלקוחות.");
  }

  if (!process.env.DIRECT_DATABASE_URL?.trim()) {
    warnings.push("DIRECT_DATABASE_URL לא מוגדר. אם הספק שלכם משתמש ב-pooler, מיגרציות ייכשלו.");
  }

  return { errors, warnings };
}

/** נקרא פעם אחת בעליית השרת. בפיתוח רק מזהיר, בפרודקשן מפיל. */
export function assertEnv(): void {
  const { errors, warnings } = checkEnv();
  for (const w of warnings) console.warn(`[env] אזהרה: ${w}`);
  if (errors.length === 0) return;

  const message = ["בעיות בהגדרות הסביבה:", ...errors.map((e) => `  • ${e}`)].join("\n");
  if (process.env.NODE_ENV === "production") throw new Error(message);
  console.warn(`[env]\n${message}`);
}
