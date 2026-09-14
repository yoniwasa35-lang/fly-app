"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  constantTimeEqual,
  createSessionToken,
} from "@/lib/auth/session";

export type LoginState = { error?: string };

/**
 * האטה פשוטה על ניסיונות כושלים. נשמרת בזיכרון התהליך, כלומר מתאפסת בפריסה
 * ואינה משותפת בין מופעים — מספיק מול ניחוש ידני של שני משתמשים, לא מול
 * תוקף מתמיד. ההגנה האמיתית היא אורך הסיסמה.
 */
const attempts = new Map<string, { count: number; blockedUntil: number }>();
const MAX_ATTEMPTS = 5;
const BLOCK_MS = 60_000;

function clientKey(forwardedFor: string | null): string {
  return forwardedFor?.split(",")[0].trim() || "unknown";
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const expected = process.env.APP_PASSCODE;
  if (!expected) {
    return { error: "APP_PASSCODE לא מוגדר בשרת. המערכת לא תיפתח בלי סיסמה." };
  }

  const key = clientKey((await headers()).get("x-forwarded-for"));
  const record = attempts.get(key);
  const now = Date.now();

  if (record && record.blockedUntil > now) {
    const seconds = Math.ceil((record.blockedUntil - now) / 1000);
    return { error: `יותר מדי ניסיונות. נסו שוב בעוד ${seconds} שניות.` };
  }

  const passcode = String(formData.get("passcode") ?? "");
  if (!constantTimeEqual(passcode, expected)) {
    const count = (record?.count ?? 0) + 1;
    attempts.set(key, {
      count,
      blockedUntil: count >= MAX_ATTEMPTS ? now + BLOCK_MS : 0,
    });
    return { error: "סיסמה שגויה." };
  }

  attempts.delete(key);

  (await cookies()).set(SESSION_COOKIE, await createSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  const next = String(formData.get("next") ?? "");
  // רק נתיב פנימי, אחרת אפשר להשתמש בדף ההתחברות כקרש קפיצה לאתר אחר.
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
}

export async function logoutAction(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
