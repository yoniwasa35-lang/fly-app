import { defineConfig } from "vitest/config";
import { config as loadEnv } from "dotenv";
import path from "node:path";

loadEnv({ path: ".env", quiet: true });

const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ??
  "postgresql://fly@127.0.0.1:5433/flyapp_test?schema=public";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globalSetup: ["./tests/global-setup.ts"],

    /*
     * מסד נפרד לבדיקות, שנבנה מאפס בכל הרצה. נתוני הפיתוח לא נוגעים.
     */
    env: {
      DATABASE_URL: testDatabaseUrl,
      DIRECT_DATABASE_URL: testDatabaseUrl,
      TEST_DATABASE_URL: testDatabaseUrl,
    },

    /*
     * הבדיקות חולקות מסד אחד, ולכן הרצה מקבילה של קבצים גרמה לקובץ אחד
     * לחטוף תיק שקובץ אחר בדיוק יצר. ההסדרה עולה כמה שניות, וזה מחיר זול.
     */
    fileParallelism: false,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
