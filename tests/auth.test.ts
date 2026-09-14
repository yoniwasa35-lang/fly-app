import { beforeAll, describe, expect, it } from "vitest";
import {
  constantTimeEqual,
  createSessionToken,
  verifySessionToken,
} from "@/lib/auth/session";
import { checkEnv } from "@/lib/env";
import { withEnv } from "./env-helper";

const SECRET = Buffer.alloc(32, 7).toString("base64");
const OTHER = Buffer.alloc(32, 9).toString("base64");

beforeAll(() => {
  process.env.SESSION_SECRET = SECRET;
});

describe("עוגיית ההתחברות", () => {
  it("אסימון תקין עובר אימות", async () => {
    expect(await verifySessionToken(await createSessionToken())).toBe(true);
  });

  it("אסימון שפג תוקפו נדחה", async () => {
    const token = await createSessionToken(new Date("2026-01-01T00:00:00Z"));
    expect(await verifySessionToken(token, new Date("2026-03-01T00:00:00Z"))).toBe(false);
  });

  it("אי אפשר להאריך תוקף בלי המפתח", async () => {
    const token = await createSessionToken();
    const forged = `${Date.now() + 10 * 365 * 24 * 3_600_000}.${token.split(".")[1]}`;
    expect(await verifySessionToken(forged)).toBe(false);
  });

  it("אסימון שנחתם במפתח אחר נדחה", async () => {
    const token = await createSessionToken();
    process.env.SESSION_SECRET = OTHER;
    expect(await verifySessionToken(token)).toBe(false);
    process.env.SESSION_SECRET = SECRET;
  });

  it("קלט פגום לא מפיל את השרת", async () => {
    for (const bad of ["", "abc", ".", "1.", "...", "9999999999999.@@@"]) {
      expect(await verifySessionToken(bad)).toBe(false);
    }
    expect(await verifySessionToken(undefined)).toBe(false);
  });
});

describe("השוואת סיסמה בזמן קבוע", () => {
  it("מזהה זהות והבדל", () => {
    expect(constantTimeEqual("סיסמה-ארוכה-מאוד", "סיסמה-ארוכה-מאוד")).toBe(true);
    expect(constantTimeEqual("סיסמה-ארוכה-מאוד", "סיסמה-ארוכה-מאוג")).toBe(false);
    expect(constantTimeEqual("abc", "abcd")).toBe(false);
    expect(constantTimeEqual("", "")).toBe(true);
  });
});

describe("בדיקת סביבה", () => {
  it("סביבה מלאה עוברת", () => {
    withEnv(
      {
        DATABASE_URL: "postgresql://x", DIRECT_DATABASE_URL: "postgresql://x",
        APP_PASSCODE: "סיסמה-ארוכה-מספיק", SESSION_SECRET: SECRET,
        PASSPORT_ENCRYPTION_KEY: SECRET, DAILY_JOB_TOKEN: "t",
      },
      () => expect(checkEnv().errors).toEqual([]),
    );
  });

  it("מפתח באורך לא נכון נתפס", () => {
    withEnv(
      {
        DATABASE_URL: "postgresql://x", APP_PASSCODE: "סיסמה-ארוכה-מספיק",
        SESSION_SECRET: Buffer.alloc(16).toString("base64"),
        PASSPORT_ENCRYPTION_KEY: SECRET, DAILY_JOB_TOKEN: "t",
      },
      () => expect(checkEnv().errors.join()).toMatch(/SESSION_SECRET.*32 בתים/),
    );
  });

  it("משתנה חסר מדווח בשמו", () => {
    withEnv(
      { DATABASE_URL: undefined, APP_PASSCODE: undefined, SESSION_SECRET: undefined,
        PASSPORT_ENCRYPTION_KEY: undefined, DAILY_JOB_TOKEN: undefined },
      () => {
        const errors = checkEnv().errors.join(" ");
        expect(errors).toContain("APP_PASSCODE");
        expect(errors).toContain("PASSPORT_ENCRYPTION_KEY");
      },
    );
  });

  it("סיסמה קצרה נחסמת בפרודקשן בלבד", () => {
    const base = {
      DATABASE_URL: "postgresql://x", DIRECT_DATABASE_URL: "postgresql://x",
      SESSION_SECRET: SECRET, PASSPORT_ENCRYPTION_KEY: SECRET, DAILY_JOB_TOKEN: "t",
      APP_PASSCODE: "1234",
    };
    withEnv({ ...base, NODE_ENV: "production" },
      () => expect(checkEnv().errors.join()).toMatch(/APP_PASSCODE קצר/));
    withEnv({ ...base, NODE_ENV: "development" },
      () => expect(checkEnv().errors).toEqual([]));
  });
});
