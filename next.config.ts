import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // המסכים כולם דינמיים (force-dynamic) — תור פעולות לא נשמר ב-cache,
  // ופרטי נוסעים לא נכנסים לתגובות שמורות.
  reactStrictMode: true,

  // תבניות ההודעות נקראות מהדיסק בזמן ריצה, לא מיובאות לתוך החבילה, כדי
  // שיישארו קובצי טקסט שאפשר לערוך. צריך לומר ל-Next לארוז אותן.
  outputFileTracingIncludes: { "/**": ["./config/messages/**"] },

  // פלט standalone נדרש רק לבנייה בקונטיינר, ואז ה-Dockerfile מדליק את
  // הדגל. ב-Vercel וב-next start מקומי הוא מיותר ואף מבלבל.
  output: process.env.BUILD_STANDALONE === "1" ? "standalone" : undefined,
};

/**
 * כותרות אבטחה. אין כאן CSP מלא, כי הוא דורש תחזוקה מתמשכת ואין באפליקציה
 * שום סקריפט חיצוני — אבל שלוש הכותרות האלה חוסמות וקטורים אמיתיים בזול.
 */
nextConfig.headers = async () => [
  {
    source: "/:path*",
    headers: [
      // אין שום סיבה שהמערכת תוצג בתוך מסגרת באתר אחר.
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-DNS-Prefetch-Control", value: "off" },
    ],
  },
  {
    // עמוד הלקוח: הטוקן נמצא בכתובת עצמה, ולכן הכתובת לא יוצאת בשום
    // Referer — גם לא כשהלקוח לוחץ על קישור לוואטסאפ.
    source: "/c/:path*",
    headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
  },
];

export default nextConfig;
