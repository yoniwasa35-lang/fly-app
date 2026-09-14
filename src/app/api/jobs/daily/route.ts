import { NextResponse } from "next/server";
import { runDailyJob } from "@/lib/jobs/daily";
import { constantTimeEqual } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * נקודת כניסה ל-cron חיצוני. ה-job עצמו הוא פונקציה רגילה ואפשר להריץ אותו
 * גם מהטרמינל (npm run job:daily) — זו רק עטיפת HTTP.
 *
 * מקבל גם GET וגם POST, כי חלק מהמתזמנים (ובהם Vercel Cron) שולחים GET.
 * הטוקן מתקבל ב-Authorization: Bearer, ומושווה ל-DAILY_JOB_TOKEN או
 * ל-CRON_SECRET שהפלטפורמה מזריקה בעצמה.
 */
async function handle(request: Request) {
  const accepted = [process.env.DAILY_JOB_TOKEN, process.env.CRON_SECRET].filter(
    (v): v is string => !!v?.trim(),
  );
  if (accepted.length === 0) {
    return NextResponse.json({ error: "לא הוגדר טוקן ל-job היומי" }, { status: 500 });
  }

  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!accepted.some((token) => constantTimeEqual(provided, token))) {
    return NextResponse.json({ error: "לא מורשה" }, { status: 401 });
  }

  const result = await runDailyJob();
  return NextResponse.json(result, { status: result.errors.length ? 207 : 200 });
}

export const GET = handle;
export const POST = handle;
