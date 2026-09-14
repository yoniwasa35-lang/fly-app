"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  constantTimeEqual,
  createSessionToken,
} from "@/lib/auth/session";
import { checkThrottle, clearFailures, recordFailure } from "@/lib/auth/throttle";

export type LoginState = { error?: string };

function clientKey(forwardedFor: string | null): string {
  // הכתובת הראשונה ב-x-forwarded-for היא של הלקוח; השאר הם פרוקסים.
  return forwardedFor?.split(",")[0].trim() || "unknown";
}

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const expected = process.env.APP_PASSCODE;
  if (!expected) {
    return { error: "APP_PASSCODE לא מוגדר בשרת. המערכת לא תיפתח בלי סיסמה." };
  }

  const key = clientKey((await headers()).get("x-forwarded-for"));

  const throttled = await checkThrottle(key);
  if (throttled.blocked) {
    return { error: `יותר מדי ניסיונות. נסו שוב בעוד ${throttled.secondsLeft} שניות.` };
  }

  const passcode = String(formData.get("passcode") ?? "");
  if (!constantTimeEqual(passcode, expected)) {
    const after = await recordFailure(key);
    return {
      error: after.blocked
        ? `סיסמה שגויה. יותר מדי ניסיונות — נסו שוב בעוד ${after.secondsLeft} שניות.`
        : "סיסמה שגויה.",
    };
  }

  await clearFailures(key);

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
