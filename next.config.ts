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

export default nextConfig;
