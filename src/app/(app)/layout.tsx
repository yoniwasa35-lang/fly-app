import Link from "next/link";
import { logoutAction } from "../login/actions";
import { BrandMark, Wordmark } from "@/components/Brand";
import { Icon } from "@/components/Icon";
import { NavLink } from "./NavLink";
import { ThemeToggle } from "./ThemeToggle";

/** הניווט מופיע רק אחרי כניסה. דף ההתחברות יושב מחוץ לקבוצה הזו. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app">
      <nav className="nav" aria-label="ניווט ראשי">
        {/*
          הלוגו מופיע רק במסך רחב. בטלפון הניווט יושב בתחתית המסך, בטווח
          האגודל, ושם כל פיקסל שייך ליעד ניווט — לא לזהות.
        */}
        <Link href="/" className="brand-lockup nav-brand" aria-label="LUA Travel — לדף הבית">
          <BrandMark />
          <Wordmark />
        </Link>

        <NavLink href="/" icon="today" label="היום" />
        <NavLink href="/trips" icon="trips" label="כל התיקים" />
        <NavLink href="/messages" icon="messages" label="הודעות" />

        <form action={logoutAction}>
          <button type="submit">
            <Icon name="logout" />
            <span>יציאה</span>
          </button>
        </form>

        <ThemeToggle />
      </nav>
      {children}
    </div>
  );
}
