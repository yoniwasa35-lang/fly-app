import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // פרטי נוסעים לא נכנסים ל-cache של תגובות
    staleTimes: { dynamic: 0, static: 0 },
  },
};

export default nextConfig;
