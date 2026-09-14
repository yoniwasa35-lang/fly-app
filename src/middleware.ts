import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";

/**
 * שומר הסף. כל דבר שאינו ברשימה הפתוחה מחייב התחברות.
 *
 * PUBLIC_PREFIXES מוכן מראש לשלב 4: עמוד הלקוח יחיה תחת /c/<טוקן> ויהיה
 * פתוח בכוונה — הקישור עצמו הוא הסוד. הוא לעולם לא יציג מספרי דרכון.
 */
const PUBLIC_PREFIXES = ["/login", "/api/jobs/", "/api/health", "/c/"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  if (await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value)) {
    return NextResponse.next();
  }

  const login = request.nextUrl.clone();
  login.pathname = "/login";
  login.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname)}`;
  return NextResponse.redirect(login);
}

export const config = {
  // כל מה שאינו נכס סטטי. הנקודה בסוף התבנית מוציאה גם קבצים מ-public
  // (icon.svg, manifest וכו׳) — בלעדיה הם מקבלים הפניה לדף ההתחברות.
  matcher: ["/((?!_next/static|_next/image|.*\\.[\\w]+$).*)"],
};
