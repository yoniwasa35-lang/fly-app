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

  for (const [key, what] of [
    ["AGENT_NAME", "החתימה בתחתית ההודעות"],
    ["AGENCY_NAME", "שם העסק בהודעות"],
    ["AGENT_EMERGENCY_PHONE", "מספר החירום שנשלח ללקוח לפני היציאה"],
  ] as const) {
    if (!process.env[key]?.trim()) {
      warnings.push(`${key} לא מוגדר — ${what}. הודעות שמשתמשות בו ייחסמו לפני שליחה.`);
    }
  }

  const rate = process.env.HOST_AGENCY_FEE_RATE;
  if (rate?.trim()) {
    const value = Number(rate);
    if (!Number.isFinite(value) || value < 0 || value >= 1) {
      errors.push(`HOST_AGENCY_FEE_RATE לא תקין: "${rate}". צריך מספר בין 0 ל-1, למשל 0.01`);
    }
  }

  if (!process.env.PUBLIC_BASE_URL?.trim() && !process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim()) {
    warnings.push(
      "PUBLIC_BASE_URL לא מוגדר ואין כתובת מהפלטפורמה — הודעות שמכילות את הקישור ללקוח ייחסמו לפני שליחה.",
    );
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
