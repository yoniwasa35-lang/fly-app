import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // המסכים כולם דינמיים (force-dynamic) — תור פעולות לא נשמר ב-cache,
  // ופרטי נוסעים לא נכנסים לתגובות שמורות.
  reactStrictMode: true,
};

export default nextConfig;
