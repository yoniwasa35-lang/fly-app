import { NextResponse } from "next/server";
import { runDailyJob } from "@/lib/jobs/daily";

export const dynamic = "force-dynamic";

/**
 * נקודת כניסה ל-cron חיצוני. ה-job עצמו הוא פונקציה רגילה ואפשר להריץ אותו
 * גם מהטרמינל (npm run job:daily) — זה רק עטיפת HTTP.
 */
export async function POST(request: Request) {
  const expected = process.env.DAILY_JOB_TOKEN;
  if (!expected) {
    return NextResponse.json({ error: "DAILY_JOB_TOKEN לא מוגדר" }, { status: 500 });
  }
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (provided !== expected) {
    return NextResponse.json({ error: "לא מורשה" }, { status: 401 });
  }

  const result = await runDailyJob();
  return NextResponse.json(result, { status: result.errors.length ? 207 : 200 });
}
