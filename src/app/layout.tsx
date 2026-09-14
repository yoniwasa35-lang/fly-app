import type { Metadata, Viewport } from "next";
import { Heebo, Cormorant_Garamond } from "next/font/google";
import "./globals.css";

/*
 * הגופנים נארזים יחד עם האפליקציה בזמן הבנייה ולא נמשכים מ-Google בזמן
 * ריצה. זה לא רק מהיר יותר: המערכת מחזיקה פרטי דרכון, ועמוד הלקוח נפתח
 * אצל לקוחות אמיתיים — אין שום סיבה שכל צפייה בעמוד תדווח לשרת חיצוני.
 */
const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ui",
  display: "swap",
});

/* הסריף של הלוגו. לטינית בלבד — הוא משמש רק למילה LUA. */
const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "LUA Travel — תיקי נסיעה",
  description: "ניהול מחזור חיי נסיעה",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
  appleWebApp: { capable: true, title: "LUA Travel", statusBarStyle: "black-translucent" },
  // המערכת מחזיקה פרטי לקוחות. אין סיבה שתופיע במנועי חיפוש.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // הגבלה ל-5 ולא חסימה: אסור למנוע מהמשתמש להגדיל את המסך.
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0f19" },
  ],
};

/*
 * בחירת המצב הבהיר/כהה חייבת לקרות לפני הציור הראשון, אחרת המסך מהבהב
 * בלבן לרגע לפני שהוא נצבע כהה. לכן זה סקריפט זעיר ב-head ולא אפקט
 * בריאקט. ה-try/catch אינו קישוט: בגלישה פרטית הגישה ל-localStorage
 * זורקת שגיאה, ובלעדיו העמוד היה נשאר ריק.
 */
const THEME_SCRIPT = `try{var t=localStorage.getItem("theme");if(t==="dark"||t==="light"){document.documentElement.dataset.theme=t}}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={`${heebo.variable} ${cormorant.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        {/*
          עטיפת ה-.app יושבת בפריסה של האזור המחובר ולא כאן, כדי שמסך
          הכניסה יוכל להתפרש על כל המסך ברקע הכהה של המותג.
        */}
        {children}
      </body>
    </html>
  );
}
