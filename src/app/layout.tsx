import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "תיקי נסיעה",
  description: "ניהול מחזור חיי נסיעה",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
  // המערכת מחזיקה פרטי לקוחות. אין סיבה שתופיע במנועי חיפוש.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body>
        <div className="app">{children}</div>
      </body>
    </html>
  );
}
