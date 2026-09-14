/**
 * הכנת מסד הבדיקות.
 *
 * חלק מהבדיקות רצות מול מסד אמיתי. עד עכשיו הן רכבו על מסד הפיתוח,
 * שינו אותו, וניקו אחריהן — אבל הרצה שנפלה באמצע דילגה על הניקוי,
 * וההרצה הבאה התחילה מלוכלכת. התוצאה הייתה בדיקה שנופלת אחת לכמה
 * הרצות בלי קשר לקוד, וכזו גרועה מבדיקה שלא קיימת: היא מלמדת להתעלם.
 *
 * עכשיו יש מסד נפרד שנבנה מאפס לפני כל הרצה. נתוני הפיתוח לא נוגעים,
 * והבדיקות מתחילות תמיד מאותה נקודה.
 */

import { execFileSync } from "node:child_process";

export default function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error(
      "חסר TEST_DATABASE_URL. הוסיפו אותו ל-.env, למשל:\n" +
        '  TEST_DATABASE_URL="postgresql://fly@127.0.0.1:5433/flyapp_test?schema=public"',
    );
  }

  const env = { ...process.env, DATABASE_URL: url, DIRECT_DATABASE_URL: url };
  const run = (args: string[]) =>
    execFileSync("npx", args, { env, stdio: "pipe", encoding: "utf8" });

  // migrate deploy בלבד — פקודה שמוסיפה ואינה הורסת. אין כאן reset
  // בכוונה: פקודה שמוחקת מסד לא צריכה לשבת בסקריפט שרץ אוטומטית, גם
  // כשהיא מכוונת למסד בדיקות. הזריעה מנקה את הטבלאות שהיא עצמה ממלאת.
  run(["prisma", "migrate", "deploy"]);
  execFileSync("npx", ["tsx", "prisma/seed.ts"], { env, stdio: "pipe", encoding: "utf8" });
}
