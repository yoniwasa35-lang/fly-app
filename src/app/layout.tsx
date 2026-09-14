import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "תיקי נסיעה",
  description: "ניהול מחזור חיי נסיעה",
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
        <div className="app">
          <nav className="nav">
            <Link href="/">היום</Link>
            <Link href="/trips">כל התיקים</Link>
          </nav>
          {children}
        </div>
      </body>
    </html>
  );
}
