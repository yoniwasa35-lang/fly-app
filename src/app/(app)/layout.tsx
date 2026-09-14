import Link from "next/link";
import { logoutAction } from "../login/actions";

/** הניווט מופיע רק אחרי כניסה. דף ההתחברות יושב מחוץ לקבוצה הזו. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <nav className="nav">
        <Link href="/">היום</Link>
        <Link href="/trips">כל התיקים</Link>
        <Link href="/messages">הודעות</Link>
        <form action={logoutAction} style={{ marginInlineStart: "auto" }}>
          <button className="btn-quiet" type="submit" style={{ minHeight: "auto", fontSize: "0.85rem" }}>
            יציאה
          </button>
        </form>
      </nav>
      {children}
    </>
  );
}
